<?php
/**
 * movi_auth — SSO de MOVI Digital para Roundcube.
 *
 * Esqueleto de la Fase 1. La lógica real es Fase 2:
 *   - MOVI (edge function) valida la sesión real de Supabase del usuario,
 *     descifra su contraseña de IONOS server-side y emite un token firmado
 *     de un solo uso (HMAC con MOVI_SSO_SHARED_SECRET, expira en segundos).
 *   - Este plugin engancha el hook 'authenticate' de Roundcube: si la
 *     request trae ese token (no un login manual), lo valida (firma, nonce
 *     no usado, no expirado) y completa el login IMAP con las credenciales
 *     que el propio token trae cifradas — el usuario nunca vuelve a teclear
 *     su contraseña de IONOS dentro de MOVI.
 *   - También debe enganchar 'startup'/'logout' para cerrar sesión en
 *     Roundcube cuando el usuario cierra sesión en MOVI (logout sincronizado).
 */
class movi_auth extends rcube_plugin
{
    public $task = 'login|logout|mail|settings';

    function init()
    {
        // Fase 2:
        // $this->add_hook('authenticate', array($this, 'movi_sso_authenticate'));
        // $this->add_hook('logout_after', array($this, 'movi_sso_logout'));
    }
}
