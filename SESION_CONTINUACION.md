# Continuación de sesión — MOVI

## Proyecto
- **Repo local**: `C:\Users\medau\Desktop\jiromovi-main`
- **Branch activa**: `produccion`
- **Deploy**: Plesk → `https://app.movi.digital` (Node.js + Git auto-build)
- **Stack**: React + TypeScript + Vite / Supabase (PostgreSQL + RLS + RPCs + Edge Functions)
- **Supabase proyecto ID**: `qhwvuuyjhcennqccgvse`

---

## Instrucciones para sesiones eficientes

1. **Leer este archivo al inicio** — Claude Code lo tiene disponible automáticamente
2. **Al reportar un error de SQL**: pegar el mensaje exacto de Supabase, no parafrasear
3. **Al reportar un error de UI**: adjuntar screenshot o el mensaje de consola del navegador
4. **Para cambios en producción**: confirmar siempre `git status` antes de pedir un deploy
5. **Para cambios de base de datos**: Claude Code genera el SQL listo para copiar al Editor SQL de Supabase
6. **"commit y push"** = Claude Code hace ambas cosas sin preguntar
7. **SQL para Supabase** = Claude Code entrega el bloque completo para copiar y pegar

---

## Estado actual — Deployado y funcionando en `app.movi.digital`

### Dominio
- Plataforma migrada de `movi.digital` → `app.movi.digital` ✅
- `movi.digital` restaurado como WordPress ✅
- Git deploy configurado en Plesk sobre `app.movi.digital` ✅
- SSL Let's Encrypt activo ✅

### Notificaciones de trámites ✅
- **Fix aplicado**: migración `20260623000002_fix_tramite_notifications_all_recipients.sql`
- `notify_tramite_recipients()` ahora notifica a `agente_id` **y** `assigned_to_user_id`
- `notify_ticket_created_unassigned()` ya no hace early return — notifica al agente siempre
- Empleados y Ejecutivos Comerciales vuelven a recibir notificaciones de comentarios/cambios

### Auto-asignación por área ✅
- `tramites_grupos_reglas` tiene columna `area` — un agente puede tener regla por área + regla comodín
- RPC `get_grupo_para_ticket(p_agente_id, p_tipo_tramite)` resuelve el equipo correcto según el área del tipo de trámite
- Migraciones: `20260622000008_reglas_por_area.sql`

### Equipos de trabajo (áreas libres) ✅
- `tramites_grupos_visualizacion.area_categoria` ya no tiene CHECK constraint
- Las áreas son dinámicas desde `ticket_tipos.area`
- Migración: `20260622000009_area_categoria_free_text.sql`

### RLS — suplantación de identidad ✅
- Admin suplantando a agente ya puede crear comentarios y adjuntos
- Migración: `20260623000001_fix_ticket_comentarios_impersonation.sql`

### Centro de Contacto — unificación de modales ✅
- `CentroContacto.tsx`: `CreateTaskModal` reemplazado por `NuevoTramiteModal`
  - El modal de crear trámite desde Email/WhatsApp ahora es el mismo que el resto de la app
  - Instrucciones pre-llenadas con mensajes seleccionados y canal correcto (Email o WhatsApp)
  - Después de crear, vincula los mensajes via `add-contact-messages-to-task`
- `AddToTaskModal` reemplazado — nueva implementación idéntica a `UnifiedConversationThread`:
  - Carga trámites directamente desde Supabase (no más edge function `get-agent-open-tickets`)
  - Botón "Agregar a este trámite" por cada trámite (sin selección + botón separado)
  - Muestra "Email" o "WhatsApp" correctamente en el comentario que se agrega

---

## Pendiente — Próximas sesiones

### 1. Merge main vs produccion
- **Cuándo**: cuando el otro miembro del equipo esté disponible para probar su parte
- **Riesgo**: `App.tsx` y `package.json` pueden tener conflictos menores
- **Crítico**: las ~15 migraciones de `produccion` no deben perderse
- **Tiempo estimado**: 1–2 horas
- **Guía completa**: ver `PLAN_EQUIPO_Y_AUTOMATIZACION.md` — Parte 1

### 2. Módulo de Automatización (Centro de Contacto WhatsApp)
- Rediseñar desde 0 como módulo aislado para que otro desarrollador lo trabaje externamente
- **Paso siguiente**: Claude Code crea la carpeta `src/modules/automation/` con el contrato de interfaz y placeholder
- **Guía completa**: ver `PLAN_EQUIPO_Y_AUTOMATIZACION.md` — Parte 2
- **Tiempo estimado para preparar la estructura**: 2–3 horas

---

## Tablas clave de Supabase

| Tabla | Propósito |
|---|---|
| `tickets` | Trámites — `grupo_asignado_id`, `assigned_to_user_id`, `agente_id` |
| `tramites_grupos_visualizacion` | Equipos de trabajo con `area_categoria` |
| `tramites_grupos_miembros` | Usuarios por equipo (`lider` / `ejecutivo` / `miembro`) |
| `tramites_grupos_reglas` | Agente → equipo + área + ejecutivo opcional |
| `ticket_tipos` | Tipos de trámite — fuente de verdad para `area` |
| `ticket_comentarios` | Comentarios de trámites |
| `ticket_archivos` | Adjuntos de trámites |
| `notifications` | Notificaciones directas (insert desde triggers) |
| `notificaciones` | Notificaciones transaccionales (via `notification_jobs`) |
| `contact_center_messages` | Mensajes del Centro de Contacto (Email + WA MOVI) |

## RPCs relevantes

| RPC | Descripción |
|---|---|
| `get_grupo_para_ticket(p_agente_id, p_tipo_tramite)` | Resuelve equipo + ejecutivo para auto-asignación |
| `notify_tramite_recipients(p_ticket_id, p_codigo_tipo, p_variables, ...)` | Notifica agente + responsable |
| `notify_ticket_created_unassigned()` | Trigger de creación — notifica agente, responsable, mesa |
| `get_contact_center_summary(p_user_id, ...)` | Lista de conversaciones del Centro de Contacto |
| `current_user_is_admin()` | SECURITY DEFINER — verifica rol sin recursión RLS |

---

## Archivos clave del proyecto

| Archivo | Propósito |
|---|---|
| `src/pages/CentroContacto.tsx` | Centro de Contacto (Email + WA MOVI) |
| `src/components/contactCenter/UnifiedConversationThread.tsx` | Hilo de conversación unificado (WA Personal + WA MOVI + Chat) |
| `src/components/tramites/NuevoTramiteModal.tsx` | Modal de crear trámite (usado en toda la app) |
| `src/components/tramites/GestionGruposVisualizacion.tsx` | Gestión de equipos de trabajo |
| `src/pages/Tramites.tsx` | Lista de trámites con filtro Mi Equipo |
| `supabase/migrations/` | Historial de cambios de base de datos |

---

## Documentos de referencia

| Documento | Contenido |
|---|---|
| `MIGRACION_DOMINIO_APP.md` | Instrucciones paso a paso para migrar dominios en Plesk |
| `PLAN_EQUIPO_Y_AUTOMATIZACION.md` | Estrategia de merge main/produccion + arquitectura del módulo de automatización |

---

*Última actualización: 2026-06-23*
