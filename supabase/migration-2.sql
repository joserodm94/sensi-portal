-- Migración 2 — Portal de Personal Sensi
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run
-- (No borra ni afecta los datos que ya tienes: solo agrega lo nuevo)

-- ---------- Interruptor de "Vacaciones visible para maestras" ----------

alter table admin_config add column if not exists vacation_requests_enabled boolean not null default false;

create or replace function get_public_settings()
returns table(vacation_requests_enabled boolean)
language sql security definer set search_path = public as $$
  select vacation_requests_enabled from admin_config where id = 1;
$$;

create or replace function admin_set_vacation_requests_enabled(p_enabled boolean)
returns void
language sql security definer set search_path = public as $$
  update admin_config set vacation_requests_enabled = p_enabled where id = 1;
$$;

-- ---------- Calendario (qué niño le toca a cada maestra, por día) ----------

create table if not exists calendar_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  teacher_id uuid not null references teachers(id) on delete cascade,
  child_name text not null,
  horario text,
  notes text,
  created_at timestamptz not null default now()
);
alter table calendar_entries enable row level security;
-- (sin políticas = nadie puede leer/escribir directo; solo las funciones de abajo)

create or replace function get_calendar_day(p_date date)
returns table(
  id uuid, entry_date date, teacher_id uuid, teacher_name text,
  child_name text, horario text, notes text
)
language sql security definer set search_path = public as $$
  select c.id, c.entry_date, c.teacher_id, t.name, c.child_name, c.horario, c.notes
  from calendar_entries c join teachers t on t.id = c.teacher_id
  where c.entry_date = p_date
  order by t.name, c.horario nulls last;
$$;

create or replace function admin_save_calendar_entry(
  p_entry_id uuid, p_entry_date date, p_teacher_id uuid,
  p_child_name text, p_horario text, p_notes text
)
returns calendar_entries
language plpgsql security definer set search_path = public as $$
declare v_row calendar_entries;
begin
  if p_entry_id is null then
    insert into calendar_entries (entry_date, teacher_id, child_name, horario, notes)
    values (p_entry_date, p_teacher_id, p_child_name, p_horario, p_notes)
    returning * into v_row;
  else
    update calendar_entries set entry_date=p_entry_date, teacher_id=p_teacher_id,
      child_name=p_child_name, horario=p_horario, notes=p_notes
    where id = p_entry_id
    returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function admin_delete_calendar_entry(p_entry_id uuid)
returns void
language sql security definer set search_path = public as $$
  delete from calendar_entries where id = p_entry_id;
$$;

-- ---------- Permisos ----------
grant execute on function
  get_public_settings(), admin_set_vacation_requests_enabled(boolean),
  get_calendar_day(date), admin_save_calendar_entry(uuid,date,uuid,text,text,text),
  admin_delete_calendar_entry(uuid)
to anon, authenticated;
