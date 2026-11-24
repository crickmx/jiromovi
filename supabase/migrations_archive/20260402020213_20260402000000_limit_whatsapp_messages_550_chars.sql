/*
  # Limitar Mensajes de WhatsApp a 550 Caracteres

  1. Problema
    - Los mensajes de WhatsApp muy largos pueden causar problemas
    - WhatsApp tiene límites prácticos de longitud de mensaje
    - Necesitamos garantizar que ningún mensaje exceda 550 caracteres

  2. Cambios
    - Actualizar plantillas largas para ser más concisas
    - Agregar validación a nivel de base de datos
    - Agregar función helper para truncar mensajes si es necesario

  3. Plantillas actualizadas
    - cuenta_activada: Reducida de 396 a ~350 caracteres
    - commission_batch_closed: Optimizada
    - nuevo_usuario_creado: Optimizada
    - Otras plantillas: Verificadas y optimizadas
*/

-- ============================================
-- Actualizar plantillas largas para ser más concisas
-- ============================================

-- cuenta_activada (396 -> ~340 caracteres)
UPDATE correo_plantillas 
SET whatsapp_plantilla = '{{nombre}} ¡Bienvenid@ a {{oficina}}! 🎉

Tu cuenta en MOVI Digital está activa.

📧 Usuario: {{email_laboral}}
🔑 Contraseña: {{password}}
🌐 Tu página web: {{pagina_web}}

⚠️ Cambia tu contraseña tras el primer inicio de sesión.

Ingresa: www.movi.digital'
WHERE id IN (
  SELECT cp.id FROM correo_plantillas cp
  JOIN correo_tipos_notificacion ctn ON cp.tipo_notificacion_id = ctn.id
  WHERE ctn.codigo = 'cuenta_activada'
);

-- vacaciones_aprobadas (277 -> ~250 caracteres)
UPDATE correo_plantillas 
SET whatsapp_plantilla = '✅ *Vacaciones Aprobadas*

*Empleado:* {{empleado_nombre}} {{empleado_apellidos}}
*Oficina:* {{empleado_oficina}}
*Período:* {{fecha_inicio_vacaciones}} - {{fecha_fin_vacaciones}}
*Aprobado por:* {{aprobado_por}}

_RRHH - MOVI Digital_'
WHERE id IN (
  SELECT cp.id FROM correo_plantillas cp
  JOIN correo_tipos_notificacion ctn ON cp.tipo_notificacion_id = ctn.id
  WHERE ctn.codigo = 'vacaciones_aprobadas'
);

-- nuevo_usuario_creado (275 -> ~240 caracteres)
UPDATE correo_plantillas 
SET whatsapp_plantilla = '🆕 *Nuevo Usuario*

*Nombre:* {{usuario_nombre}} {{usuario_apellidos}}
*Email:* {{usuario_email_laboral}}
*Rol:* {{usuario_rol}}
*Oficina:* {{usuario_oficina}}
*Creado por:* {{creado_por}}

Ver: {{link_usuario}}

_MOVI Digital_'
WHERE id IN (
  SELECT cp.id FROM correo_plantillas cp
  JOIN correo_tipos_notificacion ctn ON cp.tipo_notificacion_id = ctn.id
  WHERE ctn.codigo = 'nuevo_usuario_creado'
);

-- commission_batch_closed (271 -> ~240 caracteres)
UPDATE correo_plantillas 
SET whatsapp_plantilla = 'Hola {{agent_name}} 👋

Tus comisiones semana {{week_number}} ({{period_start}} - {{period_end}}) están listas.

💰 Total: {{net_commission_total}} MXN

Ver detalle: www.movi.digital

_MOVI Digital_'
WHERE id IN (
  SELECT cp.id FROM correo_plantillas cp
  JOIN correo_tipos_notificacion ctn ON cp.tipo_notificacion_id = ctn.id
  WHERE ctn.codigo = 'commission_batch_closed'
);

-- nuevo_registro_no_usuario (263 -> ~230 caracteres)
UPDATE correo_plantillas 
SET whatsapp_plantilla = '🆕 *Registro - No usuario*

*Nombre:* {{nombre_completo}}
*Email:* {{email}}
*WhatsApp:* {{whatsapp}}
*Agente JIRO:* {{es_agente_texto}}
*Oficina:* {{oficina_nombre}}

📅 {{fecha_registro}}

{{url_tarea}}'
WHERE id IN (
  SELECT cp.id FROM correo_plantillas cp
  JOIN correo_tipos_notificacion ctn ON cp.tipo_notificacion_id = ctn.id
  WHERE ctn.codigo = 'nuevo_registro_no_usuario'
);

-- solicitud_correccion_comisiones (261 -> ~220 caracteres)
UPDATE correo_plantillas 
SET whatsapp_plantilla = '💰 *Corrección Comisiones*

*Lote:* Semana {{lote_semana}}
*Doc:* {{documento}}
*Usuario:* {{usuario_nombre}} {{usuario_apellidos}}
*Motivo:* {{motivo_correccion}}

Ver: {{link_lote}}

_Mesa de Control_'
WHERE id IN (
  SELECT cp.id FROM correo_plantillas cp
  JOIN correo_tipos_notificacion ctn ON cp.tipo_notificacion_id = ctn.id
  WHERE ctn.codigo = 'solicitud_correccion_comisiones'
);

-- solicitud_compra_store (254 -> ~220 caracteres)
UPDATE correo_plantillas 
SET whatsapp_plantilla = '🛒 *Nuevo Pedido*

*Pedido:* #{{pedido_id}}
*Usuario:* {{usuario_nombre}} {{usuario_apellidos}}
*Oficina:* {{usuario_oficina}}
*Fecha:* {{fecha_pedido}}
*Productos:* {{total_productos}}

Ver: {{link_pedido}}

_Store_'
WHERE id IN (
  SELECT cp.id FROM correo_plantillas cp
  JOIN correo_tipos_notificacion ctn ON cp.tipo_notificacion_id = ctn.id
  WHERE ctn.codigo = 'solicitud_compra_store'
);

-- bienvenida (249 -> ~220 caracteres)
UPDATE correo_plantillas 
SET whatsapp_plantilla = '¡Bienvenido {{nombre}} {{apellidos}}! 🎉

Tu cuenta está lista.

📧 Email: {{email_laboral}}
👤 Rol: {{rol}}
🏢 Oficina: {{oficina}}
🌐 Web: {{pagina_web}}

Ingresa: www.movi.digital'
WHERE id IN (
  SELECT cp.id FROM correo_plantillas cp
  JOIN correo_tipos_notificacion ctn ON cp.tipo_notificacion_id = ctn.id
  WHERE ctn.codigo = 'bienvenida'
);

-- nuevo_tramite (246 -> ~210 caracteres)
UPDATE correo_plantillas 
SET whatsapp_plantilla = '📋 *Nuevo Trámite*

*Tipo:* {{tipo_tramite}}
*Folio:* {{folio_tramite}}
*Usuario:* {{usuario_nombre}} {{usuario_apellidos}}
*Fecha:* {{fecha_creacion}}

Ver: {{link_tramite}}

_Mesa de Control_'
WHERE id IN (
  SELECT cp.id FROM correo_plantillas cp
  JOIN correo_tipos_notificacion ctn ON cp.tipo_notificacion_id = ctn.id
  WHERE ctn.codigo = 'nuevo_tramite'
);

-- nuevo_comunicado (ya está bien, pero optimizar)
UPDATE correo_plantillas 
SET whatsapp_plantilla = '📢 *Nuevo Comunicado*

*{{titulo_comunicado}}*

Hola {{nombre}},

Un nuevo comunicado para ti.

🔗 Ver: {{link_comunicado}}

_MOVI Digital_'
WHERE id IN (
  SELECT cp.id FROM correo_plantillas cp
  JOIN correo_tipos_notificacion ctn ON cp.tipo_notificacion_id = ctn.id
  WHERE ctn.codigo = 'nuevo_comunicado'
);

-- ============================================
-- Función para truncar mensajes WhatsApp si exceden 550 caracteres
-- ============================================

CREATE OR REPLACE FUNCTION truncate_whatsapp_message(
  p_message text,
  p_max_length integer DEFAULT 550
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF LENGTH(p_message) <= p_max_length THEN
    RETURN p_message;
  END IF;
  
  -- Truncar y agregar indicador
  RETURN SUBSTRING(p_message FROM 1 FOR p_max_length - 20) || '... [Continúa]';
END;
$$;

COMMENT ON FUNCTION truncate_whatsapp_message IS 'Trunca mensajes de WhatsApp a un máximo de caracteres (default 550) para evitar problemas de envío';

-- ============================================
-- Constraint para validar longitud en plantillas
-- ============================================

-- Agregar constraint check para whatsapp_plantilla
ALTER TABLE correo_plantillas 
ADD CONSTRAINT check_whatsapp_plantilla_length 
CHECK (LENGTH(whatsapp_plantilla) <= 550);

COMMENT ON CONSTRAINT check_whatsapp_plantilla_length ON correo_plantillas IS 
  'Valida que las plantillas de WhatsApp no excedan 550 caracteres para garantizar entrega correcta';

-- ============================================
-- Verificación final
-- ============================================

DO $$
DECLARE
  v_max_length integer;
  v_count_exceeds integer;
BEGIN
  -- Verificar longitud máxima actual
  SELECT MAX(LENGTH(whatsapp_plantilla))
  INTO v_max_length
  FROM correo_plantillas
  WHERE whatsapp_plantilla IS NOT NULL;

  -- Contar plantillas que exceden 550
  SELECT COUNT(*)
  INTO v_count_exceeds
  FROM correo_plantillas
  WHERE LENGTH(whatsapp_plantilla) > 550;

  RAISE NOTICE '✅ Longitud máxima de plantillas WhatsApp: % caracteres', v_max_length;
  RAISE NOTICE '✅ Plantillas que exceden 550 caracteres: %', v_count_exceeds;

  IF v_count_exceeds > 0 THEN
    RAISE WARNING '⚠️ Existen % plantillas que exceden 550 caracteres. Revisar manualmente.', v_count_exceeds;
  ELSE
    RAISE NOTICE '✅ Todas las plantillas cumplen con el límite de 550 caracteres';
  END IF;
END $$;
