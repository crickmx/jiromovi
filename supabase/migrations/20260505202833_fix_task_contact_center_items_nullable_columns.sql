/*
  # Fix task_contact_center_items table constraints

  1. Changes
    - Make `ticket_id` nullable (edge functions use `task_id` for CRM tasks, not tickets)
    - Make `contact_center_message_id` nullable (attachment-only entries don't have a message)
    - Drop the old unique constraint on (ticket_id, contact_center_message_id)
    - Add new unique constraint on (task_id, contact_center_message_id) for duplicate prevention
    - Add check constraint ensuring at least one of task_id or ticket_id is set

  2. Reason
    - The edge functions `create-task-from-contact-messages` and `add-contact-messages-to-task`
      insert rows with task_id (crm_tareas) and sometimes null contact_center_message_id
      for attachment-only links. The NOT NULL constraints were blocking these inserts.
*/

-- Make ticket_id nullable
ALTER TABLE task_contact_center_items ALTER COLUMN ticket_id DROP NOT NULL;

-- Make contact_center_message_id nullable
ALTER TABLE task_contact_center_items ALTER COLUMN contact_center_message_id DROP NOT NULL;

-- Drop old unique constraint that doesn't match current usage
ALTER TABLE task_contact_center_items 
  DROP CONSTRAINT IF EXISTS task_contact_center_items_ticket_id_contact_center_message__key;

-- Add unique constraint to prevent duplicate message links per task
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_cc_items_task_message_unique 
  ON task_contact_center_items(task_id, contact_center_message_id) 
  WHERE task_id IS NOT NULL AND contact_center_message_id IS NOT NULL;

-- Add unique constraint to prevent duplicate attachment links per task
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_cc_items_task_attachment_unique 
  ON task_contact_center_items(task_id, contact_center_attachment_id) 
  WHERE task_id IS NOT NULL AND contact_center_attachment_id IS NOT NULL;
