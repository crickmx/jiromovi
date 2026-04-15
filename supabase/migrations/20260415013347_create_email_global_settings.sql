/*
  # Sistema global de Header y Footer para correos

  ## Descripción
  Crea la tabla `email_global_settings` que almacena el HTML del header y footer
  que se inyecta en TODOS los correos transaccionales enviados desde la plataforma.

  ## Tabla nueva
  - `email_global_settings`
    - `id` (uuid, PK)
    - `header_html` (TEXT) - HTML del encabezado
    - `footer_html` (TEXT) - HTML del pie de página
    - `activo` (BOOLEAN) - Solo 1 registro activo a la vez
    - `version` (INTEGER) - Número de versión para auditoría
    - `updated_at` (timestamptz)
    - `updated_by` (uuid, FK usuarios)
    - `created_at` (timestamptz)

  ## Seguridad
  - RLS habilitado
  - Solo administradores pueden leer y modificar
  - Service role tiene acceso completo (para edge functions)

  ## Datos iniciales
  - Registro activo con header/footer por defecto MOVI Digital
*/

CREATE TABLE IF NOT EXISTS email_global_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  header_html TEXT NOT NULL DEFAULT '',
  footer_html TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read email global settings"
  ON email_global_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins can insert email global settings"
  ON email_global_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins can update email global settings"
  ON email_global_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.estado = 'activo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Service role full access email global settings"
  ON email_global_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insertar configuración por defecto con header y footer corporativo de MOVI Digital
INSERT INTO email_global_settings (header_html, footer_html, activo, version)
VALUES (
  -- HEADER: Logo MOVI Digital, diseño corporativo limpio
  '<div style="background-color:#ffffff; border-bottom:2px solid #f0f0f0; padding:24px 32px; text-align:center; font-family:Arial,sans-serif;">
  <img src="https://app.movidigital.mx/logojiro.png" alt="MOVI Digital" style="max-height:56px; max-width:200px; object-fit:contain;" />
</div>
<div style="background-color:#f8f9fa; height:4px; width:100%;"></div>',

  -- FOOTER: Logo Grupo JIRO pequeño + texto legal
  '<div style="background-color:#f8f9fa; border-top:1px solid #e9ecef; padding:20px 32px; text-align:center; font-family:Arial,sans-serif; margin-top:0;">
  <img src="https://app.movidigital.mx/logojiro.png" alt="Grupo JIRO" style="max-height:28px; max-width:120px; opacity:0.65; object-fit:contain; display:block; margin:0 auto 10px;" />
  <p style="margin:0; font-size:11px; color:#9ca3af; line-height:1.6;">
    Este mensaje fue enviado automaticamente por MOVI Digital.<br/>
    Si tienes preguntas, contacta a tu administrador.
  </p>
  <p style="margin:6px 0 0; font-size:10px; color:#d1d5db;">
    &copy; 2025 Grupo JIRO. Todos los derechos reservados.
  </p>
</div>',

  true,
  1
);
