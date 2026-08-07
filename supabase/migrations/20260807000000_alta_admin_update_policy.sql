-- Panel /admin/altas: permite a Administradores actualizar altas (asignar
-- oficina, notas de revisión, cambiar estado). La lectura ya estaba abierta a
-- admins en la migración base del módulo. Aditivo, no toca nada existente.
drop policy if exists admin_update_alta_agente on alta_agente;
create policy admin_update_alta_agente on alta_agente
  for update to authenticated
  using (alta_es_admin(auth.uid()))
  with check (alta_es_admin(auth.uid()));
