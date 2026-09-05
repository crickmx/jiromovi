# Deploy de seguros.express — pasos de infraestructura

El código y el backend ya están listos y en producción (8 migraciones + 2 edge
functions aplicadas vía MCP el 2026-07-21; frontend mergeado a `main`). Lo que
resta son 3 tareas en consolas externas (requieren tus credenciales de Google /
Plesk / registrador — por eso las haces tú). Aquí van exactas.

## 1) reCAPTCHA (consola Google, ~2 min)
- Entra a https://www.google.com/recaptcha/admin
- Abre la key v3 que ya usa MOVI (site key en `VITE_RECAPTCHA_SITE_KEY`).
- En **Dominios**, agrega: `seguros.express` y `www.seguros.express`.
- Guarda. (Sin esto, el formulario de `/cotizar` rebota por score.)
- Si prefieres una key nueva y exclusiva, créala y pon su site key en el `.env`
  del hosting (paso 2). El secret (`RECAPTCHA_SECRET_KEY`) ya está en las edge
  functions de Supabase; si cambias de key, actualízalo ahí también.

## 2) Hosting en Plesk (~10 min)
- Crea el dominio `seguros.express` en Plesk.
- **Node.js habilitado** para ese dominio.
- Deploy: Git desde `origin/main` (mismo patrón que beta.movi.digital) o subir
  el `dist/` compilado.
  - Build command: `npx vite build`  ·  Output: `dist/`
- **Document Root apuntando a `dist/`** (NO a la raíz del repo).
- **`.env` en la raíz del repo** (NO se versiona — ver `.env.example`), con:
  ```
  VITE_SUPABASE_URL=https://qhwvuuyjhcennqccgvse.supabase.co
  VITE_SUPABASE_ANON_KEY=<anon key del proyecto>
  VITE_RECAPTCHA_SITE_KEY=<site key del paso 1>
  ```
  ⚠️ Las `VITE_*` se hornean en el build: deben existir ANTES de correr
  `vite build`, no en runtime.
- SPA fallback: ya cubierto por `public/.htaccess` (Apache). Si Plesk usa nginx
  puro, agrega en la config del dominio:
  ```
  location / { try_files $uri $uri/ /index.html; }
  ```

## 3) DNS + SSL (~5 min + propagación)
- Apunta `seguros.express` (A o CNAME) al servidor de Plesk, igual que los otros
  dominios MOVI.
- Emite el certificado SSL (Let's Encrypt desde Plesk).

## 4) Verificación de punta a punta
Con el dominio arriba:
1. Abre `https://seguros.express/cotizar`, llena y envía el formulario (usa tu
   ubicación o un C.P.).
2. En Supabase, confirma la fila nueva en `express_leads` (estado `notificado`).
3. Un agente con `seguros_express_habilitado = true` y ubicación cercana debe
   recibir la notificación (campana + email + WhatsApp + push) y verlo en
   **Mi CRM → Leads Express**.
4. Que el agente lo "tome" (claim) → aparecen los datos de contacto; luego
   "Convertir a CRM" → se crea contacto + tarea.
5. El cron `escalar-express-leads` corre cada minuto (expande el radio si nadie
   lo toma). Para probar rápido puedes bajar `intervalo_minutos` en
   **Admin → seguros.express**.

Avísame cuando el dominio esté arriba y hago la prueba del paso 4 contigo / la
depuro si algo truena.
