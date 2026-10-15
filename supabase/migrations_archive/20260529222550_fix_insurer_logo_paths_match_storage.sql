/*
  # Fix insurer logo_local_path to match actual storage file extensions

  The previous migration set logo_local_path to .png for SVG files already in storage.
  This corrects each path to match the actual uploaded file extension.

  Storage inventory:
  - logos/afirme-seguros.svg
  - logos/allianz-mexico.svg
  - logos/ana-seguros.png
  - logos/axa-seguros.svg
  - logos/banorte-seguros.svg
  - logos/bupa-mexico.svg
  - logos/bxplus-fianzas.svg
  - logos/chubb-seguros.svg
  - logos/gnp-seguros.svg
  - logos/hdi-seguros.png
  - logos/inbursa-seguros.svg
  - logos/liberty-fianzas.svg
  - logos/mapfre-mexico.svg
  - logos/metlife-mexico.svg
  - logos/qualitas-seguros.png
  - logos/seguros-atlas.png
  - logos/seguros-sura.svg
  - logos/zurich-seguros.svg
*/

UPDATE seguwallet_insurers SET logo_local_path = 'logos/afirme-seguros.svg',   updated_at = now() WHERE id = '8aefd852-21ad-428d-b05b-c9110f93ddab';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/allianz-mexico.svg',   updated_at = now() WHERE id = 'bc703421-53ef-4abb-b3cc-a186aaa52ac5';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/ana-seguros.png',      updated_at = now() WHERE id = '9800c450-22ce-4c5b-b060-3d6fee993b71';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/axa-seguros.svg',      updated_at = now() WHERE id = '2db95286-2212-4b46-964d-5b1cb0cc5a07';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/banorte-seguros.svg',  updated_at = now() WHERE id = 'f4e40b45-249e-47f3-82f2-61c932b0b819';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/bupa-mexico.svg',      updated_at = now() WHERE id = 'fa6ffb3e-e8ea-4fb1-ae89-c99faa21776f';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/bxplus-fianzas.svg',   updated_at = now() WHERE id = '9fd3c4cf-3562-4386-ae51-7639e147e263';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/chubb-seguros.svg',    updated_at = now() WHERE id = '34b1eedc-571a-436e-a937-502dc82b8554';
-- Dentegra: no local file yet, keep logo_url
UPDATE seguwallet_insurers SET logo_local_path = null,                         updated_at = now() WHERE id = '03d84da7-13d0-4ac0-8c7f-1e300a7c56df';
-- Dorama: no local file, keep logo_url
UPDATE seguwallet_insurers SET logo_local_path = null,                         updated_at = now() WHERE id = '2f5494d3-828b-4a19-8279-b44833813590';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/gnp-seguros.svg',      updated_at = now() WHERE id = 'ac35d819-93e2-455e-bff1-35743ba3f7e8';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/hdi-seguros.png',      updated_at = now() WHERE id = '3698995f-361f-4cea-bf3d-a2996e59671b';
-- HIR: no local file, keep logo_url
UPDATE seguwallet_insurers SET logo_local_path = null,                         updated_at = now() WHERE id = '19f8a2d4-05b9-4ffe-8071-aa8807506f5c';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/inbursa-seguros.svg',  updated_at = now() WHERE id = 'b890ca44-0247-40dc-8c90-be4ce71f8a85';
-- Insignia: no local file, keep logo_url
UPDATE seguwallet_insurers SET logo_local_path = null,                         updated_at = now() WHERE id = '5ce06c08-fa10-4151-aaea-ade9474a6356';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/liberty-fianzas.svg',  updated_at = now() WHERE id = '961d8d33-afb2-41bb-a96f-baed9967bfcb';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/mapfre-mexico.svg',    updated_at = now() WHERE id = 'ccceaf69-96d6-4740-bc44-4da7fcd8b0d9';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/metlife-mexico.svg',   updated_at = now() WHERE id = 'c432515d-aea0-4b6a-a3f0-5884f8af1224';
-- Mutuus: no local file, keep logo_url
UPDATE seguwallet_insurers SET logo_local_path = null,                         updated_at = now() WHERE id = '2b5dbbef-68c5-4a38-ad30-61af4372b9bf';
-- Proteccion Mutua: no local file, keep logo_url
UPDATE seguwallet_insurers SET logo_local_path = null,                         updated_at = now() WHERE id = '059cf958-9293-43c6-959b-579c284c2021';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/qualitas-seguros.png', updated_at = now() WHERE id = 'f997367b-96b7-42c9-871f-0ab6d8419e7d';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/seguros-atlas.png',    updated_at = now() WHERE id = '78970335-5489-4c76-826d-e2e26de33c67';
-- Seguros El Potosi: no local file, keep logo_url
UPDATE seguwallet_insurers SET logo_local_path = null,                         updated_at = now() WHERE id = '2d8995f8-4f0f-4bd3-8611-d6dee79af625';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/seguros-sura.svg',     updated_at = now() WHERE id = '41fa84b1-bb3d-4527-a2fb-2e5a9e95c73d';
-- Thona: no local file, keep logo_url
UPDATE seguwallet_insurers SET logo_local_path = null,                         updated_at = now() WHERE id = '48f62fe2-04e4-4901-b827-6bf5bfa9b9ed';
UPDATE seguwallet_insurers SET logo_local_path = 'logos/zurich-seguros.svg',   updated_at = now() WHERE id = '33f31365-34d9-45ad-b91e-b9d2c001aada';
-- Aserta: no local file, keep logo_url
UPDATE seguwallet_insurers SET logo_local_path = null,                         updated_at = now() WHERE id = '846e7ff2-eb9c-4d37-b1f3-17e219ee9c14';
