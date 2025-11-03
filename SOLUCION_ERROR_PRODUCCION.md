# 🚨 SOLUCIÓN URGENTE: Error de Conexión en app.movi.digital

## ❌ Problema Actual

Al acceder a **https://app.movi.digital** aparece el error:
```
Error de conexión con el servidor. Verifica tu conexión a internet o contacta al administrador.
```

## ✅ Causa del Problema

Las **variables de entorno** de Supabase NO están configuradas en la plataforma de hosting donde está desplegado app.movi.digital.

En Vite, las variables con prefijo `VITE_` se inyectan durante el **build time**, por lo que:
- ✅ Funcionan en desarrollo local (archivo `.env`)
- ❌ NO funcionan en producción si no están configuradas en el hosting

---

## 🔧 SOLUCIÓN PASO A PASO

### 📍 Paso 1: Identificar la Plataforma de Hosting

Primero necesitas saber dónde está desplegada tu aplicación. Las opciones más comunes son:

#### Opción A: **Netlify**
- Dominio termina en `.netlify.app`
- O configurado con dominio personalizado

#### Opción B: **Vercel**
- Dominio termina en `.vercel.app`
- O configurado con dominio personalizado

#### Opción C: **Otro Servicio**
- Podría ser AWS Amplify, Cloudflare Pages, etc.

---

### 🛠️ Paso 2: Configurar Variables en NETLIFY

Si usas **Netlify**:

1. **Accede al Dashboard:**
   - Ve a: https://app.netlify.com
   - Inicia sesión
   - Selecciona el sitio: **app.movi.digital**

2. **Navega a Variables de Entorno:**
   ```
   Site configuration → Environment variables
   ```

3. **Agrega las Variables:**

   Click en **"Add a variable"** y agrega:

   **Variable 1:**
   ```
   Key: VITE_SUPABASE_URL
   Value: https://qhwvuuyjhcennqccgvse.supabase.co
   Scopes: [x] Production, [x] Deploy Previews, [x] Branch deploys
   ```

   **Variable 2:**
   ```
   Key: VITE_SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ
   Scopes: [x] Production, [x] Deploy Previews, [x] Branch deploys
   ```

4. **Redeploy el Sitio:**
   ```
   Deploys → Trigger deploy → Deploy site
   ```

5. **Espera 2-3 minutos** a que termine el deploy

6. **Limpia caché del navegador:**
   - Chrome/Edge: `Ctrl + Shift + Delete`
   - Mac: `Cmd + Shift + Delete`
   - Marca "Cached images and files"
   - Click "Clear data"

7. **Recarga forzada:**
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

---

### 🛠️ Paso 2: Configurar Variables en VERCEL

Si usas **Vercel**:

1. **Accede al Dashboard:**
   - Ve a: https://vercel.com/dashboard
   - Inicia sesión
   - Selecciona tu proyecto

2. **Navega a Variables de Entorno:**
   ```
   Settings → Environment Variables
   ```

3. **Agrega las Variables:**

   **Variable 1:**
   ```
   Name: VITE_SUPABASE_URL
   Value: https://qhwvuuyjhcennqccgvse.supabase.co
   Environment:
     [x] Production
     [x] Preview
     [x] Development
   ```

   **Variable 2:**
   ```
   Name: VITE_SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ
   Environment:
     [x] Production
     [x] Preview
     [x] Development
   ```

4. **Redeploy:**
   ```
   Deployments → [último deploy] → ⋯ → Redeploy
   ```

5. **Espera 2-3 minutos** a que termine

6. **Limpia caché y recarga** (ver paso 6-7 de Netlify arriba)

---

### 🛠️ Paso 2: Configurar Variables en AWS AMPLIFY

Si usas **AWS Amplify**:

1. Accede a AWS Console
2. Ve a AWS Amplify → Tu app
3. En el menú lateral: **Environment variables**
4. Agrega las dos variables mencionadas arriba
5. Guarda y redeploy

---

### 🛠️ Paso 2: Configurar Variables en CLOUDFLARE PAGES

Si usas **Cloudflare Pages**:

1. Accede a Cloudflare Dashboard
2. Ve a Pages → Tu proyecto
3. Settings → Environment variables
4. Agrega las dos variables
5. Redeploy

---

## 🔍 Paso 3: Verificar que Funcione

1. **Visita:** https://app.movi.digital

2. **Abre la Consola del Navegador:**
   - Presiona `F12` (Windows/Linux)
   - O `Cmd + Option + I` (Mac)
   - Ve a la pestaña "Console"

3. **Busca estos mensajes:**
   ```
   [Supabase] Initializing with URL: https://qhwvuuyjhcennqccgvse.supabase.co
   [Supabase] Client initialized successfully
   ```

4. **Si ves el error de configuración:**
   - Las variables NO se cargaron
   - Verifica que hiciste el redeploy
   - Espera unos minutos más
   - Limpia caché nuevamente

5. **Intenta iniciar sesión:**
   ```
   Email: ccjimenez@jiro.com.mx
   Contraseña: [tu contraseña]
   ```

---

## ⚠️ PUNTOS IMPORTANTES

### ❌ Lo que NO funciona:
- Solo tener las variables en el archivo `.env` del repositorio
- Tener las variables en un archivo `.env.production`
- Configurar las variables en el código fuente

### ✅ Lo que SÍ funciona:
- Configurar las variables en el panel de tu plataforma de hosting
- Hacer un redeploy completo después de agregar las variables
- Las variables con prefijo `VITE_` se inyectan durante el build

---

## 🆘 Si aún no funciona

1. **Verifica en la consola del navegador:**
   - ¿Aparece "NO CONFIGURADA" en lugar de la URL?
   - ¿Hay algún error de CORS?
   - ¿Hay errores de red?

2. **Comprueba que hiciste redeploy:**
   - Las variables solo se aplican en nuevos builds
   - Editar variables no redeploya automáticamente

3. **Verifica la plataforma correcta:**
   - ¿Estás configurando las variables en el proyecto correcto?
   - ¿El dominio app.movi.digital apunta al deploy correcto?

4. **Contacta soporte:**
   - Netlify Support: https://www.netlify.com/support/
   - Vercel Support: https://vercel.com/support

---

## 📧 Credenciales de Acceso

Una vez configurado correctamente, usa estas credenciales:

**Administrador:**
```
Email: ccjimenez@jiro.com.mx
Contraseña: [la que configuraste]
```

**Agente de prueba:**
```
Email: zacatecas@jiro.mx
Contraseña: [la que configuraste]
```

---

## 📝 Resumen

1. ✅ Variables de entorno están en `.env` (desarrollo local funciona)
2. ❌ Variables NO están en el hosting (producción NO funciona)
3. 🔧 Solución: Configurar variables en panel de hosting + redeploy
4. ⏱️ Tiempo estimado: 5 minutos + 2-3 minutos de build

---

## 🎯 Resultado Esperado

Después de seguir estos pasos:
- ✅ La app carga sin errores
- ✅ Puedes iniciar sesión
- ✅ El dashboard se muestra correctamente
- ✅ Todas las funcionalidades operan normalmente
