-- Secretos TOTP para admins y líderes (Fase 4: descifrado de reportes protegidos)
-- El secret se cifra con la variable de entorno TOTP_MASTER_KEY en la edge function.

CREATE TABLE public.usuario_totp_secrets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  encrypted_secret TEXT NOT NULL,
  verificado       BOOLEAN NOT NULL DEFAULT false,  -- true tras primera verificación exitosa
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.usuario_totp_secrets ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo gestiona su propio TOTP
CREATE POLICY "totp_self_manage" ON public.usuario_totp_secrets
  FOR ALL TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Administrador puede leer (soporte)
CREATE POLICY "totp_admin_read" ON public.usuario_totp_secrets
  FOR SELECT TO authenticated
  USING (
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'Administrador'
  );
