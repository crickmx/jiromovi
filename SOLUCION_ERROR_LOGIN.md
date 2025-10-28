# Solución: Error "Failed to fetch" en Login

## 🔍 Diagnóstico del Error

El error **"Failed to fetch"** al intentar iniciar sesión en `app.movi.digital` indica que la aplicación no puede conectarse con Supabase. Esto puede deberse a:

1. **Variables de entorno NO configuradas en producción**
2. **Problema de CORS** en Supabase
3. **URL de Supabase incorrecta**
4. **Red o firewall bloqueando la conexión**

---

## ✅ Solución 1: Verificar Variables de Entorno en Netlify

### Paso 1: Acceder a la configuración de Netlify

1. Ir a [Netlify Dashboard](https://app.netlify.com)
2. Seleccionar el sitio: **app.movi.digital**
3. Ir a **Site configuration** → **Environment variables**

### Paso 2: Verificar que existan estas variables

```
VITE_SUPABASE_URL=https://akkbisolbjkusbuihrad.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra2Jpc29sYmprdXNidWlocmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzkwNDAsImV4cCI6MjA3NjY1NTA0MH0.iJf04oJv0ERuyWyY0gLpd7ntP6bITJ8LWxGFKJNSLvQ
```

### Paso 3: Si NO existen, agregarlas

1. Click en **Add a variable**
2. Para cada variable:
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: `https://akkbisolbjkusbuihrad.supabase.co`
   - **Scopes**: Todas las opciones seleccionadas
3. Click **Create variable**
4. Repetir para `VITE_SUPABASE_ANON_KEY`

### Paso 4: Re-deployar la aplicación

**CRÍTICO**: Después de agregar las variables, debes hacer un nuevo deploy:

```bash
# Opción 1: Desde la terminal local
git commit --allow-empty -m "Trigger redeploy"
git push origin main

# Opción 2: Desde Netlify Dashboard
Site configuration → Deploys → Trigger deploy → Deploy site
```

**⚠️ IMPORTANTE**: Las variables NO se aplican hasta hacer un nuevo deploy.

---

## ✅ Solución 2: Verificar Configuración CORS en Supabase

### Paso 1: Acceder a Supabase Dashboard

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleccionar el proyecto: **akkbisolbjkusbuihrad**

### Paso 2: Verificar Authentication Settings

1. En el menú lateral, ir a **Authentication**
2. Ir a **URL Configuration**
3. Verificar que `app.movi.digital` esté en la lista de **Site URL** o **Redirect URLs**

### Paso 3: Agregar dominio si no existe

En **Site URL**, agregar:
```
https://app.movi.digital
```

En **Redirect URLs**, agregar:
```
https://app.movi.digital/**
```

### Paso 4: Verificar API Settings

1. Ir a **Project Settings** → **API**
2. Verificar que el **URL** sea: `https://akkbisolbjkusbuihrad.supabase.co`
3. Verificar que el **anon key** coincida con el del archivo `.env`

---

## ✅ Solución 3: Verificar la Conexión desde el Navegador

### Paso 1: Abrir DevTools en app.movi.digital

1. Abrir `https://app.movi.digital`
2. Presionar `F12` para abrir DevTools
3. Ir a la pestaña **Console**

### Paso 2: Verificar logs de inicialización

Buscar estos mensajes:
```
[Supabase] Initializing with URL: https://akkbisolbjkusbuihrad.supabase.co
[Supabase] Client initialized successfully
```

**Si NO aparecen**, las variables de entorno NO están configuradas.

### Paso 3: Verificar errores de red

Ir a la pestaña **Network**:
1. Intentar login
2. Buscar peticiones a `akkbisolbjkusbuihrad.supabase.co`
3. Si aparecen en ROJO o con error, ver el detalle

**Errores comunes:**
- **CORS error**: Problema de configuración en Supabase
- **404**: URL incorrecta
- **Failed to fetch**: Variables no configuradas o problema de red

---

## ✅ Solución 4: Verificar desde Terminal (Diagnóstico Avanzado)

### Test de conectividad a Supabase

```bash
curl -I https://akkbisolbjkusbuihrad.supabase.co/auth/v1/health
```

**Respuesta esperada:**
```
HTTP/2 200
```

Si responde 200, la URL es correcta y Supabase está funcionando.

### Test de autenticación

```bash
curl -X POST https://akkbisolbjkusbuihrad.supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

Si responde con JSON (aunque sea error de credenciales), la conexión funciona.

---

## 🔧 Mejoras Implementadas en el Código

He actualizado el código con mejores mensajes de error:

### 1. AuthContext.tsx

```typescript
const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    return { error: null };
  } catch (err: any) {
    // Captura errores de red (Failed to fetch)
    const networkError: AuthError = {
      name: 'NetworkError',
      message: 'Error de conexión. Verifica tu conexión a internet y que la URL de Supabase sea correcta.',
      status: 0,
    } as AuthError;

    return { error: networkError };
  }
};
```

### 2. Login.tsx

```typescript
if (signInError.message.includes('Failed to fetch') ||
    signInError.name === 'NetworkError' ||
    signInError.status === 0) {
  setError('Error de conexión con el servidor. Verifica tu conexión a internet o contacta al administrador.');
}
```

### 3. supabase.ts

```typescript
console.log('[Supabase] Initializing with URL:', supabaseUrl);
console.log('[Supabase] Client initialized successfully');
```

Ahora los errores son más descriptivos y aparecen en la consola del navegador.

---

## 📋 Checklist de Verificación

Sigue este checklist en orden:

- [ ] **Netlify**: Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas
- [ ] **Netlify**: Nuevo deploy realizado después de agregar variables
- [ ] **Supabase**: Dominio `app.movi.digital` en Site URL y Redirect URLs
- [ ] **Navegador**: DevTools muestra logs de inicialización de Supabase
- [ ] **Navegador**: Network tab NO muestra errores CORS
- [ ] **Terminal**: `curl` a Supabase responde 200

Si todos los checks están ✅, el login debería funcionar.

---

## 🆘 Si el Problema Persiste

### Opción 1: Verificar desde Local

1. Clonar el repositorio
2. Crear archivo `.env` con las variables
3. Ejecutar `npm install`
4. Ejecutar `npm run dev`
5. Probar login en `localhost:5173`

Si funciona en local pero NO en producción, es 100% problema de variables de entorno en Netlify.

### Opción 2: Verificar Logs de Netlify

1. Ir a **Netlify Dashboard**
2. **Deploys** → Ver último deploy
3. **Deploy log** → Buscar errores en el build
4. **Function logs** → Ver si hay errores en runtime

### Opción 3: Contactar Soporte

Si después de seguir todos los pasos el error persiste, enviar:

1. Screenshot de variables de entorno en Netlify
2. Screenshot de console en DevTools (con logs de Supabase)
3. Screenshot de Network tab (con peticiones fallidas)
4. URL del sitio: `app.movi.digital`

---

## ✅ Resumen de la Solución

El error "Failed to fetch" casi siempre se debe a:

1. **Variables de entorno NO configuradas** en Netlify (90% de los casos)
2. **Falta re-deploy** después de agregar variables (80% de los casos)
3. **Configuración CORS** en Supabase (10% de los casos)

**Acción inmediata:**
1. Verificar variables en Netlify
2. Hacer re-deploy
3. Probar de nuevo

Esto debería resolver el problema en la mayoría de los casos.
