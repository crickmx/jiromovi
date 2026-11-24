/*
  # Fix get_firma_asignada function - html column alias mismatch

  The function body selected ft.html into v_result.html and returned it
  as position 3, but the TABLE return type names that column template_html.
  PostgreSQL positional matching means it works, BUT the RETURN QUERY SELECT
  used v_result.html which is the local variable field — this is correct
  positionally. The real issue is the function body used a RECORD variable
  and the RETURN QUERY SELECT aliases don't match the TABLE output columns.

  Fix: Recreate the function with explicit column aliases in RETURN QUERY
  to ensure template_html is correctly mapped from ft.html.
*/
CREATE OR REPLACE FUNCTION get_firma_asignada(p_usuario_id uuid)
RETURNS TABLE(
  template_id uuid,
  template_nombre text,
  template_html text,
  prioridad integer,
  tipo_asignacion text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario RECORD;
  v_row RECORD;
BEGIN
  SELECT * INTO v_usuario FROM usuarios WHERE id = p_usuario_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- 1. User-specific (highest priority)
  SELECT ft.id, ft.nombre, ft.html, fa.prioridad, fa.tipo
    INTO v_row
    FROM firma_asignaciones fa
    JOIN firma_templates ft ON ft.id = fa.template_id
   WHERE fa.tipo = 'usuario'
     AND fa.ref_usuario_id = p_usuario_id
     AND ft.es_activa = true
   ORDER BY fa.prioridad DESC
   LIMIT 1;
  IF FOUND THEN
    template_id := v_row.id;
    template_nombre := v_row.nombre;
    template_html := v_row.html;
    prioridad := v_row.prioridad;
    tipo_asignacion := v_row.tipo;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 2. Role-based
  SELECT ft.id, ft.nombre, ft.html, fa.prioridad, fa.tipo
    INTO v_row
    FROM firma_asignaciones fa
    JOIN firma_templates ft ON ft.id = fa.template_id
   WHERE fa.tipo = 'rol'
     AND fa.ref_rol = v_usuario.rol
     AND ft.es_activa = true
   ORDER BY fa.prioridad DESC
   LIMIT 1;
  IF FOUND THEN
    template_id := v_row.id;
    template_nombre := v_row.nombre;
    template_html := v_row.html;
    prioridad := v_row.prioridad;
    tipo_asignacion := v_row.tipo;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 3. Office-based
  IF v_usuario.oficina_id IS NOT NULL THEN
    SELECT ft.id, ft.nombre, ft.html, fa.prioridad, fa.tipo
      INTO v_row
      FROM firma_asignaciones fa
      JOIN firma_templates ft ON ft.id = fa.template_id
     WHERE fa.tipo = 'oficina'
       AND fa.ref_oficina_id = v_usuario.oficina_id
       AND ft.es_activa = true
     ORDER BY fa.prioridad DESC
     LIMIT 1;
    IF FOUND THEN
      template_id := v_row.id;
      template_nombre := v_row.nombre;
      template_html := v_row.html;
      prioridad := v_row.prioridad;
      tipo_asignacion := v_row.tipo;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- 4. Global default
  SELECT ft.id, ft.nombre, ft.html, fa.prioridad, fa.tipo
    INTO v_row
    FROM firma_asignaciones fa
    JOIN firma_templates ft ON ft.id = fa.template_id
   WHERE fa.tipo = 'global'
     AND ft.es_activa = true
   ORDER BY fa.prioridad DESC
   LIMIT 1;
  IF FOUND THEN
    template_id := v_row.id;
    template_nombre := v_row.nombre;
    template_html := v_row.html;
    prioridad := v_row.prioridad;
    tipo_asignacion := v_row.tipo;
    RETURN NEXT;
    RETURN;
  END IF;

END;
$$;

GRANT EXECUTE ON FUNCTION get_firma_asignada(uuid) TO authenticated;
