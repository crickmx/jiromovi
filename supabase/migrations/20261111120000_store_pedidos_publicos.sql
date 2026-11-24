-- ============================================================================
-- MOVI Store: categoría "Temporales / Públicos" y pedidos sin sesión
-- ----------------------------------------------------------------------------
-- * store_categorias.permite_pedido_publico: los productos de estas categorías
--   pueden pedirse desde tienda.movi.digital sin iniciar sesión.
-- * store_pedidos guarda los datos de contacto del invitado; usuario_id queda
--   NULL hasta que Mercadotecnia/equipo Store lo asocia a un usuario MOVI.
-- * store_crear_pedido_publico(): única vía de escritura para anon. Valida
--   productos, calcula precios en servidor y limita abusos por correo.
-- ============================================================================

ALTER TABLE store_categorias
  ADD COLUMN IF NOT EXISTS permite_pedido_publico boolean NOT NULL DEFAULT false;

ALTER TABLE store_pedidos
  ADD COLUMN IF NOT EXISTS es_publico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invitado_nombre text,
  ADD COLUMN IF NOT EXISTS invitado_email text,
  ADD COLUMN IF NOT EXISTS invitado_whatsapp text,
  ADD COLUMN IF NOT EXISTS invitado_oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invitado_oficina_nombre text,
  ADD COLUMN IF NOT EXISTS asociado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asociado_en timestamptz;

CREATE INDEX IF NOT EXISTS idx_store_pedidos_publicos_sin_asociar
  ON store_pedidos (created_at DESC) WHERE es_publico AND usuario_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_store_pedidos_invitado_email
  ON store_pedidos (lower(invitado_email)) WHERE es_publico;

-- Categoría semilla
INSERT INTO store_categorias (nombre, descripcion, activo, permite_pedido_publico)
SELECT 'Temporales / Públicos',
       'Productos de temporada que cualquiera puede pedir sin registrarse en MOVI.',
       true, true
WHERE NOT EXISTS (SELECT 1 FROM store_categorias WHERE nombre = 'Temporales / Públicos');

-- La ficha pública necesita las variantes (tallas, colores…) para elegir opción.
DROP POLICY IF EXISTS store_producto_atributos_anon_select ON store_producto_atributos;
CREATE POLICY store_producto_atributos_anon_select ON store_producto_atributos
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS store_producto_atributo_opciones_anon_select ON store_producto_atributo_opciones;
CREATE POLICY store_producto_atributo_opciones_anon_select ON store_producto_atributo_opciones
  FOR SELECT TO anon USING (activo = true);

-- ---------------------------------------------------------------------------
-- Oficinas activas (solo id + nombre) para el formulario público
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_oficinas_publicas()
RETURNS TABLE (id uuid, nombre text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.id, o.nombre FROM oficinas o WHERE o.activa = true ORDER BY o.nombre;
$$;
REVOKE ALL ON FUNCTION public.store_oficinas_publicas() FROM public;
GRANT EXECUTE ON FUNCTION public.store_oficinas_publicas() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Crear pedido público
-- p_items: [{ "producto_id": uuid, "cantidad": int, "atributos": {"Talla":"M"} }]
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_crear_pedido_publico(
  p_nombre text,
  p_email text,
  p_whatsapp text,
  p_oficina_id uuid,
  p_items jsonb,
  p_notas text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre    text := btrim(coalesce(p_nombre, ''));
  v_email     text := lower(btrim(coalesce(p_email, '')));
  v_whatsapp  text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_oficina   text;
  v_estatus   uuid;
  v_folio     text;
  v_pedido    uuid;
  v_item      jsonb;
  v_prod      record;
  v_cantidad  int;
  v_attrs     jsonb;
  v_precio    numeric;
  v_total     numeric := 0;
  v_nombre_sp text[];
BEGIN
  -- Validaciones de contacto
  IF length(v_nombre) < 5 OR position(' ' in v_nombre) = 0 THEN
    RAISE EXCEPTION 'Escribe tu nombre completo (nombre y apellido).';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'El correo electrónico no es válido.';
  END IF;
  IF length(v_whatsapp) < 10 OR length(v_whatsapp) > 15 THEN
    RAISE EXCEPTION 'El WhatsApp debe tener al menos 10 dígitos.';
  END IF;
  SELECT nombre INTO v_oficina FROM oficinas WHERE id = p_oficina_id AND activa = true;
  IF v_oficina IS NULL THEN
    RAISE EXCEPTION 'Selecciona la oficina a la que perteneces.';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 30 THEN
    RAISE EXCEPTION 'El pedido no tiene productos válidos.';
  END IF;

  -- Límite anti-abuso: 5 pedidos públicos por correo por hora
  IF (SELECT count(*) FROM store_pedidos
       WHERE es_publico AND lower(invitado_email) = v_email
         AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Recibimos varios pedidos con este correo. Intenta de nuevo más tarde.';
  END IF;

  SELECT id INTO v_estatus FROM store_estatus_pedidos WHERE nombre = 'Pendiente' LIMIT 1;
  IF v_estatus IS NULL THEN
    RAISE EXCEPTION 'No se encontró el estatus "Pendiente".';
  END IF;

  v_nombre_sp := regexp_split_to_array(v_nombre, '\s+');
  v_folio := 'ARTMKT-' || lpad(nextval('folio_artmkt_seq')::text, 5, '0')
          || '-' || folio_siglas(v_oficina, 3)
          || '-' || folio_iniciales(v_nombre_sp[1], array_to_string(v_nombre_sp[2:], ' '));

  INSERT INTO store_pedidos (
    usuario_id, es_publico, invitado_nombre, invitado_email, invitado_whatsapp,
    invitado_oficina_id, invitado_oficina_nombre, notas_usuario, estatus_id, folio_oc
  ) VALUES (
    NULL, true, v_nombre, v_email, v_whatsapp,
    p_oficina_id, v_oficina,
    concat_ws(E'\n', 'Área de entrega: ' || v_oficina, nullif(left(btrim(coalesce(p_notas, '')), 1000), '')),
    v_estatus, v_folio
  ) RETURNING id INTO v_pedido;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cantidad := coalesce((v_item->>'cantidad')::int, 0);
    IF v_cantidad < 1 OR v_cantidad > 999 THEN
      RAISE EXCEPTION 'Cantidad inválida.';
    END IF;

    SELECT p.id, p.titulo, p.precio, p.disponibilidad
      INTO v_prod
      FROM store_productos p
      JOIN store_categorias c ON c.id = p.categoria_id
     WHERE p.id = (v_item->>'producto_id')::uuid
       AND p.activo AND c.activo AND c.permite_pedido_publico;
    IF v_prod.id IS NULL THEN
      RAISE EXCEPTION 'Uno de los productos ya no está disponible para pedido sin registro.';
    END IF;

    v_attrs := CASE WHEN jsonb_typeof(v_item->'atributos') = 'object' THEN v_item->'atributos' ELSE '{}'::jsonb END;
    -- Quitar claves internas que el cliente pudiera mandar (p. ej. _precio)
    v_attrs := (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                  FROM jsonb_each_text(v_attrs) AS e(k, v) WHERE k NOT LIKE '\_%');

    -- Siempre el precio vigente del producto (nunca el que mande el cliente)
    v_precio := v_prod.precio;

    INSERT INTO store_pedidos_detalle (pedido_id, producto_id, cantidad, precio_unitario, atributos_seleccionados)
    VALUES (v_pedido, v_prod.id, v_cantidad, v_precio, v_attrs);

    v_total := v_total + v_precio * v_cantidad;

    IF v_prod.disponibilidad = 'por_existencia' THEN
      UPDATE store_productos SET stock = GREATEST(0, stock - v_cantidad) WHERE id = v_prod.id;
    END IF;
  END LOOP;

  INSERT INTO store_pedidos_historial (pedido_id, estatus_id, cambiado_por)
  VALUES (v_pedido, v_estatus, NULL);

  -- Avisar a administradores y equipos con acceso a Store
  INSERT INTO notificaciones (usuario_id, titulo, mensaje, modulo, accion_url, accion_texto, leida)
  SELECT d.id,
         'Nuevo pedido público en Store',
         v_nombre || ' (' || v_oficina || ') hizo un pedido sin registro. Asócialo a su usuario MOVI.',
         'Store', '/store/pedido/' || v_pedido, 'Ver pedido', false
    FROM (
      SELECT u.id FROM usuarios u WHERE u.rol = 'Administrador' AND u.estado = 'Activo'
      UNION
      SELECT m.usuario_id FROM tramites_grupos_miembros m
        JOIN store_equipos_acceso a ON a.grupo_id = m.grupo_id
    ) d;

  RETURN jsonb_build_object('pedido_id', v_pedido, 'folio', v_folio, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.store_crear_pedido_publico(text, text, text, uuid, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.store_crear_pedido_publico(text, text, text, uuid, jsonb, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Asociar un pedido público a un usuario MOVI (admins / equipos Store)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_asociar_pedido_usuario(p_pedido_id uuid, p_usuario_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_es_publico boolean;
BEGIN
  IF NOT store_puede_administrar() THEN
    RAISE EXCEPTION 'No tienes permiso para asociar pedidos.';
  END IF;
  SELECT es_publico INTO v_es_publico FROM store_pedidos WHERE id = p_pedido_id;
  IF v_es_publico IS NULL THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;
  IF NOT v_es_publico THEN
    RAISE EXCEPTION 'Solo se pueden reasignar pedidos públicos.';
  END IF;
  IF p_usuario_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuarios WHERE id = p_usuario_id) THEN
    RAISE EXCEPTION 'Usuario no encontrado.';
  END IF;

  UPDATE store_pedidos
     SET usuario_id   = p_usuario_id,
         asociado_por = CASE WHEN p_usuario_id IS NULL THEN NULL ELSE auth.uid() END,
         asociado_en  = CASE WHEN p_usuario_id IS NULL THEN NULL ELSE now() END
   WHERE id = p_pedido_id;
END;
$$;

REVOKE ALL ON FUNCTION public.store_asociar_pedido_usuario(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.store_asociar_pedido_usuario(uuid, uuid) TO authenticated;
