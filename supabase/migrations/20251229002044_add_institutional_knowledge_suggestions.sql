/*
  # Agregar Conocimiento Institucional al Asistente

  1. Nuevos Intents
    - institutional_info: Preguntas sobre JIRO y Agente Total
    - brand_relationship: Relación entre marcas

  2. Nuevas Sugerencias
    - Preguntas institucionales frecuentes
    - Disponibles en todas las rutas
    - Prioridad media-baja para no saturar

  3. Propósito
    - Permitir a Mi Asistente responder dudas institucionales
    - Usar solo conocimiento validado (no web search)
    - Reforzar identidad corporativa
*/

-- Agregar nuevos intents institucionales
INSERT INTO assistant_intents (codigo, nombre, descripcion, categoria, prompt_template, requiere_snapshot, activo, orden)
VALUES
  (
    'institutional_info',
    'Información Institucional',
    'Proporciona información validada sobre JIRO y Asociados y Agente Total',
    'general',
    'Proporciona información institucional sobre JIRO y Asociados y Agente Total usando SOLO el conocimiento validado en formato JSON.',
    false,
    true,
    13
  ),
  (
    'brand_relationship',
    'Relación entre Marcas',
    'Explica la relación entre JIRO y Asociados, Agente Total y MOVI Digital',
    'general',
    'Explica la relación entre JIRO y Asociados, Agente Total y MOVI Digital usando SOLO el conocimiento validado en formato JSON.',
    false,
    true,
    14
  )
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  prompt_template = EXCLUDED.prompt_template,
  updated_at = now();

-- Agregar sugerencias institucionales para todas las rutas principales
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, rol_requerido, orden, texto_pregunta, activo)
VALUES
  -- Dashboard
  ('institutional_info', '/dashboard', NULL, 20, '¿Qué es Agente Total?', true),
  ('brand_relationship', '/dashboard', NULL, 21, '¿Cuál es la relación entre JIRO y MOVI?', true),

  -- General (para cualquier ruta)
  ('institutional_info', '%', NULL, 100, '¿Quiénes son JIRO y Asociados?', true),
  ('institutional_info', '%', NULL, 101, '¿Qué respaldo institucional tengo?', true),
  ('brand_relationship', '%', NULL, 102, '¿Qué es MOVI Digital?', true),

  -- Perfil (relevante porque es info personal)
  ('institutional_info', '/perfil', NULL, 15, '¿Cómo me apoya Agente Total?', true),
  ('institutional_info', '/perfil', NULL, 16, '¿Qué beneficios tengo con Agente Total?', true)
ON CONFLICT DO NOTHING;
