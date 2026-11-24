/*
  # Creación Módulo 6 - Integración Final (Parte 2)

  1. Crear Lección 6.2: Tipos de Preguntas del Examen
  2. Crear Lección 6.3: Cómo Razona la CNSF las Preguntas
*/

-- Lección 6.2: Tipos de Preguntas
INSERT INTO cedula_a_lecciones (
  modulo_id,
  titulo,
  orden,
  duracion_estimada_minutos,
  contenido
)
VALUES (
  'db6a1c83-3115-49d3-8cdf-78de44baeb2e',
  'Lección 6.2 - Tipos de Preguntas del Examen',
  2,
  45,
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LECCIÓN 6.2: TIPOS DE PREGUNTAS DEL EXAMEN'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ CONOCER LOS TIPOS de preguntas te permite IDENTIFICAR rápidamente qué te están preguntando y cómo responder.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'El examen de Cédula A NO busca memorización literal de textos. Busca evaluar tu CAPACIDAD DE COMPRENSIÓN, RAZONAMIENTO y APLICACIÓN PRÁCTICA del conocimiento.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.2.1 LOS 7 TIPOS DE REACTIVOS MÁS COMUNES'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ Identifica el TIPO de pregunta y sabrás cómo abordarla.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'TIPO 1: DEFINICIÓN O CONCEPTO'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Te piden identificar la definición CORRECTA de un término o concepto.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO:\n\n¿Qué es un ACCIDENTE para efectos del seguro?\n\nA) Cualquier evento fortuito\nB) Evento súbito, violento y externo que causa daño corporal\nC) Enfermedad repentina\nD) Lesión por desgaste natural\n\nRespuesta correcta: B\n\n✅ CLAVE: La definición debe ser PRECISA según la terminología del seguro.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'OTRO EJEMPLO:\n\n¿Qué es el DEDUCIBLE en un seguro?\n\nA) El porcentaje que paga el asegurado\nB) La cantidad fija que el asegurado paga en cada siniestro\nC) El límite máximo de la póliza\nD) El descuento por buen historial\n\nRespuesta correcta: B'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ ESTRATEGIA: Busca la respuesta más COMPLETA y PRECISA. Las respuestas parciales o ambiguas NO son correctas.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'TIPO 2: IDENTIFICACIÓN DE AUTORIDAD O LEY'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Te preguntan QUÉ autoridad regula, supervisa o sanciona algo específico.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO:\n\n¿Qué autoridad REGULA y SUPERVISA a las instituciones de seguros?\n\nA) CONDUSEF\nB) CNBV\nC) CNSF\nD) Banxico\n\nRespuesta correcta: C (CNSF)\n\n✅ CLAVE: Cada autoridad tiene funciones ESPECÍFICAS. NO las confundas.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'OTRO EJEMPLO:\n\n¿Qué organismo PROTEGE los derechos de los usuarios de servicios financieros?\n\nA) CNSF\nB) CONDUSEF\nC) SHCP\nD) CNBV\n\nRespuesta correcta: B (CONDUSEF)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'REPASO RÁPIDO de autoridades:',
        'items', jsonb_build_array(
          'CNSF → Regula y supervisa seguros',
          'CONDUSEF → Protege al usuario',
          'SHCP → Autoridad superior (aprueba tarifas)',
          'CNBV → Supervisa bancos y valores',
          'Banxico → Política monetaria',
          'CONSAR → Supervisa AFORES'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'TIPO 3: DIFERENCIACIÓN DE CONCEPTOS'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Te piden distinguir entre dos conceptos SIMILARES pero DIFERENTES.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO CLÁSICO:\n\n¿Cuál es la diferencia entre COPAGO y COASEGURO?\n\nA) Son lo mismo\nB) Copago es cantidad fija, coaseguro es porcentaje\nC) Copago es porcentaje, coaseguro es cantidad fija\nD) Copago se paga antes, coaseguro después\n\nRespuesta correcta: B\n\n✅ CLAVE:\nCOPAGO = Cantidad FIJA (ej: $200 por consulta)\nCOASEGURO = PORCENTAJE (ej: 10% del gasto)'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'OTRO EJEMPLO:\n\n¿Cuál es la diferencia entre PÉRDIDA TOTAL y PÉRDIDA PARCIAL en autos?\n\nA) Total = reparación > 75% del valor, Parcial = menor a 75%\nB) Total = auto destruido, Parcial = tiene reparación\nC) No hay diferencia\nD) Depende de la aseguradora\n\nRespuesta correcta: A'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'CONCEPTOS que DEBES diferenciar:',
        'items', jsonb_build_array(
          'Deducible vs Coaseguro vs Copago',
          'Pérdida Total vs Pérdida Parcial',
          'RC vs Daños Materiales',
          'GMM vs Salud',
          'Agente vs Apoderado',
          'Prima vs Suma Asegurada',
          'Exclusión vs Excepción'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'TIPO 4: APLICACIÓN PRÁCTICA / CASO'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Te presentan una SITUACIÓN REAL y debes identificar el procedimiento, cobertura o acción CORRECTA.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO:\n\nUn asegurado sufre un accidente automovilístico el sábado a las 11 PM. ¿Qué debe hacer PRIMERO?\n\nA) Ir al taller el lunes\nB) Avisar a su agente\nC) Llamar a la línea de atención de emergencias de la aseguradora\nD) Esperar a que la otra parte lo contacte\n\nRespuesta correcta: C\n\n✅ CLAVE: En EMERGENCIAS, lo primero es avisar a la ASEGURADORA (línea 24/7).'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'OTRO EJEMPLO:\n\nUn asegurado tiene GMM con deducible de $10,000 y coaseguro 10%. Tiene un gasto de $50,000. ¿Cuánto paga?\n\nA) $10,000\nB) $5,000\nC) $14,000\nD) $15,000\n\nRespuesta correcta: C\n\nCálculo:\nGasto: $50,000\nDeducible: -$10,000\nBase para coaseguro: $40,000\nCoaseguro 10%: $4,000\nTotal a pagar: $10,000 + $4,000 = $14,000'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ ESTRATEGIA: Lee COMPLETO el caso. Identifica los datos importantes. Aplica el procedimiento o fórmula correcta.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'TIPO 5: CÁLCULO MATEMÁTICO'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Te dan datos numéricos y debes realizar un CÁLCULO (regla de tres, porcentajes, tasas).'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO:\n\nUna póliza con suma asegurada de $800,000 tiene prima de $6,000. ¿Cuál sería la prima para $1,200,000?\n\nA) $8,000\nB) $9,000\nC) $10,000\nD) $7,500\n\nRespuesta correcta: B\n\nCálculo (regla de tres):\nX = (1,200,000 × 6,000) ÷ 800,000 = $9,000'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ CONSEJO: Estos son PUNTOS SEGUROS si estudiaste el Módulo 5. Tómate tu tiempo, no te apresures.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'TIPO 6: VERDADERO O FALSO (EN FORMATO DE OPCIÓN MÚLTIPLE)'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Te presentan afirmaciones y debes identificar cuál es VERDADERA o FALSA.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO:\n\n¿Cuál afirmación sobre el seguro de RC es CORRECTA?\n\nA) Cubre daños al vehículo propio\nB) Cubre daños a terceros causados por el asegurado\nC) Es opcional en México\nD) Solo cubre daños materiales, no lesiones\n\nRespuesta correcta: B\n\n✅ ANÁLISIS:\nA) FALSO - RC NO cubre el vehículo propio\nB) VERDADERO - RC cubre daños a TERCEROS\nC) FALSO - RC es OBLIGATORIO\nD) FALSO - RC cubre daños materiales Y lesiones'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ ESTRATEGIA: Elimina las opciones CLARAMENTE FALSAS primero. Luego elige entre las que quedan.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'TIPO 7: SECUENCIA O PROCEDIMIENTO'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Te preguntan el ORDEN CORRECTO de pasos en un procedimiento.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO:\n\n¿Cuál es la secuencia CORRECTA al reportar un siniestro de auto?\n\nA) Agente → Aseguradora → Ajustador → Taller\nB) Aseguradora → Ajustador → Taller → Reparación\nC) Taller → Aseguradora → Ajustador → Reparación\nD) Ajustador → Aseguradora → Taller → Agente\n\nRespuesta correcta: B\n\n✅ SECUENCIA:\n1. Avisar ASEGURADORA\n2. Asignan AJUSTADOR\n3. Dictamen y envío a TALLER\n4. REPARACIÓN'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.2.2 CÓMO ABORDAR CADA TIPO DE PREGUNTA'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'ESTRATEGIA GENERAL:',
        'items', jsonb_build_array(
          '1. LEE COMPLETA la pregunta (no a medias)',
          '2. IDENTIFICA qué tipo de pregunta es',
          '3. IDENTIFICA qué te están preguntando EXACTAMENTE',
          '4. ELIMINA opciones claramente incorrectas',
          '5. ELIGE entre las opciones restantes',
          '6. VERIFICA que tu respuesta tenga sentido lógico',
          '7. MARCA y continúa (no te quedes atascado)'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.2.3 PALABRAS CLAVE EN LAS PREGUNTAS'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ IMPORTANTE: Presta atención a estas palabras porque cambian completamente el sentido de la pregunta.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Palabras que debes identificar:',
        'items', jsonb_build_array(
          'SIEMPRE / NUNCA (absolutos, cuidado)',
          'DEBE / PUEDE (obligación vs posibilidad)',
          'EXCEPTO / SALVO (buscan la excepción)',
          'CORRECTA / INCORRECTA (atención)',
          'PRIMERO / ÚLTIMO (orden)',
          'MÁXIMO / MÍNIMO (límites)',
          'OBLIGATORIO / OPCIONAL (requisitos)'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO DE PALABRA CLAVE:\n\n"¿Cuál de las siguientes NO es una obligación del agente?"\n\nFíjate en el NO. Buscas la que NO es obligación (las demás SÍ lo son).'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.2.4 RESPUESTAS "TRAMPA" (QUE NO LO SON)'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Muchas personas piensan que hay respuestas trampa. En realidad son respuestas que:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Tipos de distractores comunes:',
        'items', jsonb_build_array(
          '✓ Son PARCIALMENTE correctas (pero incompletas)',
          '✓ Son de SENTIDO COMÚN pero legalmente incorrectas',
          '✓ SUENAN bien pero son técnicamente erróneas',
          '✓ Confunden TÉRMINOS similares',
          '✓ Tienen una PALABRA que las hace incorrectas'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO:\n\nPregunta: ¿Qué cubre la cobertura de Responsabilidad Civil?\n\nA) Daños al auto del asegurado\nB) Daños a terceros afectados\nC) Robo del vehículo\nD) Gastos médicos del asegurado\n\nRespuesta correcta: B\n\nAnálisis de distractores:\nA) Suena lógico pero es INCORRECTO (eso es Daños Materiales)\nC) Es otra cobertura (Robo Total)\nD) Suena bien pero NO (GMM del ocupante es diferente)'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'RESUMEN LECCIÓN 6.2'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Puntos clave sobre tipos de preguntas:',
        'items', jsonb_build_array(
          '✓ 7 tipos principales: definición, autoridad, diferenciación, aplicación, cálculo, verdadero/falso, secuencia',
          '✓ Identifica el TIPO de pregunta para saber cómo abordarla',
          '✓ Lee COMPLETA la pregunta antes de responder',
          '✓ Presta atención a PALABRAS CLAVE (no, siempre, excepto)',
          '✓ Elimina opciones CLARAMENTE incorrectas',
          '✓ Busca la respuesta más COMPLETA y PRECISA',
          '✓ NO hay preguntas trampa, solo distractores bien diseñados',
          '✓ Si no sabes, elimina opciones y elige la más lógica',
          '✓ Verifica que tu respuesta tenga sentido',
          '✓ NO te quedes atascado, marca y continúa'
        )
      )
    )
  )
);

-- Lección 6.3: Cómo Razona la CNSF
INSERT INTO cedula_a_lecciones (
  modulo_id,
  titulo,
  orden,
  duracion_estimada_minutos,
  contenido
)
VALUES (
  'db6a1c83-3115-49d3-8cdf-78de44baeb2e',
  'Lección 6.3 - Cómo Razona la CNSF las Preguntas',
  3,
  35,
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'LECCIÓN 6.3: CÓMO RAZONA LA CNSF LAS PREGUNTAS'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐⭐⭐ LECCIÓN CLAVE: Entender CÓMO piensa la CNSF te da una VENTAJA ENORME. Podrás deducir respuestas incluso sin saberlas de memoria.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.3.1 LA FILOSOFÍA DE LA CNSF'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Un error común es pensar que la CNSF "pone trampas" o "quiere reprobar gente". Esto es FALSO.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'La CNSF busca certificar que los agentes tengan el CONOCIMIENTO MÍNIMO necesario para ejercer la profesión de manera ÉTICA, COMPETENTE y RESPONSABLE, protegiendo al público usuario de seguros.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Por lo tanto, el examen evalúa:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Qué evalúa realmente el examen:',
        'items', jsonb_build_array(
          '✓ CRITERIO PROFESIONAL (no solo memoria)',
          '✓ COMPRENSIÓN REAL (no repetición mecánica)',
          '✓ APLICACIÓN PRÁCTICA (situaciones reales)',
          '✓ PROTECCIÓN AL ASEGURADO (prioridad)',
          '✓ RESPETO AL MARCO LEGAL (obligatorio)'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.3.2 PRINCIPIO RECTOR DEL EXAMEN'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ MEMORIZA ESTE PRINCIPIO. Te salvará en muchas preguntas donde tengas dudas.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'PRINCIPIO DE ORO:\n\nLa respuesta correcta es la que MEJOR PROTEGE AL ASEGURADO y RESPETA EL MARCO LEGAL, no necesariamente la que "suena más lógica" desde el punto de vista comercial.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO PRÁCTICO:\n\nPregunta: Un cliente quiere contratar un seguro pero no entiende bien las exclusiones. ¿Qué debe hacer el agente?\n\nA) Vender rápido antes de que cambie de opinión\nB) Explicar clara y completamente todas las exclusiones\nC) Decirle que después lo lee en la póliza\nD) Omitir las exclusiones para no complicar\n\nRespuesta correcta: B\n\n✅ ANÁLISIS según principio CNSF:\n- A) Prioriza venta sobre protección ❌\n- B) Protege al cliente con información completa ✅\n- C) Evade responsabilidad del agente ❌\n- D) Oculta información importante ❌\n\nLa CNSF SIEMPRE favorece transparencia y protección al usuario.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.3.3 JERARQUÍA DE PRIORIDADES DE LA CNSF'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Cuando tengas duda entre dos respuestas que parecen correctas, usa esta jerarquía:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Orden de prioridad (de mayor a menor):',
        'items', jsonb_build_array(
          '1. PROTECCIÓN AL ASEGURADO (siempre primero)',
          '2. CUMPLIMIENTO DE LA LEY (obligatorio)',
          '3. BUENAS PRÁCTICAS PROFESIONALES (ética)',
          '4. EFICIENCIA OPERATIVA (procedimientos)',
          '5. BENEFICIO COMERCIAL (último)'
        )
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'EJEMPLO DE APLICACIÓN:\n\nPregunta: Un cliente pide acelerar el trámite de su siniestro. El agente puede:\n\nA) Saltarse pasos del procedimiento para ser más rápido\nB) Seguir el procedimiento completo aunque tarde más\nC) Presionar al ajustador para que dicte rápido\nD) Prometer pago inmediato\n\nRespuesta correcta: B\n\n✅ RAZONAMIENTO:\nOpción A: Viola procedimientos (riesgo legal) ❌\nOpción B: Protege al cliente siguiendo proceso correcto ✅\nOpción C: Presión indebida, puede causar errores ❌\nOpción D: Promesa que no puede cumplir (mala práctica) ❌\n\nSeguir el procedimiento PROTEGE al asegurado de errores.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.3.4 CRITERIOS DE RESPUESTA CORRECTA'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⚠️ Una respuesta es CORRECTA cuando cumple TODOS estos criterios:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Checklist de respuesta correcta:',
        'items', jsonb_build_array(
          '✓ Es TÉCNICAMENTE precisa (definición exacta)',
          '✓ Es LEGALMENTE válida (respeta la ley)',
          '✓ PROTEGE al asegurado (no lo perjudica)',
          '✓ Es ÉTICAMENTE correcta (buenas prácticas)',
          '✓ Es COMPLETA (no omite aspectos importantes)',
          '✓ Es PRÁCTICAMENTE aplicable (no teórica imposible)'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.3.5 ERRORES DE RAZONAMIENTO COMUNES'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'ERROR #1: Razonar comercialmente en lugar de profesionalmente',
        'items', jsonb_build_array(
          '❌ INCORRECTO: "Lo que beneficia más a la venta"',
          '✅ CORRECTO: "Lo que mejor protege al cliente"'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'ERROR #2: Usar lógica de "sentido común" en lugar de técnica',
        'items', jsonb_build_array(
          '❌ INCORRECTO: "Lo que haría en mi vida personal"',
          '✅ CORRECTO: "Lo que establece la ley y buenas prácticas"'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'ERROR #3: Elegir la respuesta "más fácil" o "más rápida"',
        'items', jsonb_build_array(
          '❌ INCORRECTO: "El atajo que ahorra tiempo"',
          '✅ CORRECTO: "El procedimiento completo y correcto"'
        )
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'ERROR #4: Pensar "el seguro siempre debe pagar"',
        'items', jsonb_build_array(
          '❌ INCORRECTO: Pensar que cualquier reclamación procede',
          '✅ CORRECTO: Entender que existen exclusiones legítimas'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.3.6 CASOS DONDE APLICA EL RAZONAMIENTO CNSF'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'CASO 1: Aviso del Siniestro\n\nPregunta: ¿Cuándo se debe avisar un siniestro?\n\nA) Cuando sea conveniente\nB) Al día siguiente hábil\nC) A la mayor brevedad posible\nD) Dentro del mes\n\nRespuesta correcta: C\n\n✅ RAZONAMIENTO CNSF:\n"A la mayor brevedad" protege al asegurado porque:\n- Permite investigación oportuna\n- Evita pérdida de evidencias\n- Agiliza el proceso\n- Cumple requisitos legales\n\nRespuestas B y D crean demoras innecesarias.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'CASO 2: Información al Cliente\n\nPregunta: ¿Qué información es OBLIGATORIO dar al cliente antes de la venta?\n\nA) Solo el precio\nB) Solo las coberturas\nC) Solo las exclusiones importantes\nD) Coberturas, exclusiones, deducibles, procedimientos\n\nRespuesta correcta: D\n\n✅ RAZONAMIENTO CNSF:\nLa información COMPLETA protege al cliente de sorpresas.\nOcultar o minimizar información viola buenas prácticas.\nEl cliente debe tomar decisión INFORMADA.'
      ),
      jsonb_build_object(
        'type', 'caso_practico',
        'content', 'CASO 3: Conflicto de Interés\n\nPregunta: Un cliente necesita un seguro que tu compañía NO ofrece. ¿Qué haces?\n\nA) Le vendes el producto más parecido que sí tienes\nB) Lo orientas sobre dónde puede conseguir lo que necesita\nC) Le dices que no es necesario ese tipo de seguro\nD) Lo ignoras porque no te conviene\n\nRespuesta correcta: B\n\n✅ RAZONAMIENTO CNSF:\nEl deber del agente es ORIENTAR al cliente, incluso si no resulta en venta personal.\nÉtica profesional > Beneficio comercial.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.3.7 REGLA DE ORO PARA RESPUESTAS DUDOSAS'
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '⭐ Cuando tengas duda entre dos respuestas, pregúntate:'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Preguntas para decidir:',
        'items', jsonb_build_array(
          '1. ¿Cuál respuesta PROTEGE MÁS al asegurado?',
          '2. ¿Cuál respuesta RESPETA MÁS la ley?',
          '3. ¿Cuál respuesta es ÉTICAMENTE más correcta?',
          '4. ¿Cuál respuesta sería DEFENDIBLE ante la autoridad?',
          '5. ¿Cuál respuesta refleja PROFESIONALISMO?'
        )
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'La que cumpla MÁS criterios es la correcta.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.3.8 LO QUE LA CNSF PENALIZA'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Respuestas que la CNSF considera INCORRECTAS:',
        'items', jsonb_build_array(
          '❌ Ocultar información al cliente',
          '❌ Priorizar venta sobre protección',
          '❌ Saltarse procedimientos legales',
          '❌ Hacer promesas que no puede cumplir',
          '❌ Violar confidencialidad',
          '❌ Actuar con conflicto de interés no revelado',
          '❌ Desconocer obligaciones legales',
          '❌ Presionar al cliente indebidamente'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', '6.3.9 LO QUE LA CNSF VALORA'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Respuestas que la CNSF considera CORRECTAS:',
        'items', jsonb_build_array(
          '✅ Transparencia total con el cliente',
          '✅ Seguir procedimientos establecidos',
          '✅ Actuar con ética profesional',
          '✅ Proteger intereses del asegurado',
          '✅ Cumplir marco legal vigente',
          '✅ Orientar incluso sin beneficio directo',
          '✅ Documentar adecuadamente',
          '✅ Capacitarse continuamente'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'RESUMEN LECCIÓN 6.3'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Puntos clave sobre cómo razona la CNSF:',
        'items', jsonb_build_array(
          '✓ La CNSF NO pone trampas, busca profesionales competentes',
          '✓ PRINCIPIO DE ORO: Proteger al asegurado + Respetar la ley',
          '✓ Jerarquía: Protección > Ley > Ética > Eficiencia > Comercial',
          '✓ La respuesta correcta es técnica, legal, ética y completa',
          '✓ NO razones comercialmente, razona profesionalmente',
          '✓ En duda: elige la que MÁS protege al cliente',
          '✓ Transparencia y ética SIEMPRE son correctas',
          '✓ Saltarse procedimientos SIEMPRE es incorrecto',
          '✓ Si viola la ley o perjudica al cliente, está MAL',
          '✓ Entender esto te da ventaja enorme en el examen'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', '💡 CLAVE DEL ÉXITO: Piensa como un PROFESIONAL RESPONSABLE, no como un vendedor. La CNSF certifica profesionales.'
      )
    )
  )
);