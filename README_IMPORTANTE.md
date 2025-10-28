# ⚠️ IMPORTANTE: Antes de Desplegar a app.movi.digital

## 🚨 PROBLEMA: La app NO carga en app.movi.digital

Si la aplicación funciona en el preview local pero muestra pantalla en blanco o error en app.movi.digital, es porque:

**Las variables de entorno NO están configuradas en tu plataforma de hosting**

## ✅ SOLUCIÓN RÁPIDA (3 minutos)

### 1. Configurar Variables de Entorno

Dependiendo de dónde esté desplegado app.movi.digital:

#### Si usas Netlify:
1. Ve a: https://app.netlify.com/
2. Selecciona tu sitio
3. Site Settings → Environment Variables
4. Agrega estas dos variables:

```
VITE_SUPABASE_URL=https://akkbisolbjkusbuihrad.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra2Jpc29sYmprdXNidWlocmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzkwNDAsImV4cCI6MjA3NjY1NTA0MH0.iJf04oJv0ERuyWyY0gLpd7ntP6bITJ8LWxGFKJNSLvQ
```

5. Guarda
6. Deploys → Trigger deploy → Clear cache and deploy site

#### Si usas Vercel:
1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Settings → Environment Variables
4. Agrega las dos variables de arriba
5. Marca: Production, Preview, Development
6. Save
7. Deployments → Redeploy

#### Si usas otra plataforma:
Ver archivo `CONFIGURACION_DOMINIO.md` para instrucciones específicas.

### 2. Configurar Supabase

1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Settings → Authentication → URL Configuration
4. Site URL: `https://app.movi.digital`
5. Redirect URLs: Agrega `https://app.movi.digital/*`
6. Settings → API → CORS: Agrega `https://app.movi.digital`
7. Save

### 3. Verificar

1. Espera a que termine el deploy (1-2 minutos)
2. Abre: https://app.movi.digital
3. Debería mostrar la pantalla de login
4. Abre DevTools (F12) → Console
5. NO debería haber error "Faltan las variables de entorno"

## ❓ Por Qué Sucede Esto

**Build Time vs Runtime:**

Las variables de Vite se embeben durante la compilación (`npm run build`), no en tiempo de ejecución. Si las variables no están configuradas cuando se ejecuta el build en producción, el código compilado no tendrá las credenciales de Supabase.

```javascript
// Tu código:
const url = import.meta.env.VITE_SUPABASE_URL;

// Con variables configuradas → Build embebe el valor:
const url = "https://akkbisolbjkusbuihrad.supabase.co"; ✅

// Sin variables → Build deja undefined:
const url = undefined; ❌
```

**Por qué funciona en preview local:**
- El preview tiene acceso al archivo `.env` local
- La plataforma de hosting NO tiene acceso al `.env` (está en `.gitignore`)
- Debes configurar las variables en la plataforma

## 📚 Más Información

- `RESUMEN_DESPLIEGUE.md` - Explicación detallada del problema
- `CONFIGURACION_DOMINIO.md` - Guía completa de configuración por plataforma
- `SOLUCION_LOGIN.md` - Solución al problema de login (ya resuelto)
- `USUARIOS_VERIFICADOS.md` - Estado del sistema y usuarios

## ✅ Checklist

- [ ] Variables de entorno agregadas en la plataforma de hosting
- [ ] Nombres exactos: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- [ ] Redeploy ejecutado después de agregar variables
- [ ] URLs configuradas en Supabase Dashboard
- [ ] CORS configurado en Supabase
- [ ] Dominio app.movi.digital apunta al hosting

## 🎯 Resultado

Después de completar los pasos:

✅ App carga en app.movi.digital
✅ Login funciona correctamente
✅ Todos los usuarios pueden acceder
✅ Sin errores en consola

---

**⚠️ RECUERDA: Sin las variables de entorno configuradas en tu plataforma de hosting, la aplicación NO funcionará en producción.**
