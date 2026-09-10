-- Migración 6 — Portal de Personal Sensi
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run

create or replace function teacher_change_own_pin(p_teacher_id uuid, p_new_pin text)
returns void
language sql security definer set search_path = public as $$
  update teachers set pin = p_new_pin where id = p_teacher_id;
$$;

grant execute on function teacher_change_own_pin(uuid, text) to anon, authenticated;
