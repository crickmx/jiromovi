# PWA Implementación Completa - Movi Digital

## Resumen

Se ha implementado un sistema PWA (Progressive Web App) completo con detección inteligente de plataforma. La aplicación ahora:

- **En Android**: Muestra un botón que redirige directamente a la app oficial en Google Play Store
- **En iOS/Desktop**: Permite la instalación de la PWA directamente desde el navegador
- **Funciona offline**: Cache inteligente de recursos y datos
- **Se actualiza automáticamente**: Service worker con actualización automática

## Características Implementadas

### 1. Detección Inteligente de Plataforma

La app detecta automáticamente:
- Sistema operativo (Android, iOS, Windows, macOS)
- Navegador (Chrome, Safari, Edge, Firefox)
- Dispositivo (móvil, tablet, desktop)
- Si ya está instalada como PWA

### 2. Botón de Instalación Contextual

**Ubicación**: Header superior (móvil y desktop)

**Comportamiento por plataforma**:
- **Android**: Muestra botón "Descargar App" que abre Google Play Store
- **iOS/Desktop Chrome/Edge**: Muestra botón "Instalar App" que activa instalación PWA
- **Safari Desktop**: Muestra instrucciones de instalación manual
- **Ya instalada**: No se muestra

### 3. Banner de Instalación

**Características**:
- Aparece después de 3 segundos de uso
- Se muestra máximo 3 veces por día
- Puede descartarse permanentemente
- Diseño discreto en la esquina inferior derecha
- Adaptado al contexto de cada plataforma

### 4. Service Worker y Cache

**Estrategias de cache**:
- **NetworkFirst** para APIs de Supabase (datos siempre frescos cuando hay conexión)
- **CacheFirst** para Google Fonts (recursos que no cambian)
- **CacheFirst** para imágenes (optimización de rendimiento)

**Características**:
- Límite de cache: 5MB por archivo
- Limpieza automática de cache antiguo
- Actualización automática del service worker

## Archivos Creados

### Utilidades y Hooks

1. **`src/lib/platformUtils.ts`**
   - Funciones de detección de plataforma
   - Helpers para determinar capacidades del dispositivo

2. **`src/hooks/usePlatformDetection.ts`**
   - Hook React para detectar plataforma
   - Actualización automática en cambios de tamaño de ventana

3. **`src/hooks/useInstallPrompt.ts`**
   - Hook para manejar evento de instalación PWA
   - Control del ciclo de vida de instalación

### Componentes

4. **`src/components/InstallAppButton.tsx`**
   - Botón inteligente que cambia según plataforma
   - Tracking de analytics integrado
   - Múltiples variantes de diseño

5. **`src/components/InstallBanner.tsx`**
   - Banner promocional con lógica de frecuencia
   - Diseño responsivo y animado
   - Mensajes contextuales por plataforma

### Constantes

6. **`src/constants/appLinks.ts`**
   - Link a Google Play Store: `https://play.google.com/store/apps/details?id=com.wnapp.id1739907855051`
   - Eventos de analytics
   - Keys de localStorage

### Configuración

7. **`vite.config.ts`** (actualizado)
   - Configuración completa de vite-plugin-pwa
   - Manifest de la app
   - Configuración de Workbox

8. **`index.html`** (actualizado)
   - Meta tags PWA cross-browser
   - Apple touch icons
   - Open Graph tags

## Generación de Iconos

Se ha creado un generador de iconos en: **`public/generate-pwa-icons.html`**

### Cómo Generar los Iconos

1. Abre el archivo en tu navegador:
   ```
   http://localhost:5173/generate-pwa-icons.html
   ```

2. Haz clic en "Generar Todos los Iconos"

3. Descarga cada icono haciendo clic en su botón "Descargar"

4. Guarda todos los iconos en la carpeta `/public`

### Iconos Requeridos

**Iconos PWA estándar**:
- `pwa-icon-192.png` (192x192)
- `pwa-icon-512.png` (512x512)
- `pwa-icon-192-maskable.png` (192x192, con padding para Android)
- `pwa-icon-512-maskable.png` (512x512, con padding para Android)

**Iconos Apple Touch**:
- `apple-touch-icon-120.png` (120x120, iPhone estándar)
- `apple-touch-icon-152.png` (152x152, iPad)
- `apple-touch-icon-167.png` (167x167, iPad Pro)
- `apple-touch-icon-180.png` (180x180, iPhone Retina)

**Splash Screens iOS**:
- `splash-iphone-14.png` (1170x2532)
- `splash-iphone-14-pro.png` (1179x2556)
- `splash-iphone-14-pro-max.png` (1290x2796)

**Screenshots para instalación**:
- `screenshot-1.png` (1280x720, desktop)
- `screenshot-2.png` (750x1334, mobile)

## Manifest de la App

El manifest está configurado automáticamente con:

```json
{
  "name": "Movi Digital",
  "short_name": "Movi",
  "description": "Plataforma integral para agentes de seguros",
  "theme_color": "#0066FF",
  "background_color": "#ffffff",
  "display": "standalone",
  "orientation": "portrait-primary"
}
```

## Link a Google Play Store

El botón en Android redirige a:
```
https://play.google.com/store/apps/details?id=com.wnapp.id1739907855051&pcampaignid=web_share&pli=1
```

## Cómo Probar

### En Desarrollo (localhost)

La PWA está deshabilitada en modo desarrollo para evitar problemas de cache.

### En Producción

1. **Build del proyecto**:
   ```bash
   npm run build
   ```

2. **Preview local**:
   ```bash
   npm run preview
   ```

3. **Probar en Android**:
   - Abre la URL en Chrome Android
   - Verifica que aparezca el botón "Descargar App"
   - Haz clic y confirma que abre Google Play Store

4. **Probar en iOS**:
   - Abre la URL en Safari iOS
   - Verifica que aparezca el banner de instalación
   - Sigue las instrucciones para añadir a pantalla de inicio

5. **Probar en Desktop Chrome/Edge**:
   - Abre la URL en Chrome o Edge
   - Verifica que aparezca el botón "Instalar App"
   - Haz clic y confirma la instalación

## Comportamiento Offline

La app funciona parcialmente offline:

**Funciona offline**:
- Navegación entre páginas ya visitadas
- Visualización de datos en cache
- Assets estáticos (CSS, JS, imágenes)

**Requiere conexión**:
- Login/autenticación
- Operaciones de escritura en base de datos
- Datos en tiempo real
- APIs externas

## Analytics y Tracking

Se rastrean los siguientes eventos (requiere Google Analytics configurado):

- `install_prompt_shown`: Cuando se muestra el prompt de instalación
- `install_button_clicked`: Cuando el usuario hace clic en instalar
- `android_app_link_clicked`: Cuando se hace clic en el link a Play Store
- `pwa_installed`: Cuando se completa la instalación PWA
- `pwa_install_dismissed`: Cuando se descarta el prompt

## Personalización

### Cambiar el Link de Play Store

Edita el archivo `src/constants/appLinks.ts`:

```typescript
export const APP_LINKS = {
  ANDROID_PLAY_STORE: 'TU_NUEVO_LINK_AQUI',
  // ...
}
```

### Cambiar Colores de Tema

Edita el archivo `vite.config.ts`:

```typescript
manifest: {
  theme_color: '#0066FF', // Color principal
  background_color: '#ffffff', // Color de fondo
  // ...
}
```

### Ajustar Frecuencia del Banner

Edita el archivo `src/components/InstallBanner.tsx`:

```typescript
// Línea ~13: cambiar el delay inicial (3000ms = 3 segundos)
setTimeout(() => { ... }, 3000);

// Línea ~10: cambiar máximo de veces por día (actualmente 3)
if (lastPromptDate === today && promptCount >= 3) {
```

## Próximos Pasos Opcionales

1. **Optimización de Bundle**:
   - Implementar code splitting para reducir el tamaño del bundle principal
   - Actualmente es de 3.6 MB (comprimido a 880 KB)

2. **Notificaciones Push**:
   - La infraestructura está lista para agregar notificaciones push
   - Requiere configuración adicional de Firebase o similar

3. **Screenshots Reales**:
   - Reemplazar los screenshots placeholder con capturas reales de la app
   - Mejorarán la percepción en el prompt de instalación

4. **Iconos con Logo Real**:
   - Reemplazar los iconos generados con diseños profesionales
   - Usar el logo oficial de Movi Digital

## Soporte de Navegadores

| Navegador | Instalación PWA | Redirect a Play Store |
|-----------|----------------|----------------------|
| Chrome Android | ✅ (redirige a Play Store) | ✅ |
| Safari iOS | ✅ (instalación manual) | ❌ |
| Chrome Desktop | ✅ | N/A |
| Edge Desktop | ✅ | N/A |
| Firefox | ⚠️ (limitado) | N/A |
| Safari Desktop | ⚠️ (instrucciones) | N/A |

## Troubleshooting

### El botón no aparece

**Causas posibles**:
1. Ya está instalada la PWA
2. El prompt fue descartado permanentemente
3. Navegador no compatible

**Solución**:
- Limpia localStorage: `localStorage.clear()`
- Prueba en ventana de incógnito
- Verifica la consola del navegador para errores

### La instalación PWA no funciona

**Causas posibles**:
1. Service worker no registrado
2. Manifest no accesible
3. Iconos faltantes

**Solución**:
- Abre DevTools → Application → Service Workers
- Verifica que el SW esté registrado y activo
- Revisa que `/manifest.webmanifest` sea accesible
- Confirma que los iconos existan en `/public`

### El link a Play Store no funciona

**Causas posibles**:
1. URL incorrecta
2. App no disponible en la región

**Solución**:
- Verifica la URL en `src/constants/appLinks.ts`
- Prueba abrir la URL manualmente en el navegador
- Confirma que la app esté publicada en Play Store

## Mantenimiento

### Actualizar Service Worker

El service worker se actualiza automáticamente, pero puedes forzar la actualización:

1. Incrementa la versión en `vite.config.ts`
2. Haz un nuevo build: `npm run build`
3. Despliega la nueva versión

Los usuarios existentes recibirán la actualización automáticamente en su próxima visita.

### Limpiar Cache Viejo

El sistema limpia automáticamente cache desactualizado, pero puedes forzarlo:

```javascript
// En DevTools Console
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key));
});
```

## Recursos Adicionales

- [Documentación de vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Guía de PWA de Google](https://web.dev/progressive-web-apps/)
- [Workbox Documentation](https://developer.chrome.com/docs/workbox/)
- [Manifest Generator](https://www.simicart.com/manifest-generator.html/)

## Contacto

Para soporte o preguntas sobre la implementación PWA:
- Email: soporte@movidigital.com
- Documentación interna: Ver este archivo

---

Implementado el 30 de diciembre de 2024
