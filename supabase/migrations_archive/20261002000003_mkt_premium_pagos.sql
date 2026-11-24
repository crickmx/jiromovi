-- Historial de pagos del Plan Premium, con bitácora que no se puede borrar.
--
-- Hasta ahora de un Premium solo se guardaba el método de pago y una fecha de
-- renovación en la ficha del agente: no había forma de saber si pagó, cuánto
-- lleva pagado ni quién lo registró. MOVI Store sí lo tiene (`store_pedido_pagos`)
-- y este es su espejo, con dos diferencias pedidas por Ricardo:
--
--   1. Un Administrador puede corregir o borrar cualquier pago. En Store solo
--      puede quien lo capturó —ni un Admin puede arreglar el error de otro—, y
--      eso se corrige aquí desde el principio.
--   2. Toda acción queda en una bitácora **que nadie puede borrar ni editar**,
--      para revisiones futuras.
--
-- La bitácora la escribe un trigger de la base, no la aplicación: si dependiera
-- del frontend, bastaría con una pantalla nueva que olvidara llamarlo para que
-- un movimiento quedara sin registrar.

-- ─── Pagos ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mkt_premium_pagos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  metodo          text NOT NULL,
  monto           numeric(12,2) NOT NULL CHECK (monto > 0),
  comentario      text NOT NULL DEFAULT '',
  registrado_por  uuid REFERENCES public.usuarios(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_premium_pagos_usuario
  ON public.mkt_premium_pagos(usuario_id, fecha DESC);

ALTER TABLE public.mkt_premium_pagos ENABLE ROW LEVEL SECURITY;

-- Quién administra Marketing: Administrador o miembro de un equipo con acceso.
-- SECURITY DEFINER para que la subconsulta no quede sujeta al RLS de las tablas
-- que consulta — el mismo patrón que `get_my_grupo_ids()`.
CREATE OR REPLACE FUNCTION public.mkt_puede_administrar()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
      OR EXISTS (
        SELECT 1 FROM tramites_grupos_miembros m
        JOIN mkt_equipos_acceso a ON a.grupo_id = m.grupo_id
        WHERE m.usuario_id = auth.uid()
      );
$$;

DROP POLICY IF EXISTS "mkt_premium_pagos_select" ON public.mkt_premium_pagos;
CREATE POLICY "mkt_premium_pagos_select" ON public.mkt_premium_pagos
  FOR SELECT TO authenticated
  -- Cada quien ve sus propios pagos; quien administra, todos.
  USING (usuario_id = auth.uid() OR public.mkt_puede_administrar());

DROP POLICY IF EXISTS "mkt_premium_pagos_insert" ON public.mkt_premium_pagos;
CREATE POLICY "mkt_premium_pagos_insert" ON public.mkt_premium_pagos
  FOR INSERT TO authenticated
  WITH CHECK (public.mkt_puede_administrar() AND registrado_por = auth.uid());

-- Aquí está la diferencia con Store: no se exige haber sido quien lo capturó.
DROP POLICY IF EXISTS "mkt_premium_pagos_update" ON public.mkt_premium_pagos;
CREATE POLICY "mkt_premium_pagos_update" ON public.mkt_premium_pagos
  FOR UPDATE TO authenticated
  USING (public.mkt_puede_administrar()) WITH CHECK (public.mkt_puede_administrar());

DROP POLICY IF EXISTS "mkt_premium_pagos_delete" ON public.mkt_premium_pagos;
CREATE POLICY "mkt_premium_pagos_delete" ON public.mkt_premium_pagos
  FOR DELETE TO authenticated
  USING (public.mkt_puede_administrar());

-- ─── Bitácora ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mkt_premium_pagos_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A PROPÓSITO sin llave foránea: si la tuviera, borrar un pago se llevaría su
  -- rastro por delante (o impediría el borrado). El log tiene que sobrevivir a
  -- lo que registra.
  pago_id       uuid NOT NULL,
  usuario_id    uuid,
  accion        text NOT NULL CHECK (accion IN ('alta', 'edicion', 'baja')),
  datos_antes   jsonb,
  datos_despues jsonb,
  hecho_por     uuid,
  hecho_en      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_premium_pagos_log_pago
  ON public.mkt_premium_pagos_log(pago_id, hecho_en DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_premium_pagos_log_usuario
  ON public.mkt_premium_pagos_log(usuario_id, hecho_en DESC);

ALTER TABLE public.mkt_premium_pagos_log ENABLE ROW LEVEL SECURITY;

-- Solo lectura, y solo para quien administra. **No se declara ninguna política
-- de INSERT/UPDATE/DELETE**: con RLS activo y sin políticas, nadie autenticado
-- puede escribir aquí. El único que escribe es el trigger de abajo.
DROP POLICY IF EXISTS "mkt_premium_pagos_log_select" ON public.mkt_premium_pagos_log;
CREATE POLICY "mkt_premium_pagos_log_select" ON public.mkt_premium_pagos_log
  FOR SELECT TO authenticated USING (public.mkt_puede_administrar());

-- Segundo candado, para lo que RLS no alcanza: `service_role` y el dueño de la
-- tabla sí la saltan. Esto bloquea el borrado y la edición venga de donde venga.
CREATE OR REPLACE FUNCTION public.mkt_premium_pagos_log_inmutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de pagos Premium es de solo lectura: no se puede % una entrada.', lower(TG_OP);
END $$;

DROP TRIGGER IF EXISTS trg_mkt_premium_pagos_log_inmutable ON public.mkt_premium_pagos_log;
CREATE TRIGGER trg_mkt_premium_pagos_log_inmutable
  BEFORE UPDATE OR DELETE ON public.mkt_premium_pagos_log
  FOR EACH ROW EXECUTE FUNCTION public.mkt_premium_pagos_log_inmutable();

-- ─── El trigger que llena la bitácora ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_premium_pagos_bitacora()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO mkt_premium_pagos_log (pago_id, usuario_id, accion, datos_despues, hecho_por)
    VALUES (NEW.id, NEW.usuario_id, 'alta', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO mkt_premium_pagos_log (pago_id, usuario_id, accion, datos_antes, datos_despues, hecho_por)
    VALUES (NEW.id, NEW.usuario_id, 'edicion', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSE
    INSERT INTO mkt_premium_pagos_log (pago_id, usuario_id, accion, datos_antes, hecho_por)
    VALUES (OLD.id, OLD.usuario_id, 'baja', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_mkt_premium_pagos_bitacora ON public.mkt_premium_pagos;
CREATE TRIGGER trg_mkt_premium_pagos_bitacora
  AFTER INSERT OR UPDATE ON public.mkt_premium_pagos
  FOR EACH ROW EXECUTE FUNCTION public.mkt_premium_pagos_bitacora();

-- El borrado va en BEFORE: en AFTER la fila ya no existe para leerla.
DROP TRIGGER IF EXISTS trg_mkt_premium_pagos_bitacora_baja ON public.mkt_premium_pagos;
CREATE TRIGGER trg_mkt_premium_pagos_bitacora_baja
  BEFORE DELETE ON public.mkt_premium_pagos
  FOR EACH ROW EXECUTE FUNCTION public.mkt_premium_pagos_bitacora();

COMMENT ON TABLE public.mkt_premium_pagos_log IS
  'Bitácora de solo escritura de los pagos Premium. La llena un trigger, no la aplicación; un trigger extra impide editarla o borrarla incluso saltándose RLS.';
