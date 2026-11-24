/*
  # Módulo de Publicidad - Personalización de Medios con Logo y Texto

  1. Nuevas Tablas
    - `publicidad_categorias`
      - `id` (uuid, primary key)
      - `nombre` (text) - Nombre de la categoría
      - `descripcion` (text) - Descripción opcional
      - `orden` (integer) - Orden de visualización
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `publicidad_plantillas`
      - `id` (uuid, primary key)
      - `titulo` (text) - Título de la plantilla
      - `descripcion` (text) - Descripción
      - `tipo` (text) - 'imagen' o 'video'
      - `categoria_id` (uuid, foreign key)
      - `archivo_url` (text) - URL del archivo original
      - `miniatura_url` (text) - URL de la miniatura
      - `ancho` (integer) - Ancho original en píxeles
      - `alto` (integer) - Alto original en píxeles
      - `duracion` (integer) - Duración en segundos (solo video)
      - `zona_logo` (jsonb) - Coordenadas y propiedades de la zona del logo
      - `zona_texto` (jsonb) - Coordenadas y propiedades de la zona del texto
      - `estilo_texto_default` (jsonb) - Estilo por defecto del texto
      - `activa` (boolean) - Si está activa para uso
      - `created_by` (uuid, foreign key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `publicidad_disenos`
      - `id` (uuid, primary key)
      - `usuario_id` (uuid, foreign key)
      - `plantilla_id` (uuid, foreign key)
      - `logo_url` (text) - URL del logo subido por el usuario
      - `texto_personalizado` (jsonb) - Textos personalizados
      - `estilo_texto` (jsonb) - Estilo aplicado al texto
      - `archivo_resultante_url` (text) - URL del diseño final
      - `metadata` (jsonb) - Información adicional
      - `created_at` (timestamp)

  2. Storage Buckets
    - `publicidad-plantillas` - Para archivos originales
    - `publicidad-logos` - Para logos de usuarios
    - `publicidad-disenos` - Para diseños finales generados

  3. Seguridad
    - RLS habilitado en todas las tablas
    - Administradores pueden gestionar plantillas y categorías
    - Todos pueden ver plantillas activas
    - Usuarios solo ven sus propios diseños
*/

-- Crear tabla de categorías
CREATE TABLE IF NOT EXISTS publicidad_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  orden integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de plantillas
CREATE TABLE IF NOT EXISTS publicidad_plantillas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  tipo text NOT NULL CHECK (tipo IN ('imagen', 'video')),
  categoria_id uuid REFERENCES publicidad_categorias(id) ON DELETE SET NULL,
  archivo_url text NOT NULL,
  miniatura_url text,
  ancho integer,
  alto integer,
  duracion integer,
  zona_logo jsonb DEFAULT '{"x": 0, "y": 0, "width": 0.2, "height": 0.2}'::jsonb,
  zona_texto jsonb DEFAULT '{"x": 0, "y": 0.8, "width": 1, "height": 0.2}'::jsonb,
  estilo_texto_default jsonb DEFAULT '{"font": "Inter", "color": "#ffffff", "size": 24, "align": "center"}'::jsonb,
  activa boolean DEFAULT true,
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de diseños personalizados
CREATE TABLE IF NOT EXISTS publicidad_disenos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  plantilla_id uuid REFERENCES publicidad_plantillas(id) ON DELETE SET NULL,
  logo_url text,
  texto_personalizado jsonb DEFAULT '{}'::jsonb,
  estilo_texto jsonb,
  archivo_resultante_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_publicidad_categorias_orden ON publicidad_categorias(orden);
CREATE INDEX IF NOT EXISTS idx_publicidad_plantillas_categoria ON publicidad_plantillas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_publicidad_plantillas_tipo ON publicidad_plantillas(tipo);
CREATE INDEX IF NOT EXISTS idx_publicidad_plantillas_activa ON publicidad_plantillas(activa);
CREATE INDEX IF NOT EXISTS idx_publicidad_disenos_usuario ON publicidad_disenos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_publicidad_disenos_plantilla ON publicidad_disenos(plantilla_id);

-- Habilitar RLS
ALTER TABLE publicidad_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE publicidad_plantillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE publicidad_disenos ENABLE ROW LEVEL SECURITY;

-- Políticas para categorías
CREATE POLICY "Todos pueden ver categorías"
  ON publicidad_categorias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admin puede crear categorías"
  ON publicidad_categorias FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Solo admin puede actualizar categorías"
  ON publicidad_categorias FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Solo admin puede eliminar categorías"
  ON publicidad_categorias FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para plantillas
CREATE POLICY "Todos pueden ver plantillas activas"
  ON publicidad_plantillas FOR SELECT
  TO authenticated
  USING (activa = true OR created_by = auth.uid());

CREATE POLICY "Solo admin puede crear plantillas"
  ON publicidad_plantillas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Solo admin puede actualizar plantillas"
  ON publicidad_plantillas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Solo admin puede eliminar plantillas"
  ON publicidad_plantillas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para diseños
CREATE POLICY "Usuarios pueden ver sus propios diseños"
  ON publicidad_disenos FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Usuarios pueden crear sus diseños"
  ON publicidad_disenos FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Usuarios pueden eliminar sus diseños"
  ON publicidad_disenos FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid());

-- Crear buckets de storage
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('publicidad-plantillas', 'publicidad-plantillas', true),
  ('publicidad-logos', 'publicidad-logos', true),
  ('publicidad-disenos', 'publicidad-disenos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para plantillas
CREATE POLICY "Admin puede subir plantillas"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'publicidad-plantillas' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Todos pueden ver plantillas"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'publicidad-plantillas');

-- Políticas de storage para logos de usuarios
CREATE POLICY "Usuarios pueden subir sus logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'publicidad-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Todos pueden ver logos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'publicidad-logos');

-- Políticas de storage para diseños finales
CREATE POLICY "Sistema puede crear diseños"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'publicidad-disenos');

CREATE POLICY "Usuarios pueden ver diseños"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'publicidad-disenos');

-- Insertar categorías por defecto
INSERT INTO publicidad_categorias (nombre, descripcion, orden) VALUES
  ('Redes Sociales', 'Plantillas para publicaciones en redes sociales', 1),
  ('Campañas', 'Plantillas para campañas publicitarias', 2),
  ('Promociones', 'Plantillas para promociones especiales', 3),
  ('Eventos', 'Plantillas para eventos y anuncios', 4)
ON CONFLICT DO NOTHING;