-- Add 'cancelacion_poliza' to the tickets tipo_tramite CHECK constraint
ALTER TABLE tickets DROP CONSTRAINT tickets_tipo_tramite_check;

ALTER TABLE tickets ADD CONSTRAINT tickets_tipo_tramite_check CHECK (
  tipo_tramite = ANY (ARRAY[
    'correccion_poliza_registrada',
    'correccion_poliza_endoso',
    'correccion_comisiones',
    'registro_poliza',
    'solicitud_comisiones_pendientes',
    'cotizacion_emision',
    'registro_actividad',
    'cambio_bancario',
    'lead_registro_movi',
    'renovaciones',
    'cobranza',
    'otros_comercial',
    'formulario_cotizacion',
    'cancelacion_poliza'
  ])
);