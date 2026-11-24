/*
  # Auto-provision shared quote form links for all users and templates

  1. New Function
    - `provision_shared_links_for_user(p_user_id uuid)` - Creates missing shared links for a single user
    - `provision_all_shared_links()` - Bulk provisioner for all active users
    - `auto_provision_links_on_user_activate()` - Trigger to create links when a user is activated

  2. Purpose
    - Every active user should automatically have a public form link for every active template
    - No manual creation needed - links are pre-generated
    - Slug format: {agent_slug}-{form_slug}-{7char_unique_code}

  3. Execution
    - Runs the bulk provisioner immediately to backfill existing users
    - Adds a trigger on usuarios to auto-provision when a user becomes active

  4. Important Notes
    - Uses ON CONFLICT DO NOTHING to be idempotent
    - Generates unique slugs per user+template combination
    - Only creates links for users with web_slug (public page enabled)
*/

-- Function to generate a random alphanumeric code
CREATE OR REPLACE FUNCTION generate_link_code(p_length integer DEFAULT 7)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..p_length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Function to derive a short agent slug from user data
CREATE OR REPLACE FUNCTION derive_agent_slug(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_slug text;
BEGIN
  SELECT web_slug, nombre, apellidos
  INTO v_user
  FROM usuarios
  WHERE id = p_user_id;

  IF v_user IS NULL THEN
    RETURN 'agente';
  END IF;

  -- Use web_slug if available
  IF v_user.web_slug IS NOT NULL AND v_user.web_slug != '' THEN
    RETURN v_user.web_slug;
  END IF;

  -- Derive from name
  v_slug := lower(COALESCE(v_user.nombre, '') || COALESCE(v_user.apellidos, ''));
  v_slug := regexp_replace(v_slug, '[^a-z0-9]', '', 'g');
  IF length(v_slug) > 12 THEN
    v_slug := substring(v_slug from 1 for 12);
  END IF;
  IF v_slug = '' THEN
    v_slug := 'agente';
  END IF;

  RETURN v_slug;
END;
$$;

-- Map form_type to short slug (mirrors frontend FORM_TYPE_TO_SLUG)
CREATE OR REPLACE FUNCTION form_type_to_slug(p_form_type text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN CASE p_form_type
    WHEN 'auto_individual' THEN 'auto'
    WHEN 'auto_residente' THEN 'auto-res'
    WHEN 'flotilla_autos' THEN 'flotilla'
    WHEN 'gmm_individual' THEN 'gmm'
    WHEN 'gmm_colectivo_empresarial' THEN 'gmm-col'
    WHEN 'vida_individual' THEN 'vida'
    WHEN 'vida_grupo_colectivo' THEN 'vida-grupo'
    WHEN 'ap_individual' THEN 'ap'
    WHEN 'ap_colectivo' THEN 'ap-col'
    WHEN 'accidentes_personales_individual' THEN 'ap'
    WHEN 'salud_gastos_menores' THEN 'salud'
    WHEN 'dental_vision' THEN 'dental'
    WHEN 'hogar_casa_habitacion' THEN 'hogar'
    WHEN 'empresa_paquete' THEN 'empresa'
    WHEN 'empresa_paquete_empresarial' THEN 'empresa'
    WHEN 'pyme_comercio' THEN 'pyme'
    WHEN 'rc_general' THEN 'rc-gen'
    WHEN 'rc_productos' THEN 'rc-prod'
    WHEN 'rc_profesional' THEN 'rc-prof'
    WHEN 'rc_transportistas' THEN 'rc-trans'
    WHEN 'fianzas' THEN 'fianzas'
    WHEN 'caucion' THEN 'caucion'
    WHEN 'credito_comercial' THEN 'credito'
    WHEN 'cyber_riesgos_ciberneticos' THEN 'cyber'
    WHEN 'd_o' THEN 'do'
    WHEN 'responsabilidad_laboral' THEN 'resp-lab'
    WHEN 'fidelidad_empleados' THEN 'fidelidad'
    WHEN 'crime_empresarial' THEN 'crime'
    WHEN 'transporte_carga' THEN 'transp'
    WHEN 'transporte_maritimo' THEN 'maritimo'
    WHEN 'transporte_valores' THEN 'valores'
    WHEN 'obra_civil' THEN 'obra'
    WHEN 'todo_riesgo_construccion' THEN 'construc'
    WHEN 'equipo_contratistas' THEN 'eq-cont'
    WHEN 'maquinaria_equipo_electronico' THEN 'maq-elec'
    WHEN 'calderas_maquinas' THEN 'calderas'
    WHEN 'seguro_agricola' THEN 'agricola'
    WHEN 'seguro_ganadero' THEN 'ganadero'
    WHEN 'maquinaria_agricola' THEN 'maq-agri'
    WHEN 'eventos' THEN 'evento'
    WHEN 'mascotas' THEN 'mascota'
    WHEN 'arrendamiento' THEN 'arrend'
    WHEN 'condominal' THEN 'condom'
    WHEN 'obras_arte' THEN 'arte'
    WHEN 'incendio' THEN 'incendio'
    WHEN 'equipo_electronico' THEN 'eq-elec'
    WHEN 'aviacion' THEN 'aviacion'
    ELSE regexp_replace(substring(p_form_type from 1 for 15), '_', '-', 'g')
  END;
END;
$$;

-- Main function: provision shared links for one user
CREATE OR REPLACE FUNCTION provision_shared_links_for_user(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_slug text;
  v_office_id uuid;
  v_template record;
  v_form_slug text;
  v_code text;
  v_full_slug text;
  v_count integer := 0;
  v_attempts integer;
BEGIN
  -- Get user info
  SELECT web_slug, oficina_id INTO v_agent_slug, v_office_id
  FROM usuarios
  WHERE id = p_user_id AND activo = true AND deleted_at IS NULL;

  IF v_agent_slug IS NULL OR v_agent_slug = '' THEN
    v_agent_slug := derive_agent_slug(p_user_id);
  END IF;

  -- Loop through all active templates that this user doesn't have a link for
  FOR v_template IN
    SELECT qft.id, qft.form_type, qft.title
    FROM quote_form_templates qft
    WHERE qft.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM shared_quote_form_links sqfl
        WHERE sqfl.agent_id = p_user_id
          AND sqfl.quote_form_template_id = qft.id
          AND sqfl.status = 'active'
      )
  LOOP
    v_form_slug := form_type_to_slug(v_template.form_type);
    
    -- Generate unique slug (retry up to 5 times)
    v_attempts := 0;
    LOOP
      v_code := generate_link_code(7);
      v_full_slug := v_agent_slug || '-' || v_form_slug || '-' || v_code;
      
      -- Check uniqueness
      IF NOT EXISTS (SELECT 1 FROM shared_quote_form_links WHERE slug = v_full_slug) THEN
        EXIT;
      END IF;
      
      v_attempts := v_attempts + 1;
      IF v_attempts >= 5 THEN
        -- Use longer code as fallback
        v_code := generate_link_code(10);
        v_full_slug := v_agent_slug || '-' || v_form_slug || '-' || v_code;
        EXIT;
      END IF;
    END LOOP;

    -- Insert the shared link
    INSERT INTO shared_quote_form_links (
      created_by, agent_id, agent_slug, office_id,
      quote_form_template_id, form_type, form_slug,
      form_title, unique_code, slug, public_url, status
    ) VALUES (
      p_user_id, p_user_id, v_agent_slug, v_office_id,
      v_template.id, v_template.form_type, v_form_slug,
      v_template.title, v_code, v_full_slug,
      'https://agentedeseguros.website/cotizar/' || v_full_slug,
      'active'
    )
    ON CONFLICT (slug) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Bulk provisioner for all active users
CREATE OR REPLACE FUNCTION provision_all_shared_links()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_total integer := 0;
  v_user_count integer;
BEGIN
  FOR v_user_id IN
    SELECT id FROM usuarios
    WHERE activo = true
      AND deleted_at IS NULL
      AND web_slug IS NOT NULL
      AND web_slug != ''
  LOOP
    SELECT provision_shared_links_for_user(v_user_id) INTO v_user_count;
    v_total := v_total + v_user_count;
  END LOOP;

  RETURN v_total;
END;
$$;

-- Trigger function: auto-provision when a user is activated or gets a web_slug
CREATE OR REPLACE FUNCTION auto_provision_links_on_user_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only provision if user is active and has a web_slug
  IF NEW.activo = true AND NEW.web_slug IS NOT NULL AND NEW.web_slug != '' AND NEW.deleted_at IS NULL THEN
    -- Only if becoming active or getting web_slug for first time
    IF (OLD IS NULL) OR 
       (OLD.activo = false AND NEW.activo = true) OR 
       (OLD.web_slug IS NULL AND NEW.web_slug IS NOT NULL) OR
       (OLD.web_slug = '' AND NEW.web_slug != '') THEN
      PERFORM provision_shared_links_for_user(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_provision_shared_links ON usuarios;
CREATE TRIGGER trg_auto_provision_shared_links
  AFTER INSERT OR UPDATE OF activo, web_slug ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION auto_provision_links_on_user_change();

-- Run bulk provisioner now to backfill all existing active users
SELECT provision_all_shared_links();
