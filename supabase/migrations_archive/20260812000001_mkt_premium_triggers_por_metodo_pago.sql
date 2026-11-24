-- Inserta dos triggers de activación de Marketing Premium según método de pago:
--   comisiones → registro_pedido_movi_store_mesacont  (Mesa de Control)
--   bono_anual  → registro_pedido_movi_store_bonos    (Bonos)

INSERT INTO mkt_premium_triggers (nombre, evento_id, ticket_tipo_id, descripcion_template, metodo_pago_filtro, activo)
SELECT
  'Registro MKT Premium — Descuento Comisiones',
  e.id,
  t.id,
  'Registro de pedido MKT Premium: {{nombre_completo}} ({{oficina}}) — Plan {{plan}} — {{metodo_pago}}',
  ARRAY['comisiones'],
  true
FROM mkt_premium_eventos e
JOIN ticket_tipos t ON t.value = 'registro_pedido_movi_store_mesacont'
WHERE e.key = 'activacion';

INSERT INTO mkt_premium_triggers (nombre, evento_id, ticket_tipo_id, descripcion_template, metodo_pago_filtro, activo)
SELECT
  'Registro MKT Premium — Cargo a Bono',
  e.id,
  t.id,
  'Registro de pedido MKT Premium: {{nombre_completo}} ({{oficina}}) — Plan {{plan}} — {{metodo_pago}}',
  ARRAY['bono_anual'],
  true
FROM mkt_premium_eventos e
JOIN ticket_tipos t ON t.value = 'registro_pedido_movi_store_bonos'
WHERE e.key = 'activacion';
