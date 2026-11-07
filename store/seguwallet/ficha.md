# Seguwallet by MOVI Digital — ficha de tienda

| | |
|---|---|
| Bundle ID (iOS) / Package (Android) | `mx.seguwallet.app` |
| Nombre en el teléfono | Seguwallet |
| Versión | 1.0.0 (build 1 / versionCode 1) |
| Idioma principal | Español (México) |
| Categoría | **Finanzas** (secundaria: Productividad) — Play: **Finanzas** |
| Precio | Gratis, sin compras dentro de la app, sin anuncios |
| Clasificación | 4+ (Apple) · PEGI 3 / “Para todos” (IARC) |
| URL de privacidad | https://seguwallet.mx/legal/privacidad-seguwallet.html |
| URL de soporte | https://seguwallet.mx/legal/soporte.html?app=seguwallet |
| URL de eliminación de cuenta (Play) | https://seguwallet.mx/legal/eliminar-cuenta.html?app=seguwallet |
| Sitio de marketing | https://seguwallet.mx |
| Correo de contacto | seguwallet@movi.digital *(confirmar que el buzón existe y alguien lo lee)* |

## App Store Connect

**Nombre** (≤30): `Seguwallet by MOVI Digital`

**Subtítulo** (≤30): `Tu cartera digital de seguros`

**Texto promocional** (≤170):
> Todas tus pólizas en un solo lugar: consulta coberturas, descarga tu póliza, reporta un siniestro y habla con tu asesor desde tu celular.

**Palabras clave** (≤100, sin espacios tras comas):
```
seguros,póliza,aseguradora,siniestro,gastos médicos,auto,vida,recibos,cartera,asesor,cobertura
```

**Descripción**:
> Seguwallet es la cartera digital de seguros que te da tu asesor de la red Grupo JIRO. Ten todas tus pólizas contigo, siempre al día y sin papeles.
>
> TODAS TUS PÓLIZAS EN UN SOLO LUGAR
> • Auto, gastos médicos, vida, hogar y más, de distintas aseguradoras.
> • Vigencias, coberturas, sumas aseguradas y deducibles explicados de forma clara.
> • Descarga tu póliza y tus recibos en PDF cuando los necesites.
>
> AYUDA INMEDIATA EN UN SINIESTRO
> • Un botón para llamar a la cabina de tu aseguradora.
> • Avisa a tu asesor por WhatsApp y adjunta fotos en el momento.
>
> CHAVA, TU ASISTENTE 24/7
> • Pregunta en lenguaje natural qué cubre tu seguro o cuándo vence tu próximo pago.
>
> TU ASESOR A LA MANO
> • Su nombre, su WhatsApp y su teléfono siempre visibles.
> • Pídele una cotización o una renovación sin buscar su contacto.
>
> ACCESO SEGURO Y SIN CONTRASEÑAS
> • Entras con un código de un solo uso que llega a tu correo o WhatsApp.
>
> Seguwallet es gratuito para los clientes de los asesores de la red Grupo JIRO. Para usarlo necesitas que tu asesor te haya registrado.

**Novedades de esta versión**: `Primera versión de Seguwallet para iPhone.`

**Copyright**: `© 2026 Grupo JIRO` *(confirmar razón social exacta)*

### Información para la revisión de Apple (App Review Information)

- **Inicio de sesión**: obligatorio. Seguwallet entra con un **código de 6 dígitos** enviado por correo, así que el revisor no puede recibirlo. Hay que crear una cuenta de demostración que acepte un código fijo (ver `store/CHECKLIST.md`, paso “Cuenta demo”) y ponerla aquí:
  - Usuario: `revision.apple@seguwallet.mx` *(crear)*
  - Código: `000000` *(o el que se configure)*
- **Notas** (pegar):
> Seguwallet is the insurance wallet that licensed insurance agents of the Grupo JIRO network give to their clients in Mexico. Accounts are created by the client's agent, so we provide a demo account with sample policies. Login uses a one-time code instead of a password; the demo account above accepts the fixed code shown. Account deletion: Profile → Seguridad → Eliminar mi cuenta (the account is deactivated immediately and personal data is erased within 30 days). The app does not sell anything: there are no purchases, subscriptions or ads. Camera/photos are used only when the user chooses to attach an image (e.g. a claim photo).

### Privacidad (App Privacy “nutrition label”)

Respuestas para *Data Collection*. Ninguno se usa para rastreo (**Tracking: No**). Ninguno para publicidad.

| Tipo de dato (Apple) | ¿Se recolecta? | Ligado a la identidad | Propósito |
|---|---|---|---|
| Contact Info → Name, Email Address, Phone Number | Sí | Sí | App Functionality |
| Contact Info → Physical Address (estado/municipio) | Sí | Sí | App Functionality |
| Financial Info → Other Financial Info (pólizas, recibos) | Sí | Sí | App Functionality |
| Health & Fitness → Health (si tiene póliza de gastos médicos) | Sí | Sí | App Functionality |
| User Content → Photos or Videos (siniestros, foto de perfil) | Sí | Sí | App Functionality |
| User Content → Customer Support / Other User Content (mensajes a Chava, reportes) | Sí | Sí | App Functionality |
| User Content → Other (documentos: INE, pólizas) | Sí | Sí | App Functionality |
| Identifiers → User ID | Sí | Sí | App Functionality |
| Other Data → fecha de nacimiento, género | Sí | Sí | App Functionality |
| Location, Contacts, Browsing History, Purchases, Diagnostics de terceros | No | — | — |

## Google Play Console

**Nombre** (≤30): `Seguwallet by MOVI Digital`

**Descripción breve** (≤80): `Tus pólizas de seguros, siniestros y tu asesor, en un solo lugar.`

**Descripción completa**: la misma de App Store.

**Gráficos**: `graficos/play-icono-512.png`, `graficos/play-grafico-destacado-1024x500.png`, capturas en `capturas/android/` (6).

### Seguridad de los datos (Data safety)

- ¿Recopila o comparte datos? **Sí recopila. No comparte** con terceros (los proveedores que procesan datos por cuenta nuestra —Supabase, envío de correo/WhatsApp, IA— no cuentan como “compartir” según Google).
- ¿Datos cifrados en tránsito? **Sí**.
- ¿El usuario puede pedir que se borren? **Sí** → URL de eliminación de arriba.
- Datos recopilados (todos “obligatorios” salvo indicación; propósito **Funcionalidad de la app** y **Administración de la cuenta**):
  - Información personal: Nombre, Correo, Teléfono, Dirección (estado/municipio), Otra info (fecha de nacimiento, género)
  - Información financiera: Otra info financiera (pólizas, recibos)
  - Salud y actividad física: Información de salud (*opcional*, solo pólizas de GMM)
  - Fotos y videos: Fotos (*opcional*)
  - Archivos y documentos (*opcional*)
  - Mensajes: Otros mensajes en la app (Chava) (*opcional*)
  - Actividad en la app: Otras acciones (registro de accesos y descargas)
- **No** se recopila: ubicación, contactos, historial web, ID de publicidad, datos de compras.

### Contenido de la app (cuestionarios)

- Anuncios: **No**. Acceso a la app: **Se requieren credenciales** → mismas de la cuenta demo.
- Público objetivo: **18+**. Apps de noticias: No. Apps de salud: No (no es una app de salud). Apps financieras: **Sí** → “Seguros” (sin préstamos ni criptomonedas).
- Clasificación de contenido (IARC): sin violencia, sin contenido sexual, sin apuestas, sin compras; los usuarios **no** interactúan entre sí (solo con su asesor).
- Declaración gubernamental: No.
