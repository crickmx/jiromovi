# READFIRST — Estado del proyecto JIROmovi al 2026-06-30

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

## ⚠ Migraciones pendientes de aplicar manualmente en Supabase

Ir a **Supabase Dashboard → SQL Editor** y ejecutar en orden:

### 1. Columna `es_primario` en agentes (necesaria para "Hacer principal")
```sql
ALTER TABLE maestro_agentes ADD COLUMN IF NOT EXISTS es_primario boolean NOT NULL DEFAULT true;
```
Luego resetear los valores para que aparezcan los botones:
```sql
UPDATE maestro_agentes SET es_primario = false;
UPDATE maestro_agentes SET es_primario = true
WHERE id IN (
  SELECT DISTINCT ON (nombre) id FROM maestro_agentes ORDER BY nombre, created_at ASC
);
```

### 2. Campo `nombre_propuesto` en mapeos pendientes
```sql
ALTER TABLE maestro_mapeo_pendiente
  ADD COLUMN IF NOT EXISTS nombre_propuesto text,
  ALTER COLUMN user_id_propuesto DROP NOT NULL;
```

### 3. Sistema de Triggers de Estatus — Fase 0 (schema completo)
Ejecutar el contenido del archivo:
`supabase/migrations/20260630000002_trigger_sistema_fase0.sql`

---

## Proyecto activo: Sistema de Triggers de Estatus

### Qué es
Permite que ciertos cambios de estatus en un trámite disparen automáticamente la creación de nuevos trámites (hijos) en otra área. Ej: "Póliza emitida" en Comercial → crea automáticamente un "Registro de póliza" en Operaciones con los campos mapeados.

### Estado actual
- **Fase 0 ✅ COMPLETA** — Schema de BD (migraciones commiteadas, pendiente aplicar en Supabase)
- **Fase 1 🔲 PENDIENTE** — UI en FormBuilder para configurar triggers + mapeos
- **Fase 2 🔲 PENDIENTE** — Modal de pre-aviso al usuario antes de cambiar estatus
- **Fase 3 🔲 PENDIENTE** — Motor de ejecución en TramiteDetalles
- **Fase 4 🔲 PENDIENTE** — Visibilidad padre-hijo en detalle de trámite
- **Fase 5 🔲 PENDIENTE** — Mejoras: dry-run, catálogo de estatus por tipo

### Tablas nuevas (Fase 0)
| Tabla | Descripción |
|---|---|
| `maestro_adjunto_categorias` | Categorías de adjuntos (Póliza, Comprobante, Nota interna…) |
| `ticket_status_triggers` | Configuración de triggers: qué tipo + estatus → qué tipo hijo |
| `ticket_trigger_field_mappings` | Mapeo campo-a-campo por trigger (con soporte sistema_key y valor fijo) |
| `ticket_trigger_executions` | Log de ejecuciones (ok/error/skipped) |
| `ticket_archivos.categoria_id` | FK nueva a `maestro_adjunto_categorias` |
| `tickets.parent_ticket_id` | FK self-referencial para relación padre-hijo |
| `tickets.trigger_origen_id` | Qué trigger generó este trámite |

### Decisiones de diseño clave
1. **Idempotencia con control del usuario**: si ya existe un hijo para ese trigger, el modal de confirmación (Fase 2) pregunta "¿Conservar el existente o crear uno nuevo?" en lugar de omitir silenciosamente
2. **Sin ciclos**: los trámites con `parent_ticket_id IS NOT NULL` nunca disparan triggers
3. **Adjuntos por categoría**: por defecto no pasan adjuntos; el admin configura qué categorías pasan en cada trigger
4. **Ejecución no bloqueante**: el motor corre en `Promise.allSettled()` — el estatus se guarda primero, luego ejecuta triggers
5. **Si falla**: toast de advertencia al usuario + notificación al admin, sin rollback del estatus

---

## Fixes completados en esta sesión (2026-06-30)

### Fix: Vendedores duplicados — botón "Hacer principal"
- `es_primario` column existe pero `DEFAULT true` hizo que todos mostraran "Principal"
- SQL de reset provisto arriba para que aparezcan los botones

### Fix: Agente SICAS sin cuenta MOVI — campo de texto para proponer nombre
**Archivo:** `src/components/tramites/NuevoTramiteModal.tsx`
- Nuevo state `propuestoNombreMOVI`
- Cuando se selecciona un agente ⚠ en `agente_vendedor`, aparece un input de texto libre: "Nombre completo de la cuenta MOVI a crear…"
- Al crear el trámite: si hay `asignado` → propone vinculación con usuario existente; si hay `propuestoNombreMOVI` → inserta en `maestro_mapeo_pendiente` con `nombre_propuesto` y `user_id_propuesto = null`
- Admin ve "Cuenta MOVI a crear" en la tarjeta de propuesta pendiente (con nombre escrito)
- Botón "Validar" bloquea hasta que se cree el usuario MOVI y se asigne manualmente

### Fix: `agente_vendedor` ya no bloquea validación cuando está vacío
- Campo sistema excluido de la validación de campos requeridos (igual que `equipo` y `area`)

---

## Tablas clave en Supabase

| Tabla | Descripción |
|---|---|
| `maestro_agentes` | Agentes/vendedores SICAS. Cols: `id`, `nombre`, `despacho_id`, `gerencia_id`, `activo`, `es_primario` |
| `maestro_despachos` | Despachos/oficinas |
| `maestro_gerencias` | Gerencias |
| `maestro_mapeo_pendiente` | Propuestas mapeo SICAS→MOVI. `user_id_propuesto` nullable + `nombre_propuesto` nuevo |
| `ticket_tipos` | Tipos de trámite. FK `area_id` → `tramites_areas` |
| `tramite_tipo_campos` | Campos dinámicos del FormBuilder por tipo de trámite |
| `tramite_respuestas` | Respuestas/valores de los campos dinámicos por ticket |
| `tramites_areas` | Áreas (Operaciones, Comercial…) |
| `tramites_grupos_visualizacion` | Equipos de trabajo |
| `tramites_equipos_areas` | Relación N:N equipo ↔ área |
| `tickets` | Trámites. Nuevas cols: `parent_ticket_id`, `trigger_origen_id` |
| `ticket_archivos` | Adjuntos. Nueva col: `categoria_id` |
| `usuarios` | Usuarios MOVI internos |

---

## Archivos principales

```
src/pages/BaseDatosMaestrosAdmin.tsx         ← Admin: Vendedores, Mapeo, Trámites, Catálogos
src/components/tramites/NuevoTramiteModal.tsx ← Modal de nuevo trámite
src/components/tramites/TramiteDetalles.tsx   ← Detalle + asignación equipo
supabase/migrations/20260630000002_*          ← Fase 0 triggers (PENDIENTE aplicar)
```

---

## Siguiente paso al retomar

**Fase 1 del sistema de triggers:** UI en FormBuilder para configurar triggers y mapeos de campos.

Ubicación donde vivirá la UI: probablemente en `src/pages/BaseDatosMaestrosAdmin.tsx` (tab "Trámites" → editar un tipo → sección nueva "Triggers de Estatus") o en el FormBuilder de tipos de trámite si existe una página dedicada para eso.

Antes de arrancar Fase 1, buscar el componente del FormBuilder:
```
grep -rn "FormBuilder\|tramite_tipo_campos" src/ --include="*.tsx" -l
```
