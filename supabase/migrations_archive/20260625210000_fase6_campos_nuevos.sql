-- Fase 6: nuevos tipos de campo en tramite_tipo_campos
-- Actualiza CHECK constraint e incluye tabla codigos_postales

-- ── Actualizar constraint tipo ────────────────────────────────────────────
ALTER TABLE public.tramite_tipo_campos
  DROP CONSTRAINT IF EXISTS tramite_tipo_campos_tipo_check;

ALTER TABLE public.tramite_tipo_campos
  ADD CONSTRAINT tramite_tipo_campos_tipo_check
  CHECK (tipo IN (
    'texto_corto', 'texto_largo', 'numerico', 'adjunto',
    'estatus', 'fecha', 'booleano', 'dropdown', 'seleccion_multiple',
    'aseguradora', 'ramo', 'rfc', 'codigo_postal',
    'telefono', 'email', 'curp', 'porcentaje'
  ));

-- ── Tabla de códigos postales ─────────────────────────────────────────────
-- El admin importa el catálogo desde BaseDatosMaestrosAdmin (/admin/base-datos)
CREATE TABLE IF NOT EXISTS public.codigos_postales (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo    text NOT NULL,
  colonia   text NOT NULL,
  municipio text NOT NULL,
  estado    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_codigo ON public.codigos_postales(codigo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_unique ON public.codigos_postales(codigo, colonia);

ALTER TABLE public.codigos_postales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_cp_select" ON public.codigos_postales
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_cp_write" ON public.codigos_postales
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'Administrador'));
