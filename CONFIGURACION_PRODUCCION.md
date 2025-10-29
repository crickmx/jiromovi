# 🚀 Configuración de Variables de Entorno en Producción

## ⚠️ PROBLEMA COMÚN

Si ves el error:
```
Error de conexión con el servidor. Verifica tu conexión a internet o contacta al administrador.
```

**Causa:** Las variables de entorno de Supabase NO están configuradas en el hosting de producción.

---

## ✅ SOLUCIÓN: Configurar Variables de Entorno

Las siguientes variables **DEBEN** estar configuradas en tu plataforma de hosting:

### Variables Requeridas

```bash
VITE_SUPABASE_URL=https://qhwvuuyjhcennqccgvse.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ
```

---

## 📋 Guías por Plataforma

### 🔵 Netlify

1. Ve a tu sitio en [Netlify Dashboard](https://app.netlify.com)
2. Click en **Site settings**
3. En el menú lateral, click en **Environment variables**
4. Click en **Add a variable** o **Add environment variables**
5. Agrega cada variable:
   - **Key:** `VITE_SUPABASE_URL`
   - **Value:** `https://qhwvuuyjhcennqccgvse.supabase.co`
   - Scope: **All scopes**
6. Repite para `VITE_SUPABASE_ANON_KEY`
7. Click en **Save**
8. Ve a **Deploys** y click en **Trigger deploy** → **Deploy site**

**Captura de pantalla de referencia:**
```
Site settings → Environment variables → Add variable
```

---

### ⚫ Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en tu proyecto
3. Click en **Settings** (arriba)
4. En el menú lateral, click en **Environment Variables**
5. Agrega cada variable:
   - **Name:** `VITE_SUPABASE_URL`
   - **Value:** `https://qhwvuuyjhcennqccgvse.supabase.co`
   - **Environments:** Marca todos (Production, Preview, Development)
6. Click **Save**
7. Repite para `VITE_SUPABASE_ANON_KEY`
8. Ve a **Deployments** y redeploy la última versión

**Captura de pantalla de referencia:**
```
Settings → Environment Variables → Add New
```

---

### 🟢 Otras Plataformas

#### **Cloudflare Pages**
```bash
Settings → Environment variables → Production
```

#### **GitHub Pages**
No soporta variables de entorno en build. Usa GitHub Actions:
```yaml
# .github/workflows/deploy.yml
env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

#### **Railway**
```bash
Variables → New Variable
```

#### **Render**
```bash
Environment → Environment Variables → Add Environment Variable
```

---

## 🧪 Verificación

### Opción 1: Desde la Consola del Navegador

1. Abre app.movi.digital
2. Presiona `F12` para abrir DevTools
3. Ve a la pestaña **Console**
4. Ejecuta:
```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
```

**Resultado esperado:**
```
Supabase URL: https://qhwvuuyjhcennqccgvse.supabase.co
Has Anon Key: true
```

**Si ves `undefined`:** Las variables NO están configuradas.

### Opción 2: Inspeccionar el Build

Verifica que las variables se compilaron correctamente:
```bash
# Buscar en el código compilado
grep -r "qhwvuuyjhcennqccgvse" dist/
```

Debería encontrar referencias a la URL de Supabase.

---

## ⚡ Solución Rápida (Emergencia)

Si necesitas desplegar urgentemente y no puedes configurar las variables, puedes hardcodear temporalmente en `src/lib/supabase.ts`:

```typescript
// SOLO PARA EMERGENCIA - NO RECOMENDADO
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qhwvuuyjhcennqccgvse.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

⚠️ **NO ES RECOMENDADO:** Esto funciona pero es mejor usar variables de entorno.

---

## 🔍 Diagnóstico de Errores

### Error: "Error de conexión con el servidor"

**Causas posibles:**

1. ✅ **Variables no configuradas** (más común)
   - Solución: Configura las variables según esta guía

2. ✅ **Variables mal configuradas**
   - Verifica que no haya espacios adicionales
   - Verifica que la URL no termine en `/`
   - Verifica que copiaste el token completo

3. ✅ **CORS no configurado en Supabase**
   - Ve a Supabase Dashboard
   - Authentication → URL Configuration
   - Agrega `https://app.movi.digital` a los dominios permitidos

4. ✅ **Cache del navegador**
   - Presiona `Ctrl + Shift + R` (o `Cmd + Shift + R` en Mac)
   - O abre en modo incógnito

5. ✅ **Build antiguo**
   - Haz un nuevo deploy después de configurar variables

---

## 📞 Soporte

Si después de seguir esta guía el problema persiste:

1. Verifica en la consola del navegador (F12) los errores específicos
2. Revisa los logs del deployment en tu plataforma de hosting
3. Verifica que la URL de Supabase sea accesible: [https://qhwvuuyjhcennqccgvse.supabase.co](https://qhwvuuyjhcennqccgvse.supabase.co)

---

## ✅ Checklist Final

Antes de cerrar este ticket, verifica:

- [ ] Variables configuradas en el hosting
- [ ] Deploy realizado después de configurar variables
- [ ] Verificado en consola del navegador que las variables están presentes
- [ ] Login funciona en app.movi.digital
- [ ] No hay errores de CORS en la consola

---

## 🎯 Resultado Esperado

Después de configurar correctamente:

1. ✅ La página carga sin errores
2. ✅ El formulario de login es visible
3. ✅ Puedes iniciar sesión con: `ccjimenez@jiro.com.mx` / `Movi2024!`
4. ✅ Eres redirigido al Dashboard después del login
5. ✅ No aparece "Error de conexión con el servidor"
