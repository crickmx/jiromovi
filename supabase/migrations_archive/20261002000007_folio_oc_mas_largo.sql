-- El folio de la Orden de Compra ya no cabe en 8 caracteres.
--
-- `folio_oc` nació como `varchar(8)` porque el folio era `A7F2K9XY` y nada más.
-- El folio nuevo dice de qué es, de quién y cuántos van —`ARTMKT-00118-POL-MGL`,
-- 20 caracteres— así que cualquier pedido nuevo tronaba al guardarse con
-- "value too long for type character varying(8)".
--
-- Se pasa a `text` en vez de a un `varchar(N)` más grande: ya pasó una vez que
-- el largo se quedara corto, y un límite de caracteres aquí no protege de nada.
-- La restricción UNIQUE se conserva sola al cambiar el tipo.

ALTER TABLE public.store_pedidos
  ALTER COLUMN folio_oc TYPE text;
