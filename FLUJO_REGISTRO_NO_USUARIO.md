# 🆕 Sistema de Registro "Aún no soy usuario"

**Fecha de Implementación:** 2026-01-27
**Estado:** ✅ COMPLETADO Y FUNCIONAL
**Versión:** 1.0.0

---

## 📋 Resumen Ejecutivo

Se implementó un sistema completo de registro para usuarios que aún no tienen cuenta en MOVI. El sistema captura información básica, crea tareas automáticas para seguimiento, y envía notificaciones multicanal (campanita, email, WhatsApp) a los equipos correspondientes.

---

## 🎯 Características Implementadas

### 1. CTA en Login
- ✅ Botón "Aún no soy usuario" visible debajo del botón de "Iniciar Sesión"
- ✅ Estilo: Link con hover y transición suave
- ✅ Navegación directa a `/registro`

**Ubicación:** `src/pages/Login.tsx:242-250`

---

### 2. Página de Registro `/registro`

**Archivo:** `src/pages/Registro.tsx`

#### Campos del Formulario

| Campo | Tipo | Validación | Obligatorio |
|-------|------|------------|-------------|
| Nombre | Text | No vacío | ✅ Sí |
| Apellidos | Text | No vacío | ✅ Sí |
| Email | Email | Formato válido | ✅ Sí |
| WhatsApp | Tel | 10 dígitos MX | ✅ Sí |
| ¿Es agente Grupo JIRO? | Radio (Sí/No) | Selección | ✅ Sí |
| Oficina | Select | Solo si es agente | Condicional |

#### Características UI
- ✅ Diseño responsive y profesional
- ✅ Validación en tiempo real
- ✅ Mensajes de error específicos por campo
- ✅ Loading states durante el envío
- ✅ Pantalla de éxito con información de contacto
- ✅ Conversión automática de WhatsApp a formato E.164 (521 + 10 dígitos)

#### Validaciones
```typescript
- Email: Regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/
- WhatsApp: Exactamente 10 dígitos numéricos
- Oficina: Obligatoria solo si selecciona "Sí, soy agente"
- Duplicados: Si el email ya existe con status "nuevo", muestra mensaje personalizado
```

---

### 3. Base de Datos

#### Tabla: `registro_interesados`

```sql
CREATE TABLE registro_interesados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  apellidos text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,                    -- Formato E.164: 521XXXXXXXXXX
  es_agente_jiro boolean NOT NULL,
  oficina_id uuid REFERENCES oficinas(id),
  status registro_status DEFAULT 'nuevo',     -- nuevo, contactado, descartado, convertido
  source text DEFAULT 'login_registro',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### Índices Creados
- `idx_registro_interesados_email` - Búsqueda rápida por email
- `idx_registro_interesados_status` - Filtrado por estado
- `idx_registro_interesados_oficina` - Consultas por oficina
- `idx_registro_interesados_created` - Ordenamiento por fecha

#### RLS (Row Level Security)
```sql
✅ Administradores: Ver todos los registros
✅ Gerentes: Ver solo registros de su oficina
✅ Administradores: Actualizar registros (cambiar status)
```

---

### 4. Sistema de Notificaciones

#### Tipo de Notificación: `nuevo_registro_no_usuario`

**Canales Activos:**
- ✅ Email (HTML con diseño profesional)
- ✅ WhatsApp (Wazzup24 - 5215588545516)
- ✅ Campanita (notificación in-app)

#### Variables Disponibles
```javascript
{
  nombre_completo: "Juan Pérez",
  email: "juan@ejemplo.com",
  whatsapp: "5215551234567",
  es_agente_texto: "Sí" | "No",
  oficina_nombre: "Oficina CDMX" | "N/A",
  fecha_registro: "27/01/2026 18:30",
  url_tarea: "https://movi.grupojiro.com/tramites/[id]"
}
```

#### Plantilla Email
```html
Asunto: Nuevo registro: Aún no soy usuario - {{nombre_completo}}

Contenido:
- Header con emoji y título
- Datos del interesado en tabla destacada
- Botón CTA: "Ver Tarea →"
- Footer con recordatorio de seguimiento
```

#### Plantilla WhatsApp
```
🆕 *Nuevo Registro - Aún no soy usuario*

*Nombre:* {{nombre_completo}}
*Email:* {{email}}
*WhatsApp:* {{whatsapp}}
*¿Agente JIRO?:* {{es_agente_texto}}
*Oficina:* {{oficina_nombre}}

📅 {{fecha_registro}}

Por favor, da seguimiento a esta solicitud.

{{url_tarea}}
```

---

### 5. Sistema de Tareas Automáticas

#### Creación de Tickets

La función `procesar_registro_no_usuario()` crea tareas automáticamente según el tipo de usuario:

**Caso A: Usuario ES agente de Grupo JIRO**

Destinatarios:
1. ✅ Todos los Gerentes de la oficina seleccionada
2. ✅ Todos los Administradores del sistema

Resultado: 1 tarea por gerente + 1 tarea por administrador

**Caso B: Usuario NO es agente**

Destinatarios:
1. ✅ Solo Administradores

Resultado: 1 tarea por administrador

#### Detalles del Ticket

```javascript
{
  titulo: "Nuevo registro: [Nombre Completo]",
  descripcion: `
    **Nuevo registro recibido**

    **Nombre completo:** Juan Pérez
    **Email:** juan@ejemplo.com
    **WhatsApp:** 5215551234567
    **¿Es agente Grupo JIRO?:** Sí
    **Oficina:** Oficina CDMX
    **Fecha de registro:** 27/01/2026 18:30

    Por favor, contacta a esta persona lo antes posible.
  `,
  categoria: "Lead – Registro MOVI",
  prioridad: "alta",
  estado: "abierto",
  metadata: {
    registro_id: "[uuid]",
    tipo: "registro_no_usuario"
  }
}
```

---

### 6. Función Principal: `procesar_registro_no_usuario()`

**Tipo:** PostgreSQL Function (SECURITY DEFINER)
**Acceso:** Usuarios autenticados y anónimos

#### Parámetros
```sql
p_nombre text,
p_apellidos text,
p_email text,
p_whatsapp text,
p_es_agente_jiro boolean,
p_oficina_id uuid DEFAULT NULL,
p_metadata jsonb DEFAULT '{}'::jsonb
```

#### Flujo de Ejecución
```
1. Validar email duplicado (status = 'nuevo')
   └─ Si existe → Retornar mensaje "Ya recibimos tu solicitud"

2. Validar oficina si es agente
   └─ Si es agente y no tiene oficina → Error

3. Crear registro en tabla registro_interesados
   └─ Status inicial: "nuevo"
   └─ WhatsApp en formato E.164

4. Determinar destinatarios según tipo
   ├─ Si es agente → Gerentes de oficina + Admins
   └─ Si NO es agente → Solo Admins

5. Para cada destinatario:
   ├─ Crear ticket en tabla tickets
   └─ Enviar notificación completa (3 canales)

6. Retornar resultado exitoso
```

#### Respuesta
```json
{
  "success": true,
  "message": "¡Listo! Recibimos tus datos. En breve un miembro del equipo te contactará.",
  "registro_id": "[uuid]"
}
```

---

## 🛡️ Seguridad y Validaciones

### Frontend
- ✅ Validación de formato de email
- ✅ Validación de 10 dígitos para WhatsApp
- ✅ Validación de campos obligatorios
- ✅ Prevención de caracteres no numéricos en teléfono
- ✅ Conversión automática a formato E.164

### Backend
- ✅ Función SECURITY DEFINER para acceso controlado
- ✅ Validación de email duplicado
- ✅ Validación de oficina obligatoria para agentes
- ✅ RLS habilitado en todas las tablas
- ✅ Manejo de excepciones con try-catch
- ✅ Logs de errores en caso de fallo

### Rate Limiting (Recomendado para Producción)
- ⚠️ Agregar rate limit por IP (ej: 5 registros/hora)
- ⚠️ Agregar CAPTCHA ligero (opcional pero recomendado)

---

## 📊 Flujo Completo Ilustrado

```
Usuario sin cuenta
      ↓
Clic en "Aún no soy usuario" (Login)
      ↓
Página /registro
      ↓
Completa formulario
      ↓
Valida campos
      ↓
Envía datos a procesar_registro_no_usuario()
      ↓
┌─────────────────────────────────────┐
│ 1. Crea registro en BD              │
│ 2. Identifica destinatarios         │
│ 3. Crea tareas automáticas          │
│ 4. Envía notificaciones multicanal  │
└─────────────────────────────────────┘
      ↓
┌──────────────────────────────────────┐
│ Gerentes / Admins reciben:          │
│ ✅ Campanita (in-app)                │
│ ✅ Email (bandeja de entrada)        │
│ ✅ WhatsApp (Wazzup24)               │
│ ✅ Tarea en módulo de Trámites       │
└──────────────────────────────────────┘
      ↓
Usuario ve mensaje de éxito
      ↓
Equipo contacta al interesado
```

---

## 🧪 Criterios de Aceptación (QA)

### ✅ Completos

1. ✅ En Login se ve "Aún no soy usuario" y abre `/registro`
2. ✅ En `/registro`:
   - ✅ Si elige "Sí" obliga selección de oficina
   - ✅ Si elige "No" oculta selector de oficina
   - ✅ Validaciones funcionan correctamente
3. ✅ Al enviar formulario:
   - ✅ Se guarda registro en BD con status "nuevo"
   - ✅ Se crean tareas según reglas de negocio
   - ✅ Se envían notificaciones por 3 canales
   - ✅ Gerentes solo reciben si es de su oficina
   - ✅ Admins siempre reciben notificaciones
4. ✅ No se rompe el flujo de login existente
5. ✅ Build exitoso sin errores

---

## 📁 Archivos Modificados/Creados

### Nuevos
1. ✅ `src/pages/Registro.tsx` - Página de registro
2. ✅ `supabase/migrations/create_registro_no_usuario_system.sql` - Migración completa

### Modificados
1. ✅ `src/pages/Login.tsx` - Agregado enlace "Aún no soy usuario"
2. ✅ `src/App.tsx` - Agregada ruta `/registro`

---

## 🚀 Próximos Pasos (Opcionales)

### Mejoras Futuras
- [ ] Dashboard para administrar registros
- [ ] Filtros por status (nuevo, contactado, etc.)
- [ ] Estadísticas de conversión
- [ ] Email de confirmación al usuario (actualmente comentado)
- [ ] WhatsApp de confirmación al usuario
- [ ] Integración con CRM para seguimiento
- [ ] Rate limiting por IP
- [ ] Google reCAPTCHA v3

---

## 📞 Información Técnica

### Endpoints
- Frontend: `https://movi.grupojiro.com/registro`
- Función SQL: `procesar_registro_no_usuario()`

### Notificaciones
- WhatsApp origen: `5215588545516` (Wazzup24)
- Email desde: Sistema de notificaciones transaccionales

### Permisos
- Acceso público a formulario: ✅ Sí
- RPC function pública: ✅ Sí (anon + authenticated)
- Visualización registros: Solo Admin y Gerentes

---

**Documentación completa del sistema de Registro "Aún no soy usuario"**

✅ Sistema listo para producción
✅ Todas las pruebas pasadas
✅ Build exitoso sin errores
