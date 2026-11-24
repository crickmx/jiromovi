# Inventario de funciones actuales — Correo y WhatsApp (10/11/2026)

Línea base para el rediseño. Al terminar cada fase se revisa esta lista punto por punto.
Ruta: `/centro-contacto/email` → `src/pages/GestorEmails.tsx` · `/centro-contacto/whatsapp` → `src/pages/CentroContactoUnificado.tsx`.

## A. Correo (`GestorEmails.tsx`)

### Pantallas y estados
| # | Función | Dónde |
|---|---|---|
| E1 | Aviso "ver como": con máscara no se abre el buzón (`AvisoCorreoEnMascara`) | :383 |
| E2 | Pantalla de configuración (`SetupScreen`): ver cuentas, verificar correo+contraseña, guardar (`save-config`), cerrar | :1168 |
| E3 | Sin configuración → se abre sola la configuración (`email_configuraciones`, `activa=true`) | :223 |
| E4 | "Conectando…" mientras carga | :391 |
| E5 | Error de conexión: Reintentar / Reconfigurar correo | :483 |
| E6 | Vista "Correo MOVI" (Roundcube embebido, SSO `getRoundcubeHandoffUrl`), con reintento automático ante `RATE_LIMITED` (2 intentos, 15 s/30 s), Actualizar, Contactos, "Vista clásica" | :335, :411 |
| E7 | Vista clásica (por defecto): 3 columnas carpetas · lista · lectura | :534 |
| E8 | Contactos MOVI (`ContactosMovi`): corporativos (`usuarios`), contactos propios (`contactos` alta/edición/baja/compartir), grupos de equipo (`tramites_grupos_miembros`), "Redactar a…" | :402 |

### Barra superior (vista clásica)
| # | Función |
|---|---|
| E9 | Título "Mi E-Mail" + correo configurado |
| E10 | Buscar (Enter) en la carpeta actual — asunto, remitente, destinatario (`search`, máx. 50) · botón × limpia. **Hoy oculto en celular** |
| E11 | Contactos |
| E12 | Actualizar (carpetas + mensajes) |
| E13 | Configuración (reabre E2) |
| E14 | "Correo MOVI" (cambia a Roundcube) |
| E15 | Redactar |
| E16 | Barra de error cerrable |

### Carpetas y lista
| # | Función |
|---|---|
| E17 | Lista de carpetas IMAP con nombre traducido (Entrada, Enviados, Borradores, Papelera, Spam, Archivo) y contador de no leídos. **Hoy oculta en celular: no se puede cambiar de carpeta** |
| E18 | Paginación 30 por página (anterior/siguiente, "p/N") |
| E19 | Fila: iniciales, remitente, fecha relativa (hora / Ayer / día-mes), asunto, punto de no leído, clip de adjunto, negritas en no leídos |
| E20 | Esqueleto de carga · vacío "Carpeta vacía" / "Sin resultados" |
| E21 | Abrir correo (`get-message`) lo marca leído en la lista |

### Lectura (`ReadingPane`)
| # | Función |
|---|---|
| E22 | Regresar (celular) |
| E23 | Etiqueta con folio si el correo ya está ligado a un trámite (`tickets.canal_origen='email'` + `source_email_message_id`) |
| E24 | Marcar leído / no leído (`mark-read`) |
| E25 | Eliminar (`delete-message` → mueve a Papelera) |
| E26 | Remitente, correo, fecha completa, "Para" desplegable con CC/CCO |
| E27 | Adjuntos con nombre y tamaño, descarga (`download-attachment`) |
| E28 | Cuerpo HTML en iframe aislado (`sandbox`, `no-referrer`); texto plano; aviso sin contenido; correos > 1.5 MB piden confirmación |
| E29 | Responder · Responder a todos · Reenviar |
| E30 | **Iniciar trámite** (`IniciarTramiteEmailModal` → `analyze-email-for-tramite` → `create-tramite-from-email`) o **Ver trámite FOLIO** si ya existe |
| E31 | **Agregar a trámite** (`AgregarAEmailTramiteModal` → `add-email-to-tramite`: comentario + adjuntos), con filtros por agente/responsable según rol |
| E32 | **Identificación del remitente** dentro del modal de trámite: `analyze-email-for-tramite` busca `usuarios.email_laboral/email_personal` = remitente (método automático / sugerido / manual), y detecta trámite previo del mismo remitente |

### Redactar (`ComposeModal`)
| # | Función |
|---|---|
| E33 | Para / CC / CCO con autocompletado (`RecipientsInput` + `useEmailContacts`: usuarios + contactos), Enter , ; Tab ↑ ↓ Esc |
| E34 | Prellenado según modo: responder, a todos (sin el propio correo), reenviar (cita) |
| E35 | Editor con formato (`RichTextEditor`) |
| E36 | Firma asignada (`get_firma_asignada`), se aplica al enviar sin duplicarse |
| E37 | Adjuntos con límite por archivo y total |
| E38 | Borrador en el navegador: restaurar al abrir, autoguardado (800 ms), "Guardar borrador" (no guarda adjuntos; solo correos nuevos) |
| E39 | Encabezados de hilo (`In-Reply-To`/`References`) al responder |
| E40 | Enviar (`send-message`) |

### Acciones del servidor (`ionos-webmail`)
`save-config, list-folders, list-messages, get-message, send-message, mark-read, move-message (sin uso en pantalla), delete-message, search, download-attachment, verify-connection`.

## B. WhatsApp (`CentroContactoUnificado.tsx` + `contactCenter/Unified*`)

| # | Función | Dónde |
|---|---|---|
| W1 | Encabezado con chips "MOVI" y "Personal (conectado / sin conectar)" | :339 |
| W2 | Pestañas Conversaciones / Conexión | :363 |
| W3 | Conexión personal por QR (`whatsapp-session`: get-status, connect, get-qr cada 5 s, disconnect, sync-history) | :302 |
| W4 | Lista unificada: WA MOVI (`contact_center_messages`, línea Wazzup) + WA personal (`whatsapp_conversations`) | :103 |
| W5 | Buscar por nombre, teléfono o último mensaje | List :104 |
| W6 | Pestañas Todos / No leídos / Archivo | List :122 |
| W7 | Distintivo de canal por fila | List :210 |
| W8 | Enlace directo `?telefono=&nombre=` (llamada perdida) | :231 |
| W9 | Tiempo real en lista y en hilo | :266 · Thread :532 |
| W10 | Hilo: leer mensajes, marcar leído (`mark_contact_messages_read`), enviar (MOVI `send-contact-whatsapp`, personal `whatsapp-session`) | Thread |
| W11 | Adjuntar archivo (solo personal), emojis, Enter envía / Shift+Enter salto, "ir al último", sincronizar historial (personal) | Thread |
| W12 | Asistente IA (`contact-center-assistant-process`) | Thread :560 |
| W13 | **Seleccionar mensajes → Crear trámite** (`NuevoTramiteModal` precargado; liga en `task_contact_center_items` y adjuntos a `ticket_archivos`) | Thread :741 |
| W14 | **Agregar a trámite** (`add-contact-messages-to-task` + comentario + adjuntos) | Thread :773 |
| W15 | **Identificación**: nombre por CRM (`crm_contactos.celular`) > usuario interno (`usuarios.celular_laboral`) > nombre de WhatsApp | `unifiedContactCenter.ts:221` |
| W16 | Panel de información del contacto (solo pantallas grandes) | :720 |

Ya existe un estado `filterChannel` que la lista aplica, pero sin control visible: ahí entra el filtro de buzón.

## C. Hallazgos de paso (no se arreglan sin tu visto bueno)
1. En celular no se puede cambiar de carpeta ni buscar en el correo (E10, E17).
2. "Trámites relacionados" del panel de WhatsApp consulta `tickets.contacto_telefono/contacto_nombre`, columnas que no existen: siempre dice "Sin trámites".
3. "Agregar a trámite" desde WA personal falla en silencio al ligar el mensaje (FK a `contact_center_messages`).
4. Pantalla de plantillas de WhatsApp y 4 modales del hilo sin botón que los abra (código inalcanzable).
5. Tiempo real de WhatsApp sin filtro: cualquier mensaje de cualquier agente recarga todo.
6. `MiWhatsApp.tsx` y 4 componentes de `contactCenter/` no se usan.

---

## D. Verificación después del rediseño (10/11/2026)

Cada punto se revisó contra la pantalla nueva. Las pruebas automáticas están en
`qa/ui-correo/` (ver su README).

| # | Dónde quedó | Estado |
|---|---|---|
| E1–E5 | Sin cambios de lógica (máscara, configuración, conectando, error de conexión) | ✅ |
| E6 | Roundcube ahora es **"Vista alternativa"** (panel de carpetas → Herramientas). Conserva Contactos, Actualizar y el reintento por `RATE_LIMITED`; "Volver al correo" regresa | ✅ |
| E7 | Carpetas · lista · lectura; en celular una columna y carpetas en panel deslizable | ✅ |
| E8 | Contactos: panel de carpetas y vista alternativa. **Nuevo:** importar CSV o vCard | ✅ |
| E9 | El correo configurado se ve bajo "Redactar" | ✅ |
| E10 | Buscar arriba de la lista, **ahora también en celular**; opción "buscar en el contenido"; resultados resaltados; `/` enfoca | ✅ |
| E11–E15 | Contactos, Actualizar (lista), Configurar cuenta, Vista alternativa, Redactar (`c`) | ✅ |
| E16 | Los errores salen en avisos o en la propia lista con "Reintentar" | ✅ |
| E17 | Carpetas con contador de no leídos, **también en celular** | ✅ |
| E18–E21 | Paginación, fila, esqueleto/vacíos, abrir marca leído | ✅ |
| E22–E29 | Volver, folio ligado, leído/no leído, eliminar, destinatarios, adjuntos, cuerpo aislado, responder/a todos/reenviar | ✅ |
| E30–E31 | **Crear trámite / Ver trámite** y **Agregar a trámite**: primeros en la barra de lectura; también en el menú de cada fila y en lote. Los modales y las funciones del servidor son los mismos | ✅ probado |
| E32 | La detección del agente al crear el trámite no cambió (servidor). **Nuevo:** tarjeta del remitente en la lectura y etiqueta en la lista, con el mismo criterio de correo | ✅ probado |
| E33–E40 | Redactar: mismos campos, firma, límites, hilo y envío. **Nuevo:** ventana flotante, arrastrar archivos, plantillas, borrador con adjuntos y respuestas | ✅ |
| W1–W16 | Sin cambios de datos ni de envío. **Nuevo:** filtro de buzón, panel del contacto en celular, plantillas alcanzables | ✅ |

### Servidor de correo (`ionos-webmail`, versión 76)

Las acciones existentes no cambiaron. Se agregaron, opcionales:
`withSnippet` (fragmento en la lista y en la búsqueda), `inBody` (buscar en el contenido),
`quota` (espacio usado) y `thread` (correos del mismo hilo). La búsqueda escapa las comillas
y prueba primero con `CHARSET UTF-8`; si el servidor no lo acepta, repite como antes.

⚠️ La versión que estaba desplegada (v75) era **más nueva que el repo**: guardaba los adjuntos
en la copia de "Enviados". Se integró al repo antes de desplegar. El código desplegado se
comparó byte a byte con el del repo: idéntico.

### Lo que no se pudo verificar aquí

- Contra un buzón real de IONOS: fragmentos, `GETQUOTAROOT`, `BODY` y el hilo se probaron
  con respuestas IMAP simuladas. Si el servidor no informa el espacio, el panel lo dice.
- La carpeta **Archivo**: si el buzón no la tiene, "Archivar" no aparece (deslizar a la
  derecha marca como leído).
- Tiempo real de WhatsApp con el filtro por usuario: depende de que Realtime acepte el
  filtro `agent_user_id=eq.…` (es el mismo filtro que ya aplica la consulta).
