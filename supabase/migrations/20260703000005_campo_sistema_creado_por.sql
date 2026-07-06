-- Nuevo campo sistema fijo "Trámite Creado Por": distinto del solicitante
-- (agente_vendedor). Se llena automaticamente con quien crea el tramite
-- (ejecutivo/empleado/gerente/admin), no editable despues. El dato ya
-- existia siempre en tickets.creado_por -- aqui se expone como campo de
-- FormBuilder y se backfillea el historico completo.

-- 1. Extender CHECK constraint de tramite_tipo_campos.tipo
ALTER TABLE public.tramite_tipo_campos DROP CONSTRAINT IF EXISTS tramite_tipo_campos_tipo_check;
ALTER TABLE public.tramite_tipo_campos ADD CONSTRAINT tramite_tipo_campos_tipo_check
  CHECK (tipo IN (
    'texto_corto','texto_largo','numerico','adjunto','estatus','fecha','booleano',
    'dropdown','seleccion_multiple','aseguradora','ramo','rfc','codigo_postal',
    'telefono','email','curp','porcentaje',
    'area','equipo','agente_vendedor','oficina_jiro','fecha_creacion','fecha_finalizacion','creado_por',
    'prioridad','descripcion','asignado_a','fecha_promesa_entrega','archivos_adjuntos'
  ));

-- 2. Actualizar create_all_sistema_campos para que tipos futuros tambien lo incluyan
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
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'creado_por',          'Trámite Creado Por',       'creado_por',             0, '{}'::jsonb, 'creado_por');
  -- Campos configurables (el admin puede reordenar, ocultar, marcar como obligatorio)
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'asignado_a',          'Asignar a',                'asignado_a',            80, '{}'::jsonb, 'asignado_a');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'prioridad',           'Prioridad',                'prioridad',             85, '{}'::jsonb, 'prioridad');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'descripcion',         'Descripción / Notas',      'descripcion',           100,'{}'::jsonb, 'descripcion');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'fecha_promesa_entrega','Fecha Promesa de Entrega','fecha_promesa_entrega', 110,'{}'::jsonb, 'fecha_promesa_entrega');
  PERFORM public.ensure_sistema_campo(p_tipo_id, 'archivos_adjuntos',   'Archivos Adjuntos',        'archivos_adjuntos',     120,'{}'::jsonb, 'archivos_adjuntos');
END;
$$;

-- 3. Backfill: insertar el campo 'creado_por' en TODOS los tipos existentes
--    (activos e inactivos, igual que los otros 6 campos fijos de Fase 7)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.ticket_tipos LOOP
    PERFORM public.ensure_sistema_campo(r.id, 'creado_por', 'Trámite Creado Por', 'creado_por', 0, '{}'::jsonb, 'creado_por');
  END LOOP;
END;
$$;

-- 4. Backfill del valor historico: tickets.creado_por siempre existio, asi que
--    se puede reconstruir la respuesta para TODOS los tramites ya creados
--    (no solo los nuevos), en vez de dejar "Sin registrar" en el historico.
INSERT INTO public.tramite_respuestas (tramite_id, campo_id, valor_texto)
SELECT t.id, tc.id, COALESCE(u.nombre_completo, u.nombre)
FROM public.tickets t
JOIN public.ticket_tipos tt ON tt.value = t.tipo_tramite
JOIN public.tramite_tipo_campos tc ON tc.tramite_tipo_id = tt.id AND tc.sistema_key = 'creado_por'
JOIN public.usuarios u ON u.id = t.creado_por
WHERE NOT EXISTS (
  SELECT 1 FROM public.tramite_respuestas tr
  WHERE tr.tramite_id = t.id AND tr.campo_id = tc.id
);
