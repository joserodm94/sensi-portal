-- Migración 5 — Portal de Personal Sensi
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run
-- (No borra ni afecta los datos que ya tienes: solo agrega lo nuevo)

-- ---------- Recuperar PIN (maestra) ----------

create or replace function request_teacher_pin_reset(p_teacher_id uuid)
returns table(ok boolean, message text, email text, teacher_name text, new_pin text)
language plpgsql security definer set search_path = public as $$
declare
  v_teacher teachers;
  v_new_pin text;
begin
  select * into v_teacher from teachers where id = p_teacher_id and active = true;
  if not found then
    return query select false, 'Maestra no encontrada.', null::text, null::text, null::text;
    return;
  end if;
  if v_teacher.email is null or v_teacher.email = '' then
    return query select false, 'No tienes correo registrado. Pide ayuda a la administración.', null::text, v_teacher.name, null::text;
    return;
  end if;
  v_new_pin := lpad((floor(random()*10000))::int::text, 4, '0');
  update teachers set pin = v_new_pin where id = p_teacher_id;
  return query select true, 'PIN reiniciado', v_teacher.email, v_teacher.name, v_new_pin;
end;
$$;

-- ---------- Recuperar PIN (administración) ----------

alter table admin_config add column if not exists admin_email text;

drop function if exists get_public_settings();
create or replace function get_public_settings()
returns table(vacation_requests_enabled boolean, office_ip text, admin_email text)
language sql security definer set search_path = public as $$
  select vacation_requests_enabled, office_ip, admin_email from admin_config where id = 1;
$$;

create or replace function admin_set_recovery_email(p_email text)
returns void
language sql security definer set search_path = public as $$
  update admin_config set admin_email = p_email where id = 1;
$$;

create or replace function request_admin_pin_reset()
returns table(ok boolean, message text, email text, new_pin text)
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_new_pin text;
begin
  select admin_email into v_email from admin_config where id = 1;
  if v_email is null or v_email = '' then
    return query select false, 'No hay correo de recuperación configurado. Pide ayuda a soporte.', null::text, null::text;
    return;
  end if;
  v_new_pin := lpad((floor(random()*10000))::int::text, 4, '0');
  update admin_config set pin = v_new_pin where id = 1;
  return query select true, 'PIN reiniciado', v_email, v_new_pin;
end;
$$;

-- ---------- Perfil de la maestra ----------

create or replace function get_teacher_profile(p_teacher_id uuid)
returns table(name text, email text, hire_date date, monthly_salary numeric, vacation_days_total integer, vacation_days_used integer)
language sql security definer set search_path = public as $$
  select name, email, hire_date, monthly_salary, vacation_days_total, vacation_days_used
  from teachers where id = p_teacher_id;
$$;

create or replace function get_teacher_assigned_children(p_teacher_id uuid)
returns table(child_name text, horario text)
language sql security definer set search_path = public as $$
  select distinct on (child_name) child_name, horario
  from calendar_entries
  where teacher_id = p_teacher_id and entry_date >= (current_date - interval '7 days')::date
  order by child_name, entry_date desc;
$$;

-- ---------- Permisos ----------
grant execute on function
  request_teacher_pin_reset(uuid), get_public_settings(), admin_set_recovery_email(text),
  request_admin_pin_reset(), get_teacher_profile(uuid), get_teacher_assigned_children(uuid)
to anon, authenticated;
