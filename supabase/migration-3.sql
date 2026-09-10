-- Migración 3 — Portal de Personal Sensi
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run
-- (No borra ni afecta los datos que ya tienes: solo agrega lo nuevo)

-- ---------- Información general de la maestra ----------

alter table teachers add column if not exists email text;
alter table teachers add column if not exists monthly_salary numeric;
alter table teachers add column if not exists hire_date date;

drop function if exists admin_add_teacher(text,text,integer);
create or replace function admin_add_teacher(
  p_name text, p_pin text, p_vacation_days_total integer,
  p_email text, p_monthly_salary numeric, p_hire_date date
)
returns teachers
language plpgsql security definer set search_path = public as $$
declare v_row teachers;
begin
  insert into teachers (name, pin, vacation_days_total, email, monthly_salary, hire_date)
  values (p_name, p_pin, coalesce(p_vacation_days_total, 14), p_email, p_monthly_salary, p_hire_date)
  returning * into v_row;
  return v_row;
end;
$$;

drop function if exists admin_edit_teacher(uuid,text,text,integer,integer);
create or replace function admin_edit_teacher(
  p_teacher_id uuid, p_name text, p_pin text, p_vacation_days_total integer, p_vacation_days_used integer,
  p_email text, p_monthly_salary numeric, p_hire_date date
)
returns teachers
language plpgsql security definer set search_path = public as $$
declare v_row teachers;
begin
  update teachers set name = p_name, pin = p_pin,
    vacation_days_total = p_vacation_days_total, vacation_days_used = p_vacation_days_used,
    email = p_email, monthly_salary = p_monthly_salary, hire_date = p_hire_date
  where id = p_teacher_id
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------- Log de entrada/salida, verificado por IP del centro ----------

alter table admin_config add column if not exists office_ip text;

create or replace function get_public_settings()
returns table(vacation_requests_enabled boolean, office_ip text)
language sql security definer set search_path = public as $$
  select vacation_requests_enabled, office_ip from admin_config where id = 1;
$$;

create table if not exists attendance_logs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  type text not null check (type in ('entrada','salida')),
  logged_at timestamptz not null default now(),
  ip text
);
alter table attendance_logs enable row level security;
-- (sin políticas = nadie puede leer/escribir directo; solo las funciones de abajo)

-- Devuelve la IP pública tal como la ve Supabase (útil para que el admin
-- detecte la IP del centro parado ahí mismo, conectado a esa red).
create or replace function get_my_ip()
returns text
language sql security definer set search_path = public as $$
  select trim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1));
$$;

create or replace function admin_set_office_ip(p_ip text)
returns void
language sql security definer set search_path = public as $$
  update admin_config set office_ip = p_ip where id = 1;
$$;

create or replace function log_attendance(p_teacher_id uuid, p_type text)
returns table(ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_ip text;
  v_office_ip text;
begin
  if p_type not in ('entrada','salida') then
    return query select false, 'Tipo inválido';
    return;
  end if;
  v_ip := trim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1));
  select office_ip into v_office_ip from admin_config where id = 1;
  if v_office_ip is null or v_office_ip = '' then
    return query select false, 'La administración aún no ha configurado la red de Sensi. Avísale.';
    return;
  end if;
  if v_ip = '' or v_ip <> v_office_ip then
    return query select false, 'No pareces estar conectada a la red de Sensi. Debes estar en el centro para marcar.';
    return;
  end if;
  insert into attendance_logs (teacher_id, type, ip) values (p_teacher_id, p_type, v_ip);
  return query select true, 'Registrado';
end;
$$;

create or replace function get_teacher_attendance(p_teacher_id uuid, p_date date)
returns table(type text, logged_at timestamptz)
language sql security definer set search_path = public as $$
  select type, logged_at from attendance_logs
  where teacher_id = p_teacher_id
    and (logged_at at time zone 'America/Santo_Domingo')::date = p_date
  order by logged_at;
$$;

create or replace function admin_list_attendance_day(p_date date)
returns table(teacher_name text, type text, logged_at timestamptz)
language sql security definer set search_path = public as $$
  select t.name, a.type, a.logged_at
  from attendance_logs a join teachers t on t.id = a.teacher_id
  where (a.logged_at at time zone 'America/Santo_Domingo')::date = p_date
  order by t.name, a.logged_at;
$$;

-- ---------- Permisos ----------
grant execute on function
  admin_add_teacher(text,text,integer,text,numeric,date),
  admin_edit_teacher(uuid,text,text,integer,integer,text,numeric,date),
  get_my_ip(), admin_set_office_ip(text), log_attendance(uuid,text),
  get_teacher_attendance(uuid,date), admin_list_attendance_day(date)
to anon, authenticated;
