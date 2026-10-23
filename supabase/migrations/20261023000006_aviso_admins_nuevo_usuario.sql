-- Nuevo usuario en MOVI → aviso a los Administradores por correo, WhatsApp,
-- campanita y push, para que lo revisen y lo autoricen
-- ==========================================================================
--
-- Un usuario nace por cinco caminos (create-user, bulk-create-users,
-- register-employee, alta-finalizar y cualquier insert a mano). Por eso el
-- aviso vive en un trigger de `usuarios` y no en cada edge function: un
-- arreglo por camino deja fuera al siguiente que alguien agregue.
--
-- Lo que había y por qué no avisaba:
--
--   · `trigger_notificar_equipos_nuevo_usuario` llamaba a
--     enviar_notificacion_completa('nuevo_usuario_creado') → notify(), que exige
--     el evento en `notification_events_catalog`. Ese renglón NO existe, así
--     que notify() devolvía "Event not found" y no encolaba nada. Cero jobs de
--     este evento en toda la historia de `notification_jobs`, mientras Admin ›
--     Transaccionales lo enseñaba activo con sus tres canales.
--   · Además solo le avisaba a la lista fija de la pantalla (hoy dos personas),
--     no a los Administradores.
--   · `trigger_notify_admins_new_user` sí llegaba a los Admins, pero solo con
--     campanita y solo si el usuario nacía con estado = 'pendiente'.
--   · Los dos enlazaban a `/usuario/<id>`, ruta que no existe: el perfil vive
--     en `/directorio/<id>`.
--
-- Ahora un solo trigger:
--   · Destinatarios: todos los Administradores activos (que no sean bots) MÁS
--     la lista que se configure en la pantalla para `nuevo_usuario_creado`.
--   · Canales: los de la pantalla (correo / WhatsApp / notificación). El push
--     va pegado a la campanita: es la misma alerta, en el teléfono.
--   · Correo y WhatsApp se encolan en `notification_jobs` y los manda el cron
--     `notification-dispatcher` con la plantilla de
--     `transactional_notification_templates` (la misma que edita la pantalla).
--   · Campanita directo a `notificaciones`; push por `send-push-notification`.
--
-- ⚠️ A propósito NO se agrega el evento a `notification_events_catalog`:
-- `register-employee` todavía llama a notify('nuevo_usuario_creado') con el
-- id del usuario NUEVO (no de los admins). Hoy esa llamada no hace nada porque
-- el evento no está en el catálogo; si se agregara, el recién registrado
-- recibiría el aviso interno. Por eso aquí no se usa notify().
--
-- La llave idempotente lleva el id del usuario nuevo: con una carga masiva,
-- dos altas en el mismo minuto son dos avisos, no uno.

begin;

-- `usuarios` está siempre en uso: sin esto el cambio de triggers se queda
-- esperando su candado y bloquea a todos detrás. Si falla, se vuelve a correr.
set local lock_timeout = '5s';

create or replace function public.avisar_admins_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tipo          record;
  v_oficina       text;
  v_creador       text;
  v_nombre        text;
  v_pendiente     boolean;
  v_estado_txt    text;
  v_titulo        text;
  v_mensaje       text;
  v_ruta          text;
  v_vars          jsonb;
  v_dest          record;
  v_email         text;
  v_phone         text;
  v_service_key   text;
begin
  select id, activo, enviar_correo, enviar_whatsapp, enviar_notificacion
    into v_tipo
    from correo_tipos_notificacion
   where codigo = 'nuevo_usuario_creado';

  -- Si alguien apagó el aviso entero en la pantalla, se respeta.
  if found and v_tipo.activo is false then
    return new;
  end if;

  select nombre into v_oficina from oficinas where id = new.oficina_id;
  v_oficina := coalesce(v_oficina, 'Sin oficina asignada');

  select nombre_completo into v_creador
    from usuarios where id = coalesce(new.created_by, auth.uid());
  v_creador := coalesce(v_creador, 'Registro / sistema');

  v_nombre    := trim(coalesce(new.nombre, '') || ' ' || coalesce(new.apellidos, ''));
  v_pendiente := coalesce(new.activo, true) = false or new.estado = 'pendiente';
  v_estado_txt := case when v_pendiente
                       then 'Pendiente de activación — requiere tu autorización'
                       else 'Ya está activo — revisa que sus datos sean correctos' end;
  v_ruta := '/directorio/' || new.id::text;

  v_titulo  := case when v_pendiente
                    then 'Nuevo usuario por autorizar'
                    else 'Nuevo usuario en MOVI' end;
  v_mensaje := v_nombre || ' (' || coalesce(new.rol, 'sin rol') || ') · ' || v_oficina
               || ' · ' || v_estado_txt;

  v_vars := jsonb_build_object(
    'usuario_nombre',        coalesce(new.nombre, ''),
    'usuario_apellidos',     coalesce(new.apellidos, ''),
    'usuario_email_laboral', coalesce(new.email_laboral, ''),
    'usuario_rol',           coalesce(new.rol, ''),
    'usuario_oficina',       v_oficina,
    'usuario_fecha_alta',    to_char(coalesce(new.created_at, now()) at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI'),
    'usuario_estado',        v_estado_txt,
    'creado_por',            v_creador,
    'link_usuario',          'https://app.movi.digital' || v_ruta,
    'url',                   'https://app.movi.digital' || v_ruta
  );

  select decrypted_secret into v_service_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  for v_dest in
    select distinct u.id, u.email_laboral, u.email_personal,
                    u.celular_laboral, u.celular_personal, u.nombre_completo
      from usuarios u
     where u.id <> new.id
       and u.estado = 'activo'
       and coalesce(u.activo, true)
       and coalesce(u.is_deleted, false) = false
       and u.deleted_at is null
       and coalesce(u.es_bot, false) = false
       and (
             u.rol = 'Administrador'
          or u.id in (select cdn.usuario_id
                        from correo_destinatarios_notificacion cdn
                       where cdn.tipo_notificacion_id = v_tipo.id)
       )
  loop
    begin
      v_email := coalesce(nullif(trim(v_dest.email_laboral), ''), nullif(trim(v_dest.email_personal), ''));
      v_phone := coalesce(nullif(trim(v_dest.celular_laboral), ''), nullif(trim(v_dest.celular_personal), ''));

      if coalesce(v_tipo.enviar_correo, true) and v_email is not null then
        insert into notification_jobs (event_code, user_id, channel, payload, status, idempotency_key)
        values ('nuevo_usuario_creado', v_dest.id, 'email',
                v_vars || jsonb_build_object('email', v_email, 'nombre_completo', v_dest.nombre_completo),
                'pending',
                'nuevo_usuario_creado_' || v_dest.id::text || '_' || new.id::text || '_email')
        on conflict (idempotency_key) do nothing;
      end if;

      if coalesce(v_tipo.enviar_whatsapp, true) and v_phone is not null then
        insert into notification_jobs (event_code, user_id, channel, payload, status, idempotency_key)
        values ('nuevo_usuario_creado', v_dest.id, 'whatsapp',
                v_vars || jsonb_build_object('phone', v_phone, 'nombre_completo', v_dest.nombre_completo),
                'pending',
                'nuevo_usuario_creado_' || v_dest.id::text || '_' || new.id::text || '_whatsapp')
        on conflict (idempotency_key) do nothing;
      end if;

      if coalesce(v_tipo.enviar_notificacion, true) then
        insert into notificaciones (usuario_id, titulo, mensaje, tipo, modulo, url, accion_url, leida, tipo_codigo, prioridad)
        values (v_dest.id, v_titulo, v_mensaje, 'nuevo_usuario_creado', 'usuarios',
                v_ruta, v_ruta, false, 'nuevo_usuario_creado',
                case when v_pendiente then 'alta' else 'normal' end);

        -- Push al teléfono. net.http_post solo encola: no detiene el insert.
        if v_service_key is not null then
          perform net.http_post(
            url     := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/send-push-notification',
            headers := jsonb_build_object('Content-Type', 'application/json',
                                          'Authorization', 'Bearer ' || v_service_key),
            body    := jsonb_build_object('usuario_id', v_dest.id,
                                          'title', v_titulo,
                                          'body', v_mensaje,
                                          'url', v_ruta,
                                          'tag', 'nuevo-usuario-' || new.id::text)
          );
        end if;
      end if;
    exception when others then
      -- Un aviso que falla nunca debe impedir que el usuario se cree.
      raise warning '[avisar_admins_nuevo_usuario] destinatario %: %', v_dest.id, sqlerrm;
    end;
  end loop;

  return new;
exception when others then
  raise warning '[avisar_admins_nuevo_usuario] usuario %: %', new.id, sqlerrm;
  return new;
end;
$function$;

-- Los dos triggers viejos se apagan (no se borran: reversa de una línea): uno
-- no mandaba nada y el otro duplicaría la campanita.
alter table public.usuarios disable trigger trigger_notificar_equipos_nuevo_usuario;
alter table public.usuarios disable trigger trigger_notify_admins_new_user;

create or replace trigger trigger_avisar_admins_nuevo_usuario
  after insert on public.usuarios
  for each row execute function public.avisar_admins_nuevo_usuario();

-- La plantilla de la pantalla: dice si hay que autorizar y enlaza a la ruta real.
update public.transactional_notification_templates set
  name                   = 'Nuevo Usuario Creado (aviso a Administradores)',
  email_subject_template = 'Nuevo usuario en MOVI: {{usuario_nombre}} {{usuario_apellidos}}',
  email_body_template    = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #2563eb;">Nuevo usuario en MOVI Digital</h2>
<p>Se dio de alta un usuario nuevo. Revísalo y, si corresponde, autorízalo.</p>
<div style="background: #fef3c7; padding: 12px 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
<strong>{{usuario_estado}}</strong>
</div>
<div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
<p><strong>Nombre:</strong> {{usuario_nombre}} {{usuario_apellidos}}</p>
<p><strong>Email:</strong> {{usuario_email_laboral}}</p>
<p><strong>Rol:</strong> {{usuario_rol}}</p>
<p><strong>Oficina:</strong> {{usuario_oficina}}</p>
<p><strong>Fecha de alta:</strong> {{usuario_fecha_alta}}</p>
<p><strong>Creado por:</strong> {{creado_por}}</p>
</div>
<p>
<a href="{{link_usuario}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
Revisar usuario
</a>
</p>
<p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
Correo automático de MOVI Digital.
</p>
</div>',
  whatsapp_body_template = '🆕 *Nuevo usuario en MOVI*

*Nombre:* {{usuario_nombre}} {{usuario_apellidos}}
*Rol:* {{usuario_rol}}
*Oficina:* {{usuario_oficina}}
*Email:* {{usuario_email_laboral}}
*Creado por:* {{creado_por}}

⚠️ {{usuario_estado}}

Revisar: {{link_usuario}}

_MOVI Digital_',
  inapp_title_template   = 'Nuevo usuario en MOVI',
  inapp_body_template    = '{{usuario_nombre}} {{usuario_apellidos}} ({{usuario_rol}}) · {{usuario_oficina}} · {{usuario_estado}}',
  is_active              = true,
  updated_at             = now()
where event_key = 'nuevo_usuario_creado';

update public.correo_tipos_notificacion set
  descripcion = 'Avisa a los Administradores (más la lista de esta pantalla) cada vez que se crea un usuario en MOVI, por cualquier camino, para que lo revisen y autoricen. El push va junto con la notificación.',
  updated_at  = now()
where codigo = 'nuevo_usuario_creado';

commit;

-- Verificación:
--   select tgname, tgenabled from pg_trigger where tgrelid = 'public.usuarios'::regclass
--    and (tgname like '%nuevo_usuario%' or tgname = 'trigger_notify_admins_new_user');
--   → trigger_avisar_admins_nuevo_usuario en 'O'; los dos viejos en 'D'.
--
-- Reversa:
--   alter table public.usuarios disable trigger trigger_avisar_admins_nuevo_usuario;
--   alter table public.usuarios enable trigger trigger_notificar_equipos_nuevo_usuario;
--   alter table public.usuarios enable trigger trigger_notify_admins_new_user;
