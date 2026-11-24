
/*
  # Create seguwallet_insurers module (v2 - idempotent)

  Creates a full insurer management system for the SeguWallet portal.
  All statements are safe to re-run.
*/

CREATE TABLE IF NOT EXISTS seguwallet_insurers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  primary_color text,
  website_url text,
  customer_service_phone text,
  payment_phone text,
  claims_phone text,
  customer_service_whatsapp text,
  claims_whatsapp text,
  payment_url text,
  ios_app_url text,
  android_app_url text,
  general_conditions_url text,
  claims_instructions text,
  is_active boolean NOT NULL DEFAULT true,
  show_in_directory boolean NOT NULL DEFAULT true,
  show_in_claims boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_seguwallet_insurers_active ON seguwallet_insurers(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seguwallet_insurers_order ON seguwallet_insurers(display_order) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION update_seguwallet_insurers_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seguwallet_insurers_updated_at ON seguwallet_insurers;
CREATE TRIGGER trg_seguwallet_insurers_updated_at
  BEFORE UPDATE ON seguwallet_insurers
  FOR EACH ROW EXECUTE FUNCTION update_seguwallet_insurers_updated_at();

ALTER TABLE seguwallet_insurers ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies first
DROP POLICY IF EXISTS "Admins can read all insurers" ON seguwallet_insurers;
DROP POLICY IF EXISTS "Admins can insert insurers" ON seguwallet_insurers;
DROP POLICY IF EXISTS "Admins can update insurers" ON seguwallet_insurers;
DROP POLICY IF EXISTS "Admins can delete insurers" ON seguwallet_insurers;
DROP POLICY IF EXISTS "Customers can read active insurers" ON seguwallet_insurers;
DROP POLICY IF EXISTS "Anonymous can read active insurers" ON seguwallet_insurers;

CREATE POLICY "Admins can read all insurers"
  ON seguwallet_insurers FOR SELECT
  TO authenticated
  USING (
    is_active = true AND deleted_at IS NULL
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado <> 'eliminado')
    )
  );

CREATE POLICY "Admins can insert insurers"
  ON seguwallet_insurers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado <> 'eliminado')
    )
  );

CREATE POLICY "Admins can update insurers"
  ON seguwallet_insurers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado <> 'eliminado')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado <> 'eliminado')
    )
  );

CREATE POLICY "Admins can delete insurers"
  ON seguwallet_insurers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado <> 'eliminado')
    )
  );

CREATE POLICY "Anonymous can read active insurers"
  ON seguwallet_insurers FOR SELECT
  TO anon
  USING (is_active = true AND deleted_at IS NULL);

-- Seed initial data
INSERT INTO seguwallet_insurers (name, logo_url, customer_service_phone, payment_url, general_conditions_url, ios_app_url, android_app_url, display_order, show_in_directory, show_in_claims, is_active)
VALUES
  ('Qualitas','https://jiro.mx/wp-content/uploads/elementor/thumbs/IogotipoQualitas-1-q7vo2ha7ft5k0jsjygalb57c17efv2nb97ef8mk6le.png','8008002021','https://bit.ly/30tjZNS','https://www.qualitas.com.mx/web/qmx/condiciones-generales','https://apps.apple.com/mx/app/qm%C3%B3vil/id781266280','https://play.google.com/store/apps/details?id=mx.com.qualitas.QMovil&hl=es_MX',1,true,true,true),
  ('Seguros El Potosi','https://jiro.mx/wp-content/uploads/elementor/thumbs/logo-100-q7vo0gwmtkeh6kpop30bh5guajb6ednzb961abjhq4.png','8004803100','https://pagos.elpotosi.com.mx/paginas/asegurado/busqueda.aspx','https://elpotosi.com.mx/CondicionesGenerales.aspx','https://apps.apple.com/mx/app/seguros-el-potosi/id1278336231','https://play.google.com/store/apps/details?id=com.elpotosi.android',2,true,true,true),
  ('Zurich','https://jiro.mx/wp-content/uploads/elementor/thumbs/Zurich-01-q7vodjtrxkb4r7pnb8keocmrwku2iqli400apy59lq.png','8002886911','https://portaldecobro-zurich.banwire.com','https://www.zurich.com.mx/es-mx/regulaciones','https://apps.apple.com/mx/app/zurich-connect/id1271722548','https://play.google.com/store/apps/details?id=com.mx.zurich.connect&hl=es_MX',3,true,true,true),
  ('ANA Seguros','https://jiro.mx/wp-content/uploads/elementor/thumbs/Ana-01-q7vocapitild9xj6mp2bco0ne30g99mdxsozoo05we.png','8008353262','https://anaseguros.com.mx/anaweb/paga_tu_poliza.html','https://www.anaseguros.com.mx/anaweb/condiciones_generales.html','https://apps.apple.com/mx/app/ana-go/id1208880726','https://play.google.com/store/apps/details?id=com.seguros.anago&hl=es_MX',4,true,true,true),
  ('Chubb / ABA Seguros','https://jiro.mx/wp-content/uploads/elementor/thumbs/Chubb-01-q7voc9romok2ybkjs6nos696sp531kinlo1i7e1k2m.png','8007122828','https://aba.chubb.com/pago-poliza','https://www.chubb.com/mx-es/condiciones-generales.html','https://apps.apple.com/mx/app/aba-clientes/id1514647073','https://play.google.com/store/apps/details?id=com.abachubb.appsiniestros&hl=es_MX',5,true,true,true),
  ('GNP','https://jiro.mx/wp-content/uploads/elementor/thumbs/logo-GNP-scaled-q7vo0pd6j2q232debonyllbzn05hbnlkcf1elt6ynm.jpeg','5552279000','https://www.gnp.com.mx/','https://www.gnp.com.mx/condiciones-generales-soy-cliente-gnp','https://apps.apple.com/mx/app/soy-cliente-gnp/id540222216','https://play.google.com/store/apps/details?id=com.gnp&hl=es_MX',6,true,true,true),
  ('HDI Seguros','https://jiro.mx/wp-content/uploads/elementor/thumbs/HDI-01-q7vodf4kze4p55wh2oj9tvtgxnh8g92ufcqvbkc8gu.png','8006673144','https://www.hdi.com.mx/atencion-a-clientes/pago-de-polizas/','https://www.hdi.com.mx/condiciones-generales/','https://apps.apple.com/mx/app/hdi-idriving/id1548021808','https://play.google.com/store/apps/details?id=com.hdi.idriving.drivingapp&hl=es_MX&gl=US',7,true,true,true),
  ('HIR Seguros','https://jiro.mx/wp-content/uploads/elementor/thumbs/hir_seguros-q7vo5owcsfjtol4m7c9pbu113lkl5ueap3n59nsseo.jpg','8007348477',NULL,'https://hirseguros.mx/condiciones-generales/',NULL,NULL,8,true,true,true),
  ('Ve por Mas BX+','https://jiro.mx/wp-content/uploads/elementor/thumbs/bx-01-q7vophe0oun650domw8wtu8fdo0t8eyu32571egde8.png','8008303676',NULL,'https://www.vepormas.com/fwpf/portal/documents/buscador',NULL,NULL,9,true,true,true)
ON CONFLICT DO NOTHING;
