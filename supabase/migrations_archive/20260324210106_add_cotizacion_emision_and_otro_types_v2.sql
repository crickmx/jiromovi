/*
  # Agregar tipos de trámite para Registro de Actividades

  1. Nuevos Tipos
    - "Cotización / Emisión" (unificado)
    - "Otro" (para otros trámites)

  2. Notas
    - Los tipos existentes "Cotización" y "Emisión" se mantienen para compatibilidad
    - El nuevo sistema usará "Cotización / Emisión" como tipo principal
*/

-- =====================================================
-- INSERTAR NUEVOS TIPOS DE TRÁMITE
-- =====================================================
INSERT INTO tramite_activity_types (nombre, descripcion, activo)
SELECT 'Cotización / Emisión', 'Proceso completo de cotización y emisión de pólizas', true
WHERE NOT EXISTS (
  SELECT 1 FROM tramite_activity_types WHERE nombre = 'Cotización / Emisión'
);

INSERT INTO tramite_activity_types (nombre, descripcion, activo)
SELECT 'Otro', 'Otros tipos de trámites o actividades', true
WHERE NOT EXISTS (
  SELECT 1 FROM tramite_activity_types WHERE nombre = 'Otro'
);

-- Comentario
COMMENT ON TABLE tramite_activity_types IS 'Catálogo de tipos de trámite para Registro de Actividades. Los principales son "Cotización / Emisión" y "Otro"';
