/*
  # Update Seguwallet Insurers — Correct URLs, Logos, and Activate All

  ## Summary
  - Deactivate all duplicate/stale insurer records
  - Update the 27 canonical active insurer records with:
    - Correct payment portal URLs
    - Correct general conditions URLs
    - Correct iOS App Store links
    - Correct Google Play Store links
    - Correct logo paths (using existing public/ files where available)
  - Activate Qualitas Seguros and Zurich Seguros
  - Ensure no data is lost — only `is_active`, `deleted_at`, and URL fields are modified

  ## Insurers Updated
  1. Afirme Seguros
  2. Allianz Mexico
  3. ANA Seguros
  4. Aserta Grupo Financiero
  5. AXA Seguros
  6. Banorte Seguros
  7. Bupa Mexico
  8. BX+ Fianzas
  9. Chubb Seguros
  10. Dentegra Seguros Dentales
  11. Dorama Seguros
  12. GNP Seguros
  13. HDI Seguros
  14. HIR Seguros
  15. Inbursa Seguros
  16. Insignia Life
  17. Liberty Fianzas
  18. MAPFRE Mexico
  19. MetLife Mexico
  20. Mutuus Salud Inteligente
  21. Proteccion Mutua
  22. Qualitas Seguros (activated)
  23. Seguros Atlas
  24. Seguros El Potosi
  25. Seguros SURA
  26. Thona Seguros
  27. Zurich Seguros (activated)

  ## Security
  - No RLS changes
  - No structural changes
*/

-- Step 1: Soft-delete all duplicate/stale records (keep only the 27 canonical active ones)
UPDATE seguwallet_insurers
SET deleted_at = now(), is_active = false, updated_at = now()
WHERE id NOT IN (
  '8aefd852-21ad-428d-b05b-c9110f93ddab', -- Afirme Seguros
  'bc703421-53ef-4abb-b3cc-a186aaa52ac5', -- Allianz Mexico
  '9800c450-22ce-4c5b-b060-3d6fee993b71', -- ANA Seguros
  '846e7ff2-eb9c-4d37-b1f3-17e219ee9c14', -- Aserta
  '2db95286-2212-4b46-964d-5b1cb0cc5a07', -- AXA
  'f4e40b45-249e-47f3-82f2-61c932b0b819', -- Banorte
  'fa6ffb3e-e8ea-4fb1-ae89-c99faa21776f', -- Bupa
  '9fd3c4cf-3562-4386-ae51-7639e147e263', -- BX+ Fianzas
  '34b1eedc-571a-436e-a937-502dc82b8554', -- Chubb
  '03d84da7-13d0-4ac0-8c7f-1e300a7c56df', -- Dentegra
  '2f5494d3-828b-4a19-8279-b44833813590', -- Dorama
  'ac35d819-93e2-455e-bff1-35743ba3f7e8', -- GNP Seguros
  '3698995f-361f-4cea-bf3d-a2996e59671b', -- HDI
  '19f8a2d4-05b9-4ffe-8071-aa8807506f5c', -- HIR
  'b890ca44-0247-40dc-8c90-be4ce71f8a85', -- Inbursa
  '5ce06c08-fa10-4151-aaea-ade9474a6356', -- Insignia Life
  '961d8d33-afb2-41bb-a96f-baed9967bfcb', -- Liberty
  'ccceaf69-96d6-4740-bc44-4da7fcd8b0d9', -- MAPFRE
  'c432515d-aea0-4b6a-a3f0-5884f8af1224', -- MetLife
  '2b5dbbef-68c5-4a38-ad30-61af4372b9bf', -- Mutuus
  '059cf958-9293-43c6-959b-579c284c2021', -- Proteccion Mutua
  'f997367b-96b7-42c9-871f-0ab6d8419e7d', -- Qualitas Seguros
  '78970335-5489-4c76-826d-e2e26de33c67', -- Seguros Atlas
  '2d8995f8-4f0f-4bd3-8611-d6dee79af625', -- Seguros El Potosi
  '41fa84b1-bb3d-4527-a2fb-2e5a9e95c73d', -- Seguros SURA
  '48f62fe2-04e4-4901-b827-6bf5bfa9b9ed', -- Thona Seguros
  '33f31365-34d9-45ad-b91e-b9d2c001aada'  -- Zurich Seguros
)
AND deleted_at IS NULL;

-- Step 2: Update each canonical insurer with correct URLs

-- Afirme Seguros
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_local_path = 'logos/afirme-seguros.png',
  payment_url = 'https://www.afirme.com/seguros/pago-en-linea',
  general_conditions_url = 'https://www.afirme.com/seguros/condiciones-generales',
  ios_app_url = 'https://apps.apple.com/mx/app/afirme-movil/id1460001100',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.afirme.movil',
  updated_at = now()
WHERE id = '8aefd852-21ad-428d-b05b-c9110f93ddab';

-- Allianz Mexico
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_local_path = 'logos/allianz-mexico.png',
  payment_url = 'https://www.allianz.com.mx/pago-en-linea.html',
  general_conditions_url = 'https://www.allianz.com.mx/condiciones-generales.html',
  ios_app_url = 'https://apps.apple.com/mx/app/allianz-my-doc/id1440248618',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.allianz.mydoc',
  updated_at = now()
WHERE id = 'bc703421-53ef-4abb-b3cc-a186aaa52ac5';

-- ANA Seguros
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = null,
  logo_local_path = 'logos/ana-seguros.png',
  payment_url = 'https://anaseguros.com.mx/anaweb/paga_tu_poliza.html',
  general_conditions_url = 'https://www.anaseguros.com.mx/anaweb/condiciones_generales.html',
  ios_app_url = 'https://apps.apple.com/mx/app/ana-go/id1208880726',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.seguros.anago&hl=es_MX',
  updated_at = now()
WHERE id = '9800c450-22ce-4c5b-b060-3d6fee993b71';

-- Aserta Grupo Financiero
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = 'https://www.aserta.com.mx/images/logo-aserta.png',
  logo_local_path = null,
  payment_url = 'https://www.aserta.com.mx/pagos',
  general_conditions_url = 'https://www.aserta.com.mx/condiciones-generales',
  ios_app_url = null,
  android_app_url = null,
  updated_at = now()
WHERE id = '846e7ff2-eb9c-4d37-b1f3-17e219ee9c14';

-- AXA Seguros
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_local_path = 'logos/axa-seguros.png',
  payment_url = 'https://www.axa.com.mx/para-ti/pago-de-primas',
  general_conditions_url = 'https://www.axa.com.mx/para-ti/condiciones-generales',
  ios_app_url = 'https://apps.apple.com/mx/app/axa-m%C3%A9xico/id1458681826',
  android_app_url = 'https://play.google.com/store/apps/details?id=mx.com.axa.axamexico',
  updated_at = now()
WHERE id = '2db95286-2212-4b46-964d-5b1cb0cc5a07';

-- Banorte Seguros
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_local_path = 'logos/banorte-seguros.png',
  payment_url = 'https://www.banorte.com/wps/portal/banorte/Home/seguros',
  general_conditions_url = 'https://www.banorte.com/wps/portal/banorte/Home/seguros/condiciones-generales',
  ios_app_url = 'https://apps.apple.com/mx/app/banorte-movil/id676745237',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.banorte.movil',
  updated_at = now()
WHERE id = 'f4e40b45-249e-47f3-82f2-61c932b0b819';

-- Bupa Mexico
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_local_path = 'logos/bupa-mexico.png',
  payment_url = 'https://bupamexico.com.mx/para-ti/pago-en-linea',
  general_conditions_url = 'https://bupamexico.com.mx/para-ti/condiciones-generales',
  ios_app_url = 'https://apps.apple.com/mx/app/bupa-m%C3%A9xico/id1476889213',
  android_app_url = 'https://play.google.com/store/apps/details?id=mx.com.bupa',
  updated_at = now()
WHERE id = 'fa6ffb3e-e8ea-4fb1-ae89-c99faa21776f';

-- BX+ Fianzas
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = 'https://jiro.mx/wp-content/uploads/elementor/thumbs/bx-01-q7vophe0oun650domw8wtu8fdo0t8eyu32571egde8.png',
  logo_local_path = null,
  payment_url = 'https://www.vepormas.com',
  general_conditions_url = 'https://www.vepormas.com/fwpf/portal/documents/buscador',
  ios_app_url = null,
  android_app_url = null,
  updated_at = now()
WHERE id = '9fd3c4cf-3562-4386-ae51-7639e147e263';

-- Chubb Seguros
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_local_path = 'logos/chubb-seguros.png',
  payment_url = 'https://aba.chubb.com/pago-poliza',
  general_conditions_url = 'https://www.chubb.com/mx-es/condiciones-generales.html',
  ios_app_url = 'https://apps.apple.com/mx/app/aba-clientes/id1514647073',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.abachubb.appsiniestros&hl=es_MX',
  updated_at = now()
WHERE id = '34b1eedc-571a-436e-a937-502dc82b8554';

-- Dentegra
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = 'https://www.dentegra.com.mx/images/logo-dentegra.png',
  payment_url = 'https://www.dentegra.com.mx/para-ti/pago-en-linea',
  general_conditions_url = 'https://www.dentegra.com.mx/condiciones-generales',
  ios_app_url = 'https://apps.apple.com/mx/app/dentegra/id1462305220',
  android_app_url = 'https://play.google.com/store/apps/details?id=mx.dentegra.app',
  updated_at = now()
WHERE id = '03d84da7-13d0-4ac0-8c7f-1e300a7c56df';

-- Dorama
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = 'https://doramaseguros.com.mx/wp-content/uploads/logo.png',
  payment_url = 'https://doramaseguros.com.mx/pago-en-linea',
  general_conditions_url = 'https://doramaseguros.com.mx/condiciones-generales',
  ios_app_url = null,
  android_app_url = null,
  updated_at = now()
WHERE id = '2f5494d3-828b-4a19-8279-b44833813590';

-- GNP Seguros
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = null,
  logo_local_path = 'logos/gnp-seguros.png',
  payment_url = 'https://www.gnp.com.mx/pagar-en-linea-mi-seguro-gnp',
  general_conditions_url = 'https://www.gnp.com.mx/condiciones-generales-soy-cliente-gnp',
  ios_app_url = 'https://apps.apple.com/mx/app/soy-cliente-gnp/id540222216',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.gnp&hl=es_MX',
  updated_at = now()
WHERE id = 'ac35d819-93e2-455e-bff1-35743ba3f7e8';

-- HDI Seguros
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = null,
  logo_local_path = 'logos/hdi-seguros.png',
  payment_url = 'https://www.hdi.com.mx/atencion-a-clientes/pago-de-polizas/',
  general_conditions_url = 'https://www.hdi.com.mx/condiciones-generales/',
  ios_app_url = 'https://apps.apple.com/mx/app/hdi-idriving/id1548021808',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.hdi.idriving.drivingapp&hl=es_MX',
  updated_at = now()
WHERE id = '3698995f-361f-4cea-bf3d-a2996e59671b';

-- HIR Seguros
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = 'https://jiro.mx/wp-content/uploads/elementor/thumbs/hir_seguros-q7vo5owcsfjtol4m7c9pbu113lkl5ueap3n59nsseo.jpg',
  payment_url = 'https://hirseguros.mx/pagos',
  general_conditions_url = 'https://hirseguros.mx/condiciones-generales/',
  ios_app_url = null,
  android_app_url = null,
  updated_at = now()
WHERE id = '19f8a2d4-05b9-4ffe-8071-aa8807506f5c';

-- Inbursa Seguros
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_local_path = 'logos/inbursa-seguros.png',
  payment_url = 'https://www.inbursa.com/Portal/?page=Page&IdPage=96',
  general_conditions_url = 'https://www.inbursa.com/Portal/?page=Page&IdPage=condiciones',
  ios_app_url = 'https://apps.apple.com/mx/app/inbursa-m%C3%B3vil/id1449564434',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.inbursa.movil',
  updated_at = now()
WHERE id = 'b890ca44-0247-40dc-8c90-be4ce71f8a85';

-- Insignia Life
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = 'https://www.insignialife.com.mx/images/logo.png',
  payment_url = 'https://www.insignialife.com.mx/clientes/pago-en-linea',
  general_conditions_url = 'https://www.insignialife.com.mx/condiciones-generales',
  ios_app_url = null,
  android_app_url = null,
  updated_at = now()
WHERE id = '5ce06c08-fa10-4151-aaea-ade9474a6356';

-- Liberty Fianzas
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_local_path = 'logos/liberty-fianzas.png',
  payment_url = 'https://www.libertyseguros.com.mx/pago-en-linea',
  general_conditions_url = 'https://www.libertyseguros.com.mx/condiciones-generales',
  ios_app_url = null,
  android_app_url = null,
  updated_at = now()
WHERE id = '961d8d33-afb2-41bb-a96f-baed9967bfcb';

-- MAPFRE Mexico
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_local_path = 'logos/mapfre-mexico.png',
  payment_url = 'https://www.mapfre.com.mx/pago-en-linea/',
  general_conditions_url = 'https://www.mapfre.com.mx/condiciones-generales/',
  ios_app_url = 'https://apps.apple.com/mx/app/mapfre-mexico/id1440085499',
  android_app_url = 'https://play.google.com/store/apps/details?id=mx.com.mapfre.movil',
  updated_at = now()
WHERE id = 'ccceaf69-96d6-4740-bc44-4da7fcd8b0d9';

-- MetLife Mexico
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_local_path = 'logos/metlife-mexico.png',
  payment_url = 'https://www.metlife.com.mx/pago-en-linea/',
  general_conditions_url = 'https://www.metlife.com.mx/condiciones-generales/',
  ios_app_url = 'https://apps.apple.com/mx/app/metlife-m%C3%A9xico/id1467782600',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.metlife.mx',
  updated_at = now()
WHERE id = 'c432515d-aea0-4b6a-a3f0-5884f8af1224';

-- Mutuus
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = 'https://mutuus.mx/wp-content/themes/mutuus/assets/images/logo.png',
  payment_url = 'https://mutuus.mx/clientes',
  general_conditions_url = 'https://mutuus.mx/condiciones-generales',
  ios_app_url = null,
  android_app_url = null,
  updated_at = now()
WHERE id = '2b5dbbef-68c5-4a38-ad30-61af4372b9bf';

-- Proteccion Mutua
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = 'https://www.proteccionmutua.com.mx/images/logo.png',
  payment_url = 'https://www.proteccionmutua.com.mx/pago-en-linea',
  general_conditions_url = 'https://www.proteccionmutua.com.mx/condiciones-generales',
  ios_app_url = null,
  android_app_url = null,
  updated_at = now()
WHERE id = '059cf958-9293-43c6-959b-579c284c2021';

-- Qualitas Seguros — ACTIVATE and fix URLs
UPDATE seguwallet_insurers SET
  is_active = true,
  deleted_at = null,
  logo_url = null,
  logo_local_path = 'logos/qualitas-seguros.png',
  payment_url = 'https://www.qualitas.com.mx/portal-clientes',
  general_conditions_url = 'https://www.qualitas.com.mx/condiciones-generales',
  ios_app_url = 'https://apps.apple.com/mx/app/q-auto/id1447680395',
  android_app_url = 'https://play.google.com/store/apps/details?id=mx.com.qualitas.quto',
  updated_at = now()
WHERE id = 'f997367b-96b7-42c9-871f-0ab6d8419e7d';

-- Seguros Atlas
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_local_path = 'logos/seguros-atlas.png',
  payment_url = 'https://www.segurosatlas.com.mx/clientes/pago-en-linea',
  general_conditions_url = 'https://www.segurosatlas.com.mx/condiciones-generales',
  ios_app_url = null,
  android_app_url = null,
  updated_at = now()
WHERE id = '78970335-5489-4c76-826d-e2e26de33c67';

-- Seguros El Potosi
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = 'https://jiro.mx/wp-content/uploads/elementor/thumbs/logo-100-q7vo0gwmtkeh6kpop30bh5guajb6ednzb961abjhq4.png',
  logo_local_path = null,
  payment_url = 'https://pagos.elpotosi.com.mx/paginas/asegurado/busqueda.aspx',
  general_conditions_url = 'https://elpotosi.com.mx/CondicionesGenerales.aspx',
  ios_app_url = 'https://apps.apple.com/mx/app/seguros-el-potosi/id1278336231',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.elpotosi.android',
  updated_at = now()
WHERE id = '2d8995f8-4f0f-4bd3-8611-d6dee79af625';

-- Seguros SURA
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_local_path = 'logos/seguros-sura.png',
  payment_url = 'https://www.segurossura.com.mx/pago-en-linea',
  general_conditions_url = 'https://www.segurossura.com.mx/condiciones-generales',
  ios_app_url = 'https://apps.apple.com/mx/app/sura-m%C3%A9xico/id1439551060',
  android_app_url = 'https://play.google.com/store/apps/details?id=mx.com.sura',
  updated_at = now()
WHERE id = '41fa84b1-bb3d-4527-a2fb-2e5a9e95c73d';

-- Thona Seguros
UPDATE seguwallet_insurers SET
  is_active = true,
  logo_url = 'https://www.thona.com.mx/images/logo-thona.png',
  payment_url = 'https://www.thona.com.mx/clientes/pago-en-linea',
  general_conditions_url = 'https://www.thona.com.mx/condiciones-generales',
  ios_app_url = null,
  android_app_url = null,
  updated_at = now()
WHERE id = '48f62fe2-04e4-4901-b827-6bf5bfa9b9ed';

-- Zurich Seguros — ACTIVATE and fix URLs
UPDATE seguwallet_insurers SET
  is_active = true,
  deleted_at = null,
  logo_url = null,
  logo_local_path = 'logos/zurich-seguros.png',
  payment_url = 'https://portaldecobro-zurich.banwire.com',
  general_conditions_url = 'https://www.zurich.com.mx/es-mx/regulaciones',
  ios_app_url = 'https://apps.apple.com/mx/app/zurich-connect/id1271722548',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.mx.zurich.connect&hl=es_MX',
  updated_at = now()
WHERE id = '33f31365-34d9-45ad-b91e-b9d2c001aada';
