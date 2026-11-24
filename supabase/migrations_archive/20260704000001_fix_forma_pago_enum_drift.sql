-- Drift entre BD y frontend: el enum forma_pago_oc (creado 2026-01-19) solo acepta
-- 'Contado','Mensual','Trimestral','Semestral', pero el frontend (storeTypes.ts,
-- FormaPagoOC) usa 'Contado','2 Parcialidades','12 Meses' desde hace tiempo. Por eso
-- guardar cualquier forma de pago que no fuera 'Contado' fallaba con
-- "invalid input value for enum forma_pago_oc".
--
-- Se cambia la columna a texto libre (igual que store_pedido_pagos.metodo, que nunca
-- tuvo este problema por no ser enum) para no repetir este drift si el frontend vuelve
-- a cambiar las opciones.
ALTER TABLE store_pedidos ALTER COLUMN forma_pago TYPE text;
DROP TYPE IF EXISTS forma_pago_oc;
