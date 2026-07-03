# jiromovi — instrucciones para Claude Code

## ⚠️ Patrón recurrente: "acceso por equipo" que solo llega a RLS, nunca al frontend
Se ha repetido 3 veces (permisos de trámites, líder de equipo, y `store_equipos_acceso` el 2026-07-03): alguien agrega una tabla + política RLS para dar acceso a un equipo/grupo, pero **ninguna pantalla del frontend la consulta** — las páginas siguen usando solo un chequeo de rol simple (`rol === 'Administrador'`, `tienePermisoAdminEnModulo`, etc.). RLS deja pasar los datos, pero la UI nunca llega a pedirlos (redirige antes, o cuenta mal en un badge/notificación).
**Antes de asumir "el fix de código está mal" o "falta correr una migración"**: buscar si existe una tabla nueva de acceso-por-equipo (`*_equipos_acceso`, `*_grupos_miembros`, etc.) y verificar con `grep` si algún componente de página la usa además de RLS. Si solo aparece en el admin panel que la configura y en una migración de RLS, ese es el bug.

## Git / Deploy
- **Siempre pushear a `origin/produccion`** — Plesk despliega desde esa rama.
- Rama local activa: `FUSION!!!` (trackea `origin/main` por defecto — ignorar).
- **Comando correcto:** `git push origin HEAD:produccion`
- Nunca solo `git push` ni `git push origin HEAD:main` — los cambios no llegarán al servidor.

## Stack
- React 18 + TypeScript + Vite + Tailwind CSS
- Supabase (PostgreSQL + RLS + Edge Functions)
- Repo: https://github.com/crickmx/jiromovi · Deploy: Plesk

## Glosario de roles — NO CONFUNDIR (causó un bug real el 2026-07-02)
Hay dos sistemas de rol independientes que conviven en Trámites:

| | Tabla / columna | Valores | Alcance |
|---|---|---|---|
| **Rol de sistema** (global) | `usuarios.rol` | Administrador, Gerente, Empleado, **Agente** | Toda la plataforma MOVI. `Agente` aquí = **cliente externo** — debe ver solo lo que él mismo solicitó. |
| **Rol de equipo** (solo Trámites) | `tramites_grupos_miembros.rol_en_equipo` | **lider**, **ejecutivo**, miembro | Dentro de un equipo específico. Líder ve todo lo del equipo; Ejecutivo ve lo suyo + el pool sin asignar del equipo. |

Son **ejes independientes**: cualquier combinación es válida (un Empleado o un Gerente pueden ser líder de un equipo). En código, las variables usan el prefijo `esRolSistema*` (`esRolSistemaAdmin/Gerente/Agente`) vs `esLiderDe*`/`rol_en_equipo` para distinguirlos a simple vista — ver `src/pages/Tramites.tsx` alrededor de `visibleTramites` para el patrón. **Nunca asumir que un chequeo de rol de sistema determina el rol de equipo, ni viceversa** — el bug de "líder no ve los trámites de su equipo" (2026-07-02) fue exactamente eso: el corte por rol de sistema `Agente` se evaluaba antes que el chequeo de líder de equipo.

## ⚠️ RLS de `tickets` puede estar DESINCRONIZADA de las migraciones del repo
El 2026-07-03 se descubrió que la política activa en producción, **`tickets_select_v6`**, y su función auxiliar **`get_my_grupo_ids()`**, fueron creadas directamente en el SQL Editor de Supabase — **no existen en ningún archivo de `supabase/migrations/`**. Reemplazaron a `tickets_select_v4` (la última versión que sí estaba en el repo) y en el camino **eliminaron silenciosamente** la cláusula que dejaba a un líder de equipo ver todos los trámites asignados de su equipo (v6 solo dejaba ver el *pool sin asignar*, igual que cualquier miembro).

**Lección**: si un fix de código para `Tramites.tsx`/visibilidad no funciona pese a que el código, los datos y la lógica se ven correctos, **verificar la política RLS real en producción antes que nada**:
```sql
select policyname, cmd, qual from pg_policies where tablename = 'tickets' and cmd = 'SELECT';
```
Si el nombre de la política (`tickets_select_vN`) es más alto que el de la última migración conocida en el repo, hay drift — alguien la editó fuera de control de versiones.

**Fix aplicado**: migración `20260703000001_restore_lider_equipo_tickets_visibility.sql` — crea `get_my_grupos_lider_ids()` y reemplaza v6 por `tickets_select_v7`, agregando de vuelta la cláusula de líder sin tocar el resto de lo que v6 ya cubría. Diagnosticado en vivo inspeccionando el Network tab del navegador (petición a `tickets` regresaba `[]` para una líder con datos y permisos correctos) — **esta técnica (pedir al usuario el Response de la Network tab) es más rápida que adivinar desde las migraciones cuando el RLS real puede haber divergido del repo.** Confirmado resuelto (2026-07-03) con la usuaria real viendo sus 13 trámites tras el fix.

## ⚠️ "Vista Admin — Viendo como" (impersonación) NO cambia la sesión real de Supabase
Es una simulación **solo de cliente**: `MoviAuthContext`/`ImpersonationContext` cambian el objeto `usuario` que la UI usa para renderizar y para armar los filtros de las queries (por eso los `.eq()`/`.or()` sí llevan el ID del usuario impersonado), **pero el JWT real que viaja en `Authorization: Bearer` sigue siendo el del admin que inició sesión de verdad**. Confirmado decodificando el JWT de una petición de red: `sub` = el ID del admin real, no el del usuario impersonado.

**Consecuencia crítica**: cualquier política RLS que dependa de `auth.uid()` (la enorme mayoría) se evalúa como el **admin real**, nunca como el usuario impersonado — sin importar lo que diga el banner naranja "Viendo como". Esto invalida cualquier prueba de RLS/permisos hecha vía impersonación. Ejemplo real (2026-07-03): un fix de RLS para "líder ve su equipo" parecía no funcionar probándolo con "Vista Admin"; al pedirle a la usuaria real que iniciara sesión con su propia cuenta, el fix sí funcionaba correctamente.

**Cómo probar correctamente algo que depende de RLS**: pedirle al usuario real que inicie sesión con su propia cuenta — la impersonación solo sirve para verificar UI/UX, no permisos de base de datos.

## Reglas de arquitectura — CRÍTICAS
- Tabla de tickets: `tickets` (NO `tramites`) — crítico para SQL y migraciones
- Tipos de trámite: tabla `ticket_tipos`, columna `value` como slug
- `assignment_mode` eliminado de `ticket_tipos` el 2026-06-24 — no referenciar jamás
- Campos del formulario por tipo: `tramite_tipo_campos` · Respuestas: `tramite_respuestas`
- Adjunto de categorías: `adjunto_categorias` (tabla en Supabase)

## Archivos más usados — leer primero al empezar

| Archivo | Qué hace | Líneas clave |
|---|---|---|
| `src/pages/Tramites.tsx` | Lista kanban de trámites activos, filtros, KPI cards | KPI: ~920 · visibleTramites filter: ~645 · kanbanAtención: ~786 |
| `src/pages/TramiteDetalle.tsx` | Detalle/edición de un trámite, triggers | Child ticket INSERT: ~812 |
| `src/components/tramites/NuevoTramiteModal.tsx` | Modal crear trámite | renderCampoSistema: buscar función · validateForm: ~707 · render unificado: buscar "Campos del formulario" |
| `src/components/tramites/GestionCatalogosRegistro.tsx` | CRUD de tipos de trámite (lista + edición) | Autocontenido, sin props |
| `src/components/tramites/catalogos/FormBuilderTab.tsx` | UI del form builder por tipo | Canvas draggable, panel agregar/editar |
| `src/components/tramites/catalogos/useFormBuilder.ts` | Hook lógica form builder | LOCKED_SISTEMA_KEYS, CONFIGURABLE_SISTEMA_KEYS, SISTEMA_CAMPO_DEFAULTS |
| `src/components/tramites/catalogos/types.ts` | Tipos TS compartidos | CampoTipo union, SISTEMA_TIPO_META, TipoCampo interface |
| `src/components/tramites/TriggerConfirmModal.tsx` | Modal de confirmación al disparar triggers | Default 'nuevo' cuando hay hijo existente |
| `src/pages/AdminTramites.tsx` | /admin/tramites — Áreas, Tipos, Equipos, Permisos, Reglas | Tab render: ~779 |
| `src/components/tramites/catalogos/PermisosTipoBulkTab.tsx` | Matriz masiva de permisos por tipo (Por Rol / Por Usuario) | Tab "Permisos", agregada 2026-07-02 |

## Campos sistema configurables (Fase 8 — implementados 2026-07-01)
Estos 5 campos ahora son configurables desde el FormBuilder (mostrar/ocultar, requerido, reordenable):
- `asignado_a` · `prioridad` · `descripcion` · `fecha_promesa_entrega` · `archivos_adjuntos`

Los campos sistema FIJOS (no movibles, no ocultables):
- `area` · `equipo` · `fecha_creacion` · `fecha_finalizacion`

Migración aplicada: `supabase/migrations/20260701000001_fase8_campos_form_configurables.sql`

## RESUELTO 2026-07-02
- Categoría de adjuntos no se asignaba al adjuntar desde FormBuilder → fix en commit `38947464`.
- Sistemas huérfanos de permisos por equipo (`tramite_equipo_tipo_permisos`, `tramite_team_tipo_config`, `usuario_team_permisos`): no tenían ningún efecto real porque `NuevoTramiteModal.tsx` nunca los lee. Se ocultó la tab "Visibilidad" de `AdminTramites.tsx` y la sección "Permisos por Equipo" de `PermisosPanel.tsx`. Tablas y función SQL siguen intactas por si se retoma. Detalle completo en memoria del proyecto (`project_jiromovi.md`).

## BUG PENDIENTE #1 — Líder de equipo no ve trámites de su equipo (parcialmente resuelto 2026-07-02)

**Causa #1 (CÓDIGO, ya arreglada):** en `src/pages/Tramites.tsx`, el chequeo `if (isAgente) return isDirectlyInvolved;` se ejecutaba **antes** del chequeo `isLiderOfGroup`, cortando el flujo para cualquier líder cuyo rol global (`usuarios.rol`) fuera `'Agente'` — el rol de líder es por equipo (`tramites_grupos_miembros.rol_en_equipo`), no por rol global, así que nunca se llegaba a evaluar. **Fix:** se movió el chequeo `isLiderOfGroup` para que se evalúe primero. Verificado con 3 agentes en paralelo: las políticas RLS de Supabase (`tickets_select_v4`) ya soportaban esto correctamente de forma independiente — no era un problema de RLS.

**Causa #2 (DATOS, en investigación):** `grupo_asignado_id` en `tickets` solo se asigna si existe una regla explícita en `tramites_grupos_reglas` para ese agente (por área específica o comodín `area IS NULL`) — resuelto vía RPC `get_grupo_para_ticket()`. Si el agente no tiene regla, o solo tiene regla para otra área, el campo queda `null` para siempre (no hay backfill ni trigger de respaldo). El trámite `TK599F9` de Yuri Aguilar tiene `grupo_asignado_id = null` — con el fix de código ya aplicado, este trámite específico **sigue sin verse** hasta que se resuelva esto.

**Nota de diseño confirmada con el usuario:** los trámites-hijo generados por triggers (`TramiteDetalle.tsx:812-824`) y la reasignación de "responsable" (`handleResponsableChange`) NO tocan `grupo_asignado_id` — esto es intencional, cada trámite debe resolver su propio grupo según su propio tipo/agente, no heredar. No tocar.

**Consultas para retomar** (correr en el SQL Editor de Supabase — agente_id de Yuri ya conocido: `0a8f09a2-270b-4695-b559-8b3a45239b59`):
```sql
-- Tipo de trámite y área de TK599F9
select t.id, t.folio, t.tipo_tramite, tt.area, tt.activo as tipo_activo
from tickets t
left join ticket_tipos tt on tt.value = t.tipo_tramite
where t.folio = 'TK599F9';

-- Reglas de asignación que tiene Yuri configuradas (¿existe alguna que matchee esa área, o wildcard?)
select r.*, g.nombre as grupo_nombre, g.activo as grupo_activo
from tramites_grupos_reglas r
join tramites_grupos_visualizacion g on g.id = r.grupo_id
where r.usuario_id = '0a8f09a2-270b-4695-b559-8b3a45239b59';

-- Confirmar MERCADOTECNIA como 'lider' del grupo "Comercial CAPITA" y que el grupo esté activo
select gm.usuario_id, u.nombre_completo, u.rol as rol_global, gm.grupo_id, g.nombre as grupo, gm.rol_en_equipo, g.activo as grupo_activo
from tramites_grupos_miembros gm
join usuarios u on u.id = gm.usuario_id
join tramites_grupos_visualizacion g on g.id = gm.grupo_id
where g.nombre ilike '%capita%';
```

## BUG PENDIENTE #2 — Campo "Estatus" no tiene el toggle de "Acceso por rol"
**Síntoma:** El admin quiere que el rol Agente no pueda editar el campo Estatus, pero el panel de edición de ese campo (FormBuilder) no muestra el selector "Visible para" / "Editable para" que sí tienen los demás campos.

**Causa confirmada:** `src/components/tramites/catalogos/FormBuilderTab.tsx:297` excluye explícitamente `editingCampo.tipo !== 'estatus'` del bloque que renderiza "Acceso por rol" (líneas 332-361). El campo Estatus tiene su propio panel especial (nombre + opciones de estatus, línea 467+) que nunca recibió ese bloque cuando se agregó la función de acceso por rol (commit `bc414f23`).

**El guardado ya soporta esto sin cambios**: `useFormBuilder.ts` (`handleSaveCampo`, `startEditCampo`) ya lee/escribe `visible_para_rol`/`editable_para_rol` para cualquier tipo de campo, incluido estatus. Solo falta agregar el mismo bloque JSX (líneas 332-361 de `FormBuilderTab.tsx`) dentro de la rama `editingCampo.tipo === 'estatus'`.

**Gap adicional encontrado (más importante):** `src/pages/TramiteDetalle.tsx` (donde se cambia el estatus de un trámite YA CREADO) **no lee `editable_para_rol` en ningún lado** — solo `NuevoTramiteModal.tsx` lo respeta (función `canEditCampo`, línea ~191, usa jerarquía `ROL_NIVEL: Agente=0, Empleado=1, Gerente=2, Administrador=3`). Agregar el toggle a la UI no bloqueará que un Agente cambie el estatus después de creado el trámite — para eso hay que replicar `canEditCampo`/`ROL_NIVEL` en `TramiteDetalle.tsx` y aplicarlo al control de cambio de estatus ahí.

## BUG PENDIENTE #3 — Usuario no-admin ve su propio pedido de MOVI Store vacío (diagnosticado 2026-07-03, sin corregir)

**Síntoma:** un usuario no-admin/no-gerente entra a `/store/pedido/:id` de un pedido **propio** y ve "Detalle de Pedido" con el Folio y la sección "Cliente" correctos, pero la sección "Productos" viene vacía y el Total muestra `$0.00`. El mismo pedido, visto por un Admin, muestra correctamente el producto ("Termo Corto JIRO", cantidad 2 × $150.00, total $300.00). Las secciones exclusivas de Admin (Ingresos/Costo/Ganancia neta, Cambiar Estatus, Control de Pagos, Información de Pago) están correctamente ocultas para el no-admin — eso no es el bug, es diseño esperado.

**Ubicación:** `src/lib/storeUtils.ts` función `obtenerPedidoCompleto()` (línea ~630) hace un query separado a `store_pedidos_detalle` con join embebido a `store_productos`:
```ts
const { data: detalle } = await supabase
  .from('store_pedidos_detalle')
  .select(`*, store_productos!store_pedidos_detalle_producto_id_fkey(*, store_categorias!store_productos_categoria_id_fkey(*))`)
  .eq('pedido_id', pedidoId);
```
Consumido por `src/pages/StorePedidoDetalle.tsx`. El total y la lista de productos que se renderizan (`detallesMapeados`, `total`) se calculan puramente a partir de este `detalle` — si el array viene vacío, el bug es 100% de la consulta/RLS, no de renderizado condicional por rol (no hay ningún `if (isAdmin)` alrededor de la sección Productos).

**Confirmado:** el query a `store_pedidos` (cabecera del pedido — Folio, Cliente, SICAS, Oficina) SÍ funciona para el dueño no-admin, así que el problema es específico de `store_pedidos_detalle` (o del join a `store_productos`), no un problema general de sesión/auth.

**Hipótesis a verificar (en orden de probabilidad, dado el patrón ya visto en este proyecto con `tickets_select_v6`):**
1. **RLS drift en `store_pedidos_detalle`**: la migración base (`20251123033434_create_store_module.sql:295-305`) crea la política `"Usuarios pueden ver detalle de sus pedidos"` con `USING (EXISTS (SELECT 1 FROM store_pedidos WHERE store_pedidos.id = pedido_id AND store_pedidos.usuario_id = auth.uid()))` — en teoría correcta. Falta confirmar que esa política **sigue existiendo tal cual en producción** y no fue reemplazada/eliminada por una edición directa en el SQL Editor (como pasó con `tickets_select_v6`).
2. **RLS en `store_productos`** (`activo = true` para cualquier autenticado) bloqueando el join embebido si el producto fue desactivado — menos probable porque el Admin sí ve el producto, pero vale confirmar que "Termo Corto JIRO" siga `activo = true`.
3. Menos probable: algún cambio reciente a la tabla `store_pedidos_detalle` (columnas, FK) que rompió el nombre del FK usado en el embed (`store_pedidos_detalle_producto_id_fkey`) — si el nombre del constraint cambió, PostgREST devolvería error 400, no un array vacío silencioso, así que esto se puede descartar rápido revisando la consola/Network del navegador.

**Diagnóstico a correr primero (SQL Editor de Supabase):**
```sql
-- 1. Confirmar que la política de "dueño ve su detalle" sigue existiendo y con qué USING
select policyname, cmd, qual
from pg_policies
where tablename = 'store_pedidos_detalle'
order by cmd;

-- 2. Confirmar que el producto sigue activo
select id, titulo, activo from store_productos where titulo ilike '%termo corto jiro%';

-- 3. Confirmar que el detalle existe en la tabla (dueño del pedido correcto)
select spd.*, sp.usuario_id
from store_pedidos_detalle spd
join store_pedidos sp on sp.id = spd.pedido_id
where spd.pedido_id = '0ac22a32-4e4b-4ff5-87bf-9ca8cc09d599';
```
Si la query #3 sí regresa la fila (o sea, el dato existe), el problema es 100% RLS (#1 o #2) — hay que pedirle al usuario real (Ricardo, dueño de este pedido) que abra la pestaña Network al cargar `/store/pedido/0ac22a32-4e4b-4ff5-87bf-9ca8cc09d599` y comparta la respuesta del request a `store_pedidos_detalle` (mismo método de diagnóstico usado para el bug de líder de equipo — ver RLS de `tickets` arriba). Si la política del punto 1 no aparece o tiene un `qual` distinto al de la migración, es RLS drift y hay que recrearla con una migración nueva (mismo patrón que `20260703000001_restore_lider_equipo_tickets_visibility.sql`).

## Patrones frecuentes

**Agregar un campo sistema nuevo al FormBuilder:**
1. Añadir tipo a `CampoTipo` union en `types.ts`
2. Añadir metadata a `SISTEMA_TIPO_META` en `types.ts`
3. Añadir defaults a `SISTEMA_CAMPO_DEFAULTS` en `useFormBuilder.ts`
4. Agregar case en `renderCampoSistema()` en `NuevoTramiteModal.tsx`
5. Migración SQL: extender CHECK constraint + backfill en tipos activos

**Push y deploy:**
```bash
git add <archivos>
git commit -m "descripción"
git push origin HEAD:produccion
# Luego: deploy desde Plesk
```

**Verificar tipos antes de push:**
```bash
npx tsc --noEmit -p tsconfig.app.json
```
⚠️ `npx tsc --noEmit` (sin `-p`) NO revisa nada — el `tsconfig.json` raíz es un archivo "solución" (`files: []`, solo `references`), así que corre en el vacío y siempre sale limpio aunque haya errores reales. Usar siempre `-p tsconfig.app.json`.

**Cuidado con imports de tipos:** el proyecto tiene `verbatimModuleSyntax: true` — cualquier import de un `interface`/`type` que no use `import type { X }` (o `import { type X }`) compila pero **truena en el navegador en tiempo de ejecución** con `SyntaxError: does not provide an export named 'X'` (pasó con `InsuranceTypesList.tsx` el 2026-07-02, dejó `/tramites` en blanco en producción). El `tsc` con `-p tsconfig.app.json` sí detecta esto (error `TS1484`).
