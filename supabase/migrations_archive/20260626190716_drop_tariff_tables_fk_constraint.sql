-- Allow tariff_tables to reference both tariff_packages and multicotizador_gmm_packages
ALTER TABLE tariff_tables DROP CONSTRAINT IF EXISTS tariff_tables_tariff_package_id_fkey;