# Configuración de reCAPTCHA v2

## Variables de Entorno Configuradas

Las siguientes variables de entorno ya están configuradas en el proyecto:

### Frontend (.env)
```
VITE_RECAPTCHA_SITE_KEY=6Ldf1jssAAAAAAzGfo0IIm8JJxNaIpLVDPSqHuIN
```

### Backend - Edge Functions (Supabase Dashboard)
```
RECAPTCHA_SECRET_KEY=6Ldf1jssAAAAAOcKNjP9PMrW2q33P-bU6ydDTA3z
```

## Configuración en Supabase

**IMPORTANTE:** Debes agregar la variable de entorno `RECAPTCHA_SECRET_KEY` en tu proyecto de Supabase:

1. Ve a tu proyecto en Supabase Dashboard
2. Navega a **Settings** → **Edge Functions**
3. En la sección **Secrets**, agrega:
   - **Name:** `RECAPTCHA_SECRET_KEY`
   - **Value:** `6Ldf1jssAAAAAOcKNjP9PMrW2q33P-bU6ydDTA3z`
4. Guarda los cambios

## Implementación

### Frontend
- **Ubicación:** `src/pages/PaginaPublicaAsesor.tsx`
- **Librería:** `react-google-recaptcha`
- El formulario de contacto público ahora requiere validación de reCAPTCHA antes de enviar

### Backend
- **Ubicación:** `supabase/functions/submit-web-lead/index.ts`
- Valida el token de reCAPTCHA con Google antes de procesar el lead
- Rechaza envíos sin token válido o tokens expirados

## Funcionamiento

1. **Usuario completa el formulario** en la página pública del asesor
2. **Usuario resuelve el reCAPTCHA** haciendo clic en "No soy un robot"
3. **Frontend envía el formulario** con el token de reCAPTCHA al edge function
4. **Backend valida el token** con Google reCAPTCHA API
5. **Si válido:** Procesa el lead y crea el contacto en el CRM
6. **Si inválido:** Rechaza la solicitud con mensaje de error

## Dominios Autorizados en Google reCAPTCHA

Asegúrate de que los siguientes dominios estén autorizados en tu consola de Google reCAPTCHA:

- `localhost` (para desarrollo)
- `agentedeseguros.online` (producción)
- Cualquier otro dominio donde se use la página pública

## Seguridad

✅ **Token validado en servidor:** No se confía en la validación del frontend
✅ **Clave secreta protegida:** Solo accesible en edge functions
✅ **Tokens de un solo uso:** Los tokens expiran y no pueden reutilizarse
✅ **Protección contra bots:** Previene envíos automatizados de spam

## Testing

Para probar la implementación:

1. Inicia el servidor de desarrollo: `npm run dev`
2. Navega a cualquier página pública: `http://localhost:5173/asesor/[slug]`
3. Completa el formulario de contacto
4. Verifica que el reCAPTCHA aparece y funciona
5. Envía el formulario y verifica que se crea el contacto en el CRM

## Troubleshooting

### Error: "Verificación de reCAPTCHA fallida"
- Verifica que la variable `RECAPTCHA_SECRET_KEY` esté configurada en Supabase
- Asegúrate de que el dominio esté autorizado en Google reCAPTCHA Console

### reCAPTCHA no aparece
- Verifica que `VITE_RECAPTCHA_SITE_KEY` esté en el archivo `.env`
- Reinicia el servidor de desarrollo después de cambiar variables de entorno

### Formulario no se envía
- Abre la consola del navegador para ver errores
- Verifica que el token de reCAPTCHA se esté generando correctamente
