<?php

// IONOS expone ManageSieve mediante STARTTLS en 4190. Roundcube reutiliza
// las credenciales de la sesión IMAP; no se almacenan contraseñas adicionales.
$config['managesieve_host'] = 'tls://imap.ionos.mx:4190';
$config['managesieve_auth_type'] = null;
$config['managesieve_script_name'] = 'movi-roundcube';
$config['managesieve_mbox_encoding'] = 'UTF-8';
$config['managesieve_vacation'] = 1;
$config['managesieve_vacation_from_init'] = true;
$config['managesieve_vacation_addresses_init'] = true;
$config['managesieve_forward'] = 1;
$config['managesieve_raw_editor'] = false;
$config['managesieve_debug'] = false;
$config['managesieve_conn_options'] = [
    'ssl' => [
        'verify_peer' => true,
        'verify_peer_name' => true,
        'allow_self_signed' => false,
    ],
];
