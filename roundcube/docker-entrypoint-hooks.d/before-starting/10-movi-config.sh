#!/bin/sh
# Config adicional que las variables ROUNDCUBEMAIL_* no cubren.
# Corre una sola vez, después de que el entrypoint oficial ya generó
# /var/www/html/config/config.inc.php a partir de esas variables.
set -e

CONFIG_FILE=/var/www/html/config/config.inc.php

if ! grep -q "MOVI — inicio" "$CONFIG_FILE" 2>/dev/null; then
  cat >> "$CONFIG_FILE" <<'PHP'

// ── MOVI — inicio ──────────────────────────────────────────────────────
// Solo se necesita mientras Roundcube viva embebido en un <iframe> del
// mismo dominio/subdominio de MOVI (Fase 3). Restringir a ese origen exacto,
// nunca dejar '*'.
$config['x_frame_options'] = false; // usamos CSP frame-ancestors en su lugar
header("Content-Security-Policy: frame-ancestors 'self' https://app.movi.digital https://beta.movi.digital;");

// Sesión: cookie con flags estrictos (se sirve siempre detrás de HTTPS vía
// el reverse proxy).
$config['session_samesite'] = 'Lax';
$config['session_secure'] = true;

// Plugins oficiales del MVP (además de los propios movi_*, ya listados en
// ROUNDCUBEMAIL_PLUGINS del docker-compose).
$config['zipdownload_selection'] = true;
$config['zipdownload_attachments'] = -1; // sin límite de adjuntos por ZIP
// ── MOVI — fin ─────────────────────────────────────────────────────────
PHP
fi
