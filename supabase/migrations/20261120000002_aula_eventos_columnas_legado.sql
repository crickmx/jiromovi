-- ============================================================================
-- Aula Virtual: aflojar las columnas heredadas de aula_eventos
--
-- El esquema original del calendario (antes de Daily) declaró `ponente`,
-- `descripcion` y `link_sesion` como NOT NULL. El flujo nuevo crea la clase
-- sin esos campos: el ponente se resuelve con aula_evento_hosts y el enlace de
-- la sala vive en daily_room_url. Sin esto, crear una clase falla con 23502.
--
-- `ponente` se sigue llenando desde la UI (la portada de Seguros Education la
-- muestra), pero ya no puede bloquear un insert.
-- ============================================================================

alter table public.aula_eventos alter column ponente     drop not null;
alter table public.aula_eventos alter column descripcion drop not null;
alter table public.aula_eventos alter column link_sesion drop not null;

-- La fecha/hora ya no son la fuente de verdad (fecha_inicio es timestamptz),
-- pero se siguen llenando para el calendario existente.
alter table public.aula_eventos alter column fecha set default current_date;
alter table public.aula_eventos alter column hora  set default '09:00:00'::time;