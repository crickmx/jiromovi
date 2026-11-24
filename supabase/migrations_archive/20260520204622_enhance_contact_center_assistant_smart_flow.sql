/*
  # Mejoras al Sistema de Agente Automático - Centro de Contacto

  ## Cambios
  1. Nuevas columnas en `contact_center_assistant_sessions`:
     - `responsible_employee_id` - UUID del empleado responsable resuelto
     - `responsible_employee_name` - Nombre visible del empleado responsable
     - `responsible_role` - Rol del empleado responsable

  2. Nuevas columnas en `contact_center_assistants`:
     - `question_block_size` - Número de campos por bloque de pregunta (default 2)
     - `mention_responsible_name` - Si debe mencionar el nombre del responsable (default true)
     - `responsible_resolution_order` - Orden de resolución del responsable (jsonb)

  ## Seguridad
  - Sin cambios de RLS (heredan de la tabla padre)
*/

-- Add responsible tracking to sessions
ALTER TABLE contact_center_assistant_sessions
  ADD COLUMN IF NOT EXISTS responsible_employee_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsible_employee_name text,
  ADD COLUMN IF NOT EXISTS responsible_role text;

-- Add intelligent flow config to assistants
ALTER TABLE contact_center_assistants
  ADD COLUMN IF NOT EXISTS question_block_size integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS mention_responsible_name boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS responsible_resolution_order jsonb DEFAULT '["conversation_assigned_employee","contact_owner","tramite_assigned_employee","office_team_manager","form_default_responsible","tramites_default_responsible","office_default_admin"]'::jsonb;

-- Index for responsible lookups
CREATE INDEX IF NOT EXISTS idx_cc_sessions_responsible 
  ON contact_center_assistant_sessions(responsible_employee_id) 
  WHERE responsible_employee_id IS NOT NULL;
