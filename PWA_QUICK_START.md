# PWA Quick Start - Movi Digital

## TL;DR

La aplicación Movi Digital ahora es una Progressive Web App (PWA) con detección inteligente de plataforma:

- **Android** → Botón que redirige a Google Play Store
- **iOS/Desktop** → Botón que instala la PWA directamente

## Qué Cambió

### Header
Nuevo botón en el header superior (móvil y desktop) que:
- En Android: Dice "Descargar App" y abre Play Store
- En otros dispositivos: Dice "Instalar App" y activa instalación PWA

### Banner Promocional
Banner discreto que aparece después de 3 segundos:
- Máximo 3 veces por día
- Puede descartarse permanentemente
- Mensajes específicos por plataforma

### Funcionalidad Offline
- Cache inteligente de recursos
- Funciona sin conexión para páginas ya visitadas
- Actualización automática en segundo plano

## Link a Play Store Configurado

```
https://play.google.com/store/apps/details?id=com.wnapp.id1739907855051
```

## Antes de Desplegar

### 1. Generar Iconos PWA

Abre en tu navegador:
```
/public/generate-pwa-icons.html
```

Haz clic en "Generar Todos los Iconos" y descarga cada uno a `/public`.

### 2. Build del Proyecto

```bash
npm run build
```

### 3. Probar Localmente

```bash
npm run preview
```

Abre en:
- Chrome Android: Verifica botón a Play Store
- Safari iOS: Verifica banner de instalación
- Chrome Desktop: Verifica botón de instalación

## Cómo Funciona

```
Usuario visita la app
       ↓
Detecta plataforma automáticamente
       ↓
┌──────────────┬─────────────────┐
│   Android    │  iOS/Desktop    │
│      ↓       │       ↓         │
│  Muestra     │   Muestra       │
│  botón a     │   botón de      │
│ Play Store   │  instalación    │
│      ↓       │       ↓         │
│   Abre       │  Instala PWA    │
│ Play Store   │ directamente    │
└──────────────┴─────────────────┘
```

## Testing Rápido

**Android Chrome**:
```bash
# 1. Abre la app en Chrome Android
# 2. Busca el botón en el header superior derecho
# 3. Haz clic → debe abrir Play Store
```

**iOS Safari**:
```bash
# 1. Abre la app en Safari iOS
# 2. Espera 3 segundos → aparece banner
# 3. Sigue instrucciones para añadir a inicio
```

**Desktop Chrome**:
```bash
# 1. Abre la app en Chrome Desktop
# 2. Busca botón "Instalar App" en header
# 3. Haz clic → debe mostrar dialog de instalación
```

## Personalización Rápida

### Cambiar Link de Play Store
`src/constants/appLinks.ts` → `ANDROID_PLAY_STORE`

### Cambiar Colores
`vite.config.ts` → `manifest.theme_color`

### Ajustar Frecuencia de Banner
`src/components/InstallBanner.tsx` → línea 13 (delay) y línea 10 (max por día)

## Archivos Clave

```
src/
├── components/
│   ├── InstallAppButton.tsx      ← Botón en header
│   └── InstallBanner.tsx          ← Banner promocional
├── hooks/
│   ├── usePlatformDetection.ts    ← Detecta plataforma
│   └── useInstallPrompt.ts        ← Maneja instalación
├── lib/
│   └── platformUtils.ts           ← Utilidades de detección
└── constants/
    └── appLinks.ts                ← Links y constantes

public/
└── generate-pwa-icons.html        ← Generador de iconos

vite.config.ts                     ← Configuración PWA
index.html                         ← Meta tags PWA
```

## Troubleshooting Rápido

**Botón no aparece**:
```javascript
// En DevTools Console
localStorage.clear()
location.reload()
```

**Service Worker no funciona**:
```
DevTools → Application → Service Workers → Unregister
Hacer hard refresh (Ctrl+Shift+R)
```

**Build falla**:
```bash
# Limpiar cache y reinstalar
rm -rf node_modules dist
npm install
npm run build
```

## Siguiente Deploy

1. ✅ Generar iconos con `generate-pwa-icons.html`
2. ✅ Guardar todos en `/public`
3. ✅ Hacer `npm run build`
4. ✅ Probar en diferentes dispositivos
5. ✅ Deploy normal

## Resultados Esperados

Después del deploy:

✅ En Android: Botón funcional que abre Play Store
✅ En iOS: Banner que guía instalación de PWA
✅ En Desktop: Instalación nativa desde navegador
✅ Funciona offline (parcialmente)
✅ Se actualiza automáticamente

## Documentación Completa

Ver: `PWA_IMPLEMENTACION_COMPLETA.md`

---

**Listo para producción** ✅
