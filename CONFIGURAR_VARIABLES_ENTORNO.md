# 🔧 Configuración de Variables de Entorno para Producción

## ⚠️ Error: "Error de conexión con el servidor"

Si ves este error al acceder a `app.movi.digital`, significa que **las variables de entorno no están configuradas** en tu plataforma de hosting.

---

## 📋 Variables Requeridas

Necesitas configurar estas dos variables de entorno en tu plataforma de hosting:

```
VITE_SUPABASE_URL=https://qhwvuuyjhcennqccgvse.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ
```

---

## 🚀 Instrucciones por Plataforma

### **Netlify**

1. Ve a tu proyecto en [Netlify Dashboard](https://app.netlify.com)
2. Selecciona tu sitio `app.movi.digital`
3. Ve a **Site configuration** → **Environment variables**
4. Haz clic en **Add a variable**
5. Agrega cada variable:
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: `https://qhwvuuyjhcennqccgvse.supabase.co`
   - Scope: Todas las opciones seleccionadas
6. Repite para la segunda variable:
   - **Key**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (copia completa)
7. **IMPORTANTE**: Después de agregar las variables, haz un **redeploy**:
   - Ve a **Deploys** → **Trigger deploy** → **Deploy site**

---

### **Vercel**

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto `app.movi.digital`
3. Ve a **Settings** → **Environment Variables**
4. Agrega cada variable:
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: `https://qhwvuuyjhcennqccgvse.supabase.co`
   - Environments: Production, Preview, Development (selecciona todos)
5. Repite para la segunda variable:
   - **Key**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (copia completa)
6. **IMPORTANTE**: Después de agregar las variables, haz un **redeploy**:
   - Ve a **Deployments** → Selecciona el último deploy → **Redeploy**

---

### **Otras Plataformas**

Si usas otra plataforma de hosting (Railway, Render, etc.):

1. Busca la sección de "Environment Variables" o "Config Vars"
2. Agrega las dos variables mencionadas arriba
3. Asegúrate de incluir el prefijo `VITE_` en el nombre de las variables
4. Guarda los cambios
5. Redeploy/Rebuild tu aplicación

---

## ✅ Verificación

Después de configurar las variables y hacer el redeploy:

1. Espera a que el deploy termine (2-5 minutos)
2. Abre `app.movi.digital` en tu navegador
3. Abre las **Herramientas de Desarrollador** (F12)
4. Ve a la pestaña **Console**
5. Deberías ver: `[Supabase] Client initialized successfully`

---

## 🔍 Troubleshooting

### Sigo viendo el error después de configurar

✅ **Solución**:
1. Verifica que las variables tengan exactamente estos nombres:
   - `VITE_SUPABASE_URL` (con el prefijo `VITE_`)
   - `VITE_SUPABASE_ANON_KEY` (con el prefijo `VITE_`)
2. Verifica que no haya espacios al inicio o final de los valores
3. Asegúrate de haber hecho un **redeploy** después de agregar las variables
4. Limpia el caché del navegador (Ctrl + Shift + R)

### Las variables están configuradas pero no funciona

✅ **Solución**:
1. Verifica que el deploy haya terminado correctamente
2. Revisa los logs del build para ver si hay errores
3. Asegúrate de que estás usando la versión más reciente del deploy

### Error: "Variables de entorno no configuradas"

✅ **Solución**:
- Esto significa que las variables NO están llegando al build
- Verifica que las agregaste en la plataforma de hosting (no solo en el archivo `.env` local)
- Las variables en el archivo `.env` solo funcionan localmente
- En producción DEBES configurarlas en tu plataforma de hosting

---

## 📞 Contacto

Si después de seguir estos pasos sigues teniendo problemas:

1. Verifica que tengas acceso al panel de tu plataforma de hosting
2. Contacta a tu administrador de sistema
3. Revisa la documentación de tu plataforma específica

---

## 🔒 Seguridad

⚠️ **IMPORTANTE**:
- La `ANON_KEY` es segura para usar en el cliente (frontend)
- NUNCA compartas tu `SERVICE_ROLE_KEY` en el código del cliente
- Las políticas RLS en Supabase protegen tus datos
