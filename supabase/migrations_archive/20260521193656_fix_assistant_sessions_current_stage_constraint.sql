/*
  # Fix contact_center_assistant_sessions current_stage constraint

  ## Problem
  The check constraint on `current_stage` was missing the `entry_choice` stage,
  which is set as the initial stage when an assistant has an online form option.
  This caused "violates check constraint" errors when creating new sessions.

  ## Changes
  - Drops the existing restrictive constraint
  - Recreates it with the complete list of valid stages:
    welcome, entry_choice, consent, capturing, document_request,
    summary, completion, transfer, error
*/

ALTER TABLE contact_center_assistant_sessions
  DROP CONSTRAINT IF EXISTS contact_center_assistant_sessions_current_stage_check;

ALTER TABLE contact_center_assistant_sessions
  ADD CONSTRAINT contact_center_assistant_sessions_current_stage_check
  CHECK (current_stage = ANY (ARRAY[
    'welcome',
    'entry_choice',
    'consent',
    'capturing',
    'document_request',
    'summary',
    'completion',
    'transfer',
    'error'
  ]));
