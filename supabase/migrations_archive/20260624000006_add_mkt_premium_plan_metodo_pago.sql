ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS mkt_premium_plan text CHECK (mkt_premium_plan IN ('mensual', 'anual')),
  ADD COLUMN IF NOT EXISTS mkt_premium_metodo_pago text CHECK (mkt_premium_metodo_pago IN ('deposito_jiro', 'bono_anual', 'comisiones'));
