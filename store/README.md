# Apps nativas — MOVI Digital y Seguwallet by MOVI Digital

Dos apps de iOS y Android salen del **mismo código web** con [Capacitor 8](https://capacitorjs.com).
La app **empaqueta la build** (no carga un sitio remoto): Apple rechaza las apps que solo envuelven una URL (guía 4.2).

| | MOVI Digital | Seguwallet by MOVI Digital |
|---|---|---|
| ID | `digital.movi.app` | `mx.seguwallet.app` |
| Proyecto iOS | `native/movi/ios/App/App.xcodeproj` | `native/seguwallet/ios/App/App.xcodeproj` |
| Proyecto Android | `native/movi/android` | `native/seguwallet/android` |
| Arranca en | `/login` → `/dashboard` | `/login` → `/dashboard` (sin landing) |
| Ficha de tienda | [`movi/ficha.md`](movi/ficha.md) | [`seguwallet/ficha.md`](seguwallet/ficha.md) |

Pasos para publicar: **[CHECKLIST.md](CHECKLIST.md)**.

## Cómo funciona

- `capacitor.config.ts` elige la app con la variable `CAP_APP` (`movi` | `seguwallet`) y apunta a `native/<app>/`.
- La build web se compila con `VITE_APP_TARGET=<app>`. `src/native/platform.ts` lo expone como `APP_TARGET`,
  y `App.tsx` + los 6 lugares que detectaban Seguwallet por dominio lo respetan (dentro de la app el host es `localhost`).
- `src/native/initNative.ts` (solo corre en la app): barra de estado, botón atrás de Android, ligas externas al
  navegador del sistema, ocultar el splash. En la web no hace nada.
- `src/index.css` → bloque “App nativa”: áreas seguras del iPhone (notch y barra de inicio).

## Comandos (en una Mac para iOS, cualquier PC para Android)

Requisitos: Node 22, `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, Xcode 16+ (iOS), Android Studio con JDK 21 (Android).

```bash
npm install
```

```bash
npm run native:seguwallet          # compila la web y la copia a native/seguwallet (cap sync)
```

```bash
npm run native:seguwallet:ios      # abre Xcode   (o :android para Android Studio)
```

Igual para MOVI: `npm run native:movi`, `native:movi:ios`, `native:movi:android`.

> ⚠️ No uses `npx cap sync` a secas: sin `CAP_APP` siempre toma MOVI. Los scripts `native:*` lo fijan.
> ⚠️ Los scripts **no** corren el postbuild web (no tocan `dist_backup`, que es del deploy de Plesk).

## Regenerar gráficos

```bash
python3 scripts/native/generar-assets.py          # íconos y splash (desde store/marca/)
```

```bash
python3 scripts/native/capturas/generar.py        # capturas simuladas + gráfico destacado
```

```bash
python3 scripts/native/ajustar-proyectos.py       # reaplica Info.plist/Manifest/gradle si se regenera un proyecto
```

Las capturas son **simuladas** (datos ficticios, pantallas dibujadas en `scripts/native/capturas/pantallas.py`
con el diseño de la app). Apple y Google las aceptan mientras reflejen la app real; si alguna pantalla cambia
mucho, hay que actualizar su dibujo.

## Lo que queda fuera de esta primera versión (no bloquea la publicación)

| | Por qué | Cómo se haría |
|---|---|---|
| **Notificaciones push nativas** | Hoy son Web Push (VAPID), que **no funciona dentro de la app** de iOS ni de Android. La campanita interna y los avisos por WhatsApp/correo sí siguen llegando. | `@capacitor/push-notifications` + proyecto de Firebase (FCM) + llave APNs, y guardar el token del dispositivo junto a las suscripciones web. |
| **Descargas generadas en el navegador** (Excel/PDF armados con `blob:`) | Un WebView no tiene carpeta de “Descargas”. Los PDF que vienen de una URL sí abren. | `@capacitor/filesystem` + `@capacitor/share` en los helpers de descarga. |
| **Ligas universales** (abrir `seguwallet.mx/...` directo en la app) | No es requisito. | `apple-app-site-association` y `assetlinks.json` en `public/.well-known/`. |
