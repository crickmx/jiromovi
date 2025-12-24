/*
  # Cargar Sugerencias Contextuales para Todas las Rutas

  1. Sugerencias
    - 5 sugerencias por cada ruta principal del sistema
    - Ordenadas por relevancia y frecuencia de uso
    - Mapeo a intents específicos cuando aplica
    - Algunas sin intent específico para clasificación dinámica

  2. Organización
    - Dashboard: resumen general y acciones rápidas
    - Mis Comisiones: explicaciones y análisis
    - Mi Producción: tendencias y comparaciones
    - Mi CRM: contacto con clientes y oportunidades
    - Trámites: seguimiento y actualizaciones
*/

-- ============================================================================
-- SUGERENCIAS: /dashboard
-- ============================================================================
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta) VALUES
('daily_priorities', '/dashboard', NULL, 1, '¿Qué debo hacer hoy primero?'),
('dashboard_summary', '/dashboard', NULL, 2, '¿Cómo voy hoy y esta semana?'),
('commission_explain', '/dashboard', NULL, 3, 'Explícame mi última comisión'),
('client_outreach_plan', '/dashboard', NULL, 4, '¿A quién debo contactar para vender hoy?'),
('renewals_forecast', '/dashboard', NULL, 5, '¿Tengo renovaciones próximas?');

-- ============================================================================
-- SUGERENCIAS: /mis-comisiones
-- ============================================================================
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta) VALUES
('commission_explain', '/mis-comisiones', NULL, 1, 'Explícame mi última comisión'),
('commission_anomaly_detect', '/mis-comisiones', NULL, 2, '¿Qué comisiones son atípicas?'),
(NULL, '/mis-comisiones', NULL, 3, '¿Cómo voy vs mi promedio?'),
(NULL, '/mis-comisiones', NULL, 4, 'Genera reporte de comisiones'),
(NULL, '/mis-comisiones', NULL, 5, '¿Por qué mi comisión bajó este mes?');

-- ============================================================================
-- SUGERENCIAS: /mis-comisiones/:id (detalle de comisión)
-- ============================================================================
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta) VALUES
('commission_explain', '/mis-comisiones/:id', NULL, 1, 'Explícame esta comisión en detalle'),
(NULL, '/mis-comisiones/:id', NULL, 2, '¿Por qué es diferente al mes pasado?'),
(NULL, '/mis-comisiones/:id', NULL, 3, '¿Hay algún error en el cálculo?'),
(NULL, '/mis-comisiones/:id', NULL, 4, 'Genera comprobante de pago'),
(NULL, '/mis-comisiones/:id', NULL, 5, '¿Cómo se calculó este monto?');

-- ============================================================================
-- SUGERENCIAS: /mi-produccion
-- ============================================================================
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta) VALUES
('performance_summary', '/mi-produccion', NULL, 1, '¿Cómo va mi producción este mes?'),
(NULL, '/mi-produccion', NULL, 2, '¿Cuál es mi tendencia de ventas?'),
(NULL, '/mi-produccion', NULL, 3, '¿Qué ramo me genera más producción?'),
(NULL, '/mi-produccion', NULL, 4, '¿Cómo me comparo con mis metas?'),
(NULL, '/mi-produccion', NULL, 5, '¿Con qué aseguradora vendo más?');

-- ============================================================================
-- SUGERENCIAS: /mi-crm/contactos
-- ============================================================================
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta) VALUES
('client_outreach_plan', '/mi-crm/contactos', NULL, 1, '¿Qué contactos debo llamar hoy?'),
('renewals_forecast', '/mi-crm/contactos', NULL, 2, '¿Quiénes están por renovar?'),
('cross_sell_opportunities', '/mi-crm/contactos', NULL, 3, 'Oportunidades de venta cruzada'),
(NULL, '/mi-crm/contactos', NULL, 4, '¿Quiénes están inactivos hace tiempo?'),
(NULL, '/mi-crm/contactos', NULL, 5, 'Genera plan de contacto semanal');

-- ============================================================================
-- SUGERENCIAS: /mi-crm/contactos/:id (detalle de contacto)
-- ============================================================================
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta) VALUES
(NULL, '/mi-crm/contactos/:id', NULL, 1, 'Dame un resumen de este contacto'),
('cross_sell_opportunities', '/mi-crm/contactos/:id', NULL, 2, '¿Qué más le puedo vender?'),
(NULL, '/mi-crm/contactos/:id', NULL, 3, '¿Está próximo a renovar?'),
('message_generator', '/mi-crm/contactos/:id', NULL, 4, 'Genera mensaje de WhatsApp personalizado'),
(NULL, '/mi-crm/contactos/:id', NULL, 5, '¿Qué seguimiento me recomiendas?');

-- ============================================================================
-- SUGERENCIAS: /mi-crm/tareas
-- ============================================================================
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta) VALUES
('daily_priorities', '/mi-crm/tareas', NULL, 1, '¿Qué tareas tengo pendientes hoy?'),
(NULL, '/mi-crm/tareas', NULL, 2, '¿Cuáles están vencidas?'),
(NULL, '/mi-crm/tareas', NULL, 3, 'Prioriza mis pendientes'),
(NULL, '/mi-crm/tareas', NULL, 4, '¿Qué debo hacer primero?'),
(NULL, '/mi-crm/tareas', NULL, 5, 'Resumen de tareas de la semana');

-- ============================================================================
-- SUGERENCIAS: /tramites
-- ============================================================================
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta) VALUES
(NULL, '/tramites', NULL, 1, '¿Qué trámites están pendientes?'),
(NULL, '/tramites', NULL, 2, '¿Cuáles tardan más de lo normal?'),
(NULL, '/tramites', NULL, 3, '¿Qué debo actualizar?'),
(NULL, '/tramites', NULL, 4, 'Estado general de mis trámites'),
(NULL, '/tramites', NULL, 5, '¿Alguno requiere atención urgente?');

-- ============================================================================
-- SUGERENCIAS: /tramites/:id (detalle de trámite)
-- ============================================================================
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta) VALUES
('tramite_status_helper', '/tramites/:id', NULL, 1, '¿En qué estado está este trámite?'),
(NULL, '/tramites/:id', NULL, 2, '¿Cuál es el siguiente paso?'),
(NULL, '/tramites/:id', NULL, 3, '¿Cuánto tiempo falta?'),
(NULL, '/tramites/:id', NULL, 4, 'Historial de cambios'),
(NULL, '/tramites/:id', NULL, 5, '¿Hay algún problema o retraso?');

-- ============================================================================
-- SUGERENCIAS: /produccion-por-vendedor (solo gerentes)
-- ============================================================================
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta) VALUES
('team_insights_manager', '/produccion-por-vendedor', 'gerente', 1, 'Compara el desempeño del equipo'),
(NULL, '/produccion-por-vendedor', 'gerente', 2, '¿Quién es el top performer este mes?'),
(NULL, '/produccion-por-vendedor', 'gerente', 3, '¿Quién necesita apoyo?'),
(NULL, '/produccion-por-vendedor', 'gerente', 4, 'Tendencias del equipo últimos 3 meses'),
(NULL, '/produccion-por-vendedor', 'gerente', 5, 'Genera reporte de oficina');

-- ============================================================================
-- SUGERENCIAS GENERALES: rutas sin match específico (fallback)
-- ============================================================================
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta) VALUES
('navigation_help', '*', NULL, 1, '¿Cómo navego por el sistema?'),
('dashboard_summary', '*', NULL, 2, 'Muéstrame un resumen general'),
(NULL, '*', NULL, 3, '¿Qué puedo hacer aquí?'),
(NULL, '*', NULL, 4, 'Ayúdame a encontrar algo'),
('daily_priorities', '*', NULL, 5, '¿Qué es lo más importante hoy?');
