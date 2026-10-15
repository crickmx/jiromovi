/*
  # Fix ticket_estatus for registro_actividad

  Ensures registro_actividad ONLY shows the 6 defined statuses:
  1. Iniciado
  2. Cotizado
  3. Espera Aseguradora
  4. Espera Agente
  5. Emitido (Ganado)
  6. No Emitido (Perdido)

  Changes:
  - Remove 'registro_actividad' from Cerrado's tipo_aplicable
  - Remove 'registro_actividad' from Iniciado's tipo_aplicable
    (Iniciado is already exclusive via the dedicated row with registro_actividad)
  
  Wait — Iniciado IS needed for registro_actividad. Let's check:
  - "Iniciado" row has tipo_aplicable = [general, registro_actividad, solicitud_comisiones, cambio_bancario]
    → Keep registro_actividad here (it IS the initial status)
  - "Cerrado" row has tipo_aplicable includes registro_actividad → REMOVE it
  - "En Proceso", "Emitido", "No Emitido" already exclude registro_actividad → OK
*/

-- Remove 'registro_actividad' from "Cerrado" status
UPDATE ticket_estatus
SET tipo_aplicable = array_remove(tipo_aplicable, 'registro_actividad')
WHERE nombre = 'Cerrado';
