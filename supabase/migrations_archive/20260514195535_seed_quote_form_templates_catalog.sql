/*
  # Seed Quote Form Templates - All 24 insurance form types

  Inserts the complete catalog of quotation form templates
  organized by category (Personas, Hogar, Empresarial, RC, Transportes, Ingenieria)
*/

INSERT INTO quote_form_templates (form_type, title, description, category, icon, estimated_minutes, requires_risk_location, schema_json)
VALUES
-- Personas
('gmm_individual', 'Gastos Medicos Mayores Individual', 'Cotiza planes individuales con cuestionario medico y dependientes.', 'Personas', 'Heart', 12, false, '{"steps":["client","insured","medical","habits","plan","payment","beneficiary","attachments","review"]}'::jsonb),
('accidentes_escolares', 'Accidentes Personales Escolares / Escuela Segura', 'Cotizacion colectiva para escuelas, alumnos, personal docente y administrativo.', 'Personas', 'GraduationCap', 8, false, '{"steps":["client","school","participants","coverages","attachments","review"]}'::jsonb),
('auto_alta_gama', 'Auto / Unidad de Alta Gama', 'Cotizacion para vehiculos de alta gama o unidades especiales.', 'Personas', 'Car', 5, false, '{"steps":["client","vehicle","driver","coverages","attachments","review"]}'::jsonb),

-- Hogar
('hogar_casa_habitacion', 'Hogar / Casa Habitacion', 'Cotiza inmuebles habitacionales, contenidos, robo, RC familiar y coberturas adicionales.', 'Hogar', 'Home', 8, true, '{"steps":["client","location","construction","coverages","special_goods","security","attachments","review"]}'::jsonb),
('casa_con_negocio', 'Casa con Negocio', 'Para vivienda que incluye una actividad comercial o negocio dentro del inmueble.', 'Hogar', 'Store', 8, true, '{"steps":["client","location","business","coverages","security","attachments","review"]}'::jsonb),

-- Empresarial
('pyme_comercio', 'PyME / Comercio', 'Cotizacion para pequenos negocios, locales, comercios y PyMES.', 'Empresarial', 'Building2', 8, true, '{"steps":["client","location","business","coverages","security","attachments","review"]}'::jsonb),
('empresa_paquete', 'Empresa / Paquete Empresarial', 'Cotizacion integral para empresas con varios ramos contratados.', 'Empresarial', 'Factory', 12, true, '{"steps":["client","location","construction","coverages_incendio","coverages_rc","coverages_diversas","attachments","review"]}'::jsonb),
('incendio', 'Incendio', 'Cotizacion especifica para incendio de edificio, contenidos y perdidas consecuenciales.', 'Empresarial', 'Flame', 6, true, '{"steps":["client","location","construction","coverages","attachments","review"]}'::jsonb),
('gasolinera', 'Gasolinera', 'Cotizacion para estaciones de servicio, tanques, dispensarios, islas y riesgos asociados.', 'Empresarial', 'Fuel', 10, true, '{"steps":["client","location","station_details","coverages","security","attachments","review"]}'::jsonb),

-- Responsabilidad Civil
('rc_general', 'Responsabilidad Civil General', 'Cotiza actividades, contratistas, hoteles, estacionamientos y coberturas adicionales.', 'Responsabilidad Civil', 'Shield', 7, false, '{"steps":["client","activity","coverages","additional","attachments","review"]}'::jsonb),
('rc_profesional', 'Responsabilidad Civil Profesional', 'RC profesional para profesionistas, empresas de servicios o actividades profesionales.', 'Responsabilidad Civil', 'Briefcase', 7, false, '{"steps":["client","professional","history","coverages","attachments","review"]}'::jsonb),
('rc_agentes_seguros', 'R.C. Profesional / E&O Agentes de Seguros', 'RC profesional para agentes, agencias, promotorias e intermediarios de seguros y fianzas.', 'Responsabilidad Civil', 'BadgeCheck', 8, false, '{"steps":["client","agent_data","portfolio","claims","coverages","attachments","review"]}'::jsonb),
('rc_estancias_infantiles', 'R.C. Estancias Infantiles', 'Cotizacion para guarderias, estancias infantiles y centros de cuidado infantil.', 'Responsabilidad Civil', 'Baby', 6, true, '{"steps":["client","location","facility","staff","security","coverages","attachments","review"]}'::jsonb),
('rc_ambiental', 'Responsabilidad Ambiental', 'Cotizacion para riesgos ambientales, hidrocarburos y posibles danos a terceros.', 'Responsabilidad Civil', 'Leaf', 8, true, '{"steps":["client","location","activity","environmental","coverages","attachments","review"]}'::jsonb),
('rc_viajero', 'R.C. Viajero', 'RC para transporte terrestre o maritimo de pasajeros.', 'Responsabilidad Civil', 'Bus', 6, false, '{"steps":["client","transport","vehicle","coverages","attachments","review"]}'::jsonb),

-- Transportes
('transporte_carga', 'Transporte de Carga', 'Cotiza embarques terrestres, maritimos, aereos o ferroviarios.', 'Transportes', 'Truck', 7, false, '{"steps":["client","policy_type","cargo","route","coverages","attachments","review"]}'::jsonb),
('aviacion', 'Aviacion', 'Cotizacion para aeronaves, casco y responsabilidad civil.', 'Transportes', 'Plane', 8, false, '{"steps":["client","aircraft","pilot","coverages","attachments","review"]}'::jsonb),
('buques', 'Buques', 'Cotizacion para embarcaciones, casco, RC y riesgos maritimos.', 'Transportes', 'Ship', 10, false, '{"steps":["client","vessel","dimensions","coverages","attachments","review"]}'::jsonb),

-- Ingenieria
('todo_riesgo_construccion', 'Todo Riesgo Construccion / Obra Civil', 'Cotizacion para obra civil, construccion y proyectos.', 'Ingenieria', 'HardHat', 8, true, '{"steps":["client","location","project","coverages","attachments","review"]}'::jsonb),
('montaje_maquinaria', 'Montaje de Maquinaria', 'Cotizacion para montaje, instalacion o armado de maquinaria.', 'Ingenieria', 'Wrench', 7, true, '{"steps":["client","location","project","goods","coverages","attachments","review"]}'::jsonb),
('equipo_contratista', 'Equipo de Contratista y Maquinaria Pesada Movil', 'Cotizacion para maquinaria pesada, equipo de contratista y equipo movil.', 'Ingenieria', 'Cog', 7, true, '{"steps":["client","activity","equipment_list","coverages","attachments","review"]}'::jsonb),
('rotura_maquinaria', 'Rotura de Maquinaria', 'Cotizacion para dano interno o accidental de maquinaria.', 'Ingenieria', 'Settings', 6, false, '{"steps":["client","machinery","maintenance","coverages","attachments","review"]}'::jsonb),
('calderas_presion', 'Calderas y Recipientes Sujetos a Presion', 'Cotizacion para calderas, recipientes sujetos a presion, tuberias y contenidos.', 'Ingenieria', 'Thermometer', 6, true, '{"steps":["client","location","equipment","coverages","attachments","review"]}'::jsonb),
('equipo_electronico', 'Equipo Electronico y Electromagnetico', 'Cotizacion para equipo electronico fijo, movil, portadores externos y costos de operacion.', 'Ingenieria', 'Monitor', 7, true, '{"steps":["client","location","equipment_list","security","coverages","attachments","review"]}'::jsonb)

ON CONFLICT (form_type) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  estimated_minutes = EXCLUDED.estimated_minutes,
  requires_risk_location = EXCLUDED.requires_risk_location,
  schema_json = EXCLUDED.schema_json,
  updated_at = now();
