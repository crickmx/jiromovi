/*
  # Módulo 1 - Lección 1.2: Leyes y Reglamentos del Seguro

  1. Contenido
    - LISF (Ley de Instituciones de Seguros y Fianzas)
    - Ley sobre el Contrato de Seguro
    - Reglamento de Agentes
    - Leyes supletorias y jerarquía normativa
    - Basado en páginas 4-5 del Manual CNSF oficial
*/

INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 1.2 - Leyes y Reglamentos del Seguro',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Marco Legal del Seguro en México'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Leyes Principales'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '1. Ley de Instituciones de Seguros y Fianzas (LISF): Regula la organización, operación y funcionamiento de las instituciones de seguros y fianzas. Establece normas sobre constitución y autorización, capital mínimo, operaciones permitidas, reservas técnicas, inversiones, reaseguro, fusiones y escisiones, y sanciones administrativas.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '2. Ley sobre el Contrato de Seguro: Establece las reglas generales del contrato de seguro, derechos y obligaciones de las partes. Define el contrato de seguro, elementos esenciales, obligaciones del asegurado y asegurador, causas de nulidad, prescripción (2 años), subrogación de derechos y procedimiento de reclamación.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', '3. Reglamento de Agentes de Seguros y Fianzas: Norma la actividad de los agentes: requisitos, obligaciones y sanciones. Establece tipos de agentes, requisitos para obtener cédula, obligaciones y prohibiciones, causas de suspensión y revocación, procedimiento sancionador y seguro de RC profesional.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Leyes Supletorias (se aplican cuando las leyes especiales no contemplan alguna situación):',
        'items', jsonb_build_array(
          'Código Civil Federal',
          'Código de Comercio',
          'Ley Federal de Protección al Consumidor',
          'Ley para la Transparencia y Ordenamiento de los Servicios Financieros'
        )
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Jerarquía Normativa'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Orden de prelación de las normas jurídicas:',
        'items', jsonb_build_array(
          '1. Constitución Política de los Estados Unidos Mexicanos',
          '2. Tratados Internacionales',
          '3. Leyes Federales (LISF, Ley sobre el Contrato de Seguro)',
          '4. Reglamentos (Reglamento de Agentes)',
          '5. Circulares y Disposiciones Administrativas (emitidas por CNSF)'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Importante para el examen: En caso de conflicto entre normas, prevalece la de mayor jerarquía. Las leyes especiales (LISF, Ley sobre Contrato de Seguro) tienen prioridad sobre las leyes generales (Código Civil, Código de Comercio). La prescripción en el seguro es de 2 años.'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Páginas 4-5 del Manual CNSF'
      )
    )
  ),
  2,
  30
FROM cedula_a_modulos m WHERE m.orden = 1;