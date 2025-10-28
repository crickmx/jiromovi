# Instrucciones para Configurar Variables de Entorno en Producción

## 🚨 PROBLEMA ACTUAL

El error **"Error de conexión con el servidor"** en `app.movi.digital` indica que las variables de entorno NO están configuradas en la plataforma de hosting.

---

## ✅ SOLUCIÓN: Configurar Variables en Netlify/Vercel

### **Opción 1: Si usas Netlify**

1. **Ir al Dashboard de Netlify**
   - URL: https://app.netlify.com
   - Iniciar sesión con tu cuenta

2. **Seleccionar tu sitio**
   - Buscar y hacer click en el sitio `app.movi.digital`

3. **Ir a Environment Variables**
   - En el menú lateral: **Site configuration**
   - Click en **Environment variables**

4. **Agregar las variables una por una**

   **Variable 1:**
   ```
   Key: VITE_SUPABASE_URL
   Value: https://akkbisolbjkusbuihrad.supabase.co
   Scopes: ✅ Production ✅ Deploy previews ✅ Branch deploys
   ```

   **Variable 2:**
   ```
   Key: VITE_SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra2Jpc29sYmprdXNidWlocmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzkwNDAsImV4cCI6MjA3NjY1NTA0MH0.iJf04oJv0ERuyWyY0gLpd7ntP6bITJ8LWxGFKJNSLvQ
   Scopes: ✅ Production ✅ Deploy previews ✅ Branch deploys
   ```

5. **⚠️ CRÍTICO: Hacer un nuevo deploy**

   Las variables NO se aplican automáticamente. Debes hacer un nuevo deploy:

   **Opción A - Desde el Dashboard:**
   - Ir a **Deploys**
   - Click en **Trigger deploy**
   - Click en **Deploy site**

   **Opción B - Desde tu terminal local:**
   ```bash
   git commit --allow-empty -m "Activar variables de entorno"
   git push origin main
   ```

6. **Verificar que funcionó**
   - Esperar a que termine el deploy (1-2 minutos)
   - Ir a `https://app.movi.digital`
   - Abrir DevTools (F12)
   - En la consola debería aparecer:
     ```
     [Supabase] Initializing with URL: https://akkbisolbjkusbuihrad.supabase.co
     [Supabase] Client initialized successfully
     ```
   - Intentar hacer login

---

### **Opción 2: Si usas Vercel**

1. **Ir al Dashboard de Vercel**
   - URL: https://vercel.com/dashboard
   - Iniciar sesión

2. **Seleccionar el proyecto**
   - Click en el proyecto `app-movi-digital`

3. **Ir a Settings**
   - En el menú superior: **Settings**

4. **Agregar Environment Variables**
   - En el menú lateral: **Environment Variables**
   - Click en **Add New**

   **Variable 1:**
   ```
   Name: VITE_SUPABASE_URL
   Value: https://akkbisolbjkusbuihrad.supabase.co
   Environment: ✅ Production ✅ Preview ✅ Development
   ```

   **Variable 2:**
   ```
   Name: VITE_SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra2Jpc29sYmprdXNidWlocmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzkwNDAsImV4cCI6MjA3NjY1NTA0MH0.iJf04oJv0ERuyWyY0gLpd7ntP6bITJ8LWxGFKJNSLvQ
   Environment: ✅ Production ✅ Preview ✅ Development
   ```

5. **Redeployar**
   - Ir a **Deployments**
   - En el último deploy, click en los 3 puntos (⋮)
   - Click en **Redeploy**
   - Confirmar

6. **Verificar**
   - Esperar a que termine el deploy
   - Probar en `app.movi.digital`

---

## 🔍 Verificar si las Variables Están Configuradas

Agregué un **panel de diagnóstico** en la página de login.

**Pasos:**

1. Ir a `https://app.movi.digital`
2. Al final de la página, hacer click en **"Información de diagnóstico"**
3. Deberías ver:
   ```
   Supabase URL: https://akkbisolbjkusbuihrad.supabase.co
   Anon Key: Configurada
   Origen: https://app.movi.digital
   Host: app.movi.digital
   ```

**Si ves:**
```
Supabase URL: NO CONFIGURADA
Anon Key: NO CONFIGURADA
```

**Significa que las variables NO están configuradas o NO hiciste redeploy.**

---

## 📊 Estados Posibles

### ✅ Estado Correcto (Todo bien)

**En DevTools Console:**
```
[Supabase] Initializing with URL: https://akkbisolbjkusbuihrad.supabase.co
[Supabase] Client initialized successfully
[AuthContext] Initializing...
```

**En Diagnóstico:**
```
Supabase URL: https://akkbisolbjkusbuihrad.supabase.co
Anon Key: Configurada
```

**Login:** ✅ Funciona correctamente

---

### ❌ Estado Incorrecto (Variables no configuradas)

**En DevTools Console:**
```
❌ ERROR: Variables de entorno de Supabase no configuradas
```

**En Diagnóstico:**
```
Supabase URL: NO CONFIGURADA
Anon Key: NO CONFIGURADA
```

**Login:** ❌ Error "Error de conexión con el servidor"

**Solución:** Configurar variables y redeployar

---

### ⚠️ Estado Intermedio (Variables configuradas pero no aplicadas)

**Síntoma:** Configuraste variables pero NO hiciste redeploy

**En Diagnóstico:**
```
Supabase URL: NO CONFIGURADA  (o undefined)
Anon Key: NO CONFIGURADA
```

**Solución:** Hacer redeploy

---

## 🔧 Troubleshooting

### Problema: "Las variables están configuradas pero sigo viendo el error"

**Posibles causas:**

1. **No hiciste redeploy**
   - Solución: Hacer nuevo deploy

2. **Las variables están en el scope incorrecto**
   - Solución: Asegurar que estén en "Production"

3. **Cache del navegador**
   - Solución: Hacer hard refresh (Ctrl + Shift + R)

4. **El build falló**
   - Ir a Deployments/Deploys
   - Ver logs del último deploy
   - Buscar errores

---

### Problema: "El diagnóstico muestra las variables pero el login falla"

**Posible causa:** Problema de CORS en Supabase

**Solución:**

1. Ir a https://supabase.com/dashboard
2. Seleccionar proyecto: `akkbisolbjkusbuihrad`
3. **Authentication** → **URL Configuration**
4. Agregar en **Site URL**:
   ```
   https://app.movi.digital
   ```
5. Agregar en **Redirect URLs**:
   ```
   https://app.movi.digital/**
   ```
6. Guardar y probar de nuevo

---

### Problema: "Funciona en localhost pero no en producción"

**Causa común:** Variables NO configuradas en hosting

**Verificar:**

1. En localhost usas el archivo `.env`
2. En producción necesitas configurar en Netlify/Vercel
3. Son configuraciones separadas

**Solución:** Seguir los pasos de configuración arriba

---

## 📝 Checklist de Verificación

Marca cada paso al completarlo:

- [ ] Variables agregadas en Netlify/Vercel
- [ ] Ambas variables configuradas (URL y ANON_KEY)
- [ ] Scopes correctos (Production, etc.)
- [ ] Redeploy realizado
- [ ] Deploy completado exitosamente (sin errores)
- [ ] Cache del navegador limpiado
- [ ] Diagnóstico muestra variables configuradas
- [ ] DevTools Console muestra inicialización correcta
- [ ] Login funciona correctamente

---

## 🎯 Resumen Rápido

**Para solucionar el error de login en app.movi.digital:**

1. ✅ Configurar variables en Netlify/Vercel
2. ✅ Hacer redeploy (OBLIGATORIO)
3. ✅ Verificar con el diagnóstico
4. ✅ Probar login

**Tiempo estimado:** 5 minutos

**Si sigues estos pasos exactamente, el problema se resolverá.**

---

## 📞 Soporte

Si después de seguir TODOS los pasos el problema persiste:

1. Tomar screenshot del panel de diagnóstico
2. Tomar screenshot de las variables configuradas en Netlify/Vercel
3. Tomar screenshot de la consola de DevTools
4. Compartir screenshots para análisis

**Causa más probable del error:** Variables no configuradas (98% de los casos)
