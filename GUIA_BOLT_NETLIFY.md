# 🔧 Guía: Bolt.new + Netlify - Configuración de Variables de Entorno

## 📊 Situación Actual

- ✅ **Desarrollo Local (Bolt.new):** Funciona correctamente porque usa el archivo `.env`
- ❌ **Producción (app.movi.digital):** NO funciona porque el servidor de Netlify NO tiene las variables configuradas

## 🎯 La Diferencia Clave

### En Bolt.new (Desarrollo):
```
El servidor de desarrollo de Vite lee el archivo .env
├── .env (✅ existe)
│   ├── VITE_SUPABASE_URL=https://qhwvuuyjhcennqccgvse.supabase.co
│   └── VITE_SUPABASE_ANON_KEY=eyJhbGci...
└── Funciona correctamente
```

### En Netlify (Producción):
```
Netlify NO lee el archivo .env del repositorio
├── .env (❌ ignorado por Netlify)
├── Variables deben configurarse en: Netlify Dashboard
└── Sin variables → Error de conexión
```

## 🚨 Por Qué Falla en Producción

Cuando Bolt.new despliega a Netlify (o cuando haces deploy desde GitHub):

1. Netlify clona tu repositorio
2. Netlify ejecuta `npm run build`
3. Durante el build, Vite busca las variables `VITE_*`
4. Vite NO lee el archivo `.env` en producción
5. Vite busca las variables en las **Environment Variables de Netlify**
6. Si NO están configuradas → Se inyectan como `undefined`
7. La app intenta conectarse con `undefined` → Error de conexión

## ✅ SOLUCIÓN: Configurar Variables en Netlify

Aunque tu app fue creada en Bolt.new, **app.movi.digital está hospedado en Netlify**.

Confirmación:
```bash
$ curl -I https://app.movi.digital
server: Netlify  ← Tu app está en Netlify
x-nf-request-id: 01K95AEAF05YRQ2TPM29532NTP
```

### Pasos para Configurar:

#### 1️⃣ Accede a Netlify
```
🌐 URL: https://app.netlify.com
🔐 Inicia sesión
📍 Busca el sitio: app.movi.digital
```

#### 2️⃣ Navega a Variables de Entorno
```
Dashboard → [Tu sitio] → Site configuration → Environment variables
```

#### 3️⃣ Agrega las 2 Variables

Click en **"Add a variable"**:

**Variable 1:**
```
Key: VITE_SUPABASE_URL
Value: https://qhwvuuyjhcennqccgvse.supabase.co
Scopes: ✅ Production, ✅ Deploy Previews, ✅ Branch deploys
```

**Variable 2:**
```
Key: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ
Scopes: ✅ Production, ✅ Deploy Previews, ✅ Branch deploys
```

#### 4️⃣ Redeploy
```
Deploys → Trigger deploy → Deploy site
```

**⏱️ Espera 2-3 minutos** a que termine el build.

#### 5️⃣ Limpia Caché
```
En Chrome/Edge:
- Ctrl + Shift + Delete (Windows/Linux)
- Cmd + Shift + Delete (Mac)
- Marca "Cached images and files"
- Click "Clear data"
```

#### 6️⃣ Recarga Forzada
```
- Ctrl + Shift + R (Windows/Linux)
- Cmd + Shift + R (Mac)
```

## 🔍 Cómo Verificar que Funciona

### ANTES (Con Error):
1. Visita: https://app.movi.digital
2. Abre consola (F12)
3. Verás:
   ```
   ❌ ERROR: Variables de entorno de Supabase no configuradas
   📍 Dominio actual: app.movi.digital
   ```

### DESPUÉS (Funcionando):
1. Visita: https://app.movi.digital
2. Abre consola (F12)
3. Verás:
   ```
   [Supabase] Initializing with URL: https://qhwvuuyjhcennqccgvse.supabase.co
   [Supabase] Client initialized successfully
   [AuthContext] Initializing...
   ```

## 📝 Resumen Visual

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE DEPLOYMENT                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Bolt.new (Desarrollo)                                       │
│  └─ Lee .env ✅                                              │
│     └─ VITE_SUPABASE_URL está definida                      │
│        └─ App funciona ✅                                    │
│                                                              │
│  ↓ (Deploy)                                                  │
│                                                              │
│  Netlify (Producción)                                        │
│  └─ NO lee .env del repositorio ❌                           │
│     └─ Busca en "Environment Variables" de Netlify          │
│        ├─ Si NO están configuradas: undefined ❌            │
│        │  └─ Error de conexión                              │
│        │                                                     │
│        └─ Si SÍ están configuradas: valores correctos ✅    │
│           └─ App funciona perfectamente                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## ⚠️ Conceptos Importantes

### ❌ MITOS (Lo que NO funciona):

1. **"Ya tengo el .env en el código"**
   - ❌ Netlify NO lee archivos .env del repositorio por seguridad

2. **"Voy a subir el .env a GitHub"**
   - ❌ NUNCA hagas esto, es un riesgo de seguridad

3. **"Funcionará automáticamente al hacer deploy"**
   - ❌ Debes configurar manualmente en el panel de Netlify

### ✅ REALIDADES (Lo que SÍ funciona):

1. **Variables en el panel de Netlify**
   - ✅ Esta es la forma correcta y segura

2. **Redeploy después de agregar variables**
   - ✅ Las variables solo se inyectan durante el build

3. **Variables con prefijo VITE_**
   - ✅ Solo las variables con este prefijo se exponen al navegador

## 🆘 Problemas Comunes

### "No tengo acceso a Netlify"
**Solución:** Pide acceso al administrador que hizo el deploy original, o re-deploya tú mismo desde Bolt.new.

### "No encuentro mi sitio en Netlify"
**Solución:**
- Puede estar en un Team diferente
- Revisa todos los workspaces
- Busca por "app.movi.digital" en la barra de búsqueda

### "Configuré las variables pero sigue fallando"
**Solución:**
1. ¿Hiciste redeploy? (obligatorio)
2. ¿Esperaste 3-5 minutos?
3. ¿Limpiaste la caché del navegador?
4. ¿Probaste en ventana incógnito?

### "Funciona en Bolt pero no en app.movi.digital"
**Solución:** Esto confirma que las variables NO están en Netlify. Sigue los pasos de arriba.

## 🎯 Checklist Final

Antes de decir "ya lo intenté todo":

- [ ] Accedí al panel de Netlify
- [ ] Encontré el sitio app.movi.digital
- [ ] Fui a Site configuration → Environment variables
- [ ] Agregué VITE_SUPABASE_URL
- [ ] Agregué VITE_SUPABASE_ANON_KEY
- [ ] Hice clic en "Save" o "Add"
- [ ] Fui a Deploys → Trigger deploy
- [ ] Esperé a que termine el build (verde ✅)
- [ ] Limpié la caché del navegador
- [ ] Recargué con Ctrl+Shift+R
- [ ] Abrí la consola (F12) y verifiqué los logs

## 📞 Soporte

Si después de seguir TODOS los pasos anteriores sigue sin funcionar:

1. **Captura de pantalla** de la página de Environment Variables en Netlify
2. **Captura de pantalla** de la consola del navegador (F12)
3. **Captura de pantalla** del último deploy en Netlify (debe estar verde)

Con esa información podremos diagnosticar el problema específico.
