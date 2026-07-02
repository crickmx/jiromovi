# jiromovi — instrucciones para Claude Code

## Git / Deploy
- **Siempre pushear a `origin/produccion`** — Plesk despliega desde esa rama.
- Rama local activa: `FUSION!!!` (trackea `origin/main` por defecto — ignorar).
- **Comando correcto:** `git push origin HEAD:produccion`
- Nunca solo `git push` ni `git push origin HEAD:main` — los cambios no llegarán al servidor.

## Stack
- React 18 + TypeScript + Vite + Tailwind CSS
- Supabase (PostgreSQL + RLS + Edge Functions)
- Repo: https://github.com/crickmx/jiromovi · Deploy: Plesk

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

## BUG PENDIENTE #1 — Empezar aquí mañana: Líder de equipo no ve trámites de su equipo
**Síntoma:** MERCADOTECNIA fue asignada como líder (`rol_en_equipo='lider'` en `tramites_grupos_miembros`) del equipo "Comercial CAPITA", donde YURI AGUILAR GONZÁLEZ es ejecutivo. MERCADOTECNIA no ve los trámites de Yuri.

**Ya se investigó:**
- El fix de visibilidad para líderes (commit `8f895262 fix+feat: lider equipo ve todos sus tramites`) ya está mergeado en `produccion`. La lógica en `src/pages/Tramites.tsx:691-695` (`isLiderOfGroup`) se ve correcta: compara `tramite.grupo_asignado_id` contra `myGrupoRoles.get(grupo_id) === 'lider'`.
- **Encontrado con SQL:** el trámite `TK599F9` de Yuri tiene `grupo_asignado_id = null`. Como la lógica del líder depende exactamente de ese campo, si está en `null` nunca se va a ver sin importar que el líder esté bien configurado.
- **Falta confirmar:** si esto es un caso aislado (¿por qué ese trámite no se asignó a un grupo?) o si TODOS los trámites de Yuri tienen `grupo_asignado_id = null` (apuntaría a un problema más de fondo: los trámites no se están asignando a un equipo al crearse/reasignarse, no un problema de la lógica del líder). También falta confirmar el rol global de MERCADOTECNIA (`usuarios.rol`) y si el grupo "Comercial CAPITA" está `activo=true` (si no, se filtra silenciosamente en `loadMyOperacionesRole()`).

**Consultas para retomar** (correr en el SQL Editor de Supabase):
```sql
-- 1. Usuario MERCADOTECNIA y su rol global
select id, nombre_completo, rol
from usuarios
where nombre_completo ilike '%mercadotecnia%' or nombre ilike '%mercadotecnia%';

-- 2. Grupo "Comercial CAPITA": id y si está activo
select id, nombre, activo, area_categoria
from tramites_grupos_visualizacion
where nombre ilike '%capita%';

-- 3. MERCADOTECNIA como 'lider' en ese grupo específico
select gm.usuario_id, u.nombre_completo, gm.grupo_id, g.nombre as grupo, gm.rol_en_equipo, g.activo as grupo_activo
from tramites_grupos_miembros gm
join usuarios u on u.id = gm.usuario_id
join tramites_grupos_visualizacion g on g.id = gm.grupo_id
where g.nombre ilike '%capita%';

-- 4. TODOS los trámites de Yuri y su grupo_asignado_id (ver si es un patrón, no solo TK599F9)
select t.id, t.folio, t.agente_id, t.grupo_asignado_id, u.nombre_completo as agente_nombre
from tickets t
join usuarios u on u.id = t.agente_id
where u.nombre_completo ilike '%yuri%aguilar%';
```

## BUG PENDIENTE #2 — Campo "Estatus" no tiene el toggle de "Acceso por rol"
**Síntoma:** El admin quiere que el rol Agente no pueda editar el campo Estatus, pero el panel de edición de ese campo (FormBuilder) no muestra el selector "Visible para" / "Editable para" que sí tienen los demás campos.

**Causa confirmada:** `src/components/tramites/catalogos/FormBuilderTab.tsx:297` excluye explícitamente `editingCampo.tipo !== 'estatus'` del bloque que renderiza "Acceso por rol" (líneas 332-361). El campo Estatus tiene su propio panel especial (nombre + opciones de estatus, línea 467+) que nunca recibió ese bloque cuando se agregó la función de acceso por rol (commit `bc414f23`).

**El guardado ya soporta esto sin cambios**: `useFormBuilder.ts` (`handleSaveCampo`, `startEditCampo`) ya lee/escribe `visible_para_rol`/`editable_para_rol` para cualquier tipo de campo, incluido estatus. Solo falta agregar el mismo bloque JSX (líneas 332-361 de `FormBuilderTab.tsx`) dentro de la rama `editingCampo.tipo === 'estatus'`.

**Gap adicional encontrado (más importante):** `src/pages/TramiteDetalle.tsx` (donde se cambia el estatus de un trámite YA CREADO) **no lee `editable_para_rol` en ningún lado** — solo `NuevoTramiteModal.tsx` lo respeta (función `canEditCampo`, línea ~191, usa jerarquía `ROL_NIVEL: Agente=0, Empleado=1, Gerente=2, Administrador=3`). Agregar el toggle a la UI no bloqueará que un Agente cambie el estatus después de creado el trámite — para eso hay que replicar `canEditCampo`/`ROL_NIVEL` en `TramiteDetalle.tsx` y aplicarlo al control de cambio de estatus ahí.

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
