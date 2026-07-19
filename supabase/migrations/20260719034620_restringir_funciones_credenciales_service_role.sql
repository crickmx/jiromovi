/*
  Supabase aplica grants de EXECUTE a anon/authenticated sobre funciones
  nuevas en el esquema public. El REVOKE FROM PUBLIC no elimina esos grants
  explícitos. Cerramos esa vía para los tres almacenes de credenciales y
  conservamos acceso únicamente para service_role.
*/

REVOKE ALL ON FUNCTION email_cred_set(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION email_cred_get(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ia_cred_set(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ia_cred_get(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION whatsapp_cred_set(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION whatsapp_cred_get(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION email_cred_set(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION email_cred_get(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION ia_cred_set(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION ia_cred_get(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION whatsapp_cred_set(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION whatsapp_cred_get(uuid, text) TO service_role;
