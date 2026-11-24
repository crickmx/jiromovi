/*
  # Fase 1 — Correcciones de backend bloqueantes

  1. CHECK constraint de tramite_tipo_campos.tipo actualizado para incluir
     dropdown y seleccion_multiple (existían en frontend pero no en BD).

  2. FK tramite_respuestas.campo_id cambia de RESTRICT implícito a SET NULL,
     permitiendo eliminar campos aunque tengan respuestas históricas.

  3. Índices en columna activo para insurance_types y ticket_tipos
     (todas las queries filtran activo=true, hoy son full scans).

  4. Columna categoria en ticket_tipos reemplaza el objeto TIPO_TRAMITE_CATEGORIA
     hardcodeado en el frontend. Permite que tipos custom hereden comportamiento
     correcto de filtrado de estatus.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CHECK constraint de tramite_tipo_campos.tipo
--    Antes:  texto_corto, texto_largo, numerico, adjunto, estatus, fecha, booleano
--    Ahora:  + dropdown, seleccion_multiple
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tramite_tipo_campos
  DROP   CONSTRAINT IF EXISTS tramite_tipo_campos_tipo_check,
  ADD    CONSTRAINT tramite_tipo_campos_tipo_check CHECK (tipo IN (
    'texto_corto',
    'texto_largo',
    'numerico',
    'adjunto',
    'estatus',
    'fecha',
    'booleano',
    'dropdown',
    'seleccion_multiple'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FK tramite_respuestas.campo_id → ON DELETE SET NULL
--    El código ya distingue entre hard-delete (sin respuestas) y soft-delete
--    (con respuestas). Con SET NULL podemos eliminar campos y conservar el
--    historial de respuestas (campo_id quedará NULL en registros viejos).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tramite_respuestas
  DROP   CONSTRAINT IF EXISTS tramite_respuestas_campo_id_fkey,
  ADD    CONSTRAINT tramite_respuestas_campo_id_fkey
    FOREIGN KEY (campo_id) REFERENCES public.tramite_tipo_campos(id)
    ON DELETE SET NULL;

-- campo_id ya no puede ser NOT NULL si queremos permitir NULL tras borrar el campo
ALTER TABLE public.tramite_respuestas
  ALTER COLUMN campo_id DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Índices en activo
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_insurance_types_activo
  ON public.insurance_types(activo);

CREATE INDEX IF NOT EXISTS idx_ticket_tipos_activo
  ON public.ticket_tipos(activo);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Columna categoria en ticket_tipos
--    Reemplaza TIPO_TRAMITE_CATEGORIA hardcodeado en TramiteDetalle.tsx.
--    Determina qué estatus son compatibles con el tipo de trámite.
--
--    Valores posibles (mismos que ticket_estatus.tipo_aplicable):
--      'general'              → estatus genéricos
--      'cotizacion_emision'   → estatus específicos de cotización
--      'solicitud_comisiones' → estatus de comisiones
--      'cambio_bancario'      → estatus de cambio bancario
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ticket_tipos
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'general';

-- Poblar con el mapeo que antes estaba hardcodeado en el frontend
UPDATE public.ticket_tipos
   SET categoria = 'cotizacion_emision'
 WHERE value IN ('cotizacion_emision', 'formulario_cotizacion');

UPDATE public.ticket_tipos
   SET categoria = 'solicitud_comisiones'
 WHERE value = 'solicitud_comisiones_pendientes';

UPDATE public.ticket_tipos
   SET categoria = 'cambio_bancario'
 WHERE value = 'cambio_bancario';

-- Todos los demás quedan con DEFAULT 'general' (ya está por defecto)
-- correccion_poliza_endoso, correccion_poliza_registrada, correccion_comisiones,
-- registro_poliza, lead_registro_movi, renovaciones, cobranza,
-- otros_comercial, cancelacion_poliza → general

-- Índice para filtrar por categoria (usado en loadEstatus)
CREATE INDEX IF NOT EXISTS idx_ticket_tipos_categoria
  ON public.ticket_tipos(categoria);
