# Apps nativas — MOVI Digital y Seguwallet by MOVI Digital

Dos apps de iOS y Android salen del **mismo código web** con [Capacitor 8](https://capacitorjs.com).
La app **empaqueta la build** (no carga un sitio remoto): Apple rechaza las apps que solo envuelven una URL (guía 4.2).

| | MOVI Digital | Seguwallet by MOVI Digital |
|---|---|---|
| ID iOS | `digital.movi.app` | `mx.seguwallet.app` |
| ID Android | `com.wnapp.id1739907855051` (reemplaza a “MOVI Digital (beta)” en Play) | `mx.seguwallet.app` |
| Versión | 2.0.0 (build/versionCode 100) | 1.0.0 (1) |
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
- `src/native/descargasNativas.ts`: dentro de la app, cualquier descarga (Excel, PDF, ZIP, CSV, archivos de
  Storage) se guarda en el teléfono y abre la hoja de **Compartir / Guardar en Archivos**. Intercepta los 4 caminos
  por los que descarga la web, así que no hubo que tocar las ~50 pantallas.
- `src/native/pushNativo.ts` + tabla `push_dispositivos` + edge function `enviar-push-nativo`: **cada aviso de la
  campanita llega también como notificación push al teléfono**. Al tocarla abre el trámite. Ver “Push” abajo.

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

## Push: lo que hay que configurar una vez

El código y la base ya están (tabla, trigger y función desplegados). Falta dar de alta los proveedores:

**iPhone (APNs, sin Firebase)**
1. developer.apple.com → *Keys* → crear una llave con **Apple Push Notifications service (APNs)**. Bajar el `.p8`
   (solo se puede una vez) y anotar el **Key ID** y el **Team ID**.
2. Supabase → Edge Functions → Secrets: `APNS_KEY_P8` (contenido del .p8), `APNS_KEY_ID`, `APNS_TEAM_ID`.
   Para probar desde Xcode (build de desarrollo) agregar `APNS_SANDBOX=true` y quitarlo antes de TestFlight.
3. En Xcode, *Signing & Capabilities* ya trae **Push Notifications** (`App.entitlements`).

**Android (Firebase Cloud Messaging)**
1. console.firebase.google.com → proyecto “MOVI Apps” → agregar **dos apps Android**:
   `com.wnapp.id1739907855051` y `mx.seguwallet.app`.
2. Bajar cada `google-services.json` a `native/movi/android/app/` y `native/seguwallet/android/app/`.
3. Configuración del proyecto → Cuentas de servicio → *Generar nueva clave privada* → pegar el JSON completo en el
   Secret `FCM_SERVICE_ACCOUNT`.
4. Compilar Android con `VITE_PUSH_ANDROID=1` en el `.env` (sin `google-services.json`, registrar el push cierra la
   app; por eso está apagado por omisión).

**Probar**: entrar a la app, aceptar notificaciones y verificar que el teléfono quedó registrado:

```sql
select plataforma, app, app_id, actualizado_en from push_dispositivos order by actualizado_en desc limit 5;
```

Después, cualquier aviso nuevo de la campanita para ese usuario debe llegar al teléfono. Si no llega, los logs de
`enviar-push-nativo` dicen si fue APNs/FCM y por qué.

## Pendiente menor

- **Ligas universales** (abrir `seguwallet.mx/...` directo en la app): no es requisito de las tiendas.
  Se harían con `apple-app-site-association` y `assetlinks.json` en `public/.well-known/`.
- Los íconos se reconstruyeron por color desde logos de 512 y 177 px (`scripts/native/escalar_logo.py`): se ven
  nítidos, pero si existe el logo en **vector** (SVG/AI) conviene usarlo.
