# READFIRST — Estado del proyecto JIROmovi al 2026-06-29

> **Leer esto antes de continuar.** Resumen para retomar desde otro equipo.

---

## Repositorio

```
git clone https://github.com/crickmx/jiromovi.git
cd jiromovi
git checkout produccion
npm install
```

> Rama activa: **`produccion`**

---

## Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + RLS + Storage)
- **Ruta local en máquina principal:** `C:\Users\medau\Desktop\jiromovi-main`
- **Servidor dev:** `npm run dev`

---

## ⚠ Migración pendiente de aplicar manualmente en Supabase

Esta migración fue commiteada al repo pero **aún no se ha aplicado en la base de datos**. Hasta que se aplique, el botón "Hacer principal" en Base de Datos → Vendedores fallará.

Ir a **Supabase Dashboard → SQL Editor** y ejecutar:

```sql
ALTER TABLE maestro_agentes ADD COLUMN IF NOT EXISTS es_primario boolean NOT NULL DEFAULT true;
```

Archivo: `supabase/migrations/20260629000002_agentes_es_primario.sql`

---

## Lo que se hizo recientemente (últimas 2 sesiones)

### 1. Base de Datos → Vendedores: Vista "Por Vendedor" + duplicados

**Archivo:** `src/pages/BaseDatosMaestrosAdmin.tsx`

- Se agregó toggle "Por Despacho" / "Por Vendedor"
- Vista Por Vendedor agrupa todos los agentes con el mismo nombre
- Si un vendedor aparece en 2+ despachos → borde ámbar + ícono ⚠
- Botón "Solo duplicados" filtra para mostrar únicamente esos
- Cada fila tiene botón "Hacer principal" / badge "Principal" (`es_primario` = TRUE/FALSE en `maestro_agentes`)
- **Requiere la migración de arriba para funcionar**

### 2. Base de Datos → Edición y borrado inline

**Archivo:** `src/pages/BaseDatosMaestrosAdmin.tsx`

- Despachos, gerencias y agentes ahora tienen botones inline de editar (lápiz) y eliminar (basura)
- Edición con Enter/Escape
- Estado unificado: `editingRow: { table, id, nombre, field? }`

### 3. Base de Datos → Tab "Trámites" (nuevo)

**Archivo:** `src/pages/BaseDatosMaestrosAdmin.tsx`

- Nueva pestaña con ícono Tag para gestionar:
  - **Áreas** (`tramites_areas`): nombre, slug, color, activa/inactiva
  - **Equipos** (`tramites_grupos_visualizacion`): nombre, activo/inactivo
  - **Tipos de Trámite** (`ticket_tipos`): label, color, área asignada, activo/inactivo
- Edición y borrado inline en las 3 tablas
- Formulario de alta para cada sección

### 4. TramiteDetalles → Equipos filtrados por área

**Archivo:** `src/components/tramites/TramiteDetalles.tsx`

- Al abrir un trámite, el dropdown de equipos solo muestra los equipos vinculados al área del tipo de trámite
- Relación: `ticket_tipos.area_id` → `tramites_equipos_areas.area_id` → `tramites_equipos_areas.equipo_id` → `tramites_grupos_visualizacion`
- Si no hay equipos mapeados para esa área → muestra todos (fallback)

### 5. NuevoTramiteModal → Agente SICAS sin cuenta MOVI ya no bloquea

**Archivo:** `src/components/tramites/NuevoTramiteModal.tsx`

Tres cambios aplicados en este orden:

**a) `validateForm()` — bypass cuando agente ⚠ seleccionado**
```
Si agente_vendedor tiene un agente sin usuario_id → permite continuar aunque asignado=null
```

**b) Validación de campos requeridos — excluir `agente_vendedor`**
```
agente_vendedor se agrega a AUTO_FILL_KEYS + check explícito por sistema_key
→ nunca bloquea aunque esté marcado como requerido en el FormBuilder
```

**c) Warning actualizado + notificación automática a admins**
- El aviso en el campo cambió de "asígnalo manualmente" → "Al crear el trámite se enviará una notificación al Admin"
- Tras crear el ticket, si `agente_vendedor` tiene un agente sin `usuario_id` y no hay `asignado`, se envía `crearNotificacion()` a todos los Administradores activos con enlace a Base de Datos → Vendedores

---

## Tablas clave en Supabase

| Tabla | Descripción |
|---|---|
| `maestro_agentes` | Agentes/vendedores SICAS. Cols: `id`, `nombre`, `despacho_id`, `gerencia_id`, `activo`, `es_primario` (NUEVA) |
| `maestro_despachos` | Despachos/oficinas |
| `maestro_gerencias` | Gerencias |
| `sicas_vendor_user_mappings` | Mapa agente SICAS ↔ usuario MOVI. `status`: `active` / `pending_review` |
| `maestro_mapeo_pendiente` | Propuestas de mapeo pendientes. `user_id_propuesto` es NOT NULL |
| `ticket_tipos` | Tipos de trámite. FK `area_id` → `tramites_areas` |
| `tramites_areas` | Áreas (Operaciones, Comercial…) |
| `tramites_grupos_visualizacion` | Equipos de trabajo |
| `tramites_equipos_areas` | Relación N:N equipo ↔ área |
| `tickets` | Trámites |
| `usuarios` | Usuarios MOVI internos |

---

## Archivos principales modificados recientemente

```
src/pages/BaseDatosMaestrosAdmin.tsx    ← vista principal admin (más modificado)
src/components/tramites/NuevoTramiteModal.tsx  ← modal de nuevo trámite
src/components/tramites/TramiteDetalles.tsx    ← detalle + asignación equipo
supabase/migrations/20260629000002_agentes_es_primario.sql  ← PENDIENTE aplicar
```

---

## Pendientes para la siguiente sesión

- [ ] Aplicar migración `es_primario` en Supabase SQL Editor (ver sección ⚠ arriba)
- [ ] Probar flujo completo: crear trámite con agente SICAS ⚠ → confirmar que llega notificación al admin
- [ ] Probar "Hacer principal" después de aplicar la migración
- [ ] Revisar si hay algo pendiente en SicasAdmin (flujo de aprobación de mapeos pendientes)
