/*
  # Load Accesos Nacional Data

  1. Purpose
    - Load insurance company access credentials from CSV data
    - Populate accesos_nacional table with all insurance portals
    - Include agent keys (clave_agente), usernames, passwords, and portal links

  2. Data Loaded
    - 26 insurance company access records
    - Includes: ANA, Banorte, Sura, Afirme, BX+, HDI, Allianz, Chubb, Mapfre, Qualitas, El Potosí, Zurich, MetLife, Atlas
    - Each with corresponding credentials and portal URLs

  3. Notes
    - Some records have multiple entries for the same insurer (different agent keys)
    - Usuario_2 is optional and only provided for some records
    - All passwords are stored as provided
    - creado_por is set to NULL for initial data load
*/

-- Insert accesos nacional data
INSERT INTO accesos_nacional (aseguradora, clave_agente, usuario_1, usuario_2, contrasena, link, creado_por) VALUES
('ANA', '12253', '12253', NULL, 'ANAsma30*', 'https://anaseguros.com.mx/anaweb/index.html#INGRESO', NULL),
('ANA', '13412', '13412', NULL, 'Jirocel1', 'https://anaseguros.com.mx/anaweb/index.html#INGRESO', NULL),
('ANA', '00445', '00445', NULL, 'Jiro2022', 'https://anaseguros.com.mx/anaweb/index.html#INGRESO', NULL),
('ANA', '17719', '17719', NULL, 'Qro25jun', 'https://anaseguros.com.mx/anaweb/index.html#INGRESO', NULL),
('ANA', '15279', '15279', NULL, 'Agosto24', 'https://anaseguros.com.mx/anaweb/index.html#INGRESO', NULL),
('ANA', '25124', '25124', NULL, '25124', 'https://anaseguros.com.mx/anaweb/index.html#INGRESO', NULL),
('Banorte', '13633', '13633', NULL, 'cELAYA#2', 'https://portal.banorte.com/wps/portal/banorte/seguros/agentes', NULL),
('Banorte', '1133', '1133', NULL, 'Banorte#2', 'https://portal.banorte.com/wps/portal/banorte/seguros/agentes', NULL),
('Sura', '5159', 'MXACABRERO', 'MXACABRERO', 'oWC!swyS6V', 'https://www.sura.com/mx/portal-agentes', NULL),
('Afirme', '94390', 'RECEPCIONQUERETARO@JIRO.MX', 'RECEPCIONQUERETARO@JIRO.MX', 'AGT94390', 'https://www.afirmeseguros.com.mx/Agentes', NULL),
('BX+', '6980AG', '6980AG', '6980AG', '6980*JeroIsma', 'https://www.vepormas.com/seguros/agentes', NULL),
('BX+', '5746AG', '5746AG', NULL, 'Jiro24%scop10', 'https://www.vepormas.com/seguros/agentes', NULL),
('HDI', '067941', '067941', NULL, 'HDIJiro123*', 'https://portal.hdi.com.mx', NULL),
('HDI', '054900', '054900', NULL, 'Sathdi1423*', 'https://portal.hdi.com.mx', NULL),
('HDI', '053588', '053588', NULL, 'abril04$', 'https://portal.hdi.com.mx', NULL),
('Allianz', NULL, 'JIRO.AGENTE', 'JIRO.AGENTE', 'Jiagnt.31', 'https://portal.myallianz.com.mx/web/guest/inicio', NULL),
('Allianz', '4482', 'JIRO.4482', 'JIRO.4482', 'Jsocados.3', 'https://portal.myallianz.com.mx/web/guest/inicio', NULL),
('Chubb', '142762-1', '142762-1', NULL, 'JIRmor2024*', 'https://www.chubb.com/mx-es/agents-brokers.html', NULL),
('Chubb Travel', NULL, 'Chubb Travel', NULL, 'Jir0qr0123#', 'https://www.chubbtravelinsurance.com', NULL),
('Mapfre', '57419', '57419', NULL, 'Marsella2012', 'https://www.mapfre.com.mx/agentes/', NULL),
('Qualitas', '14757', 'JIROYASO', 'JIROYASO', 'JYA456', 'https://portal.qualitas.com.mx', NULL),
('El Potosí', '130551', '130551', NULL, 'MARSELLA2022$', 'https://www.seguroselpotosi.com.mx/agentes/', NULL),
('Zurich', '11153', '11153', NULL, '11153JIRO', 'https://www.zurich.com.mx/es-mx/agents', NULL),
('MetLife', NULL, 'MetLife', NULL, 'Sella14Mar', 'https://portal.metlife.com.mx', NULL),
('Atlas', '2676', 'JIROYASO', 'JIROYASO', 'Jironal*12', 'https://www.atlasseguros.com.mx/agentes', NULL),
('Atlas', '975', 'QUERETAR', 'QUERETAR', 'EtRu25$66TR', 'https://www.atlasseguros.com.mx/agentes', NULL),
('Atlas', '15009', '15009', NULL, 'Jiro2023.', 'https://www.atlasseguros.com.mx/agentes', NULL)
ON CONFLICT DO NOTHING;