-- Portal de Personal Sensi — esquema de base de datos
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run

create extension if not exists "pgcrypto";

-- ---------- TABLAS ----------

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin text not null,
  vacation_days_total integer not null default 14,
  vacation_days_used integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  type text not null check (type in ('vacacion','permiso')),
  start_date date,
  end_date date,
  days integer,
  perm_date date,
  perm_type text,
  reason text,
  status text not null default 'pendiente' check (status in ('pendiente','aprobado','rechazado')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists payroll (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  month text not null, -- formato 'YYYY-MM'
  bruto numeric not null default 0,
  deducciones numeric not null default 0,
  neto numeric not null default 0,
  fecha_pago date,
  nota text,
  created_at timestamptz not null default now(),
  unique (teacher_id, month)
);

create table if not exists admin_config (
  id integer primary key default 1,
  pin text not null default '1234',
  constraint single_row check (id = 1)
);
insert into admin_config (id, pin) values (1, '1234') on conflict (id) do nothing;

-- ---------- SEGURIDAD ----------
-- Bloqueamos el acceso directo a las tablas. Todo pasa por funciones (RPC)
-- controladas abajo, para que nadie pueda leer PINs u otros datos con
-- una consulta directa desde el navegador.

alter table teachers enable row level security;
alter table requests enable row level security;
alter table payroll enable row level security;
alter table admin_config enable row level security;
-- (sin políticas = nadie puede hacer select/insert/update directo; solo las funciones)

-- ---------- FUNCIONES: LOGIN ----------

create or replace function list_active_teacher_names()
returns table(id uuid, name text)
language sql security definer set search_path = public as $$
  select id, name from teachers where active = true order by name;
$$;

create or replace function login_teacher(p_name text, p_pin text)
returns table(id uuid, name text, vacation_days_total integer, vacation_days_used integer)
language sql security definer set search_path = public as $$
  select id, name, vacation_days_total, vacation_days_used
  from teachers
  where name = p_name and pin = p_pin and active = true;
$$;

create or replace function login_admin(p_pin text)
returns boolean
language sql security definer set search_path = public as $$
  select exists(select 1 from admin_config where id = 1 and pin = p_pin);
$$;

-- ---------- FUNCIONES: MAESTRA ----------

create or replace function get_teacher_balance(p_teacher_id uuid)
returns table(vacation_days_total integer, vacation_days_used integer)
language sql security definer set search_path = public as $$
  select vacation_days_total, vacation_days_used from teachers where id = p_teacher_id;
$$;

create or replace function get_teacher_requests(p_teacher_id uuid)
returns setof requests
language sql security definer set search_path = public as $$
  select * from requests where teacher_id = p_teacher_id order by created_at desc;
$$;

create or replace function get_teacher_payroll(p_teacher_id uuid)
returns setof payroll
language sql security definer set search_path = public as $$
  select * from payroll where teacher_id = p_teacher_id order by month desc;
$$;

create or replace function submit_vacation_request(p_teacher_id uuid, p_start_date date, p_end_date date, p_reason text)
returns requests
language plpgsql security definer set search_path = public as $$
declare
  v_days integer;
  v_row requests;
begin
  if p_end_date < p_start_date then
    raise exception 'La fecha final debe ser igual o posterior a la inicial';
  end if;
  v_days := (p_end_date - p_start_date) + 1;
  insert into requests (teacher_id, type, start_date, end_date, days, reason, status)
  values (p_teacher_id, 'vacacion', p_start_date, p_end_date, v_days, p_reason, 'pendiente')
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function submit_permission_request(p_teacher_id uuid, p_date date, p_perm_type text, p_reason text)
returns requests
language plpgsql security definer set search_path = public as $$
declare
  v_row requests;
begin
  insert into requests (teacher_id, type, perm_date, perm_type, reason, status)
  values (p_teacher_id, 'permiso', p_date, p_perm_type, p_reason, 'pendiente')
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------- FUNCIONES: ADMIN ----------

create or replace function admin_list_requests()
returns table(
  id uuid, teacher_id uuid, teacher_name text, type text, start_date date, end_date date,
  days integer, perm_date date, perm_type text, reason text, status text,
  created_at timestamptz, reviewed_at timestamptz
)
language sql security definer set search_path = public as $$
  select r.id, r.teacher_id, t.name, r.type, r.start_date, r.end_date, r.days,
         r.perm_date, r.perm_type, r.reason, r.status, r.created_at, r.reviewed_at
  from requests r join teachers t on t.id = r.teacher_id
  order by (r.status = 'pendiente') desc, r.created_at desc;
$$;

create or replace function admin_review_request(p_request_id uuid, p_decision text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_req requests;
begin
  if p_decision not in ('aprobado','rechazado') then
    raise exception 'Decisión inválida';
  end if;
  select * into v_req from requests where id = p_request_id;
  update requests set status = p_decision, reviewed_at = now() where id = p_request_id;
  if p_decision = 'aprobado' and v_req.type = 'vacacion' then
    update teachers set vacation_days_used = vacation_days_used + v_req.days where id = v_req.teacher_id;
  end if;
end;
$$;

create or replace function admin_list_teachers()
returns setof teachers
language sql security definer set search_path = public as $$
  select * from teachers order by name;
$$;

create or replace function admin_add_teacher(p_name text, p_pin text, p_vacation_days_total integer)
returns teachers
language plpgsql security definer set search_path = public as $$
declare v_row teachers;
begin
  insert into teachers (name, pin, vacation_days_total)
  values (p_name, p_pin, coalesce(p_vacation_days_total, 14))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function admin_edit_teacher(p_teacher_id uuid, p_name text, p_pin text, p_vacation_days_total integer, p_vacation_days_used integer)
returns teachers
language plpgsql security definer set search_path = public as $$
declare v_row teachers;
begin
  update teachers set name = p_name, pin = p_pin,
    vacation_days_total = p_vacation_days_total, vacation_days_used = p_vacation_days_used
  where id = p_teacher_id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function admin_toggle_teacher_active(p_teacher_id uuid)
returns teachers
language plpgsql security definer set search_path = public as $$
declare v_row teachers;
begin
  update teachers set active = not active where id = p_teacher_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function admin_list_payroll()
returns table(
  id uuid, teacher_id uuid, teacher_name text, month text, bruto numeric,
  deducciones numeric, neto numeric, fecha_pago date, nota text
)
language sql security definer set search_path = public as $$
  select p.id, p.teacher_id, t.name, p.month, p.bruto, p.deducciones, p.neto, p.fecha_pago, p.nota
  from payroll p join teachers t on t.id = p.teacher_id
  order by p.month desc, t.name;
$$;

create or replace function admin_save_payroll(
  p_payroll_id uuid, p_teacher_id uuid, p_month text, p_bruto numeric,
  p_deducciones numeric, p_neto numeric, p_fecha_pago date, p_nota text
)
returns payroll
language plpgsql security definer set search_path = public as $$
declare v_row payroll;
begin
  if p_payroll_id is null then
    insert into payroll (teacher_id, month, bruto, deducciones, neto, fecha_pago, nota)
    values (p_teacher_id, p_month, p_bruto, p_deducciones, p_neto, p_fecha_pago, p_nota)
    on conflict (teacher_id, month) do update set
      bruto = excluded.bruto, deducciones = excluded.deducciones, neto = excluded.neto,
      fecha_pago = excluded.fecha_pago, nota = excluded.nota
    returning * into v_row;
  else
    update payroll set teacher_id = p_teacher_id, month = p_month, bruto = p_bruto,
      deducciones = p_deducciones, neto = p_neto, fecha_pago = p_fecha_pago, nota = p_nota
    where id = p_payroll_id
    returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function admin_delete_payroll(p_payroll_id uuid)
returns void
language sql security definer set search_path = public as $$
  delete from payroll where id = p_payroll_id;
$$;

create or replace function admin_change_pin(p_new_pin text)
returns void
language sql security definer set search_path = public as $$
  update admin_config set pin = p_new_pin where id = 1;
$$;

-- ---------- PERMISOS ----------
-- El rol "anon" (usuario público sin cuenta) puede EJECUTAR estas funciones,
-- pero sigue sin poder leer/escribir las tablas directamente.

grant execute on function
  list_active_teacher_names(), login_teacher(text,text), login_admin(text),
  get_teacher_balance(uuid), get_teacher_requests(uuid), get_teacher_payroll(uuid),
  submit_vacation_request(uuid,date,date,text), submit_permission_request(uuid,date,text,text),
  admin_list_requests(), admin_review_request(uuid,text),
  admin_list_teachers(), admin_add_teacher(text,text,integer),
  admin_edit_teacher(uuid,text,text,integer,integer), admin_toggle_teacher_active(uuid),
  admin_list_payroll(), admin_save_payroll(uuid,uuid,text,numeric,numeric,numeric,date,text),
  admin_delete_payroll(uuid), admin_change_pin(text)
to anon, authenticated;
