# Configurar Variables de Entorno en Netlify

Tu aplicación está desplegada en Netlify pero las funciones Edge están en Supabase. Para que funcione correctamente, necesitas configurar las variables de entorno en Netlify.

## Pasos para Configurar

### 1. Acceder a Netlify Dashboard
1. Ve a https://app.netlify.com/
2. Selecciona tu sitio (el que está desplegado)
3. Ve a **Site Settings** → **Environment Variables**

### 2. Agregar las Variables de Entorno

Agrega las siguientes variables:

| Variable | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://qhwvuuyjhcennqccgvse.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ` |

### 3. Re-desplegar el Sitio

Después de agregar las variables:
1. Ve a **Deploys**
2. Click en **Trigger deploy** → **Clear cache and deploy site**

### 4. Verificar

Una vez que el deploy termine:
1. Ve a tu sitio desplegado
2. Inicia sesión
3. Ve a "Mi Producción"
4. Haz click en "Recargar información"

## Por qué es necesario

- Tu aplicación está desplegada en Netlify (frontend)
- Las funciones Edge están en Supabase (backend)
- El frontend necesita saber la URL de Supabase para llamar a las funciones
- Las variables `VITE_*` se incluyen en el build de Vite
- Sin estas variables, el frontend intenta llamar funciones que no existen en Netlify

## Notas

- Las variables que empiezan con `VITE_` son las únicas que Vite incluye en el bundle del frontend
- Estas son seguras de exponer al público (son las mismas que usarías en JavaScript del navegador)
- La `ANON_KEY` está diseñada para ser pública
