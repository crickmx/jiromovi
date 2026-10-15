-- Existing projects can retain an explicit `anon` grant through default
-- privileges. The invitation directory must never be callable anonymously.
REVOKE ALL ON FUNCTION public.crm_search_shareable_users(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_search_shareable_users(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_search_shareable_users(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
