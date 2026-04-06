# Sistema de Registro de Personal - MOVI Digital

## Descripción General

Sistema completo para registro de empleados internos con rol "Empleado", generando automáticamente su usuario de plataforma en estado inactivo hasta que sea activado manualmente por un Administrador.

## Características Implementadas

### ✅ Base de Datos
- Tabla `usuarios` con campos completos para empleados
- Tabla `oficinas` para catálogo de oficinas
- Tabla `auditoria_usuarios` para registro de operaciones
- Políticas RLS restrictivas (solo administradores pueden crear usuarios)
- Triggers automáticos para `updated_at`

### ✅ Backend Seguro
- **Edge Function**: `registrar-empleado`
  - Validación de permisos (solo administradores)
  - Generación automática de contraseñas seguras (16 caracteres)
  - Creación de usuario en Supabase Auth
  - Creación de perfil interno
  - Usuario queda con `activo: false` y `status: 'pendiente_activacion'`
  - Registro en auditoría

### ✅ Frontend
- **Ruta**: `/registro-personal`
- **Acceso**: Solo administradores (protegido con `ProtectedRoute`)
- Formulario organizado en 4 secciones:
  1. Datos Personales
  2. Datos Laborales
  3. Equipo Asignado
  4. Foto de Perfil

## Campos del Formulario

### Datos Personales
- **Nombre** (obligatorio)
- **Apellidos** (obligatorio)
- **Fecha de Nacimiento** (obligatorio)

### Datos Laborales
- **Puesto** (obligatorio)
- **Oficina** (obligatorio, select desde catálogo)
- **Fecha de Ingreso a JIRO** (obligatorio)
- **Celular Laboral** (Línea JIRO) (obligatorio)
- **E-Mail Laboral** (JIRO) (obligatorio, único)
- **Extensión Telefónica** (opcional)

### Equipo Asignado
- **Marca de Equipo de Cómputo** (obligatorio)
- **Modelo de Equipo de Cómputo** (obligatorio)
- **Marca de Equipo Celular** (obligatorio)
- **Modelo de Equipo Celular** (obligatorio)

### Foto de Perfil
- Carga de imagen (opcional)
- Preview en tiempo real
- Máximo 5MB
- Formatos: JPG, PNG, GIF

## Flujo de Registro

1. **Administrador accede** a `/registro-personal`
2. **Completa el formulario** con todos los datos del empleado
3. **Sistema valida** todos los campos obligatorios
4. **Edge Function procesa**:
   - Valida permisos del administrador
   - Verifica que el email no esté registrado
   - Genera contraseña aleatoria segura
   - Crea usuario en Supabase Auth
   - Crea perfil en tabla `usuarios`
   - Marca usuario como `activo: false`
   - Registra operación en auditoría
5. **Usuario queda pendiente** de activación

## Estado del Usuario Creado

```json
{
  "rol": "Empleado",
  "activo": false,
  "status": "pendiente_activacion"
}
```

## Seguridad

### Generación de Contraseñas
- 16 caracteres mínimo
- Incluye mayúsculas, minúsculas, números y caracteres especiales
- Aleatorias y seguras

### Protección de Rutas
- Solo administradores activos pueden acceder
- Verificación en frontend y backend
- Usuarios inactivos no pueden iniciar sesión

### Auditoría
Todas las operaciones se registran en `auditoria_usuarios`:
```json
{
  "usuario_id": "uuid",
  "accion": "crear_empleado",
  "realizado_por": "uuid_admin",
  "detalles": {
    "nombre": "...",
    "apellidos": "...",
    "email_laboral": "...",
    "puesto": "...",
    "oficina_id": "...",
    "rol": "Empleado"
  }
}
```

## Activación Posterior

El usuario NO puede iniciar sesión hasta que un administrador:
1. Acceda al módulo de gestión de usuarios
2. Active manualmente la cuenta
3. Cambie `activo` de `false` a `true`

Al activar:
- Usuario puede iniciar sesión con su email laboral
- Debe usar la contraseña generada automáticamente
- El sistema puede enviar la contraseña por email o permitir reset

## Validaciones

### Frontend
- Campos obligatorios marcados con asterisco rojo
- Validación inline con mensajes de error
- Validación de formato de email
- Validación de tamaño y tipo de imagen

### Backend
- Validación de permisos
- Verificación de email único
- Validación de campos obligatorios
- Manejo de errores con rollback automático

## Mensajes

### Éxito
```
Empleado registrado correctamente. El usuario fue creado con estatus
pendiente de activación y deberá ser activado por un administrador
antes de poder ingresar.
```

### Errores
- "No tiene permisos para realizar esta operación"
- "El email laboral ya está registrado"
- "Faltan campos obligatorios"
- "Error al crear usuario de autenticación"

## Estructura de Archivos

```
src/
├── pages/
│   └── RegistroPersonal.tsx        # Página principal del formulario
├── components/
│   └── ProtectedRoute.tsx          # Protección de rutas
├── context/
│   └── AuthContext.tsx             # Contexto de autenticación
├── lib/
│   └── supabase.ts                 # Cliente de Supabase
└── types/
    └── index.ts                    # Tipos TypeScript

supabase/
└── functions/
    └── registrar-empleado/
        └── index.ts                # Edge Function de registro
```

## Configuración Requerida

### Variables de Entorno (.env)
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### Permisos de Storage
Se requiere un bucket `avatars` para las fotos de perfil.

## Testing

Para probar el sistema:

1. **Crear un usuario administrador** en Supabase:
```sql
INSERT INTO usuarios (id, email, nombre, apellidos, rol, activo, status)
VALUES (
  'auth-user-id',
  'admin@jiro.com.mx',
  'Admin',
  'Sistema',
  'Administrador',
  true,
  'activo'
);
```

2. **Iniciar sesión** como administrador

3. **Navegar** a `/registro-personal`

4. **Completar** el formulario y registrar un empleado

5. **Verificar** en la base de datos que:
   - Usuario aparece en `usuarios` con `activo: false`
   - Operación registrada en `auditoria_usuarios`
   - Usuario no puede iniciar sesión

## Próximos Pasos Sugeridos

1. **Módulo de Gestión de Usuarios**
   - Listar usuarios pendientes
   - Activar/desactivar usuarios
   - Editar información de empleados

2. **Notificaciones**
   - Email al crear usuario
   - Email al activar usuario
   - Envío de credenciales

3. **Reset de Contraseña**
   - Función para resetear contraseña
   - Email con nueva contraseña o link temporal

## Comandos

```bash
# Desarrollo
npm run dev

# Build (sin verificación TypeScript de archivos antiguos)
npm run build

# Build con verificación completa
npm run build:check

# Preview
npm run preview
```

## Notas Técnicas

- Build configurado para omitir verificación TypeScript de archivos antiguos
- Tailwind CSS configurado con `@import "tailwindcss"` (v4+)
- Edge Function deployada en Supabase
- RLS habilitado en todas las tablas

## Soporte

Para issues o mejoras, contactar al equipo de desarrollo.
