-- El puente se mantiene solo: enlazar en una pantalla enlaza en la otra.
--
-- La migración anterior puso la llave (`maestro_agentes.vend_id`) y emparejó lo
-- que ya existía. Esto es lo que evita que se vuelvan a separar.
--
-- Va en la base y no en las pantallas a propósito: el enlace se escribe desde
-- seis lugares distintos (el modal de usuario, la pestaña Mapeo, la sugerencia
-- de IA, la validación de una propuesta, la importación del Excel y la
-- sincronización de SICAS). Un arreglo por pantalla habría dejado fuera a las
-- otras cinco y a las que vengan.

-- ── De "Mapeo MOVI ↔ Agente" hacia SICAS ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_mapeo_agente_a_sicas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a record;
BEGIN
  IF NOT NEW.activo THEN RETURN NEW; END IF;

  SELECT nombre, vend_id INTO a FROM maestro_agentes WHERE id = NEW.agente_id;
  -- Un agente creado a mano para un usuario MOVI no tiene contraparte en SICAS.
  IF a.vend_id IS NULL THEN RETURN NEW; END IF;

  -- Los `IS DISTINCT FROM` no son adorno: cortan el ida y vuelta entre este
  -- trigger, el de abajo y el que ya existía sobre `usuarios.id_sicas`.
  UPDATE usuarios
  SET id_sicas = a.vend_id,
      nombre_sicas = coalesce(nombre_sicas, a.nombre)
  WHERE id = NEW.user_id AND id_sicas IS DISTINCT FROM a.vend_id;

  UPDATE sicas_vendor_user_mappings
  SET movi_user_id = NEW.user_id, updated_at = now()
  WHERE vend_id = a.vend_id AND movi_user_id IS DISTINCT FROM NEW.user_id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_mapeo_agente_a_sicas ON public.maestro_usuario_agente;
CREATE TRIGGER trg_sync_mapeo_agente_a_sicas
  AFTER INSERT OR UPDATE ON public.maestro_usuario_agente
  FOR EACH ROW EXECUTE FUNCTION public.sync_mapeo_agente_a_sicas();

-- ── De "Enlazar usuario SICAS" hacia el mapeo de trámites ───────────────────
CREATE OR REPLACE FUNCTION public.sync_sicas_a_mapeo_agente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agente uuid;
BEGIN
  IF NEW.movi_user_id IS NULL OR NEW.vend_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_agente FROM maestro_agentes WHERE vend_id = NEW.vend_id;

  -- ¿Ya estaba en el catálogo del Excel, sin su ID de SICAS? Se le pone.
  IF v_agente IS NULL THEN
    SELECT id INTO v_agente FROM maestro_agentes
     WHERE vend_id IS NULL
       AND nombre_comparable(nombre) = nombre_comparable(NEW.vend_nombre)
     ORDER BY es_primario DESC NULLS LAST
     LIMIT 1;
    IF v_agente IS NOT NULL THEN
      UPDATE maestro_agentes SET vend_id = NEW.vend_id WHERE id = v_agente;
    END IF;
  END IF;

  -- Y si no estaba, entra. Un vendedor que alguien enlazó a mano tiene que
  -- existir en el catálogo que leen los trámites, o el enlace no sirve de nada.
  IF v_agente IS NULL THEN
    BEGIN
      INSERT INTO maestro_agentes (nombre, vend_id, origen, activo, despacho_id)
      VALUES (
        NEW.vend_nombre, NEW.vend_id, 'sicas', true,
        (SELECT id FROM maestro_despachos
          WHERE nombre_comparable(nombre) = nombre_comparable(NEW.desp_nombre) LIMIT 1)
      )
      RETURNING id INTO v_agente;
    EXCEPTION WHEN unique_violation THEN
      -- Choca con UNIQUE (nombre, despacho_id): es el mismo, se reutiliza.
      SELECT id INTO v_agente FROM maestro_agentes
       WHERE nombre_comparable(nombre) = nombre_comparable(NEW.vend_nombre) LIMIT 1;
    END;
  END IF;

  IF v_agente IS NULL THEN RETURN NEW; END IF;

  INSERT INTO maestro_usuario_agente (user_id, agente_id, activo)
  VALUES (NEW.movi_user_id, v_agente, true)
  ON CONFLICT (user_id) DO UPDATE
    SET agente_id = EXCLUDED.agente_id, activo = true, updated_at = now()
    WHERE maestro_usuario_agente.agente_id IS DISTINCT FROM EXCLUDED.agente_id
       OR maestro_usuario_agente.activo IS DISTINCT FROM true;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_sicas_a_mapeo_agente ON public.sicas_vendor_user_mappings;
CREATE TRIGGER trg_sync_sicas_a_mapeo_agente
  AFTER INSERT OR UPDATE OF movi_user_id, vend_id ON public.sicas_vendor_user_mappings
  FOR EACH ROW EXECUTE FUNCTION public.sync_sicas_a_mapeo_agente();

-- ── Desenlazar también desenlaza del otro lado ──────────────────────────────
-- `unlink_vendor_from_user` limpia `usuarios.id_sicas`; faltaba soltar el mapeo
-- de trámites, que si no se quedaba apuntando a un vendedor ya desvinculado.
CREATE OR REPLACE FUNCTION public.sync_desenlace_sicas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.movi_user_id IS NULL OR NEW.movi_user_id IS NOT DISTINCT FROM OLD.movi_user_id THEN
    RETURN NEW;
  END IF;

  DELETE FROM maestro_usuario_agente m
  USING maestro_agentes a
  WHERE m.agente_id = a.id
    AND m.user_id = OLD.movi_user_id
    AND a.vend_id = OLD.vend_id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_desenlace_sicas ON public.sicas_vendor_user_mappings;
CREATE TRIGGER trg_sync_desenlace_sicas
  AFTER UPDATE OF movi_user_id ON public.sicas_vendor_user_mappings
  FOR EACH ROW EXECUTE FUNCTION public.sync_desenlace_sicas();

-- ── Y borrar el mapeo de trámites suelta el enlace de SICAS ─────────────────
CREATE OR REPLACE FUNCTION public.sync_borrado_mapeo_agente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vend_id text;
BEGIN
  SELECT vend_id INTO v_vend_id FROM maestro_agentes WHERE id = OLD.agente_id;
  IF v_vend_id IS NULL THEN RETURN OLD; END IF;

  UPDATE sicas_vendor_user_mappings
  SET movi_user_id = NULL, updated_at = now()
  WHERE vend_id = v_vend_id AND movi_user_id = OLD.user_id;

  UPDATE usuarios SET id_sicas = NULL, nombre_sicas = NULL
  WHERE id = OLD.user_id AND id_sicas = v_vend_id;

  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_sync_borrado_mapeo_agente ON public.maestro_usuario_agente;
CREATE TRIGGER trg_sync_borrado_mapeo_agente
  AFTER DELETE ON public.maestro_usuario_agente
  FOR EACH ROW EXECUTE FUNCTION public.sync_borrado_mapeo_agente();
