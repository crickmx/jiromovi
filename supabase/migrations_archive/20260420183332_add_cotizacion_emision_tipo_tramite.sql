/*
  # Agregar cotizacion_emision al constraint de tipo_tramite y migrar registros

  1. Cambios
    - Actualiza el CHECK constraint de tickets.tipo_tramite para incluir 'cotizacion_emision'
    - Migra los 39 trámites de tipo 'registro_actividad' a 'cotizacion_emision'
*/

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_tipo_tramite_check;

ALTER TABLE tickets ADD CONSTRAINT tickets_tipo_tramite_check
  CHECK (tipo_tramite = ANY (ARRAY[
    'correccion_poliza_registrada',
    'correccion_comisiones',
    'registro_poliza',
    'solicitud_comisiones_pendientes',
    'lead_registro_movi',
    'registro_actividad',
    'cotizacion_emision',
    'cambio_bancario'
  ]));

UPDATE tickets SET tipo_tramite = 'cotizacion_emision' WHERE tipo_tramite = 'registro_actividad';
