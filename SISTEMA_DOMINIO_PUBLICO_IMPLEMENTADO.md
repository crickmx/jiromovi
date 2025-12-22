# Sistema de Dominio Público Implementado

## Resumen

Se implementó un sistema completo de protección y redirección para el dominio público **agentedeseguros.online** que:

1. ✅ Elimina errores 404 al refrescar o acceder directamente a URLs tipo `/slug`
2. ✅ Bloquea acceso a módulos internos desde el dominio público
3. ✅ Redirige automáticamente a www.movi.digital cuando corresponde
4. ✅ Valida slugs contra la base de datos antes de mostrar perfiles

---

## Implementaciones

### 1. Solución al 404 en Deep Links

**Problema:** Al refrescar una URL como `agentedeseguros.online/juan-perez`, el servidor devolvía 404 porque buscaba un archivo físico que no existe.

**Solución implementada:**

#### A. Script PostBuild (scripts/postbuild.cjs)
```javascript
// Copia automáticamente index.html -> 404.html
// Muchos hostings sirven 404.html en lugar de error 404
```

**Configuración en package.json:**
```json
"build": "vite build && node scripts/postbuild.cjs"
```

#### B. Archivo _redirects (ya existente en public/)
```
/* /index.html 200
```

**Resultado:** Ahora todas las rutas sirven el SPA correctamente, permitiendo que el router de React maneje la navegación.

---

### 2. Domain Gate - Protección de Rutas Internas

**Problema:** Usuarios podrían intentar acceder a rutas internas como `/dashboard`, `/comisiones`, `/crm` desde el dominio público.

**Solución implementada en src/main.tsx:**

```typescript
// Se ejecuta ANTES de cargar la app
const PUBLIC_HOSTS = new Set([
  "agentedeseguros.online",
  "www.agentedeseguros.online"
]);

const RESERVED = new Set([
  "login", "dashboard", "crm", "comisiones", "publicidad",
  "admin", "api", "assets", "configuracion", "directorio",
  "chat", "vacaciones", "tramites", "store", "mis-comisiones",
  "mi-produccion", "oficinas", "notificaciones", "comunicados",
  "perfil", "usuarios", "education", "espacio-jiro",
  "movimeet", "catalogos"
]);
```

**Reglas de redirección:**

1. **Si estás en el dominio público:**
   - `/` → redirige a www.movi.digital
   - `/:slug` válido → muestra perfil público
   - `/:slug` reservado → redirige a www.movi.digital
   - `/cualquier/path/multiple` → redirige a www.movi.digital

2. **Si NO estás en el dominio público:**
   - Funciona normalmente (aplicación interna completa)

---

### 3. Validación de Slug contra Base de Datos

**Implementado en PaginaPublicaAsesor.tsx:**

```typescript
// 1. Carga el perfil desde Supabase usando el slug
const pageData = await getPublicWebPageBySlug(slug);

// 2. Valida que exista, esté publicado y el usuario esté activo
if (!pageData || !pageData.user || !pageData.config?.is_published) {
  window.location.replace("https://www.movi.digital");
  return;
}
```

**Validaciones en la función de BD (get_public_web_page_by_slug):**
- Slug debe existir en `usuarios.web_slug`
- Usuario debe tener `estado = 'activo'`
- Página debe tener `is_published = true`
- Si falta cualquier condición → redirección automática

---

## Flujo Completo de Usuario

### Escenario 1: Usuario entra a agentedeseguros.online/
```
1. Domain Gate detecta dominio público
2. Path es "/"
3. → Redirige a www.movi.digital
```

### Escenario 2: Usuario entra a agentedeseguros.online/juan-perez
```
1. Domain Gate detecta dominio público
2. Path es "/:slug" válido
3. "juan-perez" NO está en RESERVED
4. ✅ Permite cargar la app
5. PaginaPublicaAsesor consulta BD
6. Si slug existe y está activo → Muestra perfil
7. Si no existe → Redirige a www.movi.digital
```

### Escenario 3: Usuario entra a agentedeseguros.online/dashboard
```
1. Domain Gate detecta dominio público
2. Path es "/:slug"
3. "dashboard" SÍ está en RESERVED
4. → Redirige INMEDIATAMENTE a www.movi.digital
```

### Escenario 4: Usuario entra a agentedeseguros.online/juan-perez/algo
```
1. Domain Gate detecta dominio público
2. Path NO es "/:slug" (tiene más segmentos)
3. → Redirige INMEDIATAMENTE a www.movi.digital
```

### Escenario 5: Usuario entra desde www.movi.digital/dashboard
```
1. Domain Gate detecta dominio NO público
2. ✅ Permite acceso normal
3. Router interno maneja la ruta
4. Usuario accede al dashboard normalmente
```

---

## Archivos Modificados

### Nuevos Archivos:
- ✅ `scripts/postbuild.cjs` - Script de postbuild para crear 404.html

### Archivos Modificados:
- ✅ `package.json` - Agregado postbuild al script de build
- ✅ `src/main.tsx` - Agregado Domain Gate antes de renderizar
- ✅ `src/pages/PaginaPublicaAsesor.tsx` - Mejorada redirección cuando slug no existe
- ✅ `supabase/migrations/add_user_logo_to_public_page.sql` - Agregado mi_logotipo_url a la función

### Archivos Existentes (sin cambios):
- ✅ `public/_redirects` - Ya tenía la configuración correcta
- ✅ `dist/404.html` - Se genera automáticamente en cada build

---

## Testing Recomendado

### Tests Locales (desarrollo):
```bash
npm run build
npm run preview
```

Probar:
1. http://localhost:4173/ → debe funcionar
2. http://localhost:4173/juan-perez → debe funcionar (si existe)
3. http://localhost:4173/dashboard → debe funcionar (porque no es dominio público)

### Tests en Producción (después de deploy):

#### En agentedeseguros.online:
1. ✅ `https://agentedeseguros.online/` → redirige a movi.digital
2. ✅ `https://agentedeseguros.online/slug-valido` → muestra perfil
3. ✅ `https://agentedeseguros.online/slug-invalido` → redirige a movi.digital
4. ✅ `https://agentedeseguros.online/dashboard` → redirige a movi.digital
5. ✅ `https://agentedeseguros.online/crm` → redirige a movi.digital
6. ✅ `https://agentedeseguros.online/usuario/perfil` → redirige a movi.digital

#### En www.movi.digital:
1. ✅ `https://www.movi.digital/dashboard` → funciona normal
2. ✅ `https://www.movi.digital/crm` → funciona normal
3. ✅ `https://www.movi.digital/comisiones` → funciona normal

---

## Ventajas de esta Implementación

1. **Zero Configuration Hosting:** Funciona en la mayoría de hostings estáticos sin configuración especial
2. **Doble Capa de Protección:** Domain Gate + validación de BD
3. **Performance:** Redirecciones instantáneas antes de cargar la app completa
4. **Mantenible:** Lista de slugs reservados fácil de actualizar
5. **Seguro:** Imposible acceder a módulos internos desde dominio público
6. **SEO Friendly:** URLs limpias tipo `agentedeseguros.online/juan-perez`

---

## Próximos Pasos Sugeridos

1. **Configurar DNS:** Apuntar agentedeseguros.online a tu hosting
2. **Deploy:** Subir el build a tu hosting
3. **Testing:** Verificar todos los escenarios listados arriba
4. **Monitoreo:** Verificar logs para ver intentos de acceso bloqueados
5. **SEO:** Configurar sitemap.xml para los perfiles públicos activos

---

## Notas Importantes

- ⚠️ El Domain Gate se ejecuta en el cliente (navegador), no en el servidor
- ⚠️ Si alguien desactiva JavaScript, verán el HTML pero no funcionará
- ⚠️ Para seguridad adicional, considera configurar CORS en tu backend
- ✅ La validación de BD es la capa de seguridad definitiva
- ✅ Los slugs reservados evitan colisiones con rutas internas

---

## Soporte

Si un slug nuevo necesita ser bloqueado, simplemente agrégalo al Set RESERVED en `src/main.tsx`:

```typescript
const RESERVED = new Set([
  // ... slugs existentes
  "nuevo-slug-a-bloquear"
]);
```

Y rebuildealo.
