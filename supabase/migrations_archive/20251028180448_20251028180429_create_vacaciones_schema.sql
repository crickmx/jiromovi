/*
  # Create Vacaciones (Vacation) Management Schema

  1. New Tables
    - `solicitudes_vacaciones`
      - `id` (uuid, primary key)
      - `empleado_id` (uuid, references usuarios)
      - `gerente_id` (uuid, references usuarios, nullable)
      - `administrador_id` (uuid, references usuarios, nullable)
      - `oficina_id` (uuid, references oficinas)
      - `fecha_inicio` (date)
      - `fecha_fin` (date)
      - `dias_solicitados` (integer)
      - `estado` (text: 'pendiente', 'preaprobado', 'aprobado', 'rechazado')
      - `comentarios_gerente` (text, nullable)
      - `comentarios_administrador` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to usuarios table
    - Add `dias_vacaciones_disponibles` (integer, default 0)

  3. Security
    - Enable RLS on all tables
    - Empleados can view their own requests
    - Gerentes can view/manage requests from their office
    - Administradores can view/manage all requests
*/

-- Add vacation days field to usuarios table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'dias_vacaciones_disponibles'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN dias_vacaciones_disponibles integer DEFAULT 0;
  END IF;
END $$;

-- Create solicitudes_vacaciones table
CREATE TABLE IF NOT EXISTS solicitudes_vacaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  gerente_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  administrador_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  dias_solicitados integer NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'preaprobado', 'aprobado', 'rechazado')),
  comentarios_gerente text,
  comentarios_administrador text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE solicitudes_vacaciones ENABLE ROW LEVEL SECURITY;

-- Policies for solicitudes_vacaciones

-- Empleados can view their own requests
CREATE POLICY "Empleados can view own vacation requests"
  ON solicitudes_vacaciones
  FOR SELECT
  TO authenticated
  USING (
    empleado_id = auth.uid()
  );

-- Empleados can create their own requests
CREATE POLICY "Empleados can create vacation requests"
  ON solicitudes_vacaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    empleado_id = auth.uid()
  );

-- Gerentes can view requests from their office
CREATE POLICY "Gerentes can view office vacation requests"
  ON solicitudes_vacaciones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
      AND usuarios.oficina_id = solicitudes_vacaciones.oficina_id
    )
  );

-- Gerentes can update requests (preaprobar/rechazar)
CREATE POLICY "Gerentes can update office vacation requests"
  ON solicitudes_vacaciones
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
      AND usuarios.oficina_id = solicitudes_vacaciones.oficina_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
      AND usuarios.oficina_id = solicitudes_vacaciones.oficina_id
    )
  );

-- Administradores can view all requests
CREATE POLICY "Administradores can view all vacation requests"
  ON solicitudes_vacaciones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Administradores can update all requests
CREATE POLICY "Administradores can update all vacation requests"
  ON solicitudes_vacaciones
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_solicitudes_vacaciones_empleado ON solicitudes_vacaciones(empleado_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_vacaciones_oficina ON solicitudes_vacaciones(oficina_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_vacaciones_estado ON solicitudes_vacaciones(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_vacaciones_fecha_inicio ON solicitudes_vacaciones(fecha_inicio);
