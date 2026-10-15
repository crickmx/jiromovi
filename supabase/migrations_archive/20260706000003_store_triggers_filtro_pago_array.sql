-- Permite elegir varios métodos/formas de pago en un mismo trigger de Store -> Trámites
-- (antes solo aceptaba uno, obligando a crear un trigger duplicado por cada valor que
-- debía disparar la misma acción). NULL o arreglo vacío = cualquiera.

ALTER TABLE store_tramite_triggers
  ALTER COLUMN metodo_pago_filtro TYPE text[]
  USING (CASE WHEN metodo_pago_filtro IS NULL THEN NULL ELSE ARRAY[metodo_pago_filtro] END);

ALTER TABLE store_tramite_triggers
  ALTER COLUMN forma_pago_filtro TYPE text[]
  USING (CASE WHEN forma_pago_filtro IS NULL THEN NULL ELSE ARRAY[forma_pago_filtro] END);
