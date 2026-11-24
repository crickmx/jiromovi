-- Fase 1: Correcciones backend bloqueantes — catálogos de trámites
-- 1. CHECK constraint en tramite_tipo_campos.tipo (agregar dropdown, seleccion_multiple)
-- 2. ON DELETE SET NULL en tramite_respuestas.campo_id (+ hacer nullable)
-- 3. Índice en activo para ticket_tipos
-- 4. Columna categoria en ticket_tipos (useTiposTramite ya la referencia en SELECT)
-- cat_aseguradoras vs aseguradoras: son tablas distintas, no se consolidan aquí.
--   cat_aseguradoras = catálogo heredado (fallback en NuevoTramiteModal)
--   aseguradoras     = catálogo rico para Seguwallet/web pages
--   maestro_companias = fuente de verdad desde /admin/base-datos

-- =====================================================
-- 1. Re-aplicar CHECK constraint en tramite_tipo_campos.tipo (idempotente)
-- Fase 6 ya agregó dropdown/seleccion_multiple/aseguradora/etc.
-- Fase 7 ya agregó area/equipo/agente_vendedor/oficina_jiro/etc.
-- Este bloque simplemente lo re-aplica para garantizar consistencia.
-- =====================================================
ALTER TABLE public.tramite_tipo_campos
  DROP CONSTRAINT IF EXISTS tramite_tipo_campos_tipo_check;

ALTER TABLE public.tramite_tipo_campos
  ADD CONSTRAINT tramite_tipo_campos_tipo_check
  CHECK (tipo IN (
    'texto_corto', 'texto_largo', 'numerico', 'adjunto',
    'estatus', 'fecha', 'booleano',
    'dropdown', 'seleccion_multiple',
    'aseguradora', 'ramo', 'rfc', 'codigo_postal',
    'telefono', 'email', 'curp', 'porcentaje',
    'area', 'equipo', 'agente_vendedor', 'oficina_jiro',
    'fecha_creacion', 'fecha_finalizacion'
  ));

-- =====================================================
-- 2. ON DELETE SET NULL en tramite_respuestas.campo_id
--    Si se elimina un campo, la respuesta queda con campo_id = NULL
--    en lugar de bloquearse o cascadear. Requiere hacer la columna nullable.
-- =====================================================
ALTER TABLE public.tramite_respuestas
  ALTER COLUMN campo_id DROP NOT NULL;

ALTER TABLE public.tramite_respuestas
  DROP CONSTRAINT IF EXISTS tramite_respuestas_campo_id_fkey;

ALTER TABLE public.tramite_respuestas
  ADD CONSTRAINT tramite_respuestas_campo_id_fkey
  FOREIGN KEY (campo_id)
  REFERENCES public.tramite_tipo_campos(id)
  ON DELETE SET NULL;

-- =====================================================
-- 3. Índice parcial en activo para ticket_tipos
--    insurance_types ya tiene idx_insurance_types_activo (migración 20260312)
--    aseguradoras ya tiene idx_aseguradoras_activo (migración 20260312)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_ticket_tipos_activo
  ON public.ticket_tipos(activo) WHERE activo = true;

-- =====================================================
-- 4. Columna categoria en ticket_tipos
--    useTiposTramite.ts (línea 42) ya la selecciona; faltaba en el schema.
--    Valor null = sin categoría especial (backward compatible).
-- =====================================================
ALTER TABLE public.ticket_tipos
  ADD COLUMN IF NOT EXISTS categoria text;
