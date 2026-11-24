-- Permite elegir, desde Admin > Reportes de Bugs, con qué estatus (de las opciones del campo
-- "Estatus" del FormBuilder del tipo elegido) se crea el ticket, y a cuál pasa automáticamente
-- una vez que el diagnóstico IA termina. Se guarda el slug (no un id) porque las opciones de un
-- campo tipo "estatus" viven en JSON libre (tramite_tipo_campos.config->'opciones'), no en tabla.
ALTER TABLE bug_report_config
  ADD COLUMN IF NOT EXISTS estatus_inicial_slug text,
  ADD COLUMN IF NOT EXISTS estatus_post_diagnostico_slug text;
