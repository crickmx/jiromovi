/*
  # Insertar Exámenes de Práctica - Módulos 3 y 4

  1. Crear exámenes de práctica para Módulos 3 y 4
  2. Insertar 25 preguntas por cada módulo
  3. Formato: 4 opciones (A, B, C, D)
  4. Nivel CNSF oficial
*/

-- ============================================================================
-- MÓDULO 3: RIESGOS INDIVIDUALES DEL SEGURO DE DAÑOS (AUTOMÓVILES)
-- ============================================================================

-- Crear examen de práctica Módulo 3
INSERT INTO cedula_a_examenes (
  titulo,
  descripcion,
  tipo,
  modulo_id,
  duracion_referencia_minutos,
  puntaje_minimo_aprobacion,
  orden,
  instrucciones,
  activo
) VALUES (
  'Examen de Práctica - Módulo 3: Riesgos Individuales - Daños',
  'Evalúa tu comprensión del seguro de automóviles, coberturas, procedimientos de siniestros y conceptos clave del ramo de daños.',
  'practica',
  (SELECT id FROM cedula_a_modulos WHERE orden = 3),
  45,
  70,
  3,
  'Lee cuidadosamente cada pregunta. Considera las coberturas, exclusiones y procedimientos correctos del seguro de automóviles.',
  true
);

-- Insertar preguntas Módulo 3 (51-75)
INSERT INTO cedula_a_preguntas (examen_id, pregunta, opciones, respuesta_correcta, explicacion, dificultad, orden)
SELECT 
  (SELECT id FROM cedula_a_examenes WHERE titulo LIKE '%Módulo 3%'),
  pregunta,
  to_jsonb(opciones),
  respuesta,
  explicacion,
  dificultad,
  orden
FROM (VALUES
  ('El seguro de daños tiene como finalidad principal:', ARRAY['Generar ahorro', 'Proteger personas', 'Proteger el patrimonio', 'Otorgar créditos'], 'C', 'El seguro de daños protege bienes y patrimonio, a diferencia del seguro de personas', 'basica', 51),
  ('El principio fundamental del seguro de daños es:', ARRAY['Buena fe', 'Solidaridad', 'Indemnización', 'Capitalización'], 'C', 'El seguro de daños es indemnizatorio: busca resarcir la pérdida económica', 'basica', 52),
  ('El seguro de automóviles pertenece a la operación de:', ARRAY['Vida', 'Accidentes', 'Daños', 'Salud'], 'C', 'Automóviles es un ramo de la operación de daños', 'basica', 53),
  ('La cobertura de daños materiales cubre:', ARRAY['Lesiones del conductor', 'Daños al vehículo asegurado', 'Multas', 'Robo de autopartes'], 'B', 'Daños materiales protege el vehículo asegurado contra colisión y volcadura', 'basica', 54),
  ('El robo total se refiere a:', ARRAY['Robo de llantas', 'Robo de autopartes', 'Desaparición completa del vehículo', 'Daños por vandalismo'], 'C', 'Robo total es cuando el vehículo desaparece completamente y no se recupera', 'basica', 55),
  ('La Responsabilidad Civil cubre:', ARRAY['Daños al vehículo asegurado', 'Daños causados a terceros', 'Multas de tránsito', 'Robo del vehículo'], 'B', 'RC cubre los daños que el asegurado cause a terceros', 'basica', 56),
  ('La cobertura de gastos médicos a ocupantes cubre:', ARRAY['Enfermedades', 'Lesiones derivadas de un accidente automovilístico', 'Atención preventiva', 'Hospitalización general'], 'B', 'Cubre gastos médicos solo por lesiones del accidente automovilístico', 'intermedia', 57),
  ('Para que proceda un siniestro, el asegurado debe:', ARRAY['Reparar el vehículo', 'Avisar oportunamente', 'Vender el vehículo', 'Cambiar la póliza'], 'B', 'El aviso oportuno es obligación fundamental del asegurado', 'basica', 58),
  ('El plazo general para avisar un siniestro es de:', ARRAY['24 horas', '3 días', '5 días naturales', '10 días'], 'C', 'Generalmente se deben avisar siniestros dentro de 5 días naturales', 'intermedia', 59),
  ('El asegurado NO debe:', ARRAY['Cooperar con la aseguradora', 'Proporcionar información', 'Admitir responsabilidad sin autorización', 'Avisar a la autoridad'], 'C', 'Nunca se debe admitir responsabilidad sin autorización de la aseguradora', 'intermedia', 60),
  ('Se considera pérdida total cuando el daño supera:', ARRAY['40%', '50%', '75%', '90%'], 'C', 'Generalmente se considera pérdida total cuando el daño supera el 75% del valor', 'intermedia', 61),
  ('La pérdida parcial ocurre cuando el daño es:', ARRAY['Mayor al 75%', 'Menor al 50%', 'Igual al valor comercial', 'Totalmente irreparable'], 'B', 'Pérdida parcial es cuando el daño es reparable y menor al umbral de pérdida total', 'intermedia', 62),
  ('El demérito se aplica por:', ARRAY['Antigüedad y desgaste', 'Accidente', 'Robo', 'Multa'], 'A', 'El demérito refleja la depreciación por antigüedad y uso del vehículo', 'intermedia', 63),
  ('La subrogación permite a la aseguradora:', ARRAY['Cancelar la póliza', 'Cobrar primas', 'Reclamar a terceros responsables', 'Aumentar deducibles'], 'C', 'La subrogación permite a la aseguradora recuperar lo pagado del tercero responsable', 'intermedia', 64),
  ('Los salvamentos corresponden a:', ARRAY['El asegurado', 'El agente', 'La aseguradora', 'El taller'], 'C', 'Los restos del vehículo (salvamentos) pasan a propiedad de la aseguradora tras pagar pérdida total', 'intermedia', 65),
  ('Para robo total es indispensable presentar:', ARRAY['Licencia vigente', 'Acta ante el Ministerio Público', 'Presupuesto del taller', 'Reporte médico'], 'B', 'El robo debe reportarse al Ministerio Público para proceder la reclamación', 'intermedia', 66),
  ('La licencia del conductor debe ser:', ARRAY['Opcional', 'Vigente', 'Internacional', 'De cualquier tipo'], 'B', 'La licencia vigente es requisito para la validez de la cobertura', 'basica', 67),
  ('Si el conductor no tiene licencia, la aseguradora:', ARRAY['Siempre paga', 'Nunca investiga', 'Puede rechazar el siniestro', 'Duplica el deducible'], 'C', 'Conducir sin licencia es causal de rechazo del siniestro', 'intermedia', 68),
  ('La póliza de flotilla cubre:', ARRAY['Un solo vehículo', 'Dos o más vehículos', 'Solo autos particulares', 'Solo autos nuevos'], 'B', 'Las flotillas cubren múltiples vehículos bajo una sola póliza', 'basica', 69),
  ('El seguro de automóviles protege contra:', ARRAY['Riesgos financieros', 'Riesgos patrimoniales', 'Riesgos médicos', 'Riesgos fiscales'], 'B', 'Es un seguro de daños que protege el patrimonio', 'basica', 70),
  ('El valor comercial se determina con base en:', ARRAY['Precio de agencia', 'Valor de mercado', 'Valor sentimental', 'Valor fiscal'], 'B', 'El valor comercial se basa en el precio real de mercado del vehículo', 'intermedia', 71),
  ('El deducible en automóviles se aplica en:', ARRAY['Responsabilidad civil', 'Daños materiales', 'Gastos médicos', 'Asistencia vial'], 'B', 'El deducible aplica principalmente en la cobertura de daños materiales', 'intermedia', 72),
  ('La cobertura obligatoria por ley es:', ARRAY['Daños materiales', 'Robo total', 'Responsabilidad civil', 'Gastos médicos'], 'C', 'La RC es obligatoria por ley en todo el país', 'basica', 73),
  ('El aviso a autoridades es obligatorio cuando hay:', ARRAY['Solo daños materiales', 'Lesionados o daños a terceros', 'Falla mecánica', 'Robo parcial'], 'B', 'Se debe avisar a autoridades cuando hay lesionados o daños a terceros', 'intermedia', 74),
  ('El objetivo del seguro de automóviles es:', ARRAY['Reparar siempre', 'Indemnizar conforme a contrato', 'Evitar accidentes', 'Financiar vehículos'], 'B', 'El seguro indemniza conforme a las coberturas contratadas', 'basica', 75)
) AS t(pregunta, opciones, respuesta, explicacion, dificultad, orden);

-- ============================================================================
-- MÓDULO 4: SISTEMAS Y MERCADOS FINANCIEROS
-- ============================================================================

-- Crear examen de práctica Módulo 4
INSERT INTO cedula_a_examenes (
  titulo,
  descripcion,
  tipo,
  modulo_id,
  duracion_referencia_minutos,
  puntaje_minimo_aprobacion,
  orden,
  instrucciones,
  activo
) VALUES (
  'Examen de Práctica - Módulo 4: Sistemas y Mercados Financieros',
  'Evalúa tu comprensión del sistema financiero mexicano, sus autoridades, sectores y el papel del seguro en la economía.',
  'practica',
  (SELECT id FROM cedula_a_modulos WHERE orden = 4),
  45,
  70,
  4,
  'Lee cuidadosamente cada pregunta. Identifica las autoridades, funciones y características del sistema financiero.',
  true
);

-- Insertar preguntas Módulo 4 (76-100)
INSERT INTO cedula_a_preguntas (examen_id, pregunta, opciones, respuesta_correcta, explicacion, dificultad, orden)
SELECT 
  (SELECT id FROM cedula_a_examenes WHERE titulo LIKE '%Módulo 4%'),
  pregunta,
  to_jsonb(opciones),
  respuesta,
  explicacion,
  dificultad,
  orden
FROM (VALUES
  ('El Sistema Financiero se encarga de:', ARRAY['Emitir pólizas', 'Canalizar el ahorro', 'Vender seguros', 'Fijar primas'], 'B', 'El sistema financiero canaliza el ahorro hacia la inversión productiva', 'basica', 76),
  ('La máxima autoridad del sistema financiero es:', ARRAY['BANXICO', 'CNSF', 'SHCP', 'CNBV'], 'C', 'La SHCP es la máxima autoridad del sistema financiero mexicano', 'basica', 77),
  ('El Banco de México tiene como función principal:', ARRAY['Autorizar agentes', 'Emitir moneda', 'Cobrar impuestos', 'Vender seguros'], 'B', 'Banxico es el banco central encargado de emitir moneda', 'basica', 78),
  ('Las aseguradoras pertenecen al sector:', ARRAY['Bancario', 'Bursátil', 'No bancario', 'Público'], 'C', 'Las aseguradoras forman parte del sector financiero no bancario', 'basica', 79),
  ('La CNSF supervisa principalmente:', ARRAY['Bancos', 'Aseguradoras y agentes', 'Casas de bolsa', 'AFORES'], 'B', 'La CNSF supervisa a aseguradoras, afianzadoras y sus agentes', 'basica', 80),
  ('La CNBV regula:', ARRAY['Seguros', 'Fianzas', 'Bancos y mercado de valores', 'Hospitales'], 'C', 'La CNBV supervisa bancos, casas de bolsa y mercado de valores', 'intermedia', 81),
  ('La CONSAR supervisa:', ARRAY['Bancos', 'Aseguradoras', 'AFORES', 'Casas de cambio'], 'C', 'La CONSAR supervisa el sistema de ahorro para el retiro (AFORES)', 'intermedia', 82),
  ('El sector bancario se divide en:', ARRAY['Público y privado', 'Vida y daños', 'Banca múltiple y de desarrollo', 'Nacional e internacional'], 'C', 'El sector bancario se divide en banca múltiple y banca de desarrollo', 'intermedia', 83),
  ('La banca múltiple se caracteriza por:', ARRAY['No captar depósitos', 'Otorgar créditos al público', 'Vender seguros', 'Regular mercados'], 'B', 'La banca múltiple capta depósitos y otorga créditos al público en general', 'intermedia', 84),
  ('El sector bursátil permite principalmente:', ARRAY['Protección patrimonial', 'Financiamiento e inversión', 'Emisión de moneda', 'Pago de siniestros'], 'B', 'El mercado bursátil facilita el financiamiento y la inversión mediante valores', 'intermedia', 85),
  ('Las AFORES administran recursos para:', ARRAY['Gastos médicos', 'Vivienda', 'Retiro', 'Educación'], 'C', 'Las AFORES administran los ahorros para el retiro de los trabajadores', 'basica', 86),
  ('El seguro contribuye al sistema financiero porque:', ARRAY['Genera inflación', 'Reduce riesgos económicos', 'Sustituye al crédito', 'Elimina impuestos'], 'B', 'El seguro reduce riesgos y aporta estabilidad al sistema económico', 'intermedia', 87),
  ('La inflación se define como:', ARRAY['Aumento del ahorro', 'Incremento generalizado de precios', 'Reducción de tasas', 'Estabilidad monetaria'], 'B', 'La inflación es el incremento sostenido y generalizado de precios', 'basica', 88),
  ('La inflación afecta al seguro porque:', ARRAY['Reduce coberturas', 'Aumenta riesgos', 'Reduce el poder adquisitivo', 'Elimina deducibles'], 'C', 'La inflación reduce el valor real de las sumas aseguradas', 'intermedia', 89),
  ('El interés es:', ARRAY['Un impuesto', 'El precio del dinero', 'Un seguro', 'Un siniestro'], 'B', 'El interés es el precio o costo de usar dinero en el tiempo', 'basica', 90),
  ('La tasa de interés se expresa generalmente en:', ARRAY['Pesos', 'Años', 'Porcentaje', 'Días'], 'C', 'Las tasas de interés se expresan en porcentaje', 'basica', 91),
  ('El sistema financiero busca principalmente:', ARRAY['Controlar agentes', 'Estabilidad económica', 'Eliminar riesgos', 'Generar utilidades'], 'B', 'El objetivo del sistema financiero es la estabilidad y crecimiento económico', 'intermedia', 92),
  ('Las SOFOMES pertenecen al sector:', ARRAY['Bancario', 'Auxiliar de crédito', 'Bursátil', 'Público'], 'B', 'Las SOFOMES son entidades financieras auxiliares de crédito', 'intermedia', 93),
  ('Las casas de bolsa operan en el mercado:', ARRAY['Asegurador', 'Bancario', 'Bursátil', 'Médico'], 'C', 'Las casas de bolsa operan en el mercado bursátil o de valores', 'basica', 94),
  ('El ahorro se canaliza principalmente hacia:', ARRAY['Consumo', 'Inversión', 'Gasto corriente', 'Impuestos'], 'B', 'El sistema financiero canaliza el ahorro hacia inversiones productivas', 'basica', 95),
  ('El seguro ayuda a la economía porque:', ARRAY['Elimina accidentes', 'Protege inversiones', 'Reduce impuestos', 'Aumenta primas'], 'B', 'El seguro protege inversiones y fomenta la actividad económica', 'intermedia', 96),
  ('BANXICO busca mantener:', ARRAY['El crecimiento del PIB', 'La estabilidad de precios', 'El empleo', 'La rentabilidad bancaria'], 'B', 'El objetivo principal de Banxico es mantener la estabilidad de precios', 'intermedia', 97),
  ('El sector no bancario incluye:', ARRAY['Bancos', 'Aseguradoras', 'Casas de bolsa', 'SHCP'], 'B', 'Las aseguradoras y afianzadoras forman parte del sector no bancario', 'basica', 98),
  ('El mercado financiero conecta:', ARRAY['Asegurados y médicos', 'Ahorro e inversión', 'Bancos y seguros', 'Agentes y clientes'], 'B', 'Los mercados financieros conectan a quienes ahorran con quienes necesitan recursos', 'intermedia', 99),
  ('El sistema financiero existe para:', ARRAY['Vender productos', 'Proteger usuarios', 'Facilitar el flujo del dinero', 'Controlar mercados'], 'C', 'El sistema financiero facilita el flujo eficiente del dinero en la economía', 'intermedia', 100)
) AS t(pregunta, opciones, respuesta, explicacion, dificultad, orden);