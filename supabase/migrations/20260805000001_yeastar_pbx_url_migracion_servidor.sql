/*
  # Migracion de servidor Yeastar (74.208.52.157 -> 159.54.138.29)

  1. Cambios
    - Actualiza telefonia_config.pbx_url al nuevo servidor
    - Limpia el token OAuth cacheado (oauth_token/oauth_token_expires_at):
      el token viejo pertenece al servidor anterior y es invalido contra el
      nuevo aunque no haya expirado todavia -- yeastar-proxy lo reutilizaria
      sin volver a hacer login si no se limpia aqui.

  2. Notas
    - Esto NO cubre los secrets de Edge Functions (YEASTAR_USERNAME,
      YEASTAR_PASSWORD, YEASTAR_PBX_URL, YEASTAR_CLIENT_ID,
      YEASTAR_CLIENT_SECRET, YEASTAR_PBX_USERNAME,
      YEASTAR_PBX_PASSWORD_ENCODED) -- esos se configuran aparte en
      Supabase Dashboard > Edge Functions > Secrets, no viven en tablas.
*/

update telefonia_config
set pbx_url = 'https://159.54.138.29:8088',
    oauth_token = null,
    oauth_token_expires_at = null,
    updated_at = now();
