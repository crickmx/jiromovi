revoke select on public.multi_autos_aseguradoras from authenticated;
grant select (id, nombre, color, tipo_api, endpoint_url, endpoint_desc, derecho_poliza, factor_base, disponible, configuracion, created_at, updated_at) on public.multi_autos_aseguradoras to authenticated;
revoke select on public.meetings from authenticated;
grant select (id, room_id, host_id, titulo, descripcion, fecha_inicio, fecha_fin, estado, created_at, updated_at, max_participantes, grabacion_activa, grabacion_url, configuracion) on public.meetings to authenticated;
