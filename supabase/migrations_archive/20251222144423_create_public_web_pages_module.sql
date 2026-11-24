/*
  # Módulo de Páginas Web Públicas

  ## Descripción
  Sistema completo para que cada usuario tenga su propia landing page pública
  bajo el dominio agentedeseguros.online con slug personalizado.

  ## Nuevas Tablas
  
  ### 1. `web_page_insurers` - Catálogo de Aseguradoras (Admin)
    - `id` (uuid, pk)
    - `name` (text) - Nombre de la aseguradora
    - `logo_url` (text) - URL del logo
    - `website_url` (text, nullable) - Sitio web oficial
    - `display_order` (integer) - Orden de visualización
    - `is_active` (boolean) - Activa/Inactiva
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 2. `web_page_categories` - Catálogo de Ramos (Admin)
    - `id` (uuid, pk)
    - `name` (text) - Nombre del ramo (Auto, Vida, GMM, etc)
    - `slug` (text, unique) - Slug para SEO
    - `icon_url` (text, nullable) - URL del icono
    - `card_title` (text) - Título para la card
    - `card_description` (text) - Descripción corta
    - `display_order` (integer) - Orden de visualización
    - `is_active` (boolean) - Activo/Inactivo
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 3. `user_web_pages` - Configuración de Página del Usuario
    - `id` (uuid, pk)
    - `user_id` (uuid, fk -> usuarios.id)
    - `primary_color` (text) - Color primario en hex (#RRGGBB)
    - `secondary_color` (text) - Color secundario en hex
    - `custom_text` (text[], array de hasta 5 párrafos)
    - `is_published` (boolean) - Publicada o no
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 4. `user_web_page_insurers` - Aseguradoras seleccionadas por usuario
    - `user_web_page_id` (uuid, fk -> user_web_pages.id)
    - `insurer_id` (uuid, fk -> web_page_insurers.id)
    - PK compuesta (user_web_page_id, insurer_id)

  ### 5. `user_web_page_categories` - Ramos seleccionados por usuario
    - `user_web_page_id` (uuid, fk -> user_web_pages.id)
    - `category_id` (uuid, fk -> web_page_categories.id)
    - PK compuesta (user_web_page_id, category_id)

  ## Modificaciones a Tablas Existentes
  
  ### `usuarios` - Agregar campo slug
    - `web_slug` (text, unique, nullable) - Slug personalizado para URL pública

  ## Seguridad
    - RLS habilitado en todas las tablas
    - Catálogos: admin puede gestionar, todos pueden leer activos
    - Configuración: cada usuario solo ve/edita la suya
    - Páginas públicas: lectura pública si is_published = true

  ## Valores por Default
    - Colores: primario #2563eb, secundario #7c3aed
    - Ramos default: Auto, GMM, Vida, Hogar, PYME
*/

-- 1. Agregar campo slug a usuarios
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS web_slug text UNIQUE;

-- Agregar constraint para validar formato del slug
ALTER TABLE usuarios
ADD CONSTRAINT web_slug_format 
CHECK (web_slug ~ '^[a-z0-9-]+$' OR web_slug IS NULL);

COMMENT ON COLUMN usuarios.web_slug IS 'Slug único para página web pública. Solo minúsculas, números y guiones. Ejemplo: segurosstudio';

-- 2. Crear tabla de catálogo de aseguradoras
CREATE TABLE IF NOT EXISTS web_page_insurers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text NOT NULL,
  website_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE web_page_insurers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage insurers"
  ON web_page_insurers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Everyone can view active insurers"
  ON web_page_insurers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Public can view active insurers"
  ON web_page_insurers
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Índices para performance
CREATE INDEX idx_web_insurers_active ON web_page_insurers(is_active, display_order);

-- 3. Crear tabla de catálogo de ramos/categorías
CREATE TABLE IF NOT EXISTS web_page_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  icon_url text,
  card_title text NOT NULL,
  card_description text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE web_page_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage categories"
  ON web_page_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Everyone can view active categories"
  ON web_page_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Public can view active categories"
  ON web_page_categories
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Índices para performance
CREATE INDEX idx_web_categories_active ON web_page_categories(is_active, display_order);
CREATE INDEX idx_web_categories_slug ON web_page_categories(slug);

-- 4. Crear tabla de configuración de página web del usuario
CREATE TABLE IF NOT EXISTS user_web_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  primary_color text NOT NULL DEFAULT '#2563eb',
  secondary_color text NOT NULL DEFAULT '#7c3aed',
  custom_text text[] DEFAULT ARRAY[]::text[],
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_web_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own web page config"
  ON user_web_pages
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own web page config"
  ON user_web_pages
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own web page config"
  ON user_web_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Public can view published web pages"
  ON user_web_pages
  FOR SELECT
  TO anon
  USING (is_published = true);

-- Índices
CREATE INDEX idx_user_web_pages_user ON user_web_pages(user_id);
CREATE INDEX idx_user_web_pages_published ON user_web_pages(is_published);

-- Constraint para validar colores hex
ALTER TABLE user_web_pages
ADD CONSTRAINT valid_primary_color 
CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$');

ALTER TABLE user_web_pages
ADD CONSTRAINT valid_secondary_color 
CHECK (secondary_color ~ '^#[0-9a-fA-F]{6}$');

-- Constraint para limitar a 5 párrafos
ALTER TABLE user_web_pages
ADD CONSTRAINT max_five_paragraphs 
CHECK (array_length(custom_text, 1) IS NULL OR array_length(custom_text, 1) <= 5);

-- 5. Tabla de relación: aseguradoras seleccionadas por usuario
CREATE TABLE IF NOT EXISTS user_web_page_insurers (
  user_web_page_id uuid NOT NULL REFERENCES user_web_pages(id) ON DELETE CASCADE,
  insurer_id uuid NOT NULL REFERENCES web_page_insurers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_web_page_id, insurer_id)
);

ALTER TABLE user_web_page_insurers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own web page insurers"
  ON user_web_page_insurers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_web_pages
      WHERE user_web_pages.id = user_web_page_insurers.user_web_page_id
      AND user_web_pages.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_web_pages
      WHERE user_web_pages.id = user_web_page_insurers.user_web_page_id
      AND user_web_pages.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view published web page insurers"
  ON user_web_page_insurers
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM user_web_pages
      WHERE user_web_pages.id = user_web_page_insurers.user_web_page_id
      AND user_web_pages.is_published = true
    )
  );

-- Índices
CREATE INDEX idx_user_web_insurers_page ON user_web_page_insurers(user_web_page_id);
CREATE INDEX idx_user_web_insurers_insurer ON user_web_page_insurers(insurer_id);

-- 6. Tabla de relación: ramos seleccionados por usuario
CREATE TABLE IF NOT EXISTS user_web_page_categories (
  user_web_page_id uuid NOT NULL REFERENCES user_web_pages(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES web_page_categories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_web_page_id, category_id)
);

ALTER TABLE user_web_page_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own web page categories"
  ON user_web_page_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_web_pages
      WHERE user_web_pages.id = user_web_page_categories.user_web_page_id
      AND user_web_pages.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_web_pages
      WHERE user_web_pages.id = user_web_page_categories.user_web_page_id
      AND user_web_pages.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view published web page categories"
  ON user_web_page_categories
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM user_web_pages
      WHERE user_web_pages.id = user_web_page_categories.user_web_page_id
      AND user_web_pages.is_published = true
    )
  );

-- Índices
CREATE INDEX idx_user_web_categories_page ON user_web_page_categories(user_web_page_id);
CREATE INDEX idx_user_web_categories_category ON user_web_page_categories(category_id);

-- 7. Función para obtener página web pública por slug
CREATE OR REPLACE FUNCTION get_public_web_page_by_slug(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'user', json_build_object(
      'id', u.id,
      'name', u.nombre_completo,
      'email', u.email_laboral,
      'phone', u.celular_laboral,
      'photo_url', u.foto_url,
      'office', json_build_object(
        'name', o.name,
        'logo_url', o.logo_url
      )
    ),
    'config', json_build_object(
      'primary_color', uwp.primary_color,
      'secondary_color', uwp.secondary_color,
      'custom_text', uwp.custom_text,
      'is_published', uwp.is_published
    ),
    'insurers', (
      SELECT json_agg(json_build_object(
        'id', wpi.id,
        'name', wpi.name,
        'logo_url', wpi.logo_url,
        'website_url', wpi.website_url
      ) ORDER BY wpi.display_order)
      FROM user_web_page_insurers uwpi
      JOIN web_page_insurers wpi ON wpi.id = uwpi.insurer_id
      WHERE uwpi.user_web_page_id = uwp.id
      AND wpi.is_active = true
    ),
    'categories', (
      SELECT json_agg(json_build_object(
        'id', wpc.id,
        'name', wpc.name,
        'slug', wpc.slug,
        'icon_url', wpc.icon_url,
        'card_title', wpc.card_title,
        'card_description', wpc.card_description
      ) ORDER BY wpc.display_order)
      FROM user_web_page_categories uwpc
      JOIN web_page_categories wpc ON wpc.id = uwpc.category_id
      WHERE uwpc.user_web_page_id = uwp.id
      AND wpc.is_active = true
    )
  ) INTO v_result
  FROM usuarios u
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  LEFT JOIN user_web_pages uwp ON uwp.user_id = u.id
  WHERE u.web_slug = p_slug
  AND uwp.is_published = true
  AND u.estado = 'activo';

  RETURN v_result;
END;
$$;

-- 8. Insertar ramos por defecto
INSERT INTO web_page_categories (name, slug, card_title, card_description, display_order, is_active)
VALUES
  ('Auto', 'auto', 'Seguro de Auto', 'Protege tu vehículo con la mejor cobertura. Comparamos las mejores opciones del mercado para ti.', 1, true),
  ('GMM', 'gastos-medicos-mayores', 'Gastos Médicos Mayores', 'Cuida tu salud y la de tu familia. Te ayudamos a encontrar el plan ideal según tus necesidades.', 2, true),
  ('Vida', 'vida', 'Seguro de Vida', 'Protege el futuro de tus seres queridos. Cotiza y contrata con asesoría personalizada.', 3, true),
  ('Hogar', 'hogar', 'Seguro de Hogar', 'Tu casa y tus bienes protegidos. Cobertura completa contra robo, incendio y desastres naturales.', 4, true),
  ('PYME', 'pyme', 'Seguro para Empresas', 'Protege tu negocio con seguros diseñados para PyMEs. Cobertura integral para tu patrimonio empresarial.', 5, true)
ON CONFLICT (slug) DO NOTHING;

-- 9. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_web_page_insurers_updated_at
  BEFORE UPDATE ON web_page_insurers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_web_page_categories_updated_at
  BEFORE UPDATE ON web_page_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_web_pages_updated_at
  BEFORE UPDATE ON user_web_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
