# ⚠️ IMPORTANTE: Configuración de MOVI Digital

## 🎯 Plataforma: Bolt.new + Supabase

Esta aplicación está configurada para funcionar en **Bolt.new** con **Supabase** como backend.

## ✅ Configuración Actual

### Variables de Entorno

El archivo `.env` en la raíz contiene:

```
VITE_SUPABASE_URL=https://qhwvuuyjhcennqccgvse.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**En Bolt.new:** Estas variables se leen automáticamente del archivo `.env`

### Si Despliegas en Otro Hosting

Si decides desplegar en Vercel, Render u otra plataforma:

1. Configura las variables de entorno en la plataforma
2. Nombres exactos: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
3. Haz un nuevo deploy después de configurarlas

### 2. Configurar Supabase

1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Settings → Authentication → URL Configuration
4. Site URL: `https://app.movi.digital`
5. Redirect URLs: Agrega `https://app.movi.digital/*`
6. Settings → API → CORS: Agrega `https://app.movi.digital`
7. Save

### 3. Verificar

1. Espera a que termine el deploy (1-2 minutos)
2. Abre: https://app.movi.digital
3. Debería mostrar la pantalla de login
4. Abre DevTools (F12) → Console
5. NO debería haber error "Faltan las variables de entorno"

## ❓ Por Qué Sucede Esto

**Build Time vs Runtime:**

Las variables de Vite se embeben durante la compilación (`npm run build`), no en tiempo de ejecución. Si las variables no están configuradas cuando se ejecuta el build en producción, el código compilado no tendrá las credenciales de Supabase.

```javascript
// Tu código:
const url = import.meta.env.VITE_SUPABASE_URL;

// Con variables configuradas → Build embebe el valor:
const url = "https://akkbisolbjkusbuihrad.supabase.co"; ✅

// Sin variables → Build deja undefined:
const url = undefined; ❌
```

**Por qué funciona en preview local:**
- El preview tiene acceso al archivo `.env` local
- La plataforma de hosting NO tiene acceso al `.env` (está en `.gitignore`)
- Debes configurar las variables en la plataforma

## 📚 Más Información

- `RESUMEN_DESPLIEGUE.md` - Explicación detallada del problema
- `CONFIGURACION_DOMINIO.md` - Guía completa de configuración por plataforma
- `SOLUCION_LOGIN.md` - Solución al problema de login (ya resuelto)
- `USUARIOS_VERIFICADOS.md` - Estado del sistema y usuarios

## ✅ Checklist

- [ ] Variables de entorno agregadas en la plataforma de hosting
- [ ] Nombres exactos: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- [ ] Redeploy ejecutado después de agregar variables
- [ ] URLs configuradas en Supabase Dashboard
- [ ] CORS configurado en Supabase
- [ ] Dominio app.movi.digital apunta al hosting

## 🎯 Resultado

Después de completar los pasos:

✅ App carga en app.movi.digital
✅ Login funciona correctamente
✅ Todos los usuarios pueden acceder
✅ Sin errores en consola

---

**⚠️ RECUERDA: Sin las variables de entorno configuradas en tu plataforma de hosting, la aplicación NO funcionará en producción.**
