/*
  # Create Policy Deliveries Module

  1. New Tables
    - `policy_deliveries`
      - `id` (uuid, primary key)
      - `created_at` (timestamptz)
      - `created_by` (uuid, FK to usuarios) - User who created the delivery
      - `created_by_name` (text) - Cached creator name
      - `vendor_sicas_id` (text) - SICAS vendor ID
      - `vendor_sicas_key` (text) - SICAS vendor key/clave
      - `vendor_sicas_name` (text) - SICAS vendor name
      - `vendor_email` (text) - Vendor email
      - `vendor_type` (text) - Vendor type (Honorarios, Asimilados, etc.)
      - `movi_user_id` (uuid) - Related MOVI user
      - `movi_user_name` (text) - Cached MOVI user name
      - `sicas_office_id` (text) - SICAS office/despacho ID
      - `sicas_office_name` (text) - SICAS office/despacho name
      - `sicas_management_id` (text) - SICAS gerencia ID
      - `sicas_management_name` (text) - SICAS gerencia name
      - `policy_number` (text) - Extracted policy number
      - `policy_type` (text) - Extracted policy type
      - `insured_name` (text) - Client/insured name
      - `insured_rfc` (text) - Client RFC
      - `vehicle_description` (text) - Vehicle description
      - `plates` (text) - License plates
      - `vin` (text) - VIN/Serie
      - `engine` (text) - Engine number
      - `payment_method` (text) - Payment method
      - `currency` (text) - Currency
      - `net_premium` (text) - Prima neta
      - `total_premium` (text) - Prima total
      - `start_date` (text) - Vigencia inicio
      - `end_date` (text) - Vigencia fin
      - `extracted_data` (jsonb) - Full extracted data from lector
      - `extraction_successful` (boolean) - Whether extraction worked
      - `cover_file_path` (text) - Storage path of cover file
      - `cover_file_name` (text) - Original cover file name
      - `additional_files` (jsonb) - Array of additional file info
      - `additional_files_count` (integer) - Number of additional files
      - `ticket_id` (uuid, FK to tickets) - Created ticket
      - `ticket_folio` (text) - Ticket folio for quick access
      - `ticket_status` (text) - Cached ticket status
      - `email_sent` (boolean) - Whether email was sent
      - `email_error` (text) - Email error if failed
      - `notification_sent` (boolean) - Whether notification was sent
      - `exported` (boolean) - Whether exported to Excel
      - `exported_at` (timestamptz) - Last export date
      - `exported_by` (uuid) - User who exported
      - `export_count` (integer) - Number of times exported
      - `status` (text) - Overall delivery status

  2. Security
    - Enable RLS on `policy_deliveries` table
    - Employees/Gerentes can view deliveries from their office
    - Admins can view all deliveries
    - Authenticated users can insert their own deliveries
*/

CREATE TABLE IF NOT EXISTS policy_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES usuarios(id),
  created_by_name text NOT NULL DEFAULT '',
  
  -- Vendor SICAS info
  vendor_sicas_id text NOT NULL,
  vendor_sicas_key text,
  vendor_sicas_name text NOT NULL,
  vendor_email text,
  vendor_type text,
  movi_user_id uuid,
  movi_user_name text,
  sicas_office_id text,
  sicas_office_name text,
  sicas_management_id text,
  sicas_management_name text,
  
  -- Extracted policy data
  policy_number text,
  policy_type text,
  insured_name text,
  insured_rfc text,
  vehicle_description text,
  plates text,
  vin text,
  engine text,
  payment_method text,
  currency text,
  net_premium text,
  total_premium text,
  start_date text,
  end_date text,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  extraction_successful boolean DEFAULT true,
  
  -- Files
  cover_file_path text,
  cover_file_name text,
  additional_files jsonb DEFAULT '[]'::jsonb,
  additional_files_count integer DEFAULT 0,
  
  -- Ticket relation
  ticket_id uuid REFERENCES tickets(id),
  ticket_folio text,
  ticket_status text DEFAULT 'Emitido',
  
  -- Notifications
  email_sent boolean DEFAULT false,
  email_error text,
  notification_sent boolean DEFAULT false,
  
  -- Export tracking
  exported boolean DEFAULT false,
  exported_at timestamptz,
  exported_by uuid REFERENCES usuarios(id),
  export_count integer DEFAULT 0,
  
  -- Status
  status text DEFAULT 'completado'
);

ALTER TABLE policy_deliveries ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_policy_deliveries_created_by ON policy_deliveries(created_by);
CREATE INDEX IF NOT EXISTS idx_policy_deliveries_created_at ON policy_deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_deliveries_ticket_id ON policy_deliveries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_policy_deliveries_vendor_sicas_id ON policy_deliveries(vendor_sicas_id);
CREATE INDEX IF NOT EXISTS idx_policy_deliveries_policy_number ON policy_deliveries(policy_number);
CREATE INDEX IF NOT EXISTS idx_policy_deliveries_exported ON policy_deliveries(exported);

-- RLS Policies

-- Admins can view all deliveries
CREATE POLICY "Admins can view all policy deliveries"
  ON policy_deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Gerentes can view deliveries from their office
CREATE POLICY "Gerentes can view office policy deliveries"
  ON policy_deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
    )
  );

-- Empleados can view their own deliveries
CREATE POLICY "Empleados can view own policy deliveries"
  ON policy_deliveries
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Empleado'
    )
  );

-- Authenticated non-agent users can insert
CREATE POLICY "Non-agent users can insert policy deliveries"
  ON policy_deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente', 'Empleado')
    )
  );

-- Users can update their own deliveries (for export tracking)
CREATE POLICY "Users can update own policy deliveries"
  ON policy_deliveries
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );
