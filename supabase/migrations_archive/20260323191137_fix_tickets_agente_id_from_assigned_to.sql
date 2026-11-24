/*
  # Fix tickets agente_id from assigned_to_user_id

  1. Updates
    - Set agente_id equal to assigned_to_user_id for all tickets where agente_id is null
    - This fixes historical data where agente_id was not being populated correctly

  2. Notes
    - Only updates tickets where agente_id is null but assigned_to_user_id is not null
    - This ensures that agente and responsable fields show the same user
*/

-- Update existing tickets to copy assigned_to_user_id to agente_id where agente_id is null
UPDATE tickets
SET agente_id = assigned_to_user_id
WHERE agente_id IS NULL
  AND assigned_to_user_id IS NOT NULL;
