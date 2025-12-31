# Configuración de reCAPTCHA v3

Este proyecto utiliza **Google reCAPTCHA v3** (invisible) para proteger el formulario de leads en las páginas públicas de agentes.

## ✅ Configuración Actual

Las claves de reCAPTCHA v3 ya están configuradas:

```bash
# Frontend (.env)
VITE_RECAPTCHA_SITE_KEY=6Ldf1jssAAAAAAzGfo0IIm8JJxNaIpLVDPSqHuIN

# Backend (Supabase Edge Functions Secret)
RECAPTCHA_SECRET_KEY=6Ldf1jssAAAAAOcKNjP9PMrW2q33P-bU6ydDTA3z
```

## Diferencias entre reCAPTCHA v2 y v3

### reCAPTCHA v2 (checkbox - NO USADO)
- Muestra checkbox "No soy un robot"
- Requiere interacción del usuario
- Puede mostrar desafíos de imágenes

### reCAPTCHA v3 (invisible - EN USO) ✅
- **No muestra ningún checkbox al usuario**
- **Funciona de manera invisible en el fondo**
- Analiza el comportamiento del usuario
- Devuelve un **score de 0.0 a 1.0**:
  - **1.0** = Muy probablemente humano
  - **0.0** = Muy probablemente bot
- Se rechaza automáticamente si el score < 0.5

## Nota sobre Regeneración de Claves

Si necesitas regenerar las claves:

1. Ve a: **https://www.google.com/recaptcha/admin/create**
2. Inicia sesión con tu cuenta de Google
3. Completa el formulario:
   - **Etiqueta:** `Agente de Seguros Online`
   - **Tipo de reCAPTCHA:** Selecciona **"reCAPTCHA v3"** (NO v2)
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
- **Librería:** Script nativo de Google reCAPTCHA v3 (no requiere react-google-recaptcha)
- El formulario de contacto público ejecuta reCAPTCHA v3 de manera invisible al enviar
- Se carga el script: `https://www.google.com/recaptcha/api.js?render=SITE_KEY`
- Se ejecuta: `grecaptcha.execute(siteKey, { action: 'submit_lead' })`

### Backend
- **Ubicación:** `supabase/functions/submit-web-lead/index.ts`
- Valida el token de reCAPTCHA v3 con Google antes de procesar el lead
- Verifica que `recaptchaResult.success === true`
- **Verifica el score**: Rechaza si `recaptchaResult.score < 0.5`
- Rechaza envíos sin token válido, tokens expirados, o con score bajo

## Funcionamiento (reCAPTCHA v3)

1. **Usuario completa el formulario** en la página pública del asesor
2. **Usuario hace clic en "Solicitar Cotización"**
3. **reCAPTCHA v3 analiza el comportamiento del usuario** (invisible)
4. **Frontend obtiene un token** con `grecaptcha.execute()`
5. **Frontend envía el formulario** con el token al edge function
6. **Backend valida el token** con Google reCAPTCHA v3 API
7. **Backend verifica el score**:
   - Si score ≥ 0.5: Procesa el lead y crea el contacto en el CRM
   - Si score < 0.5: Rechaza la solicitud (probablemente es un bot)

**Nota:** El usuario **NO ve ningún checkbox** ni desafío. Todo es invisible y transparente.

## Dominios Autorizados en Google reCAPTCHA

Los siguientes dominios están autorizados en la consola de Google reCAPTCHA:

- `localhost` (para desarrollo)
- `agentedeseguros.online` (producción)

## Seguridad

✅ **Token validado en servidor:** No se confía en la validación del frontend
✅ **Clave secreta protegida:** Solo accesible en edge functions
✅ **Tokens de un solo uso:** Los tokens expiran y no pueden reutilizarse
✅ **Protección contra bots:** Sistema de puntuación inteligente (score 0.0-1.0)
✅ **Sin fricción para el usuario:** No requiere interacción manual
✅ **Análisis de comportamiento:** Detecta patrones de bots automáticamente

## Testing

Para probar la implementación:

1. Inicia el servidor de desarrollo: `npm run dev`
2. Navega a cualquier página pública: `http://localhost:5173/asesor/[slug]`
3. Completa el formulario de contacto
4. Verifica que el reCAPTCHA aparece y funciona
5. Envía el formulario y verifica que se crea el contacto en el CRM

## Troubleshooting

### Error: "ERROR del propietario del sitio: El tipo de clave no es válido"
Este error indica que estás usando claves de v2 en una implementación de v3 (o viceversa). Soluciones:
1. **Verifica que las claves sean de reCAPTCHA v3**, no v2
2. En la consola de Google reCAPTCHA, confirma que el sitio esté configurado como **"reCAPTCHA v3"**
3. La **Site Key** debe ir en `.env` con el prefijo `VITE_`
4. La **Secret Key** debe configurarse en Supabase Dashboard
5. Si las claves son de v2, debes regenerarlas como v3

### Error: "Verificación de reCAPTCHA fallida"
- Verifica que la variable `RECAPTCHA_SECRET_KEY` esté configurada en Supabase Edge Functions Secrets
- Asegúrate de que el dominio esté autorizado en Google reCAPTCHA Console
- Revisa que estés usando la **Secret Key** correcta (no la Site Key)
- Verifica que las claves sean de **reCAPTCHA v3**, no v2

### Error: "Lo sentimos, no pudimos verificar tu solicitud"
Este error aparece cuando el score de reCAPTCHA es menor a 0.5 (detectado como bot). Posibles causas:
- Comportamiento sospechoso del navegador
- Envíos muy rápidos o automatizados
- VPN o proxy detectado
- JavaScript deshabilitado
- Extensiones de navegador que interfieren con reCAPTCHA

**Solución para usuarios legítimos:**
- Intenta desde otro navegador
- Desactiva extensiones temporalmente
- Espera unos segundos antes de enviar el formulario

### reCAPTCHA v3 no funciona
- Verifica que `VITE_RECAPTCHA_SITE_KEY` esté en el archivo `.env`
- Reinicia el servidor de desarrollo después de cambiar variables de entorno
- Abre la consola del navegador y busca errores relacionados con `grecaptcha`
- Verifica que el script de reCAPTCHA se esté cargando: busca `recaptcha/api.js` en las herramientas de desarrollo (Network tab)

### El badge de reCAPTCHA no aparece
reCAPTCHA v3 muestra un pequeño badge flotante en la esquina inferior derecha de la página con el texto "protegido por reCAPTCHA". Si no aparece:
- El script no se está cargando correctamente
- Verifica la consola del navegador para errores
- Confirma que la Site Key es correcta

### Formulario no se envía
- Abre la consola del navegador para ver errores
- Verifica que `grecaptcha.execute()` se esté llamando correctamente
- Confirma que el token se esté enviando en la petición al backend
