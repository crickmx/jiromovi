/*
  # Agregar campos fiscales a commission_batches
  
  1. Nuevas Columnas
    - `commission_vida` (numeric) - Comisión de ramo Vida
    - `commission_sinvida` (numeric) - Comisión de ramos que no son Vida
    - `commission_total` (numeric) - Comisión total calculada
    - `retencion_contable` (numeric) - Retención contable calculada
    - `costo_dispersion` (numeric) - Costo de dispersión calculado
    - `iva` (numeric) - IVA calculado
    - `ret_isr` (numeric) - Retención ISR calculada
    - `ret_iva` (numeric) - Retención IVA calculada
    - `total_neto` (numeric) - Total neto a pagar
    - `regimen_fiscal` (text) - Régimen fiscal del lote (HONORARIOS, RESICO, ASIMILADOS)
    - `tax_version` (text) - Versión del cálculo fiscal aplicado
    - `calculated_at` (timestamptz) - Fecha y hora del cálculo fiscal
  
  2. Propósito
    - Persistir cálculos fiscales en el lote para evitar recalcular
    - El PDF y otros módulos consultan estos valores en lugar de recalcular
    - Único punto de verdad para cálculos fiscales
*/

-- Agregar campos fiscales a commission_batches
ALTER TABLE commission_batches 
ADD COLUMN IF NOT EXISTS commission_vida numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_sinvida numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS retencion_contable numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_dispersion numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS ret_isr numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS ret_iva numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_neto numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS regimen_fiscal text,
ADD COLUMN IF NOT EXISTS tax_version text,
ADD COLUMN IF NOT EXISTS calculated_at timestamptz;

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_commission_batches_regimen ON commission_batches(regimen_fiscal);
CREATE INDEX IF NOT EXISTS idx_commission_batches_calculated ON commission_batches(calculated_at) WHERE calculated_at IS NOT NULL;