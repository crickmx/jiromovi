# Intranet JIRO by MOVI Digital

Sistema completo de gestión de empleados, directorio, vacaciones, reuniones y multicotizador digital con control de acceso basado en roles, desarrollado completamente en español.

## ⚠️ IMPORTANTE: Antes de Desplegar

**Si la aplicación no carga en app.movi.digital**, lee estos archivos en orden:

1. 📖 **[README_IMPORTANTE.md](README_IMPORTANTE.md)** - Solución rápida (3 minutos)
2. 📋 **[RESUMEN_DESPLIEGUE.md](RESUMEN_DESPLIEGUE.md)** - Explicación del problema
3. 🔧 **[SOLUCION_DEFINITIVA.md](SOLUCION_DEFINITIVA.md)** - Cambios implementados
4. 🌐 **[CONFIGURACION_DOMINIO.md](CONFIGURACION_DOMINIO.md)** - Guía por plataforma

**TL;DR:** Necesitas configurar las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en tu plataforma de hosting y hacer redeploy.

## Características Principales

### Roles de Usuario

- **Administrador**: Acceso completo al sistema, gestión de usuarios, configuración de permisos, y administración de oficinas
- **Empleado**: Acceso a su perfil personal con campos editables según configuración
- **Agente**: Acceso a su perfil personal con campos editables según configuración

### Funcionalidades

#### Para Administradores
- Crear, editar y eliminar usuarios (Empleados y Agentes)
- Asignar y modificar contraseñas
- Configurar qué campos pueden editar cada rol
- Gestionar oficinas (crear, editar, eliminar, activar/desactivar)
- Ver directorio completo de usuarios con filtros avanzados
- Búsqueda por nombre, apellidos, correo, teléfono
- Filtrar por rol y oficina
- Activar/desactivar cuentas de usuario

#### Para Empleados y Agentes
- Ver su perfil completo
- Editar campos autorizados por el administrador
- Actualizar imagen de perfil (si está permitido)
- Ver información de contacto y datos laborales

### Campos de Perfil

Cada usuario tiene los siguientes campos por defecto:

1. Nombre
2. Apellidos
3. Rol
4. Puesto
5. Oficina
6. Fecha de Nacimiento
7. Fecha de Ingreso
8. Celular Personal
9. Email Personal
10. Celular Laboral
11. Email Laboral
12. Extensión Telefónica
13. URL Web Jiro
14. URL Web Multicotizador
15. Imagen de Perfil

## Tecnologías Utilizadas

- **Frontend**: React 18 + TypeScript
- **Estilos**: Tailwind CSS
- **Enrutamiento**: React Router DOM
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Iconos**: Lucide React
- **Build Tool**: Vite

## Requisitos Previos

- Node.js 18+ instalado
- npm o yarn
- Cuenta de Supabase (ya configurada en este proyecto)

## Instalación

1. **Instalar dependencias**:
```bash
npm install
```

2. **Variables de entorno**:

Las variables de entorno ya están configuradas en el archivo `.env`:
- `VITE_SUPABASE_URL`: URL de tu proyecto Supabase
- `VITE_SUPABASE_ANON_KEY`: Clave pública de Supabase

3. **Base de datos**:

La base de datos ya ha sido configurada automáticamente con:
- Tabla de usuarios
- Tabla de oficinas (con "Oficina Principal" por defecto)
- Tabla de permisos de campos (con permisos por defecto)
- Políticas de seguridad RLS habilitadas

## Crear el Primer Administrador

Para crear el primer usuario administrador, necesitas usar la consola de Supabase:

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a "Authentication" > "Users"
3. Haz clic en "Add user" > "Create new user"
4. Ingresa:
   - Email: `admin@tuempresa.com` (o el que prefieras)
   - Password: Crea una contraseña segura
   - Marca "Auto Confirm User"
5. Copia el User ID generado
6. Ve a "SQL Editor" y ejecuta:

```sql
INSERT INTO usuarios (
  id,
  username,
  rol,
  nombre,
  apellidos,
  email_laboral,
  activo
) VALUES (
  '564631d6-ad86-483c-899e-df2a4bc4626f',
  'admin',
  'Administrador',
  'Administrador',
  'Principal',
  'admin@tuempresa.com',
  true
);
```

Ahora puedes iniciar sesión con:
- Email: `admin@tuempresa.com`
- Password: La contraseña que creaste

## Uso del Sistema

### Iniciar el Servidor de Desarrollo

```bash
npm run dev
```

El sistema estará disponible en `http://localhost:5173`

### Compilar para Producción

```bash
npm run build
```

### Vista Previa de Producción

```bash
npm run preview
```

## Flujo de Trabajo

### Como Administrador

1. **Crear Usuarios**:
   - Ve a "Directorio" > "Nuevo Usuario"
   - Completa todos los campos requeridos
   - Asigna un correo y contraseña inicial
   - El usuario recibirá estas credenciales para acceder

2. **Configurar Permisos**:
   - Ve a "Configuración"
   - Marca qué campos son visibles y editables para Empleados y Agentes
   - Guarda la configuración

3. **Gestionar Oficinas**:
   - Ve a "Oficinas"
   - Crea, edita o elimina oficinas
   - Activa/desactiva oficinas según sea necesario

4. **Filtrar y Buscar**:
   - En "Directorio", usa los filtros de rol y oficina
   - Busca por nombre, correo, o teléfono en tiempo real

### Como Empleado/Agente

1. **Iniciar Sesión**:
   - Usa el correo y contraseña proporcionados por el administrador
   - Serás redirigido automáticamente a tu perfil

2. **Editar Perfil**:
   - Ve a "Mi Perfil"
   - Edita solo los campos que estén habilitados (no deshabilitados)
   - Guarda los cambios

3. **Actualizar Foto de Perfil**:
   - Si está permitido, pasa el cursor sobre tu foto de perfil
   - Haz clic en el ícono de carga
   - Selecciona una imagen

## Seguridad

- **Row Level Security (RLS)**: Habilitado en todas las tablas
- **Políticas restrictivas**: Los usuarios solo pueden acceder a sus propios datos
- **Contraseñas**: Gestionadas de forma segura por Supabase Auth
- **Tokens JWT**: Autenticación basada en tokens
- **Validación de roles**: En frontend y backend

## Estructura del Proyecto

```
src/
├── components/
│   ├── Layout.tsx              # Layout principal con navegación
│   ├── ProtectedRoute.tsx      # Rutas protegidas por autenticación
│   └── UserModal.tsx           # Modal para crear/editar usuarios
├── contexts/
│   └── AuthContext.tsx         # Contexto de autenticación
├── lib/
│   ├── supabase.ts            # Cliente de Supabase
│   └── database.types.ts      # Tipos TypeScript generados
├── pages/
│   ├── Login.tsx              # Página de inicio de sesión
│   ├── Perfil.tsx             # Página de perfil de usuario
│   ├── Directorio.tsx         # Directorio de usuarios (Admin)
│   ├── Oficinas.tsx           # Gestión de oficinas (Admin)
│   └── Configuracion.tsx      # Configuración de permisos (Admin)
└── App.tsx                    # Componente principal con rutas
```

## Soporte y Contacto

Para soporte técnico o consultas sobre el sistema, contacta al administrador del sistema.

## Licencia

Sistema propietario para uso interno de la empresa.
