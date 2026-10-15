/*
  # Renombrar columna fpago a date_fpago en commission_details

  1. Cambios
    - Renombrar columna fpago a date_fpago para consistencia con edge functions
    - Mantener todos los constraints y defaults existentes
  
  2. Razón
    - Las edge functions esperan 'date_fpago' pero la columna se llama 'fpago'
    - Esto causa error: "Could not find the 'date_fpago' column"
*/

-- Renombrar columna fpago a date_fpago
ALTER TABLE commission_details 
  RENAME COLUMN fpago TO date_fpago;

-- Verificar que el comentario se mantenga
COMMENT ON COLUMN commission_details.date_fpago IS 'Fecha de pago (FPago) - puede ser NULL para lote "Sin fecha"';
