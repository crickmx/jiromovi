/*
  # Corregir URLs de notificaciones: /perfil/:id → /usuario/:id
  
  1. Problema
    - Las notificaciones de "nuevo usuario registrado" usan /perfil/:id
    - Esa ruta no existe (la correcta es /usuario/:id)
    - Al hacer clic en la notificación, se abre página en blanco
  
  2. Solución
    - Actualizar función notificar_equipos_nuevo_usuario
    - Corregir URLs en las notificaciones existentes
    - Cambiar /perfil/:id por /usuario/:id
  
  3. Rutas correctas
    - /perfil → perfil del usuario actual (sin parámetros)
    - /usuario/:id → perfil de otro usuario (con ID)
*/

-- Actualizar función para usar la URL correcta
CREATE OR REPLACE FUNCTION notificar_equipos_nuevo_usuario()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destinatarios uuid[];
  v_destinatario uuid;
  v_oficina_nombre text;
  v_creador_nombre text;
  v_link_usuario text;
  v_datos jsonb;
BEGIN
  -- Solo notificar cuando se CREA un nuevo usuario (INSERT)
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Obtener nombre de oficina
  SELECT nombre INTO v_oficina_nombre
  FROM oficinas
  WHERE id = NEW.oficina_id;
  
  IF v_oficina_nombre IS NULL THEN
    v_oficina_nombre := 'Sin oficina asignada';
  END IF;

  -- Obtener nombre del creador (si está disponible en el contexto)
  v_creador_nombre := 'Sistema';
  IF current_setting('app.current_user_id', true) IS NOT NULL THEN
    SELECT nombre_completo INTO v_creador_nombre
    FROM usuarios
    WHERE id = current_setting('app.current_user_id', true)::uuid;
    
    IF v_creador_nombre IS NULL THEN
      v_creador_nombre := 'Administrador';
    END IF;
  END IF;

  -- Construir link al perfil del usuario (URL CORREGIDA)
  v_link_usuario := 'https://www.movi.digital/usuario/' || NEW.id::text;

  -- Preparar datos para la notificación
  v_datos := jsonb_build_object(
    'usuario_nombre', NEW.nombre,
    'usuario_apellidos', NEW.apellidos,
    'usuario_email_laboral', NEW.email_laboral,
    'usuario_rol', NEW.rol,
    'usuario_oficina', v_oficina_nombre,
    'usuario_fecha_alta', to_char(NEW.created_at, 'DD/MM/YYYY HH24:MI'),
    'creado_por', v_creador_nombre,
    'link_usuario', v_link_usuario
  );

  -- Obtener destinatarios configurados para este tipo de notificación
  SELECT ARRAY_AGG(DISTINCT usuario_id)
  INTO v_destinatarios
  FROM correo_destinatarios_notificacion cdn
  INNER JOIN correo_tipos_notificacion ctn ON ctn.id = cdn.tipo_notificacion_id
  INNER JOIN usuarios u ON u.id = cdn.usuario_id
  WHERE ctn.codigo = 'nuevo_usuario_creado'
    AND ctn.activo = true
    AND u.estado = 'activo'
    AND u.rol IN ('Empleado', 'Gerente', 'Administrador');

  -- Si no hay destinatarios configurados, no hacer nada
  IF v_destinatarios IS NULL OR array_length(v_destinatarios, 1) = 0 THEN
    RAISE LOG '[nuevo_usuario] No hay destinatarios configurados para nuevo_usuario_creado';
    RETURN NEW;
  END IF;

  RAISE LOG '[nuevo_usuario] Notificando a % destinatarios sobre nuevo usuario: %', 
    array_length(v_destinatarios, 1), NEW.email_laboral;

  -- Enviar notificación a cada destinatario
  FOREACH v_destinatario IN ARRAY v_destinatarios
  LOOP
    BEGIN
      PERFORM enviar_notificacion_completa(
        p_tipo_codigo := 'nuevo_usuario_creado',
        p_user_id := v_destinatario,
        p_titulo := 'Nuevo usuario registrado',
        p_mensaje := NEW.nombre || ' ' || NEW.apellidos || ' (' || NEW.rol || ') se ha registrado en ' || v_oficina_nombre,
        p_modulo := 'usuarios',
        p_datos_adicionales := v_datos,
        p_accion_url := '/usuario/' || NEW.id::text  -- URL CORREGIDA
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[nuevo_usuario] Error notificando a destinatario %: %', v_destinatario, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Actualizar las notificaciones existentes que tienen la URL incorrecta
UPDATE notificaciones
SET 
  accion_url = REPLACE(accion_url, '/perfil/', '/usuario/'),
  url = REPLACE(COALESCE(url, ''), '/perfil/', '/usuario/')
WHERE 
  (accion_url LIKE '/perfil/%' OR url LIKE '/perfil/%')
  AND titulo = 'Nuevo usuario registrado';

COMMENT ON FUNCTION notificar_equipos_nuevo_usuario IS
  'Notifica a equipos internos (configurados) cuando se crea un nuevo usuario en el sistema. URLs corregidas para usar /usuario/:id';
