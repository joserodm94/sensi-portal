-- Migración 4 — Portal de Personal Sensi
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run
-- (No borra ni afecta los datos que ya tienes: solo agrega lo nuevo)

alter table payroll add column if not exists afp numeric not null default 0;
alter table payroll add column if not exists sfs numeric not null default 0;
alter table payroll add column if not exists isr numeric not null default 0;
alter table payroll add column if not exists other_deductions numeric not null default 0;

drop function if exists admin_save_payroll(uuid,uuid,text,numeric,numeric,numeric,date,text);
create or replace function admin_save_payroll(
  p_payroll_id uuid, p_teacher_id uuid, p_month text,
  p_bruto numeric, p_afp numeric, p_sfs numeric, p_isr numeric, p_other_deductions numeric,
  p_neto numeric, p_fecha_pago date, p_nota text
)
returns payroll
language plpgsql security definer set search_path = public as $$
declare v_row payroll; v_deducciones numeric;
begin
  v_deducciones := coalesce(p_afp,0)+coalesce(p_sfs,0)+coalesce(p_isr,0)+coalesce(p_other_deductions,0);
  if p_payroll_id is null then
    insert into payroll (teacher_id, month, bruto, afp, sfs, isr, other_deductions, deducciones, neto, fecha_pago, nota)
    values (p_teacher_id, p_month, p_bruto, coalesce(p_afp,0), coalesce(p_sfs,0), coalesce(p_isr,0), coalesce(p_other_deductions,0), v_deducciones, p_neto, p_fecha_pago, p_nota)
    on conflict (teacher_id, month) do update set
      bruto = excluded.bruto, afp = excluded.afp, sfs = excluded.sfs, isr = excluded.isr,
      other_deductions = excluded.other_deductions, deducciones = excluded.deducciones,
      neto = excluded.neto, fecha_pago = excluded.fecha_pago, nota = excluded.nota
    returning * into v_row;
  else
    update payroll set teacher_id = p_teacher_id, month = p_month, bruto = p_bruto,
      afp = coalesce(p_afp,0), sfs = coalesce(p_sfs,0), isr = coalesce(p_isr,0),
      other_deductions = coalesce(p_other_deductions,0), deducciones = v_deducciones,
      neto = p_neto, fecha_pago = p_fecha_pago, nota = p_nota
    where id = p_payroll_id
    returning * into v_row;
  end if;
  return v_row;
end;
$$;

drop function if exists admin_list_payroll();
create or replace function admin_list_payroll()
returns table(
  id uuid, teacher_id uuid, teacher_name text, month text, bruto numeric,
  afp numeric, sfs numeric, isr numeric, other_deductions numeric,
  deducciones numeric, neto numeric, fecha_pago date, nota text
)
language sql security definer set search_path = public as $$
  select p.id, p.teacher_id, t.name, p.month, p.bruto, p.afp, p.sfs, p.isr, p.other_deductions,
         p.deducciones, p.neto, p.fecha_pago, p.nota
  from payroll p join teachers t on t.id = p.teacher_id
  order by p.month desc, t.name;
$$;

grant execute on function
  admin_save_payroll(uuid,uuid,text,numeric,numeric,numeric,numeric,numeric,numeric,date,text),
  admin_list_payroll()
to anon, authenticated;
