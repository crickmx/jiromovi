/*
  # Actualización de Ramos con Iconos Lucide

  1. Cambios en la Estructura
    - Agrega columna `lucide_icon` para almacenar nombres de iconos de lucide-react
    - Elimina todos los ramos existentes
    - Inserta nuevos ramos con iconos de lucide-react

  2. Nuevos Ramos
    - Particulares: Auto, Hogar, Motocicletas, GMM, Vida, etc.
    - Empresariales: Flotilla, Camiones, Transporte Público, Fianzas, etc.
    - Gobierno: Flotilla, Autos Oficiales, GMM, Vida, etc.
*/

-- Agregar columna para iconos de lucide-react
ALTER TABLE web_page_categories ADD COLUMN IF NOT EXISTS lucide_icon text;

-- Eliminar todos los ramos existentes
DELETE FROM web_page_categories;

-- Insertar nuevos ramos con iconos de lucide-react

-- PARTICULARES
INSERT INTO web_page_categories (name, slug, lucide_icon, card_title, card_description, display_order, is_active) VALUES
('Auto', 'seguro-auto', 'Car', 'Seguro para Auto', 'Protección para autos particulares y comerciales contra accidentes, robo y daños, con diferentes niveles de cobertura para adaptarse a tus necesidades.', 1, true),
('Hogar', 'seguro-hogar', 'Home', 'Seguro para Hogar', 'Cobertura para daños o pérdidas en tu vivienda por eventos como incendio, robo o desastres naturales.', 2, true),
('Motocicletas', 'seguro-motocicletas', 'Bike', 'Seguro para Motocicletas', 'Protección específica para motos ante accidentes, robo y daños propios.', 3, true),
('Gastos Médicos Mayores', 'gastos-medicos-mayores', 'HeartPulse', 'Seguro de Gastos Médicos', 'Cubre gastos por atención médica de enfermedades, percances o accidentes con acceso a una red médica.', 4, true),
('Vida', 'seguro-vida', 'Heart', 'Seguro de Vida', 'Protección económica para tus seres queridos en caso de fallecimiento o invalidez, con opciones de ahorro o renta.', 5, true),
('Accidentes Personales', 'accidentes-personales', 'Ambulance', 'Accidentes Personales', 'Cobertura básica frente a accidentes personales que pueden incluir asistencia médica y apoyo financiero en situaciones inesperadas.', 6, true),
('Taxi o Chofer App', 'taxi-chofer-app', 'CarTaxiFront', 'Taxi o Chofer App', 'Seguro adaptado para quienes trabajan como taxistas o conductores de apps (Uber, Cabify, etc.) para protección durante su labor.', 7, true),
('Educación', 'seguro-educacion', 'GraduationCap', 'Seguro para la Educación', 'Póliza orientada a formar patrimonio para educación futura de hijos o familiares.', 8, true),
('Agrícola y Pecuario', 'agricola-pecuario', 'Wheat', 'Agrícola y Pecuario', 'Seguros diseñados para proteger actividades del sector agrícola o pecuario, adaptados a riesgos de campo.', 9, true),
('Equipo Electrónico', 'equipo-electronico', 'Laptop', 'Seguro para Equipo Electrónico', 'Protección de equipos electrónicos frente a daños o robos.', 10, true);

-- EMPRESARIALES
INSERT INTO web_page_categories (name, slug, lucide_icon, card_title, card_description, display_order, is_active) VALUES
('Flotilla de Autos', 'flotilla-autos', 'CarFront', 'Flotilla de Autos', 'Seguro para un conjunto de vehículos de empresa, ideal para empresas con varias unidades.', 11, true),
('Camiones de Carga o Turismo', 'camiones-carga-turismo', 'Truck', 'Camiones de Carga o Turismo', 'Cobertura para camiones usados en transporte de carga o turismo.', 12, true),
('Transporte de Servicio Público', 'transporte-servicio-publico', 'Bus', 'Transporte de Servicio Público', 'Seguro específico para transporte que opera como servicio público (transporte urbano, etc.).', 13, true),
('Múltiple Empresarial', 'multiple-empresarial', 'BarChart3', 'Múltiple Empresarial', 'Seguro integral para empresas que agrupa varias coberturas bajo una sola póliza.', 14, true),
('Fianzas', 'fianzas', 'Shield', 'Fianzas', 'Garantía del cumplimiento de obligaciones contractuales entre partes, útil para empresas.', 15, true),
('Descuento vía Nómina', 'descuento-via-nomina', 'Briefcase', 'Descuento vía Nómina', 'Planes de seguros o beneficios que se pagan con descuento a través de la nómina de empleados.', 16, true),
('Marítimo y Aéreo', 'maritimo-aereo', 'Ship', 'Marítimo y Aéreo', 'Cobertura para mercancías o riesgos específicos asociados a transporte marítimo o aéreo.', 17, true),
('Agrícola y Pecuario Empresarial', 'agricola-pecuario-empresarial', 'Tractor', 'Agrícola y Pecuario (Empresarial)', 'Protección para actividades y bienes del sector agrícola o pecuario a nivel empresarial.', 18, true),
('Beneficio a empleados', 'beneficio-empleados', 'Users', 'Beneficio a empleados', 'Seguros y beneficios diseñados para proteger a los colaboradores (incluye salud, vida, etc.).', 19, true),
('Planes auto-administrados de GMM', 'planes-auto-administrados-gmm', 'Stethoscope', 'Planes auto-administrados de Gastos Médicos Mayores', 'Soluciones especializadas de salud colectiva para empleados de empresas.', 20, true);

-- GOBIERNO
INSERT INTO web_page_categories (name, slug, lucide_icon, card_title, card_description, display_order, is_active) VALUES
('Fianzas Gobierno', 'fianzas-gobierno', 'ShieldCheck', 'Fianzas', 'Garantías para compromisos públicos y contractuales frente a terceros.', 21, true),
('Flotilla de Autos Gobierno', 'flotilla-autos-gobierno', 'CarFront', 'Flotilla de Autos', 'Cobertura para flotas de vehículos de uso gubernamental.', 22, true),
('Autos de uso oficial', 'autos-uso-oficial', 'CarFront', 'Autos de uso oficial', 'Seguro específico para vehículos oficiales utilizados por instancias de gobierno.', 23, true),
('Gastos Médicos Mayores Gobierno', 'gastos-medicos-mayores-gobierno', 'Hospital', 'Gastos Médicos Mayores', 'Cobertura de salud para funcionarios o empleados de dependencias públicas.', 24, true),
('Seguro de Vida Gobierno', 'seguro-vida-gobierno', 'Heart', 'Seguro de Vida (Gobierno)', 'Protección financiera para dependientes o familias de servidores públicos.', 25, true),
('Descuento vía Nómina Gobierno', 'descuento-via-nomina-gobierno', 'DollarSign', 'Descuento vía Nómina (Gobierno)', 'Programas de seguros pagados mediante descuento en nómina de empleados públicos.', 26, true),
('Desarrollo y administración GMM Gobierno', 'desarrollo-administracion-gmm-gobierno', 'Activity', 'Desarrollo y administración de planes auto-administrados de Gastos Médicos Mayores', 'Planes de salud colectivos y autogestionados para instituciones públicas.', 27, true),
('Marítimo y Aéreo Gobierno', 'maritimo-aereo-gobierno', 'Plane', 'Marítimo y Aéreo (Gobierno)', 'Coberturas especiales para riesgos de transporte marítimo o aéreo en operaciones gubernamentales.', 28, true);
