/*
  # Add monto_unitario to store_pedido_detalle_gastos

  ## Summary
  Line item expenses (gastos por producto) should be entered per-unit, not as a fixed total.
  This adds a `monto_unitario` column so that the total expense for a line is:
    monto_unitario * cantidad_del_detalle

  The existing `monto` column is kept for backwards compatibility and will be updated
  by a trigger to always equal monto_unitario * detalle.cantidad.

  ## Changes
  - `store_pedido_detalle_gastos`: add `monto_unitario numeric(10,2)` column (NOT NULL, default 0)
  - Backfill existing rows: set monto_unitario = monto (treat old records as already total,
    which means monto_unitario = monto for single-unit items; acceptable for existing data)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_pedido_detalle_gastos' AND column_name = 'monto_unitario'
  ) THEN
    ALTER TABLE store_pedido_detalle_gastos
      ADD COLUMN monto_unitario numeric(10,2) NOT NULL DEFAULT 0;

    -- Backfill: treat existing monto as monto_unitario
    UPDATE store_pedido_detalle_gastos
    SET monto_unitario = monto
    WHERE monto_unitario = 0;
  END IF;
END $$;
