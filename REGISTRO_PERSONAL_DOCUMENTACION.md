# Sistema de Registro de Personal - Documentación

## Descripción General

Sistema completo para registrar empleados internos de JIRO con rol **Empleado**, generando automáticamente su usuario de plataforma en estado **pendiente de activación** hasta que un Administrador lo active manualmente.

## Ruta de Acceso

**URL:** `/registro-personal`

**Permisos:** Solo Administradores

## Funcionalidad Principal

### Objetivo
Crear un formulario para alta de empleados internos que:
1. Genera usuario de autenticación con contraseña aleatoria segura
2. Crea perfil completo del empleado
3. Deja el usuario **inactivo** hasta activación manual por Administrador
4. Registra auditoría de la operación
5. Envía notificaciones a administradores

## Campos del Formulario

### 1. Datos Personales
- **Nombre** * (obligatorio)
- **Apellidos** * (obligatorio)
- **Fecha de Nacimiento** * (obligatorio)
- **Fecha de Ingreso a JIRO** * (obligatorio)

### 2. Datos Laborales
- **Puesto** * (obligatorio)
- **Oficina** * (obligatorio, selección de catálogo)
- **Celular Laboral (Línea JIRO)** * (obligatorio)
- **E-Mail Laboral (JIRO)** * (obligatorio, único, será el usuario de acceso)
- **Extensión Telefónica** (opcional)

### 3. Equipo Asignado
- **Marca de Equipo de Cómputo** * (obligatorio)
- **Modelo de Equipo de Cómputo** * (obligatorio)
- **Marca de Equipo Celular** * (obligatorio)
- **Modelo de Equipo Celular** * (obligatorio)

### 4. Foto de Perfil
- Carga opcional de imagen
- Máximo 5MB
- Vista previa en tiempo real
- Formatos: JPG, PNG, etc.

## Características Técnicas

### Contraseña Aleatoria Segura
- Longitud: 16 caracteres
- Incluye: mayúsculas, minúsculas, números y caracteres especiales
- Se genera automáticamente en el frontend
- Se guarda correctamente en el sistema de autenticación
- Fecha de generación registrada en `password_generated_at`

### Estado del Usuario Creado
- **rol:** `Empleado` (fijo)
- **status:** `pendiente_activacion`
- **activo:** `false`
- **email_confirm:** `false`

### Validaciones
✅ Todos los campos obligatorios validados
✅ Formato de email validado
✅ Email único (no duplicados)
✅ Formato de teléfono validado
✅ Tamaño de imagen validado (máx 5MB)
✅ Tipo de archivo validado (solo imágenes)

### Normalización de Datos
- Nombre y apellidos: MAYÚSCULAS automáticas
- Email laboral: minúsculas automáticas
- Campos vacíos opcionales: strings vacíos

## Flujo de Operación

### 1. Registro del Empleado
```
Usuario Administrador → Completa Formulario → Envía
  ↓
Edge Function: register-employee
  ↓
1. Valida permisos (solo Administrador)
2. Valida datos requeridos
3. Verifica email único
4. Genera usuario en auth (con contraseña)
5. Crea registro en tabla usuarios
6. Guarda auditoría
7. Envía notificación a administradores
  ↓
Usuario creado con status: pendiente_activacion
```

### 2. Activación Posterior
El usuario creado **NO puede iniciar sesión** hasta que un Administrador lo active desde:
- Módulo de Usuarios (`/directorio`)
- Perfil del Usuario (`/usuario/:id`)

Al activarlo:
- `status` cambia a `activo`
- `activo` cambia a `true`
- Se envían notificaciones de bienvenida con credenciales

## Componentes del Sistema

### Frontend
**Archivo:** `/src/pages/RegistroPersonal.tsx`

Componente React con:
- Formulario multi-sección
- Validación inline
- Carga de imagen con preview
- Generación de contraseña segura
- Manejo de errores
- Mensaje de éxito con redirección

### Backend
**Archivo:** `/supabase/functions/register-employee/index.ts`

Edge Function que:
- Valida autenticación y permisos
- Verifica unicidad de email
- Crea usuario en auth
- Inserta perfil completo
- Registra auditoría
- Envía notificaciones

### Base de Datos

#### Tabla: `usuarios`
Campos específicos del registro de personal:
- `status` - Estado del usuario (pendiente_activacion, activo)
- `activo` - Boolean de activación
- `equipo_computo_marca` - Marca del equipo de cómputo
- `equipo_computo_modelo` - Modelo del equipo de cómputo
- `equipo_celular_marca` - Marca del equipo celular
- `equipo_celular_modelo` - Modelo del equipo celular
- `created_by` - ID del administrador que creó el registro
- `password_generated_at` - Timestamp de generación de contraseña
- `fecha_ingreso_jiro` - Fecha de ingreso a la empresa

#### Tabla: `auditoria_usuarios`
Registro completo de operaciones:
- `id` - UUID
- `usuario_id` - Usuario afectado
- `accion` - Tipo de acción (crear, activar, etc.)
- `realizado_por` - Administrador que realizó la acción
- `detalles` - JSON con información adicional
- `created_at` - Timestamp

## Seguridad

### Permisos
- Solo **Administradores** pueden acceder a `/registro-personal`
- La Edge Function valida el rol antes de ejecutar
- RLS protege las operaciones en base de datos

### Auditoría
Cada registro de empleado genera:
1. Entrada en `auditoria_usuarios` con acción `crear`
2. Detalles completos de la operación
3. ID del administrador que realizó la acción

### Contraseña
- Generada con algoritmo criptográficamente seguro
- No se almacena en texto plano (solo hash en auth)
- Timestamp de generación guardado para auditoría

## Notificaciones

### Al Crear Empleado
Se envía notificación a todos los administradores con:
- Título: "Nuevo empleado registrado"
- Mensaje: Nombre completo del empleado
- Datos adicionales: email, puesto
- Acción URL: `/usuario/:id`

### Al Activar Empleado (posterior)
Se envía notificación de bienvenida al empleado con:
- Credenciales de acceso
- Link a su página web personal
- Información de su oficina
- Link al dashboard

## Mensajes al Usuario

### Éxito
```
Empleado registrado correctamente

El usuario fue creado con estatus pendiente de activación
y deberá ser activado por un administrador antes de poder
ingresar a la plataforma.

Redirigiendo al directorio...
```

### Errores Comunes
- "Ya existe un usuario con ese email laboral"
- "El nombre es obligatorio"
- "El email no es válido"
- "La imagen no debe superar 5MB"
- "Error al subir la imagen"

## Casos de Uso

### Caso 1: Registro de Nuevo Empleado
```
1. Administrador navega a /registro-personal
2. Completa todos los campos obligatorios
3. Opcionalmente carga foto de perfil
4. Envía el formulario
5. Sistema valida y crea usuario inactivo
6. Muestra mensaje de éxito
7. Redirige a /directorio después de 3 segundos
```

### Caso 2: Activación de Empleado
```
1. Administrador ve lista de usuarios pendientes
2. Selecciona usuario a activar
3. Cambia status a "activo"
4. Sistema envía notificaciones de bienvenida
5. Empleado puede iniciar sesión
```

## Mantenimiento y Soporte

### Logs
La Edge Function registra en consola:
- `[register-employee] Request body`
- `[register-employee] Creating auth user...`
- `[register-employee] Auth user created`
- `[register-employee] Inserting into usuarios table...`
- `[register-employee] User inserted successfully`
- `[register-employee] Notificando a administradores...`

### Troubleshooting

#### Problema: Email duplicado
**Error:** "Ya existe un usuario con ese email laboral"
**Solución:** Verificar en tabla usuarios si existe el email

#### Problema: No se puede subir imagen
**Error:** "Error al subir la imagen"
**Solución:** Verificar permisos del bucket `avatares` en Supabase Storage

#### Problema: Usuario no recibe notificación de activación
**Solución:** Verificar plantilla de notificación `cuenta_activada` en tabla `correo_plantillas`

## Mejoras Futuras

### Posibles Extensiones
1. Envío de credenciales por email al momento del registro
2. Generación automática de QR para acceso rápido
3. Integración con sistema de nómina
4. Carga masiva de empleados vía CSV
5. Workflow de aprobación multi-nivel
6. Generación automática de gafete digital

## Conclusión

El sistema de Registro de Personal proporciona una solución completa, segura y auditable para el alta de empleados internos, garantizando que cada nuevo empleado pase por un proceso de activación controlado por administradores antes de poder acceder a la plataforma.
