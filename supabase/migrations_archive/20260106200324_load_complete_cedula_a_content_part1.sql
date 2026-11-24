/*
  # Complete Cédula A Course Content - Part 1
  
  ## Modules 1-4 with All Lessons
  This migration loads the first half of the complete course content.
*/

DO $$
DECLARE
  v_mod1_id uuid := gen_random_uuid();
  v_mod2_id uuid := gen_random_uuid();
  v_mod3_id uuid := gen_random_uuid();
  v_mod4_id uuid := gen_random_uuid();
BEGIN
  -- Delete existing sample data
  DELETE FROM cedula_a_lecciones WHERE modulo_id = 'a0000000-0000-0000-0000-000000000001'::uuid;
  DELETE FROM cedula_a_modulos WHERE id = 'a0000000-0000-0000-0000-000000000001'::uuid;

  -- ============================================================================
  -- MÓDULO 1: TEORÍA GENERAL DEL SEGURO
  -- ============================================================================
  INSERT INTO cedula_a_modulos (id, titulo, descripcion, orden, icono, contenido_intro, duracion_estimada_minutos)
  VALUES (
    v_mod1_id,
    'Teoría General del Seguro',
    'Fundamentos del seguro, su naturaleza jurídica, elementos esenciales y principios técnicos que rigen la actividad aseguradora.',
    1,
    'BookOpen',
    'Este módulo fundamental te introducirá a los conceptos base del seguro: su definición, historia, naturaleza jurídica, elementos del contrato y principios técnicos.',
    150
  );

  -- Módulo 1 - Lecciones
  INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos) VALUES
  (v_mod1_id, 'Concepto y Naturaleza del Seguro', '{"sections":[{"type":"titulo","content":"¿Qué es el Seguro?"},{"type":"parrafo","content":"El seguro es un mecanismo de protección mediante el cual una persona o empresa transfiere ciertos riesgos económicos a una institución especializada, a cambio del pago de una prima."},{"type":"definicion","content":"SEGURO: Contrato por el cual una parte (asegurador) se obliga, mediante una prima, a resarcir de un daño o pagar una suma de dinero al verificarse la eventualidad prevista."},{"type":"lista","content":"Características esenciales:","items":["Bilateral: obligaciones para ambas partes","Oneroso: implica contraprestaciones económicas","Aleatorio: depende de acontecimiento incierto","De adhesión: condiciones preestablecidas","Requiere buena fe"]},{"type":"alerta","content":"EXAMEN: El seguro NO es juego de azar. Se basa en cálculos actuariales. Esta diferencia es clave."}]}', 1, 30),
  (v_mod1_id, 'Historia y Evolución del Seguro', '{"sections":[{"type":"titulo","content":"Orígenes del Seguro"},{"type":"lista","content":"Hitos históricos:","items":["1750 a.C. - Código Hammurabi: préstamos a la gruesa","1347 - Primera póliza marítima en Génova","1666 - Gran Incendio de Londres","1762 - Primera compañía moderna de vida","1935 - Ley sobre Contrato de Seguro México"]},{"type":"caso_practico","content":"El Gran Incendio de Londres 1666 destruyó 13,200 casas. Nicholas Barbon fundó Fire Office, primera compañía contra incendios."},{"type":"alerta","content":"Fechas clave: 1347, 1666, 1935."}]}', 2, 25),
  (v_mod1_id, 'Elementos del Contrato', '{"sections":[{"type":"titulo","content":"Elementos Esenciales"},{"type":"definicion","content":"INTERÉS ASEGURABLE: Relación económica lícita entre asegurado y bien asegurado."},{"type":"definicion","content":"RIESGO: Evento futuro, incierto y posible que no depende de voluntad del asegurado."},{"type":"definicion","content":"PRIMA: Contraprestación económica por la cobertura."},{"type":"definicion","content":"SUMA ASEGURADA: Límite máximo de responsabilidad del asegurador."},{"type":"lista","content":"Elementos personales:","items":["ASEGURADOR: Institución autorizada","CONTRATANTE: Celebra contrato y paga prima","ASEGURADO: Su interés está protegido","BENEFICIARIO: Recibe indemnización"]},{"type":"alerta","content":"El contratante puede diferir del asegurado."}]}', 3, 35),
  (v_mod1_id, 'Principios Técnicos', '{"sections":[{"type":"definicion","content":"INDEMNIZATORIO: Resarcir daño, no enriquecer. Indemnización ≤ daño real."},{"type":"alerta","content":"Excepción: seguros de personas NO aplican este principio."},{"type":"definicion","content":"BUENA FE: Máxima honestidad de ambas partes."},{"type":"definicion","content":"SUBROGACIÓN: Al pagar, asegurador adquiere derechos contra responsables."},{"type":"definicion","content":"CONTRIBUCIÓN: Varios seguros contribuyen proporcionalmente."},{"type":"definicion","content":"CAUSA PRÓXIMA: Indemniza daño directo del riesgo cubierto."}]}', 4, 35),
  (v_mod1_id, 'La Póliza de Seguro', '{"sections":[{"type":"titulo","content":"Documento del Contrato"},{"type":"lista","content":"Contenido obligatorio:","items":["Nombre y RFC del asegurador","Datos del contratante y asegurado","Bien o persona asegurada","Riesgos cubiertos","Vigencia","Suma asegurada","Prima","Condiciones generales y particulares"]},{"type":"definicion","content":"CONDICIONES GENERALES: Cláusulas estándar del tipo de seguro."},{"type":"definicion","content":"CONDICIONES PARTICULARES: Específicas del contrato. Prevalecen sobre generales."},{"type":"alerta","content":"Particulares > Generales. Pregunta común."}]}', 5, 25);

  -- ============================================================================
  -- MÓDULO 2: TIPOS DE SEGUROS Y COBERTURAS
  -- ============================================================================
  INSERT INTO cedula_a_modulos (id, titulo, descripcion, orden, icono, contenido_intro, duracion_estimada_minutos)
  VALUES (
    v_mod2_id,
    'Tipos de Seguros y Coberturas',
    'Clasificación: seguros de daños, personas y especiales. Coberturas básicas y adicionales.',
    2,
    'Shield',
    'Conoce los diferentes tipos de seguros, características y diferencias entre seguros de daños y personas.',
    180
  );

  -- Módulo 2 - Lecciones
  INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos) VALUES
  (v_mod2_id, 'Clasificación General', '{"sections":[{"type":"definicion","content":"SEGUROS DE DAÑOS: Cubren pérdidas patrimoniales. Aplica principio indemnizatorio."},{"type":"definicion","content":"SEGUROS DE PERSONAS: Vida, salud, integridad. NO indemnizatorio, se paga suma asegurada."},{"type":"alerta","content":"Daños: indemnización ≤ daño real. Personas: se paga suma pactada."},{"type":"lista","content":"Seguros de Daños:","items":["Automóviles","Incendio","Robo","Responsabilidad Civil","Marítimo y Transporte","Agrícola"]},{"type":"lista","content":"Seguros de Personas:","items":["Vida","Accidentes Personales","Gastos Médicos Mayores","Salud"]}]}', 1, 30),
  (v_mod2_id, 'Seguros de Automóviles', '{"sections":[{"type":"titulo","content":"Seguro de Autos"},{"type":"lista","content":"Coberturas principales:","items":["RC (Responsabilidad Civil): obligatoria, daños a terceros","Daños Materiales: colisión, vuelco, robo total","Robo Total: pérdida por robo","RC Plus: aumento límite RC"]},{"type":"definicion","content":"DEDUCIBLE: Cantidad o % que paga asegurado antes de que aseguradora cubra resto."},{"type":"definicion","content":"COASEGURO: Porcentaje de participación del asegurado en cada siniestro."},{"type":"alerta","content":"RC es OBLIGATORIA por ley. Mínimo $500,000 daños a terceros."}]}', 2, 35),
  (v_mod2_id, 'Seguros de Incendio', '{"sections":[{"type":"titulo","content":"Seguro contra Incendio"},{"type":"lista","content":"Coberturas básicas:","items":["Incendio","Rayo","Explosión"]},{"type":"lista","content":"Coberturas adicionales:","items":["Huracán, ciclón, granizo","Terremoto, erupción volcánica","Rotura de cristales","Daños por humo"]},{"type":"alerta","content":"Terremoto NO está en cobertura básica. Es adicional."}]}', 3, 30),
  (v_mod2_id, 'Seguros de Vida', '{"sections":[{"type":"titulo","content":"Seguro de Vida"},{"type":"lista","content":"Tipos principales:","items":["Vida Ordinario: cobertura vitalicia","Vida Temporal: período específico","Vida Dotal: ahorro + protección","Vida Universal: flexible"]},{"type":"definicion","content":"BENEFICIARIO: Persona designada para recibir suma asegurada al fallecer asegurado."},{"type":"alerta","content":"En vida, beneficiario es revocable. El asegurado puede cambiarlo cuando quiera."}]}', 4, 35),
  (v_mod2_id, 'Gastos Médicos Mayores', '{"sections":[{"type":"titulo","content":"GMM - Gastos Médicos Mayores"},{"type":"lista","content":"Características:","items":["Cubre enfermedades y accidentes","Suma asegurada anual","Deducible por evento","Coaseguro (típicamente 10%)","Red hospitalaria"]},{"type":"definicion","content":"PREEXISTENCIA: Enfermedad o padecimiento existente antes de contratar. Generalmente excluida."},{"type":"definicion","content":"PERÍODO DE ESPERA: Tiempo desde contratación donde ciertas coberturas no aplican."},{"type":"alerta","content":"Preexistencias casi siempre excluidas. Pregunta frecuente."}]}', 5, 35),
  (v_mod2_id, 'Responsabilidad Civil', '{"sections":[{"type":"titulo","content":"Seguro de Responsabilidad Civil"},{"type":"parrafo","content":"Cubre la obligación legal de indemnizar daños causados a terceros por actos del asegurado."},{"type":"lista","content":"Tipos:","items":["RC General","RC Profesional","RC Productos","RC Empresarial"]},{"type":"alerta","content":"Solo cubre daños INVOLUNTARIOS a terceros. Actos dolosos excluidos."}]}', 6, 25);

  -- ============================================================================
  -- MÓDULO 3: MARCO LEGAL Y REGULATORIO
  -- ============================================================================
  INSERT INTO cedula_a_modulos (id, titulo, descripcion, orden, icono, contenido_intro, duracion_estimada_minutos)
  VALUES (
    v_mod3_id,
    'Marco Legal y Regulatorio',
    'Leyes, reglamentos y autoridades que regulan la actividad aseguradora en México.',
    3,
    'Scale',
    'Comprende el marco jurídico: LISF, Ley sobre Contrato de Seguro, CNSF y normativa aplicable.',
    150
  );

  -- Módulo 3 - Lecciones
  INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos) VALUES
  (v_mod3_id, 'Autoridades Reguladoras', '{"sections":[{"type":"titulo","content":"CNSF - Comisión Nacional de Seguros y Fianzas"},{"type":"parrafo","content":"Órgano desconcentrado de SHCP que supervisa y regula instituciones de seguros y fianzas."},{"type":"lista","content":"Funciones principales:","items":["Autorizar constitución de instituciones","Supervisar operaciones","Sancionar infracciones","Proteger intereses del público"]},{"type":"definicion","content":"CONDUSEF: Comisión Nacional para Defensa de Usuarios de Servicios Financieros. Protege y asesora usuarios."},{"type":"alerta","content":"CNSF regula, CONDUSEF defiende al consumidor."}]}', 1, 30),
  (v_mod3_id, 'LISF - Ley de Instituciones', '{"sections":[{"type":"titulo","content":"Ley de Instituciones de Seguros y Fianzas"},{"type":"parrafo","content":"Regula organización, funcionamiento y operación de instituciones de seguros."},{"type":"lista","content":"Aspectos clave:","items":["Autorización para operar","Tipos societarios permitidos","Requisitos de capital","Inversiones permitidas","Reservas técnicas obligatorias"]},{"type":"alerta","content":"Solo sociedades anónimas pueden ser aseguradoras en México."}]}', 2, 35),
  (v_mod3_id, 'Ley sobre Contrato de Seguro', '{"sections":[{"type":"titulo","content":"LCS - Ley del Contrato"},{"type":"parrafo","content":"Regula derechos y obligaciones derivados del contrato de seguro (1935, vigente con reformas)."},{"type":"lista","content":"Temas principales:","items":["Elementos del contrato","Obligaciones del asegurado","Obligaciones del asegurador","Pago de prima","Declaración de riesgo","Indemnización"]},{"type":"alerta","content":"Legislación supletoria: Código de Comercio, Código Civil."}]}', 3, 30),
  (v_mod3_id, 'Obligaciones del Asegurado', '{"sections":[{"type":"lista","content":"Principales obligaciones:","items":["Pagar la prima en tiempo y forma","Declarar el riesgo con veracidad","Mantener el estado del riesgo","Avisar cambios agravantes","Notificar siniestro (5 días hábiles)","Evitar/disminuir daños"]},{"type":"alerta","content":"Aviso de siniestro: máximo 5 días hábiles. Pregunta común."},{"type":"definicion","content":"AGRAVACIÓN DEL RIESGO: Cambio en circunstancias que aumentan probabilidad o magnitud del siniestro. Debe notificarse."}]}', 4, 30),
  (v_mod3_id, 'Obligaciones del Asegurador', '{"sections":[{"type":"lista","content":"Principales obligaciones:","items":["Entregar póliza (30 días)","Mantener reservas técnicas","Pagar indemnización procedente (30 días)","Informar coberturas claramente","Responder reclamaciones"]},{"type":"alerta","content":"Pago de indemnización: máximo 30 días desde documentación completa."},{"type":"parrafo","content":"Si asegurador no paga en plazo, debe pagar intereses moratorios."}]}', 5, 25);

  -- ============================================================================
  -- MÓDULO 4: PROCESO DE SUSCRIPCIÓN
  -- ============================================================================
  INSERT INTO cedula_a_modulos (id, titulo, descripcion, orden, icono, contenido_intro, duracion_estimada_minutos)
  VALUES (
    v_mod4_id,
    'Proceso de Suscripción',
    'Evaluación de riesgos, selección de asegurados, fijación de primas y emisión de pólizas.',
    4,
    'FileCheck',
    'Aprende cómo las aseguradoras evalúan riesgos, deciden aceptar o rechazar solicitudes y determinan primas.',
    120
  );

  -- Módulo 4 - Lecciones
  INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos) VALUES
  (v_mod4_id, 'Suscripción y Selección', '{"sections":[{"type":"titulo","content":"Proceso de Suscripción"},{"type":"parrafo","content":"Evaluación técnica para determinar si se acepta un riesgo y bajo qué condiciones."},{"type":"lista","content":"Etapas:","items":["Solicitud y cuestionario","Análisis de riesgo","Inspección (si aplica)","Decisión: aceptar, rechazar, modificar","Emisión de póliza"]},{"type":"definicion","content":"SELECCIÓN ADVERSA: Tendencia de personas con mayor riesgo a contratar seguros. El suscriptor debe identificarla."},{"type":"alerta","content":"Omisión dolosa en solicitud puede anular el contrato."}]}', 1, 30),
  (v_mod4_id, 'Evaluación de Riesgos', '{"sections":[{"type":"titulo","content":"Análisis de Factores"},{"type":"lista","content":"Factores evaluados:","items":["Físicos: ubicación, construcción, uso","Morales: historial, antecedentes","Económicos: capacidad de pago","Legales: cumplimiento normativo"]},{"type":"parrafo","content":"El suscriptor usa manuales de suscripción, estadísticas y experiencia profesional."},{"type":"alerta","content":"Inspección física es común en seguros de daños (incendio, empresarial)."}]}', 2, 30),
  (v_mod4_id, 'Fijación de Primas', '{"sections":[{"type":"titulo","content":"Cálculo de Prima"},{"type":"lista","content":"Componentes de la prima:","items":["Prima pura o neta: cubre siniestros esperados","Recargo de seguridad: variaciones estadísticas","Gastos de administración","Gastos de adquisición (comisiones)","Utilidad"]},{"type":"definicion","content":"PRIMA NETA: Costo actuarial del riesgo, basada en estadísticas."},{"type":"definicion","content":"PRIMA TOTAL o COMERCIAL: Prima neta + recargos + gastos."},{"type":"alerta","content":"Prima total = Prima neta + Gastos + Utilidad."}]}', 3, 30),
  (v_mod4_id, 'Emisión de Pólizas', '{"sections":[{"type":"titulo","content":"Expedición del Contrato"},{"type":"lista","content":"Documentos necesarios:","items":["Solicitud firmada","Cuestionarios completados","Inspecciones (si aplica)","Comprobante de pago de prima","Identificación oficial"]},{"type":"parrafo","content":"La póliza debe entregarse dentro de 30 días desde el pago de prima."},{"type":"alerta","content":"Sin póliza física, el contrato es válido con comprobante de pago y aceptación."}]}', 4, 30);

END $$;
