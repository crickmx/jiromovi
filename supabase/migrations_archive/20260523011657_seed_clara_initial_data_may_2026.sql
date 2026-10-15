/*
  # Seed Clara Initial Data - May 2026

  1. Cost Centers (6)
    - Dir. Digital, Corporativo, Sin Asignar, Morelia, Dir. Mercadotecnia, Cuernavaca

  2. Simple Concepts (8)
    - Herramientas Digitales, Comunicaciones, Otros, Telefonia, Dominios y Hosting,
      Transporte, Insumos, Hosting

  3. Vendor Mappings (21 vendors)
    - All vendor-to-category mappings learned from the initial CSV

  4. Period
    - Mayo 2026 (2026-05-01 to 2026-05-22), 48 transactions, $65,077.40 MXN

  5. Transactions
    - All 48 transactions from the consolidado CSV
*/

-- Seed Cost Centers
INSERT INTO clara_cost_centers (name) VALUES
  ('Dir. Digital'),
  ('Corporativo'),
  ('Sin Asignar'),
  ('Morelia'),
  ('Dir. Mercadotecnia'),
  ('Cuernavaca')
ON CONFLICT (name) DO NOTHING;

-- Seed Simple Concepts
INSERT INTO clara_simple_concepts (name) VALUES
  ('Herramientas Digitales'),
  ('Comunicaciones'),
  ('Otros'),
  ('Telefonia'),
  ('Dominios y Hosting'),
  ('Transporte'),
  ('Insumos'),
  ('Hosting')
ON CONFLICT (name) DO NOTHING;

-- Seed Vendor Mappings
INSERT INTO clara_vendor_mappings (normalized_vendor, cost_center, simple_concept, description, usage_count) VALUES
  ('UBER RIDES', 'Corporativo', 'Transporte', 'Transporte local de personal y mensajeria', 3),
  ('IONOS', 'Dir. Digital', 'Dominios y Hosting', 'Dominios y servicios web', 5),
  ('OPENAI *CHATGPT SUBSCR', 'Dir. Digital', 'Herramientas Digitales', 'Suscripcion ChatGPT para el equipo', 1),
  ('BOLT (BY STACKBLITZ)', 'Dir. Digital', 'Herramientas Digitales', 'Herramienta de compilacion y sandbox de desarrollo', 10),
  ('UBER RIDE', 'Corporativo', 'Transporte', 'Transporte local de personal y mensajeria', 7),
  ('UBER *TRIP HELP.UBER.C', 'Corporativo', 'Transporte', 'Revisar APP', 2),
  ('CANVAPTYLIM', 'Dir. Mercadotecnia', 'Herramientas Digitales', 'Suscripcion Canva para diseno grafico', 1),
  ('SUPABASE', 'Dir. Digital', 'Hosting', 'Infraestructura base de datos y backend en la nube', 1),
  ('ROTOPLAS SERVI', 'Cuernavaca', 'Otros', 'Bebbia Agua', 1),
  ('TOTALPLAYTE', 'Cuernavaca', 'Comunicaciones', 'Internet', 1),
  ('ARDO.TECHNOLOGY', 'Dir. Digital', 'Herramientas Digitales', 'Servicios tecnologicos Ardo', 1),
  ('AMAZON', 'Morelia', 'Insumos', 'Compras de insumos y materiales en Amazon', 5),
  ('TELCEL INBURSA R6 CR', 'Corporativo', 'Telefonia', 'Planes de telefonia celular corporativos', 1),
  ('TELCEL INBURSA R9 CR', 'Corporativo', 'Telefonia', 'Planes de telefonia celular corporativos', 5),
  ('FARM DEL AHORRO', 'Sin Asignar', 'Otros', 'Medicamento Christofer', 1),
  ('ADOBE 2', 'Dir. Mercadotecnia', 'Herramientas Digitales', 'Licencias Suite Creativa Adobe de diseno', 1),
  ('SAMS VENTA EN LINEA', 'Dir. Digital', 'Comunicaciones', 'Equipos de computo', 1)
ON CONFLICT (normalized_vendor) DO UPDATE SET
  cost_center = EXCLUDED.cost_center,
  simple_concept = EXCLUDED.simple_concept,
  description = EXCLUDED.description,
  usage_count = EXCLUDED.usage_count,
  updated_at = now();

-- Create the period
INSERT INTO clara_periods (id, period_key, label, date_from, date_to, file_name, transaction_count, total_amount_mxn)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '2026-05',
  'Mayo 2026',
  '2026-05-01',
  '2026-05-22',
  'Clara_Consolidado_2026-05-01_a_2026-05-22.csv',
  48,
  65077.40
) ON CONFLICT (period_key) DO UPDATE SET
  transaction_count = EXCLUDED.transaction_count,
  total_amount_mxn = EXCLUDED.total_amount_mxn,
  file_name = EXCLUDED.file_name;

-- Insert all 48 transactions
INSERT INTO clara_transactions (transaction_date, original_vendor, normalized_vendor, amount_mxn, cost_center, simple_concept, description, card_alias, auth_code, match_type, batch_id, period_id) VALUES
  ('2026-05-21', 'DLO*UBER RIDES CIUDAD DE MEX', 'UBER RIDES', 207.48, 'Corporativo', 'Transporte', 'Transporte local de personal y mensajeria', '7747', '968386', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-21', 'PAYPAL *IONOS INC', 'IONOS', 250.00, 'Dir. Digital', 'Dominios y Hosting', '', '7747', '966683', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-21', 'OPENAI *CHATGPT SUBSCR', 'OPENAI *CHATGPT SUBSCR', 356.26, 'Dir. Digital', 'Herramientas Digitales', 'Suscripcion ChatGPT para el equipo', '7747', '961171', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-21', 'BOLT (BY STACKBLITZ) SAN FRANC', 'BOLT (BY STACKBLITZ)', 890.63, 'Dir. Digital', 'Herramientas Digitales', 'Herramienta de compilacion y sandbox de desarrollo', '7747', '969640', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-20', 'UBER RIDE', 'UBER RIDE', 63.38, 'Corporativo', 'Transporte', 'Transporte local de personal y mensajeria', '7747', '896558', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-20', 'UBER *TRIP HELP.UBER.C', 'UBER *TRIP HELP.UBER.C', 69.61, 'Corporativo', 'Transporte', 'Revisar APP', '7747', '901848', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-19', 'UBER RIDE', 'UBER RIDE', 58.93, 'Corporativo', 'Transporte', 'Transporte local de personal y mensajeria', '7747', '859196', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-19', 'UBER RIDE', 'UBER RIDE', 117.62, 'Corporativo', 'Transporte', 'Transporte local de personal y mensajeria', '7747', '885312', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-19', 'DLO*UBER RIDES', 'UBER RIDES', 209.98, 'Corporativo', 'Transporte', 'Transporte local de personal y mensajeria', '7747', '839261', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-19', 'PAYPAL *CANVAPTYLIM', 'CANVAPTYLIM', 330.00, 'Dir. Mercadotecnia', 'Herramientas Digitales', '', '7747', '887183', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-18', 'DLO*UBER RIDES', 'UBER RIDES', 209.98, 'Corporativo', 'Transporte', 'Transporte local de personal y mensajeria', '7747', '837306', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-18', 'SUPABASE', 'SUPABASE', 613.77, 'Dir. Digital', 'Hosting', 'Infraestructura base de datos y backend en la nube', '7747', '807109', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-18', 'BOLT (BY STACKBLITZ)', 'BOLT (BY STACKBLITZ)', 8934.07, 'Dir. Digital', 'Herramientas Digitales', 'Herramienta de compilacion y sandbox de desarrollo', '7747', '824037', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-15', 'OPENPAY*ROTOPLAS SERVI', 'ROTOPLAS SERVI', 269.00, 'Cuernavaca', 'Otros', 'Bebbia Agua', '7747', '743670', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-14', 'PAYPAL *IONOS INC', 'IONOS', 250.00, 'Dir. Digital', 'Dominios y Hosting', '', '7747', '712439', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-14', 'BOLT (BY STACKBLITZ)', 'BOLT (BY STACKBLITZ)', 1776.96, 'Dir. Digital', 'Herramientas Digitales', 'Herramienta de compilacion y sandbox de desarrollo', '7747', '704475', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-13', 'DLO*UBER RIDE', 'UBER RIDE', 119.94, 'Corporativo', 'Transporte', 'Transporte local de personal y mensajeria', '7747', '666730', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-13', 'UBER *TRIP HELP.UBER.C', 'UBER *TRIP HELP.UBER.C', 141.17, 'Corporativo', 'Transporte', 'Revisar plataforma', '7747', '670344', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-13', 'PAYPAL *TOTALPLAYTE', 'TOTALPLAYTE', 770.00, 'Cuernavaca', 'Comunicaciones', 'Internet', '7747', '667400', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-13', 'ARDO.TECHNOLOGY', 'ARDO.TECHNOLOGY', 4060.00, 'Dir. Digital', 'Herramientas Digitales', 'Servicios tecnologicos Ardo', '7747', '636791', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-12', 'UBER RIDE', 'UBER RIDE', 129.99, 'Corporativo', 'Transporte', 'Transporte local de personal y mensajeria', '7747', '598870', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-12', 'STR*AMAZON', 'AMAZON', 174.04, 'Morelia', 'Insumos', '', '7747', '641369', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-12', 'Amazon Mexico', 'AMAZON', 208.05, 'Morelia', 'Insumos', '', '7747', '632114', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-12', 'STR*AMAZON', 'AMAZON', 273.61, 'Morelia', 'Insumos', '', '7747', '643322', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-12', 'STR*AMAZON', 'AMAZON', 296.12, 'Morelia', 'Insumos', '', '7747', '626118', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-12', 'IONOS INC', 'IONOS', 500.00, 'Dir. Digital', 'Herramientas Digitales', '', '7747', '629566', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-12', 'BOLT (BY STACKBLITZ)', 'BOLT (BY STACKBLITZ)', 1772.68, 'Dir. Digital', 'Herramientas Digitales', 'Herramienta de compilacion y sandbox de desarrollo', '7747', '610609', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-12', 'Amazon Mexico', 'AMAZON', 3779.00, 'Morelia', 'Comunicaciones', 'Equipo de telefonia', '7747', '595330', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-11', 'STR*AMAZON', 'AMAZON', 1.00, 'Corporativo', 'Otros', '', '7747', '594420', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-11', 'TELCEL INBURSA R6 CR', 'TELCEL INBURSA R6 CR', 549.00, 'Corporativo', 'Telefonia', 'Planes de telefonia celular corporativos', '7747', '591331', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-09', 'IONOS INC', 'IONOS', 1540.00, 'Dir. Digital', 'Dominios y Hosting', '', '7747', '536237', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-09', 'BOLT (BY STACKBLITZ)', 'BOLT (BY STACKBLITZ)', 1772.68, 'Dir. Digital', 'Herramientas Digitales', 'Herramienta de compilacion y sandbox de desarrollo', '7747', '536334', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-09', 'FARM DEL AHORRO', 'FARM DEL AHORRO', 4907.80, 'Sin Asignar', 'Otros', 'Medicamento Christofer', '1012', '542263', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-08', 'IONOS INC', 'IONOS', 292.14, 'Dir. Digital', 'Dominios y Hosting', '', '7747', '522131', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-08', 'PAYPAL *IONOS INC', 'IONOS', 944.00, 'Dir. Digital', 'Dominios y Hosting', '', '7747', '520444', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-07', 'BOLT (BY STACKBLITZ)', 'BOLT (BY STACKBLITZ)', 1777.06, 'Dir. Digital', 'Herramientas Digitales', 'Herramienta de compilacion y sandbox de desarrollo', '7747', '480223', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-06', 'UBER RIDE', 'UBER RIDE', 119.98, 'Corporativo', 'Transporte', 'Transporte local de personal y mensajeria', '7747', '398378', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-06', 'BOLT (BY STACKBLITZ)', 'BOLT (BY STACKBLITZ)', 1789.65, 'Dir. Digital', 'Herramientas Digitales', 'Herramienta de compilacion y sandbox de desarrollo', '7747', '429974', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-05', 'UBER RIDE', 'UBER RIDE', 109.98, 'Corporativo', 'Transporte', 'Transporte local de personal y mensajeria', '7747', '369223', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-05', 'BOLT (BY STACKBLITZ)', 'BOLT (BY STACKBLITZ)', 1804.12, 'Dir. Digital', 'Herramientas Digitales', 'Herramienta de compilacion y sandbox de desarrollo', '7747', '382254', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-04', 'TELCEL INBURSA R9 CR', 'TELCEL INBURSA R9 CR', 549.00, 'Corporativo', 'Telefonia', 'Planes de telefonia celular corporativos', '7747', '349469', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-04', 'TELCEL INBURSA R9 CR', 'TELCEL INBURSA R9 CR', 549.00, 'Corporativo', 'Telefonia', 'Planes de telefonia celular corporativos', '7747', '337610', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-04', 'TELCEL INBURSA R9 CR', 'TELCEL INBURSA R9 CR', 549.00, 'Corporativo', 'Telefonia', 'Planes de telefonia celular corporativos', '7747', '337609', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-04', 'TELCEL INBURSA R9 CR', 'TELCEL INBURSA R9 CR', 549.00, 'Corporativo', 'Telefonia', 'Planes de telefonia celular corporativos', '7747', '349471', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-04', 'TELCEL INBURSA R9 CR', 'TELCEL INBURSA R9 CR', 654.99, 'Corporativo', 'Telefonia', 'Planes de telefonia celular corporativos', '7747', '349452', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-04', 'BOLT (BY STACKBLITZ)', 'BOLT (BY STACKBLITZ)', 1803.72, 'Dir. Digital', 'Herramientas Digitales', 'Herramienta de compilacion y sandbox de desarrollo', '7747', '342970', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-01', 'ADOBE 2', 'ADOBE 2', 944.09, 'Dir. Mercadotecnia', 'Herramientas Digitales', 'Licencias Suite Creativa Adobe de diseno', '7747', '249234', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('2026-05-01', 'SAMS VENTA EN LINEA', 'SAMS VENTA EN LINEA', 17038.92, 'Dir. Digital', 'Comunicaciones', 'Equipos de computo', '7747', '284141', 'Exacto', 'batch_seed_mayo2026', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT (auth_code, transaction_date, amount_mxn, normalized_vendor) DO NOTHING;
