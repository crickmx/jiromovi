/*
  # Esquema de Firmas de E-Mail

  1. Nuevas Tablas
    - `firma_templates`
      - Plantillas HTML de firmas
      - Soporte para variables de usuario y oficina
      - Imágenes y activos embebidos
      - Nombre y descripción
    
    - `firma_asignaciones`
      - Reglas de asignación por prioridad
      - Tipos: global, oficina, rol, usuario
      - Referencia a template
      - Sistema de prioridades
    
    - `firma_imagenes`
      - Imágenes subidas para firmas
      - URLs seguras HTTPS
      - Metadata (tamaño, tipo)

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Solo administradores pueden crear/editar templates
    - Usuarios solo pueden ver su firma asignada
    
  3. Variables Soportadas
    - Usuario: nombre, apellidos, rol, puesto, etc.
    - Oficina: nombre, dirección, teléfono, redes sociales, etc.
*/

-- Tabla de plantillas de firma
CREATE TABLE IF NOT EXISTS firma_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información básica
  nombre text NOT NULL,
  descripcion text,
  
  -- Contenido HTML
  html text NOT NULL,
  
  -- Configuración
  es_activa boolean DEFAULT true,
  ancho_max integer DEFAULT 700,
  
  -- Metadata
  creado_por uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de asignaciones de firma
CREATE TABLE IF NOT EXISTS firma_asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template asignado
  template_id uuid NOT NULL REFERENCES firma_templates(id) ON DELETE CASCADE,
  
  -- Tipo de asignación y prioridad
  tipo text NOT NULL CHECK (tipo IN ('global', 'oficina', 'rol', 'usuario')),
  prioridad integer NOT NULL DEFAULT 0,
  
  -- Referencias según tipo
  -- Si tipo = 'oficina', ref_oficina_id tiene valor
  -- Si tipo = 'rol', ref_rol tiene valor
  -- Si tipo = 'usuario', ref_usuario_id tiene valor
  -- Si tipo = 'global', referencias son NULL
  ref_oficina_id uuid REFERENCES oficinas(id) ON DELETE CASCADE,
  ref_rol text,
  ref_usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Metadata
  creado_por uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraint: solo una asignación por combinación tipo+ref
  UNIQUE NULLS NOT DISTINCT (tipo, ref_oficina_id, ref_rol, ref_usuario_id)
);

-- Tabla de imágenes para firmas
CREATE TABLE IF NOT EXISTS firma_imagenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información del archivo
  nombre text NOT NULL,
  tipo_mime text NOT NULL,
  size_bytes integer NOT NULL,
  
  -- URL de storage
  storage_path text NOT NULL,
  url_publica text NOT NULL,
  
  -- Relación con template (opcional)
  template_id uuid REFERENCES firma_templates(id) ON DELETE SET NULL,
  
  -- Metadata
  subido_por uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_firma_templates_activa ON firma_templates(es_activa);
CREATE INDEX IF NOT EXISTS idx_firma_asignaciones_tipo ON firma_asignaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_firma_asignaciones_prioridad ON firma_asignaciones(prioridad DESC);
CREATE INDEX IF NOT EXISTS idx_firma_asignaciones_oficina ON firma_asignaciones(ref_oficina_id);
CREATE INDEX IF NOT EXISTS idx_firma_asignaciones_rol ON firma_asignaciones(ref_rol);
CREATE INDEX IF NOT EXISTS idx_firma_asignaciones_usuario ON firma_asignaciones(ref_usuario_id);
CREATE INDEX IF NOT EXISTS idx_firma_imagenes_template ON firma_imagenes(template_id);

-- Función para obtener firma asignada a un usuario
-- Prioridad: usuario > rol > oficina > global
CREATE OR REPLACE FUNCTION get_firma_asignada(p_usuario_id uuid)
RETURNS TABLE (
  template_id uuid,
  template_nombre text,
  template_html text,
  prioridad integer,
  tipo_asignacion text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario RECORD;
BEGIN
  -- Obtener datos del usuario
  SELECT * INTO v_usuario
  FROM usuarios
  WHERE id = p_usuario_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Buscar por usuario específico (prioridad más alta)
  RETURN QUERY
  SELECT 
    ft.id,
    ft.nombre,
    ft.html,
    fa.prioridad,
    fa.tipo
  FROM firma_asignaciones fa
  JOIN firma_templates ft ON fa.template_id = ft.id
  WHERE fa.tipo = 'usuario'
    AND fa.ref_usuario_id = p_usuario_id
    AND ft.es_activa = true
  ORDER BY fa.prioridad DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN;
  END IF;
  
  -- Buscar por rol
  RETURN QUERY
  SELECT 
    ft.id,
    ft.nombre,
    ft.html,
    fa.prioridad,
    fa.tipo
  FROM firma_asignaciones fa
  JOIN firma_templates ft ON fa.template_id = ft.id
  WHERE fa.tipo = 'rol'
    AND fa.ref_rol = v_usuario.rol
    AND ft.es_activa = true
  ORDER BY fa.prioridad DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN;
  END IF;
  
  -- Buscar por oficina
  RETURN QUERY
  SELECT 
    ft.id,
    ft.nombre,
    ft.html,
    fa.prioridad,
    fa.tipo
  FROM firma_asignaciones fa
  JOIN firma_templates ft ON fa.template_id = ft.id
  WHERE fa.tipo = 'oficina'
    AND fa.ref_oficina_id = v_usuario.oficina_id
    AND ft.es_activa = true
  ORDER BY fa.prioridad DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN;
  END IF;
  
  -- Buscar firma global (default)
  RETURN QUERY
  SELECT 
    ft.id,
    ft.nombre,
    ft.html,
    fa.prioridad,
    fa.tipo
  FROM firma_asignaciones fa
  JOIN firma_templates ft ON fa.template_id = ft.id
  WHERE fa.tipo = 'global'
    AND ft.es_activa = true
  ORDER BY fa.prioridad DESC
  LIMIT 1;
END;
$$;

-- RLS Policies

-- firma_templates
ALTER TABLE firma_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administradores pueden gestionar templates"
  ON firma_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Usuarios pueden ver templates activos"
  ON firma_templates FOR SELECT
  TO authenticated
  USING (es_activa = true);

-- firma_asignaciones
ALTER TABLE firma_asignaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administradores pueden gestionar asignaciones"
  ON firma_asignaciones FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Usuarios pueden ver asignaciones que les aplican"
  ON firma_asignaciones FOR SELECT
  TO authenticated
  USING (
    tipo = 'global'
    OR (tipo = 'usuario' AND ref_usuario_id = auth.uid())
    OR (tipo = 'rol' AND ref_rol = (SELECT rol FROM usuarios WHERE id = auth.uid()))
    OR (tipo = 'oficina' AND ref_oficina_id = (SELECT oficina_id FROM usuarios WHERE id = auth.uid()))
  );

-- firma_imagenes
ALTER TABLE firma_imagenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administradores pueden gestionar imágenes"
  ON firma_imagenes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Todos pueden ver imágenes"
  ON firma_imagenes FOR SELECT
  TO authenticated
  USING (true);

-- Crear bucket de storage para imágenes de firmas
INSERT INTO storage.buckets (id, name, public)
VALUES ('firma-imagenes', 'firma-imagenes', true)
ON CONFLICT (id) DO NOTHING;

-- Policy de storage para imágenes de firmas
CREATE POLICY "Administradores pueden subir imágenes de firma"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'firma-imagenes' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Todos pueden ver imágenes de firma"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'firma-imagenes');

CREATE POLICY "Administradores pueden eliminar imágenes de firma"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'firma-imagenes' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Insertar plantilla global por defecto
INSERT INTO firma_templates (nombre, descripcion, html, es_activa)
VALUES (
  'Firma Global Predeterminada',
  'Plantilla básica de firma que se aplica por defecto',
  '<!-- FIRMA_BEGIN -->
<table style="font-family: Arial, sans-serif; font-size: 14px; color: #333; max-width: 700px;" cellpadding="0" cellspacing="0">
  <tr>
    <td style="padding: 20px 0; border-top: 3px solid #0066cc;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right: 20px; vertical-align: top;">
            {{#if imagen_perfil}}
            <img src="{{imagen_perfil}}" alt="{{nombre}}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" />
            {{/if}}
          </td>
          <td style="vertical-align: top;">
            <div style="font-size: 16px; font-weight: bold; color: #0066cc; margin-bottom: 5px;">
              {{nombre}} {{apellidos}}
            </div>
            <div style="color: #666; margin-bottom: 3px;">{{puesto}}</div>
            {{#if email_laboral}}
            <div style="margin-bottom: 3px;">
              <a href="mailto:{{email_laboral}}" style="color: #0066cc; text-decoration: none;">{{email_laboral}}</a>
            </div>
            {{/if}}
            {{#if celular_laboral}}
            <div style="margin-bottom: 3px;">📱 {{celular_laboral}}</div>
            {{/if}}
            {{#if extension_telefonica}}
            <div style="margin-bottom: 3px;">☎️ Ext. {{extension_telefonica}}</div>
            {{/if}}
            <div style="margin-top: 10px; font-weight: bold; color: #0066cc;">{{oficina_nombre}}</div>
            {{#if oficina_direccion}}
            <div style="font-size: 12px; color: #666;">📍 {{oficina_direccion}}</div>
            {{/if}}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<!-- FIRMA_END -->',
  true
)
ON CONFLICT DO NOTHING;

-- Crear asignación global por defecto
INSERT INTO firma_asignaciones (template_id, tipo, prioridad)
SELECT id, 'global', 0
FROM firma_templates
WHERE nombre = 'Firma Global Predeterminada'
ON CONFLICT DO NOTHING;
