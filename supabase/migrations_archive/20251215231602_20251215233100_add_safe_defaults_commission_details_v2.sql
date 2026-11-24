/*
  # Agregar defaults seguros a commission_details para conversión robusta

  1. Cambios
    - Hacer date_fpago nullable (algunos documentos no tienen fecha)
    - Agregar defaults a campos críticos
    - Garantizar que no fallen inserts por NOT NULL

  2. Seguridad
    - No afecta datos existentes
    - Permite conversiones con datos incompletos
*/

-- Hacer date_fpago nullable (algunos documentos no tienen FPago)
ALTER TABLE commission_details
  ALTER COLUMN date_fpago DROP NOT NULL;

-- Agregar defaults seguros para campos numéricos (evitar NOT NULL errors)
ALTER TABLE commission_details
  ALTER COLUMN prima_neta SET DEFAULT 0,
  ALTER COLUMN commission_bruta SET DEFAULT 0,
  ALTER COLUMN commission_neta SET DEFAULT 0,
  ALTER COLUMN importe_base SET DEFAULT 0,
  ALTER COLUMN porcentaje_comision SET DEFAULT 0;

-- Agregar defaults para campos de texto (evitar NOT NULL errors)
ALTER TABLE commission_details
  ALTER COLUMN ramo SET DEFAULT 'N/A',
  ALTER COLUMN aseguradora SET DEFAULT 'N/A',
  ALTER COLUMN poliza SET DEFAULT 'N/A';

-- Comentarios
COMMENT ON COLUMN commission_details.date_fpago IS 'Fecha de pago (FPago). Puede ser NULL si el documento no tiene fecha definida';
COMMENT ON TABLE commission_details IS 'Detalles de comisiones. Los defaults permiten inserción robusta incluso con datos incompletos';
