/*
  # Módulo 1 - Lección 1: Introducción al Sistema Asegurador Mexicano

  1. Contenido
    - Autoridades principales: SHCP, CNSF, CONDUSEF, CONAMED
    - Funciones específicas de cada autoridad
    - Basado en páginas 3-5 del Manual CNSF oficial
*/

INSERT INTO cedula_a_lecciones (modulo_id, titulo, contenido, orden, duracion_estimada_minutos)
SELECT
  m.id,
  'Lección 1.1 - Introducción al Sistema Asegurador Mexicano',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Sistema Asegurador Mexicano'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'La actividad aseguradora en México está regulada por diversas autoridades que velan por la protección del usuario y la estabilidad del sistema.'
      ),
      jsonb_build_object(
        'type', 'titulo',
        'content', 'Autoridades Principales'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'SHCP (Secretaría de Hacienda y Crédito Público): Máxima autoridad en materia de política económica y financiera del país. Diseña y ejecuta la política financiera, autoriza la constitución de instituciones de seguros y regula el sistema financiero mexicano.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'CNSF (Comisión Nacional de Seguros y Fianzas): Órgano desconcentrado de la SHCP, responsable de la supervisión de instituciones de seguros y fianzas. Supervisa el cumplimiento de la normativa, autoriza la operación de instituciones, protege los intereses del público usuario, regula la actividad de los agentes de seguros e impone sanciones por incumplimiento.'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'CONDUSEF (Comisión Nacional para la Protección y Defensa de los Usuarios de Servicios Financieros): Protección y defensa de los derechos de los usuarios de servicios financieros. Atiende quejas y reclamaciones, realiza arbitraje entre usuarios e instituciones, proporciona educación financiera y mantiene el Registro de Contratos de Adhesión (RECA).'
      ),
      jsonb_build_object(
        'type', 'definicion',
        'content', 'CONAMED (Comisión Nacional de Arbitraje Médico): Atención de controversias médicas. Realiza arbitraje en conflictos médico-paciente, emite dictámenes técnicos médicos y proporciona orientación sobre derechos en salud.'
      ),
      jsonb_build_object(
        'type', 'lista',
        'content', 'Funciones específicas de la CNSF:',
        'items', jsonb_build_array(
          'Vigilar la solvencia de las instituciones',
          'Revisar operaciones y prácticas',
          'Realizar inspecciones in situ',
          'Analizar información financiera',
          'Emitir disposiciones administrativas',
          'Autorizar productos y tarifas',
          'Establecer reservas técnicas',
          'Regular inversiones'
        )
      ),
      jsonb_build_object(
        'type', 'alerta',
        'content', 'Importante para el examen: Memoriza las siglas y funciones principales de cada autoridad. Es común que pregunten quién supervisa (CNSF), quién arbitra (CONDUSEF/CONAMED) y quién autoriza la constitución de instituciones (SHCP).'
      ),
      jsonb_build_object(
        'type', 'parrafo',
        'content', 'Fuente oficial: Páginas 3-5 del Manual CNSF para el examen de Cédula A'
      )
    )
  ),
  1,
  30
FROM cedula_a_modulos m WHERE m.orden = 1;