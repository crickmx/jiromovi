/*
  # Expansión Módulo 3 - Lección 3.2

  1. Actualizar Lección 3.2 con ramo de automóviles y clasificación completa
*/

UPDATE cedula_a_lecciones
SET contenido = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'type', 'titulo',
      'content', 'LECCIÓN 3.2: RAMO DE AUTOMÓVILES - OBJETIVO Y CLASIFICACIÓN'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'La clasificación de vehículos es FUNDAMENTAL porque determina: el riesgo, la prima, las condiciones y las exclusiones. Es pregunta frecuente en el examen.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'OBJETIVO DEL SEGURO DE AUTOMÓVILES'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'El Seguro de Automóviles tiene como objetivo proteger el patrimonio del propietario del vehículo, frente a los riesgos a los que se encuentra expuesto durante su USO Y CIRCULACIÓN.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Palabras clave: USO y CIRCULACIÓN. Si el vehículo no está en uso ni circulación, algunas coberturas pueden no aplicar.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'El seguro de Automóviles cubre (según póliza contratada):',
      'items', jsonb_build_array(
        '✓ Daños materiales al VEHÍCULO ASEGURADO',
        '✓ ROBO TOTAL del vehículo',
        '✓ Responsabilidad civil por daños a TERCEROS',
        '✓ Gastos médicos a OCUPANTES',
        '✓ Asistencia LEGAL',
        '✓ Asistencia VIAL (grúa, servicios de emergencia)'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo completo: Juan tiene seguro amplio de auto. Choca por su culpa. El seguro cubre: 1) Reparación de su auto (daños materiales), 2) Reparación del auto que golpeó (responsabilidad civil), 3) Gastos médicos de sus pasajeros (gastos médicos ocupantes), 4) Defensa legal si lo demandan, 5) Grúa para llevarse su auto.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'ALCANCE DE LA PROTECCIÓN'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'El seguro de automóviles protege durante:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Momentos de cobertura:',
      'items', jsonb_build_array(
        'Mientras el vehículo está en CIRCULACIÓN',
        'Mientras está ESTACIONADO',
        'Durante su TRANSPORTE (con las limitaciones de la póliza)',
        'En TERRITORIO NACIONAL',
        'En USA/Canadá (si se contrata extensión)'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: La cobertura territorial es limitada. Por default es territorio nacional. Para USA/Canadá se requiere extensión de cobertura.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'CLASIFICACIÓN DE LOS VEHÍCULOS ASEGURABLES'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO PARA EL EXAMEN: La clasificación determina la tarifa, condiciones y exclusiones. Debes conocer perfectamente las categorías.'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Los vehículos se clasifican para efectos del seguro considerando su TIPO, USO y PESO.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'A) CLASIFICACIÓN POR USO'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'Esta es la clasificación MÁS IMPORTANTE. El uso del vehículo determina el riesgo y por tanto la prima.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '1. AUTOS RESIDENTES PARTICULARES'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Vehículos de uso particular, propiedad de personas físicas, placas particulares, que NO se dedican a actividad comercial.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características:',
      'items', jsonb_build_array(
        'Uso: Personal, familiar',
        'Placas: Particulares',
        'Propietario: Persona física generalmente',
        'Riesgo: BAJO a MEDIO',
        'Prima: Más económica',
        'Ejemplos: Auto familiar, auto para ir al trabajo'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: El auto de María que usa para llevar a sus hijos a la escuela y para sus compras personales. Placas particulares, uso familiar. Es residente particular.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '2. AUTOS RESIDENTES DE CARGA'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Vehículos destinados al transporte de mercancías, con placas de carga.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características:',
      'items', jsonb_build_array(
        'Uso: Transporte de carga',
        'Placas: Federales o de carga',
        'Riesgo: ALTO (mayor uso, carreteras)',
        'Prima: MÁS ALTA',
        'Ejemplos: Camionetas de reparto, camiones de mudanza'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '3. AUTOS TURISTAS'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Vehículos con placas extranjeras que circulan temporalmente en México.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características:',
      'items', jsonb_build_array(
        'Placas: Extranjeras (USA, Canadá, etc.)',
        'Circulación: Temporal en México',
        'Cobertura: Limitada a territorio nacional',
        'Requieren: Póliza específica para turista',
        'Obligatorio: Seguro de RC para circular'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Un estadounidense con auto de placas de Texas viene de vacaciones a México. DEBE contratar seguro turista porque su seguro de USA generalmente NO cubre en México.'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'ERROR COMÚN: Muchos turistas piensan que su seguro extranjero los cubre en México. ¡FALSO! Necesitan seguro específico para México.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '4. AUTOS DE AGENCIA'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Vehículos nuevos que aún no han sido vendidos, propiedad de distribuidores o agencias.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características:',
      'items', jsonb_build_array(
        'Propiedad: Agencia automotriz',
        'Estado: Nuevos, sin vender',
        'Ubicación: En exhibición, tránsito, prueba',
        'Cobertura: Especial para agencias',
        'Incluye: Demostración, traslados'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '5. CAMIONES Y TRACTOCAMIONES'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Vehículos pesados destinados al transporte de carga de gran volumen.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características:',
      'items', jsonb_build_array(
        'Peso: Mayor a 3.5 toneladas generalmente',
        'Uso: Transporte de carga pesada',
        'Placas: Federales',
        'Riesgo: MUY ALTO',
        'Prima: MUY ALTA',
        'Cobertura: Puede incluir carga transportada'
      )
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', '6. AUTOBUSES Y MICROBUSES'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'Vehículos destinados al transporte de pasajeros.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Características:',
      'items', jsonb_build_array(
        'Uso: Transporte público o privado de pasajeros',
        'Capacidad: Más de 6 pasajeros generalmente',
        'Riesgo: ALTO (responsabilidad por pasajeros)',
        'RC: Muy importante (muchos terceros expuestos)',
        'Ejemplos: Autobuses de turismo, microbuses urbanos, transporte escolar'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'IMPORTANTE: Los autobuses tienen primas MÁS ALTAS porque el riesgo de responsabilidad civil es MAYOR (muchos pasajeros expuestos).'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'B) CLASIFICACIÓN POR PESO'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Otra clasificación importante es por el peso del vehículo:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Categorías por peso:',
      'items', jsonb_build_array(
        'LIGEROS: Hasta 3.5 toneladas (autos, pickups)',
        'MEDIANOS: De 3.5 a 12 toneladas',
        'PESADOS: Más de 12 toneladas (tractocamiones, trailers)'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'El peso influye en: tarifa, cobertura de responsabilidad civil necesaria, requisitos de la póliza.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'C) CLASIFICACIÓN POR TIPO DE SERVICIO'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Categorías:',
      'items', jsonb_build_array(
        'SERVICIO PARTICULAR: Uso personal y familiar',
        'SERVICIO PÚBLICO: Transporte remunerado (taxis, Uber)',
        'SERVICIO DE CARGA: Transporte de mercancías',
        'SERVICIO OFICIAL: Vehículos de gobierno'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo: Juan usa su auto para Uber. Su seguro de particular NO cubre porque ahora es servicio público. Necesita cambiar a póliza de servicio público (más cara).'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'ERROR MUY COMÚN: Usar un auto con seguro de particular para Uber/DiDi. ¡NO ESTÁ CUBIERTO! La aseguradora puede rechazar el siniestro por cambio de uso del vehículo.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'IMPORTANCIA DE LA CLASIFICACIÓN CORRECTA'
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'CRÍTICO: Declarar INCORRECTAMENTE la clasificación del vehículo puede resultar en PÉRDIDA TOTAL DE COBERTURA.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Por qué es importante la clasificación correcta:',
      'items', jsonb_build_array(
        '1. Determina la TARIFA (prima) correcta',
        '2. Define las CONDICIONES aplicables',
        '3. Establece EXCLUSIONES específicas',
        '4. Afecta los límites de RESPONSABILIDAD CIVIL',
        '5. Puede ANULAR la cobertura si es incorrecta'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Caso real de rechazo: Pedro aseguró su camioneta como particular. La usa para su negocio de construcción (carga materiales). Choca. La aseguradora investiga, descubre que es uso comercial, NO particular. RECHAZA el siniestro por declaración incorrecta de uso.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'FACTORES QUE DETERMINAN EL RIESGO'
    ),
    jsonb_build_object(
      'type', 'parrafo',
      'content', 'Además de la clasificación, otros factores que afectan el riesgo y la prima son:'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Factores de riesgo:',
      'items', jsonb_build_array(
        '✓ EDAD del conductor (menores de 25 = mayor riesgo)',
        '✓ SEXO (estadísticamente varones jóvenes = mayor riesgo)',
        '✓ CÓDIGO POSTAL (zona de circulación)',
        '✓ MARCA y MODELO del auto (autos deportivos = mayor riesgo)',
        '✓ HISTORIAL de siniestros del asegurado',
        '✓ USO anual estimado (kilómetros)',
        '✓ Lugar de PERNOCTA (calle, cochera, estacionamiento)'
      )
    ),
    jsonb_build_object(
      'type', 'caso_practico',
      'content', 'Ejemplo de tarificación: Auto 1: Honda Civic, conductor 35 años, casado, código postal de zona residencial, pernocta en cochera = Prima $8,000/año. Auto 2: Mustang deportivo, conductor 22 años, soltero, código postal centro ciudad, pernocta en calle = Prima $18,000/año. Mismo valor de auto, diferente riesgo.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'TERRITORIALIDAD DE LA COBERTURA'
    ),
    jsonb_build_object(
      'type', 'definicion',
      'content', 'La cobertura del seguro de automóviles tiene límites territoriales que deben conocerse.'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Territorios típicos de cobertura:',
      'items', jsonb_build_array(
        '✓ TERRITORIO NACIONAL (México) - SIEMPRE incluido',
        '✓ Estados Unidos y Canadá - Requiere EXTENSIÓN',
        '✓ Centroamérica - Generalmente requiere extensión',
        '✓ Otros países - NO cubiertos sin póliza específica'
      )
    ),
    jsonb_build_object(
      'type', 'alerta',
      'content', 'PARA USA/CANADÁ: La extensión típica cubre hasta 30 o 60 días. Para estancias más largas, se requiere seguro local.'
    ),
    jsonb_build_object(
      'type', 'titulo',
      'content', 'RESUMEN LECCIÓN 3.2'
    ),
    jsonb_build_object(
      'type', 'lista',
      'content', 'Puntos clave:',
      'items', jsonb_build_array(
        'El seguro de autos protege durante uso y circulación',
        'Cubre: daños propios, robo, RC, gastos médicos, asistencia',
        'Clasificación por USO es la más importante',
        'Tipos: Particular, Carga, Turista, Agencia, Camiones, Autobuses',
        'La clasificación determina: tarifa, condiciones, exclusiones',
        'Declarar mal la clasificación = pérdida de cobertura',
        'Usar auto particular para Uber = NO cubierto',
        'Edad del conductor afecta la prima',
        'Cobertura territorial: México incluido, USA/Canadá con extensión'
      )
    )
  )
),
duracion_estimada_minutos = 50,
updated_at = now()
WHERE titulo = 'Lección 3.2 - Conceptos Clave en Autos';