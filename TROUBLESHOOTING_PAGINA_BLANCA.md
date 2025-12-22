# 🔧 Troubleshooting: Página en Blanco

## 🎯 Problema
`https://app.movi.digital/ejemplo` muestra página en blanco

---

## ✅ Verificaciones Hechas

### Backend (Base de Datos)
- ✅ Función RPC `get_public_web_page_by_slug` funciona correctamente
- ✅ Políticas RLS configuradas para acceso público
- ✅ Usuario "ejemplo" existe y tiene página publicada
- ✅ Datos se devuelven correctamente

### Frontend (Build)
- ✅ Build completado sin errores
- ✅ Componente `PaginaPublicaAsesor` existe y está correcto
- ✅ Ruta `/:slug` configurada al final de App.tsx
- ✅ Archivo `_redirects` presente para SPA routing

---

## 🔍 Pasos de Diagnóstico

### Paso 1: Verificar Deploy
El build local está listo, pero **necesitas deployar a producción**:

#### Si usas Netlify con Git:
```bash
git add .
git commit -m "Fix: páginas públicas funcionando"
git push origin main
```

Espera 2-3 minutos a que Netlify complete el deploy.

#### Si usas deploy manual:
```bash
# En tu máquina local
npm run build

# Sube la carpeta dist/ a Netlify
```

### Paso 2: Verificar en el Navegador

1. **Abrir consola del navegador** (F12 o Cmd+Option+I)
2. **Ir a la pestaña "Console"**
3. **Navegar a:** `https://app.movi.digital/ejemplo`
4. **Buscar errores en rojo**

#### Errores Comunes:

**Error: "Failed to fetch"**
```
Causa: La función RPC no tiene permisos públicos
Solución: Ya corregido en la migración
```

**Error: "404 Not Found"**
```
Causa: El archivo _redirects no está en dist/
Solución: Verificar que public/_redirects se copie al build
```

**Error: "Unexpected token '<'"**
```
Causa: React Router no está funcionando, devuelve index.html para JS
Solución: Verificar configuración de Netlify
```

**Error: Network tab muestra 200 pero página blanca**
```
Causa: JavaScript se ejecuta pero hay un error de renderizado
Solución: Ver errores en consola
```

### Paso 3: Limpiar Caché

El navegador puede estar usando una versión vieja:

1. **Abrir DevTools** (F12)
2. **Click derecho en el botón de recarga**
3. **Seleccionar "Empty Cache and Hard Reload"**

O usar modo incógnito:
- Chrome/Edge: Ctrl+Shift+N (Windows) o Cmd+Shift+N (Mac)
- Firefox: Ctrl+Shift+P (Windows) o Cmd+Shift+P (Mac)

### Paso 4: Verificar Netlify Deploy

1. Ir a tu dashboard de Netlify
2. Verificar que el último deploy tenga:
   - ✅ Status: Published
   - ✅ Commit: El más reciente
   - ✅ Deploy time: Hace pocos minutos

3. Si el deploy falló:
   - Ver logs de deploy
   - Buscar errores de build
   - Re-deployar si es necesario

### Paso 5: Probar la Función RPC Directamente

Abre esta URL para probar los datos:
```
https://app.movi.digital/test-pagina-publica-simple.html
```

Si esta página funciona pero `/ejemplo` no:
- El problema es el routing de React
- Verifica App.tsx en producción

Si esta página NO funciona:
- El problema es el backend o permisos
- Verifica las políticas RLS

### Paso 6: Probar la Herramienta de Diagnóstico

Abre:
```
https://app.movi.digital/test-ruta-ejemplo.html
```

Esta herramienta ejecuta 6 verificaciones automáticas y te dice exactamente qué está fallando.

---

## 🚨 Escenarios y Soluciones

### Escenario 1: Build no deployado
**Síntomas:**
- Cambios en el código no se reflejan
- La página sigue igual que antes
- Test HTML funcionan pero página React no

**Solución:**
```bash
git add .
git commit -m "Deploy latest build"
git push origin main
```

Espera a que Netlify complete el deploy (verifica en el dashboard).

---

### Escenario 2: Caché del navegador
**Síntomas:**
- Otros usuarios pueden ver la página
- Solo falla en tu navegador
- Funciona en modo incógnito

**Solución:**
1. Limpiar caché del navegador (Hard Reload)
2. Probar en modo incógnito
3. Probar en otro navegador

---

### Escenario 3: Error de JavaScript
**Síntomas:**
- Consola muestra errores en rojo
- Network tab muestra archivos cargados
- Página blanca sin contenido

**Solución:**
1. Ver el error específico en consola
2. Si es "Cannot find module":
   - Verificar imports en el código
   - Re-ejecutar build
3. Si es "Unexpected token":
   - Verificar sintaxis del código
   - Verificar que Vite compile correctamente

---

### Escenario 4: Routing no funciona
**Síntomas:**
- `/dashboard` funciona
- `/ejemplo` no funciona
- Devuelve 404

**Solución:**
Verificar `_redirects` en Netlify:
1. Ir a Site settings → Build & deploy → Post processing
2. Verificar que "Asset optimization" NO esté reescribiendo _redirects
3. Verificar que `_redirects` contenga:
   ```
   /*    /index.html   200
   ```

---

### Escenario 5: Usuario no existe o no está publicado
**Síntomas:**
- Test RPC devuelve `null`
- Función ejecuta sin error pero sin datos
- Otras páginas públicas tampoco funcionan

**Solución:**
Verificar en Supabase:
```sql
SELECT
  u.nombre_completo,
  u.web_slug,
  u.estado,
  uwp.is_published
FROM usuarios u
LEFT JOIN user_web_pages uwp ON uwp.user_id = u.id
WHERE u.web_slug = 'ejemplo';
```

Si `is_published` es `false`:
1. Login en app.movi.digital
2. Ir a **Mi Página Web**
3. Activar toggle **"Publicar página"**
4. Guardar cambios

---

## 📝 Checklist Final

Marca cada ítem conforme lo verifiques:

- [ ] Build local completado sin errores
- [ ] Commit y push al repositorio
- [ ] Deploy de Netlify completado (verificar dashboard)
- [ ] Caché del navegador limpiado
- [ ] Consola del navegador sin errores
- [ ] Test RPC devuelve datos correctos
- [ ] Usuario "ejemplo" tiene `is_published = true`
- [ ] Archivo `_redirects` presente en deploy
- [ ] Probado en modo incógnito
- [ ] Probado en otro navegador

---

## 🎯 Test Rápido

Ejecuta este comando en la consola del navegador cuando estés en `app.movi.digital`:

```javascript
fetch('https://qhwvuuyjhcennqccgvse.supabase.co/rest/v1/rpc/get_public_web_page_by_slug', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ'
  },
  body: JSON.stringify({ p_slug: 'ejemplo' })
})
.then(r => r.json())
.then(d => console.log('✅ Datos recibidos:', d))
.catch(e => console.error('❌ Error:', e));
```

**Resultado esperado:**
```javascript
✅ Datos recibidos: {
  user: { name: "Christofer Cruz-Chousal Jiménez", ... },
  config: { is_published: true, ... },
  insurers: [...],
  categories: [...]
}
```

Si ves esto, **el backend funciona**.

---

## 🆘 Si Nada Funciona

1. **Verificar en Supabase:**
   - Ir a SQL Editor
   - Ejecutar: `SELECT get_public_web_page_by_slug('ejemplo');`
   - ¿Devuelve datos? → Backend OK

2. **Verificar build local:**
   ```bash
   npm run build
   npx serve dist
   ```
   - Abrir http://localhost:3000/ejemplo
   - ¿Funciona local? → Deploy es el problema

3. **Verificar Netlify:**
   - ¿Deploy completado?
   - ¿Sin errores en logs?
   - ¿_redirects presente?

4. **Último recurso:**
   ```bash
   # Limpieza completa
   rm -rf node_modules dist
   npm install
   npm run build

   # Deploy forzado
   git add .
   git commit -m "Force redeploy"
   git push -f origin main
   ```

---

## 📞 Contacto de Soporte

Si después de todos estos pasos sigue sin funcionar:

1. Ejecutar: `https://app.movi.digital/test-ruta-ejemplo.html`
2. Capturar toda la salida
3. Abrir consola del navegador en `/ejemplo`
4. Capturar todos los errores
5. Compartir ambos con el equipo técnico

---

## ✅ Cuando Todo Funcione

Deberías poder:

1. Abrir `https://app.movi.digital/ejemplo` sin login
2. Ver la página de Christofer completamente renderizada
3. Click en WhatsApp → Abre chat con él
4. Ver 9 logos de aseguradoras
5. Ver 6 categorías de seguros
6. Todo responsive en móvil

**¡La página pública estará operativa!** 🎉
