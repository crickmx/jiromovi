/*
  Cédula A: módulo de cada pregunta y orden de los exámenes.

  1. Las 100 preguntas del simulador final no tenían modulo_referencia_id, así
     que el desglose por módulo del resultado quedaba vacío. Siguen el orden del
     temario, por lo que se asignan por rangos de `orden`:
       1–20  Módulo 1 (aspectos generales: marco legal, autoridades, agentes)
       21–40 Módulo 2 (personas: AP, GMM, salud, vida)
       41–65 Módulo 3 (daños: autos)
       66–80 Módulo 4 (sistema financiero)
       81–94 Módulo 5 (cálculos financieros)
       95–100 Módulo 6 (integración y estrategia de examen)
  2. Las preguntas de práctica sin módulo toman el módulo de su examen.
  3. El examen de práctica del Módulo 2 tenía orden 1 (igual que el del
     Módulo 1): cada práctica toma el orden de su módulo.
*/

UPDATE public.cedula_a_preguntas q
SET modulo_referencia_id = m.id
FROM public.cedula_a_examenes e, public.cedula_a_modulos m
WHERE q.examen_id = e.id
  AND e.tipo = 'final'
  AND m.orden = CASE
    WHEN q.orden <= 20 THEN 1
    WHEN q.orden <= 40 THEN 2
    WHEN q.orden <= 65 THEN 3
    WHEN q.orden <= 80 THEN 4
    WHEN q.orden <= 94 THEN 5
    ELSE 6
  END;

UPDATE public.cedula_a_preguntas q
SET modulo_referencia_id = e.modulo_id
FROM public.cedula_a_examenes e
WHERE q.examen_id = e.id
  AND e.tipo = 'practica'
  AND q.modulo_referencia_id IS NULL
  AND e.modulo_id IS NOT NULL;

UPDATE public.cedula_a_examenes e
SET orden = m.orden
FROM public.cedula_a_modulos m
WHERE e.modulo_id = m.id
  AND e.tipo = 'practica'
  AND e.orden <> m.orden;
