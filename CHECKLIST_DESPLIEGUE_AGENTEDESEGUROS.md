# Checklist de Despliegue - agentedeseguros.online

## ✅ Pre-Despliegue (Completado)

- [x] Código corregido en `src/App.tsx`
- [x] Separación de rutas públicas y protegidas
- [x] Build ejecutado exitosamente
- [x] `dist/index.html` generado
- [x] `dist/404.html` generado
- [x] `dist/_redirects` presente
- [x] Todos los assets en `dist/assets/`

## 📋 Pasos para Despliegue

### Opción 1: Despliegue Automático (Git + Netlify/Vercel)

Si tienes el proyecto conectado a un repositorio Git:

1. Hacer commit de los cambios:
   ```bash
   git add src/App.tsx
   git commit -m "fix: separar rutas públicas de autenticación para /:slug"
   git push
   ```

2. El despliegue automático se activará

3. Esperar 2-3 minutos

4. Verificar en https://agentedeseguros.online/ejemplo

### Opción 2: Despliegue Manual (Subir dist/)

Si subes los archivos manualmente al hosting:

1. **Comprimir la carpeta dist/**
   ```bash
   cd /tmp/cc-agent/59016970/project
   tar -czf dist.tar.gz dist/
   ```

2. **Subir al servidor**
   - Accede a tu panel de hosting
   - Localiza la carpeta pública (ej: `public_html`, `www`, `htdocs`)
   - Elimina todo el contenido actual
   - Sube todo el contenido de `dist/`

3. **Verificar archivos críticos**
   - `index.html` en la raíz ✓
   - `404.html` en la raíz ✓
   - `_redirects` en la raíz ✓
   - Carpeta `assets/` completa ✓

4. **Limpiar cache**
   - En tu panel de hosting, busca "Clear Cache" o "Purge Cache"
   - Si usas Cloudflare, purga el cache completo

### Opción 3: Desde Bolt.new

Si estás usando Bolt.new:

1. En Bolt, ve a la sección de Deployments

2. Si ya existe un deployment:
   - Elimínalo
   - Esto forzará un redeploy limpio

3. Crea un nuevo deployment:
   - Selecciona "Deploy to Production"
   - Espera a que termine el proceso
   - Bolt mostrará la URL final

4. Verifica la URL generada

## 🧪 Pruebas Post-Despliegue

Después de desplegar, verifica:

- [ ] https://agentedeseguros.online/ejemplo carga correctamente
- [ ] Muestra la foto del asesor (Christofer Cruz-Chousal Jiménez)
- [ ] Los botones de WhatsApp, Teléfono y Email funcionan
- [ ] La sección de "Mis Seguros" aparece con las 5 categorías
- [ ] El header muestra el logo correctamente
- [ ] La página es responsive (móvil y desktop)

### Comandos de Verificación

```bash
# Verificar que el servidor devuelve 200 OK
curl -I https://agentedeseguros.online/ejemplo

# Verificar que el contenido HTML se sirve
curl https://agentedeseguros.online/ejemplo | grep "Christofer"
```

## 🚨 Troubleshooting

### Problema: Sigue mostrando página vacía

**Solución 1**: Limpiar cache del navegador
- Chrome: Ctrl + Shift + R (Windows) o Cmd + Shift + R (Mac)
- Firefox: Ctrl + F5 (Windows) o Cmd + Shift + R (Mac)
- Safari: Cmd + Option + R

**Solución 2**: Limpiar cache del CDN/hosting
- Accede al panel de tu hosting
- Busca "Cache" o "CDN"
- Purga/limpia el cache completo

**Solución 3**: Verificar que `_redirects` esté en la raíz
- El archivo debe estar en la raíz del directorio público
- Debe contener: `/*    /index.html   200`

### Problema: Error 404 al acceder al slug

**Causa**: El archivo `_redirects` no está presente o mal configurado

**Solución**:
- Verifica que `_redirects` esté en la raíz del hosting
- Contenido correcto: `/*    /index.html   200`
- Algunos hostings requieren `.htaccess` en lugar de `_redirects`

**Para Apache (.htaccess)**:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### Problema: La página carga pero sin estilos

**Causa**: Las rutas de los assets son incorrectas

**Solución**:
- Verifica que la carpeta `assets/` esté en la raíz
- Verifica que los archivos CSS y JS estén presentes
- Revisa la consola del navegador para errores 404

## 📞 Soporte

Si después de seguir todos los pasos el problema persiste:

1. Abre la consola del navegador (F12)
2. Ve a la pestaña "Console"
3. Busca errores en rojo
4. Comparte los errores para diagnóstico adicional
