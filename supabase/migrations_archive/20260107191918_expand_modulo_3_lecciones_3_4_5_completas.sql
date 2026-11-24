/*
  # Expansión Módulo 3 - Lecciones 3.3, 3.4 y 3.5 finales

  1. Actualizar Lección 3.3 con tipos de pólizas y coberturas
  2. Actualizar Lección 3.4 con siniestros y pérdida total/parcial
  3. Actualizar Lección 3.5 con documentación completa
*/

-- Lección 3.3: Tipos de Pólizas y Coberturas
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 3.3: TIPOS DE PÓLIZAS Y COBERTURAS PRINCIPALES'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Las coberturas del seguro de autos son PREGUNTA OBLIGADA en el examen. Debes conocer perfectamente qué cubre cada una y qué NO cubre.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'TIPOS DE PÓLIZAS DE AUTOMÓVILES'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'A) PÓLIZA INDIVIDUAL'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Asegura UN SOLO vehículo, con un contratante, una unidad específica identificada por sus placas, serie, modelo.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características de la póliza individual:',
      'items', jsonb_build_array(
        '✓ UN solo vehículo asegurado',
        '✓ UN contratante',
        '✓ Datos específicos del auto (placas, serie, modelo, marca)',
        '✓ Prima individual por ese vehículo',
        '✓ Renovación independiente',
        '✓ Cobertura personalizada'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: María tiene un Honda Civic 2020. Contrata una póliza individual para ese auto específico. La póliza solo cubre ese vehículo.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'B) PÓLIZA DE FLOTILLA'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Asegura DOS O MÁS vehículos bajo una sola póliza. Pueden pertenecer a un mismo dueño o a diferentes dueños.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: Flotilla NO significa necesariamente descuento. El beneficio principal es ADMINISTRACIÓN bajo una sola póliza.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características de la póliza de flotilla:',
      'items', jsonb_build_array(
        '✓ DOS o más vehículos',
        '✓ UN solo contratante (generalmente)',
        '✓ UN solo número de póliza',
        '✓ UNA sola fecha de renovación',
        '✓ Puede tener descuento por volumen',
        '✓ Administración centralizada',
        '✓ Los vehículos pueden ser de diferentes tipos'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Una empresa tiene 50 autos de reparto. En lugar de 50 pólizas individuales, contrata UNA póliza de flotilla que cubre los 50 vehículos. Ventaja: un solo pago, un solo vencimiento, una sola administración.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Ventajas de la flotilla:',
      'items', jsonb_build_array(
        '✓ Administración más simple',
        '✓ Posible descuento por volumen',
        '✓ Una sola renovación',
        '✓ Reportes consolidados',
        '✓ Negociación de condiciones globales'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'COBERTURAS PRINCIPALES DEL SEGURO DE AUTOMÓVILES'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'MEMORIZA qué cubre cada cobertura y qué NO. Es la base de TODO el seguro de autos.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1. DAÑOS MATERIALES (DM)'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Cubre los daños físicos sufridos por el vehículo asegurado como consecuencia directa de riesgos cubiertos.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'QUÉ CUBRE Daños Materiales:',
      'items', jsonb_build_array(
        '✓ COLISIÓN con otro vehículo',
        '✓ VOLCADURA',
        '✓ Caída de OBJETOS',
        '✓ Daños por FENÓMENOS NATURALES (según póliza): granizo, inundación',
        '✓ VANDALISMO (si está cubierto)',
        '✓ Daños en TRANSPORTE (si aplica)',
        '✓ INCENDIO del vehículo'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'QUÉ NO CUBRE (exclusiones típicas):',
      'items', jsonb_build_array(
        '❌ Conductor sin LICENCIA vigente',
        '❌ Conductor en estado de EBRIEDAD',
        '❌ Conductor bajo influencia de DROGAS',
        '❌ Daños INTENCIONALES',
        '❌ DESGASTE natural',
        '❌ Daños MECÁNICOS o eléctricos',
        '❌ Daños por FALTA DE MANTENIMIENTO',
        '❌ ROBO de autopartes (eso va en otra cobertura)'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO: Si el conductor NO tiene licencia vigente, la aseguradora NO paga daños materiales, colisión ni volcadura. SÍ paga RC y gastos médicos (terceros).'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Caso 1 - SÍ cubre: Juan va manejando, llueve mucho, pierde el control y choca contra un poste. Tiene su licencia vigente. La aseguradora cubre la reparación de su auto (daños materiales).'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Caso 2 - NO cubre: Pedro sale de una fiesta borracho, choca su auto. Aunque tiene seguro amplio, la aseguradora NO paga la reparación de su auto porque estaba en estado de ebriedad. (Pero SÍ paga daños a terceros por RC).'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2. ROBO TOTAL'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Cubre la pérdida TOTAL del vehículo derivada del robo COMPLETO de la unidad.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Palabra clave: TOTAL. Esta cobertura NO cubre robo PARCIAL de autopartes (llantas, espejos, etc.) salvo que se contrate cobertura adicional específica.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'QUÉ CUBRE Robo Total:',
      'items', jsonb_build_array(
        '✓ Robo COMPLETO del vehículo',
        '✓ Pérdida total por no recuperación',
        '✓ Daños al recuperar (si está cubierto)',
        '✓ Accesorios ORIGINALES del vehículo'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'QUÉ NO CUBRE:',
      'items', jsonb_build_array(
        '❌ Robo PARCIAL de autopartes (sin cobertura adicional)',
        '❌ Robo de OBJETOS PERSONALES dentro del auto',
        '❌ Robo de ACCESORIOS NO ASEGURADOS (equipo especial)',
        '❌ Pérdida de LLAVES (no es robo)',
        '❌ Apropiación por FAMILIARES',
        '❌ Fraude del asegurado'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Caso de robo total: Le roban el auto completo a María. Levanta acta ante MP. El auto no aparece. La aseguradora paga el valor comercial del auto (pérdida total por robo). María entrega documentos originales.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Caso de robo PARCIAL (NO cubierto): A Pedro le roban las 4 llantas y espejos del auto. Como solo es robo PARCIAL, su póliza básica NO cubre. Necesitaría cobertura adicional de "Robo Parcial" para que cubriera.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '3. RESPONSABILIDAD CIVIL (RC)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO: RC es OBLIGATORIA por ley para circular. Es la cobertura MÁS IMPORTANTE del seguro de autos.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Cubre los daños que el asegurado (o conductor autorizado) cause a TERCEROS en sus bienes o en sus personas, como consecuencia del uso del vehículo asegurado.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Palabra clave: TERCEROS. RC NO cubre daños al asegurado ni a su auto. Solo cubre daños a OTRAS personas y OTROS bienes.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'QUÉ CUBRE Responsabilidad Civil:',
      'items', jsonb_build_array(
        '✓ Daños MATERIALES a vehículos de terceros',
        '✓ Daños a PROPIEDAD de terceros (bardas, casas, postes)',
        '✓ LESIONES a terceros',
        '✓ MUERTE de terceros',
        '✓ GASTOS MÉDICOS de terceros lesionados',
        '✓ DEFENSA LEGAL del asegurado',
        '✓ FIANZAS para libertad provisional'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'QUÉ NO CUBRE:',
      'items', jsonb_build_array(
        '❌ Daños al VEHÍCULO ASEGURADO (eso es DM)',
        '❌ Lesiones al CONDUCTOR asegurado',
        '❌ Daños a FAMILIARES que viven con el asegurado',
        '❌ Daños a EMPLEADOS del asegurado (eso es riesgos de trabajo)',
        '❌ Daños INTENCIONALES',
        '❌ Responsabilidad CONTRACTUAL'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo completo: Juan choca por su culpa contra el auto de María. Juan tiene seguro con RC. La RC de Juan cubre: 1) Reparación del auto de María, 2) Gastos médicos de María si resultó lesionada, 3) Abogado para defender a Juan si María lo demanda. La RC NO cubre el auto de Juan (eso sería DM).'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'ERROR COMÚN: Pensar que RC cubre el auto del asegurado. ¡FALSO! RC SOLO cubre daños a TERCEROS.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Límites de suma asegurada en RC:',
      'items', jsonb_build_array(
        'RC es POR EVENTO, no por persona',
        'Ejemplo: RC de $2,000,000',
        'Si hay 3 lesionados, se reparten los $2M entre los 3',
        'La suma NO se multiplica por persona',
        'RC mayor = prima mayor'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '4. GASTOS MÉDICOS A OCUPANTES (GMO)'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Cubre los gastos médicos del conductor y pasajeros del vehículo asegurado, derivados de un accidente automovilístico.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'QUÉ CUBRE:',
      'items', jsonb_build_array(
        '✓ Gastos médicos del CONDUCTOR',
        '✓ Gastos médicos de PASAJEROS',
        '✓ Hospitalización',
        '✓ Cirugías',
        '✓ Medicamentos',
        '✓ Ambulancia'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Límites típicos:',
      'items', jsonb_build_array(
        'POR PERSONA (ej: $100,000 por ocupante)',
        'POR EVENTO (ej: $500,000 total)',
        'Aplica sin importar culpabilidad'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5. ASISTENCIA VIAL'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Servicios típicos incluidos:',
      'items', jsonb_build_array(
        '✓ GRÚA en caso de accidente o descompostura',
        '✓ Cambio de LLANTA',
        '✓ Paso de CORRIENTE',
        '✓ Apertura de PUERTAS (llaves dentro)',
        '✓ Suministro de GASOLINA (mínimo)',
        '✓ INFORMACIÓN vial',
        '✓ Envío de AMBULANCIA'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '6. ASISTENCIA LEGAL'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Incluye:',
      'items', jsonb_build_array(
        '✓ Asesoría LEGAL',
        '✓ Representación ante AUTORIDADES',
        '✓ ABOGADO en caso de demanda',
        '✓ Trámites legales del siniestro'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'TIPOS DE COBERTURAS POR AMPLITUD'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'A) COBERTURA LIMITADA (RC únicamente)'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Solo cubre Responsabilidad Civil. Es la cobertura MÍNIMA obligatoria por ley.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Incluye:',
      'items', jsonb_build_array(
        '✓ Responsabilidad Civil',
        '✓ Asistencia Legal (generalmente)',
        '✓ Asistencia Vial (a veces)'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'NO incluye:',
      'items', jsonb_build_array(
        '❌ Daños propios',
        '❌ Robo',
        '❌ Gastos médicos ocupantes'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'B) COBERTURA AMPLIA'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Cubre prácticamente todos los riesgos típicos.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Incluye TODO:',
      'items', jsonb_build_array(
        '✓ Daños Materiales',
        '✓ Robo Total',
        '✓ Responsabilidad Civil',
        '✓ Gastos Médicos Ocupantes',
        '✓ Asistencia Vial',
        '✓ Asistencia Legal'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'C) COBERTURAS OPCIONALES ADICIONALES'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Se pueden agregar:',
      'items', jsonb_build_array(
        '+ Extensión a USA/Canadá',
        '+ Robo PARCIAL',
        '+ Cristales',
        '+ Llanta de refacción',
        '+ Daños a OCUPANTES (muerte)',
        '+ Auto sustituto',
        '+ Cobertura de ACCESORIOS especiales',
        '+ Pérdida total por daños'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 3.3'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave:',
      'items', jsonb_build_array(
        'Póliza individual = 1 auto. Flotilla = 2+ autos',
        'DM cubre daños propios del auto (colisión, volcadura)',
        'Robo Total = robo completo. NO cubre robo parcial',
        'RC cubre daños a TERCEROS (no al asegurado)',
        'RC es OBLIGATORIA por ley',
        'GMO cubre gastos médicos de conductor y pasajeros',
        'Sin licencia vigente = NO se pagan DM',
        'Borracho = NO se pagan DM pero SÍ RC',
        'Cobertura Limitada = solo RC',
        'Cobertura Amplia = DM + Robo + RC + GMO + Asistencias'
      )
    )
  )
),
duracion_estimada_minutos = 55,
updated_at = now()
WHERE titulo = 'Lección 3.3 - Siniestros';

-- Lección 3.4: Siniestros y Pérdida Total/Parcial
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 3.4: SINIESTROS, PÉRDIDA TOTAL Y PARCIAL'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Los conceptos de pérdida total y parcial son CRÍTICOS. Los porcentajes (50% y 75%) son PREGUNTA OBLIGADA en el examen.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'CONCEPTO DE SINIESTRO'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Un siniestro es la REALIZACIÓN del riesgo asegurado. Es el evento dañoso cubierto por la póliza que da lugar a una posible indemnización.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplos de siniestro: Choque (realización del riesgo de colisión), Robo del auto (realización del riesgo de robo), Inundación que daña el auto (realización del riesgo de fenómeno natural).'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'OBLIGACIONES DEL ASEGURADO AL OCURRIR UN SINIESTRO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO: El incumplimiento de estas obligaciones puede resultar en PÉRDIDA DE COBERTURA o REDUCCIÓN de la indemnización.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1. AVISO DEL SINIESTRO'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El asegurado DEBE dar aviso a la aseguradora tan pronto tenga conocimiento del siniestro.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Reglas del aviso:',
      'items', jsonb_build_array(
        'Plazo general: 5 DÍAS NATURALES',
        'Debe ser TAN PRONTO como sea posible',
        'Se puede dar por teléfono, app, portal web',
        'Debe incluir: lugar, fecha, hora, circunstancias',
        'El RETRASO injustificado puede afectar la cobertura'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: El plazo de 5 días es para DAR AVISO, NO para entregar documentos completos. Los documentos se entregan después.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Juan choca el lunes. Debe avisar a su aseguradora a más tardar el sábado (5 días naturales). Si avisa 10 días después sin justificación, la aseguradora puede reducir la indemnización o rechazar el siniestro.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2. AVISO A LAS AUTORIDADES'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Debe darse aviso a las autoridades cuando:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Casos que requieren autoridad:',
      'items', jsonb_build_array(
        '✓ Existan daños a TERCEROS',
        '✓ Existan LESIONADOS o MUERTOS',
        '✓ Haya DESACUERDO entre las partes',
        '✓ Sea ROBO (Ministerio Público)',
        '✓ Sea necesario levantar ACTA o PARTE oficial',
        '✓ Lo requiera la ASEGURADORA'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'ERROR COMÚN: Llegar a un "arreglo" sin levantar parte oficial. Si después surgen problemas, NO hay prueba oficial del accidente.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '3. COOPERACIÓN DEL ASEGURADO'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'El asegurado está OBLIGADO a:',
      'items', jsonb_build_array(
        '✓ Proporcionar información VERAZ',
        '✓ Facilitar la INVESTIGACIÓN',
        '✓ NO admitir RESPONSABILIDAD sin autorización',
        '✓ NO negociar con terceros sin autorización',
        '✓ Preservar EVIDENCIAS',
        '✓ Cooperar con ajustadores',
        '✓ Entregar documentación COMPLETA'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'NUNCA admitas responsabilidad en el lugar del accidente. Deja que la aseguradora investigue y determine. Admitir culpa puede afectar tu indemnización.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Caso de lo que NO debes hacer: Juan choca. En el lugar dice "Sí fue mi culpa, te pago todo". Firma un papel donde acepta responsabilidad total. Después la aseguradora investiga y encuentra que la culpa NO era de Juan, pero ya firmó aceptando. Ahora tiene problemas legales.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'PÉRDIDA PARCIAL vs PÉRDIDA TOTAL'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'MEMORIZA ESTOS PORCENTAJES. Son PREGUNTA OBLIGADA en el examen: 50% y 75%.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'PÉRDIDA PARCIAL'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Se considera pérdida PARCIAL cuando el costo de reparación es MENOR al 50% del valor comercial del vehículo.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características de pérdida parcial:',
      'items', jsonb_build_array(
        'Costo de reparación < 50% del valor comercial',
        'El auto SE REPARA',
        'El asegurado CONSERVA el vehículo',
        'Se aplica DEMÉRITO en algunas partes',
        'No se entregan documentos originales'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Auto vale $300,000. Costo de reparación: $120,000. Porcentaje: $120,000 / $300,000 = 40%. Como es MENOR a 50%, es pérdida PARCIAL. Se repara el auto.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'ZONA GRIS (50% a 75%)'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: Entre 50% y 75%, el asegurado puede OPTAR por declararla total o parcial.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Cuando el costo de reparación está entre 50% y 75% del valor comercial, existe la OPCIÓN de tratarla como total o parcial.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Opciones en zona gris:',
      'items', jsonb_build_array(
        'El ASEGURADO puede elegir',
        'Si elige PARCIAL: se repara, conserva el auto',
        'Si elige TOTAL: recibe el valor, entrega documentos',
        'Generalmente conviene declarar TOTAL'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo zona gris: Auto vale $300,000. Reparación: $180,000. Porcentaje: 60%. El asegurado puede elegir: 1) Recibir $180,000 y reparar (conserva auto), o 2) Declarar pérdida total, recibir $300,000 y entregar documentos.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'PÉRDIDA TOTAL'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Se considera pérdida TOTAL cuando el costo de reparación SUPERA el 75% del valor comercial inmediato anterior al siniestro.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO: Se compara contra el VALOR COMERCIAL, NO contra la suma asegurada.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características de pérdida total:',
      'items', jsonb_build_array(
        'Costo de reparación > 75% del valor comercial',
        'El auto NO se repara',
        'Se PAGA el valor comercial',
        'El asegurado ENTREGA documentos originales',
        'La aseguradora se queda con el SALVAMENTO',
        'Se da de BAJA del RFC y Hacienda'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo pérdida total: Auto vale $300,000. Daños: $250,000. Porcentaje: $250,000 / $300,000 = 83%. Como supera 75%, es pérdida TOTAL obligatoria. La aseguradora paga $300,000 (valor comercial), el asegurado entrega factura, tenencias, placas. La aseguradora se queda con el auto para venderlo como salvamento.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'TABLA RESUMEN: PÉRDIDA PARCIAL vs TOTAL'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'PÉRDIDA PARCIAL (< 50%):',
      'items', jsonb_build_array(
        'Se REPARA el auto',
        'Asegurado CONSERVA vehículo',
        'NO entrega documentos',
        'Se aplica demérito'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'ZONA GRIS (50% - 75%):',
      'items', jsonb_build_array(
        'ASEGURADO ELIGE',
        'Puede reparar O declarar total',
        'Generalmente conviene total'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'PÉRDIDA TOTAL (> 75%):',
      'items', jsonb_build_array(
        'NO se repara',
        'Se paga VALOR COMERCIAL',
        'Asegurado ENTREGA documentos',
        'Aseguradora se queda con SALVAMENTO'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'DEMÉRITO'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El demérito es un porcentaje que se RESTA del valor de ciertas partes por su USO, DESGASTE o DEPRECIACIÓN.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'El demérito se aplica en PÉRDIDA PARCIAL cuando se reponen partes que ya tenían uso.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Partes que tienen demérito:',
      'items', jsonb_build_array(
        'LLANTAS (desgaste por uso)',
        'MOTOR (depreciación)',
        'ACUMULADOR (batería)',
        'Componentes ELÉCTRICOS',
        'CLUTCH (embrague)',
        'FRENOS',
        'Partes con DESGASTE natural'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo de demérito: Se dañan 4 llantas en el accidente. Las llantas nuevas cuestan $12,000. Pero las llantas dañadas tenían 50% de desgaste (demérito 50%). La aseguradora paga: $12,000 - 50% = $6,000. El asegurado paga los otros $6,000 si quiere llantas nuevas.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: En pérdida TOTAL NO se aplica demérito porque se paga el valor COMERCIAL del vehículo completo (que ya incluye la depreciación).'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'SUBROGACIÓN DE DERECHOS'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Subrogación es el derecho que adquiere la aseguradora de reclamar a terceros responsables, hasta por el monto que pagó al asegurado.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características de la subrogación:',
      'items', jsonb_build_array(
        'La aseguradora se SUBROGA en los derechos del asegurado',
        'Solo hasta por el monto PAGADO',
        'Puede reclamar a TERCEROS responsables',
        'El asegurado NO puede afectar estos derechos',
        'Si la aseguradora recupera, NO afecta al asegurado'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Juan choca contra el auto de María. María tiene seguro. Su aseguradora le paga $100,000 por los daños. Después, la aseguradora de María SE SUBROGA y reclama a Juan (o a la aseguradora de Juan) los $100,000 que pagó.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'SALVAMENTOS'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Salvamento son los restos del vehículo después de pagar una pérdida total.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Reglas del salvamento:',
      'items', jsonb_build_array(
        'Cuando la aseguradora paga PÉRDIDA TOTAL',
        'Puede disponer LIBREMENTE del vehículo (salvamento)',
        'EXCEPTO equipo especial NO asegurado',
        'Generalmente vende el salvamento',
        'El dinero recuperado es para la aseguradora'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: La aseguradora paga $300,000 por pérdida total. Se queda con el auto (salvamento). Lo vende en subasta por $80,000. Esos $80,000 son para la aseguradora, no para el asegurado.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 3.4'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave:',
      'items', jsonb_build_array(
        'Dar aviso en 5 DÍAS NATURALES',
        'Avisar a autoridades si hay daños a terceros o lesionados',
        'NO admitir responsabilidad sin autorización',
        'PÉRDIDA PARCIAL = < 50% del valor',
        'ZONA GRIS = 50% a 75% (asegurado elige)',
        'PÉRDIDA TOTAL = > 75% del valor',
        'Demérito se aplica en pérdida parcial',
        'Subrogación: aseguradora reclama a terceros',
        'Salvamento: aseguradora se queda con restos en pérdida total'
      )
    )
  )
),
duracion_estimada_minutos = 50,
updated_at = now()
WHERE titulo = 'Lección 3.4 - Pérdida Total y Parcial';

-- Lección 3.5: Documentación para Indemnización
UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 3.5: DOCUMENTACIÓN PARA INDEMNIZACIÓN'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'La documentación completa y correcta es FUNDAMENTAL para que proceda el pago. La falta de un documento puede retrasar o impedir la indemnización.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'DOCUMENTOS GENERALES (Todos los siniestros)'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Documentos básicos que SIEMPRE se requieren:',
      'items', jsonb_build_array(
        '✓ PÓLIZA original o copia certificada',
        '✓ IDENTIFICACIÓN oficial vigente del asegurado',
        '✓ COMPROBANTE de domicilio reciente',
        '✓ FORMATO de reclamación lleno y firmado',
        '✓ LICENCIA de conducir vigente del conductor',
        '✓ TARJETA de circulación',
        '✓ Último pago de TENENCIA o refrendo'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: Si el CONDUCTOR no tiene licencia vigente, NO se pagan daños materiales (aunque SÍ se paga RC a terceros).'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'DOCUMENTACIÓN PARA DAÑOS MATERIALES'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Además de los generales:',
      'items', jsonb_build_array(
        '✓ Reporte del AJUSTADOR',
        '✓ PRESUPUESTO de reparación',
        '✓ FOTOGRAFÍAS del daño',
        '✓ PARTE oficial (si hay terceros o lesionados)',
        '✓ FACTURA del vehículo (solo para verificación)',
        '✓ Formato de AUTORIZACIÓN de reparación'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Proceso de DM: 1) Das aviso, 2) La aseguradora manda ajustador, 3) Ajustador inspecciona y autoriza, 4) Llevas a taller autorizado, 5) Reparan, 6) Recoges auto reparado. Si es taller de red, NO pagas (pago directo). Si es fuera de red, pagas y te reembolsan.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'DOCUMENTACIÓN PARA ROBO TOTAL'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Robo Total requiere MÁS documentación que cualquier otra cobertura. Es el proceso MÁS complejo.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Documentos OBLIGATORIOS para robo total:',
      'items', jsonb_build_array(
        '✓ ACTA levantada ante el MINISTERIO PÚBLICO',
        '✓ Aviso de robo ante REPUVE (Registro Público Vehicular)',
        '✓ FACTURA ORIGINAL endosada a favor de la aseguradora',
        '✓ TENENCIAS pagadas (últimos 5 años)',
        '✓ DERECHOS de control vehicular pagados',
        '✓ JUEGO DE LLAVES completo (ambas llaves)',
        '✓ TARJETA de circulación original',
        '✓ PLACAS (si se recuperan)',
        '✓ Baja de PLACAS ante Hacienda',
        '✓ Comprobante de NO ADEUDO vehicular',
        '✓ Carta de NO EMPEÑO',
        '✓ PÓLIZA original'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO: Si NO tienes las DOS LLAVES, la aseguradora puede RECHAZAR el pago o REDUCIR significativamente la indemnización (hasta 50% menos).'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo de rechazo por llaves: A María le roban su auto. Solo tiene UNA llave, la otra la perdió hace meses. Presenta reclamación. La aseguradora REDUCE el pago al 50% porque sin la segunda llave, sospecha que podría ser fraude o que facilitó el robo.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'PROCEDIMIENTO EN CASO DE ROBO TOTAL'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Pasos a seguir:',
      'items', jsonb_build_array(
        '1. AVISAR inmediatamente a la aseguradora',
        '2. LEVANTAR acta ante Ministerio Público (máximo 24-48 hrs)',
        '3. REPORTAR al REPUVE',
        '4. REUNIR toda la documentación',
        '5. ESPERAR periodo de localización (30-60 días generalmente)',
        '6. Si NO se localiza, presentar documentación completa',
        '7. La aseguradora VALIDA documentos',
        '8. Se PAGA el valor comercial',
        '9. Asegurado ENTREGA documentos originales'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: Hay un PERIODO DE ESPERA (30-60 días) para ver si el auto se recupera. No se paga inmediatamente.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Caso de auto recuperado: Le roban el auto a Juan. Levanta acta, avisa a aseguradora. A los 20 días, la policía recupera el auto. Como se recuperó ANTES del plazo, NO se paga pérdida total. Si el auto tiene daños, se pagan como daños materiales.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'DOCUMENTACIÓN PARA RESPONSABILIDAD CIVIL'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Cuando el asegurado causa daños a terceros:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Documentos del ASEGURADO:',
      'items', jsonb_build_array(
        '✓ PARTE oficial del accidente',
        '✓ ACTA administrativa (si la hay)',
        '✓ Identificación y licencia del conductor',
        '✓ Tarjeta de circulación',
        '✓ Póliza'
      )
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Documentos del TERCERO AFECTADO:',
      'items', jsonb_build_array(
        '✓ Identificación oficial',
        '✓ FACTURA del vehículo dañado',
        '✓ PRESUPUESTO de reparación',
        '✓ FOTOGRAFÍAS del daño',
        '✓ Tarjeta de circulación',
        '✓ Licencia de conducir',
        '✓ Comprobante de propiedad',
        '✓ Acta o parte oficial'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'La aseguradora NO pagará al tercero sin verificar que efectivamente es el propietario y que los daños corresponden al accidente reportado.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'DOCUMENTACIÓN PARA GASTOS MÉDICOS A OCUPANTES'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Documentos requeridos:',
      'items', jsonb_build_array(
        '✓ Reporte MÉDICO del accidente',
        '✓ RECETAS médicas',
        '✓ FACTURAS de medicamentos',
        '✓ Comprobantes de HOSPITALIZACIÓN',
        '✓ Resumen CLÍNICO',
        '✓ ESTUDIOS de laboratorio y gabinete',
        '✓ Parte oficial del ACCIDENTE',
        '✓ Identificación del LESIONADO'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Todos los gastos deben estar FACTURADOS a nombre del asegurado o del afectado. NO se aceptan tickets ni notas sin factura.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'PLAZOS DE PAGO'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Una vez que la aseguradora recibe documentación COMPLETA y CORRECTA, tiene plazos legales para pagar.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Plazos legales:',
      'items', jsonb_build_array(
        'Documentación completa → 30 DÍAS NATURALES para pagar',
        'Si falta documentación → Solicita en 30 días',
        'Asegurado entrega faltantes → Otros 30 días para pagar',
        'Si no paga a tiempo → INTERESES MORATORIOS'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: Los 30 días corren desde que la aseguradora recibe documentación COMPLETA. Si falta algo, el plazo se detiene hasta que se entregue.'
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo de plazos: María presenta reclamación el 1 de enero. Falta el acta del MP. La aseguradora le avisa el 15 de enero. María entrega el acta el 1 de febrero. Desde el 1 de febrero corren 30 días. La aseguradora debe pagar a más tardar el 3 de marzo.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'CAUSAS COMUNES DE RECHAZO POR DOCUMENTACIÓN'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Rechazos frecuentes:',
      'items', jsonb_build_array(
        '❌ Conductor SIN LICENCIA vigente',
        '❌ Falta de LLAVES en robo total',
        '❌ NO levantar ACTA en robo',
        '❌ Aviso TARDÍO sin justificación',
        '❌ Información FALSA o contradictoria',
        '❌ TENENCIAS no pagadas',
        '❌ Facturas a nombre de OTRA PERSONA',
        '❌ Auto con REPORTE de robo previo',
        '❌ Documentación INCOMPLETA persistente'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RECOMENDACIONES PARA EL ASEGURADO'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Consejos prácticos:',
      'items', jsonb_build_array(
        '1. Siempre lleva tu LICENCIA vigente',
        '2. Ten copias de FACTURA y PÓLIZA en el auto',
        '3. En robo, guarda las DOS LLAVES',
        '4. Mantén TENENCIAS pagadas',
        '5. NO admitas culpa en el lugar del accidente',
        '6. TOMA FOTOS inmediatamente',
        '7. Anota datos de TESTIGOS',
        '8. Avisa a tu aseguradora TAN PRONTO como sea posible',
        '9. Sigue INSTRUCCIONES de la aseguradora',
        '10. Guarda TODOS los comprobantes'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'ERRORES COMUNES EN DOCUMENTACIÓN'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Evita estos errores:',
      'items', jsonb_build_array(
        '❌ NO tener copia de la póliza',
        '❌ Perder el juego de llaves',
        '❌ NO tomar fotos del accidente',
        '❌ Firmar documentos sin leer',
        '❌ NO guardar comprobantes',
        '❌ Facturas a nombre equivocado',
        '❌ Declaraciones contradictorias',
        '❌ NO cooperar con ajustador'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 3.5'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave:',
      'items', jsonb_build_array(
        'Documentación completa es OBLIGATORIA para pago',
        'Siempre: póliza, identificación, licencia, tarjeta circulación',
        'Robo total: acta MP, REPUVE, factura endosada, llaves, tenencias',
        'SIN LLAVES = posible reducción del 50%',
        'RC: requiere documentos del tercero afectado',
        'GMO: requiere facturas médicas y reporte del accidente',
        '30 días para pagar desde documentación COMPLETA',
        'Sin licencia = NO se pagan daños materiales',
        'Toma FOTOS siempre',
        'Guarda las DOS llaves'
      )
    )
  )
),
duracion_estimada_minutos = 45,
updated_at = now()
WHERE titulo = 'Lección 3.5 - Documentación para Indemnización';