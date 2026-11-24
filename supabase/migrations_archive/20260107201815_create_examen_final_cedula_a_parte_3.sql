/*
  # Examen Final - Parte 3
  
  Insertar preguntas 66-80 (Módulo 4: Sistemas y Mercados Financieros)
*/

-- ============================================================================
-- MÓDULO 4: SISTEMAS Y MERCADOS FINANCIEROS (Preguntas 66-80)
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
  ('El sistema financiero canaliza:', ARRAY['Pólizas', 'Ahorro', 'Siniestros', 'Primas'], 'B', 'El sistema financiero canaliza el ahorro hacia la inversión', 'basica', 66),
  ('Máxima autoridad financiera:', ARRAY['BANXICO', 'CNSF', 'SHCP', 'CNBV'], 'C', 'La SHCP es la máxima autoridad del sistema financiero', 'basica', 67),
  ('Función principal de BANXICO:', ARRAY['Autorizar agentes', 'Emitir moneda', 'Vender seguros', 'Cobrar impuestos'], 'B', 'Banxico es el banco central que emite moneda', 'basica', 68),
  ('Aseguradoras son sector:', ARRAY['Bancario', 'Bursátil', 'No bancario', 'Público'], 'C', 'Las aseguradoras pertenecen al sector no bancario', 'basica', 69),
  ('La CNSF supervisa:', ARRAY['Bancos', 'Aseguradoras y agentes', 'Casas de bolsa', 'AFORES'], 'B', 'La CNSF supervisa aseguradoras, afianzadoras y agentes', 'basica', 70),
  ('CNBV regula:', ARRAY['Seguros', 'Fianzas', 'Bancos y valores', 'Hospitales'], 'C', 'La CNBV regula bancos y el mercado de valores', 'intermedia', 71),
  ('CONSAR supervisa:', ARRAY['Bancos', 'Aseguradoras', 'AFORES', 'Casas de cambio'], 'C', 'CONSAR supervisa el sistema de ahorro para el retiro', 'intermedia', 72),
  ('Banca múltiple:', ARRAY['No capta', 'Otorga créditos', 'Regula', 'Vende seguros'], 'B', 'La banca múltiple capta depósitos y otorga créditos', 'intermedia', 73),
  ('Mercado bursátil permite:', ARRAY['Protección', 'Inversión', 'Emisión moneda', 'Siniestros'], 'B', 'El mercado bursátil facilita el financiamiento e inversión', 'intermedia', 74),
  ('Inflación es:', ARRAY['Ahorro', 'Aumento general de precios', 'Estabilidad', 'Deflación'], 'B', 'La inflación es el incremento generalizado de precios', 'basica', 75),
  ('Inflación afecta porque:', ARRAY['Reduce coberturas', 'Reduce poder adquisitivo', 'Elimina deducibles', 'Baja primas'], 'B', 'La inflación reduce el poder adquisitivo del dinero', 'intermedia', 76),
  ('Interés es:', ARRAY['Impuesto', 'Precio del dinero', 'Prima', 'Riesgo'], 'B', 'El interés es el precio o costo del dinero en el tiempo', 'basica', 77),
  ('Tasa de interés se expresa en:', ARRAY['Pesos', 'Días', 'Porcentaje', 'Años'], 'C', 'La tasa de interés se expresa en porcentaje', 'basica', 78),
  ('SOFOMES pertenecen a:', ARRAY['Bancario', 'Auxiliar de crédito', 'Bursátil', 'Público'], 'B', 'Las SOFOMES son entidades auxiliares de crédito', 'intermedia', 79),
  ('Objetivo del sistema financiero:', ARRAY['Controlar agentes', 'Estabilidad económica', 'Eliminar riesgos', 'Utilidades'], 'B', 'El objetivo es mantener la estabilidad económica', 'intermedia', 80)
) AS t(pregunta, opciones, respuesta, explicacion, dificultad, orden);