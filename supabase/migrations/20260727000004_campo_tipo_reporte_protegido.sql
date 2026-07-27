-- Agrega 'reporte_protegido' al CHECK constraint de tramite_tipo_campos.tipo
ALTER TABLE public.tramite_tipo_campos
  DROP CONSTRAINT IF EXISTS tramite_tipo_campos_tipo_check;

ALTER TABLE public.tramite_tipo_campos
  ADD CONSTRAINT tramite_tipo_campos_tipo_check CHECK (tipo IN (
    'texto_corto','texto_largo','numerico','adjunto','estatus','fecha','booleano',
    'dropdown','seleccion_multiple','aseguradora','ramo','rfc','codigo_postal',
    'telefono','email','curp','porcentaje',
    'area','equipo','agente_vendedor','oficina_jiro','fecha_creacion','fecha_finalizacion','creado_por',
    'prioridad','descripcion','asignado_a','fecha_promesa_entrega','archivos_adjuntos',
    'reporte_protegido'
  ));
