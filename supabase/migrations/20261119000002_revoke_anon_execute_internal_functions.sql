-- 20261119000002_revoke_anon_execute_internal_functions.sql
--
-- Contexto: 33 funciones SECURITY DEFINER de `public`/`private` son ejecutables por `anon`.
-- La mayoría lo son A PROPÓSITO (store público, catálogo de vehículos, agenda pública, páginas
-- públicas de agentes). Este cambio NO las toca: revocarlas rompería páginas públicas.
--
-- Solo se revoca en las tres funciones INTERNAS que:
--   · no las llama ningún archivo de src/ ni de supabase/functions,
--   · no aparecen en ninguna política RLS,
--   · para anon no aportan nada legítimo y sí permiten leer estado de cuentas / datos de personas
--     a partir de un id arbitrario.
--
-- Evidencia (19 nov 2026, rol supabase_read_only_user):
--   select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), coalesce(p.proacl::text,'(PUBLIC)')
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')
--     and p.proname ~ 'user|admin|login|logo|brand|oficina|rol|role';
--
--   private.cleanup_tramite_relationships_on_role_change()  ACL (PUBLIC)      → es función de TRIGGER
--   public.check_user_can_login(uuid)                       ACL =X + por rol  → expone estado de cuenta por id
--   public.get_logo_info(uuid)                               ACL =X + por rol  → expone datos de una persona por id
--
-- Revisado también: get_logo_info y check_user_can_login NO se usan en ninguna política RLS ni trigger
-- (consulta sobre pg_policy/pg_trigger). El trigger `cleanup_tramite_relationships_on_role_change_on_usuarios`
-- sigue funcionando: los triggers se ejecutan con los privilegios del dueño de la tabla, no requieren
-- EXECUTE del usuario que dispara.
--
-- Qué NO se revoca aquí, y por qué:
--   · get_effective_user_logo / get_agent_brand_config / get_agent_brand_for_seguwallet: las usan las
--     páginas públicas de los agentes (1-2 archivos del front). Necesitan rate limiting, no revocación.
--   · get_my_rol / get_current_user_role / get_auth_user_role / is_admin_or_manager / get_my_oficina_id /
--     get_current_user_oficina: get_my_rol aparece dentro de varias políticas RLS; para anon devuelven
--     NULL/false, así que revocarlas no aporta seguridad y sí puede romper políticas.
--   · store_oficinas_publicas / catalogo_vehiculos_opciones / oficina_tiene_pagina_publicada: públicas
--     por diseño.
--
-- Rollback:
--   grant execute on function private.cleanup_tramite_relationships_on_role_change() to public;
--   grant execute on function public.check_user_can_login(uuid) to public;
--   grant execute on function public.get_logo_info(uuid) to public;

begin;

revoke execute on function private.cleanup_tramite_relationships_on_role_change() from public, anon;
revoke execute on function public.check_user_can_login(uuid) from public, anon;
revoke execute on function public.get_logo_info(uuid) from public, anon;

commit;
