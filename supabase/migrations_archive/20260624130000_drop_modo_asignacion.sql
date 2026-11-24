-- Step 1: Nullify modo_asignacion before dropping (safe deploy)
-- Step 2 (this migration): Drop the column entirely
-- Verify no application code reads this column before running.

ALTER TABLE public.ticket_tipos DROP COLUMN IF EXISTS assignment_mode;
ALTER TABLE public.ticket_tipos DROP COLUMN IF EXISTS modo_asignacion;
