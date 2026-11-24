/*
  # Habilitar RLS en Tablas Públicas

  1. Propósito
    - Habilitar Row Level Security en tablas sin RLS
    - Mejorar seguridad de datos
    - Prevenir accesos no autorizados

  2. Tablas Afectadas
    - publicidad_uso_estadisticas
    - reservas_evaluaciones
    - ticket_asignaciones_cache
    - auditoria_logs

  3. Políticas
    - Se crean políticas básicas para cada tabla
    - Admins pueden gestionar todo
    - Usuarios solo pueden ver sus propios registros
*/

-- Habilitar RLS
ALTER TABLE publicidad_uso_estadisticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas_evaluaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_asignaciones_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para publicidad_uso_estadisticas
CREATE POLICY "Usuarios pueden ver sus propias estadísticas"
  ON publicidad_uso_estadisticas
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = usuario_id);

CREATE POLICY "Sistema puede insertar estadísticas"
  ON publicidad_uso_estadisticas
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas para reservas_evaluaciones
CREATE POLICY "Usuarios pueden ver sus evaluaciones"
  ON reservas_evaluaciones
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = usuario_id);

CREATE POLICY "Usuarios pueden crear evaluaciones"
  ON reservas_evaluaciones
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = usuario_id);

-- Políticas para ticket_asignaciones_cache
CREATE POLICY "Usuarios pueden ver asignaciones de cache"
  ON ticket_asignaciones_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sistema puede gestionar cache"
  ON ticket_asignaciones_cache
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (SELECT auth.uid())
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Políticas para auditoria_logs
CREATE POLICY "Admins pueden ver todos los logs"
  ON auditoria_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (SELECT auth.uid())
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Sistema puede insertar logs"
  ON auditoria_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);