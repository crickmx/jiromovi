<?php

// Configuración institucional. Las credenciales IMAP se entregarán únicamente
// mediante el flujo SSO de la siguiente fase; nunca se escriben aquí.
$config['product_name'] = 'Correo MOVI';
$config['support_url'] = '';
$config['skin'] = 'elastic';
$config['language'] = 'es_MX';
$config['des_key'] = getenv('ROUNDCUBE_DES_KEY');

$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['login_lc'] = 2;
$config['login_autocomplete'] = 0;
$config['session_lifetime'] = 30;
$config['session_domain'] = '';
$config['session_path'] = '/correo/';
$config['session_samesite'] = 'Strict';
$config['session_secure'] = true;
$config['ip_check'] = true;
$config['force_https'] = true;
$config['use_https'] = true;

// Roundcube solo se mostrará bajo el mismo origen, detrás del proxy de MOVI.
$config['x_frame_options'] = 'sameorigin';
$config['content_security_policy'] = true;

$config['prefer_html'] = true;
$config['show_images'] = 0;
$config['draft_autosave'] = 60;
$config['message_sort_col'] = 'date';
$config['message_sort_order'] = 'DESC';
$config['archive_type'] = 'year';
$config['zipdownload_selection'] = true;
$config['zipdownload_attachments'] = true;

$config['log_logins'] = true;
$config['log_session'] = false;
$config['sql_debug'] = false;
$config['imap_debug'] = false;
$config['smtp_debug'] = false;
