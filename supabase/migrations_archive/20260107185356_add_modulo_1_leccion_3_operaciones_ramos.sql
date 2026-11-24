/*
  # Módulo 1 - Lección 1.3: Operaciones y Ramos de Seguros

  1. Contenido
    - Operación de Vida
    - Accidentes y Enfermedades (AP, GMM, Salud)
    - Operación de Daños (11 ramos)
    - Basado en página 5 del Manual CNSF oficial
*/

INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 1.3 - Operaciones y Ramos de Seguros',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Clasificación de Operaciones y Ramos'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Operación de Vida'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Protege al asegurado contra riesgos que afecten su existencia, integridad física o salud.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Tipos de seguros de vida:',
        'items', jsonb_build_array(
          'Vida individual: Protección para una sola persona',
          'Vida grupo: Cobertura para grupos de personas',
          'Pensiones: Rentas vitalicias y planes de retiro',
          'Supervivencia: Pago al cumplir cierta edad'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Accidentes y Enfermedades'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Cubre riesgos de salud del asegurado. Se divide en tres grandes ramos:'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Accidentes Personales (AP): Cubre muerte accidental, invalidez total o parcial permanente y gastos funerarios. El evento debe ser súbito, violento, fortuito y externo.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Gastos Médicos Mayores (GMM): Cubre hospitalización, cirugía, maternidad, medicamentos y estudios. Opera con deducible (cantidad fija que paga el asegurado) y coaseguro (porcentaje que paga el asegurado después del deducible).'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'Seguro de Salud: Opera con red de proveedores médicos, pago directo y sin deducibles ni coaseguros (solo copagos fijos). Requiere autorización previa para ciertos servicios.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Operación de Daños (11 Ramos Oficiales)'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Los 11 ramos autorizados en México:',
        'items', jsonb_build_array(
          '1. Responsabilidad Civil y Riesgos Profesionales',
          '2. Marítimo y Transportes',
          '3. Incendio',
          '4. Agrícola y de Animales',
          '5. Automóviles y Camiones',
          '6. Crédito',
          '7. Diversos (incluye múltiples coberturas)',
          '8. Terremoto y Riesgos Catastróficos',
          '9. Garantía Financiera',
          '10. Crédito a la Vivienda',
          '11. Daños a Bienes Inmuebles para Crédito a la Vivienda'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Para el examen: Memoriza los 11 ramos de la Operación de Daños. Es pregunta frecuente. El seguro de automóviles es el más común y es del ramo 5. Recuerda que GMM opera con deducible y coaseguro, mientras que Salud opera con copagos fijos.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Página 5 del Manual CNSF'
      )
    )
  ),
  3,
  40
FROM cedula_a_modulos m WHERE m.orden = 1;