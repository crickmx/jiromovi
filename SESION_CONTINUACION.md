# Continuación de sesión — Módulo Trámites (Equipos de Operaciones)

## Proyecto
- **Repo local**: `C:\Users\RICARDO JIMENEZ\Desktop\jiromovi-main`
- **Branch**: `produccion`
- **Stack**: React + TypeScript + Vite / Supabase (PostgreSQL + RLS + RPCs)
- **Deploy**: Plesk → movi.digital (SSH disponible, credenciales con el usuario)

---

## Estado actual — TODO DEPLOYADO Y FUNCIONANDO

### Migraciones aplicadas en Supabase ✅
- `000002_grupo_reglas_auto_asignacion.sql`
- `000003_rls_tramites_grupos_reglas.sql`
- `000004_reglas_por_usuario.sql` — `tramites_grupos_reglas` usa `usuario_id` (vendedor → equipo)
- `000005_ejecutivo_en_regla.sql` — agrega `ejecutivo_id` opcional; `get_grupo_para_ticket` retorna `TABLE(grupo_id, ejecutivo_id)`
- `000006_fix_rls_reglas_insert.sql` — función `current_user_is_admin()` SECURITY DEFINER para policies de INSERT/UPDATE/DELETE/SELECT

---

## Qué se construyó

### 1. Auto-asignación de equipo al crear trámite
- Al crear cualquier trámite, busca si el agente tiene regla → guarda `grupo_asignado_id` en el ticket.
- Si la regla tiene `ejecutivo_id`, el trámite se asigna directo a ese ejecutivo como responsable.
- `src/components/tramites/NuevoTramiteModal.tsx` → `resolveGrupoParaTicket` retorna `{grupo_id, ejecutivo_id} | null`

### 2. Filtro "Mi Equipo" en lista de Trámites
- Toggle ámbar filtra solo trámites del equipo de Operaciones del usuario.
- `src/pages/Tramites.tsx`

### 3. Campo Equipo + Responsable editable en detalle del trámite
- Dropdown **Equipo** (ámbar) → filtra opciones del dropdown **Responsable** (azul).
- Solo editable para Admin o Líder del equipo asignado (`canManageAssignment`).
- Cambiar equipo limpia responsable y guarda `grupo_asignado_id` en DB.
- `src/components/tramites/TramiteDetalles.tsx`, `src/pages/TramiteDetalle.tsx`

### 4. Ejecutivos Asignados editables en detalle del trámite
- Chips con × para quitar, botón "+ Agregar" con dropdown filtrado por equipo.
- `src/components/tramites/TramiteDetalles.tsx`

### 5. Gestión de Equipos — Asignación tab
- Lista de vendedores con buscador + filtro por oficina + selección múltiple + "Seleccionar todos".
- Cada vendedor asignado muestra selector de ejecutivo ("Pool del equipo" o miembro lider/ejecutivo).
- Upsert al agregar: si el vendedor ya tiene regla en otro equipo, lo reasigna.
- `src/components/tramites/GestionGruposVisualizacion.tsx`

---

## Problemas resueltos (para referencia)

| Error | Causa | Fix |
|---|---|---|
| Listas vacías en Gestión de Equipos | Join `oficinas(nombre)` + columnas `nombre`/`apellidos` inexistentes → error 400 PostgREST | Queries simplificadas sin join |
| RLS error al hacer INSERT en reglas | Policy hacía subquery a `usuarios` bloqueado por RLS de usuarios | Función `current_user_is_admin()` SECURITY DEFINER |
| Duplicate key en INSERT de reglas | Vendedor ya tenía regla en otro equipo | Cambiado a `upsert` con `onConflict: 'usuario_id'` |
| Vendedores asignados no aparecen tras guardar | `loadGrupoReglas` usaba `usuarios!inner` bloqueado por RLS | Sin join; nombres resueltos desde `agentesParaReglas` state |

---

## Tablas clave

| Tabla | Propósito |
|---|---|
| `tramites_grupos_visualizacion` | Equipos de trabajo |
| `tramites_grupos_miembros` | Usuarios por equipo (`lider` / `ejecutivo` / `miembro`) |
| `tramites_grupos_reglas` | `usuario_id` → `grupo_id` + `ejecutivo_id` opcional |
| `tickets` | Trámites — tiene `grupo_asignado_id`, `assigned_to_user_id` |
| `ticket_asignaciones` | Ejecutivos asignados a un trámite |

## RPCs relevantes

| RPC | Descripción |
|---|---|
| `get_grupo_para_ticket(p_agente_id uuid)` | `TABLE(grupo_id, ejecutivo_id)` para un vendedor |
| `get_grupo_miembros_ejecutivos(p_grupo_id)` | Miembros lider/ejecutivo de un equipo |
| `get_grupo_miembros(p_grupo_id)` | Todos los miembros del equipo |
| `get_tramite_teams_full()` | Lista completa de equipos con conteos |
| `current_user_is_admin()` | SECURITY DEFINER — verifica rol sin recursión RLS |

---

## Pendiente (no iniciado)

### Notificaciones al asignar/reasignar trámites
- Tabla `notificaciones` ya existe en Supabase
- `NotificationBell` ya está en `PrimarySidebar`
- `NotificationContext` ya activo con suscripción realtime
- **Falta implementar:**
  - En `NuevoTramiteModal` al crear trámite con auto-asignación → notificar al ejecutivo/equipo asignado
  - En `TramiteDetalle.handleResponsableChange` → notificar al nuevo responsable
  - En `TramiteDetalle.handleEquipoChange` → notificar al líder del nuevo equipo
- Ver estructura de `notificaciones` en Supabase antes de implementar (columnas: probablemente `usuario_id`, `titulo`, `mensaje`, `leida`, `tramite_id`)

---

## Commits de esta sesión

```
74509aa1 fix: loadGrupoReglas sin join a usuarios para evitar bloqueo RLS
3d5396fe fix: upsert en reglas de asignación + deduplicar lista de agentes
ff419e19 fix: RLS INSERT en tramites_grupos_reglas via SECURITY DEFINER helper
c1ea9c7c feat: campo Equipo en detalle de trámite filtra opciones de Responsable
b74d1169 fix: corrige listas vacías en GestionGrupos y agrega auto-asignación por ejecutivo
a0589f4d feat: asignación automática por vendedor + responsable/ejecutivos editables
```
