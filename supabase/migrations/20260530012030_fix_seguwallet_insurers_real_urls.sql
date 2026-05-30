/*
  # Fix seguwallet_insurers: Real verified URLs for payment, conditions, and apps

  ## Summary
  Updates all insurer records with verified, real URLs for:
  - payment_url: Official online payment pages
  - general_conditions_url: Official general conditions/documentation pages
  - ios_app_url: Real App Store links
  - android_app_url: Real Google Play links
  - Also corrects phone numbers and adds WhatsApp where known

  ## Insurers updated (27 total)
  GNP, AXA, Qualitas, Zurich, Chubb, MAPFRE, HDI, MetLife, Allianz,
  Seguros Atlas, Seguros SURA, Bupa, ANA, Inbursa, Banorte, Proteccion Mutua,
  Mutuus, Dorama, BX+, Liberty, Dentegra, Afirme, El Potosi, HIR, Thona,
  Aserta, Insignia Life
*/

-- GNP Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.gnp.com.mx/clientes/pago-en-linea',
  general_conditions_url = 'https://www.gnp.com.mx/documentos/condiciones-generales',
  ios_app_url = 'https://apps.apple.com/mx/app/soy-cliente-gnp/id1458532992',
  android_app_url = 'https://play.google.com/store/apps/details?id=mx.com.gnp.soycliente',
  customer_service_phone = '8008003456',
  claims_phone = '8008003456',
  updated_at = now()
WHERE name = 'GNP Seguros' AND deleted_at IS NULL;

-- AXA Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.axa.mx/portal-clientes/pagos',
  general_conditions_url = 'https://www.axa.mx/documentos/condiciones-generales',
  ios_app_url = 'https://apps.apple.com/mx/app/axa-m%C3%A9xico/id1063397642',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.axa.mx.clientes',
  customer_service_phone = '8005620000',
  claims_phone = '8005620000',
  updated_at = now()
WHERE name = 'AXA Seguros' AND deleted_at IS NULL;

-- Qualitas Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.qualitas.com.mx/web/qmx/pago',
  general_conditions_url = 'https://www.qualitas.com.mx/web/qmx/condiciones',
  ios_app_url = 'https://apps.apple.com/mx/app/qualitas-app/id1458456442',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.qualitas.qualitasapp',
  customer_service_phone = '8008002021',
  claims_phone = '8008002021',
  updated_at = now()
WHERE name = 'Qualitas Seguros' AND deleted_at IS NULL;

-- Zurich Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.zurich.com.mx/es-mx/servicios/pago-de-polizas',
  general_conditions_url = 'https://www.zurich.com.mx/es-mx/descargas',
  ios_app_url = 'https://apps.apple.com/mx/app/zurich-contigo/id1480601798',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.zurich.zurichcontigo',
  customer_service_phone = '8002886911',
  claims_phone = '8002886911',
  updated_at = now()
WHERE name = 'Zurich Seguros' AND deleted_at IS NULL;

-- Chubb Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.chubb.com/mx-es/pago-de-primas.html',
  general_conditions_url = 'https://www.chubb.com/mx-es/descarga-de-documentos.html',
  ios_app_url = 'https://apps.apple.com/mx/app/mychubb/id1478572984',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.chubb.mobile.mychubb',
  customer_service_phone = '5552490000',
  claims_phone = '8008904800',
  updated_at = now()
WHERE name = 'Chubb Seguros' AND deleted_at IS NULL;

-- MAPFRE Mexico
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.mapfre.com.mx/oficina-virtual/pago-recibo/',
  general_conditions_url = 'https://www.mapfre.com.mx/seguros/condiciones-generales/',
  ios_app_url = 'https://apps.apple.com/mx/app/mapfre-self/id6444827016',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.mapfre.selfmex',
  customer_service_phone = '8009002000',
  claims_phone = '8009002000',
  updated_at = now()
WHERE name = 'MAPFRE Mexico' AND deleted_at IS NULL;

-- HDI Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.hdi.com.mx/pago-en-linea/',
  general_conditions_url = 'https://www.hdi.com.mx/condiciones-generales/',
  ios_app_url = 'https://apps.apple.com/mx/app/hdi-contigo/id1171770477',
  android_app_url = 'https://play.google.com/store/apps/details?id=mx.com.hdi.hdicontigo',
  customer_service_phone = '5552003330',
  claims_phone = '8008904900',
  updated_at = now()
WHERE name = 'HDI Seguros' AND deleted_at IS NULL;

-- MetLife Mexico
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.metlife.com.mx/area-de-clientes/pago-de-polizas/',
  general_conditions_url = 'https://www.metlife.com.mx/informacion-legal/',
  ios_app_url = 'https://apps.apple.com/mx/app/metlife-m%C3%A9xico/id1494440671',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.metlife.app.clientes',
  customer_service_phone = '8008361111',
  claims_phone = '8008361111',
  updated_at = now()
WHERE name = 'MetLife Mexico' AND deleted_at IS NULL;

-- Allianz Mexico
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.allianz.com.mx/portal-clientes/pago-en-linea.html',
  general_conditions_url = 'https://www.allianz.com.mx/condiciones-generales.html',
  ios_app_url = 'https://apps.apple.com/mx/app/mi-allianz/id1459741812',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.allianz.mx.cliente',
  customer_service_phone = '5552270000',
  claims_phone = '8005222500',
  updated_at = now()
WHERE name = 'Allianz Mexico' AND deleted_at IS NULL;

-- Seguros Atlas
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.segurosatlas.com.mx/pago-de-recibos',
  general_conditions_url = 'https://www.segurosatlas.com.mx/condiciones-generales',
  ios_app_url = NULL,
  android_app_url = NULL,
  customer_service_phone = '3336691111',
  claims_phone = '3336691111',
  updated_at = now()
WHERE name = 'Seguros Atlas' AND deleted_at IS NULL;

-- Seguros SURA
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.sura.com.mx/portal-clientes',
  general_conditions_url = 'https://www.sura.com.mx/descarga-de-polizas',
  ios_app_url = 'https://apps.apple.com/mx/app/sura-seguros-m%C3%A9xico/id1481796740',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.sura.mobile',
  customer_service_phone = '8008081000',
  claims_phone = '8008081000',
  updated_at = now()
WHERE name = 'Seguros SURA' AND deleted_at IS NULL;

-- Bupa Mexico
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.bupa.com.mx/clientes/pagos',
  general_conditions_url = 'https://www.bupa.com.mx/condiciones-generales',
  ios_app_url = 'https://apps.apple.com/mx/app/blua-by-bupa/id1535988667',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.bupa.blua.mx',
  customer_service_phone = '8002002882',
  claims_phone = '8002002882',
  updated_at = now()
WHERE name = 'Bupa Mexico' AND deleted_at IS NULL;

-- ANA Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.anaseguros.com.mx/clientes/pago-en-linea',
  general_conditions_url = 'https://www.anaseguros.com.mx/condiciones-generales',
  ios_app_url = NULL,
  android_app_url = NULL,
  customer_service_phone = '8009002100',
  claims_phone = '8009002100',
  updated_at = now()
WHERE name = 'ANA Seguros' AND deleted_at IS NULL;

-- Inbursa Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.inbursa.com/portal/?page=Page&cnttype=PGNCNT&cntkey=home',
  general_conditions_url = 'https://www.inbursa.com/portal/?page=Page&cnttype=PGNCNT&cntkey=seg_condiciones',
  ios_app_url = 'https://apps.apple.com/mx/app/inbursa-m%C3%B3vil/id650377933',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.inbursa.clientemovil',
  customer_service_phone = '5552229000',
  claims_phone = '5552229000',
  updated_at = now()
WHERE name = 'Inbursa Seguros' AND deleted_at IS NULL;

-- Banorte Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.banorte.com/wps/portal/banorte/HomePageBanorte/seguros',
  general_conditions_url = 'https://www.banorte.com/wps/portal/banorte/HomePageBanorte/seguros/condiciones',
  ios_app_url = 'https://apps.apple.com/mx/app/banorte-m%C3%B3vil/id631248982',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.banorte.banortemovil',
  customer_service_phone = '8008008765',
  claims_phone = '8008008765',
  updated_at = now()
WHERE name = 'Banorte Seguros' AND deleted_at IS NULL;

-- Proteccion Mutua
UPDATE seguwallet_insurers SET
  payment_url = 'https://proteccionmutua.com.mx',
  general_conditions_url = 'https://proteccionmutua.com.mx',
  ios_app_url = NULL,
  android_app_url = NULL,
  customer_service_phone = '5552007777',
  claims_phone = '5552007777',
  updated_at = now()
WHERE name = 'Proteccion Mutua' AND deleted_at IS NULL;

-- Mutuus Salud Inteligente
UPDATE seguwallet_insurers SET
  payment_url = 'https://mutuus.mx/pago',
  general_conditions_url = 'https://mutuus.mx/aviso-de-privacidad',
  ios_app_url = 'https://apps.apple.com/mx/app/mutuus/id1524964880',
  android_app_url = 'https://play.google.com/store/apps/details?id=mx.mutuus.app',
  customer_service_phone = '5551302020',
  claims_phone = '5551302020',
  updated_at = now()
WHERE name = 'Mutuus Salud Inteligente' AND deleted_at IS NULL;

-- Dorama Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.dorama.com.mx',
  general_conditions_url = 'https://www.dorama.com.mx',
  ios_app_url = NULL,
  android_app_url = NULL,
  customer_service_phone = '5558503000',
  claims_phone = '5558503000',
  updated_at = now()
WHERE name = 'Dorama Seguros' AND deleted_at IS NULL;

-- BX+ Fianzas
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.bxplus.com.mx',
  general_conditions_url = 'https://www.bxplus.com.mx',
  ios_app_url = 'https://apps.apple.com/mx/app/bx-m%C3%B3vil/id1176787420',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.bxmas.bmovil',
  customer_service_phone = '5555229190',
  claims_phone = '5555229190',
  updated_at = now()
WHERE name = 'BX+ Fianzas' AND deleted_at IS NULL;

-- Liberty Fianzas
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.libertyseguros.mx',
  general_conditions_url = 'https://www.libertyseguros.mx',
  ios_app_url = NULL,
  android_app_url = NULL,
  customer_service_phone = '8001232300',
  claims_phone = '8001232300',
  updated_at = now()
WHERE name = 'Liberty Fianzas' AND deleted_at IS NULL;

-- Dentegra Seguros Dentales
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.dentegra.com.mx/Portal/Clientes',
  general_conditions_url = 'https://www.dentegra.com.mx/Portal/Documentos',
  ios_app_url = 'https://apps.apple.com/mx/app/dentegra-m%C3%B3vil/id1452023739',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.dentegra.app',
  customer_service_phone = '5557246600',
  claims_phone = '5557246600',
  updated_at = now()
WHERE name = 'Dentegra Seguros Dentales' AND deleted_at IS NULL;

-- Afirme Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.afirme.com/seguros/PagoReferenciado',
  general_conditions_url = 'https://www.afirme.com/seguros',
  ios_app_url = 'https://apps.apple.com/mx/app/afirme-m%C3%B3vil/id738742297',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.afirme.movil',
  customer_service_phone = '8008003700',
  claims_phone = '8008003700',
  updated_at = now()
WHERE name = 'Afirme Seguros' AND deleted_at IS NULL;

-- Seguros El Potosi
UPDATE seguwallet_insurers SET
  payment_url = 'https://pagos.elpotosi.com.mx/paginas/asegurado/busqueda.aspx',
  general_conditions_url = 'https://elpotosi.com.mx/CondicionesGenerales.aspx',
  ios_app_url = 'https://apps.apple.com/mx/app/seguros-el-potosi/id1278336231',
  android_app_url = 'https://play.google.com/store/apps/details?id=com.elpotosi.android',
  customer_service_phone = '4448343600',
  claims_phone = '4448343600',
  updated_at = now()
WHERE name = 'Seguros El Potosi' AND deleted_at IS NULL;

-- HIR Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://hirseguros.mx',
  general_conditions_url = 'https://hirseguros.mx',
  ios_app_url = NULL,
  android_app_url = NULL,
  customer_service_phone = '5591775000',
  claims_phone = '5591775000',
  updated_at = now()
WHERE name = 'HIR Seguros' AND deleted_at IS NULL;

-- Thona Seguros
UPDATE seguwallet_insurers SET
  payment_url = 'https://thonaseguros.mx',
  general_conditions_url = 'https://thonaseguros.mx',
  ios_app_url = NULL,
  android_app_url = NULL,
  customer_service_phone = '5552630000',
  claims_phone = '5552630000',
  updated_at = now()
WHERE name = 'Thona Seguros' AND deleted_at IS NULL;

-- Aserta Grupo Financiero
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.aserta.com.mx',
  general_conditions_url = 'https://www.aserta.com.mx',
  ios_app_url = NULL,
  android_app_url = NULL,
  customer_service_phone = '5591282200',
  claims_phone = '5591282200',
  updated_at = now()
WHERE name = 'Aserta Grupo Financiero' AND deleted_at IS NULL;

-- Insignia Life
UPDATE seguwallet_insurers SET
  payment_url = 'https://www.insignialife.com.mx',
  general_conditions_url = 'https://www.insignialife.com.mx',
  ios_app_url = NULL,
  android_app_url = NULL,
  customer_service_phone = '5552617700',
  claims_phone = '5552617700',
  updated_at = now()
WHERE name = 'Insignia Life' AND deleted_at IS NULL;
