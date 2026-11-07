# MOVI Digital — ficha de tienda

| | |
|---|---|
| Bundle ID (iOS) | `digital.movi.app` (app nueva) |
| Package (Android) | `com.wnapp.id1739907855051` — **actualiza** a “MOVI Digital (beta)” |
| Nombre en el teléfono | MOVI Digital |
| Versión | 2.0.0 (build 100 / versionCode 100) |
| Idioma principal | Español (México) |
| Categoría | **Empresa / Business** (secundaria: Productividad) — Play: **Empresa** |
| Precio | Gratis, sin compras dentro de la app, sin anuncios |
| Clasificación | 4+ (Apple) · “Para todos” (IARC) |
| URL de privacidad | https://movi.digital/legal/privacidad-movi.html |
| URL de soporte | https://movi.digital/legal/soporte.html |
| URL de eliminación de cuenta (Play) | https://movi.digital/legal/eliminar-cuenta.html?app=movi |
| Sitio de marketing | https://movi.digital |
| Correo de contacto | contacto@movi.digital *(confirmar)* |

## App Store Connect

**Nombre** (≤30): `MOVI Digital`

**Subtítulo** (≤30): `Tu oficina virtual de seguros`

**Texto promocional** (≤170):
> Trámites, comisiones, producción, CRM y cotizaciones de tu oficina de seguros, ahora en tu celular y con avisos al instante.

**Palabras clave** (≤100):
```
agente de seguros,trámites,comisiones,cotizador,CRM,pólizas,aseguradoras,producción,oficina,JIRO
```

**Descripción**:
> MOVI Digital es la oficina virtual de los agentes y colaboradores de la red Grupo JIRO. Todo lo que necesitas para operar tu negocio de seguros, en un solo lugar.
>
> TRÁMITES CON SEGUIMIENTO EN TIEMPO REAL
> • Levanta emisiones, endosos, renovaciones y cobranza en segundos.
> • Ve el estatus, quién lo atiende y la fecha promesa.
> • Comenta, menciona a tu equipo y adjunta documentos o fotos desde la cámara.
>
> TUS COMISIONES CLARAS
> • Detalle por aseguradora y por póliza, y tu estado de cuenta en PDF.
>
> PRODUCCIÓN, METAS Y CONVENCIÓN
> • Tu avance contra la meta y lo que te falta para el siguiente nivel.
>
> COTIZA Y COMPARTE
> • Compara aseguradoras y envía el comparativo a tu cliente por WhatsApp.
>
> CRM Y CARTERA
> • Tus clientes, prospectos y pólizas, con recordatorios de renovación.
>
> Y además: Aula Virtual, comunicados, MOVI Store y el asistente Chava.
>
> MOVI Digital es para agentes y colaboradores con una cuenta asignada por Grupo JIRO o su oficina.

**Novedades** (iOS): `Primera versión de MOVI Digital para iPhone.`

**Novedades** (Play, reemplaza a la beta): `Nueva app de MOVI Digital: más rápida, con notificaciones al instante, descarga de documentos y acceso a todos los módulos.`

### Información para la revisión de Apple

- **Cuenta demo**: obligatoria (la app es solo para usuarios dados de alta). Crear un usuario **Agente** de demostración con datos ficticios (ver checklist) y ponerlo aquí con su contraseña.
- **Notas** (pegar):
> MOVI Digital is the internal workspace for licensed insurance agents and staff of the Grupo JIRO network in Mexico (policy requests, commissions, CRM, quotes). Accounts are created by the company, so we provide a demo agent account with sample data. There are no purchases, subscriptions or ads in the app; any services between the company and its agents are billed under their commercial contract, outside the app. Account deletion request: Mi perfil → Eliminar mi cuenta. Location is requested only when the user taps “use my location” in their profile; camera/microphone only for document photos and video meetings.

> ⚠️ Alternativa que conviene evaluar: como MOVI es una herramienta interna, Apple permite publicarla como **app no listada** (*Unlisted App Distribution*, se solicita en developer.apple.com/support/unlisted-app-distribution) o como **app personalizada** vía Apple Business Manager. Así no aparece en búsquedas y la revisión de “funcionalidad mínima para el público” es más sencilla.

### Privacidad (App Privacy)

Tracking: **No**. Publicidad: **No**.

| Tipo de dato (Apple) | Ligado | Propósito |
|---|---|---|
| Contact Info → Name, Email, Phone | Sí | App Functionality |
| Financial Info → Other Financial Info (comisiones, cuenta bancaria, RFC) | Sí | App Functionality |
| Location → Precise / Coarse (*opcional*, solo si el usuario la comparte) | Sí | App Functionality |
| User Content → Photos or Videos, Audio (videollamadas), Customer Support, Other User Content | Sí | App Functionality |
| Contacts → (no: los clientes del CRM los captura el agente, no se leen de la agenda del teléfono) | — | — |
| Identifiers → User ID, Device ID (token push) | Sí | App Functionality |
| Usage Data → Product Interaction (bitácora de actividad) | Sí | Analytics (interna) / App Functionality |
| Diagnostics → Crash Data, Other Diagnostic Data (al usar “Reportar un problema”) | Sí | App Functionality |

## Google Play Console

**Nombre**: `MOVI Digital` *(antes “MOVI Digital (beta)”)*

**Descripción breve** (≤80): `Trámites, comisiones, CRM y cotizaciones para agentes de seguros.`

**Descripción completa**: la misma de App Store.

**Gráficos**: `graficos/play-icono-512.png`, `graficos/play-grafico-destacado-1024x500.png`, capturas en `capturas/android/` (5).

### Seguridad de los datos

- Recopila: **Sí**. Comparte: **Sí, con aseguradoras** cuando el trámite lo requiere (propósito: Funcionalidad de la app).
- Cifrado en tránsito: **Sí**. Eliminación: **Sí** → URL de arriba.
- Datos: Nombre, Correo, Teléfono, ID de usuario · Info financiera (otra) · **Ubicación aproximada y precisa (opcional)** · Fotos, Videos, Audio (opcional) · Archivos y documentos · Mensajes en la app · Actividad en la app (interacciones) · Diagnóstico (registros de fallas).
- **Permisos sensibles a justificar**: ubicación (perfil → zona para leads de Seguros Express), micrófono y cámara (videollamadas / Aula Virtual, fotos de documentos).

### Contenido de la app

- Anuncios: No. Acceso: **credenciales requeridas** (cuenta demo). Público: **18+**.
- Apps financieras: **Sí** → herramienta para intermediarios de seguros; no ofrece préstamos.
- Considerar **prueba interna / cerrada** como canal definitivo si no se quiere que aparezca en búsquedas, o publicarla en Google Play con “Disponibilidad: solo México”.
