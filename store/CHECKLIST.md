# Checklist de publicación

Marca cada paso. **(Ricardo)** = necesita tu cuenta, un dato o una decisión.

## 0. Decisiones — ✅ tomadas el 07/11

- ✅ **MOVI reemplaza a “MOVI Digital (beta)” en Google Play** (`com.wnapp.id1739907855051`, v1.0, publicada con
  ccjimenez@mekate.mx). El Android de MOVI ya usa ese package y `versionCode 100`, para entrar como actualización.
  En iOS no había app: MOVI se publica nueva como `digital.movi.app`.
- ✅ **Cuenta demo de Seguwallet con contraseña.** El login de Seguwallet ganó “¿Tienes contraseña? Entrar con
  contraseña”. Los clientes normales no tienen contraseña, así que para ellos no cambia nada, y solo deja pasar a un
  cliente activo de Seguwallet.
- ✅ **Cuentas de desarrollador**: las de **hola@mekate.mx** (Apple Developer y Google Play Console).

## 1. Backend — ✅ hecho el 07/11

- ✅ Migraciones corridas: `20261107225105_solicitudes_eliminacion_cuenta`, `20261107225844_push_nativo_dispositivos`,
  `20261107225905_push_nativo_trigger_sin_campos_cruzados`.
- ✅ Edge functions desplegadas (las dos con Verify JWT apagado; validan por dentro):
  `solicitar-eliminacion-cuenta` y `enviar-push-nativo`.
- [ ] **(Ricardo)** Pull + Deploy en Plesk (beta y producción) para publicar las páginas `/legal/` en
  `app.movi.digital` **y** `seguwallet.mx`. Verificar que abren:
  - https://seguwallet.mx/legal/privacidad-seguwallet.html
  - https://seguwallet.mx/legal/eliminar-cuenta.html
  - https://app.movi.digital/legal/privacidad-movi.html
- [ ] **(Ricardo) Push**: dar de alta APNs y Firebase y cargar los Secrets — pasos en `store/README.md` → “Push”.

## 2. Legal

- ✅ Avisos de privacidad completados con los datos del aviso integral de JIRO (jiro.mx/privacidad, 09/09/2025):
  responsable, domicilio, finalidades primarias y secundarias, datos sensibles, transferencias, ARCO con plazos,
  revocación, cómo limitar el uso, tecnologías de seguimiento, cambios y autoridad. Se generan con
  `python3 scripts/native/avisos.py`.
- [ ] **(Legal)** Revisión final de los dos avisos.
- [ ] **(Legal / Ricardo)** Los **términos de Seguwallet** (Admin → Seguwallet → Términos) deben incluir el
  **consentimiento expreso para datos sensibles** (pólizas de gastos médicos/vida): el aviso dice que se otorga al
  aceptarlos.
- [ ] Confirmar que existen y alguien lee `contacto@movi.digital` y `seguwallet@movi.digital` (soporte de las apps).
  Las solicitudes ARCO van a `contacto@jiro.mx`, que es el canal del aviso integral.
- ⚠️ El enlace viejo `https://www.grupojiro.com/aviso-de-privacidad` da **404** (lo usa también la landing de Mutuus).
  El vigente es https://jiro.mx/privacidad/.

## 3. Cuentas demo para los revisores

- [ ] **MOVI**: crear un usuario **Agente** de prueba (oficina de prueba, `es_bot = true`) con trámites ficticios.
- [ ] **Seguwallet**: crear el cliente desde **Admin → Seguwallet** con el correo `revision@seguwallet.mx` (o el que
  elijas), ligarlo a un agente de prueba y a un cliente SICAS de prueba para que tenga pólizas. Ponerle contraseña
  desde el SQL Editor (comillas simples; la contraseña no pasa por el chat):

```sql
update auth.users
set encrypted_password = crypt('LA-QUE-SEA', gen_salt('bf'))
where email = 'revision@seguwallet.mx';
```

- [ ] Probar en seguwallet.mx → “Entrar con contraseña” antes de mandarla a revisión.
- [ ] Las dos cuentas van en *App Review Information* (Apple) y en *Acceso a la app* (Play).

## 4. iOS (en una Mac, con la cuenta de hola@mekate.mx)

- [ ] `npm install` y `npm run native:seguwallet` (luego `npm run native:movi`).
- [ ] `npm run native:seguwallet:ios` → Xcode → *Signing & Capabilities* → elegir el **Team** de Mekate.
- [ ] App Store Connect → crear las apps: `mx.seguwallet.app` y `digital.movi.app`.
- [ ] *Product → Archive* → *Distribute App → App Store Connect* → probar en **TestFlight** en un iPhone real:
  login, foto desde la cámara (pide permiso en español), descargar un PDF/Excel (abre “Compartir”), recibir un push,
  eliminar cuenta.
- [ ] Llenar la ficha con `seguwallet/ficha.md` / `movi/ficha.md` y enviar a revisión.

## 5. Android (con la cuenta de Play de hola@mekate.mx)

**Seguwallet (app nueva)**
- [ ] Crear la llave de subida y guardarla fuera del repo:

```bash
keytool -genkeypair -v -keystore seguwallet-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

- [ ] `native/seguwallet/android/keystore.properties` (ya ignorado por git) con `storeFile`, `storePassword`,
  `keyAlias`, `keyPassword`.
- [ ] `npm run native:seguwallet:android` → *Build → Generate Signed App Bundle* → Play Console → app nueva →
  **Prueba interna** → ficha, *Seguridad de los datos*, *Contenido*, URL de eliminación → Producción.

**MOVI (actualización de “MOVI Digital (beta)”)**
- [ ] **(Ricardo)** En Play Console, ficha de MOVI Digital (beta) → *Integridad de la app* → *Firma de apps*: ver si
  **Play App Signing** está activo.
  - **Sí** (lo normal en apps publicadas desde 2021): si no tienes la llave de subida que usó el generador, pide
    **“Restablecer la clave de subida”** ahí mismo con una llave nueva (`keytool` igual que arriba). Google la
    aprueba en ~48 h.
  - **No**: se necesita la llave original del generador (pedírsela al proveedor de `wnapp`). Sin ella no se puede
    actualizar y habría que publicar como app nueva.
- [ ] Revisar en *Explorador de App Bundles* el **versionCode** publicado; si fuera ≥ 100, subir el de
  `scripts/native/ajustar-proyectos.py` (VERSIONES → movi → build) y correr el script.
- [ ] Generar el AAB firmado → subir a **Prueba interna** → probar que **se instala encima** de la versión vieja →
  Producción. Actualizar la ficha (nombre “MOVI Digital”, sin “(beta)”) con `movi/ficha.md`.

## 6. Cada versión nueva

- [ ] Subir versión y build en `scripts/native/ajustar-proyectos.py` (VERSIONES) y correrlo.
- [ ] `npm run native:<app>` antes de archivar: **la app lleva la web empaquetada**, un deploy de Plesk no la
  actualiza.
