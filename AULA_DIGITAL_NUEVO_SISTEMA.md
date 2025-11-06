# Nuevo Sistema de Aula Digital - Seguros Education

## Resumen de Cambios

Se ha implementado un sistema completamente nuevo para la gestión de capacitaciones en **Seguros Education**, reemplazando el sistema de Aula Virtual basado en WebRTC por un **Aula Digital** más simple y flexible que funciona con enlaces externos (Zoom, Teams, Google Meet, etc.).

---

## Archivos Creados

### 1. Migración de Base de Datos
**Archivo:** `supabase/migrations/20251106000000_create_education_sesiones_programadas.sql`

**Nuevas Tablas:**

#### `education_sesiones_programadas`
Tabla principal para gestionar sesiones de capacitación programadas:
- **Información básica**: título, compañía, ponente, descripción
- **Fecha y hora**: fecha, hora, duración_minutos
- **Acceso**: link_acceso (URL externa), clave_acceso (opcional)
- **Control**: oficinas_asignadas (filtro por oficina), capacidad (límite de participantes)
- **Estado**: estatus (programada | en_vivo | finalizada | cancelada), publicada
- **Configuración**: minutos_anticipacion (tiempo antes para habilitar "Ingresar")
- **Categorización**: tags (array JSON para etiquetas)
- **Auditoría**: creado_por, actualizado_por, timestamps

#### `education_sesiones_registro`
Tabla para control de inscripciones:
- sesion_id, usuario_id
- asistio (boolean, para marcar asistencia)
- Constraint único: un usuario solo puede registrarse una vez por sesión

**Políticas RLS:**
- ✅ Administradores: acceso completo (CRUD)
- ✅ Gerentes/Empleados/Agentes: solo ven sesiones publicadas de su oficina (o todas si no hay filtro)
- ✅ Todos pueden registrarse en sesiones
- ✅ Pueden ver sus propios registros
- ✅ Administradores pueden actualizar asistencia

### 2. Utilidades para Sesiones
**Archivo:** `src/lib/educationSesionesUtils.ts`

**Funciones principales:**
- `obtenerSesionesProgramadas()`: Lista sesiones con filtros
- `crearSesionProgramada()`: Crear nueva sesión (admin)
- `actualizarSesionProgramada()`: Actualizar sesión existente
- `eliminarSesionProgramada()`: Eliminar sesión
- `registrarseEnSesion()`: Inscribirse en una sesión
- `cancelarRegistro()`: Cancelar inscripción
- `puedeIngresar()`: Valida si el usuario puede ingresar ahora
- `obtenerTiempoRestante()`: Calcula tiempo hasta el inicio
- `generarArchivoICS()`: Genera archivo de calendario
- `descargarICS()`: Descarga archivo .ics
- `copiarAlPortapapeles()`: Copia texto al portapapeles

### 3. Página Principal - Aula Digital
**Archivo:** `src/pages/SegurosEducationAulaDigital.tsx`

**Características:**
- ✅ **Directorio de sesiones** con tarjetas compactas
- ✅ **Secciones separadas**:
  - En Vivo Ahora (badge rojo pulsante)
  - Próximas Capacitaciones
  - Sesiones Finalizadas
- ✅ **Búsqueda avanzada**: Por título, compañía o ponente
- ✅ **Filtros**: Por estatus (programada, en_vivo, finalizada)
- ✅ **Botones contextuales**:
  - "Ingresar" (solo disponible 15 min antes y durante la sesión)
  - "Registrarme" (para sesiones futuras)
  - "Cancelar Registro" (si ya está registrado)
  - "Ver Detalles" (abre drawer lateral)
- ✅ **Vista de tarjeta** muestra:
  - Título, compañía, ponente
  - Fecha, hora, duración
  - Miniatura (si existe)
  - Estado y contador de registros/capacidad
  - Tiempo restante para inicio

**Modal de Creación (Administradores):**
- ✅ Formulario completo con todos los campos requeridos
- ✅ Validación de URL (link_acceso)
- ✅ Campo de clave con mostrar/ocultar
- ✅ Configuración de anticipación (minutos antes para ingresar)
- ✅ Capacidad opcional
- ✅ Campos opcionales: ponente_bio, ponente_foto_url, miniatura_url, tags

**Drawer de Detalles:**
- ✅ Panel lateral deslizable (no modal bloqueante)
- ✅ Información completa de la sesión
- ✅ Copiar enlace y clave al portapapeles con feedback visual
- ✅ Botón "Ingresar" (abre enlace en nueva pestaña)
- ✅ Botón "Agregar a Calendario" (descarga .ics)
- ✅ Botones de registro/cancelación
- ✅ Admin: botón eliminar sesión

### 4. Componente de Dashboard
**Archivo:** `src/components/ProximasCapacitaciones.tsx` (actualizado)

**Cambios:**
- ✅ Ahora usa `obtenerSesionesProgramadas()` en lugar de aula virtual
- ✅ Muestra hasta 5 próximas capacitaciones
- ✅ Muestra: compañía, ponente, fecha, hora
- ✅ Enlace directo a Aula Digital
- ✅ Ordenado cronológicamente

### 5. Actualizaciones de Navegación

**Archivo:** `src/App.tsx`
- ✅ Nueva ruta: `/seguros-education/aula-virtual` → `SegurosEducationAulaDigital`
- ✅ Ruta anterior movida a: `/seguros-education/aula-virtual-old` (oculta, solo compatibilidad)

**Archivo:** `src/pages/SegurosEducation.tsx`
- ✅ Texto actualizado: "Aula Virtual" → "Aula Digital"
- ✅ Descripción: "Capacitaciones programadas y eventos en vivo"
- ✅ Enlace apunta a nueva implementación

---

## Flujo de Usuario

### Para Administradores:

1. **Crear Sesión:**
   - Click en "Nueva Sesión"
   - Llenar formulario (título, compañía, ponente, descripción, fecha, hora, link, clave)
   - Opcional: miniatura, capacidad, oficinas asignadas
   - Sistema valida URL y campos requeridos

2. **Gestionar Sesiones:**
   - Ver todas las sesiones (publicadas y no publicadas)
   - Editar sesiones existentes
   - Eliminar sesiones
   - Cambiar estatus (programada → en_vivo → finalizada)
   - Ver lista de registrados

### Para Empleados/Agentes/Gerentes:

1. **Explorar Capacitaciones:**
   - Ver directorio de sesiones publicadas
   - Filtrar por estado y buscar
   - Ver sesiones de su oficina (si hay filtro)

2. **Registrarse:**
   - Click en "Registrarme"
   - Sistema verifica capacidad disponible
   - Confirmación visual

3. **Asistir a Sesión:**
   - 15 minutos antes: botón "Ingresar" se habilita
   - Click en "Ingresar" → abre enlace externo en nueva pestaña
   - Clave de acceso visible para copiar

4. **Gestionar Registros:**
   - Ver sesiones en las que está registrado
   - Cancelar registro si es necesario
   - Descargar evento a calendario (.ics)

---

## Funcionalidades Clave

### ✅ Control de Acceso Temporal
```typescript
puedeIngresar(sesion):
  - Verifica que falten menos de X minutos para inicio
  - O que la sesión ya haya iniciado
  - Y que no haya finalizado
  - Y que no esté cancelada
```

### ✅ Gestión de Capacidad
```typescript
Al registrarse:
  - Verifica si hay capacidad configurada
  - Cuenta registros actuales
  - Bloquea si se alcanzó el límite
```

### ✅ Filtros por Oficina
```typescript
oficinas_asignadas:
  - [] (vacío) = visible para todos
  - [id1, id2] = solo visible para usuarios de esas oficinas
```

### ✅ Integración de Calendario
```typescript
generarArchivoICS():
  - Genera archivo .ics estándar
  - Incluye: título, fecha, hora, duración, ubicación (link), descripción
  - Agrega alarma 15 min antes
  - Compatible con Google Calendar, Outlook, Apple Calendar
```

### ✅ Notificaciones (Pendiente de Implementar)
```typescript
// TODO: Integrar con sistema de notificaciones
Disparar notificación cuando:
  - Admin crea/publica nueva sesión
  - Faltan 15 min para inicio (usuarios registrados)
  - Sesión cambia a "en_vivo"
```

---

## Diferencias vs Sistema Anterior

| Aspecto | Aula Virtual (Anterior) | Aula Digital (Nuevo) |
|---------|-------------------------|----------------------|
| **Tecnología** | WebRTC propio | Enlaces externos (Zoom, Teams, etc.) |
| **Complejidad** | Alta (servidor WebRTC, peer connections) | Baja (solo gestión de enlaces) |
| **Creación** | Requería configuración técnica | Formulario simple con URL |
| **Acceso** | Sistema propio de videoconferencia | Abre plataforma externa |
| **Grabaciones** | Sistema propio de grabación | La plataforma externa maneja grabaciones |
| **Mantenimiento** | Alto (infraestructura WebRTC) | Bajo (solo base de datos) |
| **Escalabilidad** | Limitada por servidor | Ilimitada (usa plataforma externa) |
| **UX** | Compleja (entrar a sala, permisos, etc.) | Simple (click → abre enlace) |

---

## Estado del Build

```bash
✓ 2450 modules transformed
✓ built in 8.20s

Bundle sizes:
- CSS: 290.12 kB (40.36 kB gzipped)
- JS: 942.33 kB (226.04 kB gzipped)
```

**Estado:** ✅ **Compilación exitosa**

---

## Próximos Pasos (Opcional)

### 1. Integración de Notificaciones
- [ ] Disparar notificación al crear sesión
- [ ] Recordatorio 15 min antes del inicio
- [ ] Notificación cuando sesión pasa a "en_vivo"

### 2. Analytics y Reportes
- [ ] Dashboard de admin con estadísticas
- [ ] Exportar lista de asistentes a CSV
- [ ] Reportes de asistencia por oficina

### 3. Mejoras UX
- [ ] Vista de calendario mensual
- [ ] Búsqueda por fecha range
- [ ] Filtro por tags/categorías
- [ ] Compartir sesión por QR

### 4. Automatización
- [ ] Cron job para cambiar estatus automáticamente:
  - `programada` → `en_vivo` al llegar la hora
  - `en_vivo` → `finalizada` después de duración_minutos
- [ ] Recordatorios automáticos por email

### 5. Integración con On Demand
- [ ] Botón "Convertir a On Demand" en sesiones finalizadas
- [ ] Subir grabación y crear curso automáticamente
- [ ] Vincular sesión original con curso On Demand

---

## Instrucciones de Despliegue

### 1. Aplicar Migración
```bash
# La migración ya está creada en:
supabase/migrations/20251106000000_create_education_sesiones_programadas.sql

# Se debe aplicar usando las herramientas de Supabase
# (La migración se aplicará automáticamente en el próximo despliegue)
```

### 2. Verificar RLS
```sql
-- Verificar que las políticas RLS estén activas
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('education_sesiones_programadas', 'education_sesiones_registro');
```

### 3. Datos de Prueba (Opcional)
```sql
-- Crear sesión de prueba
INSERT INTO education_sesiones_programadas (
  titulo, compania, ponente, descripcion,
  fecha, hora, duracion_minutos,
  link_acceso, clave_acceso,
  estatus, publicada, creado_por
) VALUES (
  'Introducción a Seguros de Vida',
  'AXA Seguros',
  'María González',
  'Capacitación básica sobre productos de seguros de vida y sus beneficios.',
  CURRENT_DATE + INTERVAL '7 days',
  '10:00:00',
  60,
  'https://zoom.us/j/123456789',
  'seguros2024',
  'programada',
  true,
  (SELECT id FROM usuarios WHERE rol = 'Administrador' LIMIT 1)
);
```

---

## Soporte y Contacto

Para reportar bugs o solicitar nuevas funcionalidades, contacta al equipo de desarrollo.

**Versión:** 1.0.0
**Fecha:** 6 de Noviembre, 2025
**Estado:** ✅ Producción Ready
