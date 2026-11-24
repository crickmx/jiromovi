/*
  # Reestructuración del Curso Cédula A - Estructura Oficial CNSF

  1. Cambios
    - Actualizar módulos para reflejar la estructura oficial del examen CNSF
    - Reorganizar lecciones conforme al temario oficial
    - Mantener exámenes de práctica existentes
    - Agregar peso/relevancia por módulo

  2. Estructura Nueva
    - Módulo 1: Aspectos Generales (Marco Jurídico + Técnico/Operativo) - PESO ALTO
    - Módulo 2: Riesgos Individuales - Personas (RISP) - PESO ALTO
    - Módulo 3: Riesgos Individuales - Daños (RISD) - PESO ALTO
    - Módulo 4: Sistemas y Mercados Financieros - PESO MEDIO
    - Módulo 5: Cálculos Financieros Básicos - PESO MEDIO
    - Módulo 6: Simulador de Examen CNSF - PESO CRÍTICO
*/

-- Eliminar lecciones existentes (cascade eliminará dependencias)
DELETE FROM cedula_a_lecciones;

-- Eliminar módulos existentes
DELETE FROM cedula_a_modulos;

-- Crear los 6 módulos oficiales según estructura CNSF
INSERT INTO cedula_a_modulos (id, titulo, descripcion, orden, duracion_estimada_minutos, created_at, updated_at)
VALUES
  (
    gen_random_uuid(),
    'Módulo 1: Aspectos Generales',
    'Marco jurídico que regula la actividad aseguradora, autoridades, obligaciones, sanciones y tipos de agentes. Peso en examen: ALTO',
    1,
    180,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'Módulo 2: Riesgos Individuales - Personas',
    'Seguros de vida, accidentes personales, gastos médicos mayores y seguro de salud. Peso en examen: ALTO',
    2,
    150,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'Módulo 3: Riesgos Individuales - Daños',
    'Seguro de automóviles: coberturas, siniestros, pérdida total y documentación para indemnización. Peso en examen: ALTO',
    3,
    150,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'Módulo 4: Sistemas y Mercados Financieros',
    'Sistema financiero mexicano, autoridades, sectores bancario, no bancario y bursátil. Peso en examen: MEDIO',
    4,
    90,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'Módulo 5: Cálculos Financieros Básicos',
    'Porcentajes, tasas de interés, regla de tres, capitalización y tasa de rendimiento. Peso en examen: MEDIO',
    5,
    120,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'Módulo 6: Simulador de Examen CNSF',
    'Examen completo cronometrado con reactivos tipo CNSF y retroalimentación por tema. Peso en examen: CRÍTICO',
    6,
    90,
    now(),
    now()
  );
