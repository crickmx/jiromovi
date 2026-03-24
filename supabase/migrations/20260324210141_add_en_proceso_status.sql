/*
  # Agregar estatus "En Proceso" para Cotización/Emisión

  1. Nuevo Estatus
    - "En Proceso" con color naranja (#f59e0b)
    - Orden 10.5 (entre Iniciado y Emitido)

  2. Notas
    - Ya existe "En proceso" (minúscula), pero necesitamos "En Proceso" (mayúscula) para consistencia
*/

-- =====================================================
-- INSERTAR ESTATUS "EN PROCESO"
-- =====================================================
INSERT INTO ticket_estatus (nombre, color, orden, activo)
SELECT 'En Proceso', '#f59e0b', 10, true
WHERE NOT EXISTS (
  SELECT 1 FROM ticket_estatus WHERE nombre = 'En Proceso'
);

-- Actualizar el orden de los estatus existentes para Cotización/Emisión
UPDATE ticket_estatus SET orden = 11 WHERE nombre = 'Iniciado';
UPDATE ticket_estatus SET orden = 12 WHERE nombre = 'En Proceso';
UPDATE ticket_estatus SET orden = 13 WHERE nombre = 'Emitido';
UPDATE ticket_estatus SET orden = 14 WHERE nombre = 'No Emitido';

-- Comentario
COMMENT ON TABLE ticket_estatus IS 'Catálogo de estatus para tickets. Para Cotización/Emisión: Iniciado, En Proceso, Emitido, No Emitido';
