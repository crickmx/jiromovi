/*
  # Add CRM linking fields to chava_lead_signals

  ## Changes
  1. New columns on `chava_lead_signals`:
     - `crm_contacto_id` (uuid, FK → crm_contactos)
     - `crm_tarea_id` (uuid, FK → crm_tareas)
     - `convertido_at` (timestamptz)
     - `convertido_por` (uuid, FK → usuarios)
  2. New function `convert_lead_to_crm` — atomic conversion that creates a CRM contact + task from a lead signal
  3. Update RLS: allow admins to update lead signals (for conversion)

  ## Security
  - Function is SECURITY DEFINER, checks that caller is admin
  - No PII exposed beyond existing profile data
*/

-- Add CRM linking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chava_lead_signals' AND column_name = 'crm_contacto_id'
  ) THEN
    ALTER TABLE chava_lead_signals ADD COLUMN crm_contacto_id uuid REFERENCES crm_contactos(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chava_lead_signals' AND column_name = 'crm_tarea_id'
  ) THEN
    ALTER TABLE chava_lead_signals ADD COLUMN crm_tarea_id uuid REFERENCES crm_tareas(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chava_lead_signals' AND column_name = 'convertido_at'
  ) THEN
    ALTER TABLE chava_lead_signals ADD COLUMN convertido_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chava_lead_signals' AND column_name = 'convertido_por'
  ) THEN
    ALTER TABLE chava_lead_signals ADD COLUMN convertido_por uuid REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Allow admins to update lead signals (for CRM conversion)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chava_lead_signals' AND policyname = 'Admins update leads'
  ) THEN
    CREATE POLICY "Admins update leads"
      ON chava_lead_signals FOR UPDATE
      TO authenticated
      USING (is_chava_admin())
      WITH CHECK (is_chava_admin());
  END IF;
END $$;

-- Function: convert a lead signal into a CRM contact + task
CREATE OR REPLACE FUNCTION convert_lead_to_crm(
  p_lead_id uuid,
  p_nombre text DEFAULT NULL,
  p_celular text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_user_id uuid := auth.uid();
  v_contacto_id uuid;
  v_tarea_id uuid;
  v_nombre_final text;
  v_producto text;
BEGIN
  -- Check admin
  IF NOT is_chava_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden convertir leads';
  END IF;

  -- Get lead
  SELECT * INTO v_lead FROM chava_lead_signals WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead no encontrado';
  END IF;

  IF v_lead.estado = 'convertido' THEN
    RAISE EXCEPTION 'Este lead ya fue convertido al CRM';
  END IF;

  -- Determine name from datos_capturados or params
  v_nombre_final := COALESCE(
    p_nombre,
    v_lead.datos_capturados->>'nombre',
    v_lead.datos_capturados->>'nombre_completo',
    'Lead Chava AI'
  );

  v_producto := COALESCE(v_lead.producto, 'general');

  -- Create CRM contact
  INSERT INTO crm_contactos (
    tipo_contacto,
    nombre_completo,
    celular,
    email,
    estatus,
    fuente_origen,
    etiquetas_segmentacion,
    campos_personalizados,
    creado_por
  ) VALUES (
    'Persona',
    v_nombre_final,
    COALESCE(p_celular, v_lead.datos_capturados->>'telefono', v_lead.datos_capturados->>'celular', ''),
    COALESCE(p_email, v_lead.datos_capturados->>'email', ''),
    'Prospecto',
    'Chava AI',
    ARRAY['chava-ai', 'lead-' || v_producto],
    jsonb_build_object(
      'origen', 'chava_ai',
      'calidad_lead', v_lead.calidad,
      'intent', v_lead.intent_codigo,
      'producto_interes', v_producto,
      'datos_originales', v_lead.datos_capturados
    ),
    v_user_id
  )
  RETURNING id INTO v_contacto_id;

  -- Create CRM follow-up task
  INSERT INTO crm_tareas (
    contacto_id,
    descripcion,
    tipo_actividad,
    fecha_vencimiento,
    estatus,
    prioridad,
    completada,
    creado_por,
    asignado_a
  ) VALUES (
    v_contacto_id,
    'Seguimiento lead Chava AI: ' || v_nombre_final || ' - Interesado en ' || v_producto ||
    CASE WHEN p_notas IS NOT NULL THEN E'\n\nNotas: ' || p_notas ELSE '' END,
    'Llamada',
    NOW() + interval '1 day',
    'Pendiente',
    CASE v_lead.calidad WHEN 'alta' THEN 'Alta' WHEN 'media' THEN 'Media' ELSE 'Baja' END,
    false,
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_tarea_id;

  -- Update lead signal
  UPDATE chava_lead_signals SET
    estado = 'convertido',
    crm_contacto_id = v_contacto_id,
    crm_tarea_id = v_tarea_id,
    convertido_at = NOW(),
    convertido_por = v_user_id,
    updated_at = NOW()
  WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'success', true,
    'contacto_id', v_contacto_id,
    'tarea_id', v_tarea_id,
    'nombre', v_nombre_final
  );
END;
$$;
