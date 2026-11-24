-- Add comunicado_borrador_id to ia_bandeja to link processed emails to generated comunicados
ALTER TABLE ia_bandeja ADD COLUMN IF NOT EXISTS comunicado_borrador_id UUID REFERENCES comunicados_publicaciones(id) ON DELETE SET NULL;

-- Update the comunicados_aseguradoras robot with useful keywords
UPDATE ia_robots
SET palabras_clave = ARRAY[
  'circular', 'boletin', 'comunicado', 'aviso', 'informativo',
  'notificacion', 'actualizacion', 'cambio de condiciones',
  'nuevos productos', 'tarifa', 'cobertura', 'poliza',
  'renovacion masiva', 'cambio de proceso', 'plataforma',
  'portal agentes', 'sistema', 'capacitacion', 'webinar',
  'comision', 'bonificacion', 'concurso', 'promocion',
  'gnp', 'qualitas', 'chubb', 'hdi', 'zurich', 'ana seguros',
  'mapfre', 'inbursa', 'atlas', 'afirme', 'allianz'
],
descripcion = 'Identifica comunicados oficiales, circulares, boletines, avisos generales y actualizaciones de aseguradoras. Genera articulos y borradores de publicacion automaticamente.',
prompt_sistema = 'Eres un experto en seguros mexicano. Tu tarea es identificar emails que contengan comunicados, circulares o boletines de aseguradoras dirigidos a agentes. Estos emails suelen informar sobre cambios en productos, tarifas, procesos, nuevas coberturas, capacitaciones, concursos o actualizaciones de plataformas. NO clasificar emails de clientes ni solicitudes de cotizacion.'
WHERE codigo = 'comunicados_aseguradoras';

-- Create a template for the comunicados robot (tipo = comunicado)
INSERT INTO ia_robot_plantillas (robot_id, canal, nombre, tipo, asunto, cuerpo, activo)
SELECT
  id,
  'correo',
  'Borrador de Comunicado Automatico',
  'comunicado',
  '{{titulo_articulo}}',
  '{{contenido_articulo}}',
  true
FROM ia_robots WHERE codigo = 'comunicados_aseguradoras'
ON CONFLICT DO NOTHING;

-- Create index for faster lookup of unprocessed classified emails
CREATE INDEX IF NOT EXISTS idx_ia_bandeja_robot_comunicado
  ON ia_bandeja (robot_id, estado_procesamiento)
  WHERE comunicado_borrador_id IS NULL;
