-- Datos de familias/niños (carga inicial)

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Rossella Pierina Ferreras', 'Jose.rodm@hotmail.com,Rpierinafc@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Piero Jose Rodríguez', 'Sensi Steps', 'Martes y Jueves 4:00-5:00', 12000);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Reem Atieh', 's.ferreras17@hotmail.com,atiehreem@hotmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Aya Sophia Ferreras Athie', 'PreSchool Here I Come', 'Lunes a Jueves 9:00-12:00', 26000);
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Aya Sophia Ferreras Athie', 'Sensi Steps', 'Lunes y Miércoles 3:00-5:00', 13500);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Maria Alejandra Segura', 'maria.segura.scheker@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Stella Dubocq', 'Sensi Steps', 'Martes y Jueves 3:00-6:00', 16800);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Wendy Santos', 'wendyelizabethsantos@gmail.com', 0, 14700, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Alonso Yermenos', 'Sensi Skills', '4:00-5:00', 10000);
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Paula Yermenos', 'Sensi Steps', '4:00-5:00', 10000);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Nidia Marion-Landis', 'nmarionlandais@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Nidia Victoria', 'Sensi Steps', 'Martes y Jueves 3:00-4:00', 9500);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Ana Pastor', 'anapastorl@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Lía Vázquez', 'Sensi Steps', 'Martes y Jueves 3:00-6:00', 16800);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Valerie Bodden', 'valeriebodden@icloud.com', 1, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Valeria Navio', 'Sensi Skills', 'Martes y Jueves 3:00-6:00', 16800);
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Santiago Navio', 'Sensi Steps', 'Martes y Jueves 3:00-6:00', 16800);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Naylé Pimentel', 'naylepimentel@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Zoé Rodriguez', 'Sensi Skills', 'Lunes y Miércoles 4:30-5:30', 10000);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Rosalía Mena', 'rosaliamenaf@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Mateo Moreta', 'Sensi Steps', 'Martes y Jueves 3:00-6:00', 16800);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Isabel Abott', 'iabbottpons@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Gonzalo Lara', 'PreSchool Here I Come', 'Lunes a Jueves 9:00-12:00', 26000);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Marielisa Victoria', 'marielisavictoriap@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Elisa Messina', 'Sensi Steps', 'Lunes y Miércoles 5:00-6:00', 9500);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Ana Bogaert', 'anabogaertc@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Valentina Pou', 'PreSchool Here I Come', 'Lunes a Jueves 9:00-12:00', 26000);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Massiel Bisonó', 'Massielbisono06@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Marcelo Elmudesi', 'Sensi Steps', 'Martes y Jueves 5:00-6:00', 12000);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Maria Alejandra Mendoza', 'mariale.mendozab@hotmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Maria Belen', 'Sensi Steps', 'Lunes y Miércoles 3:00-4:00', 9500);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Fabiola Rodriguez', 'fabiolarodriguezb@outlook.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Mateo Diaz', 'Sensi Steps', '4:00-6:00', 13500);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Barbara Piza', 'anabpiza@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Rodrigo Jana', 'Sensi Steps', 'Lunes y Miércoles 4:00-5:00', 12000);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Nicole Groennou', 'nicole_gh1@hotmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Felipe Berrido', 'Sensi Steps', 'Lunes y Miércoles 4:00-5:00', 10000);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Paola Mancebo', 'mancebocontreraspc@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Enrique Bisonó', 'Sensi Steps', 'Lunes y Jueves 5:00-6:00', 10000);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Aida González', 'apglora18@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Leonor Columna', 'Sensi Steps', 'Lunes y Miércoles 4:00-6:00', 13500);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('María Carina Ceara', 'mariaceara17@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Lorenzo Fiorentino', 'Sensi Steps', 'Martes y Jueves 4:00-6:00', 13500);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Cristina Rodriguez', 'cr.rodriguezba@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Javier Lister', 'Sensi Steps', '4:00-6:00', 13500);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Claudia Armenteros', 'claudiaarmenterosgarip@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Nicolás Tejera', 'Sensi Skills', 'Martes y Jueves 4:00-5:00', 10000);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('María Mejia', 'mariadenissem@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Kai Magoshi', 'Sensi Steps', 'Lunes y Miércoles 3:00-5:00', 13500);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Edith Smester', 'pachyz@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Jose Alberto Román', 'Sensi Steps', 'Lunes y Miércoles 3:00-6:00', 16800);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Shirlley Pujols', 'shrlleypujols@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Lyam Kair', 'Sensi Skills', 'Martes y Jueves 3:30-5:30', 6500);
end $$;

do $$
declare v_family_id uuid;
begin
  insert into families (tutor_name, emails, discount_percent, total_override, active)
  values ('Thais Maceo', 'thaismaceo@gmail.com', 0, null, true)
  returning id into v_family_id;
  insert into family_items (family_id, child_name, program, schedule, amount) values (v_family_id, 'Willem Bouma Maceo', 'Sensi Steps', 'Lunes y Miércoles 5:00-6:00', 10000);
end $$;
-- Registrar la factura y el recibo que ya se enviaron de verdad a Stella (07/09),
-- para que la numeración continúe correctamente en 2026-09-002 y no se le
-- vuelva a facturar Octubre.
do $$
declare v_family_id uuid;
begin
  select id into v_family_id from families where emails = 'maria.segura.scheker@gmail.com' limit 1;
  if v_family_id is not null then
    insert into invoices (
      family_id, invoice_number, billing_month, issue_date, due_date,
      subtotal, discount_amount, total, status, receipt_number, payment_date,
      items_snapshot, tutor_name_snapshot, emails_snapshot
    ) values (
      v_family_id, '2026-09-001', '2026-10', '2026-09-07', '2026-09-26',
      16800, 0, 16800, 'pagada', 'REC-2026-09-001', '2026-09-07',
      '[{"child_name":"Stella Dubocq","program":"Sensi Steps","schedule":"Martes y Jueves 3:00-6:00","amount":16800}]'::jsonb,
      'Maria Alejandra Segura', 'maria.segura.scheker@gmail.com'
    )
    on conflict (invoice_number) do nothing;
  end if;
end $$;
