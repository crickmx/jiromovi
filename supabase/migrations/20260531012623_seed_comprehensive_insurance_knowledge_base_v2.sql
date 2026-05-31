/*
  # Seed Comprehensive Insurance Knowledge Base Documents

  ## Summary
  Replaces placeholder documents with a comprehensive set of real insurance
  knowledge base documents extracted from base-conocimiento-seguros.html.

  ## Coverage
  - GNP Seguros: Vida, GMM, Autos, Daños, Ahorro
  - CHUBB: Vida, Accidentes, GMM, Autos, Empresarial
  - AXA: Vida, GMM, Autos, Hogar, Empresarial
  - Allianz: Vida, GMM, Autos, Patrimonial
  - MAPFRE: Vida, Autos, Hogar, Empresarial
  - ANA Seguros: Vida, Daños, Agrícola
  - Inbursa: Vida, GMM, Autos
  - BUPA: GMM, Internacional
  - BX+: GMM, Vida
  - Qualitas: Autos
  - Afirme: Vida, Autos, Daños
  - Zurich: Vida, Autos, Empresarial
  - Atlas: Vida, Autos

  ## Schema
  All documents use existing columns:
  - titulo, aseguradora, ramo, categoria, tipo, formato
  - url_original, visibilidad, activo, is_featured
  - insurer_logo_url (new column)

  ## Notes
  - Clears previous placeholder data and inserts real documents
  - visibilidad = 'global' for all (available to all users)
  - url_original contains the source URL from the HTML file
  - storage_path will be populated by the bulk-download edge function
*/

-- Clear existing seeded documents (keep any user-uploaded ones)
DELETE FROM digital_center_documents WHERE visibilidad = 'global' AND subido_por IS NULL;

-- =====================================================
-- GNP SEGUROS
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
-- GMM
('GNP GMM - Tabla de Beneficios Plan Platino', 'Tabla completa de beneficios del plan Platino de Gastos Médicos Mayores GNP', 'GNP', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['gmm','platino','beneficios'], 'https://gnp.com.mx/agentes/gmm/tabla-beneficios-platino.pdf', 'global', true, true, '/gnp-seguros.png'),
('GNP GMM - Tabla de Beneficios Plan Oro', 'Tabla completa de beneficios del plan Oro de Gastos Médicos Mayores GNP', 'GNP', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['gmm','oro','beneficios'], 'https://gnp.com.mx/agentes/gmm/tabla-beneficios-oro.pdf', 'global', true, false, '/gnp-seguros.png'),
('GNP GMM - Solicitud de Seguro Individual', 'Formato de solicitud para contratar GMM individual GNP', 'GNP', 'GMM', 'Formularios', 'Solicitud', 'PDF', ARRAY['gmm','solicitud','individual'], 'https://gnp.com.mx/agentes/gmm/solicitud-individual.pdf', 'global', true, false, '/gnp-seguros.png'),
('GNP GMM - Guía Rápida de Cotización', 'Guía práctica para cotizar GMM en el portal de agentes GNP', 'GNP', 'GMM', 'Capacitación', 'Guía', 'PDF', ARRAY['gmm','cotizacion','guia'], 'https://gnp.com.mx/agentes/capacitacion/guia-cotizacion-gmm.pdf', 'global', true, true, '/gnp-seguros.png'),
-- VIDA
('GNP Vida - Condiciones Generales Renta Vital', 'Condiciones generales del seguro de Vida Renta Vital GNP', 'GNP', 'Vida', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['vida','renta vital','condiciones'], 'https://gnp.com.mx/agentes/vida/condiciones-renta-vital.pdf', 'global', true, false, '/gnp-seguros.png'),
('GNP Vida - Tabla de Tarifas Vida Individual', 'Tarifas vigentes para seguros de vida individual GNP 2025-2026', 'GNP', 'Vida', 'Tarifas', 'Tabla de Tarifas', 'PDF', ARRAY['vida','tarifas','individual'], 'https://gnp.com.mx/agentes/vida/tarifas-vida-individual-2026.pdf', 'global', true, true, '/gnp-seguros.png'),
('GNP Vida - Solicitud Seguro de Vida', 'Formato de solicitud para contratar seguro de vida GNP', 'GNP', 'Vida', 'Formularios', 'Solicitud', 'PDF', ARRAY['vida','solicitud'], 'https://gnp.com.mx/agentes/vida/solicitud-vida.pdf', 'global', true, false, '/gnp-seguros.png'),
-- AUTOS
('GNP Autos - Condiciones Generales Seguro de Auto', 'Condiciones generales del seguro de autos GNP vigentes', 'GNP', 'Autos', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['autos','condiciones'], 'https://gnp.com.mx/agentes/autos/condiciones-generales.pdf', 'global', true, false, '/gnp-seguros.png'),
('GNP Autos - Guía de Beneficios Cobertura Amplia', 'Descripción de coberturas del plan amplia para autos GNP', 'GNP', 'Autos', 'Beneficios', 'Guía', 'PDF', ARRAY['autos','cobertura amplia','beneficios'], 'https://gnp.com.mx/agentes/autos/guia-cobertura-amplia.pdf', 'global', true, false, '/gnp-seguros.png'),
('GNP Autos - Tarifa Electrónica Vigente', 'Tabla de tarifas de seguros de autos GNP vigente 2026', 'GNP', 'Autos', 'Tarifas', 'Tabla de Tarifas', 'XLSX', ARRAY['autos','tarifas'], 'https://gnp.com.mx/agentes/autos/tarifa-electronica-2026.xlsx', 'global', true, false, '/gnp-seguros.png'),
-- DAÑOS
('GNP Hogar - Condiciones Generales Tu Casa Segura', 'Condiciones generales del seguro de hogar Tu Casa Segura GNP', 'GNP', 'Daños', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['hogar','daños','condiciones'], 'https://gnp.com.mx/agentes/danos/condiciones-hogar.pdf', 'global', true, false, '/gnp-seguros.png'),
('GNP Empresarial - Guía Multi Empresa', 'Guía de productos empresariales GNP para agentes', 'GNP', 'Empresarial', 'Capacitación', 'Guía', 'PDF', ARRAY['empresarial','multi empresa'], 'https://gnp.com.mx/agentes/empresarial/guia-multi-empresa.pdf', 'global', true, false, '/gnp-seguros.png');

-- =====================================================
-- CHUBB
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('CHUBB GMM - Tabla de Beneficios Óptima Plus', 'Cobertura y beneficios del plan Óptima Plus de CHUBB', 'CHUBB', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['gmm','optima plus','chubb'], 'https://www.chubb.com/mx-es/sitemap/tabla-beneficios-optima-plus.pdf', 'global', true, true, '/logo_chubb-04.png'),
('CHUBB GMM - Condiciones Generales Gastos Médicos', 'Condiciones generales del seguro GMM CHUBB edición vigente', 'CHUBB', 'GMM', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['gmm','condiciones','chubb'], 'https://www.chubb.com/mx-es/sitemap/condiciones-gmm.pdf', 'global', true, false, '/logo_chubb-04.png'),
('CHUBB Vida - Seguro de Vida Protección Total', 'Características y beneficios de Protección Total CHUBB', 'CHUBB', 'Vida', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['vida','proteccion total','chubb'], 'https://www.chubb.com/mx-es/sitemap/vida-proteccion-total.pdf', 'global', true, true, '/logo_chubb-04.png'),
('CHUBB Accidentes - Cobertura Accidentes Personales', 'Guía de cobertura de accidentes personales CHUBB', 'CHUBB', 'Accidentes Personales', 'Beneficios', 'Guía', 'PDF', ARRAY['accidentes','chubb'], 'https://www.chubb.com/mx-es/sitemap/accidentes-personales.pdf', 'global', true, false, '/logo_chubb-04.png'),
('CHUBB Autos - Coberturas y Tarifas Seguro de Auto', 'Tarifas y coberturas del seguro de autos CHUBB 2026', 'CHUBB', 'Autos', 'Tarifas', 'Tabla de Tarifas', 'PDF', ARRAY['autos','tarifas','chubb'], 'https://www.chubb.com/mx-es/sitemap/tarifas-autos-2026.pdf', 'global', true, false, '/logo_chubb-04.png'),
('CHUBB Hogar - Seguro de Casa Habitación', 'Coberturas del seguro de casa habitación CHUBB', 'CHUBB', 'Daños', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['hogar','casa habitacion','chubb'], 'https://www.chubb.com/mx-es/sitemap/casa-habitacion.pdf', 'global', true, false, '/logo_chubb-04.png'),
('CHUBB Empresarial - Paquete Pymprotección', 'Paquete de seguros empresariales Pymprotección CHUBB', 'CHUBB', 'Empresarial', 'Beneficios', 'Guía', 'PDF', ARRAY['empresarial','pymproteccion','chubb'], 'https://www.chubb.com/mx-es/sitemap/pymproteccion.pdf', 'global', true, true, '/logo_chubb-04.png'),
('CHUBB GMM - Solicitud de Afiliación Individual', 'Formato de solicitud de afiliación a GMM CHUBB', 'CHUBB', 'GMM', 'Formularios', 'Solicitud', 'PDF', ARRAY['gmm','solicitud','afiliacion'], 'https://www.chubb.com/mx-es/sitemap/solicitud-gmm-individual.pdf', 'global', true, false, '/logo_chubb-04.png');

-- =====================================================
-- AXA
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('AXA GMM - Beneficios Plan Ejecutivo', 'Beneficios completos del plan Ejecutivo de Gastos Médicos AXA', 'AXA', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['gmm','ejecutivo','axa'], 'https://axa.mx/content/dam/axa-mx/documentos/gmm/tabla-beneficios-ejecutivo.pdf', 'global', true, true, '/allianz-seguros-logo-png_seeklogo-179147.png'),
('AXA GMM - Condiciones Generales Gastos Médicos', 'Condiciones generales del seguro de gastos médicos AXA', 'AXA', 'GMM', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['gmm','condiciones','axa'], 'https://axa.mx/content/dam/axa-mx/documentos/gmm/condiciones-generales.pdf', 'global', true, false, '/allianz-seguros-logo-png_seeklogo-179147.png'),
('AXA Vida - Productos de Vida AXA 2026', 'Catálogo de productos de vida individual AXA vigentes', 'AXA', 'Vida', 'Capacitación', 'Guía', 'PDF', ARRAY['vida','catalogo','axa'], 'https://axa.mx/content/dam/axa-mx/documentos/vida/catalogo-productos-vida-2026.pdf', 'global', true, true, '/allianz-seguros-logo-png_seeklogo-179147.png'),
('AXA Autos - Coberturas Seguro Auto Conectado', 'Coberturas del seguro Auto Conectado de AXA', 'AXA', 'Autos', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['autos','auto conectado','axa'], 'https://axa.mx/content/dam/axa-mx/documentos/autos/coberturas-auto-conectado.pdf', 'global', true, false, '/allianz-seguros-logo-png_seeklogo-179147.png'),
('AXA Hogar - Seguro de Hogar Protege Tu Mundo', 'Guía de coberturas del seguro de hogar AXA', 'AXA', 'Daños', 'Beneficios', 'Guía', 'PDF', ARRAY['hogar','protege tu mundo','axa'], 'https://axa.mx/content/dam/axa-mx/documentos/hogar/guia-protege-tu-mundo.pdf', 'global', true, false, '/allianz-seguros-logo-png_seeklogo-179147.png'),
('AXA Empresarial - Seguro de Responsabilidad Civil', 'Cobertura de responsabilidad civil para empresas AXA', 'AXA', 'Empresarial', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['empresarial','responsabilidad civil','axa'], 'https://axa.mx/content/dam/axa-mx/documentos/empresarial/rc-empresarial.pdf', 'global', true, false, '/allianz-seguros-logo-png_seeklogo-179147.png');

-- =====================================================
-- ALLIANZ
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('Allianz GMM - Tabla de Coberturas Salud Total', 'Coberturas del plan Salud Total de Allianz', 'Allianz', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['gmm','salud total','allianz'], 'https://www.allianz.com.mx/wp-content/uploads/coberturas-salud-total.pdf', 'global', true, true, '/allianz-seguros-logo-png_seeklogo-179147.png'),
('Allianz Vida - Plan de Ahorro y Protección', 'Plan de ahorro con protección de vida Allianz', 'Allianz', 'Vida', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['vida','ahorro','proteccion','allianz'], 'https://www.allianz.com.mx/wp-content/uploads/plan-ahorro-proteccion.pdf', 'global', true, false, '/allianz-seguros-logo-png_seeklogo-179147.png'),
('Allianz Autos - Seguro de Autos Condiciones Generales', 'Condiciones generales del seguro de autos Allianz', 'Allianz', 'Autos', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['autos','condiciones','allianz'], 'https://www.allianz.com.mx/wp-content/uploads/condiciones-autos.pdf', 'global', true, false, '/allianz-seguros-logo-png_seeklogo-179147.png'),
('Allianz Patrimonial - Guía Técnica Incendio', 'Guía técnica para el ramo de incendio Allianz', 'Allianz', 'Daños', 'Capacitación', 'Guía', 'PDF', ARRAY['incendio','patrimonial','allianz'], 'https://www.allianz.com.mx/wp-content/uploads/guia-tecnica-incendio.pdf', 'global', true, false, '/allianz-seguros-logo-png_seeklogo-179147.png');

-- =====================================================
-- MAPFRE
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('MAPFRE Vida - Condiciones Generales Vida Protección', 'Condiciones generales del seguro de vida Vida Protección MAPFRE', 'MAPFRE', 'Vida', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['vida','condiciones','mapfre'], 'https://www.mapfre.com.mx/content/dam/mapfre-mx/vida/condiciones-vida-proteccion.pdf', 'global', true, false, '/mapfre-seguros-logo-png_seeklogo-225013.png'),
('MAPFRE Autos - Coberturas Seguro Carro Seguro', 'Coberturas del seguro Carro Seguro MAPFRE', 'MAPFRE', 'Autos', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['autos','carro seguro','mapfre'], 'https://www.mapfre.com.mx/content/dam/mapfre-mx/autos/coberturas-carro-seguro.pdf', 'global', true, true, '/mapfre-seguros-logo-png_seeklogo-225013.png'),
('MAPFRE Hogar - Coberturas Hogar MAPFRE', 'Guía de coberturas del seguro de hogar MAPFRE', 'MAPFRE', 'Daños', 'Beneficios', 'Guía', 'PDF', ARRAY['hogar','coberturas','mapfre'], 'https://www.mapfre.com.mx/content/dam/mapfre-mx/hogar/coberturas-hogar.pdf', 'global', true, false, '/mapfre-seguros-logo-png_seeklogo-225013.png'),
('MAPFRE Empresarial - Seguro de RC Profesional', 'Seguro de Responsabilidad Civil Profesional MAPFRE', 'MAPFRE', 'Empresarial', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['empresarial','rc profesional','mapfre'], 'https://www.mapfre.com.mx/content/dam/mapfre-mx/empresarial/rc-profesional.pdf', 'global', true, false, '/mapfre-seguros-logo-png_seeklogo-225013.png'),
('MAPFRE GMM - Tabla de Beneficios Plan Salud', 'Beneficios del plan de salud GMM MAPFRE', 'MAPFRE', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['gmm','salud','mapfre'], 'https://www.mapfre.com.mx/content/dam/mapfre-mx/gmm/tabla-beneficios-salud.pdf', 'global', true, false, '/mapfre-seguros-logo-png_seeklogo-225013.png');

-- =====================================================
-- ANA SEGUROS
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('ANA Seguros - Condiciones Generales Vida ANA', 'Condiciones generales del seguro de vida ANA Seguros', 'ANA Seguros', 'Vida', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['vida','condiciones','ana'], 'https://www.ana.com.mx/documentos/vida/condiciones-generales-vida.pdf', 'global', true, false, '/logo_anaseguros.png'),
('ANA Seguros - Tarifas Autos Vigentes', 'Tabla de tarifas para seguro de autos ANA 2026', 'ANA Seguros', 'Autos', 'Tarifas', 'Tabla de Tarifas', 'PDF', ARRAY['autos','tarifas','ana'], 'https://www.ana.com.mx/documentos/autos/tarifas-2026.pdf', 'global', true, false, '/logo_anaseguros.png'),
('ANA Seguros - Guía de Productos Agropecuarios', 'Guía de productos para el ramo agropecuario ANA Seguros', 'ANA Seguros', 'Agropecuario', 'Capacitación', 'Guía', 'PDF', ARRAY['agricola','agropecuario','ana'], 'https://www.ana.com.mx/documentos/agro/guia-productos-agro.pdf', 'global', true, false, '/logo_anaseguros.png'),
('ANA Seguros - Manual del Agente Comercial', 'Manual completo para agentes de seguros ANA', 'ANA Seguros', 'General', 'Capacitación', 'Manual', 'PDF', ARRAY['manual','agente','ana'], 'https://www.ana.com.mx/documentos/capacitacion/manual-agente.pdf', 'global', true, true, '/logo_anaseguros.png');

-- =====================================================
-- INBURSA
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('Inbursa GMM - Plan Médico Familiar', 'Coberturas del plan médico familiar Inbursa', 'Inbursa', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['gmm','familiar','inbursa'], 'https://www.inbursa.com/documentos/gmm/plan-medico-familiar.pdf', 'global', true, false, '/inbursa-logo-png_seeklogo-403106.png'),
('Inbursa Vida - Seguro de Vida con Ahorro', 'Seguro de vida con componente de ahorro Inbursa', 'Inbursa', 'Vida', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['vida','ahorro','inbursa'], 'https://www.inbursa.com/documentos/vida/vida-ahorro.pdf', 'global', true, false, '/inbursa-logo-png_seeklogo-403106.png'),
('Inbursa Autos - Condiciones Generales Auto Plus', 'Condiciones generales Auto Plus Inbursa', 'Inbursa', 'Autos', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['autos','auto plus','inbursa'], 'https://www.inbursa.com/documentos/autos/condiciones-auto-plus.pdf', 'global', true, false, '/inbursa-logo-png_seeklogo-403106.png'),
('Inbursa - Guía Rápida de Productos', 'Guía rápida de los principales productos Inbursa para agentes', 'Inbursa', 'General', 'Capacitación', 'Guía', 'PDF', ARRAY['guia','productos','inbursa'], 'https://www.inbursa.com/documentos/capacitacion/guia-rapida-productos.pdf', 'global', true, false, '/inbursa-logo-png_seeklogo-403106.png');

-- =====================================================
-- BUPA
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('BUPA - Plan Medical Classic Beneficios', 'Tabla de beneficios del plan Medical Classic BUPA', 'BUPA', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['gmm','medical classic','bupa'], 'https://www.bupa.com.mx/documents/plan-medical-classic.pdf', 'global', true, true, '/logo-bupa.png'),
('BUPA - Plan Select Beneficios', 'Tabla de beneficios del plan Select BUPA', 'BUPA', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['gmm','select','bupa'], 'https://www.bupa.com.mx/documents/plan-select.pdf', 'global', true, false, '/logo-bupa.png'),
('BUPA - Plan Essential Beneficios', 'Tabla de beneficios del plan Essential BUPA', 'BUPA', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['gmm','essential','bupa'], 'https://www.bupa.com.mx/documents/plan-essential.pdf', 'global', true, false, '/logo-bupa.png'),
('BUPA - Guía de Cotización y Emisión', 'Guía para cotizar y emitir pólizas BUPA', 'BUPA', 'GMM', 'Capacitación', 'Guía', 'PDF', ARRAY['cotizacion','emision','bupa'], 'https://www.bupa.com.mx/documents/guia-cotizacion-emision.pdf', 'global', true, true, '/logo-bupa.png'),
('BUPA Internacional - Cobertura Global', 'Cobertura internacional del plan Global BUPA', 'BUPA', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['internacional','global','bupa'], 'https://www.bupa.com.mx/documents/plan-global-cobertura.pdf', 'global', true, false, '/logo-bupa.png');

-- =====================================================
-- BX+ (PROTECCION MUTUA / BENEFICIOS PLUS)
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('BX+ GMM - Plan Integral Salud Beneficios', 'Tabla de beneficios del plan Integral Salud BX+', 'BX+', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['gmm','integral salud','bx+'], 'https://bx.com.mx/documentos/gmm/plan-integral-salud.pdf', 'global', true, true, '/logo-bx.png'),
('BX+ GMM - Solicitud de Cotización Individual', 'Solicitud para cotizar plan GMM individual BX+', 'BX+', 'GMM', 'Formularios', 'Solicitud', 'PDF', ARRAY['gmm','solicitud','cotizacion','bx+'], 'https://bx.com.mx/documentos/gmm/solicitud-cotizacion.pdf', 'global', true, false, '/logo-bx.png'),
('BX+ Vida - Seguro Vida Plus', 'Características del seguro Vida Plus BX+', 'BX+', 'Vida', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['vida','vida plus','bx+'], 'https://bx.com.mx/documentos/vida/vida-plus.pdf', 'global', true, false, '/logo-bx.png'),
('BX+ - Guía del Agente Autorizado', 'Manual para agentes autorizados BX+', 'BX+', 'General', 'Capacitación', 'Guía', 'PDF', ARRAY['guia','agente','bx+'], 'https://bx.com.mx/documentos/capacitacion/guia-agente.pdf', 'global', true, false, '/logo-bx.png');

-- =====================================================
-- QUALITAS
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('Qualitas - Condiciones Generales Seguro de Auto', 'Condiciones generales del seguro de autos Qualitas vigentes', 'Qualitas', 'Autos', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['autos','condiciones','qualitas'], 'https://www.qualitas.com.mx/documentos/autos/condiciones-generales.pdf', 'global', true, false, '/qualitas-compania-de-seguros-logo-png_seeklogo-329374-2.png'),
('Qualitas - Coberturas Amplia Plus', 'Coberturas del plan Amplia Plus Qualitas', 'Qualitas', 'Autos', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['autos','amplia plus','qualitas'], 'https://www.qualitas.com.mx/documentos/autos/coberturas-amplia-plus.pdf', 'global', true, true, '/qualitas-compania-de-seguros-logo-png_seeklogo-329374-2.png'),
('Qualitas - Guía de Servicios para el Asegurado', 'Guía de servicios y asistencias Qualitas para el asegurado', 'Qualitas', 'Autos', 'Capacitación', 'Guía', 'PDF', ARRAY['servicios','asistencia','qualitas'], 'https://www.qualitas.com.mx/documentos/servicios/guia-servicios.pdf', 'global', true, false, '/qualitas-compania-de-seguros-logo-png_seeklogo-329374-2.png'),
('Qualitas - Tarifas Vigentes 2026', 'Tarifas de seguros de autos Qualitas vigentes para 2026', 'Qualitas', 'Autos', 'Tarifas', 'Tabla de Tarifas', 'PDF', ARRAY['autos','tarifas','qualitas'], 'https://www.qualitas.com.mx/documentos/tarifas/tarifas-autos-2026.pdf', 'global', true, false, '/qualitas-compania-de-seguros-logo-png_seeklogo-329374-2.png');

-- =====================================================
-- AFIRME
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('Afirme Vida - Condiciones Generales Vida Grupo', 'Condiciones generales de seguro de vida grupo Afirme', 'Afirme', 'Vida', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['vida','grupo','afirme'], 'https://www.afirme.com/seguros/documentos/vida-grupo-condiciones.pdf', 'global', true, false, '/afirme-logo-png_seeklogo-4173.png'),
('Afirme Autos - Plan Auto Seguro Coberturas', 'Coberturas del plan Auto Seguro Afirme', 'Afirme', 'Autos', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['autos','auto seguro','afirme'], 'https://www.afirme.com/seguros/documentos/auto-seguro-coberturas.pdf', 'global', true, false, '/afirme-logo-png_seeklogo-4173.png'),
('Afirme Daños - Seguro de Negocio Protegido', 'Seguro integral para negocios Afirme', 'Afirme', 'Daños', 'Beneficios', 'Guía', 'PDF', ARRAY['negocio','daños','afirme'], 'https://www.afirme.com/seguros/documentos/negocio-protegido.pdf', 'global', true, false, '/afirme-logo-png_seeklogo-4173.png');

-- =====================================================
-- ZURICH
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('Zurich Vida - Plan Semilla de Vida', 'Beneficios del plan Semilla de Vida Zurich', 'Zurich', 'Vida', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['vida','semilla','zurich'], 'https://www.zurich.com.mx/mx/life/documents/semilla-de-vida.pdf', 'global', true, false, '/zurich-logo-png_seeklogo-156664.png'),
('Zurich Autos - Seguro de Auto Condiciones', 'Condiciones generales del seguro de autos Zurich', 'Zurich', 'Autos', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['autos','condiciones','zurich'], 'https://www.zurich.com.mx/mx/motor/documents/condiciones-autos.pdf', 'global', true, false, '/zurich-logo-png_seeklogo-156664.png'),
('Zurich Empresarial - Pyme Segura Coberturas', 'Coberturas del plan Pyme Segura Zurich', 'Zurich', 'Empresarial', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['pyme','empresarial','zurich'], 'https://www.zurich.com.mx/mx/commercial/documents/pyme-segura.pdf', 'global', true, true, '/zurich-logo-png_seeklogo-156664.png'),
('Zurich GMM - Cobertura Salud Activa', 'Coberturas del plan Salud Activa GMM Zurich', 'Zurich', 'GMM', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['gmm','salud activa','zurich'], 'https://www.zurich.com.mx/mx/health/documents/salud-activa.pdf', 'global', true, false, '/zurich-logo-png_seeklogo-156664.png');

-- =====================================================
-- ATLAS
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('Atlas - Condiciones Generales Seguro de Vida', 'Condiciones generales del seguro de vida Atlas', 'Atlas', 'Vida', 'Condiciones Generales', 'Condiciones Generales', 'PDF', ARRAY['vida','condiciones','atlas'], 'https://segurosatlas.com.mx/documentos/vida/condiciones-generales.pdf', 'global', true, false, '/seguros-atlas-logo-png_seeklogo-251455.png'),
('Atlas Autos - Coberturas Plan Blindado', 'Coberturas del plan Blindado de autos Atlas', 'Atlas', 'Autos', 'Beneficios', 'Tabla de Beneficios', 'PDF', ARRAY['autos','blindado','atlas'], 'https://segurosatlas.com.mx/documentos/autos/coberturas-blindado.pdf', 'global', true, false, '/seguros-atlas-logo-png_seeklogo-251455.png'),
('Atlas - Guía de Venta Seguros de Vida', 'Guía de venta para asesores de seguros de vida Atlas', 'Atlas', 'Vida', 'Capacitación', 'Guía', 'PDF', ARRAY['vida','guia venta','atlas'], 'https://segurosatlas.com.mx/documentos/capacitacion/guia-venta-vida.pdf', 'global', true, false, '/seguros-atlas-logo-png_seeklogo-251455.png');

-- =====================================================
-- GENERAL / MOVI DIGITAL (recursos genéricos)
-- =====================================================
INSERT INTO digital_center_documents (titulo, descripcion, aseguradora, ramo, categoria, tipo, formato, tags, url_original, visibilidad, activo, is_featured, insurer_logo_url)
VALUES
('Guía de Ventas - Cómo Vender Seguros de Vida', 'Guía práctica para vender seguros de vida, técnicas y objeciones', 'General', 'Vida', 'Capacitación', 'Guía', 'PDF', ARRAY['ventas','vida','tecnicas'], 'https://movidigital.com.mx/recursos/guia-ventas-vida.pdf', 'global', true, true, NULL),
('Guía de Ventas - Cómo Vender GMM', 'Guía práctica para vender gastos médicos mayores, scripts y objeciones', 'General', 'GMM', 'Capacitación', 'Guía', 'PDF', ARRAY['ventas','gmm','tecnicas'], 'https://movidigital.com.mx/recursos/guia-ventas-gmm.pdf', 'global', true, true, NULL),
('Comparativo General - Seguros GMM del Mercado', 'Comparativo de planes GMM entre las principales aseguradoras 2026', 'General', 'GMM', 'Comparativos', 'Tabla Comparativa', 'PDF', ARRAY['comparativo','gmm','aseguradoras'], 'https://movidigital.com.mx/recursos/comparativo-gmm-2026.pdf', 'global', true, true, NULL),
('Comparativo General - Seguros de Auto', 'Comparativo de seguros de autos entre las principales aseguradoras 2026', 'General', 'Autos', 'Comparativos', 'Tabla Comparativa', 'PDF', ARRAY['comparativo','autos','aseguradoras'], 'https://movidigital.com.mx/recursos/comparativo-autos-2026.pdf', 'global', true, false, NULL),
('Manual de Objeciones - Ventas de Seguros', 'Manual para manejar objeciones frecuentes en la venta de seguros', 'General', 'General', 'Capacitación', 'Manual', 'PDF', ARRAY['objeciones','ventas','manual'], 'https://movidigital.com.mx/recursos/manual-objeciones.pdf', 'global', true, false, NULL),
('Glosario de Seguros - Términos Clave', 'Glosario de términos y conceptos clave del sector asegurador', 'General', 'General', 'Capacitación', 'Guía', 'PDF', ARRAY['glosario','terminos','conceptos'], 'https://movidigital.com.mx/recursos/glosario-seguros.pdf', 'global', true, false, NULL),
('Reglamento de Agentes CNSF 2026', 'Reglamento vigente para agentes de seguros CNSF 2026', 'General', 'General', 'Legal', 'Reglamento', 'PDF', ARRAY['cnsf','reglamento','agentes'], 'https://www.cnsf.gob.mx/reglamentos/agentes-2026.pdf', 'global', true, false, NULL),
('Ley de Instituciones de Seguros Vigente', 'Ley sobre el contrato de seguro vigente en México', 'General', 'General', 'Legal', 'Ley', 'PDF', ARRAY['ley','contrato','seguros'], 'https://www.cnsf.gob.mx/leyes/ley-instituciones-seguros.pdf', 'global', true, false, NULL),
('Presentación - Proceso de Emisión Paso a Paso', 'Presentación del proceso completo de emisión de pólizas', 'General', 'General', 'Capacitación', 'Presentación', 'PPTX', ARRAY['emision','proceso','polizas'], 'https://movidigital.com.mx/recursos/proceso-emision.pptx', 'global', true, false, NULL),
('Checklist - Documentos para Siniestros', 'Lista de verificación de documentos necesarios para reportar siniestros', 'General', 'General', 'Operaciones', 'Checklist', 'PDF', ARRAY['siniestros','documentos','checklist'], 'https://movidigital.com.mx/recursos/checklist-siniestros.pdf', 'global', true, false, NULL);
