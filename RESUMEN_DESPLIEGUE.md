# 🚀 Resumen: Por qué la app no carga en app.movi.digital

## ❌ Problema Principal

**La aplicación funciona en el preview de Bolt pero NO en app.movi.digital (pantalla en blanco o error)**

## 🎯 Causa Raíz

**Las variables de entorno NO están configuradas en la plataforma de hosting**

Vite (el bundler que usamos) necesita las variables de entorno **DURANTE EL BUILD** para embeber los valores en el código compilado. Si las variables no están configuradas cuando se ejecuta `npm run build`, el código compilado no tendrá las credenciales de Supabase.

## 🔍 ¿Por qué funciona en Preview?

El preview de Bolt tiene acceso al archivo `.env` local, por eso funciona. Pero cuando despliegas a app.movi.digital:

1. El archivo `.env` NO se sube (está en `.gitignore`)
2. El código se compila sin las variables
3. La aplicación no puede conectarse a Supabase
4. Resultado: Pantalla en blanco o error "Faltan las variables de entorno"

## ✅ Solución (3 Pasos Críticos)

### Paso 1: Configurar Variables en tu Plataforma de Hosting

Debes agregar estas dos variables en la configuración de tu plataforma:

```
VITE_SUPABASE_URL=https://akkbisolbjkusbuihrad.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra2Jpc29sYmprdXNidWlocmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzkwNDAsImV4cCI6MjA3NjY1NTA0MH0.iJf04oJv0ERuyWyY0gLpd7ntP6bITJ8LWxGFKJNSLvQ
```

**¿Dónde configurarlas?**

- **Netlify:** Site Settings → Environment Variables
- **Vercel:** Settings → Environment Variables
- **Railway:** Variables tab
- **Render:** Environment → Add Environment Variable

Ver `CONFIGURACION_DOMINIO.md` para instrucciones detalladas de cada plataforma.

### Paso 2: Configurar URLs en Supabase Dashboard

Ve a tu proyecto en Supabase Dashboard:

**Authentication → URL Configuration:**
- Site URL: `https://app.movi.digital`
- Redirect URLs: Agregar `https://app.movi.digital/*`

**Project Settings → API:**
- CORS Allowed Origins: Agregar `https://app.movi.digital`

### Paso 3: Redeploy

Después de configurar las variables:

1. Haz un nuevo deploy (o trigger deploy con "Clear cache")
2. Espera a que termine el build
3. La aplicación ahora debería funcionar

## 🧪 Cómo Verificar si Está Configurado

### Opción 1: Ver el error
1. Abre https://app.movi.digital
2. Abre la consola del navegador (F12)
3. Si ves: **"Faltan las variables de entorno de Supabase"** → NO están configuradas
4. Si NO ves ese error → Están configuradas

### Opción 2: Ver el código compilado
1. Abre https://app.movi.digital
2. DevTools → Sources → assets → index-[hash].js
3. Busca (Ctrl+F): `akkbisolbjkusbuihrad`
4. Si lo encuentras → Variables embebidas correctamente
5. Si no lo encuentras → Variables NO configuradas durante el build

## 📊 Checklist de Despliegue

Antes de que funcione en app.movi.digital, necesitas:

- [ ] Variables de entorno configuradas en la plataforma de hosting
- [ ] Variables tienen los nombres exactos: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- [ ] Redeploy ejecutado DESPUÉS de agregar las variables
- [ ] URLs configuradas en Supabase Dashboard
- [ ] CORS configurado en Supabase
- [ ] Build completado sin errores

## 🎓 Explicación Técnica

### ¿Por qué necesito variables de entorno?

Vite usa "reemplazo estático" de variables en build time:

```javascript
// Tu código fuente:
const url = import.meta.env.VITE_SUPABASE_URL;

// Después del build CON variables:
const url = "https://akkbisolbjkusbuihrad.supabase.co";

// Después del build SIN variables:
const url = undefined; // ❌ No funciona
```

### ¿Por qué deben empezar con VITE_?

Vite solo expone variables que empiecen con `VITE_` por seguridad. Variables sin ese prefijo no se incluyen en el build.

### ¿Por qué no usar .env en producción?

El archivo `.env` es solo para desarrollo local. En producción:
- No se sube al repositorio (`.gitignore`)
- No existe en el servidor de hosting
- Las variables se deben configurar en la plataforma

## 🆘 Si Aún No Funciona

Después de configurar las variables y redeploy:

1. **Verifica los logs de build** de tu plataforma
   - Busca errores durante `npm run build`
   - Verifica que el build termine exitosamente

2. **Verifica la consola del navegador**
   - Abre DevTools (F12)
   - Mira la consola para ver errores específicos
   - Mira la pestaña Network para ver requests fallidos

3. **Usa la herramienta de diagnóstico**
   - Visita https://app.movi.digital/diagnostico-login.html
   - Sigue las instrucciones

4. **Verifica que el dominio apunte correctamente**
   - Usa `nslookup app.movi.digital`
   - Verifica que apunte a tu hosting

## 📁 Archivos Importantes

- `CONFIGURACION_DOMINIO.md` - Guía completa de configuración
- `SOLUCION_LOGIN.md` - Solución al problema de login (ya resuelto)
- `USUARIOS_VERIFICADOS.md` - Lista de usuarios y estado del sistema
- `.env` - Variables locales (NO se usa en producción)
- `dist/` - Código compilado listo para desplegar

## ✅ Resultado Esperado

Después de seguir estos pasos:

1. ✅ App carga en app.movi.digital
2. ✅ Pantalla de login visible
3. ✅ Sin errores en consola
4. ✅ Login funciona correctamente
5. ✅ Usuarios pueden acceder a todas las funciones

## 📞 Soporte

Si después de seguir TODOS los pasos anteriores aún no funciona:

1. Verifica que los 3 pasos críticos estén completos
2. Revisa los logs de build de tu plataforma
3. Revisa la consola del navegador para ver errores específicos
4. Asegúrate de haber redeployed DESPUÉS de agregar las variables

**Recuerda:** El 99% de las veces que una app Vite no funciona en producción es porque las variables de entorno no están configuradas.
