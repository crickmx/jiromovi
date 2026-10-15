/*
  # Insertar Exámenes y Reactivos para Módulos 1 y 2

  1. Crear exámenes de práctica para Módulos 1 y 2
  2. Insertar 25 reactivos para Módulo 1 (Aspectos Generales)
  3. Insertar 25 reactivos para Módulo 2 (Seguros de Personas)
  
  Nota: Usa valores correctos de dificultad: basica, intermedia, avanzada, trampa
*/

-- Primero, eliminar exámenes y preguntas existentes de estos módulos si existen
DELETE FROM cedula_a_preguntas 
WHERE modulo_referencia_id IN (
  SELECT id FROM cedula_a_modulos WHERE orden IN (1, 2)
);

DELETE FROM cedula_a_examenes 
WHERE modulo_id IN (
  SELECT id FROM cedula_a_modulos WHERE orden IN (1, 2)
) AND tipo = 'practica';

-- Variables para los IDs
DO $$
DECLARE
  examen_m1_id uuid;
  examen_m2_id uuid;
  modulo_1_id uuid := 'c2dc8492-bd34-48be-ad4b-bd3c782e35b5';
  modulo_2_id uuid := 'd25ace33-5246-4a96-9e4f-12fe7418e8f3';
BEGIN
  -- Crear examen para Módulo 1
  INSERT INTO cedula_a_examenes (
    modulo_id,
    titulo,
    descripcion,
    duracion_referencia_minutos,
    puntaje_minimo_aprobacion,
    tipo,
    orden,
    activo
  )
  VALUES (
    modulo_1_id,
    'Examen de Práctica - Módulo 1: Aspectos Generales del Seguro',
    'Evaluación de conocimientos sobre marco legal, autoridades, tipos de agentes y operación del seguro en México.',
    45,
    70,
    'practica',
    1,
    true
  )
  RETURNING id INTO examen_m1_id;

  -- Insertar 25 reactivos Módulo 1
  INSERT INTO cedula_a_preguntas (examen_id, modulo_referencia_id, pregunta, opciones, respuesta_correcta, explicacion, dificultad, orden) VALUES
  (examen_m1_id, modulo_1_id, 'La actividad aseguradora en México se considera:', 
   '["Actividad mercantil privada", "Actividad bancaria", "Actividad de interés público", "Actividad opcional del Estado"]', 
   'C', 'La actividad aseguradora está reconocida como de interés público por su función de protección social.', 'intermedia', 1),
  
  (examen_m1_id, modulo_1_id, 'La autoridad que aplica el examen de Cédula A es:', 
   '["SHCP", "CONDUSEF", "CNSF", "CNBV"]', 
   'C', 'La CNSF (Comisión Nacional de Seguros y Fianzas) es la autoridad responsable de certificar agentes.', 'basica', 2),
  
  (examen_m1_id, modulo_1_id, 'La LISF regula principalmente:', 
   '["El contrato individual del seguro", "La operación de aseguradoras y agentes", "La atención médica", "El mercado bursátil"]', 
   'B', 'La Ley de Instituciones de Seguros y Fianzas regula la operación del sector asegurador.', 'intermedia', 3),
  
  (examen_m1_id, modulo_1_id, 'La relación contractual entre asegurado y aseguradora se rige por:', 
   '["Código Fiscal", "LISF", "LSCS", "RASF"]', 
   'C', 'La Ley Sobre el Contrato de Seguro (LSCS) regula la relación contractual.', 'intermedia', 4),
  
  (examen_m1_id, modulo_1_id, 'El Reglamento de Agentes de Seguros regula:', 
   '["A los usuarios", "A los médicos", "A los agentes de seguros", "A los bancos"]', 
   'C', 'El RASF establece las normas específicas para agentes de seguros.', 'basica', 5),
  
  (examen_m1_id, modulo_1_id, 'La CONDUSEF tiene como función principal:', 
   '["Autorizar agentes", "Proteger a las aseguradoras", "Proteger al usuario", "Emitir pólizas"]', 
   'C', 'CONDUSEF es el organismo de protección y defensa de los usuarios de servicios financieros.', 'basica', 6),
  
  (examen_m1_id, modulo_1_id, '¿Cuál NO es una autoridad financiera?', 
   '["SHCP", "CNSF", "BANXICO", "PROFECO"]', 
   'D', 'PROFECO es autoridad de protección al consumidor, no del sector financiero.', 'intermedia', 7),
  
  (examen_m1_id, modulo_1_id, 'El agente de seguros actúa principalmente como:', 
   '["Representante legal de la aseguradora", "Representante técnico del cliente", "Ajustador", "Auditor"]', 
   'B', 'El agente representa técnicamente los intereses del cliente ante la aseguradora.', 'intermedia', 8),
  
  (examen_m1_id, modulo_1_id, 'Una obligación del agente es:', 
   '["Garantizar pagos", "Alterar tarifas", "Informar correctamente el riesgo", "Modificar contratos"]', 
   'C', 'El agente debe informar veraz y completamente sobre el riesgo y las características del seguro.', 'intermedia', 9),
  
  (examen_m1_id, modulo_1_id, 'Cobrar primas sin recibo oficial está:', 
   '["Permitido", "Recomendado", "Prohibido", "Regulado por el cliente"]', 
   'C', 'Es una prohibición expresa para evitar fraudes y proteger al usuario.', 'basica', 10),
  
  (examen_m1_id, modulo_1_id, 'La vigencia de la autorización definitiva del agente independiente es:', 
   '["1 año", "2 años", "3 años", "Indefinida"]', 
   'C', 'La autorización definitiva tiene vigencia de 3 años renovables.', 'intermedia', 11),
  
  (examen_m1_id, modulo_1_id, 'El agente vinculado tiene autorización:', 
   '["Definitiva", "Provisional", "Permanente", "Vitalicia"]', 
   'B', 'Los agentes vinculados a una aseguradora tienen autorización provisional.', 'intermedia', 12),
  
  (examen_m1_id, modulo_1_id, 'Una sanción aplicable al agente es:', 
   '["Embargo inmediato", "Multa", "Prisión automática", "Clausura del domicilio"]', 
   'B', 'La multa es una de las sanciones administrativas que puede imponer la CNSF.', 'basica', 13),
  
  (examen_m1_id, modulo_1_id, 'La revocación de la cédula implica:', 
   '["Suspensión temporal", "Cancelación definitiva", "Multa", "Amonestación"]', 
   'B', 'La revocación es la cancelación definitiva de la autorización para ejercer.', 'intermedia', 14),
  
  (examen_m1_id, modulo_1_id, 'La cancelación administrativa de la cédula ocurre por:', 
   '["Multa", "Falta leve", "Muerte del agente", "Reclamación del cliente"]', 
   'C', 'Por causas administrativas como fallecimiento, la cédula se cancela automáticamente.', 'intermedia', 15),
  
  (examen_m1_id, modulo_1_id, 'Las aseguradoras solo pueden operar:', 
   '["Cualquier ramo", "Ramos autorizados", "Ramos bancarios", "Ramos internacionales"]', 
   'B', 'Solo pueden operar los ramos específicamente autorizados por la SHCP.', 'basica', 16),
  
  (examen_m1_id, modulo_1_id, 'El seguro de vida pertenece a la operación de:', 
   '["Daños", "Accidentes", "Vida", "Salud"]', 
   'C', 'El seguro de vida es un ramo específico de la operación de vida.', 'basica', 17),
  
  (examen_m1_id, modulo_1_id, '¿Cuál NO es un ramo de daños?', 
   '["Automóviles", "Incendio", "Responsabilidad civil", "Vida"]', 
   'D', 'Vida es un ramo de personas, no de daños.', 'basica', 18),
  
  (examen_m1_id, modulo_1_id, 'El agente debe contar con seguro de:', 
   '["Vida", "Automóviles", "RC profesional", "GMM"]', 
   'C', 'El seguro de Responsabilidad Civil Profesional es obligatorio para agentes.', 'intermedia', 19),
  
  (examen_m1_id, modulo_1_id, 'La CNSF puede imponer:', 
   '["Únicamente multas", "Sanciones y revocaciones", "Sentencias penales", "Embargos"]', 
   'B', 'Tiene facultades administrativas para sancionar y revocar autorizaciones.', 'intermedia', 20),
  
  (examen_m1_id, modulo_1_id, 'El seguro es una actividad regulada porque:', 
   '["Genera impuestos", "Protege al público", "Es negocio privado", "Depende de bancos"]', 
   'B', 'La regulación busca proteger el interés público y los derechos de los asegurados.', 'intermedia', 21),
  
  (examen_m1_id, modulo_1_id, 'La SHCP es:', 
   '["Autoridad operativa del agente", "Autoridad máxima financiera", "Autoridad médica", "Autoridad comercial"]', 
   'B', 'La Secretaría de Hacienda es la máxima autoridad del sistema financiero.', 'basica', 22),
  
  (examen_m1_id, modulo_1_id, 'El agente persona moral debe ser:', 
   '["Persona física", "Sociedad Anónima", "Asociación civil", "Persona extranjera"]', 
   'B', 'Solo pueden constituirse como Sociedades Anónimas.', 'intermedia', 23),
  
  (examen_m1_id, modulo_1_id, 'El agente NO puede:', 
   '["Asesorar", "Intermediar", "Alterar documentos", "Dar seguimiento"]', 
   'C', 'Alterar documentos es una prohibición expresa y causa de revocación.', 'basica', 24),
  
  (examen_m1_id, modulo_1_id, 'El objetivo principal de la regulación del seguro es:', 
   '["Generar utilidades", "Controlar agentes", "Proteger al usuario", "Limitar ventas"]', 
   'C', 'La protección del usuario es el objetivo fundamental de toda regulación.', 'intermedia', 25);

  -- Crear examen para Módulo 2
  INSERT INTO cedula_a_examenes (
    modulo_id,
    titulo,
    descripcion,
    duracion_referencia_minutos,
    puntaje_minimo_aprobacion,
    tipo,
    orden,
    activo
  )
  VALUES (
    modulo_2_id,
    'Examen de Práctica - Módulo 2: Seguros de Personas',
    'Evaluación de conocimientos sobre seguros de vida, accidentes personales, GMM y salud.',
    45,
    70,
    'practica',
    1,
    true
  )
  RETURNING id INTO examen_m2_id;

  -- Insertar 25 reactivos Módulo 2
  INSERT INTO cedula_a_preguntas (examen_id, modulo_referencia_id, pregunta, opciones, respuesta_correcta, explicacion, dificultad, orden) VALUES
  (examen_m2_id, modulo_2_id, 'El seguro de personas protege principalmente:', 
   '["Bienes", "Personas", "Empresas", "Inversiones"]', 
   'B', 'Los seguros de personas protegen la integridad física y económica de las personas.', 'basica', 26),
  
  (examen_m2_id, modulo_2_id, 'El seguro de personas se diferencia del de daños porque:', 
   '["Siempre es bancario", "No protege patrimonio", "Protege a la persona", "No paga indemnización"]', 
   'C', 'Se enfoca en proteger a la persona, no bienes materiales.', 'intermedia', 27),
  
  (examen_m2_id, modulo_2_id, 'La operación de Accidentes y Enfermedades incluye:', 
   '["Vida y salud", "AP, GMM y Salud", "Vida y daños", "Solo AP"]', 
   'B', 'Agrupa Accidentes Personales, Gastos Médicos Mayores y Salud.', 'intermedia', 28),
  
  (examen_m2_id, modulo_2_id, 'Para que exista accidente debe ser:', 
   '["Violento únicamente", "Súbito", "Fortuito", "Todas las anteriores"]', 
   'D', 'El accidente debe ser súbito, violento, externo y fortuito.', 'intermedia', 29),
  
  (examen_m2_id, modulo_2_id, 'El seguro de Accidentes Personales cubre:', 
   '["Enfermedades", "Accidentes", "Atención preventiva", "Partos"]', 
   'B', 'Solo cubre eventos derivados de accidentes, no enfermedades.', 'basica', 30),
  
  (examen_m2_id, modulo_2_id, 'Una exclusión común en AP es:', 
   '["Muerte accidental", "Pérdida orgánica", "Enfermedad", "Incapacidad"]', 
   'C', 'Las enfermedades no son cubiertas por Accidentes Personales.', 'basica', 31),
  
  (examen_m2_id, modulo_2_id, 'La indemnización en AP se basa en:', 
   '["Gasto real", "Tabla de indemnización", "Copagos", "Reembolso"]', 
   'B', 'Se paga según una tabla de porcentajes de la suma asegurada.', 'intermedia', 32),
  
  (examen_m2_id, modulo_2_id, 'El seguro de GMM tiene como objetivo:', 
   '["Prevenir enfermedades", "Cubrir gastos elevados", "Pagar indemnización fija", "Ahorrar"]', 
   'B', 'Su propósito es cubrir gastos médicos hospitalarios de alta cuantía.', 'intermedia', 33),
  
  (examen_m2_id, modulo_2_id, 'El deducible es:', 
   '["Porcentaje", "Monto fijo", "Copago", "Prima"]', 
   'B', 'Es una cantidad fija que el asegurado paga antes de que opere el seguro.', 'basica', 34),
  
  (examen_m2_id, modulo_2_id, 'El coaseguro es:', 
   '["Monto fijo", "Porcentaje compartido", "Copago", "Prima adicional"]', 
   'B', 'Es el porcentaje que el asegurado paga después del deducible.', 'basica', 35),
  
  (examen_m2_id, modulo_2_id, 'El tope de coaseguro limita:', 
   '["La prima", "El deducible", "El monto máximo a pagar", "La suma asegurada"]', 
   'C', 'Establece un límite máximo al pago del coaseguro por el asegurado.', 'intermedia', 36),
  
  (examen_m2_id, modulo_2_id, 'El pago directo se utiliza cuando:', 
   '["Hay reembolso", "Se usa red médica", "No hay hospital", "Hay copago"]', 
   'B', 'La aseguradora paga directamente al hospital dentro de su red.', 'intermedia', 37),
  
  (examen_m2_id, modulo_2_id, 'El pago por reembolso implica:', 
   '["Pago inmediato", "Pago previo del asegurado", "Copago", "Indemnización fija"]', 
   'B', 'El asegurado paga y luego solicita reembolso a la aseguradora.', 'intermedia', 38),
  
  (examen_m2_id, modulo_2_id, 'El plazo máximo para dictaminar un reembolso es:', 
   '["15 días", "20 días", "30 días naturales", "60 días"]', 
   'C', 'La aseguradora tiene 30 días naturales para resolver la solicitud.', 'intermedia', 39),
  
  (examen_m2_id, modulo_2_id, 'El seguro de salud es:', 
   '["Indemnizatorio", "Bancario", "De prestación de servicios", "De ahorro"]', 
   'C', 'Ofrece servicios médicos a través de una red de prestadores.', 'intermedia', 40),
  
  (examen_m2_id, modulo_2_id, 'El copago es propio de:', 
   '["AP", "GMM", "Salud", "Vida"]', 
   'C', 'El copago es característico de los seguros de salud.', 'intermedia', 41),
  
  (examen_m2_id, modulo_2_id, 'El seguro de salud se caracteriza por:', 
   '["Uso frecuente", "Indemnización", "Deducible alto", "Pago en efectivo"]', 
   'A', 'Se utiliza frecuentemente para consultas, estudios y medicamentos.', 'intermedia', 42),
  
  (examen_m2_id, modulo_2_id, 'Los beneficiarios pueden cambiarse:', 
   '["Nunca", "Solo con autorización", "En cualquier momento", "Solo al contratar"]', 
   'C', 'El asegurado puede cambiar beneficiarios cuando lo desee.', 'basica', 43),
  
  (examen_m2_id, modulo_2_id, 'El aviso del siniestro debe darse:', 
   '["Al final del tratamiento", "Cuando convenga", "Tan pronto se tenga conocimiento", "Solo por escrito"]', 
   'C', 'Debe avisarse a la mayor brevedad posible para no perder derechos.', 'intermedia', 44),
  
  (examen_m2_id, modulo_2_id, 'La omisión del aviso puede causar:', 
   '["Multa automática", "Rechazo del siniestro", "Aumento de prima", "Cancelación inmediata"]', 
   'B', 'No avisar oportunamente puede resultar en rechazo de la reclamación.', 'intermedia', 45),
  
  (examen_m2_id, modulo_2_id, 'El seguro de GMM cubre honorarios de:', 
   '["Cualquier persona", "Médicos titulados", "Donativos", "Instituciones benéficas"]', 
   'B', 'Solo cubre gastos de médicos legalmente autorizados.', 'basica', 46),
  
  (examen_m2_id, modulo_2_id, 'El seguro de personas puede pagar:', 
   '["Bienes", "Servicios o dinero", "Multas", "Impuestos"]', 
   'B', 'Puede indemnizar en efectivo o pagar servicios médicos directamente.', 'intermedia', 47),
  
  (examen_m2_id, modulo_2_id, 'El asegurado en vida es:', 
   '["Beneficiario", "Contratante", "Ajustador", "Médico"]', 
   'A', 'La persona cuya vida se asegura es el asegurado.', 'basica', 48),
  
  (examen_m2_id, modulo_2_id, 'El seguro de AP NO cubre:', 
   '["Muerte accidental", "Incapacidad", "Enfermedad", "Pérdidas orgánicas"]', 
   'C', 'Las enfermedades están excluidas de Accidentes Personales.', 'basica', 49),
  
  (examen_m2_id, modulo_2_id, 'El objetivo del seguro de personas es:', 
   '["Generar utilidades", "Proteger la integridad y economía del individuo", "Financiar hospitales", "Ahorrar impuestos"]', 
   'B', 'Busca proteger tanto la integridad física como la estabilidad económica.', 'intermedia', 50);

END $$;