/*
  # Catálogo de vehículos AMIS

  Alimenta el campo "Vehículo" del FormBuilder con una cascada
  marca → modelo → versión → descripción.

  Por qué hay un cuarto nivel: marca+modelo+versión NO identifica una clave AMIS.
  De las 6,790 combinaciones del catálogo, 2,842 (42%) apuntan a más de una clave
  —hasta 75 en el caso de KENWORTH— porque lo que las distingue vive en la
  descripción: transmisión, motor, número de puertas. Ejemplo real:

    B0620120  NI VERSA SENSE LA/1.6/106/105 M-5V CA 4PTS.   (manual)
    B0620121  NI VERSA SENSE LA/1.6/106/105 A-4V CA 4PTS.   (automática)

  Misma marca, modelo y versión; distinta clave. La descripción sí es única, así
  que es la que cierra la cascada. Cuando una versión tiene una sola clave, el
  frontend se salta ese paso.

  El año NO va aquí: el catálogo AMIS describe versiones, no años-modelo. El año
  se captura aparte en el formulario.
*/

CREATE TABLE IF NOT EXISTS public.catalogo_vehiculos (
  clave_amis   text PRIMARY KEY,
  marca        text NOT NULL,
  modelo       text NOT NULL,
  version      text NOT NULL,
  -- Única por clave: es la que desambigua cuando una versión tiene varias.
  descripcion  text NOT NULL,
  segmento     text,
  transmision  text,
  carroceria   text,
  activo       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.catalogo_vehiculos IS
  'Catálogo AMIS de versiones de vehículos. Sin año: AMIS describe versiones, no años-modelo.';

-- Índices de la cascada: cada nivel filtra por los anteriores.
CREATE INDEX IF NOT EXISTS idx_cat_veh_marca            ON public.catalogo_vehiculos(marca)  WHERE activo;
CREATE INDEX IF NOT EXISTS idx_cat_veh_marca_modelo     ON public.catalogo_vehiculos(marca, modelo) WHERE activo;
CREATE INDEX IF NOT EXISTS idx_cat_veh_marca_mod_ver    ON public.catalogo_vehiculos(marca, modelo, version) WHERE activo;
-- La cascada también funciona al revés (elegir modelo sin marca, por ejemplo),
-- así que se indexan los niveles inferiores por su cuenta.
CREATE INDEX IF NOT EXISTS idx_cat_veh_modelo           ON public.catalogo_vehiculos(modelo)  WHERE activo;
CREATE INDEX IF NOT EXISTS idx_cat_veh_version          ON public.catalogo_vehiculos(version) WHERE activo;

ALTER TABLE public.catalogo_vehiculos ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado lo consulta al llenar un trámite.
DROP POLICY IF EXISTS "cat_veh_read"  ON public.catalogo_vehiculos;
CREATE POLICY "cat_veh_read"
  ON public.catalogo_vehiculos FOR SELECT TO authenticated USING (true);

-- Solo Administrador lo modifica: es un catálogo oficial, no datos de captura.
DROP POLICY IF EXISTS "cat_veh_write" ON public.catalogo_vehiculos;
CREATE POLICY "cat_veh_write"
  ON public.catalogo_vehiculos FOR ALL TO authenticated
  USING (get_my_rol() = 'Administrador')
  WITH CHECK (get_my_rol() = 'Administrador');
