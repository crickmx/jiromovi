/*
  # Correcciones para el flujo de Web Leads

  1. Políticas RLS para service_role
    - Agregar políticas para que service_role pueda leer usuarios por web_slug
    - Necesario para la edge function submit-web-lead
  
  2. Índices de rendimiento
    - Índice en crm_contactos.email para búsquedas rápidas anti-duplicados
    - Índice en crm_contactos.celular para búsquedas rápidas anti-duplicados
    - Índice compuesto en crm_contactos (creado_por, celular)
    - Índice compuesto en crm_contactos (creado_por, email)

  3. Seguridad
    - Todas las políticas son restrictivas y solo permiten acceso necesario
*/

-- ============================================
-- POLÍTICAS RLS PARA SERVICE_ROLE - USUARIOS
-- ============================================

-- Permitir que service_role lea usuarios (necesario para submit-web-lead)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'usuarios' 
    AND policyname = 'Service role can select users for web leads'
  ) THEN
    CREATE POLICY "Service role can select users for web leads"
      ON usuarios
      FOR SELECT
      TO service_role
      USING (true);
  END IF;
END $$;

-- ============================================
-- ÍNDICES DE RENDIMIENTO - CRM_CONTACTOS
-- ============================================

-- Índice en email para búsquedas anti-duplicados
CREATE INDEX IF NOT EXISTS idx_crm_contactos_email 
  ON crm_contactos(email) 
  WHERE email IS NOT NULL;

-- Índice en celular para búsquedas anti-duplicados
CREATE INDEX IF NOT EXISTS idx_crm_contactos_celular 
  ON crm_contactos(celular);

-- Índice compuesto para búsquedas por creado_por + email
CREATE INDEX IF NOT EXISTS idx_crm_contactos_creado_por_email 
  ON crm_contactos(creado_por, email) 
  WHERE email IS NOT NULL;

-- Índice compuesto para búsquedas por creado_por + celular
CREATE INDEX IF NOT EXISTS idx_crm_contactos_creado_por_celular 
  ON crm_contactos(creado_por, celular);

-- ============================================
-- ÍNDICES DE RENDIMIENTO - CRM_TAREAS
-- ============================================

-- Índice en contacto_id para joins rápidos
CREATE INDEX IF NOT EXISTS idx_crm_tareas_contacto_id 
  ON crm_tareas(contacto_id) 
  WHERE contacto_id IS NOT NULL;

-- Índice compuesto para búsquedas por creado_por + fecha_vencimiento
CREATE INDEX IF NOT EXISTS idx_crm_tareas_creado_por_fecha 
  ON crm_tareas(creado_por, fecha_vencimiento);

-- Índice para filtrar por estatus y prioridad
CREATE INDEX IF NOT EXISTS idx_crm_tareas_estatus_prioridad 
  ON crm_tareas(estatus, prioridad);

-- ============================================
-- ÍNDICES DE RENDIMIENTO - USUARIOS
-- ============================================

-- El índice único en web_slug ya existe, pero aseguramos que esté optimizado
-- para búsquedas que filtran por estado activo
CREATE INDEX IF NOT EXISTS idx_usuarios_web_slug_active 
  ON usuarios(web_slug, estado) 
  WHERE web_slug IS NOT NULL;

-- ============================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================

COMMENT ON INDEX idx_crm_contactos_email IS 'Índice para búsquedas anti-duplicados por email';
COMMENT ON INDEX idx_crm_contactos_celular IS 'Índice para búsquedas anti-duplicados por celular';
COMMENT ON INDEX idx_crm_contactos_creado_por_email IS 'Índice compuesto para búsquedas de duplicados por agente y email';
COMMENT ON INDEX idx_crm_contactos_creado_por_celular IS 'Índice compuesto para búsquedas de duplicados por agente y celular';
COMMENT ON INDEX idx_crm_tareas_contacto_id IS 'Índice para joins con crm_contactos';
COMMENT ON INDEX idx_usuarios_web_slug_active IS 'Índice optimizado para búsquedas de páginas web públicas activas';
