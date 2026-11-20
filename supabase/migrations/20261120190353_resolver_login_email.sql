-- Resolver el identificador de acceso (correo o celular) a una cuenta concreta.
--
-- Por qué existe: el login con contraseña resolvía el celular consultando
-- `usuarios` **con la llave anónima**, y eso no puede funcionar — la tabla no es
-- legible por `anon` (`42501 permission denied`). Además usaba
-- `.limit(1).maybeSingle()`, así que con un celular repetido (el 5520206922 está
-- en siete cuentas del equipo) elegía una al azar y el usuario validaba su
-- contraseña contra la cuenta de otra persona.
--
-- La función devuelve el correo **solo cuando hay exactamente una cuenta** con
-- ese dato; si hay varias devuelve `cuentas > 1` y sin correo, para que la
-- pantalla pida el correo electrónico en vez de adivinar. Nunca devuelve la
-- lista: no sirve para enumerar.
create or replace function public.resolver_login_email(p_identificador text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_raw    text := trim(coalesce(p_identificador, ''));
  v_digits text := regexp_replace(coalesce(p_identificador, ''), '\D', '', 'g');
  v_es_tel boolean;
  v_phone  text;
  v_total  integer := 0;
  v_email  text;
begin
  if v_raw = '' then
    return jsonb_build_object('email', null, 'cuentas', 0);
  end if;

  -- Mismo criterio que la pantalla: 10 dígitos o más y solo dígitos/símbolos de
  -- teléfono. Si trae una arroba, es correo.
  v_es_tel := position('@' in v_raw) = 0
    and length(v_digits) >= 10
    and regexp_replace(v_raw, '[\s\-+().]', '', 'g') ~ '^[0-9]+$';

  if not v_es_tel then
    select count(*), min(lower(email_laboral))
      into v_total, v_email
      from public.usuarios
     where lower(email_laboral) = lower(v_raw)
       and estado = 'activo'
       and deleted_at is null;
  else
    -- Últimos 10 dígitos: absorbe +52, 521 y espacios.
    v_phone := right(v_digits, 10);
    select count(*), min(lower(email_laboral))
      into v_total, v_email
      from public.usuarios
     where (celular_laboral like '%' || v_phone || '%'
         or celular_personal like '%' || v_phone || '%')
       and estado = 'activo'
       and deleted_at is null;
  end if;

  if v_total = 1 then
    return jsonb_build_object('email', v_email, 'cuentas', 1);
  end if;

  return jsonb_build_object('email', null, 'cuentas', v_total);
end;
$$;

revoke all on function public.resolver_login_email(text) from public;
grant execute on function public.resolver_login_email(text) to anon, authenticated;
