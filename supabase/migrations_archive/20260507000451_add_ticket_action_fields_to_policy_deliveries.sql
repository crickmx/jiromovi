/*
  # Add ticket action fields to policy_deliveries

  1. New Columns on `policy_deliveries`
    - `ticket_action_type` (text) - 'existing_ticket' or 'new_ticket'
    - `ticket_was_existing` (boolean) - Whether the delivery was added to an existing ticket
    - `ticket_closed_as_won` (boolean) - Whether the ticket was closed as won after delivery
    - `ticket_close_status` (text) - Final status name applied to the ticket
    - `ticket_closed_at` (timestamptz) - When the ticket was closed
    - `ticket_closed_by` (uuid) - Who closed the ticket

  2. Notes
    - These fields enable tracking whether a delivery was attached to an existing
      ticket or created a new one, and whether it was closed as won.
    - Backfill existing records with 'new_ticket' since all prior deliveries created new tickets.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'ticket_action_type'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN ticket_action_type text DEFAULT 'new_ticket';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'ticket_was_existing'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN ticket_was_existing boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'ticket_closed_as_won'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN ticket_closed_as_won boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'ticket_close_status'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN ticket_close_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'ticket_closed_at'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN ticket_closed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'ticket_closed_by'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN ticket_closed_by uuid REFERENCES usuarios(id);
  END IF;
END $$;

-- Backfill existing records: they were all new tickets, closed as won
UPDATE policy_deliveries
SET ticket_action_type = 'new_ticket',
    ticket_was_existing = false,
    ticket_closed_as_won = true,
    ticket_close_status = 'Emitido (Ganado)'
WHERE ticket_action_type IS NULL OR ticket_closed_as_won IS NULL;
