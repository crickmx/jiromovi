# Despliegue de Cambios en Página Web Pública

## Estado Actual

✅ **Cambios aplicados en el código fuente**
- Archivo modificado: `src/pages/PaginaPublicaAsesor.tsx`
- Build completado exitosamente
- Archivos generados en `dist/`

## Por qué no se ven los cambios en producción

Los cambios están aplicados correctamente en el código local, pero **necesitan ser desplegados** para que se vean en las páginas públicas por slug (como `tudominio.com/ejemplo`).

### Diferencia entre Vista Previa y Página Pública

**Vista Previa (dentro del sistema):**
- Usa el código local en desarrollo
- Los cambios se ven inmediatamente
- Ruta: `/mi-pagina-web` (sistema interno)

**Página Pública por Slug:**
- Usa el código desplegado en producción
- Requiere despliegue para ver cambios
- Ruta: `/:slug` (ej: `/ejemplo`, `/juan`, etc.)
- Mismo componente, diferente ambiente

## Cómo Desplegar los Cambios

### Opción 1: Despliegue a Netlify (Recomendado)

Si el proyecto está conectado a Netlify:

```bash
# Hacer commit de los cambios
git add .
git commit -m "feat: ajustes de diseño en página pública - header eliminado, logo en hero, títulos personalizados"

# Push a la rama principal (o la que uses para producción)
git push origin main
```

Netlify detectará los cambios y desplegará automáticamente.

### Opción 2: Despliegue Manual a Netlify

Si prefieres desplegar manualmente:

```bash
# Instalar Netlify CLI (si no lo tienes)
npm install -g netlify-cli

# Autenticarte
netlify login

# Desplegar
netlify deploy --prod
```

### Opción 3: Limpiar Caché del Navegador

Si los cambios están desplegados pero no se ven:

1. **Chrome/Edge:**
   - Presiona `Ctrl + Shift + R` (Windows) o `Cmd + Shift + R` (Mac)
   - O abre DevTools (F12) → Network → Disable cache

2. **Firefox:**
   - Presiona `Ctrl + Shift + Delete`
   - Selecciona "Cache" y limpia

3. **Safari:**
   - Presiona `Cmd + Option + E`
   - Luego `Cmd + R`

## Verificar que los Cambios se Aplicaron

Una vez desplegado, verifica en la página pública por slug:

### ✅ Checklist de Cambios Visibles

1. **Header eliminado**
   - No debe aparecer barra superior con logo y botón de WhatsApp

2. **Logo en Hero**
   - Logo del usuario visible arriba de su foto
   - Tamaño: 64px (móvil) / 80px (desktop)

3. **Nombre de oficina eliminado**
   - No debe aparecer debajo del nombre del agente

4. **Títulos con color primario**
   - Nombre del agente con color primario
   - "Protege lo que más importa" con color primario
   - "Solicita tu Cotización" con color primario
   - "Aseguradoras de Confianza" con color primario
   - "Seguros a tu medida" con color primario
   - "Sobre Mí" con color primario
   - "¿Listo para proteger..." con color primario

5. **Formulario compacto**
   - Menos espacio vertical entre campos
   - Labels más pequeños (text-xs)
   - Inputs con padding reducido

6. **Copy comercial**
   - Debe decir "Seguros a tu medida" (no "Servicios que Ofrezco")

7. **Aviso de privacidad en footer**
   - Link a "https://jiro.mx/privacidad"
   - Entre copyright y "Powered by MOVI Digital"

## Tiempos de Propagación

- **Netlify:** 1-3 minutos después del despliegue
- **Caché del CDN:** Puede tomar hasta 5-10 minutos
- **Caché del navegador:** Inmediato con hard refresh

## Troubleshooting

### Los cambios no se ven después de desplegar

1. Verifica que el despliegue se completó:
   ```bash
   netlify status
   ```

2. Limpia el caché de Netlify:
   - Ve al dashboard de Netlify
   - Site settings → Build & deploy → Post processing
   - Clear cache and deploy site

3. Verifica que estás viendo la URL correcta:
   - URL de producción: `tudominio.com/slug`
   - No localhost o preview URL

### Error "Page not found" en rutas por slug

Si aparece error 404 en rutas como `/ejemplo`:

1. Verifica que existe el archivo `public/_redirects`:
   ```
   /*    /index.html   200
   ```

2. Si no existe, créalo con ese contenido

3. Vuelve a hacer build y desplegar

## Archivos Modificados en este Update

```
src/pages/PaginaPublicaAsesor.tsx - Todos los cambios visuales y de contenido
```

## Archivos de Build Generados

```
dist/index.html
dist/404.html
dist/assets/index-*.css
dist/assets/index-*.js
```

## Confirmación de Deploy

Para confirmar que los cambios están en producción:

1. Abre DevTools (F12)
2. Ve a la pestaña "Sources"
3. Busca el archivo `PaginaPublicaAsesor`
4. Verifica que el código no tiene el header
5. Verifica que los títulos usan `style={{ color: primaryColor }}`

---

## Resumen

✅ Código modificado correctamente
✅ Build completado sin errores
⏳ **Pendiente:** Desplegar a producción

**Próximo paso:** Hacer commit y push para que Netlify despliegue automáticamente, o usar `netlify deploy --prod` para despliegue manual.

Una vez desplegado, los cambios se verán en todas las páginas públicas por slug.
