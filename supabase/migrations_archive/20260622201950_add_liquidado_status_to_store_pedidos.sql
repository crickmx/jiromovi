-- Add "Liquidado" status (cierra venta) as the final status
INSERT INTO store_estatus_pedidos (nombre, orden, activo)
VALUES ('Liquidado', 5, true);