-- Create CRM contact records for Seguwallet customers that don't have one yet
-- and link them via crm_contact_id
DO $$
DECLARE
  sw RECORD;
  new_crm_id uuid;
BEGIN
  FOR sw IN
    SELECT id, full_name, email, phone, whatsapp, agent_user_id, created_at, state, municipality, birth_date, gender
    FROM seguwallet_customers
    WHERE crm_contact_id IS NULL AND deleted_at IS NULL
  LOOP
    INSERT INTO crm_contactos (
      tipo_contacto,
      nombre_completo,
      celular,
      email,
      whatsapp,
      estatus,
      fuente_origen,
      creado_por,
      fecha_creacion,
      fecha_nacimiento,
      estado,
      municipio,
      genero
    ) VALUES (
      'Persona',
      sw.full_name,
      COALESCE(sw.phone, ''),
      sw.email,
      sw.whatsapp,
      'Cliente',
      'Seguwallet',
      sw.agent_user_id,
      sw.created_at,
      sw.birth_date,
      sw.state,
      sw.municipality,
      sw.gender
    )
    RETURNING id INTO new_crm_id;

    UPDATE seguwallet_customers
    SET crm_contact_id = new_crm_id
    WHERE id = sw.id;
  END LOOP;
END $$;