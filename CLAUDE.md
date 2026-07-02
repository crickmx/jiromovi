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
| `src/pages/AdminTramites.tsx` | /admin/tramites — Áreas, Tipos, Equipos, Visibilidad, Reglas | Tab render: ~779 |

## Campos sistema configurables (Fase 8 — implementados 2026-07-01)
Estos 5 campos ahora son configurables desde el FormBuilder (mostrar/ocultar, requerido, reordenable):
- `asignado_a` · `prioridad` · `descripcion` · `fecha_promesa_entrega` · `archivos_adjuntos`

Los campos sistema FIJOS (no movibles, no ocultables):
- `area` · `equipo` · `fecha_creacion` · `fecha_finalizacion`

Migración aplicada: `supabase/migrations/20260701000001_fase8_campos_form_configurables.sql`

## BUG PENDIENTE — Empezar aquí mañana
**Categoría de adjuntos no se asigna al adjuntar desde FormBuilder**

Síntoma: Si el admin configura el campo `archivos_adjuntos` desde el FormBuilder, al adjuntar un archivo en NuevoTramiteModal no le asigna la categoría correctamente.

Archivos a revisar:
1. `src/components/tramites/NuevoTramiteModal.tsx` — buscar `renderCampoSistema` case `'archivos_adjuntos'`: ver si `archivoCategoriaId` se está leyendo/guardando bien, y si la lista de `adjuntoCategorias` está cargada al momento de render.
2. Buscar cómo se guarda `archivoCategoriaId` al submit — verificar que se incluye en el INSERT de `ticket_archivos`.
3. Posible causa: el campo `archivos_adjuntos` tiene su propio config en `tramite_tipo_campos` pero el modal no lee ese config para pre-seleccionar o filtrar categorías.

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
npx tsc --noEmit
```
