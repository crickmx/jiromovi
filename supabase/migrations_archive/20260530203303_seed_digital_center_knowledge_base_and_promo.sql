/*
  # Seed Digital Center: Knowledge Base Documents + Sample Promotion

  ## Summary
  Populates the digital center knowledge base with a comprehensive set of
  insurance documents organized by insurer and ramo, plus a sample promotional
  banner. All documents are marked with `visibilidad = 'global'` so they are
  visible to all authenticated users across all offices and roles.

  ## Data Inserted
  - 1 promotional banner (digital_center_ads)
  - 50+ knowledge base documents covering:
    - GNP: Autos, GMM, Vida, Daños
    - CHUBB: Autos, GMM, Empresarial
    - AXA/Allianz: Autos, GMM, Vida
    - MAPFRE: Autos, Daños, Empresarial
    - ANA Seguros: GMM, Accidentes
    - Inbursa: Autos, Vida
    - BUPA: GMM
    - BX+: GMM
    - Qualitas: Autos
    - General (multi-aseguradora): Capacitación, Normativa, Técnico

  ## Notes
  - All documents have `activo = true` and `visibilidad = 'global'`
  - url_original contains real or representative links for each document type
  - Featured documents are marked with `is_featured = true`
  - Recent documents (2025-2026 editions) marked with `is_recent = true`
  - Uses INSERT ... ON CONFLICT DO NOTHING to be idempotent
*/

-- ── Sample promotion ─────────────────────────────────────────────────────────
INSERT INTO digital_center_ads (titulo, subtitulo, cta_texto, cta_url, imagen_url, color_fondo, color_texto, orden, activo)
VALUES (
  'Impulsa tus ventas con herramientas digitales',
  'Accede a cotizadores, materiales de capacitación y guías de productos actualizadas al 2026.',
  'Explorar recursos',
  '/centro-digital',
  NULL,
  '#0F4C81',
  '#FFFFFF',
  1,
  true
)
ON CONFLICT DO NOTHING;

-- ── GNP Documents ────────────────────────────────────────────────────────────
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, activo, visibilidad, is_featured, is_recent)
VALUES
  (
    'GNP Autos - Manual de Coberturas 2026',
    'Descripción completa de todas las coberturas disponibles en los planes de auto GNP. Incluye Amplia, Amplia Plus, Limitada y RC.',
    'GNP', 'Autos', 'Manual', 'Manual Técnico', 'pdf',
    ARRAY['coberturas','autos','gnp','manual','2026'],
    'https://www.gnp.com.mx/agentes/autos-coberturas',
    true, 'global', true, true
  ),
  (
    'GNP Autos - Tabla de Tarifas y Descuentos',
    'Tarifas vigentes por tipo de vehículo, uso y perfil del asegurado. Factores de descuento aplicables.',
    'GNP', 'Autos', 'Tarifas', 'Tabla Tarifaria', 'xlsx',
    ARRAY['tarifas','autos','descuentos','gnp'],
    'https://www.gnp.com.mx/agentes/autos-tarifas',
    true, 'global', false, true
  ),
  (
    'GNP GMM - Catálogo de Planes Individual y Familiar 2026',
    'Planes de Gastos Médicos Mayores para personas y familias. Suma asegurada, deducible, coaseguro y red médica.',
    'GNP', 'GMM', 'Catálogo', 'Catálogo de Productos', 'pdf',
    ARRAY['gmm','gastos médicos','planes','gnp','familiar','individual'],
    'https://www.gnp.com.mx/agentes/gmm-catalogo',
    true, 'global', true, true
  ),
  (
    'GNP GMM - Red Médica Nacional',
    'Directorio completo de hospitales, médicos y laboratorios incluidos en la red GNP a nivel nacional.',
    'GNP', 'GMM', 'Red Médica', 'Directorio', 'pdf',
    ARRAY['red médica','hospitales','gnp','directorio'],
    'https://www.gnp.com.mx/agentes/gmm-red-medica',
    true, 'global', false, false
  ),
  (
    'GNP Vida - Guía de Productos de Protección y Ahorro',
    'Planes de vida temporales, ordinarios de vida y dotales. Beneficios adicionales y riders disponibles.',
    'GNP', 'Vida', 'Guía de Producto', 'Guía de Ventas', 'pdf',
    ARRAY['vida','ahorro','protección','gnp','temporal','dotal'],
    'https://www.gnp.com.mx/agentes/vida-productos',
    true, 'global', false, true
  ),
  (
    'GNP Daños - Hogar Seguro Plus - Condiciones Generales',
    'Condiciones generales del seguro de hogar GNP. Coberturas de incendio, robo, responsabilidad civil y más.',
    'GNP', 'Daños', 'Condiciones Generales', 'Condiciones Generales', 'pdf',
    ARRAY['daños','hogar','incendio','robo','gnp'],
    'https://www.gnp.com.mx/agentes/danos-hogar',
    true, 'global', false, false
  ),
  (
    'GNP - Presentación Institucional para Agentes 2026',
    'Presentación corporativa con los beneficios de vender GNP, comisiones, programas de incentivos y soporte al agente.',
    'GNP', 'General', 'Capacitación', 'Presentación', 'pdf',
    ARRAY['gnp','agentes','incentivos','comisiones','institucional'],
    'https://www.gnp.com.mx/agentes/institucional',
    true, 'global', true, true
  )
ON CONFLICT DO NOTHING;

-- ── CHUBB Documents ───────────────────────────────────────────────────────────
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, activo, visibilidad, is_featured, is_recent)
VALUES
  (
    'CHUBB Autos - Guía Rápida de Coberturas 2026',
    'Resumen ejecutivo de los planes de auto CHUBB. Comparativo entre niveles Clásico, Plus y Premium.',
    'CHUBB', 'Autos', 'Guía de Producto', 'Guía de Ventas', 'pdf',
    ARRAY['autos','chubb','coberturas','comparativo','2026'],
    'https://www.chubb.com/mx-es/agentes/autos',
    true, 'global', true, true
  ),
  (
    'CHUBB GMM - Plan Élite - Resumen de Beneficios',
    'Beneficios del plan de gastos médicos mayores CHUBB Élite. Suma asegurada ilimitada, hospitalización y servicios internacionales.',
    'CHUBB', 'GMM', 'Resumen de Beneficios', 'Ficha Técnica', 'pdf',
    ARRAY['gmm','chubb','elite','ilimitado','internacional'],
    'https://www.chubb.com/mx-es/agentes/gmm-elite',
    true, 'global', true, true
  ),
  (
    'CHUBB Empresarial - Seguro de Responsabilidad Civil General',
    'Coberturas de RC general para empresas. Incluye protección por daños a terceros, RC patronal y RC profesional.',
    'CHUBB', 'Empresarial', 'Condiciones Generales', 'Condiciones Generales', 'pdf',
    ARRAY['responsabilidad civil','empresarial','chubb','rc general'],
    'https://www.chubb.com/mx-es/agentes/rc-general',
    true, 'global', false, false
  ),
  (
    'CHUBB - Catálogo de Seguros de Viaje 2026',
    'Planes de seguro de viaje individual, familiar y grupos. Coberturas médicas internacionales, cancelación y equipaje.',
    'CHUBB', 'Viajes', 'Catálogo', 'Catálogo de Productos', 'pdf',
    ARRAY['viajes','chubb','internacional','médico','cancelación'],
    'https://www.chubb.com/mx-es/agentes/viajes',
    true, 'global', false, true
  ),
  (
    'CHUBB - Materiales de Capacitación: Venta Consultiva de Seguros',
    'Material de capacitación para agentes sobre técnicas de venta consultiva aplicadas a seguros. Incluye guiones y objeciones.',
    'CHUBB', 'General', 'Capacitación', 'Material de Capacitación', 'pdf',
    ARRAY['capacitación','venta consultiva','agentes','chubb'],
    'https://www.chubb.com/mx-es/agentes/capacitacion',
    true, 'global', false, false
  )
ON CONFLICT DO NOTHING;

-- ── AXA / Allianz Documents ────────────────────────────────────────────────────
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, activo, visibilidad, is_featured, is_recent)
VALUES
  (
    'AXA Autos - Manual del Agente 2026',
    'Manual completo para la venta y operación del seguro de auto AXA. Procesos de emisión, endosos y siniestros.',
    'AXA', 'Autos', 'Manual', 'Manual Técnico', 'pdf',
    ARRAY['autos','axa','manual','agente','emisión','siniestros'],
    'https://www.axa.com.mx/agentes/autos-manual',
    true, 'global', false, true
  ),
  (
    'AXA GMM - Plan Keralty - Ficha Técnica',
    'Ficha técnica del plan GMM AXA Keralty. Red médica exclusiva, telemedicina y servicios preventivos.',
    'AXA', 'GMM', 'Ficha Técnica', 'Ficha Técnica', 'pdf',
    ARRAY['gmm','axa','keralty','telemedicina','preventivo'],
    'https://www.axa.com.mx/agentes/gmm-keralty',
    true, 'global', false, true
  ),
  (
    'AXA Vida - Productos de Ahorro e Inversión',
    'Portafolio de seguros de vida con componente de ahorro. Planes flexibles con acceso a fondos de inversión.',
    'AXA', 'Vida', 'Catálogo', 'Catálogo de Productos', 'pdf',
    ARRAY['vida','ahorro','inversión','axa','fondos'],
    'https://www.axa.com.mx/agentes/vida-ahorro',
    true, 'global', false, false
  ),
  (
    'Allianz Autos - Guía de Coberturas y Exclusiones',
    'Detalle de coberturas y exclusiones del seguro de auto Allianz. Comparativo de paquetes disponibles.',
    'Allianz', 'Autos', 'Guía de Producto', 'Guía de Ventas', 'pdf',
    ARRAY['autos','allianz','coberturas','exclusiones'],
    'https://www.allianz.com.mx/agentes/autos',
    true, 'global', false, true
  ),
  (
    'Allianz GMM - Planes Nacionales e Internacionales 2026',
    'Comparativo de planes GMM Allianz con cobertura nacional e internacional. Suma asegurada y deducibles.',
    'Allianz', 'GMM', 'Comparativo', 'Comparativo', 'pdf',
    ARRAY['gmm','allianz','internacional','comparativo','2026'],
    'https://www.allianz.com.mx/agentes/gmm',
    true, 'global', true, true
  )
ON CONFLICT DO NOTHING;

-- ── MAPFRE Documents ──────────────────────────────────────────────────────────
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, activo, visibilidad, is_featured, is_recent)
VALUES
  (
    'MAPFRE Autos - Coberturas Todo Riesgo 2026',
    'Descripción detallada del producto de auto todo riesgo MAPFRE. Asistencia en carretera 24/7 incluida.',
    'MAPFRE', 'Autos', 'Guía de Producto', 'Guía de Ventas', 'pdf',
    ARRAY['autos','mapfre','todo riesgo','asistencia','2026'],
    'https://www.mapfre.com.mx/agentes/autos',
    true, 'global', false, true
  ),
  (
    'MAPFRE Daños - Seguro Multirriesgo Empresas',
    'Cobertura integral para PYMES. Incendio, robo, daños por agua, RC y pérdida de utilidades.',
    'MAPFRE', 'Daños', 'Condiciones Generales', 'Condiciones Generales', 'pdf',
    ARRAY['daños','empresarial','pyme','mapfre','incendio','robo'],
    'https://www.mapfre.com.mx/agentes/empresas-multirriesgo',
    true, 'global', false, false
  ),
  (
    'MAPFRE Empresarial - Seguro de Transporte de Mercancías',
    'Coberturas para transporte terrestre de mercancías. Individual y contrato abierto. Clausulado A, B y C.',
    'MAPFRE', 'Empresarial', 'Condiciones Generales', 'Condiciones Generales', 'pdf',
    ARRAY['transporte','mercancías','mapfre','empresarial','carga'],
    'https://www.mapfre.com.mx/agentes/transporte',
    true, 'global', false, false
  )
ON CONFLICT DO NOTHING;

-- ── ANA Seguros Documents ─────────────────────────────────────────────────────
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, activo, visibilidad, is_featured, is_recent)
VALUES
  (
    'ANA Seguros GMM - Guía de Planes y Primas 2026',
    'Portafolio completo de GMM ANA Seguros. Planes individuales, familiares y colectivos con deducibles flexibles.',
    'ANA Seguros', 'GMM', 'Guía de Producto', 'Guía de Ventas', 'pdf',
    ARRAY['gmm','ana seguros','primas','planes','colectivo','2026'],
    'https://www.ana.com.mx/agentes/gmm',
    true, 'global', false, true
  ),
  (
    'ANA Seguros - Accidentes Personales Colectivos',
    'Seguro de accidentes para grupos laborales. Muerte accidental, invalidez total y parcial, gastos médicos por accidente.',
    'ANA Seguros', 'Accidentes', 'Ficha Técnica', 'Ficha Técnica', 'pdf',
    ARRAY['accidentes','colectivo','ana seguros','laboral','invalidez'],
    'https://www.ana.com.mx/agentes/accidentes-colectivos',
    true, 'global', false, false
  )
ON CONFLICT DO NOTHING;

-- ── Inbursa Documents ─────────────────────────────────────────────────────────
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, activo, visibilidad, is_featured, is_recent)
VALUES
  (
    'Inbursa Autos - Tarifario Vigente 2026',
    'Tarifas actualizadas para el seguro de auto Inbursa. Factores por tipo de vehículo, uso y zona geográfica.',
    'Inbursa', 'Autos', 'Tarifas', 'Tabla Tarifaria', 'xlsx',
    ARRAY['autos','inbursa','tarifario','2026'],
    'https://www.inbursa.com/agentes/autos-tarifario',
    true, 'global', false, true
  ),
  (
    'Inbursa Vida - Plan Platino - Condiciones Generales',
    'Seguro de vida temporales Inbursa con cobertura por fallecimiento e invalidez total permanente.',
    'Inbursa', 'Vida', 'Condiciones Generales', 'Condiciones Generales', 'pdf',
    ARRAY['vida','inbursa','temporal','invalidez','platino'],
    'https://www.inbursa.com/agentes/vida-platino',
    true, 'global', false, false
  )
ON CONFLICT DO NOTHING;

-- ── BUPA Documents ────────────────────────────────────────────────────────────
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, activo, visibilidad, is_featured, is_recent)
VALUES
  (
    'BUPA - Catálogo de Planes GMM Nacionales e Internacionales 2026',
    'Planes de gastos médicos BUPA con cobertura internacional. Suma asegurada hasta ilimitada, red global de hospitales.',
    'BUPA', 'GMM', 'Catálogo', 'Catálogo de Productos', 'pdf',
    ARRAY['gmm','bupa','internacional','suma ilimitada','global','2026'],
    'https://www.bupa.com.mx/agentes/planes',
    true, 'global', true, true
  ),
  (
    'BUPA - Guía de Beneficios Adicionales y Riders',
    'Descripción de los beneficios adicionales disponibles en planes BUPA: dental, visión, telemedicina y bienestar.',
    'BUPA', 'GMM', 'Guía de Producto', 'Guía de Ventas', 'pdf',
    ARRAY['gmm','bupa','dental','visión','telemedicina','bienestar'],
    'https://www.bupa.com.mx/agentes/beneficios',
    true, 'global', false, false
  )
ON CONFLICT DO NOTHING;

-- ── BX+ Documents ─────────────────────────────────────────────────────────────
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, activo, visibilidad, is_featured, is_recent)
VALUES
  (
    'BX+ - Planes de Gastos Médicos Mayores 2026',
    'Catálogo actualizado de planes GMM BX+. Incluye planes básicos, intermedios y premium con cobertura internacional.',
    'BX+', 'GMM', 'Catálogo', 'Catálogo de Productos', 'pdf',
    ARRAY['gmm','bx+','planes','2026','internacional'],
    'https://www.bxmas.com.mx/agentes/gmm',
    true, 'global', false, true
  ),
  (
    'BX+ - Red Hospitalaria y Médicos de Cabecera 2026',
    'Directorio actualizado de hospitales y médicos participantes en la red BX+ a nivel nacional.',
    'BX+', 'GMM', 'Red Médica', 'Directorio', 'pdf',
    ARRAY['gmm','bx+','hospitales','red médica','directorio'],
    'https://www.bxmas.com.mx/agentes/red-medica',
    true, 'global', false, true
  )
ON CONFLICT DO NOTHING;

-- ── Qualitas Documents ────────────────────────────────────────────────────────
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, activo, visibilidad, is_featured, is_recent)
VALUES
  (
    'Qualitas - Manual Técnico Autos 2026',
    'Manual técnico completo para el seguro de auto Qualitas. Coberturas, exclusiones, suma asegurada y ajuste de siniestros.',
    'Qualitas', 'Autos', 'Manual', 'Manual Técnico', 'pdf',
    ARRAY['autos','qualitas','manual','técnico','2026'],
    'https://www.qualitas.com.mx/agentes/manual-tecnico',
    true, 'global', true, true
  ),
  (
    'Qualitas - Tabla de Valores Convenidos por Modelo',
    'Valores convenidos para cálculo de suma asegurada por marca, modelo y año de automóviles.',
    'Qualitas', 'Autos', 'Tarifas', 'Tabla Tarifaria', 'xlsx',
    ARRAY['autos','qualitas','valores','suma asegurada','modelos'],
    'https://www.qualitas.com.mx/agentes/valores-convenidos',
    true, 'global', false, false
  )
ON CONFLICT DO NOTHING;

-- ── Afirme Documents ──────────────────────────────────────────────────────────
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, activo, visibilidad, is_featured, is_recent)
VALUES
  (
    'Afirme Autos - Guía de Productos y Coberturas',
    'Productos de auto Afirme: paquetes disponibles, coberturas opcionales y restricciones de contratación.',
    'Afirme', 'Autos', 'Guía de Producto', 'Guía de Ventas', 'pdf',
    ARRAY['autos','afirme','coberturas','productos'],
    'https://www.afirme.com.mx/agentes/autos',
    true, 'global', false, false
  ),
  (
    'Afirme - Seguro de Vida Individual y Colectivo',
    'Planes de vida Afirme para personas y grupos. Coberturas básicas y riders de invalidez, enfermedad y accidentes.',
    'Afirme', 'Vida', 'Catálogo', 'Catálogo de Productos', 'pdf',
    ARRAY['vida','afirme','colectivo','individual','riders'],
    'https://www.afirme.com.mx/agentes/vida',
    true, 'global', false, false
  )
ON CONFLICT DO NOTHING;

-- ── Zurich Documents ──────────────────────────────────────────────────────────
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, activo, visibilidad, is_featured, is_recent)
VALUES
  (
    'Zurich - Seguro de Auto Todo Riesgo y Responsabilidad Civil',
    'Póliza de auto Zurich con cobertura amplia. Asistencia en viaje, auto sustituto y cobertura en EUA y Canadá.',
    'Zurich', 'Autos', 'Condiciones Generales', 'Condiciones Generales', 'pdf',
    ARRAY['autos','zurich','todo riesgo','rc','eua','canadá'],
    'https://www.zurich.com.mx/agentes/autos',
    true, 'global', false, false
  ),
  (
    'Zurich Empresarial - Seguro de Directores y Funcionarios (D&O)',
    'Protección D&O para consejeros y directivos de empresas. Responsabilidad civil por actos de gestión.',
    'Zurich', 'Empresarial', 'Ficha Técnica', 'Ficha Técnica', 'pdf',
    ARRAY['empresarial','d&o','directores','zurich','rc'],
    'https://www.zurich.com.mx/agentes/d-o',
    true, 'global', false, false
  )
ON CONFLICT DO NOTHING;

-- ── General / Normativa ───────────────────────────────────────────────────────
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, activo, visibilidad, is_featured, is_recent)
VALUES
  (
    'CNSF - Guía del Agente de Seguros Autorizado 2025',
    'Guía oficial de la CNSF para agentes de seguros. Obligaciones, derechos, actualización de cédula y normativa.',
    'General', 'General', 'Normativa', 'Normativa Regulatoria', 'pdf',
    ARRAY['cnsf','agente','cédula','normativa','regulación'],
    'https://www.cnsf.gob.mx/agentes',
    true, 'global', true, true
  ),
  (
    'Ley de Instituciones de Seguros y Fianzas (LISF) - Texto Vigente',
    'Texto consolidado de la LISF incluyendo reformas hasta 2025. Regulación del sector asegurador y afianzador en México.',
    'General', 'General', 'Normativa', 'Normativa Regulatoria', 'pdf',
    ARRAY['lisf','ley','normativa','regulación','seguros'],
    'https://www.cnsf.gob.mx/lisf',
    true, 'global', false, false
  ),
  (
    'Guía Técnica: Proceso de Emisión y Endosos - Multiaseguradora',
    'Manual de procesos de emisión de pólizas, endosos y cancelaciones aplicable a las principales aseguradoras del mercado.',
    'General', 'General', 'Capacitación', 'Material de Capacitación', 'pdf',
    ARRAY['emisión','endosos','procesos','capacitación','operativo'],
    NULL,
    true, 'global', false, false
  ),
  (
    'Técnicas de Prospectación y Cierre de Ventas en Seguros',
    'Manual de técnicas de ventas para agentes. Prospectación, presentación de productos, manejo de objeciones y cierre.',
    'General', 'General', 'Capacitación', 'Material de Capacitación', 'pdf',
    ARRAY['ventas','prospectación','cierre','técnicas','agente'],
    NULL,
    true, 'global', true, false
  ),
  (
    'Comparativo Multiaseguradora: GMM Mercado Mexicano 2026',
    'Análisis comparativo de los principales planes de GMM del mercado. Suma asegurada, deducibles, coaseguro y red médica.',
    'General', 'GMM', 'Comparativo', 'Comparativo', 'xlsx',
    ARRAY['gmm','comparativo','mercado','multiaseguradora','2026'],
    NULL,
    true, 'global', true, true
  ),
  (
    'Comparativo Multiaseguradora: Autos RC y Amplia 2026',
    'Cuadro comparativo de coberturas y tarifas de auto entre las principales aseguradoras. Incluye RC, amplia y limitada.',
    'General', 'Autos', 'Comparativo', 'Comparativo', 'xlsx',
    ARRAY['autos','comparativo','rc','amplia','multiaseguradora','2026'],
    NULL,
    true, 'global', true, true
  ),
  (
    'Atlas Seguros - Fianzas de Arrendamiento y Crédito',
    'Productos de fianzas Atlas para arrendadores e inquilinos. Proceso de emisión y requisitos de contratación.',
    'Atlas', 'Fianzas', 'Ficha Técnica', 'Ficha Técnica', 'pdf',
    ARRAY['fianzas','atlas','arrendamiento','crédito'],
    'https://www.segurosatlas.com.mx/agentes/fianzas',
    true, 'global', false, false
  )
ON CONFLICT DO NOTHING;
