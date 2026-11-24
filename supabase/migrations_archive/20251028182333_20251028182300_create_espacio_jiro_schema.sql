/*
  # Create Espacio JIRO (Office Space Reservation) Schema

  1. Changes to oficinas table
    - Add `es_espacio_jiro` (boolean, default false)
    - Add `descripcion` (text, nullable)
    - Add `fotos` (jsonb array, nullable)

  2. New Tables
    - `areas`
      - `id` (uuid, primary key)
      - `oficina_id` (uuid, references oficinas)
      - `nombre` (text)
      - `detalles` (text, nullable)
      - `fotos` (jsonb array, nullable)
      - `disponibilidad_semanal` (jsonb, stores weekly availability)
      - `activo` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `bloqueos_gerente`
      - `id` (uuid, primary key)
      - `area_id` (uuid, references areas)
      - `gerente_id` (uuid, references usuarios)
      - `fecha` (date)
      - `hora_inicio` (time)
      - `hora_fin` (time)
      - `motivo` (text, nullable)
      - `created_at` (timestamptz)

    - `reservas_espacio`
      - `id` (uuid, primary key)
      - `area_id` (uuid, references areas)
      - `oficina_id` (uuid, references oficinas)
      - `usuario_id` (uuid, references usuarios)
      - `fecha` (date)
      - `hora_inicio` (time)
      - `hora_fin` (time)
      - `estado` (text: 'pendiente', 'aprobada', 'rechazada', 'cancelada')
      - `notas` (text, nullable)
      - `comentarios_gerente` (text, nullable)
      - `creado_por` (uuid, references usuarios)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - Enable RLS on all new tables
    - Administradores can manage areas
    - Gerentes can manage blocks and approve reservations for their office
    - Empleados/Agentes can create and view their own reservations
*/

-- Add fields to oficinas table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'es_espacio_jiro'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN es_espacio_jiro boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'descripcion'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN descripcion text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'fotos'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN fotos jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create areas table
CREATE TABLE IF NOT EXISTS areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id uuid NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  detalles text,
  fotos jsonb DEFAULT '[]'::jsonb,
  disponibilidad_semanal jsonb DEFAULT '{
    "lunes": [],
    "martes": [],
    "miercoles": [],
    "jueves": [],
    "viernes": [],
    "sabado": [],
    "domingo": []
  }'::jsonb,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bloqueos_gerente table
CREATE TABLE IF NOT EXISTS bloqueos_gerente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  gerente_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  motivo text,
  created_at timestamptz DEFAULT now(),
  CHECK (hora_inicio < hora_fin)
);

-- Create reservas_espacio table
CREATE TABLE IF NOT EXISTS reservas_espacio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  oficina_id uuid NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  notas text,
  comentarios_gerente text,
  creado_por uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (hora_inicio < hora_fin)
);

-- Enable RLS
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueos_gerente ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas_espacio ENABLE ROW LEVEL SECURITY;

-- Policies for areas

-- Everyone can view active areas
CREATE POLICY "Users can view active areas"
  ON areas
  FOR SELECT
  TO authenticated
  USING (activo = true);

-- Administradores can manage all areas
CREATE POLICY "Administradores can insert areas"
  ON areas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Administradores can update areas"
  ON areas
  FOR UPDATE
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

CREATE POLICY "Administradores can delete areas"
  ON areas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Policies for bloqueos_gerente

-- Gerentes can view blocks for their office areas
CREATE POLICY "Gerentes can view office blocks"
  ON bloqueos_gerente
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM areas
      JOIN usuarios ON usuarios.id = auth.uid()
      WHERE areas.id = bloqueos_gerente.area_id
      AND usuarios.rol = 'Gerente'
      AND areas.oficina_id = usuarios.oficina_id
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Gerentes can create blocks for their office areas
CREATE POLICY "Gerentes can create blocks"
  ON bloqueos_gerente
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM areas
      JOIN usuarios ON usuarios.id = auth.uid()
      WHERE areas.id = bloqueos_gerente.area_id
      AND usuarios.rol = 'Gerente'
      AND areas.oficina_id = usuarios.oficina_id
      AND bloqueos_gerente.gerente_id = auth.uid()
    )
  );

-- Gerentes can delete their own blocks
CREATE POLICY "Gerentes can delete own blocks"
  ON bloqueos_gerente
  FOR DELETE
  TO authenticated
  USING (gerente_id = auth.uid());

-- Administradores can view all blocks
CREATE POLICY "Administradores can view all blocks"
  ON bloqueos_gerente
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Policies for reservas_espacio

-- Users can view their own reservations
CREATE POLICY "Users can view own reservations"
  ON reservas_espacio
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- Gerentes can view reservations for their office
CREATE POLICY "Gerentes can view office reservations"
  ON reservas_espacio
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
      AND usuarios.oficina_id = reservas_espacio.oficina_id
    )
  );

-- Administradores can view all reservations
CREATE POLICY "Administradores can view all reservations"
  ON reservas_espacio
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Users can create their own reservations
CREATE POLICY "Users can create reservations"
  ON reservas_espacio
  FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND creado_por = auth.uid()
  );

-- Gerentes can update reservations for their office
CREATE POLICY "Gerentes can update office reservations"
  ON reservas_espacio
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
      AND usuarios.oficina_id = reservas_espacio.oficina_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
      AND usuarios.oficina_id = reservas_espacio.oficina_id
    )
  );

-- Users can update their own pending reservations (for cancellation)
CREATE POLICY "Users can update own reservations"
  ON reservas_espacio
  FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_areas_oficina ON areas(oficina_id);
CREATE INDEX IF NOT EXISTS idx_areas_activo ON areas(activo);
CREATE INDEX IF NOT EXISTS idx_bloqueos_area_fecha ON bloqueos_gerente(area_id, fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_area_fecha ON reservas_espacio(area_id, fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_usuario ON reservas_espacio(usuario_id);
CREATE INDEX IF NOT EXISTS idx_reservas_oficina ON reservas_espacio(oficina_id);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON reservas_espacio(estado);
