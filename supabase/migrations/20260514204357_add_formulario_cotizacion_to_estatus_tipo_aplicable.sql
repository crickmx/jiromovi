/*
  # Add formulario_cotizacion to ticket status tipo_aplicable

  1. Changes
    - Add 'formulario_cotizacion' to tipo_aplicable arrays for all statuses
      that currently include 'cotizacion_emision', so formulario_cotizacion
      tickets can use the same workflow (Iniciado, Cotizado, Espera Aseguradora,
      Espera Agente, Emitido Ganado, No Emitido Perdido).

  2. Purpose
    - Allow formulario_cotizacion tickets to follow the same lifecycle as
      cotizacion_emision with ganar/perder outcomes.
*/

UPDATE ticket_estatus
SET tipo_aplicable = array_append(tipo_aplicable, 'formulario_cotizacion')
WHERE activo = true
  AND tipo_aplicable IS NOT NULL
  AND 'cotizacion_emision' = ANY(tipo_aplicable)
  AND NOT ('formulario_cotizacion' = ANY(tipo_aplicable));
