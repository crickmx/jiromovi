/*
  # Opciones en cascada del catálogo de vehículos

  Sin esto, pedir "las marcas" desde el navegador significa traer las 17,588
  filas para quedarse con 332 valores distintos — unos 2 MB por cada vez que
  alguien abre el selector.

  La función devuelve los valores distintos de UN nivel, filtrados por lo que ya
  esté elegido en los OTROS. Eso es lo que hace que la cascada funcione en ambos
  sentidos: elegir un modelo sin marca acota las marcas, no solo al revés.
*/

CREATE OR REPLACE FUNCTION public.catalogo_vehiculos_opciones(
  p_nivel   text,
  p_marca   text DEFAULT NULL,
  p_modelo  text DEFAULT NULL,
  p_version text DEFAULT NULL
)
RETURNS TABLE (valor text, claves bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE p_nivel
      WHEN 'marca'   THEN marca
      WHEN 'modelo'  THEN modelo
      WHEN 'version' THEN version
    END AS valor,
    COUNT(*) AS claves
  FROM catalogo_vehiculos
  WHERE activo
    -- Cada filtro se ignora cuando el nivel pedido ES ese filtro: si no, pedir
    -- las marcas teniendo una marca elegida devolvería solo esa.
    AND (p_marca   IS NULL OR p_nivel = 'marca'   OR marca   = p_marca)
    AND (p_modelo  IS NULL OR p_nivel = 'modelo'  OR modelo  = p_modelo)
    AND (p_version IS NULL OR p_nivel = 'version' OR version = p_version)
  GROUP BY 1
  HAVING CASE p_nivel
      WHEN 'marca'   THEN marca
      WHEN 'modelo'  THEN modelo
      WHEN 'version' THEN version
    END IS NOT NULL
  ORDER BY 1;
$$;

REVOKE EXECUTE ON FUNCTION public.catalogo_vehiculos_opciones(text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.catalogo_vehiculos_opciones(text, text, text, text) TO authenticated;

/*
  El campo "Vehículo" guarda un objeto (clave AMIS + marca/modelo/versión +
  descripción), igual que el de código postal.

  La lista es la de 20260727000004 tal cual, más 'vehiculo'. Si este ALTER falla,
  significa que producción tiene algún tipo que no está en el repo — se resuelve
  agregándolo aquí, no quitando el CHECK. Falla limpio: la transacción revierte
  y no se pierde nada.
*/
ALTER TABLE public.tramite_tipo_campos
  DROP CONSTRAINT IF EXISTS tramite_tipo_campos_tipo_check;

ALTER TABLE public.tramite_tipo_campos
  ADD CONSTRAINT tramite_tipo_campos_tipo_check CHECK (tipo IN (
    'texto_corto','texto_largo','numerico','adjunto','estatus','fecha','booleano',
    'dropdown','seleccion_multiple','aseguradora','ramo','rfc','codigo_postal',
    'telefono','email','curp','porcentaje',
    'area','equipo','agente_vendedor','oficina_jiro','fecha_creacion','fecha_finalizacion','creado_por',
    'prioridad','descripcion','asignado_a','fecha_promesa_entrega','archivos_adjuntos',
    'reporte_protegido',
    'vehiculo'
  ));
