/*
  # Crear reglas de negocio predeterminadas usando PortPart

  1. Nuevas Reglas
    - Reglas para principales aseguradoras usando tipo_calculo 'usar_portpart'
    - Estas reglas toman el valor directo de la columna PortPart del Excel
    - Se crean para todos los ramos principales

  2. Aseguradoras incluidas
    - GNP
    - AXA
    - Qualitas
    - HDI
    - Mapfre
    - Chubb
    - AIG
    - Banorte Generali
    - Zurich

  3. Ramos incluidos
    - Autos
    - Vida
    - GMM (Gastos Médicos Mayores)
    - Daños
    - Diversos

  4. Notas
    - Prioridad más alta (100) para que se use preferentemente
    - Sin oficina específica (aplica a todas)
    - Válidas desde 2024-01-01
    - PortPart es la forma más precisa de calcular comisiones
*/

-- Insertar reglas para principales aseguradoras y ramos usando PortPart
INSERT INTO commission_business_rules 
  (ramo, aseguradora, office_id, campo_base, tipo_calculo, porcentaje, monto_fijo, minimo, maximo, prioridad, valid_from, valid_to)
VALUES
  -- GNP
  ('Autos', 'GNP', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Vida', 'GNP', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('GMM', 'GNP', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Daños', 'GNP', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Diversos', 'GNP', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  
  -- AXA
  ('Autos', 'AXA', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Vida', 'AXA', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('GMM', 'AXA', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Daños', 'AXA', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  
  -- Qualitas
  ('Autos', 'Qualitas', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Daños', 'Qualitas', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  
  -- HDI
  ('Autos', 'HDI', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Vida', 'HDI', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('GMM', 'HDI', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Daños', 'HDI', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  
  -- Mapfre
  ('Autos', 'Mapfre', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Vida', 'Mapfre', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('GMM', 'Mapfre', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Daños', 'Mapfre', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  
  -- Chubb
  ('Autos', 'Chubb', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Vida', 'Chubb', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Daños', 'Chubb', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  
  -- AIG
  ('Autos', 'AIG', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Vida', 'AIG', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('GMM', 'AIG', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Daños', 'AIG', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  
  -- Banorte Generali
  ('Autos', 'Banorte', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Vida', 'Banorte', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('GMM', 'Banorte', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  
  -- Zurich
  ('Autos', 'Zurich', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Vida', 'Zurich', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('GMM', 'Zurich', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL),
  ('Daños', 'Zurich', NULL, 'PortPart', 'usar_portpart', NULL, NULL, NULL, NULL, 100, '2024-01-01', NULL)

ON CONFLICT DO NOTHING;
