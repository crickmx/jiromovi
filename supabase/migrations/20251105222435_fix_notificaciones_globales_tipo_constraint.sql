/*
  # Fix Notificaciones Globales Tipo Constraint
  
  1. Changes
    - Update enviar_notificacion_global function to use valid tipo values
    - Use 'info' as default tipo instead of 'global'
    
  2. Security
    - No changes to security policies
*/

-- Recreate function with correct tipo value
CREATE OR REPLACE FUNCTION enviar_notificacion_global(
  p_titulo text,
  p_mensaje text,
  p_accion_url text,
  p_destinatarios jsonb,
  p_enviado_por uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_global_id uuid;
  v_user_record record;
BEGIN
  -- Create global notification record
  INSERT INTO notificaciones_globales (
    titulo,
    mensaje,
    accion_url,
    destinatarios,
    enviado_por,
    fecha_envio,
    tipo,
    modulo
  )
  VALUES (
    p_titulo,
    p_mensaje,
    p_accion_url,
    p_destinatarios,
    p_enviado_por,
    now(),
    'info',
    'Sistema'
  )
  RETURNING id INTO v_notif_global_id;

  -- Distribute to individual users based on destinatarios
  IF (p_destinatarios->>'tipo') = 'todos' THEN
    -- Send to all users
    FOR v_user_record IN 
      SELECT id FROM usuarios WHERE estado = 'activo'
    LOOP
      INSERT INTO notificaciones (
        usuario_id,
        titulo,
        mensaje,
        tipo,
        modulo,
        accion_url,
        leida,
        prioridad
      )
      VALUES (
        v_user_record.id,
        p_titulo,
        p_mensaje,
        'info',
        'Sistema',
        p_accion_url,
        false,
        'normal'
      );
    END LOOP;

  ELSIF (p_destinatarios->>'tipo') = 'oficina' THEN
    -- Send to users in specific office
    FOR v_user_record IN 
      SELECT id FROM usuarios 
      WHERE oficina_id = (p_destinatarios->>'oficina_id')::uuid 
      AND estado = 'activo'
    LOOP
      INSERT INTO notificaciones (
        usuario_id,
        titulo,
        mensaje,
        tipo,
        modulo,
        accion_url,
        leida,
        prioridad
      )
      VALUES (
        v_user_record.id,
        p_titulo,
        p_mensaje,
        'info',
        'Sistema',
        p_accion_url,
        false,
        'normal'
      );
    END LOOP;

  ELSIF (p_destinatarios->>'tipo') = 'rol' THEN
    -- Send to users with specific role
    FOR v_user_record IN 
      SELECT id FROM usuarios 
      WHERE rol = (p_destinatarios->>'rol') 
      AND estado = 'activo'
    LOOP
      INSERT INTO notificaciones (
        usuario_id,
        titulo,
        mensaje,
        tipo,
        modulo,
        accion_url,
        leida,
        prioridad
      )
      VALUES (
        v_user_record.id,
        p_titulo,
        p_mensaje,
        'info',
        'Sistema',
        p_accion_url,
        false,
        'normal'
      );
    END LOOP;

  ELSIF (p_destinatarios->>'tipo') = 'usuario' THEN
    -- Send to specific user
    INSERT INTO notificaciones (
      usuario_id,
      titulo,
      mensaje,
      tipo,
      modulo,
      accion_url,
      leida,
      prioridad
    )
    VALUES (
      (p_destinatarios->>'user_id')::uuid,
      p_titulo,
      p_mensaje,
      'info',
      'Sistema',
      p_accion_url,
      false,
      'alta'
    );
  END IF;

END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION enviar_notificacion_global(text, text, text, jsonb, uuid) TO authenticated;
