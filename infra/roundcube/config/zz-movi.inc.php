<?php

// Configuración institucional. Las credenciales IMAP se entregarán únicamente
// mediante el flujo SSO de la siguiente fase; nunca se escriben aquí.
$config['product_name'] = 'Correo MOVI';
$config['support_url'] = '';
$config['skin'] = 'elastic2022';
$config['language'] = 'es_MX';
$config['des_key'] = getenv('ROUNDCUBE_DES_KEY');

$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['login_lc'] = 2;
$config['login_autocomplete'] = 0;
$config['session_lifetime'] = 120;
$config['session_domain'] = '';
$config['session_path'] = '/correo/';
$config['session_samesite'] = 'Strict';
$config['session_secure'] = true;
$config['ip_check'] = true;
$config['force_https'] = true;
$config['use_https'] = true;
$config['identities_level'] = 3;

// Roundcube solo se mostrará bajo el mismo origen, detrás del proxy de MOVI.
$config['x_frame_options'] = 'sameorigin';
$config['content_security_policy'] = true;

$config['prefer_html'] = true;
$config['show_images'] = 0;
$config['htmleditor'] = 1;
$config['compose_save_localstorage'] = true;
$config['draft_autosave'] = 30;
$config['inline_images'] = true;
$config['image_thumbnail_size'] = 320;
$config['client_mimetypes'] = [
    'text/plain', 'text/html',
    'image/jpeg', 'image/gif', 'image/png', 'image/bmp', 'image/tiff', 'image/webp',
    'application/pdf',
];
$config['layout'] = 'widescreen';
$config['preview_pane_mark_read'] = 5;
$config['message_sort_col'] = 'date';
$config['message_sort_order'] = 'DESC';
$config['archive_type'] = 'year';
$config['zipdownload_selection'] = true;
$config['zipdownload_attachments'] = true;
$config['logout_purge'] = 30;
$config['logout_expunge'] = true;

$config['log_logins'] = true;
$config['log_session'] = false;
$config['sql_debug'] = false;
$config['imap_debug'] = false;
$config['smtp_debug'] = false;
