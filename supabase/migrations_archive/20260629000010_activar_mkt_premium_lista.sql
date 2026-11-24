-- ============================================================
-- 1. Agregar columnas de detalle del plan (si no existen)
-- ============================================================
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS mkt_premium_fecha_inicio date,
  ADD COLUMN IF NOT EXISTS mkt_premium_fecha_pago date,
  ADD COLUMN IF NOT EXISTS mkt_premium_plan text CHECK (mkt_premium_plan IN ('mensual', 'anual')),
  ADD COLUMN IF NOT EXISTS mkt_premium_metodo_pago text CHECK (mkt_premium_metodo_pago IN ('deposito_jiro', 'bono_anual', 'comisiones'));

-- ============================================================
-- 2. Activar Marketing Premium para agentes de la lista
--    (Lista MKT Premium – 6 de octubre 2025)
-- ============================================================
UPDATE usuarios
SET plan_mkt_premium = true
WHERE LOWER(TRIM(email_laboral)) IN (
  -- Alejandra Soto
  'alsoto@jiro.mx',
  -- Alejandra Aldana
  'balejandra.aldana@gmail.com',
  -- Arturo Roldán
  'roldanseg@hotmail.com',
  -- Belinda Milán Hernández
  'bmilan@jiro.mx',
  -- Dulce Díaz de León
  'ddiazdeleon@jiro.mx',
  -- Gilberto Soto
  'gilsotov@hotmail.com',
  -- Juan Pablo Jimenez (Calvillo)
  'contacto.calvillo@jiro.mx',
  -- María Victoria Gutiérrez Quiroz
  'vgutierrezquiroz@gmail.com',
  -- Mauricio Ramos
  'mramosm@jiro.mx',
  -- Mónica Yepez
  'myepezm@jiro.mx',
  -- Raúl Espinosa
  'raul.espinosa@jiro.mx',
  -- Sally Rossette
  'srossete@jiro.mx',
  -- Sofía Aguilar
  'saguilar@jiro.mx',
  -- Hugo Carlos López
  'hugocarloslopez84@gmail.com',
  -- Elizabeth García Espitia
  'finanzasconely@gmail.com',
  -- Miguel Angel Tzoni Ortega
  'tzonim@gmail.com',
  -- Maria Elena Galván Salinas
  'malengalvan@yahoo.com.mx',
  -- Juan Pablo Tsuyoshi del Toro Castillo
  'deltoroagentedeseguros@gmail.com',
  -- Luis Fernando Romo López
  'luis.fdo.8505@gmail.com',
  -- Oscar Méndez Hernández
  'omendezh210@gmail.com',
  -- Lucero Eloísa Martínez Montoya (correo nuevo)
  'seguroconlu@gmail.com',
  -- Osmin Antonio Pérez Garduño
  'oswald0013@hotmail.com',
  -- Liz González
  'lizbeth.gonzalez@emprefit.com',
  -- Israel Angeles Tovar
  'asesoresa@yahoo.com',
  -- Abril Berenice Vaca Casique
  'abrilberenice1292@gmail.com'
);

-- ============================================================
-- 3. Verificar cuántos quedaron activados
-- ============================================================
SELECT COUNT(*) AS total_premium_activados
FROM usuarios
WHERE plan_mkt_premium = true;
