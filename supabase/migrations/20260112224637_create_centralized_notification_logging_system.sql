/*
  # Sistema Centralizado de Registro de Envíos de Notificaciones
  
  ## Problema
  No todos los envíos de notificaciones se registran consistentemente en el historial.
  Algunos envíos automáticos, manuales o de sistema pueden perderse.
  
  ## Solución
  1. Función centralizada `registrar_envio_notificacion()` que SIEMPRE debe llamarse
  2. Flexible para aceptar cualquier tipo de notificación (automática, manual, sistema)
  3. Soporta todos los canales (correo, whatsapp, notificacion)
  4. Edge Functions deben llamar a esta función después de cada envío
  
  ## Casos de Uso
  - ✅ Notificaciones automáticas (comisiones, bienvenida, comunicados)
  - ✅ Notificaciones manuales (notificación personalizada del admin)
  - ✅ Notificaciones departamentales (RRHH, Mercadotecnia, Mesa Control)
  - ✅ Notificaciones de sistema (internas, campanita)
  - ✅ Todos los canales (Email, WhatsApp, Push)
*/

-- ============================================
-- FUNCIÓN: Registrar envío de notificación
-- ============================================

CREATE OR REPLACE FUNCTION registrar_envio_notificacion(
  p_tipo_notificacion_codigo text,
  p_canal_envio text, -- 'correo', 'whatsapp', 'notificacion'
  p_usuario_id uuid DEFAULT NULL,
  p_destinatario_email text DEFAULT NULL,
  p_destinatario_nombre text DEFAULT NULL,
  p_numero_destino text DEFAULT NULL,
  p_asunto text DEFAULT 'Notificación',
  p_cuerpo_html text DEFAULT NULL,
  p_estado text DEFAULT 'enviado', -- 'pendiente', 'enviado', 'fallido'
  p_error_mensaje text DEFAULT NULL,
  p_enviado_por uuid DEFAULT NULL,
  p_evento_id uuid DEFAULT NULL,
  p_provider_response jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_historial_id uuid;
  v_tipo_id uuid;
BEGIN
  -- Validar canal
  IF p_canal_envio NOT IN ('correo', 'whatsapp', 'notificacion') THEN
    RAISE EXCEPTION 'Canal de envío inválido: %. Debe ser correo, whatsapp o notificacion', p_canal_envio;
  END IF;

  -- Validar estado
  IF p_estado NOT IN ('pendiente', 'enviado', 'fallido') THEN
    RAISE EXCEPTION 'Estado inválido: %. Debe ser pendiente, enviado o fallido', p_estado;
  END IF;

  -- Obtener ID del tipo de notificación si existe
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = p_tipo_notificacion_codigo
  LIMIT 1;

  -- Insertar registro en historial
  INSERT INTO correo_historial_envios (
    tipo_notificacion_id,
    tipo_notificacion_codigo,
    canal_envio,
    usuario_id,
    destinatario_email,
    destinatario_nombre,
    numero_destino,
    asunto,
    cuerpo_html,
    estado,
    error_mensaje,
    enviado_por,
    evento_id,
    whatsapp_respuesta,
    fecha_envio,
    created_at
  )
  VALUES (
    v_tipo_id,
    p_tipo_notificacion_codigo,
    p_canal_envio,
    p_usuario_id,
    COALESCE(p_destinatario_email, 'sin-email@sistema.local'),
    p_destinatario_nombre,
    p_numero_destino,
    p_asunto,
    p_cuerpo_html,
    p_estado,
    p_error_mensaje,
    COALESCE(p_enviado_por, auth.uid()),
    p_evento_id,
    p_provider_response,
    now(),
    now()
  )
  RETURNING id INTO v_historial_id;

  RETURN v_historial_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error pero no fallar
    RAISE WARNING 'Error al registrar envío de notificación: %, SQL State: %', SQLERRM, SQLSTATE;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION registrar_envio_notificacion IS 
'Función centralizada para registrar TODOS los envíos de notificaciones. 
Debe ser llamada por todas las Edge Functions después de cada envío exitoso o fallido.
Soporta: automáticas, manuales, departamentales, sistema, todos los canales.';

-- ============================================
-- FUNCIÓN: Registrar envío batch (múltiples destinatarios)
-- ============================================

CREATE OR REPLACE FUNCTION registrar_envio_notificacion_batch(
  p_tipo_notificacion_codigo text,
  p_canal_envio text,
  p_destinatarios jsonb, -- Array de objetos con usuario_id, email, nombre, etc.
  p_asunto text DEFAULT 'Notificación',
  p_cuerpo_html text DEFAULT NULL,
  p_estado text DEFAULT 'enviado',
  p_enviado_por uuid DEFAULT NULL,
  p_evento_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_destinatario jsonb;
  v_count integer := 0;
  v_historial_id uuid;
BEGIN
  -- Validar que p_destinatarios sea un array
  IF jsonb_typeof(p_destinatarios) != 'array' THEN
    RAISE EXCEPTION 'p_destinatarios debe ser un array JSON';
  END IF;

  -- Iterar sobre cada destinatario
  FOR v_destinatario IN SELECT * FROM jsonb_array_elements(p_destinatarios)
  LOOP
    v_historial_id := registrar_envio_notificacion(
      p_tipo_notificacion_codigo := p_tipo_notificacion_codigo,
      p_canal_envio := p_canal_envio,
      p_usuario_id := (v_destinatario->>'usuario_id')::uuid,
      p_destinatario_email := v_destinatario->>'email',
      p_destinatario_nombre := v_destinatario->>'nombre',
      p_numero_destino := v_destinatario->>'telefono',
      p_asunto := p_asunto,
      p_cuerpo_html := p_cuerpo_html,
      p_estado := p_estado,
      p_error_mensaje := v_destinatario->>'error',
      p_enviado_por := p_enviado_por,
      p_evento_id := p_evento_id,
      p_provider_response := (v_destinatario->'provider_response')::jsonb
    );

    IF v_historial_id IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION registrar_envio_notificacion_batch IS 
'Función para registrar múltiples envíos de notificaciones en batch.
Útil para notificaciones globales o departamentales con múltiples destinatarios.';

-- ============================================
-- FUNCIÓN: Obtener estadísticas de envíos
-- ============================================

CREATE OR REPLACE FUNCTION obtener_estadisticas_envios(
  p_fecha_inicio timestamptz DEFAULT NULL,
  p_fecha_fin timestamptz DEFAULT NULL,
  p_tipo_notificacion_codigo text DEFAULT NULL,
  p_canal_envio text DEFAULT NULL
)
RETURNS TABLE (
  total_enviados bigint,
  total_fallidos bigint,
  total_pendientes bigint,
  por_canal jsonb,
  por_tipo jsonb,
  tasa_exito numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE estado = 'enviado') as total_enviados,
    COUNT(*) FILTER (WHERE estado = 'fallido') as total_fallidos,
    COUNT(*) FILTER (WHERE estado = 'pendiente') as total_pendientes,
    
    -- Agrupación por canal
    jsonb_object_agg(
      COALESCE(canal_envio, 'sin_canal'),
      COUNT(*) FILTER (WHERE canal_envio IS NOT NULL)
    ) FILTER (WHERE canal_envio IS NOT NULL) as por_canal,
    
    -- Agrupación por tipo
    jsonb_object_agg(
      tipo_notificacion_codigo,
      COUNT(*)
    ) as por_tipo,
    
    -- Tasa de éxito
    CASE 
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE estado = 'enviado')::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0
    END as tasa_exito
    
  FROM correo_historial_envios
  WHERE 
    (p_fecha_inicio IS NULL OR fecha_envio >= p_fecha_inicio)
    AND (p_fecha_fin IS NULL OR fecha_envio <= p_fecha_fin)
    AND (p_tipo_notificacion_codigo IS NULL OR tipo_notificacion_codigo = p_tipo_notificacion_codigo)
    AND (p_canal_envio IS NULL OR canal_envio = p_canal_envio);
END;
$$;

COMMENT ON FUNCTION obtener_estadisticas_envios IS 
'Obtiene estadísticas completas de envíos de notificaciones.
Útil para dashboards y reportes de administración.';

-- ============================================
-- VISTA: Historial completo de envíos con información del usuario
-- ============================================

CREATE OR REPLACE VIEW vista_historial_envios_completo AS
SELECT 
  h.id,
  h.tipo_notificacion_codigo,
  ctn.nombre as tipo_notificacion_nombre,
  h.canal_envio,
  h.destinatario_email,
  h.destinatario_nombre,
  h.numero_destino,
  h.asunto,
  h.estado,
  h.error_mensaje,
  h.fecha_envio,
  h.created_at,
  
  -- Información del destinatario
  u.id as usuario_id,
  u.nombre_completo as usuario_nombre_completo,
  u.rol as usuario_rol,
  o.nombre as oficina_nombre,
  
  -- Información de quién envió
  enviador.nombre_completo as enviado_por_nombre,
  enviador.rol as enviado_por_rol,
  
  -- Metadata
  h.whatsapp_respuesta,
  h.evento_id
  
FROM correo_historial_envios h
LEFT JOIN correo_tipos_notificacion ctn ON h.tipo_notificacion_id = ctn.id
LEFT JOIN usuarios u ON h.usuario_id = u.id
LEFT JOIN oficinas o ON u.oficina_id = o.id
LEFT JOIN usuarios enviador ON h.enviado_por = enviador.id
ORDER BY h.fecha_envio DESC;

COMMENT ON VIEW vista_historial_envios_completo IS 
'Vista completa del historial de envíos con información enriquecida del usuario.
Útil para visualización en interfaces de administración.';

-- ============================================
-- GRANTS
-- ============================================

GRANT EXECUTE ON FUNCTION registrar_envio_notificacion TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION registrar_envio_notificacion_batch TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION obtener_estadisticas_envios TO authenticated, service_role;
GRANT SELECT ON vista_historial_envios_completo TO authenticated, service_role;

-- ============================================
-- RLS para la vista
-- ============================================

-- Los administradores pueden ver todo el historial
CREATE POLICY "Admins can view all envios"
  ON correo_historial_envios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Los usuarios pueden ver sus propios envíos
CREATE POLICY "Users can view own envios"
  ON correo_historial_envios
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- Service role tiene acceso completo
CREATE POLICY "Service role full access to envios"
  ON correo_historial_envios
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- DOCUMENTACIÓN PARA EDGE FUNCTIONS
-- ============================================

COMMENT ON TABLE correo_historial_envios IS 
'IMPORTANTE: Esta tabla debe recibir un registro por CADA envío de notificación.

Edge Functions deben llamar a registrar_envio_notificacion() después de:
- ✅ Enviar email (resend, smtp)
- ✅ Enviar WhatsApp (wazzup24)
- ✅ Crear notificación interna (campanita)
- ✅ Notificaciones automáticas (triggers)
- ✅ Notificaciones manuales (admin)
- ✅ Notificaciones departamentales (RRHH, Mercadotecnia, Mesa Control)

Ejemplo de llamada desde Edge Function:
```sql
SELECT registrar_envio_notificacion(
  p_tipo_notificacion_codigo := ''cuenta_activada'',
  p_canal_envio := ''correo'',
  p_usuario_id := ''uuid-del-usuario'',
  p_destinatario_email := ''usuario@example.com'',
  p_destinatario_nombre := ''Juan Pérez'',
  p_asunto := ''Bienvenido a MOVI Digital'',
  p_cuerpo_html := ''<html>...</html>'',
  p_estado := ''enviado''
);
```

Para envíos batch:
```sql
SELECT registrar_envio_notificacion_batch(
  p_tipo_notificacion_codigo := ''nuevo_comunicado'',
  p_canal_envio := ''whatsapp'',
  p_destinatarios := ''[
    {"usuario_id": "uuid1", "email": "user1@example.com", "nombre": "User 1", "telefono": "+5215512345678"},
    {"usuario_id": "uuid2", "email": "user2@example.com", "nombre": "User 2", "telefono": "+5215587654321"}
  ]''::jsonb,
  p_asunto := ''Nuevo comunicado publicado'',
  p_estado := ''enviado''
);
```
';