/*
  # Corrección de asignación de firma global

  1. Cambios
    - Reescribe la función get_firma_asignada para que funcione correctamente
    - Elimina el uso de IF FOUND que causa problemas con RETURN QUERY
    - Asegura que la firma global se asigne a todos los usuarios
    - Verifica que la asignación global esté creada correctamente

  2. Seguridad
    - Mantiene SECURITY DEFINER para acceso controlado
    - No cambia permisos RLS
*/

-- Reescribir función para que devuelva firma global correctamente
CREATE OR REPLACE FUNCTION get_firma_asignada(p_usuario_id uuid)
RETURNS TABLE (
  template_id uuid,
  template_nombre text,
  template_html text,
  prioridad integer,
  tipo_asignacion text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario RECORD;
  v_result RECORD;
BEGIN
  SELECT * INTO v_usuario
  FROM usuarios
  WHERE id = p_usuario_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Buscar por usuario específico
  SELECT 
    ft.id,
    ft.nombre,
    ft.html,
    fa.prioridad,
    fa.tipo
  INTO v_result
  FROM firma_asignaciones fa
  JOIN firma_templates ft ON fa.template_id = ft.id
  WHERE fa.tipo = 'usuario'
    AND fa.ref_usuario_id = p_usuario_id
    AND ft.es_activa = true
  ORDER BY fa.prioridad DESC
  LIMIT 1;
  
  IF FOUND THEN
    template_id := v_result.id;
    template_nombre := v_result.nombre;
    template_html := v_result.html;
    prioridad := v_result.prioridad;
    tipo_asignacion := v_result.tipo;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Buscar por rol
  SELECT 
    ft.id,
    ft.nombre,
    ft.html,
    fa.prioridad,
    fa.tipo
  INTO v_result
  FROM firma_asignaciones fa
  JOIN firma_templates ft ON fa.template_id = ft.id
  WHERE fa.tipo = 'rol'
    AND fa.ref_rol = v_usuario.rol
    AND ft.es_activa = true
  ORDER BY fa.prioridad DESC
  LIMIT 1;
  
  IF FOUND THEN
    template_id := v_result.id;
    template_nombre := v_result.nombre;
    template_html := v_result.html;
    prioridad := v_result.prioridad;
    tipo_asignacion := v_result.tipo;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Buscar por oficina
  SELECT 
    ft.id,
    ft.nombre,
    ft.html,
    fa.prioridad,
    fa.tipo
  INTO v_result
  FROM firma_asignaciones fa
  JOIN firma_templates ft ON fa.template_id = ft.id
  WHERE fa.tipo = 'oficina'
    AND fa.ref_oficina_id = v_usuario.oficina_id
    AND ft.es_activa = true
  ORDER BY fa.prioridad DESC
  LIMIT 1;
  
  IF FOUND THEN
    template_id := v_result.id;
    template_nombre := v_result.nombre;
    template_html := v_result.html;
    prioridad := v_result.prioridad;
    tipo_asignacion := v_result.tipo;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Buscar firma global (siempre debe existir como fallback)
  SELECT 
    ft.id,
    ft.nombre,
    ft.html,
    fa.prioridad,
    fa.tipo
  INTO v_result
  FROM firma_asignaciones fa
  JOIN firma_templates ft ON fa.template_id = ft.id
  WHERE fa.tipo = 'global'
    AND ft.es_activa = true
  ORDER BY fa.prioridad DESC
  LIMIT 1;
  
  IF FOUND THEN
    template_id := v_result.id;
    template_nombre := v_result.nombre;
    template_html := v_result.html;
    prioridad := v_result.prioridad;
    tipo_asignacion := v_result.tipo;
    RETURN NEXT;
    RETURN;
  END IF;
  
  RETURN;
END;
$$;

-- Asegurar que existe la plantilla global predeterminada
INSERT INTO firma_templates (nombre, descripcion, html, es_activa, ancho_max)
VALUES (
  'Firma Global Predeterminada',
  'Plantilla básica de firma que se aplica por defecto',
  '<!-- FIRMA_BEGIN -->
<table style="font-family: Arial, sans-serif; font-size: 14px; color: #333; max-width: 700px;" cellpadding="0" cellspacing="0">
  <tr>
    <td style="padding: 20px 0; border-top: 3px solid #0066cc;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right: 20px; vertical-align: top;">
            {{#if imagen_perfil}}
            <img src="{{imagen_perfil}}" alt="{{nombre}}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" />
            {{/if}}
          </td>
          <td style="vertical-align: top;">
            <div style="font-size: 16px; font-weight: bold; color: #0066cc; margin-bottom: 5px;">
              {{nombre}} {{apellidos}}
            </div>
            <div style="color: #666; margin-bottom: 3px;">{{puesto}}</div>
            {{#if email_laboral}}
            <div style="margin-bottom: 3px;">
              <a href="mailto:{{email_laboral}}" style="color: #0066cc; text-decoration: none;">{{email_laboral}}</a>
            </div>
            {{/if}}
            {{#if celular_laboral}}
            <div style="margin-bottom: 3px;">📱 {{celular_laboral}}</div>
            {{/if}}
            {{#if extension_telefonica}}
            <div style="margin-bottom: 3px;">☎️ Ext. {{extension_telefonica}}</div>
            {{/if}}
            <div style="margin-top: 10px; font-weight: bold; color: #0066cc;">{{oficina_nombre}}</div>
            {{#if oficina_direccion}}
            <div style="font-size: 12px; color: #666;">📍 {{oficina_direccion}}</div>
            {{/if}}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<!-- FIRMA_END -->',
  true,
  700
)
ON CONFLICT DO NOTHING;

-- Asegurar que existe la asignación global
INSERT INTO firma_asignaciones (template_id, tipo, prioridad)
SELECT id, 'global', 0
FROM firma_templates
WHERE nombre = 'Firma Global Predeterminada'
ON CONFLICT DO NOTHING;
