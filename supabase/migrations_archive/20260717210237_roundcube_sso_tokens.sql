/*
  Tokens opacos, de un solo uso y vida corta para transferir una sesión
  autenticada de MOVI a Roundcube sin exponer la contraseña IONOS al navegador.

  Solo se persiste SHA-256(token). La credencial del buzón permanece en
  email_credenciales y únicamente la Edge Function de canje puede descifrarla.
*/

CREATE TABLE public.roundcube_sso_tokens (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CONSTRAINT roundcube_sso_tokens_short_lifetime
    CHECK (expires_at > created_at AND expires_at <= created_at + interval '2 minutes')
);

CREATE INDEX roundcube_sso_tokens_usuario_created_idx
  ON public.roundcube_sso_tokens (usuario_id, created_at DESC);

CREATE INDEX roundcube_sso_tokens_expiry_idx
  ON public.roundcube_sso_tokens (expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.roundcube_sso_tokens ENABLE ROW LEVEL SECURITY;

-- Cero políticas: anon/authenticated no pueden inspeccionar ni consumir tokens.
REVOKE ALL ON public.roundcube_sso_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roundcube_sso_tokens TO service_role;

COMMENT ON TABLE public.roundcube_sso_tokens IS
  'Handoffs efímeros y de un solo uso de MOVI hacia Roundcube; almacena solo SHA-256.';
