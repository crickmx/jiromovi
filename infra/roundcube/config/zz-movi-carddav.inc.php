<?php

// ── Libreta oficial de IONOS (CardDAV) para el correo embebido ──────────────
//
// Hace que Roundcube sincronice la agenda CardDAV de IONOS de cada usuario y la
// muestre en su autocompletado nativo de Para/CC/CCO, junto a los grupos que ya
// inyecta `movi_sso` ("MOVI — Directorio" / "MOVI — Compartidos").
//
// Este archivo es INERTE por sí solo. Para activarlo hacen falta TRES pasos de
// deploy (ver README → "Contactos IONOS (CardDAV) en el correo embebido"):
//   1. Instalar el plugin rcmcarddav en la imagen (composer).
//   2. Agregar 'carddav' a ROUNDCUBEMAIL_PLUGINS.
//   3. Definir IONOS_CARDDAV_URL en el .env del contenedor.
//
// Sin IONOS_CARDDAV_URL no se define ningún preset ⇒ el plugin no intenta nada,
// así que subir este archivo NO cambia el comportamiento del contenedor actual.

$__ionos_carddav_url = getenv('IONOS_CARDDAV_URL');

if ($__ionos_carddav_url) {
    // Preset gestionado: se usa la MISMA sesión IMAP del usuario (username/
    // password de la sesión Roundcube), nunca una credencial aparte. `%p`
    // requiere que Roundcube guarde la contraseña de sesión (ya lo hace vía
    // ROUNDCUBE_DES_KEY). El usuario no puede editar estas credenciales.
    $config['carddav'] = [
        'presets' => [
            'ionos' => [
                'name'         => 'Contactos IONOS',
                'url'          => $__ionos_carddav_url, // colección o URL base con descubrimiento
                'username'     => '%u',
                'password'     => '%p',
                'active'       => true,
                'readonly'     => false,
                'refresh_time' => '02:00:00',
                'fixed'        => ['username', 'password'],
                'hide'         => false,
            ],
        ],
    ];
}
