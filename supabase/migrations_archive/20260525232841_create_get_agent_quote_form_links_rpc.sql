/*
  # Create get_agent_quote_form_links RPC

  ## Purpose
  Seguwallet customers need to read their agent's active shared_quote_form_links.
  The direct table query fails for seguwallet customer auth users because the
  "Agents can view own links" RLS policy requires agent_id = auth.uid().

  This SECURITY DEFINER function bypasses RLS and returns active form links
  for any given agent_id — the same pattern used by get_public_web_page_by_slug.

  ## Returns
  Array of active quote form links for the given agent, ordered by form_title.
*/

CREATE OR REPLACE FUNCTION get_agent_quote_form_links(p_agent_id uuid)
RETURNS TABLE (
  id uuid,
  slug text,
  form_type text,
  form_title text,
  status text,
  public_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sqfl.id,
    sqfl.slug,
    sqfl.form_type,
    sqfl.form_title,
    sqfl.status,
    sqfl.public_url
  FROM shared_quote_form_links sqfl
  WHERE sqfl.agent_id = p_agent_id
    AND sqfl.status = 'active'
  ORDER BY sqfl.form_title;
$$;

-- Grant execute to all authenticated users and anonymous (seguwallet uses anon key sometimes)
GRANT EXECUTE ON FUNCTION get_agent_quote_form_links(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_agent_quote_form_links(uuid) TO anon;
