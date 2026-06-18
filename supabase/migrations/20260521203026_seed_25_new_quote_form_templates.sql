/*
  # Seed 25 New Quote Form Templates

  ## Summary
  Adds 25 new insurance quotation form templates across new and existing categories.

  ## New Categories
  - Autos: Auto Individual, Auto Residente, Flotilla de Autos
  - Personas (additions): Vida Individual, Vida Grupo/Colectivo, AP Individual, AP Colectivo,
    GMM Colectivo/Empresarial, Salud/Gastos Menores, Dental/Vision
  - Fianzas y Credito: Fianzas, Seguro de Caucion, Seguro de Credito
  - Agro: Seguro Agricola, Seguro Ganadero, Maquinaria Agricola
  - RC y Financiero: Cyber/Riesgos Ciberneticos, D&O, Laboral, Fidelidad, Crime Empresarial
  - Especializados: Eventos, Mascotas, Arrendamiento, Condominal, Obras de Arte

  ## Notes
  - Uses INSERT ... ON CONFLICT (form_type) DO UPDATE to be idempotent
  - All templates start as active (is_active = true)
  - schema_json steps define wizard steps
*/

INSERT INTO quote_form_templates (form_type, title, description, category, icon, estimated_minutes, is_active, requires_risk_location, schema_json)
VALUES

/* ===== AUTOS ===== */
('auto_individual',
 'Auto Individual',
 'Cotizacion de seguro de auto para persona fisica. Cobertura amplia, limitada o basica.',
 'Autos', 'Car', 6, true, false,
 '{"steps":["Datos del vehiculo","Conductor principal","Coberturas","Revision"]}'::jsonb),

('auto_residente',
 'Auto Residente / Fronterizo',
 'Seguro de auto para vehiculos con placas extranjeras o residentes en zona fronteriza.',
 'Autos', 'Truck', 7, true, false,
 '{"steps":["Datos del vehiculo","Documentacion fronteriza","Conductor","Coberturas","Revision"]}'::jsonb),

('flotilla_autos',
 'Flotilla de Autos',
 'Seguro colectivo para flotas de vehiculos de empresas o personas morales.',
 'Autos', 'Bus', 10, true, false,
 '{"steps":["Datos de la empresa","Composicion de flota","Conductores","Coberturas","Revision"]}'::jsonb),

/* ===== PERSONAS (additions) ===== */
('vida_individual',
 'Vida Individual',
 'Seguro de vida para persona fisica con coberturas de fallecimiento, invalidez y beneficios adicionales.',
 'Personas', 'Heart', 8, true, false,
 '{"steps":["Datos del asegurado","Suma asegurada","Coberturas","Beneficiarios","Revision"]}'::jsonb),

('vida_grupo',
 'Vida Grupo / Colectivo',
 'Seguro de vida colectivo para empresas, asociaciones o grupos de personas.',
 'Personas', 'Users', 10, true, false,
 '{"steps":["Datos de la empresa","Grupo asegurado","Suma asegurada","Coberturas","Revision"]}'::jsonb),

('accidentes_personales_individual',
 'Accidentes Personales Individual',
 'Cobertura de accidentes personales para persona fisica: muerte accidental, invalidez, gastos medicos.',
 'Personas', 'UserCheck', 6, true, false,
 '{"steps":["Datos del asegurado","Actividades y riesgos","Coberturas","Revision"]}'::jsonb),

('accidentes_personales_colectivo',
 'Accidentes Personales Colectivo',
 'Cobertura de accidentes personales para grupos de trabajadores o asociados.',
 'Personas', 'Users', 8, true, false,
 '{"steps":["Datos de la empresa","Grupo asegurado","Actividades y riesgos","Coberturas","Revision"]}'::jsonb),

('gmm_colectivo',
 'GMM Colectivo / Empresarial',
 'Gastos Medicos Mayores para grupos de empleados. Incluye hospitalizacion, cirugia y emergencias.',
 'Personas', 'Building2', 12, true, false,
 '{"steps":["Datos de la empresa","Grupo asegurado","Coberturas","Deducible y coaseguro","Revision"]}'::jsonb),

('salud_gastos_menores',
 'Salud / Gastos Medicos Menores',
 'Seguro de salud con enfasis en consultas, medicamentos y estudios de laboratorio.',
 'Personas', 'Briefcase', 7, true, false,
 '{"steps":["Datos del asegurado","Historial medico","Coberturas","Revision"]}'::jsonb),

('dental_vision',
 'Dental / Vision',
 'Cobertura dental y/o de vision: limpiezas, tratamientos, lentes y cirugia refractiva.',
 'Personas', 'Smile', 5, true, false,
 '{"steps":["Datos del asegurado","Coberturas dental","Coberturas vision","Revision"]}'::jsonb),

/* ===== FIANZAS Y CREDITO ===== */
('fianza',
 'Fianzas',
 'Fianza de fidelidad, cumplimiento, judicial, arrendamiento u otras modalidades.',
 'Fianzas y Credito', 'Scale', 8, true, false,
 '{"steps":["Tipo de fianza","Datos del afianzado","Datos del beneficiario","Monto y plazo","Revision"]}'::jsonb),

('seguro_caucion',
 'Seguro de Caucion',
 'Garantiza el cumplimiento de obligaciones legales o contractuales ante organismos publicos o privados.',
 'Fianzas y Credito', 'ShieldCheck', 8, true, false,
 '{"steps":["Tipo de caucion","Datos del tomador","Datos del beneficiario","Monto y plazo","Revision"]}'::jsonb),

('seguro_credito',
 'Seguro de Credito',
 'Proteccion ante el impago de deudores comerciales o riesgo de insolvencia.',
 'Fianzas y Credito', 'Banknote', 9, true, false,
 '{"steps":["Datos de la empresa","Cartera de deudores","Limite de credito","Coberturas","Revision"]}'::jsonb),

/* ===== AGRO ===== */
('seguro_agricola',
 'Seguro Agricola',
 'Cobertura para cultivos ante perdidas por fenomenos meteorologicos, plagas o siniestros.',
 'Agro', 'Wheat', 9, true, true,
 '{"steps":["Datos del productor","Ubicacion del cultivo","Tipo de cultivo","Coberturas","Revision"]}'::jsonb),

('seguro_ganadero',
 'Seguro Ganadero',
 'Cobertura para ganado bovino, porcino, ovino, caprino u otras especies ante muerte o accidente.',
 'Agro', 'TreePine', 8, true, true,
 '{"steps":["Datos del productor","Ubicacion del rancho","Inventario ganadero","Coberturas","Revision"]}'::jsonb),

('maquinaria_agricola',
 'Maquinaria Agricola',
 'Seguro para tractores, cosechadoras y equipo agricola ante robo, accidente o danos.',
 'Agro', 'Tractor', 7, true, false,
 '{"steps":["Datos del asegurado","Relacion de maquinaria","Coberturas","Revision"]}'::jsonb),

/* ===== RC Y FINANCIERO ===== */
('cyber_riesgos',
 'Cyber / Riesgos Ciberneticos',
 'Cobertura ante ataques informaticos, robo de datos, ransomware e interrupcion de negocio digital.',
 'RC y Financiero', 'Cpu', 9, true, false,
 '{"steps":["Datos de la empresa","Infraestructura IT","Exposicion al riesgo","Coberturas","Revision"]}'::jsonb),

('do_consejeros',
 'D&O / Responsabilidad de Consejeros',
 'Proteccion para directivos y consejeros ante reclamaciones por actos en ejercicio de sus funciones.',
 'RC y Financiero', 'Briefcase', 10, true, false,
 '{"steps":["Datos de la empresa","Estructura directiva","Historial de reclamaciones","Coberturas","Revision"]}'::jsonb),

('responsabilidad_laboral',
 'Responsabilidad por Practicas Laborales',
 'Cobertura ante reclamaciones de empleados por discriminacion, acoso, despido injustificado.',
 'RC y Financiero', 'Scale', 9, true, false,
 '{"steps":["Datos de la empresa","Plantilla laboral","Historial de reclamaciones","Coberturas","Revision"]}'::jsonb),

('fidelidad_empleados',
 'Fidelidad / Infidelidad de Empleados',
 'Proteccion ante perdidas economicas causadas por actos deshonestos de empleados.',
 'RC y Financiero', 'ShieldCheck', 7, true, false,
 '{"steps":["Datos de la empresa","Puestos de riesgo","Suma asegurada","Coberturas","Revision"]}'::jsonb),

('crime_empresarial',
 'Crime Empresarial',
 'Cobertura amplia ante fraude, robo, falsificacion de documentos y delitos informaticos.',
 'RC y Financiero', 'Lock', 9, true, false,
 '{"steps":["Datos de la empresa","Exposicion al riesgo","Suma asegurada","Coberturas","Revision"]}'::jsonb),

/* ===== ESPECIALIZADOS ===== */
('seguro_eventos',
 'Seguro para Eventos',
 'Cobertura para eventos sociales, corporativos o culturales: cancelacion, RC y accidentes.',
 'Especializados', 'CalendarDays', 6, true, true,
 '{"steps":["Datos del evento","Ubicacion","Asistentes y actividades","Coberturas","Revision"]}'::jsonb),

('seguro_mascotas',
 'Seguro de Mascotas',
 'Cobertura veterinaria, de accidentes o RC para perros, gatos u otras mascotas.',
 'Especializados', 'PawPrint', 5, true, false,
 '{"steps":["Datos de la mascota","Historial veterinario","Coberturas","Revision"]}'::jsonb),

('proteccion_arrendamiento',
 'Proteccion de Renta / Arrendamiento',
 'Garantiza el pago de renta ante incumplimiento del arrendatario o danos al inmueble.',
 'Especializados', 'KeyRound', 6, true, true,
 '{"steps":["Datos del inmueble","Datos del arrendatario","Renta mensual","Coberturas","Revision"]}'::jsonb),

('seguro_condominal',
 'Seguro Condominal',
 'Cobertura para areas comunes, responsabilidad civil y bienes de condominios o edificios.',
 'Especializados', 'Building', 7, true, true,
 '{"steps":["Datos del condominio","Valor de areas comunes","Numero de unidades","Coberturas","Revision"]}'::jsonb),

('obras_arte',
 'Obras de Arte y Objetos de Valor',
 'Cobertura para colecciones de arte, joyas, antiguedades y objetos de valor ante robo o danos.',
 'Especializados', 'Frame', 8, true, false,
 '{"steps":["Datos del asegurado","Inventario de bienes","Valoracion","Coberturas","Revision"]}'::jsonb)

ON CONFLICT (form_type) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  estimated_minutes = EXCLUDED.estimated_minutes,
  is_active = EXCLUDED.is_active,
  requires_risk_location = EXCLUDED.requires_risk_location,
  schema_json = EXCLUDED.schema_json,
  updated_at = now();
