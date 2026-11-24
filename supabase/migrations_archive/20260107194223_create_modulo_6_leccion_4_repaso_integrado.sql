/*
  # Módulo 6 - Lección 6.4: Repaso Integrado por Área

  Repaso integrador que consolida los conocimientos de los módulos 1-5
*/

INSERT INTO cedula_a_lecciones (
  modulo_id,
  titulo,
  orden,
  duracion_estimada_minutos,
  contenido
)
VALUES (
  'db6a1c83-3115-49d3-8cdf-78de44baeb2e',
  'Lección 6.4 - Repaso Integrado por Área',
  4,
  60,
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LECCIÓN 6.4: REPASO INTEGRADO POR ÁREA'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐⭐⭐ LECCIÓN MÁS IMPORTANTE DEL MÓDULO: Aquí conectas TODO lo aprendido. Este repaso consolida tu preparación.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Esta lección NO introduce contenido nuevo. Su objetivo es INTEGRAR y CONSOLIDAR el conocimiento de los 5 módulos anteriores, organizándolo por las 4 ÁREAS del examen.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÁREA 1: ASPECTOS GENERALES DEL SEGURO (MÓDULO 1)'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '📚 Esta área representa 25-30% del examen. Es LA BASE de todo.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CONCEPTOS CLAVE QUE DEBES DOMINAR'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '1. Marco Jurídico (MUY preguntado):',
        'items', jsonb_build_array(
          '✓ LISF = Ley que regula seguros y fianzas',
          '✓ CNSF = Regula y supervisa a aseguradoras y agentes',
          '✓ CONDUSEF = Protege derechos de usuarios',
          '✓ SHCP = Aprueba tarifas (máxima autoridad)',
          '✓ Diferencia entre cada autoridad (pregunta frecuente)'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '2. Tipos de Agentes:',
        'items', jsonb_build_array(
          '✓ Agente Persona Física: Individual, cédula propia',
          '✓ Agente Persona Moral: Empresa de agentes',
          '✓ Apoderado: Empleado de aseguradora',
          '✓ DIFERENCIA CLAVE: Agente = independiente, Apoderado = dependiente'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '3. Obligaciones del Agente (preguntas frecuentes):',
        'items', jsonb_build_array(
          '✓ Informar COMPLETA y VERAZMENTE al cliente',
          '✓ Entregar póliza y documentos',
          '✓ Asesorar durante vigencia',
          '✓ Avisar cambios de domicilio',
          '✓ Mantener confidencialidad',
          '✓ Capacitarse continuamente',
          '✓ NO hacer publicidad engañosa'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '4. Contrato de Seguro:',
        'items', jsonb_build_array(
          '✓ Es un contrato ALEATORIO (depende de evento incierto)',
          '✓ De BUENA FE (declaración veraz obligatoria)',
          '✓ Elementos: Interés asegurable, riesgo, prima, suma asegurada',
          '✓ Póliza = documento que lo formaliza',
          '✓ Vigencia típica: 1 año (renovable)'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '5. Sanciones:',
        'items', jsonb_build_array(
          '✓ Por publicidad engañosa: suspensión o revocación',
          '✓ Por no informar correctamente: multa o suspensión',
          '✓ Por actuar sin cédula: delito',
          '✓ La CNSF puede sancionar administrativamente',
          '✓ Delitos graves: vía judicial'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'PREGUNTA TIPO EXAMEN (Área 1):\n\n¿Qué autoridad SUPERVISA el cumplimiento de las obligaciones de los agentes de seguros?\n\nA) CONDUSEF\nB) CNBV\nC) CNSF\nD) SHCP\n\nRespuesta: C (CNSF)\n\n✅ Razonamiento: La CNSF regula Y supervisa. CONDUSEF solo protege usuarios.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÁREA 2: SEGUROS DE PERSONAS (MÓDULO 2)'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🏥 Esta área representa 25-30% del examen. GMM es EL TEMA MÁS PREGUNTADO.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '1. Seguros de Vida (conceptos clave):',
        'items', jsonb_build_array(
          '✓ Temporal: Cubre solo durante plazo determinado',
          '✓ Vida Entera: Cubre toda la vida',
          '✓ Dotal: Paga al vencimiento O por muerte',
          '✓ Beneficiarios: Designados por asegurado',
          '✓ Suma asegurada: Se paga a beneficiarios'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '2. Gastos Médicos Mayores (GMM) - MUY IMPORTANTE:',
        'items', jsonb_build_array(
          '✓ Cubre gastos médicos por enfermedad o accidente',
          '✓ DEDUCIBLE: Cantidad fija que paga asegurado',
          '✓ COASEGURO: Porcentaje después del deducible',
          '✓ Tope de coaseguro: Límite al pago del asegurado',
          '✓ Red hospitalaria: Hospitales en convenio',
          '✓ Preexistencias: NO cubiertas (condición previa)',
          '✓ Periodo de espera: Tiempo antes de cobertura'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'CÁLCULO GMM (pregunta FRECUENTE):\n\nGasto: $80,000\nDeducible: $15,000\nCoaseguro: 10%\n\n¿Cuánto paga el asegurado?\n\nPaso 1: Resta deducible\n80,000 - 15,000 = 65,000\n\nPaso 2: Calcula coaseguro\n65,000 × 0.10 = 6,500\n\nPaso 3: Suma deducible + coaseguro\n15,000 + 6,500 = 21,500\n\nRespuesta: El asegurado paga $21,500'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '3. Diferencias Clave (pregunta frecuente):',
        'items', jsonb_build_array(
          'DEDUCIBLE = Cantidad FIJA (ej: $10,000)',
          'COASEGURO = PORCENTAJE (ej: 10%)',
          'COPAGO = Cantidad FIJA por servicio (ej: $250 por consulta)',
          '',
          'GMM = Gastos grandes, hospital, cirugías',
          'SALUD = Gastos menores, consultas, medicina'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '4. Accidentes Personales:',
        'items', jsonb_build_array(
          '✓ Cubre solo ACCIDENTES (no enfermedades)',
          '✓ Accidente = Súbito, violento, externo',
          '✓ Coberturas: Muerte, pérdidas orgánicas, incapacidad',
          '✓ Suma asegurada: Tabla según pérdida',
          '✓ Es más BARATO que vida (solo cubre accidentes)'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'PREGUNTA TIPO EXAMEN (Área 2):\n\nUn asegurado tiene GMM. Sufre infarto y genera gasto de $120,000. Su póliza tiene deducible $20,000 y coaseguro 10%. ¿Cuánto paga?\n\nA) $20,000\nB) $30,000\nC) $10,000\nD) $32,000\n\nRespuesta: B ($30,000)\n\nCálculo:\n120,000 - 20,000 = 100,000\n100,000 × 0.10 = 10,000\n20,000 + 10,000 = 30,000'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÁREA 3: SEGUROS DE DAÑOS (MÓDULO 3)'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '🚗 Esta área representa 20-25% del examen. AUTOMÓVILES es el ramo MÁS FRECUENTE.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '1. Coberturas Básicas de Auto (MEMORIZA):',
        'items', jsonb_build_array(
          'RC = Responsabilidad Civil (OBLIGATORIA)',
          '  → Cubre daños a TERCEROS causados por asegurado',
          '  → NO cubre el vehículo propio',
          '',
          'DM = Daños Materiales',
          '  → Cubre daños al vehículo PROPIO',
          '  → Por colisión, vuelco, etc.',
          '',
          'RT = Robo Total',
          '  → Cubre robo TOTAL del vehículo',
          '  → NO cubre robo de autopartes',
          '',
          'GM = Gastos Médicos Ocupantes',
          '  → Cubre gastos médicos de ocupantes',
          '  → Por accidente del vehículo'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '2. Pérdida Total vs Parcial (pregunta frecuente):',
        'items', jsonb_build_array(
          'PÉRDIDA TOTAL: Reparación > 75% del valor',
          '  → Se paga VALOR COMERCIAL del auto',
          '  → Se entrega el vehículo a la aseguradora',
          '',
          'PÉRDIDA PARCIAL: Reparación < 75%',
          '  → Se REPARA el vehículo',
          '  → Asegurado conserva el auto'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '3. Procedimiento de Siniestro (MUY preguntado):',
        'items', jsonb_build_array(
          'Paso 1: Avisar a la ASEGURADORA inmediatamente',
          'Paso 2: Aseguradora asigna AJUSTADOR',
          'Paso 3: Ajustador hace dictamen',
          'Paso 4: Si procede, envía a taller o paga',
          'Paso 5: Reparación o indemnización',
          '',
          '⚠️ CRÍTICO: Avisar PRIMERO a aseguradora, no al taller'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '4. Subrogación y Salvamentos:',
        'items', jsonb_build_array(
          'SUBROGACIÓN:',
          '  → Aseguradora se subroga en derechos del asegurado',
          '  → Puede demandar al tercero responsable',
          '  → Recupera lo que pagó',
          '',
          'SALVAMENTOS:',
          '  → Restos del vehículo tras pérdida total',
          '  → Pertenecen a la aseguradora',
          '  → Se venden para recuperar parte del pago'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'PREGUNTA TIPO EXAMEN (Área 3):\n\nUn asegurado choca y daña su auto y el de tercero. ¿Qué coberturas aplican?\n\nA) Solo RC\nB) RC para tercero, DM para auto propio\nC) Solo DM\nD) RT\n\nRespuesta: B\n\n✅ Razonamiento:\nRC cubre daños al TERCERO\nDM cubre daños al vehículo PROPIO\nRT no aplica (no fue robo)'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'ÁREA 4: SISTEMA FINANCIERO Y CÁLCULOS (MÓDULOS 4 y 5)'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '💰 Esta área representa 20-25% del examen. Cálculos son PUNTOS SEGUROS.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '1. Sistema Financiero Mexicano (diferencia autoridades):',
        'items', jsonb_build_array(
          'SHCP = Secretaría Hacienda (máxima autoridad)',
          'Banxico = Banco de México (política monetaria)',
          'CNBV = Supervisa bancos y valores',
          'CNSF = Supervisa seguros y fianzas',
          'CONSAR = Supervisa AFORES',
          'CONDUSEF = Protege usuarios'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', '2. Cálculos Básicos (practica MUCHO):',
        'items', jsonb_build_array(
          'PORCENTAJES:',
          '  → Convertir % a decimal: dividir entre 100',
          '  → Convertir decimal a %: multiplicar por 100',
          '  → Calcular %: Cantidad × (% en decimal)',
          '',
          'TASAS DE INTERÉS:',
          '  → Anual a mensual: dividir entre 12',
          '  → Anual a bimestral: dividir entre 6',
          '  → Anual a cuatrimestral: dividir entre 3',
          '',
          'REGLA DE TRES (LA MÁS FRECUENTE):',
          '  → Si A es a B, entonces C es a X',
          '  → X = (C × B) ÷ A',
          '  → Multiplica cruzado, divide por el que queda'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'PREGUNTA TIPO EXAMEN (Área 4):\n\nUna póliza con SA $600,000 cuesta $4,500. ¿Cuánto costará con SA $900,000?\n\nA) $6,000\nB) $6,750\nC) $7,000\nD) $5,500\n\nRespuesta: B ($6,750)\n\nCálculo:\nX = (900,000 × 4,500) ÷ 600,000\nX = 4,050,000,000 ÷ 600,000\nX = 6,750'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CONEXIONES ENTRE ÁREAS (INTEGRACIÓN)'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El examen puede combinar conocimientos de varias áreas en una sola pregunta:'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO INTEGRADOR:\n\nUn cliente contrata GMM con el agente Juan. Al mes tiene un siniestro de $60,000. Su deducible es $10,000 y coaseguro 10%. El cliente no entiende por qué debe pagar $15,000 y se queja. Juan debe:\n\nA) Decirle que así es el contrato\nB) Explicarle cómo funciona deducible y coaseguro con números\nC) Ofrecerle cambiar de póliza\nD) Enviarlo con la aseguradora\n\nRespuesta: B\n\n✅ INTEGRACIÓN:\n- Área 1: Obligación del agente de asesorar\n- Área 2: Conocimiento GMM (deducible + coaseguro)\n- Área 4: Cálculo correcto (60,000 - 10,000 = 50,000 × 0.10 = 5,000 + 10,000 = 15,000)\n- Área Ética: Transparencia y educación al cliente'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'CHECKLIST DE PREPARACIÓN POR ÁREA'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Para Área 1 (Marco Legal):',
        'items', jsonb_build_array(
          '☐ Diferencio CNSF, CONDUSEF, SHCP sin dudar',
          '☐ Conozco obligaciones del agente',
          '☐ Entiendo tipos de agentes',
          '☐ Sé qué son sanciones y cuándo aplican',
          '☐ Conozco elementos del contrato de seguro'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Para Área 2 (Personas):',
        'items', jsonb_build_array(
          '☐ Calculo deducible + coaseguro sin error',
          '☐ Diferencio GMM de Salud',
          '☐ Conozco tipos de vida',
          '☐ Sé qué es accidente para efectos del seguro',
          '☐ Entiendo exclusiones comunes'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Para Área 3 (Daños/Autos):',
        'items', jsonb_build_array(
          '☐ Diferencio RC, DM, RT sin dudar',
          '☐ Sé diferencia pérdida total vs parcial',
          '☐ Conozco procedimiento de siniestro',
          '☐ Entiendo subrogación y salvamentos',
          '☐ Sé qué es obligatorio (RC)'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Para Área 4 (Financiero/Cálculos):',
        'items', jsonb_build_array(
          '☐ Diferencio todas las autoridades financieras',
          '☐ Convierto porcentajes a decimales sin error',
          '☐ Resuelvo regla de tres correctamente',
          '☐ Convierto tasas entre periodos',
          '☐ Calculo rendimientos'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'RESUMEN LECCIÓN 6.4'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Puntos clave del repaso integrado:',
        'items', jsonb_build_array(
          '✓ 4 áreas del examen: Legal (25-30%), Personas (25-30%), Daños (20-25%), Financiero (20-25%)',
          '✓ Área 1: CNSF regula, CONDUSEF protege, SHCP aprueba',
          '✓ Área 2: GMM es lo más preguntado (deducible + coaseguro)',
          '✓ Área 3: Autos es lo más frecuente (RC, DM, RT)',
          '✓ Área 4: Regla de tres es el cálculo más común',
          '✓ El examen puede integrar varias áreas en una pregunta',
          '✓ Debes dominar TODAS las áreas, no puedes ignorar ninguna',
          '✓ Los conceptos están CONECTADOS entre sí',
          '✓ Repasa con el checklist para identificar áreas débiles',
          '✓ Refuerza lo que no domines antes del examen'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '💪 Si completaste los checklists y dominas estos conceptos, estás LISTO para el examen.'
      )
    )
  )
);