/*
  # Fix "Cerrado" status to be universal

  The "Cerrado" ticket status was filtered out for ticket types like
  cotizacion_emision and registro_actividad because its tipo_aplicable
  array did not include those types. Setting tipo_aplicable to NULL
  makes it available for all ticket types (the filter logic skips
  tipo_aplicable when it is NULL).
*/

UPDATE ticket_estatus
SET tipo_aplicable = NULL
WHERE nombre = 'Cerrado';
