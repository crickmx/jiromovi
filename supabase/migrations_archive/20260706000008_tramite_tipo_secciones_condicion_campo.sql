-- Permite que una sección se desbloquee según el VALOR de la respuesta de un
-- campo (estilo Google Forms), como alternativa a "depende de otra sección
-- completa". Si condicion_campo_id está definido, tiene prioridad sobre
-- depende_de_seccion_id (son mutuamente excluyentes desde la UI, pero ambas
-- columnas coexisten para no romper secciones ya configuradas con la vieja).
ALTER TABLE tramite_tipo_secciones
  ADD COLUMN IF NOT EXISTS condicion_campo_id uuid REFERENCES tramite_tipo_campos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condicion_operador text CHECK (condicion_operador IN ('igual_a', 'distinto_a', 'tiene_valor')),
  ADD COLUMN IF NOT EXISTS condicion_valor text;
