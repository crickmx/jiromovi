/*
  # Actualizar tipo_aplicable de estatus para cotizacion_emision

  Los trámites migrados de 'registro_actividad' a 'cotizacion_emision' necesitan
  acceso a los mismos estatus. Se agrega 'cotizacion_emision' al array tipo_aplicable
  de todos los estatus que tenían 'registro_actividad'.
*/

UPDATE ticket_estatus
SET tipo_aplicable = array_append(tipo_aplicable, 'cotizacion_emision')
WHERE tipo_aplicable @> ARRAY['registro_actividad']
  AND NOT (tipo_aplicable @> ARRAY['cotizacion_emision']);

-- También agregar 'cotizacion_emision' al estatus 'Iniciado' que usa 'general'
UPDATE ticket_estatus
SET tipo_aplicable = array_append(tipo_aplicable, 'cotizacion_emision')
WHERE nombre = 'Iniciado'
  AND NOT (tipo_aplicable @> ARRAY['cotizacion_emision']);
