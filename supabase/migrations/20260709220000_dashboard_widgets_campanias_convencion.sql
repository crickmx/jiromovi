-- Agrega los widgets "Campañas Activas" y "Convención" (datos de Bonos, igual
-- que Mi Producción) a la lista de widgets configurables del Dashboard.
INSERT INTO dashboard_widgets (widget_key, orden, full_width) VALUES
  ('campanias',  2, true),
  ('convencion', 3, true)
ON CONFLICT (widget_key) DO NOTHING;
