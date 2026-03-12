/*
  # Agregar datos de ejemplo para catálogos de Registro de Actividades

  1. Datos de ejemplo
    - Tipos de trámite comunes
    - Tipos de seguro comunes
*/

-- =====================================================
-- DATOS DE EJEMPLO: Tipos de Trámite
-- =====================================================
INSERT INTO tramite_activity_types (nombre, descripcion, activo) VALUES
  ('Cotización', 'Elaboración y envío de cotizaciones a clientes', true),
  ('Emisión', 'Emisión de pólizas nuevas', true),
  ('Renovación', 'Renovación de pólizas existentes', true),
  ('Siniestro', 'Seguimiento y gestión de siniestros', true),
  ('Endoso', 'Modificaciones a pólizas vigentes', true),
  ('Cancelación', 'Cancelación de pólizas', true),
  ('Cobranza', 'Seguimiento de pagos y cobranza', true),
  ('Atención al cliente', 'Atención general y consultas de clientes', true)
ON CONFLICT (nombre) DO NOTHING;

-- =====================================================
-- DATOS DE EJEMPLO: Tipos de Seguro
-- =====================================================
INSERT INTO insurance_types (nombre, descripcion, activo) VALUES
  ('Auto', 'Seguros de automóviles', true),
  ('Vida', 'Seguros de vida', true),
  ('GMM', 'Gastos Médicos Mayores', true),
  ('Daños', 'Seguros de daños materiales', true),
  ('Hogar', 'Seguros para el hogar', true),
  ('Empresa', 'Seguros empresariales', true),
  ('Accidentes Personales', 'Seguros de accidentes personales', true),
  ('Responsabilidad Civil', 'Seguros de responsabilidad civil', true)
ON CONFLICT (nombre) DO NOTHING;
