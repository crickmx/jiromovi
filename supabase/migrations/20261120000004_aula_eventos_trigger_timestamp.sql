-- ============================================================================
-- aula_eventos: quitar el trigger que rompía TODOS los updates
--
-- Había dos triggers de timestamp. Uno correcto (actualizar_modificado_en_…,
-- que escribe `modificado_en`) y otro roto (update_aula_eventos_timestamp,
-- que escribe `actualizado_en`, columna que no existe). El roto hacía que
-- cualquier UPDATE fallara con 42703 y, con los BEFORE triggers en orden
-- alfabético, ejecutaba después del bueno y tumbaba la operación.
--
-- Con esto se puede marcar una clase en vivo, finalizarla y guardar la sala.
-- ============================================================================

drop trigger if exists trigger_update_aula_eventos_timestamp on public.aula_eventos;
drop function if exists public.update_aula_eventos_timestamp();

-- Asegura que quede el trigger bueno.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.aula_eventos'::regclass
      and tgname = 'trigger_actualizar_modificado_en_aula_eventos'
  ) then
    create trigger trigger_actualizar_modificado_en_aula_eventos
      before update on public.aula_eventos
      for each row execute function public.actualizar_modificado_en_aula_eventos();
  end if;
end $$;