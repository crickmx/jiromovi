# Checklist de publicación

Marca cada paso. Lo que dice **(Ricardo)** necesita una decisión, una cuenta o un dato que no está en el repo.

## 0. Decisiones antes de empezar

- [ ] **(Ricardo) La app de MOVI que ya existe en Google Play.** `src/constants/appLinks.ts` enlaza a
  `com.wnapp.id1739907855051` (hecha con un generador de apps). Dos caminos:
  - **Reemplazarla** con esta versión: hay que usar *ese mismo* package name y la *misma llave de firma*
    (o tener Play App Signing activado en esa ficha). Requiere acceso a la cuenta de Play donde vive.
  - **Publicar una app nueva** (`digital.movi.app`, lo que está configurado) y despublicar la vieja.
- [ ] **(Ricardo) ¿MOVI pública o privada?** Al ser una herramienta interna, conviene *Unlisted App Distribution*
  en Apple y prueba cerrada / disponibilidad restringida en Play (ver `movi/ficha.md`).
- [ ] **(Legal) Avisos de privacidad**: revisar `public/legal/privacidad-movi.html` y `privacidad-seguwallet.html`,
  confirmar razón social para el copyright y que los buzones `contacto@movi.digital` y `seguwallet@movi.digital` existen.

## 1. Cuentas de desarrollador (a nombre de la empresa)

- [ ] **Apple Developer Program — Organización** (USD 99/año). Necesita **número D-U-N-S** de la razón social.
- [ ] **Google Play Console — Organización** (USD 25 único). Las cuentas nuevas de *persona física* deben hacer
  una prueba cerrada con 12 testers durante 14 días antes de publicar; como **organización** no aplica.
- [ ] Dar acceso de desarrollador a quien vaya a compilar (Xcode y Play Console).

## 2. Backend (una sola vez)

- [ ] Correr `supabase/migrations/20261107000001_solicitudes_eliminacion_cuenta.sql` en el SQL Editor.
- [ ] Desplegar la edge function `solicitar-eliminacion-cuenta` desde el dashboard (un solo archivo `index.ts`) con **Verify JWT apagado** (la página pública no manda llave; la función valida la sesión por dentro).
- [ ] Desplegar la web (Pull + Deploy en Plesk) para que existan las páginas `/legal/*.html` en
  `app.movi.digital` **y** `seguwallet.mx`. Verificar que abren:
  - https://seguwallet.mx/legal/privacidad-seguwallet.html
  - https://seguwallet.mx/legal/eliminar-cuenta.html
  - https://app.movi.digital/legal/privacidad-movi.html
- [ ] Probar la eliminación: con un cliente de prueba de Seguwallet → Perfil → Seguridad → Eliminar mi cuenta.
  Debe cerrar sesión y no dejar volver a entrar. Revisar:

```sql
select plataforma, email, origen, cuenta_bloqueada, estado, creado_en
from solicitudes_eliminacion_cuenta order by creado_en desc limit 10;
```

- [ ] **Procedimiento para atender solicitudes** (dentro de 30 días): dar de baja al usuario desde Admin
  (MOVI) o borrar al cliente de Seguwallet, y marcar la fila:

```sql
update solicitudes_eliminacion_cuenta
set estado = 'procesada', procesado_en = now(), notas = '...'
where id = '<id>';
```

## 3. Cuentas demo para los revisores (obligatorio en las dos tiendas)

- [ ] **MOVI**: crear un usuario **Agente** de prueba (oficina de prueba, `es_bot = true` para que no ensucie el
  tablero) con contraseña, y algunos trámites ficticios. Va en *App Review Information* y en Play → *Acceso a la app*.
- [ ] **(Ricardo) Seguwallet**: el acceso es por **código de 6 dígitos**, que el revisor no puede recibir.
  Opciones (elegir una):
  1. Permitir un código fijo **solo** para el correo de revisión, configurado en los Secrets de
     `verify-login-code` y retirado al aprobarse. Es un cambio de seguridad en el login: no lo hice sin tu visto bueno.
  2. Darle al revisor un correo que él pueda abrir (p. ej. un buzón de prueba con su contraseña en las notas).
  3. Agregar contraseña opcional a Seguwallet solo para esa cuenta.
- [ ] Al cliente demo de Seguwallet, cargarle 3–4 pólizas ficticias para que la revisión vea contenido.

## 4. Compilar y subir — iOS (en una Mac)

- [ ] `npm install` y `npm run native:seguwallet` (luego `movi`).
- [ ] `npm run native:seguwallet:ios` → en Xcode: *Signing & Capabilities* → elegir el **Team**.
- [ ] En App Store Connect crear la app con el Bundle ID `mx.seguwallet.app` (y `digital.movi.app`).
- [ ] Xcode → *Product → Archive* → *Distribute App → App Store Connect*.
- [ ] Probar en **TestFlight** en un iPhone real: iniciar sesión, adjuntar foto (debe pedir permiso de cámara con el
  texto en español), abrir una liga externa, eliminar cuenta.
- [ ] Llenar la ficha con `seguwallet/ficha.md`: textos, capturas `capturas/ios-6.9/`, privacidad, clasificación,
  cuenta demo, notas. *Exportación de cifrado* ya va resuelta en el Info.plist (`ITSAppUsesNonExemptEncryption = NO`).
- [ ] Enviar a revisión.

## 5. Compilar y subir — Android

- [ ] Crear la llave de subida **una vez por app** y guardarla fuera del repo (el repo es público):

```bash
keytool -genkeypair -v -keystore seguwallet-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

- [ ] Crear `native/seguwallet/android/keystore.properties` (ya está en `.gitignore`):

```
storeFile=/ruta/segura/seguwallet-upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

- [ ] `npm run native:seguwallet:android` → Android Studio → *Build → Generate Signed App Bundle* (`.aab`).
- [ ] Play Console → crear app → activar **Play App Signing** → subir el `.aab` a **Prueba interna** primero.
- [ ] Llenar ficha, *Seguridad de los datos*, *Contenido de la app* y la **URL de eliminación de cuenta** con
  `seguwallet/ficha.md`. Gráficos en `graficos/` y capturas en `capturas/android/`.
- [ ] Promover a Producción.

## 6. Cada versión nueva

- [ ] Subir `MARKETING_VERSION` / `versionName` (en `scripts/native/ajustar-proyectos.py`, `VERSION`) y el número
  de build: `CURRENT_PROJECT_VERSION` en Xcode y `versionCode` en `android/app/build.gradle` (siempre +1).
- [ ] `npm run native:<app>` antes de archivar: **la app lleva la web empaquetada**, un deploy de Plesk no la actualiza.
