# SOLUCIÓN DEFINITIVA - Variables de Entorno

## PROBLEMA DETECTADO

La aplicación en https://app.movi.digital muestra:
- Supabase URL: NO CONFIGURADA
- Anon Key: NO CONFIGURADA

## SOLUCIÓN INMEDIATA

Configurar estas variables en tu plataforma de hosting:

```
VITE_SUPABASE_URL=https://akkbisolbjkusbuihrad.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra2Jpc29sYmprdXNidWlocmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzkwNDAsImV4cCI6MjA3NjY1NTA0MH0.iJf04oJv0ERuyWyY0gLpd7ntP6bITJ8LWxGFKJNSLvQ
```

## PASOS (NETLIFY)

1. Ve a https://app.netlify.com/
2. Selecciona tu sitio
3. Site configuration → Environment variables
4. Agrega las 2 variables arriba
5. Deploys → Trigger deploy → Deploy site
6. Espera 2-3 minutos

## PASOS (VERCEL)

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Settings → Environment Variables
4. Agrega las 2 variables arriba
5. Deployments → Redeploy
6. Espera 1-2 minutos

## VERIFICAR

Visita: https://app.movi.digital/diagnostico-conexion.html

Debe mostrar todo en verde.

## IMPORTANTE

- Los nombres DEBEN ser EXACTOS (con prefijo VITE_)
- SIN comillas en los valores
- DEBES hacer redeploy después de agregar variables
- Las variables NO se suben con git (están en .gitignore)
