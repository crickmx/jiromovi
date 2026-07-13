-- Multi-Autos: carga endpoint_url real por aseguradora.
-- endpoint_url nunca se habia llenado desde que se creo la tabla
-- (20260626204921_create_multi_autos_module.sql solo llenaba `configuracion`
-- con URLs inventadas) -- el codigo de multi-autos-quote/index.ts lee
-- insurer.endpoint_url, asi que sin esto todas las cotizaciones fallaban con
-- "Endpoint no configurado" sin importar si las credenciales estaban bien.

-- Qualitas: WSDL confirmado en vivo, ambiente QA.
UPDATE multi_autos_aseguradoras
SET endpoint_url = 'https://qa.qualitas.com.mx:8443/WsEmision/WsEmision.asmx'
WHERE nombre = 'Qualitas';

-- ANA Seguros: WSDL confirmado en vivo, ambiente de pruebas.
UPDATE multi_autos_aseguradoras
SET endpoint_url = 'https://server.anaseguros.com.mx/ananetws/service.asmx'
WHERE nombre = 'ANA Seguros';

-- HDI Seguros: WSDL confirmado en vivo, ambiente IMP (implementation).
UPDATE multi_autos_aseguradoras
SET endpoint_url = 'https://enterpriseservices.implementation.hdi.com.mx/B2B/Partners/WCF/Autos/PublicServicesAutos.asmx'
WHERE nombre = 'HDI Seguros';

-- GNP: pendiente -- su endpoint real solo esta en el Kit GNP -
-- Multicotizador JIRO.xlsx (no tiene WSDL publico). No se llena aqui para no
-- adivinar una URL de produccion; ver MULTIAUTOS_CONFIGURACION_ENV.md.

-- Zurich/Chubb/Potosi: sin schema/endpoint real confirmado para ninguna --
-- se desactivan para que no truenen en el flujo de cotizacion.
UPDATE multi_autos_aseguradoras
SET disponible = false
WHERE nombre IN ('Zurich', 'Chubb', 'Potosi');
