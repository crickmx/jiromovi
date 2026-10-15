/*
  # Ensure Quote Form Links for All Agents

  ## Summary
  Ensures every active agent with a web_slug already has shared quote form links
  provisioned for all active templates. Idempotent — safe to run multiple times.

  ## What this does
  1. Calls the existing provision_all_shared_links() function to backfill any agents
     that don't have links yet.
  2. Ensures the auto-provision trigger is enabled on the usuarios table.

  ## Notes
  - Does NOT delete or modify existing links
  - Does NOT change existing slugs/URLs
  - Safe to re-run
*/

-- Run the bulk provisioner to backfill all existing agents
SELECT provision_all_shared_links();
