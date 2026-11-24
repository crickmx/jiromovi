
-- Multi-Autos module: insurer configurations and quote storage

CREATE TABLE IF NOT EXISTS multi_autos_aseguradoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#333333',
  tipo_api text NOT NULL CHECK (tipo_api IN ('SOAP', 'REST', 'SOAP_REST')),
  endpoint_url text,
  endpoint_desc text,
  derecho_poliza numeric(10,2) NOT NULL DEFAULT 750.00,
  factor_base numeric(5,3) NOT NULL DEFAULT 1.000,
  disponible boolean NOT NULL DEFAULT true,
  credential_keys jsonb NOT NULL DEFAULT '[]',
  configuracion jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE multi_autos_aseguradoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_multi_autos_aseguradoras" ON multi_autos_aseguradoras
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_multi_autos_aseguradoras" ON multi_autos_aseguradoras
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_multi_autos_aseguradoras" ON multi_autos_aseguradoras
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_multi_autos_aseguradoras" ON multi_autos_aseguradoras
  FOR DELETE TO authenticated USING (true);

-- Insert real insurer data
INSERT INTO multi_autos_aseguradoras (nombre, color, tipo_api, endpoint_desc, derecho_poliza, factor_base, credential_keys, configuracion) VALUES
('Qualitas', '#00A651', 'SOAP', 'SOAP WS Cotizacion v2.0 - wsdl.qualitas.com.mx', 870.00, 0.980, '["QUALITAS_WS_USER", "QUALITAS_WS_PASSWORD"]', '{"wsdl_url": "https://servicios.qualitas.com.mx/SICAPCotizadorWS/CotizadorWS?wsdl", "catalogo_url": "https://servicios.qualitas.com.mx/SICAPCatalogosWS/CatalogosWS?wsdl", "version": "2.0"}'),
('GNP', '#003DA5', 'SOAP', 'SOAP XML WS Multicotizador GNP', 720.00, 1.020, '["GNP_CLIENT_SOAP_PASS"]', '{"wsdl_url": "https://ws.gnp.com.mx/cotizador/autos/v1", "portal": "https://www.gnp.com.mx"}'),
('ANA Seguros', '#E31837', 'SOAP', 'XML SOAP API Cotizacion ANA', 750.00, 0.960, '["ANA_API_USER", "ANA_API_PASSWORD", "ANA_API_KEY"]', '{"api_url": "https://servicios.anaseguros.com.mx/ws/cotizacion", "version": "3.1"}'),
('HDI Seguros', '#006341', 'SOAP_REST', 'JSON/SOAP Endpoint HDI Autos', 750.00, 1.000, '["HDI_PARTNER_ID", "HDI_API_KEY"]', '{"rest_url": "https://api.hdi.com.mx/cotizador/v2", "soap_url": "https://ws.hdi.com.mx/autos/cotizar"}'),
('Zurich', '#003399', 'REST', 'REST API OAuth2 Client Credentials', 947.21, 1.050, '["ZURICH_CLIENT_ID", "ZURICH_CLIENT_SECRET"]', '{"token_url": "https://api.zurich.com.mx/oauth/token", "quote_url": "https://api.zurich.com.mx/auto/v1/quote", "scope": "auto:quote"}'),
('Chubb', '#B8860B', 'SOAP', 'SOAP Service Integrator Chubb', 799.00, 1.080, '["CHUBB_INTEGRATOR_ID"]', '{"wsdl_url": "https://wsautos.chubb.com.mx/CotizadorIntegrador/Service.svc?wsdl"}'),
('Potosi', '#8B0000', 'REST', 'REST API Bearer Token Potosi', 850.00, 0.930, '["POTOSI_BEARER_TOKEN"]', '{"api_url": "https://api.seguroselPotosi.com.mx/v2/cotizaciones/auto", "auth_type": "bearer"}')
ON CONFLICT (nombre) DO NOTHING;

-- Quotes table
CREATE TABLE IF NOT EXISTS multi_autos_cotizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text NOT NULL UNIQUE,
  fecha timestamptz NOT NULL DEFAULT now(),
  cliente jsonb NOT NULL,
  vehiculos jsonb NOT NULL,
  forma_pago text NOT NULL CHECK (forma_pago IN ('Anual', 'Semestral', 'Trimestral', 'Mensual')),
  status text NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Emitida', 'Expirada', 'Cancelada')),
  resultados_flota jsonb NOT NULL DEFAULT '[]',
  descuento_volumen numeric(4,2) NOT NULL DEFAULT 0,
  total_flota jsonb NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE multi_autos_cotizaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_multi_autos_cotizaciones" ON multi_autos_cotizaciones
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_multi_autos_cotizaciones" ON multi_autos_cotizaciones
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_multi_autos_cotizaciones" ON multi_autos_cotizaciones
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_multi_autos_cotizaciones" ON multi_autos_cotizaciones
  FOR DELETE TO authenticated USING (true);

-- Vehicle catalog reference table
CREATE TABLE IF NOT EXISTS multi_autos_catalogo_vehiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca text NOT NULL,
  modelo text NOT NULL,
  anio integer NOT NULL,
  version text NOT NULL,
  descripcion_completa text NOT NULL,
  clave_amis text,
  valor_referencia numeric(12,2) NOT NULL,
  carroceria text,
  metadata_aseguradoras jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE multi_autos_catalogo_vehiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_multi_autos_catalogo" ON multi_autos_catalogo_vehiculos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_multi_autos_catalogo" ON multi_autos_catalogo_vehiculos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_multi_autos_catalogo" ON multi_autos_catalogo_vehiculos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_multi_autos_catalogo" ON multi_autos_catalogo_vehiculos
  FOR DELETE TO authenticated USING (true);
