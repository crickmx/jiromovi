/*
  # Ensure quote forms and web pages for all active users

  1. Runs provision_all_shared_links() to create shared_quote_form_links for every agent
  2. Ensures user_web_pages records exist for every active user with a web_slug
*/

-- Provision shared quote form links for all agents/users
SELECT provision_all_shared_links();

-- Ensure user_web_pages exists for all active users with a web_slug
INSERT INTO user_web_pages (user_id, is_published, updated_at)
SELECT
  u.id,
  true,
  now()
FROM usuarios u
WHERE u.activo = true
  AND (u.deleted_at IS NULL OR u.deleted_at > now())
  AND u.web_slug IS NOT NULL
  AND u.web_slug != ''
  AND NOT EXISTS (
    SELECT 1 FROM user_web_pages w WHERE w.user_id = u.id
  )
ON CONFLICT DO NOTHING;
