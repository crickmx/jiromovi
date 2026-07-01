-- Fase 8: Campos de formulario configurables desde el Form Builder
-- prioridad, descripcion, asignado_a, fecha_promesa_entrega, archivos_adjuntos
-- Ahora el admin puede mostrar/ocultar, reordenar y marcar como obligatorio cada uno.

-- 1. Extender CHECK constraint de tramite_tipo_campos.tipo
ALTER TABLE public.tramite_tipo_campos DROP CONSTRAINT IF EXISTS tramite_tipo_campos_tipo_check;
ALTER TABLE public.tramite_tipo_campos ADD CONSTRAINT tramite_tipo_campos_tipo_check
  CHECK (tipo IN (
    'texto_corto','texto_largo','numerico','adjunto','estatus','fecha','booleano',
    'dropdown','seleccion_multiple','aseguradora','ramo','rfc','codigo_postal',
    'telefono','email','curp','porcentaje',
    'area','equipo','agente_vendedor','oficina_jiro','fecha_creacion','fecha_finalizacion',
    'prioridad','descripcion','asignado_a','fecha_promesa_entrega','archivos_adjuntos'
  ));

-- 2. Backfill: insertar los 5 nuevos campos sistema en todos los tipos activos existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.ticket_tipos WHERE activo = true LOOP
    PERFORM public.ensure_sistema_campo(r.id, 'asignado_a',            'Asignar a',                'asignado_a',            80,  '{}'::jsonb, 'asignado_a');
    PERFORM public.ensure_sistema_campo(r.id, 'prioridad',             'Prioridad',                'prioridad',             85,  '{}'::jsonb, 'prioridad');
    PERFORM public.ensure_sistema_campo(r.id, 'descripcion',           'Descripción / Notas',      'descripcion',           100, '{}'::jsonb, 'descripcion');
    PERFORM public.ensure_sistema_campo(r.id, 'fecha_promesa_entrega', 'Fecha Promesa de Entrega', 'fecha_promesa_entrega', 110, '{}'::jsonb, 'fecha_promesa_entrega');
    PERFORM public.ensure_sistema_campo(r.id, 'archivos_adjuntos',     'Archivos Adjuntos',        'archivos_adjuntos',     120, '{}'::jsonb, 'archivos_adjuntos');
  END LOOP;
END;
$$;

-- 3. Actualizar create_all_sistema_campos para que tipos futuros también los incluyan
CREATE OR REPLACE FUNCTION public.create_all_sistema_campos(p_tipo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Campos fijos (siempre presentes, no movibles)
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'area',                'Área',                     'area',                  -7, '{}'::jsonb, 'area');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'equipo',              'Equipo',                   'equipo',                -6, '{}'::jsonb, 'equipo');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'estatus_tramite',     'Estatus',                  'estatus',               -5,
    '{"opciones":[{"label":"Iniciado","slug":"iniciado","clasificacion":"inicio"},{"label":"Terminado","slug":"terminado","clasificacion":"terminacion"}]}'::jsonb,
    'estatus');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'agente_vendedor',     'Agente / Vendedor',        'agente_vendedor',       -4, '{}'::jsonb, 'agente_vendedor');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'oficina_jiro',        'Oficina Jiro',             'oficina_jiro',          -3, '{}'::jsonb, 'oficina_jiro');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'fecha_creacion',      'Fecha de Creación',        'fecha_creacion',        -2, '{}'::jsonb, 'fecha_creacion');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'fecha_finalizacion',  'Fecha de Finalización',    'fecha_finalizacion',    -1, '{}'::jsonb, 'fecha_finalizacion');
  -- Campos configurables (el admin puede reordenar, ocultar, marcar como obligatorio)
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'asignado_a',          'Asignar a',                'asignado_a',            80, '{}'::jsonb, 'asignado_a');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'prioridad',           'Prioridad',                'prioridad',             85, '{}'::jsonb, 'prioridad');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'descripcion',         'Descripción / Notas',      'descripcion',           100,'{}'::jsonb, 'descripcion');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'fecha_promesa_entrega','Fecha Promesa de Entrega','fecha_promesa_entrega', 110,'{}'::jsonb, 'fecha_promesa_entrega');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'archivos_adjuntos',   'Archivos Adjuntos',        'archivos_adjuntos',     120,'{}'::jsonb, 'archivos_adjuntos');
END;
$$;
