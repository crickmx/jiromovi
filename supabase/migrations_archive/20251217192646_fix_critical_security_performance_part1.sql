/*
  # Corrección de Problemas Críticos - Parte 1

  1. Índices Faltantes
    - Agregar índice para foreign key en valores_campos_personalizados.campo_id

  2. Optimización de Políticas RLS Básicas
    - Corregir políticas de tablas usuarios y tickets para usar (select auth.uid())

  3. Extensiones
    - Mover pg_trgm y unaccent del schema público a extensions
*/

-- =====================================================
-- 1. AGREGAR ÍNDICE FALTANTE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_valores_campos_personalizados_campo_id 
ON valores_campos_personalizados(campo_id);

-- =====================================================
-- 2. MOVER EXTENSIONES FUERA DEL SCHEMA PÚBLICO
-- =====================================================

-- Crear schema extensions si no existe
CREATE SCHEMA IF NOT EXISTS extensions;

-- Mover pg_trgm
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;

-- Mover unaccent
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent') THEN
    ALTER EXTENSION unaccent SET SCHEMA extensions;
  END IF;
END $$;

-- =====================================================
-- 3. OPTIMIZAR POLÍTICAS RLS - TABLA USUARIOS
-- =====================================================

DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;

CREATE POLICY "Users can update own profile"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- =====================================================
-- 4. OPTIMIZAR POLÍTICAS RLS - TABLA TICKETS
-- =====================================================

DROP POLICY IF EXISTS "tickets_insert_all_authenticated" ON tickets;
DROP POLICY IF EXISTS "tickets_delete_admin_only" ON tickets;

CREATE POLICY "tickets_insert_all_authenticated"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    creado_por = (select auth.uid())
  );

CREATE POLICY "tickets_delete_admin_only"
  ON tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
      AND u.rol = 'Administrador'
    )
  );

-- =====================================================
-- 5. OPTIMIZAR POLÍTICAS RLS - TICKET ESTATUS
-- =====================================================

DROP POLICY IF EXISTS "Solo admin puede gestionar estatus" ON ticket_estatus;

CREATE POLICY "Solo admin puede gestionar estatus"
  ON ticket_estatus
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid())
      AND rol = 'Administrador'
    )
  );

-- =====================================================
-- 6. OPTIMIZAR POLÍTICAS RLS - TICKET ASIGNACIONES
-- =====================================================

DROP POLICY IF EXISTS "ticket_asignaciones_delete_admin_gerente" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_insert_admin_gerente" ON ticket_asignaciones;

CREATE POLICY "ticket_asignaciones_delete_admin_gerente"
  ON ticket_asignaciones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid())
      AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "ticket_asignaciones_insert_admin_gerente"
  ON ticket_asignaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid())
      AND rol IN ('Administrador', 'Gerente')
    )
  );

-- =====================================================
-- 7. OPTIMIZAR POLÍTICAS RLS - TICKET COMENTARIOS
-- =====================================================

DROP POLICY IF EXISTS "ticket_comentarios_insert_all" ON ticket_comentarios;

CREATE POLICY "ticket_comentarios_insert_all"
  ON ticket_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = (select auth.uid())
  );

-- =====================================================
-- 8. OPTIMIZAR POLÍTICAS RLS - TICKET ARCHIVOS
-- =====================================================

DROP POLICY IF EXISTS "ticket_archivos_insert_all" ON ticket_archivos;

CREATE POLICY "ticket_archivos_insert_all"
  ON ticket_archivos FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = (select auth.uid())
  );