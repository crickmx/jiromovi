/*
  # Insert 29 Academia de Negocios 2025 Lessons

  1. Changes
    - Insert 29 educational video lessons for "Academia de Negocios 2025"
    - All lessons visible to all users (empty oficinas_asignadas)
    - Videos hosted on Google Drive with converted embeddable URLs
    - Thumbnails from Google Drive or default logo fallback

  2. Lesson Details
    - Category: Academia de Negocios 2025
    - Total lessons: 29
    - Lessons with custom thumbnails: 18
    - Lessons with default logo: 11
    - All lessons set to duration 0 (can be updated later)
    
  3. URL Conversion
    - Video URLs converted to embed format: /file/d/{ID}/preview
    - Image URLs converted to direct view: /uc?export=view&id={ID}
    - Default logo: https://movi.digital/wp-content/uploads/elementor/thumbs/SE_logo-qi2h8gdjgh6jj941hy1ii3ma59is7tbjiuao4t0a2o.png
*/

-- Get category ID and admin user ID for all inserts
DO $$
DECLARE
  v_categoria_id uuid;
  v_admin_id uuid;
  v_default_logo text := 'https://movi.digital/wp-content/uploads/elementor/thumbs/SE_logo-qi2h8gdjgh6jj941hy1ii3ma59is7tbjiuao4t0a2o.png';
BEGIN
  -- Get Academia de Negocios 2025 category ID
  SELECT id INTO v_categoria_id
  FROM seguros_categories
  WHERE nombre = 'Academia de Negocios 2025'
  LIMIT 1;

  -- Get first admin user ID
  SELECT id INTO v_admin_id
  FROM usuarios
  WHERE rol = 'Administrador' AND activo = true
  ORDER BY created_at
  LIMIT 1;

  -- Insert lessons with custom thumbnails
  
  -- Lesson 1: Gestión de Siniestros: Protocolo de Respuesta Inmediata
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Gestión de Siniestros: Protocolo de Respuesta Inmediata',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1zuVK0nUcn5yVymf85jpyECnIa6jmdII4/preview',
    'https://drive.google.com/uc?export=view&id=1l3UVM1-7A_uB__8t7Et08s_TcEQSfLYv',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Gestión de Siniestros: Protocolo de Respuesta Inmediata'
  );

  -- Lesson 2: Secretos del Seguro de Auto MAPFRE (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Secretos del Seguro de Auto MAPFRE',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1J_6F4ulWz_v5PqouhFziJwacZWpLuK3m/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Secretos del Seguro de Auto MAPFRE'
  );

  -- Lesson 3: Inversión en Salud: GMM para Jóvenes (AXA)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Inversión en Salud: GMM para Jóvenes (AXA)',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/14pzImzjryVEtLKeM03RkZoJ-pH9DiEqM/preview',
    'https://drive.google.com/uc?export=view&id=1NI_tB0KB0LyRShlSJaEfzC3rrtIuy9Oh',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Inversión en Salud: GMM para Jóvenes (AXA)'
  );

  -- Lesson 4: Cobertura Esencial: Accidentes Personales Colectivos
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Cobertura Esencial: Accidentes Personales Colectivos',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1VidpEBXrSS3YHDmF92BO_zfBhAumzCTp/preview',
    'https://drive.google.com/uc?export=view&id=11Nrp7Wc1vdMO3-XYSAfXRQ-FYdoTVGYW',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Cobertura Esencial: Accidentes Personales Colectivos'
  );

  -- Lesson 5: Libertad Financiera: Tu Plan de Retiro con GNP
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Libertad Financiera: Tu Plan de Retiro con GNP',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1IwIpL__yaO8DRzC0wJLwiXhqUvMXj9zg/preview',
    'https://drive.google.com/uc?export=view&id=1b8JA_IQ4Qx3ElXBk2LZJgEcCFRCfqMcT',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Libertad Financiera: Tu Plan de Retiro con GNP'
  );

  -- Lesson 6: Blindaje Legal para Agentes de Seguros
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Blindaje Legal para Agentes de Seguros',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1z-9Ay9IFA1WxB4dA39EJ35esaSuMZBkF/preview',
    'https://drive.google.com/uc?export=view&id=1Yz2NpuvWS6MA_krW_uTFIUV4U3WQ0y7K',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Blindaje Legal para Agentes de Seguros'
  );

  -- Lesson 7: Domina Qualitas: Herramientas y Estrategias
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Domina Qualitas: Herramientas y Estrategias',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/15hX22yK2EDSr2R2ijeW5UP1g_SAolC7m/preview',
    'https://drive.google.com/uc?export=view&id=1AoA_PUTpA98T8XsS6vJpIzztwDTpI343',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Domina Qualitas: Herramientas y Estrategias'
  );

  -- Lesson 8: Control Total: Liderazgo Personal y Financiero (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Control Total: Liderazgo Personal y Financiero',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1c1P--ypanEhlHlKCj-mymY4hCCDKqKwW/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Control Total: Liderazgo Personal y Financiero'
  );

  -- Lesson 9: JIRO 2025: Metas, Avances y Estrategias de Éxito (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'JIRO 2025: Metas, Avances y Estrategias de Éxito',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1tG_qnOuzvI7z5u6uGv3VKKL03z3WlHwy/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'JIRO 2025: Metas, Avances y Estrategias de Éxito'
  );

  -- Lesson 10: Impulsa tu Éxito: Creación de Marca Personal
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Impulsa tu Éxito: Creación de Marca Personal',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1w2PQVUvBQWzr1v-gUPgOtjdDQFDRdfQk/preview',
    'https://drive.google.com/uc?export=view&id=1ZlidOiSY7kJspUeYCLHyF-qgSGqonoUE',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Impulsa tu Éxito: Creación de Marca Personal'
  );

  -- Lesson 11: Salud a la Carta: Protección Médica MAPFRE
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Salud a la Carta: Protección Médica MAPFRE',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1O4iEO9IB-9knlCV2iPgy8I3YMrFAtVDN/preview',
    'https://drive.google.com/uc?export=view&id=1KAXO0ZoBqG8PxsTwttZp2MwWeUuILc1E',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Salud a la Carta: Protección Médica MAPFRE'
  );

  -- Lesson 12: QCREA Qualitas: Protegiendo Autos Financiados
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'QCREA Qualitas: Protegiendo Autos Financiados',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1ag50gNcQtP6g1ygAREVCOPEN_nO6uQBk/preview',
    'https://drive.google.com/uc?export=view&id=1EQb9bAEEby5SLon0y9voGWCs-oe3dxvz',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'QCREA Qualitas: Protegiendo Autos Financiados'
  );

  -- Lesson 13: UNIKUZ BX+: El GMM que Mereces
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'UNIKUZ BX+: El GMM que Mereces',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1LpxweFlwTBZZqH9JNCySPfxrdzw0I_Jb/preview',
    'https://drive.google.com/uc?export=view&id=1hVCMJXE0gqVxgzpdUw1ZcnQTypSaabMs',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'UNIKUZ BX+: El GMM que Mereces'
  );

  -- Lesson 14: El Arte de la Captación: Estrategias de Clientes
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'El Arte de la Captación: Estrategias de Clientes',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1Y90mK21BiFq--siRRvvD2jdDfaMFyGjz/preview',
    'https://drive.google.com/uc?export=view&id=1L-OPI352py5Mg-MngPWOCqAQo5ugV3it',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'El Arte de la Captación: Estrategias de Clientes'
  );

  -- Lesson 15: Guía Legal Avanzada para Agentes
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Guía Legal Avanzada para Agentes',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1oPoe8TgIv5NwOvtUG7yh7LNAQwECOkRg/preview',
    'https://drive.google.com/uc?export=view&id=1YNlesqvR66iKH_CrbVk4Y3DWO75e0XZH',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Guía Legal Avanzada para Agentes'
  );

  -- Lesson 16: Qualitas Salud: Maximiza tu Cobertura Médica
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Qualitas Salud: Maximiza tu Cobertura Médica',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1xTDNLbfoKh15L7uWCOUGd1yFWlnldfMB/preview',
    'https://drive.google.com/uc?export=view&id=1yQGBB6z0vMaQMtwAV66_QLv_c0pVZxqj',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Qualitas Salud: Maximiza tu Cobertura Médica'
  );

  -- Lesson 17: Conversión Imparable: Funnel de Ventas Digital
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Conversión Imparable: Funnel de Ventas Digital',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1VY-0V6DlBxNZHxuYlQZQ7TdKaKkm2tPZ/preview',
    'https://drive.google.com/uc?export=view&id=1MMU9vaye_kTKqxqaSvRnOpVSd5AwbG-q',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Conversión Imparable: Funnel de Ventas Digital'
  );

  -- Lesson 18: Vende Más: Las Bases de las Ventas Exitosas
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Vende Más: Las Bases de las Ventas Exitosas',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/195RA5lOGsZLYB2vJ8gz7gKE0PG4YXmPI/preview',
    'https://drive.google.com/uc?export=view&id=1hLWBPa3tONlDzzQjjJogny4xcrFFe_6G',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Vende Más: Las Bases de las Ventas Exitosas'
  );

  -- Lesson 19: Prospección 2.0: Éxito en Redes Sociales (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Prospección 2.0: Éxito en Redes Sociales',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1SXCeA8ggqx3OgBZskbQ6zWjJp4BwrziM/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Prospección 2.0: Éxito en Redes Sociales'
  );

  -- Lesson 20: VITALIA: Diseña tu Retiro de Lujo (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'VITALIA: Diseña tu Retiro de Lujo',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/10XLrSMLNBRfY63ON73hMOPp4qSYvNqKF/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'VITALIA: Diseña tu Retiro de Lujo'
  );

  -- Lesson 21: Lecciones Maestras: Sesión de Cierre con Diana (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Lecciones Maestras: Sesión de Cierre con Diana',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1ztWJYOTZK0clLJ_gCZFDk6bkkA5DEg_P/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Lecciones Maestras: Sesión de Cierre con Diana'
  );

  -- Lesson 22: Fundamentos y Estrategias Iniciales (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Fundamentos y Estrategias Iniciales',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1AOgTG4Wp9v8gaEiROot2Ezu52fNjXlLI/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Fundamentos y Estrategias Iniciales'
  );

  -- Lesson 23: Dominando GNP Autos: Cierre de Estrategias (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Dominando GNP Autos: Cierre de Estrategias',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1vzptkOu3VGPX4AVrkZy1WldbnGasa5ml/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Dominando GNP Autos: Cierre de Estrategias'
  );

  -- Lesson 24: Repensando tu Camino: Éxito en la Carrera de Seguros
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Repensando tu Camino: Éxito en la Carrera de Seguros',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1eyKpXqAJ8EEPXW6KJ91cl89O2BDxKtns/preview',
    'https://drive.google.com/uc?export=view&id=1gXrTMatgLtmQO5gpmXeLLFve3pUF8vGl',
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Repensando tu Camino: Éxito en la Carrera de Seguros'
  );

  -- Lesson 25: Supera tus Límites: Rompe el Techo de Cristal (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Supera tus Límites: Rompe el Techo de Cristal',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1k6yanPwVWy4lFQ0a-EyJ0A1yqnNduO50/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Supera tus Límites: Rompe el Techo de Cristal'
  );

  -- Lesson 26: PERSONALIZA GNP: Adaptando tus Gastos Médicos (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'PERSONALIZA GNP: Adaptando tus Gastos Médicos',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1DOJL_WJBmnA2ZsmOlwF5ZTX85zxUhvzm/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'PERSONALIZA GNP: Adaptando tus Gastos Médicos'
  );

  -- Lesson 27: Bienestar Digital: Manejo de Estrés con Tecnología (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'Bienestar Digital: Manejo de Estrés con Tecnología',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1Wo37ov99gTTv_dEPuknbRl99wMUtPsGO/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'Bienestar Digital: Manejo de Estrés con Tecnología'
  );

  -- Lesson 28: CHUBB Auto: Coberturas Premium y Análisis de Tarifa (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'CHUBB Auto: Coberturas Premium y Análisis de Tarifa',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1jQb4HYE6gzZU8d13VQ-japM9V5H4Udax/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'CHUBB Auto: Coberturas Premium y Análisis de Tarifa'
  );

  -- Lesson 29: ADN 2025: Evento Exclusivo de Lanzamiento (default logo)
  INSERT INTO seguros_lessons (titulo, descripcion, categoria_id, video_url, miniatura_url, duracion, oficinas_asignadas, es_grabacion, creado_por)
  SELECT 
    'ADN 2025: Evento Exclusivo de Lanzamiento',
    '',
    v_categoria_id,
    'https://drive.google.com/file/d/1q2IaZYq2Nft21E3RDwfk-LQ4RsIRkBeI/preview',
    v_default_logo,
    0,
    '[]'::jsonb,
    false,
    v_admin_id
  WHERE NOT EXISTS (
    SELECT 1 FROM seguros_lessons WHERE titulo = 'ADN 2025: Evento Exclusivo de Lanzamiento'
  );

END $$;
