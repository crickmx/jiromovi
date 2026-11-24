/*
  # Corregir constraint de visibilidad para permitir rol + oficina
  
  ## Descripción
  El constraint actual no permite especificar rol Y oficina al mismo tiempo,
  lo cual es necesario para que Gerentes puedan crear comunicados visibles
  para roles específicos DENTRO de su oficina.
  
  ## Cambios
  1. Eliminar constraint restrictivo actual
  2. Crear nuevo constraint que permita:
     - Solo rol (para comunicados de admin por rol global)
     - Solo oficina (para comunicados de admin por oficina)
     - Solo usuario (para comunicados dirigidos a usuario específico)
     - Rol + Oficina (para comunicados de gerente: rol específico en oficina específica)
     - para_todos (para comunicados visibles para todos)
  
  ## Validación
  Al menos uno debe estar presente o para_todos debe ser true
*/

-- =====================================================
-- 1. Eliminar constraint antiguo
-- =====================================================

ALTER TABLE comunicados_visibilidad
DROP CONSTRAINT IF EXISTS check_only_one_visibility_type;

-- =====================================================
-- 2. Crear nuevo constraint más flexible
-- =====================================================

ALTER TABLE comunicados_visibilidad
ADD CONSTRAINT check_valid_visibility_configuration CHECK (
  -- Debe tener al menos una configuración de visibilidad
  (
    para_todos = true
    OR rol IS NOT NULL
    OR oficina_id IS NOT NULL
    OR usuario_id IS NOT NULL
  )
  AND
  -- Si es para_todos, no debe tener otras restricciones
  (
    para_todos = false
    OR (rol IS NULL AND oficina_id IS NULL AND usuario_id IS NULL)
  )
  AND
  -- usuario_id no puede combinarse con rol u oficina
  (
    usuario_id IS NULL
    OR (rol IS NULL AND oficina_id IS NULL)
  )
);

-- =====================================================
-- Logs
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Constraint de visibilidad actualizado';
  RAISE NOTICE '✅ Ahora permite: rol + oficina (para Gerentes)';
  RAISE NOTICE '✅ Permite: solo rol (para Admins globales)';
  RAISE NOTICE '✅ Permite: solo oficina (para Admins por oficina)';
  RAISE NOTICE '✅ Permite: solo usuario (para mensajes directos)';
  RAISE NOTICE '✅ Permite: para_todos (sin restricciones)';
END $$;
