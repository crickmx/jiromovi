/*
  # Examen Final - Parte 2
  
  Insertar preguntas 41-65 (Módulo 3: Seguro de Daños/Autos)
*/

-- ============================================================================
-- MÓDULO 3: SEGURO DE DAÑOS/AUTOS (Preguntas 41-65)
-- ============================================================================

INSERT INTO cedula_a_preguntas (examen_id, pregunta, opciones, respuesta_correcta, explicacion, dificultad, orden)
SELECT 
  (SELECT id FROM cedula_a_examenes WHERE tipo = 'final'),
  pregunta,
  to_jsonb(opciones),
  respuesta,
  explicacion,
  dificultad,
  orden
FROM (VALUES
  ('Finalidad del seguro de daños:', ARRAY['Ahorro', 'Personas', 'Patrimonio', 'Crédito'], 'C', 'El seguro de daños protege el patrimonio', 'basica', 41),
  ('Principio del seguro de daños:', ARRAY['Solidaridad', 'Indemnización', 'Capitalización', 'Buena fe'], 'B', 'El principio fundamental es la indemnización de pérdidas', 'basica', 42),
  ('Autos pertenece a operación:', ARRAY['Vida', 'Accidentes', 'Daños', 'Salud'], 'C', 'Automóviles es ramo de daños', 'basica', 43),
  ('Daños materiales cubre:', ARRAY['Lesiones', 'Vehículo asegurado', 'Multas', 'Robo parcial'], 'B', 'Daños materiales cubre el vehículo asegurado', 'basica', 44),
  ('Robo total es:', ARRAY['Llantas', 'Autopartes', 'Desaparición total', 'Vandalismo'], 'C', 'Robo total es la desaparición completa del vehículo', 'basica', 45),
  ('RC cubre:', ARRAY['Daños propios', 'Daños a terceros', 'Multas', 'Robo'], 'B', 'Responsabilidad Civil cubre daños causados a terceros', 'basica', 46),
  ('G.M. a ocupantes cubre:', ARRAY['Enfermedades', 'Lesiones por accidente', 'Prevención', 'Hospital general'], 'B', 'Cubre gastos médicos por lesiones del accidente', 'basica', 47),
  ('Para procedencia, el asegurado debe:', ARRAY['Reparar', 'Avisar', 'Vender', 'Cancelar'], 'B', 'Debe avisar oportunamente el siniestro', 'basica', 48),
  ('Plazo general aviso:', ARRAY['24 h', '3 días', '5 días', '10 días'], 'C', 'El plazo general es de 5 días naturales', 'intermedia', 49),
  ('El asegurado NO debe:', ARRAY['Cooperar', 'Informar', 'Admitir responsabilidad', 'Avisar autoridad'], 'C', 'No debe admitir responsabilidad sin autorización', 'intermedia', 50),
  ('Pérdida total cuando supera:', ARRAY['50%', '60%', '75%', '90%'], 'C', 'Se considera pérdida total cuando supera 75%', 'intermedia', 51),
  ('Pérdida parcial es:', ARRAY['>75%', '<50%', 'Igual valor', 'Irreparable'], 'B', 'Pérdida parcial es menor al umbral de pérdida total', 'intermedia', 52),
  ('Demérito se aplica por:', ARRAY['Desgaste', 'Robo', 'Multa', 'Colisión'], 'A', 'El demérito se aplica por desgaste y antigüedad', 'intermedia', 53),
  ('Subrogación permite:', ARRAY['Cancelar', 'Cobrar primas', 'Reclamar a terceros', 'Aumentar deducible'], 'C', 'Permite reclamar al tercero responsable', 'intermedia', 54),
  ('Salvamentos corresponden a:', ARRAY['Asegurado', 'Agente', 'Aseguradora', 'Taller'], 'C', 'Los salvamentos pasan a propiedad de la aseguradora', 'intermedia', 55),
  ('Para robo total se requiere:', ARRAY['Licencia', 'Acta MP', 'Presupuesto', 'Dictamen'], 'B', 'Se requiere acta ante el Ministerio Público', 'intermedia', 56),
  ('Licencia del conductor debe ser:', ARRAY['Opcional', 'Vigente', 'Internacional', 'Cualquiera'], 'B', 'La licencia debe ser vigente', 'basica', 57),
  ('Sin licencia, la aseguradora:', ARRAY['Siempre paga', 'Investiga', 'Puede rechazar', 'Duplica deducible'], 'C', 'Puede rechazar el siniestro si no hay licencia vigente', 'intermedia', 58),
  ('Flotilla cubre:', ARRAY['Un vehículo', 'Dos o más', 'Solo nuevos', 'Solo particulares'], 'B', 'Una flotilla cubre dos o más vehículos', 'basica', 59),
  ('Valor comercial se basa en:', ARRAY['Agencia', 'Mercado', 'Fiscal', 'Sentimental'], 'B', 'Se basa en el valor de mercado', 'intermedia', 60),
  ('Deducible aplica en:', ARRAY['RC', 'Daños materiales', 'Asistencia', 'GM ocupantes'], 'B', 'El deducible aplica en daños materiales', 'intermedia', 61),
  ('Cobertura obligatoria por ley:', ARRAY['Daños', 'Robo', 'RC', 'GM'], 'C', 'Responsabilidad Civil es obligatoria por ley', 'basica', 62),
  ('Aviso a autoridades cuando hay:', ARRAY['Daños propios', 'Lesionados/terceros', 'Falla', 'Robo parcial'], 'B', 'Cuando hay lesionados o daños a terceros', 'intermedia', 63),
  ('Objetivo del seguro de autos:', ARRAY['Reparar siempre', 'Indemnizar conforme contrato', 'Evitar accidentes', 'Financiar'], 'B', 'Indemnizar conforme a las coberturas contratadas', 'basica', 64),
  ('RC no cubre:', ARRAY['Bienes de terceros', 'Lesiones a terceros', 'Daños propios', 'Gastos médicos de terceros'], 'C', 'RC no cubre los daños propios del asegurado', 'intermedia', 65)
) AS t(pregunta, opciones, respuesta, explicacion, dificultad, orden);