# Configuración de reCAPTCHA v2

## ⚠️ ACCIÓN REQUERIDA: Generar Nuevas Claves

**Las claves actuales en el `.env` NO son válidas.** Debes generar nuevas claves de Google reCAPTCHA.

## Pasos para Obtener las Claves

### 1. Crear un sitio en Google reCAPTCHA

1. Ve a: **https://www.google.com/recaptcha/admin/create**
2. Inicia sesión con tu cuenta de Google
3. Completa el formulario:
   - **Etiqueta:** `Agente de Seguros Online` (o el nombre que prefieras)
   - **Tipo de reCAPTCHA:** Selecciona **"reCAPTCHA v2"** → **"Casilla de verificación 'No soy un robot'"**
   - **Dominios** (agrega estos uno por uno):
     - `agentedeseguros.online`
     - `localhost`
   - Acepta los términos de servicio
   - Haz clic en **"Enviar"**

4. Google te mostrará dos claves:
   - **Site Key** (Clave del sitio) - Úsala en el frontend
   - **Secret Key** (Clave secreta) - Úsala en el backend

### 2. Configurar las Claves en el Proyecto

#### A. Actualizar `.env` (Frontend)
```bash
VITE_RECAPTCHA_SITE_KEY=TU_SITE_KEY_AQUI
```

#### B. Configurar en Supabase (Backend)

1. Ve a tu proyecto en Supabase Dashboard: https://supabase.com/dashboard/project/qhwvuuyjhcennqccgvse
2. Navega a **Settings** → **Edge Functions**
3. En la sección **Secrets**, agrega:
   - **Name:** `RECAPTCHA_SECRET_KEY`
   - **Value:** `TU_SECRET_KEY_AQUI`
4. Guarda los cambios

### 3. Reiniciar la Aplicación

```bash
npm run dev
```

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

### Error: "ERROR del propietario del sitio: El tipo de clave no es válido"
Este error indica que las claves de reCAPTCHA son inválidas. Soluciones:
1. **Genera nuevas claves** siguiendo los pasos de arriba
2. Asegúrate de usar **reCAPTCHA v2 (checkbox)**, NO v3
3. Verifica que el dominio `localhost` esté en la lista de dominios autorizados
4. La **Site Key** debe ir en `.env` con el prefijo `VITE_`
5. La **Secret Key** debe configurarse en Supabase Dashboard

### Error: "Verificación de reCAPTCHA fallida"
- Verifica que la variable `RECAPTCHA_SECRET_KEY` esté configurada en Supabase
- Asegúrate de que el dominio esté autorizado en Google reCAPTCHA Console
- Revisa que estés usando la **Secret Key** correcta (no la Site Key)

### reCAPTCHA no aparece
- Verifica que `VITE_RECAPTCHA_SITE_KEY` esté en el archivo `.env`
- Reinicia el servidor de desarrollo después de cambiar variables de entorno
- Limpia el caché del navegador con Ctrl+Shift+R (Cmd+Shift+R en Mac)

### Formulario no se envía
- Abre la consola del navegador para ver errores
- Verifica que el token de reCAPTCHA se esté generando correctamente
- Confirma que completaste el captcha antes de enviar
