/*
  # Create task_contact_center_items base table

  This migration ensures the table exists for both fresh installs and environments
  where it may have been created manually. All ALTER operations in later migrations
  are idempotent (IF NOT EXISTS / IF EXISTS), so there is no conflict.

  Columns intentionally nullable from the start to match the final target state
  reached by 20260505202833_fix_task_contact_center_items_nullable_columns.sql.
*/

CREATE TABLE IF NOT EXISTS task_contact_center_items (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id                    uuid REFERENCES tickets(id) ON DELETE CASCADE,
  contact_center_message_id    uuid REFERENCES contact_center_messages(id) ON DELETE CASCADE,
  agent_user_id                uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  added_by_user_id             uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  item_type                    text NOT NULL DEFAULT 'message',
  action_type                  text NOT NULL DEFAULT 'created_task',
  metadata                     jsonb DEFAULT '{}'::jsonb,
  created_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tcci_base_ticket_id   ON task_contact_center_items(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tcci_base_message_id  ON task_contact_center_items(contact_center_message_id);
CREATE INDEX IF NOT EXISTS idx_tcci_base_agent_id    ON task_contact_center_items(agent_user_id);

ALTER TABLE task_contact_center_items ENABLE ROW LEVEL SECURITY;
