REVOKE ALL ON FUNCTION public.crm_search_shareable_users(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_search_shareable_users(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_search_shareable_users(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
