# Configuración de Dominio para app.movi.digital

## Problemas Identificados y Resueltos

### ❌ Problema 1: Restricciones de dominio en Supabase
El sistema no permitía iniciar sesión desde app.movi.digital debido a restricciones de configuración.

### ✅ Problema 2: Desincronización de emails (RESUELTO)
**Estado:** CORREGIDO mediante migración de base de datos

Había inconsistencias entre los emails en `auth.users` y `usuarios.email_laboral`:
- Algunos usuarios tenían emails diferentes en ambas tablas
- Esto causaba que el sistema de autenticación no encontrara al usuario después del login
- **Solución aplicada:** Migración automática que sincronizó todos los emails
- **Prevención futura:** Trigger automático mantiene la sincronización en tiempo real

**Usuarios verificados y sincronizados:**
- ✅ ccjimenez@jiro.com.mx (Administrador)
- ✅ ccjimenez@jiro.mx (Gerente)
- ✅ zacatecas@jiro.mx (Empleado)
- ✅ pjimenez@jiro.mx (Empleado)

## Soluciones Implementadas en el Código

### 1. Cliente de Supabase Optimizado
- ✅ Configurado `autoRefreshToken: true` para renovar tokens automáticamente
- ✅ Configurado `persistSession: true` para mantener la sesión
- ✅ Configurado `detectSessionInUrl: true` para detectar sesiones en URLs
- ✅ Configurado `flowType: 'pkce'` para mayor seguridad
- ✅ Storage personalizado con clave `movi-auth`

### 2. Manejo de Errores Mejorado
- ✅ Mensajes de error específicos según el tipo de problema
- ✅ Logs detallados en consola para debugging
- ✅ Validación de usuarios activos antes de permitir acceso

### 3. Redirecciones SPA
- ✅ Archivo `_redirects` para Netlify
- ✅ Archivo `netlify.toml` con configuración completa
- ✅ Archivo `vercel.json` para compatibilidad con Vercel

## Configuración Requerida en Supabase

### PASO 1: Configurar URLs Permitidas

Debes ir al Dashboard de Supabase y configurar las siguientes URLs:

**Ruta:** Project Settings → Authentication → URL Configuration

#### Site URL:
```
https://app.movi.digital
```

#### Redirect URLs (agregar todas):
```
https://app.movi.digital
https://app.movi.digital/*
https://app.movi.digital/login
https://app.movi.digital/reset-password
http://localhost:5173
http://localhost:5173/*
```

### PASO 2: Configurar Dominios Adicionales

**Ruta:** Project Settings → API → Additional Domains

Agregar:
```
app.movi.digital
```

### PASO 3: Verificar Configuración de Email Auth

**Ruta:** Authentication → Providers → Email

Asegurarse de que:
- ✅ Email provider está habilitado
- ✅ "Confirm email" está deshabilitado (si no quieres confirmación)
- ✅ "Secure email change" está habilitado
- ✅ "Double confirm email changes" según preferencia

### PASO 4: Configurar CORS

**Ruta:** Project Settings → API → CORS

Agregar dominios permitidos:
```
https://app.movi.digital
http://localhost:5173
```

## Variables de Entorno en Producción

Asegúrate de que las siguientes variables estén configuradas en tu servicio de hosting:

```bash
VITE_SUPABASE_URL=https://akkbisolbjkusbuihrad.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra2Jpc29sYmprdXNidWlocmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzkwNDAsImV4cCI6MjA3NjY1NTA0MH0.iJf04oJv0ERuyWyY0gLpd7ntP6bITJ8LWxGFKJNSLvQ
```

## Configuración en Netlify

Si usas Netlify:

1. **Variables de Entorno:**
   - Ir a Site settings → Build & deploy → Environment
   - Agregar las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

2. **Dominio Personalizado:**
   - Ir a Domain settings → Add custom domain
   - Agregar app.movi.digital
   - Configurar DNS según instrucciones

## Configuración en Vercel

Si usas Vercel:

1. **Variables de Entorno:**
   - Ir a Project Settings → Environment Variables
   - Agregar las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

2. **Dominio Personalizado:**
   - Ir a Settings → Domains
   - Agregar app.movi.digital
   - Configurar DNS según instrucciones

## Verificación Post-Configuración

Después de realizar los cambios:

1. **Limpiar caché del navegador:**
   ```
   - Chrome: Ctrl+Shift+Delete
   - Firefox: Ctrl+Shift+Delete
   - Safari: Cmd+Option+E
   ```

2. **Limpiar localStorage:**
   - Abrir DevTools (F12)
   - Ir a Application/Storage → Local Storage
   - Eliminar todos los items del dominio

3. **Verificar en consola:**
   - Abrir DevTools (F12)
   - Ir a Console
   - Intentar iniciar sesión
   - Verificar que no haya errores CORS o de autenticación

## Debugging

Si sigue sin funcionar:

1. **Verificar en Consola del Navegador:**
   ```javascript
   // Ver configuración de Supabase
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)

   // Ver sesión actual
   supabase.auth.getSession().then(console.log)
   ```

2. **Verificar Network Tab:**
   - Buscar requests a `supabase.co`
   - Verificar que no haya errores 403 o 401
   - Verificar headers CORS

3. **Verificar Logs de Supabase:**
   - Ir a Dashboard → Logs
   - Filtrar por Authentication
   - Buscar errores relacionados con el dominio

## Contacto para Soporte

Si después de seguir estos pasos el problema persiste:
1. Revisar los logs de consola del navegador
2. Revisar los logs de Supabase Dashboard
3. Verificar que todas las URLs estén correctamente configuradas
4. Asegurarse de que el DNS del dominio esté correctamente apuntando al hosting

## Archivos Modificados

Los siguientes archivos fueron modificados para resolver el problema:

- ✅ `src/lib/supabase.ts` - Cliente optimizado con PKCE
- ✅ `src/contexts/AuthContext.tsx` - Manejo de errores mejorado
- ✅ `src/pages/Login.tsx` - Mensajes de error específicos
- ✅ `public/_redirects` - Redirecciones para SPA
- ✅ `netlify.toml` - Configuración Netlify
- ✅ `vercel.json` - Configuración Vercel
- ✅ `vite.config.ts` - Configuración del directorio público
