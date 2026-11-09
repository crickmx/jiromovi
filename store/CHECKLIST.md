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
- ✅ Push a git del 07/11: todo a `main` (`725bb04d`) y **solo las páginas `/legal/`** a `produccion` (`8fec946c`),
  sin arrastrar los 50 commits de `main` que producción no tiene.
- ✅ Páginas `/legal/` publicadas el 09/11 (copiadas a `beta.movi.digital/dist/legal/`, sin build):
  - https://movi.digital/legal/privacidad-seguwallet.html
  - https://movi.digital/legal/privacidad-movi.html
  - https://movi.digital/legal/eliminar-cuenta.html
  - https://movi.digital/legal/soporte.html

  Las fichas de las dos apps usan estas URLs de **movi.digital** a propósito:
  - **seguwallet.mx no sirve la app**: redirige todo a `movi.digital/seguwallet/` (regla de Apache en Plesk), así que
    `seguwallet.mx/legal/...` no existe. Si se quiere esa URL, en Plesk hay que exceptuar `/legal/` de la redirección.
  - **app.movi.digital lleva desde el 23/10 sin desplegar** (sirve `f6f21cfa`, y `produccion` ya va en `8fec946c`):
    su próximo Pull + Deploy también publicará lo que otros subieron a `produccion` desde entonces (Directorio, datos
    bancarios). Conviene revisarlo antes, no depender de él para las tiendas.
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

## 3. Cuentas demo para los revisores — ✅ creadas el 09/11 (falta poner las contraseñas)

| App | Correo | Qué tiene |
|---|---|---|
| **MOVI** | `ccjimenez+agente1@jiro.com.mx` (MATEO PRUEBAS, Agente, `es_bot`) | 10 trámites de prueba; como bot no le avisa a personas reales |
| **Seguwallet** | `revision@seguwallet.mx` (Mariana López Demo, cliente de MATEO) | perfil y términos completos + 4 pólizas ficticias `DEMO-*` (auto, GMM, hogar, vida) |

- [ ] **(Ricardo)** Ponerles contraseña desde el SQL Editor (comillas simples; la contraseña no pasa por el chat):

```sql
update auth.users
set encrypted_password = crypt('LA-QUE-SEA', gen_salt('bf'))
where email in ('revision@seguwallet.mx', 'ccjimenez+agente1@jiro.com.mx');
```

- [ ] Probar en seguwallet.mx → “¿Tienes contraseña? Entrar con contraseña”, y en app.movi.digital con MATEO.
- [ ] Ponerlas en *App Review Information* (Apple) y en *Acceso a la app* (Play).
- Para quitar el demo después de aprobadas:

```sql
update seguwallet_external_policies set deleted_at = now() where policy_number like 'DEMO-%';
```

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
