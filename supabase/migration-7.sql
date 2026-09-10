-- Migración 7 — Portal de Personal Sensi — Facturación de niños
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run
-- (No borra ni afecta los datos que ya tienes: solo agrega lo nuevo)

-- ---------- Tablas ----------

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  tutor_name text not null,
  emails text not null, -- puede tener varios correos separados por coma
  discount_percent numeric not null default 0,
  total_override numeric, -- si está lleno, se factura este monto fijo en vez de la suma de items
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists family_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_name text not null,
  program text not null,
  schedule text,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  invoice_number text not null unique,
  billing_month text not null, -- mes que se factura, formato 'YYYY-MM'
  issue_date date not null,
  due_date date not null,
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'emitida' check (status in ('emitida','pagada')),
  receipt_number text,
  payment_date date,
  items_snapshot jsonb not null default '[]'::jsonb,
  tutor_name_snapshot text,
  emails_snapshot text,
  created_at timestamptz not null default now()
);

alter table families enable row level security;
alter table family_items enable row level security;
alter table invoices enable row level security;
-- (sin políticas = nadie puede leer/escribir directo; solo las funciones de abajo
--  y la función de envío automático, que usa la llave de servicio)

-- ---------- Funciones: administrar familias/niños ----------

create or replace function admin_list_families()
returns table(
  id uuid, tutor_name text, emails text, discount_percent numeric,
  total_override numeric, active boolean, items jsonb
)
language sql security definer set search_path = public as $$
  select f.id, f.tutor_name, f.emails, f.discount_percent, f.total_override, f.active,
    coalesce(
      jsonb_agg(jsonb_build_object(
        'id', fi.id, 'child_name', fi.child_name, 'program', fi.program,
        'schedule', fi.schedule, 'amount', fi.amount
      ) order by fi.created_at) filter (where fi.id is not null),
      '[]'::jsonb
    ) as items
  from families f
  left join family_items fi on fi.family_id = f.id
  group by f.id
  order by f.tutor_name;
$$;

create or replace function admin_save_family(
  p_family_id uuid, p_tutor_name text, p_emails text,
  p_discount_percent numeric, p_total_override numeric
)
returns families
language plpgsql security definer set search_path = public as $$
declare v_row families;
begin
  if p_family_id is null then
    insert into families (tutor_name, emails, discount_percent, total_override)
    values (p_tutor_name, p_emails, coalesce(p_discount_percent,0), p_total_override)
    returning * into v_row;
  else
    update families set tutor_name = p_tutor_name, emails = p_emails,
      discount_percent = coalesce(p_discount_percent,0), total_override = p_total_override
    where id = p_family_id
    returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function admin_toggle_family_active(p_family_id uuid)
returns families
language plpgsql security definer set search_path = public as $$
declare v_row families;
begin
  update families set active = not active where id = p_family_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function admin_delete_family(p_family_id uuid)
returns void
language sql security definer set search_path = public as $$
  delete from families where id = p_family_id;
$$;

create or replace function admin_save_family_item(
  p_item_id uuid, p_family_id uuid, p_child_name text,
  p_program text, p_schedule text, p_amount numeric
)
returns family_items
language plpgsql security definer set search_path = public as $$
declare v_row family_items;
begin
  if p_item_id is null then
    insert into family_items (family_id, child_name, program, schedule, amount)
    values (p_family_id, p_child_name, p_program, p_schedule, coalesce(p_amount,0))
    returning * into v_row;
  else
    update family_items set child_name = p_child_name, program = p_program,
      schedule = p_schedule, amount = coalesce(p_amount,0)
    where id = p_item_id
    returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function admin_delete_family_item(p_item_id uuid)
returns void
language sql security definer set search_path = public as $$
  delete from family_items where id = p_item_id;
$$;

-- ---------- Funciones: facturas ----------

create or replace function admin_list_invoices()
returns table(
  id uuid, family_id uuid, invoice_number text, billing_month text,
  issue_date date, due_date date, subtotal numeric, discount_amount numeric,
  total numeric, status text, receipt_number text, payment_date date,
  items_snapshot jsonb, tutor_name_snapshot text, emails_snapshot text
)
language sql security definer set search_path = public as $$
  select id, family_id, invoice_number, billing_month, issue_date, due_date,
    subtotal, discount_amount, total, status, receipt_number, payment_date,
    items_snapshot, tutor_name_snapshot, emails_snapshot
  from invoices
  order by issue_date desc, invoice_number desc;
$$;

create or replace function admin_mark_invoice_paid(p_invoice_id uuid)
returns table(
  ok boolean, receipt_number text, invoice_number text, tutor_name text,
  emails text, total numeric, items_snapshot jsonb, billing_month text, payment_date date
)
language plpgsql security definer set search_path = public as $$
declare
  v_inv invoices;
  v_seq int;
  v_receipt text;
  v_month_prefix text;
begin
  select * into v_inv from invoices where id = p_invoice_id;
  if not found then
    return query select false, null::text, null::text, null::text, null::text, null::numeric, null::jsonb, null::text, null::date;
    return;
  end if;
  if v_inv.status = 'pagada' then
    return query select true, v_inv.receipt_number, v_inv.invoice_number, v_inv.tutor_name_snapshot,
      v_inv.emails_snapshot, v_inv.total, v_inv.items_snapshot, v_inv.billing_month, v_inv.payment_date;
    return;
  end if;
  v_month_prefix := to_char(current_date, 'YYYY-MM');
  select coalesce(max(cast(split_part(receipt_number,'-',4) as int)), 0) + 1
    into v_seq
  from invoices
  where receipt_number like 'REC-' || v_month_prefix || '-%';
  v_receipt := 'REC-' || v_month_prefix || '-' || lpad(v_seq::text, 3, '0');
  update invoices set status = 'pagada', receipt_number = v_receipt, payment_date = current_date
  where id = p_invoice_id
  returning * into v_inv;
  return query select true, v_inv.receipt_number, v_inv.invoice_number, v_inv.tutor_name_snapshot,
    v_inv.emails_snapshot, v_inv.total, v_inv.items_snapshot, v_inv.billing_month, v_inv.payment_date;
end;
$$;

-- ---------- Permisos ----------
grant execute on function
  admin_list_families(), admin_save_family(uuid,text,text,numeric,numeric),
  admin_toggle_family_active(uuid), admin_delete_family(uuid),
  admin_save_family_item(uuid,uuid,text,text,text,numeric), admin_delete_family_item(uuid),
  admin_list_invoices(), admin_mark_invoice_paid(uuid)
to anon, authenticated;
