# Configuración de Dominio en Supabase

## ⚠️ IMPORTANTE: Configurar URLs Permitidas

Para que los usuarios puedan iniciar sesión desde **app.movi.digital**, debes configurar este dominio en Supabase.

---

## 📋 Pasos para Configurar

### 1. Acceder al Dashboard de Supabase
1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto: **akkbisolbjkusbuihrad**

### 2. Configurar Authentication URLs

1. En el menú lateral, ve a **Authentication** → **URL Configuration**

2. Agrega las siguientes URLs en **Site URL**:
   ```
   https://app.movi.digital
   ```

3. Agrega las siguientes URLs en **Redirect URLs** (una por línea):
   ```
   http://localhost:5173/**
   http://localhost:4173/**
   http://127.0.0.1:5173/**
   https://app.movi.digital/**
   https://movi.digital/**
   https://*.netlify.app/**
   https://*.vercel.app/**
   ```

4. Click en **Save** para guardar los cambios

---

## 🔍 Verificar Configuración Actual

Para ver la configuración actual:

1. Dashboard → Project Settings → Authentication
2. Verifica que:
   - ✅ **Email Auth** esté habilitado
   - ✅ **Confirm email** esté **DESHABILITADO** (importante)
   - ✅ **Site URL** apunte a `https://app.movi.digital`

---

## 🧪 Probar después de Configurar

1. Abre: https://app.movi.digital
2. Intenta iniciar sesión con:
   - Email: `ccjimenez@jiro.com.mx`
   - Password: (la contraseña del usuario)

3. Si funciona, el error "Error de conexión con el servidor" debería desaparecer

---

## ❓ Si el Error Persiste

### Opción 1: Verificar CORS
El error puede ser por CORS. Verifica en la consola del navegador (F12) si hay errores como:
```
Access to fetch at 'https://akkbisolbjkusbuihrad.supabase.co/auth/v1/token'
from origin 'https://app.movi.digital' has been blocked by CORS policy
```

### Opción 2: Verificar Variables de Entorno
Asegúrate de que en la plataforma de hosting (Netlify/Vercel) estén configuradas:
```bash
VITE_SUPABASE_URL=https://akkbisolbjkusbuihrad.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Opción 3: Limpiar Caché
```javascript
// Ejecuta esto en la consola del navegador en app.movi.digital:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## 👥 Usuarios Disponibles para Prueba

| Email | Nombre | Rol | Estado Auth |
|-------|--------|-----|-------------|
| ccjimenez@jiro.com.mx | Christofer Cruz-Chousal | Administrador | ✅ Confirmado |
| ccjimenez@jiro.mx | Christofer Gerente | Gerente | ✅ Confirmado |
| zacatecas@jiro.mx | Fatima Esmeralda | Empleado | ✅ Confirmado |
| pjimenez@jiro.mx | Pablo Jiménez | Empleado | ✅ Confirmado |

Todos los usuarios tienen:
- ✅ Email confirmado en auth.users
- ✅ Registro activo en tabla usuarios
- ✅ Estado: activo

---

## 📞 Soporte

Si después de seguir estos pasos el error persiste:

1. Abre la consola del navegador (F12) en app.movi.digital
2. Ve a la pestaña Console
3. Copia todos los mensajes que aparecen cuando intentas hacer login
4. Busca logs que empiecen con `[AuthContext]` o `[Supabase]`

Esos logs te dirán exactamente dónde está el problema.
