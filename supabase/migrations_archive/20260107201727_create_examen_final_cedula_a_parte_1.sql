/*
  # Crear Examen Final Integrado - Cédula A (Parte 1)

  1. Crear examen final tipo "final"
  2. Insertar preguntas 1-40 (Módulos 1 y 2)
  3. Estructura CNSF oficial
  4. Duración: 120 minutos
  5. Aprobación: 70%
*/

-- Crear examen final integrado
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
  'Examen Final - Simulador Cédula A (100 preguntas)',
  'Examen integrado que evalúa todos los conocimientos del curso. Formato oficial CNSF con 100 preguntas de opción múltiple.',
  'final',
  (SELECT id FROM cedula_a_modulos WHERE orden = 6),
  120,
  70,
  100,
  'Este es el examen final integrado. Lee cuidadosamente cada pregunta. Tienes 120 minutos para completar 100 preguntas. Se requiere 70% para aprobar. Responde con calma y revisa tus respuestas antes de finalizar.',
  true
);

-- ============================================================================
-- MÓDULO 1: ASPECTOS GENERALES (Preguntas 1-20)
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
  ('La actividad aseguradora en México es:', ARRAY['Privada sin regulación', 'Bancaria', 'De interés público', 'Opcional'], 'C', 'La actividad aseguradora es de interés público y está regulada por el Estado', 'basica', 1),
  ('Autoridad que supervisa a agentes:', ARRAY['SHCP', 'CONDUSEF', 'CNSF', 'CNBV'], 'C', 'La CNSF es la autoridad que supervisa a aseguradoras y agentes', 'basica', 2),
  ('La LISF regula principalmente:', ARRAY['El contrato individual', 'Aseguradoras y agentes', 'Servicios médicos', 'Bancos'], 'B', 'La Ley de Instituciones de Seguros y Fianzas regula aseguradoras y agentes', 'basica', 3),
  ('La LSCS regula:', ARRAY['Operación de instituciones', 'Relación asegurado–aseguradora', 'Sanciones a agentes', 'Mercado bursátil'], 'B', 'La Ley Sobre el Contrato de Seguro regula la relación contractual', 'basica', 4),
  ('El RASF regula:', ARRAY['Usuarios', 'Médicos', 'Agentes', 'Bancos'], 'C', 'El Reglamento de Agentes de Seguros y Fianzas regula a los agentes', 'basica', 5),
  ('La CONDUSEF protege al:', ARRAY['Agente', 'Ajustador', 'Usuario', 'Banco'], 'C', 'CONDUSEF protege los derechos de los usuarios de servicios financieros', 'basica', 6),
  ('¿Cuál NO es autoridad financiera?', ARRAY['SHCP', 'BANXICO', 'CNSF', 'PROFECO'], 'D', 'PROFECO es autoridad de protección al consumidor, no financiera', 'basica', 7),
  ('El agente actúa como:', ARRAY['Representante legal de la aseguradora', 'Representante técnico del cliente', 'Ajustador', 'Auditor'], 'B', 'El agente representa técnicamente al cliente ante la aseguradora', 'intermedia', 8),
  ('Es obligación del agente:', ARRAY['Garantizar pagos', 'Informar correctamente el riesgo', 'Modificar tarifas', 'Alterar documentos'], 'B', 'El agente debe informar correctamente el riesgo a la aseguradora', 'basica', 9),
  ('Cobrar primas sin recibo es:', ARRAY['Permitido', 'Opcional', 'Prohibido', 'Recomendado'], 'C', 'Está prohibido cobrar primas sin entregar recibo oficial', 'basica', 10),
  ('Vigencia de autorización definitiva del agente independiente:', ARRAY['1 año', '2 años', '3 años', 'Indefinida'], 'C', 'La autorización definitiva tiene vigencia de 3 años renovables', 'intermedia', 11),
  ('El agente vinculado tiene autorización:', ARRAY['Definitiva', 'Provisional', 'Vitalicia', 'Permanente'], 'B', 'Los agentes vinculados tienen autorización provisional', 'intermedia', 12),
  ('Sanción aplicable al agente:', ARRAY['Prisión automática', 'Multa', 'Clausura', 'Embargo'], 'B', 'Las multas son una de las sanciones administrativas aplicables', 'basica', 13),
  ('Revocación implica:', ARRAY['Suspensión', 'Cancelación definitiva', 'Multa', 'Amonestación'], 'B', 'La revocación es la cancelación definitiva de la autorización', 'intermedia', 14),
  ('Cancelación administrativa ocurre por:', ARRAY['Falta leve', 'Multa', 'Muerte', 'Reclamación'], 'C', 'La muerte del agente causa cancelación administrativa automática', 'intermedia', 15),
  ('Las aseguradoras operan solo ramos:', ARRAY['Libres', 'Autorizados', 'Internacionales', 'Bancarios'], 'B', 'Las aseguradoras solo pueden operar ramos autorizados por CNSF', 'basica', 16),
  ('Vida pertenece a la operación de:', ARRAY['Daños', 'Accidentes', 'Vida', 'Salud'], 'C', 'Vida es una operación independiente en el sistema asegurador', 'basica', 17),
  ('NO es ramo de daños:', ARRAY['Automóviles', 'Incendio', 'RC', 'Vida'], 'D', 'Vida no pertenece a la operación de daños', 'basica', 18),
  ('Seguro obligatorio del agente:', ARRAY['Vida', 'Autos', 'RC profesional', 'GMM'], 'C', 'Los agentes deben tener seguro de RC profesional obligatoriamente', 'intermedia', 19),
  ('Objetivo de la regulación:', ARRAY['Limitar ventas', 'Proteger al usuario', 'Generar utilidades', 'Control fiscal'], 'B', 'El objetivo principal es proteger los intereses del usuario', 'basica', 20)
) AS t(pregunta, opciones, respuesta, explicacion, dificultad, orden);

-- ============================================================================
-- MÓDULO 2: SEGURO DE PERSONAS (Preguntas 21-40)
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
  ('El seguro de personas protege:', ARRAY['Bienes', 'Personas', 'Empresas', 'Inversiones'], 'B', 'El seguro de personas protege la integridad física y económica de las personas', 'basica', 21),
  ('Incluye la operación A&E:', ARRAY['Vida', 'AP, GMM y Salud', 'Daños', 'Pensiones'], 'B', 'La operación de Accidentes y Enfermedades incluye AP, GMM y Salud', 'basica', 22),
  ('Un accidente debe ser:', ARRAY['Súbito', 'Fortuito', 'Violento', 'Todas'], 'D', 'Un accidente debe ser súbito, fortuito y violento', 'intermedia', 23),
  ('AP cubre:', ARRAY['Enfermedades', 'Accidentes', 'Prevención', 'Partos'], 'B', 'Accidentes Personales cubre únicamente accidentes, no enfermedades', 'basica', 24),
  ('Exclusión común en AP:', ARRAY['Muerte accidental', 'Pérdida orgánica', 'Enfermedad', 'Incapacidad'], 'C', 'Las enfermedades están excluidas en AP', 'basica', 25),
  ('Indemnización en AP se basa en:', ARRAY['Gasto real', 'Tabla', 'Copago', 'Reembolso'], 'B', 'AP indemniza según tabla de pérdidas orgánicas', 'intermedia', 26),
  ('Objetivo del GMM:', ARRAY['Prevenir', 'Cubrir gastos elevados', 'Indemnizar fijo', 'Ahorrar'], 'B', 'GMM protege contra gastos médicos mayores elevados', 'basica', 27),
  ('Deducible es:', ARRAY['Porcentaje', 'Monto fijo', 'Copago', 'Prima'], 'B', 'El deducible es un monto fijo que paga el asegurado antes de la cobertura', 'basica', 28),
  ('Coaseguro es:', ARRAY['Monto fijo', 'Porcentaje compartido', 'Copago', 'Prima'], 'B', 'El coaseguro es un porcentaje que comparte el asegurado después del deducible', 'intermedia', 29),
  ('Tope de coaseguro limita:', ARRAY['Prima', 'Deducible', 'Máximo a pagar', 'Suma'], 'C', 'El tope de coaseguro limita el monto máximo que pagará el asegurado', 'intermedia', 30),
  ('Pago directo se usa con:', ARRAY['Reembolso', 'Red médica', 'Copago', 'Ajustador'], 'B', 'El pago directo opera cuando se usa la red médica contratada', 'basica', 31),
  ('Reembolso implica:', ARRAY['Pago inmediato', 'Paga primero el asegurado', 'Copago', 'Indemnización fija'], 'B', 'En reembolso, el asegurado paga primero y luego solicita el reembolso', 'basica', 32),
  ('Plazo para dictaminar reembolso:', ARRAY['15 días', '20 días', '30 días naturales', '60 días'], 'C', 'La aseguradora tiene 30 días naturales para dictaminar', 'intermedia', 33),
  ('Seguro de salud es de:', ARRAY['Indemnización', 'Servicios', 'Ahorro', 'Vida'], 'B', 'El seguro de salud proporciona servicios médicos, no indemnización', 'basica', 34),
  ('Copago es propio de:', ARRAY['AP', 'GMM', 'Salud', 'Vida'], 'C', 'El copago es característico de los seguros de salud', 'intermedia', 35),
  ('Beneficiarios pueden cambiarse:', ARRAY['Nunca', 'Con autorización', 'En cualquier momento', 'Al contratar'], 'C', 'El contratante puede cambiar beneficiarios en cualquier momento', 'basica', 36),
  ('Aviso del siniestro debe darse:', ARRAY['Al final', 'Cuando convenga', 'Al tener conocimiento', 'Nunca'], 'C', 'El aviso debe darse inmediatamente al tener conocimiento', 'basica', 37),
  ('Omitir aviso puede causar:', ARRAY['Multa', 'Rechazo', 'Aumento prima', 'Cancelación'], 'B', 'Omitir el aviso oportuno puede causar rechazo del siniestro', 'intermedia', 38),
  ('GMM cubre honorarios de:', ARRAY['Cualquiera', 'Médicos titulados', 'Donativos', 'Beneficencia'], 'B', 'Solo se cubren honorarios de médicos legalmente autorizados', 'basica', 39),
  ('Objetivo del seguro de personas:', ARRAY['Utilidades', 'Proteger integridad y economía', 'Financiar hospitales', 'Impuestos'], 'B', 'Protege la integridad física y estabilidad económica de las personas', 'basica', 40)
) AS t(pregunta, opciones, respuesta, explicacion, dificultad, orden);