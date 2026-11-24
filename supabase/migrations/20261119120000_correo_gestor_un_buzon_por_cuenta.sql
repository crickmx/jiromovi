-- Un buzón, una sola cuenta de MOVI.
--
-- El gestor de correo no guarda los mensajes en la base: cada acción abre una
-- conexión IMAP contra el buzón de la persona y la cierra al terminar. Si dos
-- cuentas de MOVI apuntan al MISMO correo, el gestor abre el doble de sesiones
-- contra un solo buzón, y IONOS limita las conexiones simultáneas por buzón
-- ("too many connections"): el segundo en entrar empieza a ver errores que no
-- tienen nada que ver con lo que estaba haciendo.
--
-- Hasta ahora la unicidad vivía solo en `usuario_id` (una cuenta por persona),
-- así que nada impedía que dos filas apuntaran al mismo `email`.
--
-- Comprobado antes de escribirlo: 9 filas, 9 correos distintos, 0 duplicados.

do $$
declare
  duplicados text;
begin
  select string_agg(format('%s (%s veces)', correo, veces), ', ')
    into duplicados
    from (
      select lower(email) as correo, count(*) as veces
        from public.email_configuraciones
       where email is not null
       group by 1
      having count(*) > 1
    ) d;

  if duplicados is not null then
    raise exception
      'Hay correos configurados por más de una cuenta: %. Resuélvelo antes de correr esta migración.',
      duplicados;
  end if;
end $$;

-- Sobre `lower(email)`: el correo no distingue mayúsculas, y en la base viva
-- conviven `DGJIMENEZ@JIRO.MX` y `djimenez@jiro.mx` (dos personas distintas).
-- El índice compara en minúsculas para que `A@x.mx` y `a@x.mx` no puedan
-- quedar en cuentas diferentes.
create unique index if not exists email_configuraciones_email_unico
  on public.email_configuraciones (lower(email));

comment on index public.email_configuraciones_email_unico is
  'Un buzón solo puede estar configurado en una cuenta: evita duplicar las conexiones IMAP contra el mismo buzón.';
