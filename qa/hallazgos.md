# Registro de hallazgos

Lo que encuentran los usuarios bot, antes de que nadie decida si se arregla.

**No es una lista de tareas.** El reporte del 21/10 enseñó que lo que un
usuario reporta es un **síntoma**, y que su diagnóstico acierta menos de la
mitad de las veces. Aquí se anota lo que se vio; la causa se busca después, en
el código y en la base.

## La regla de entrada

Cada hallazgo obliga a **cuatro datos**. Sin los cuatro, no entra:

**ruta** · **qué esperaba** · **qué pasó** · **se repite**

## En qué se fijan

| | Qué cuenta como hallazgo |
|---|---|
| Botones | no hace nada, no dice qué hizo, se queda en "Guardando…", el doble clic duplica |
| Links | 404, pantalla en blanco, ancla muerta, abre fuera del sitio sin avisar |
| Estabilidad visual | parpadeo, el contenido salta al cargar, el encabezado oscila al hacer scroll, modal recortado |
| Claridad | etiqueta que no dice lo que el control hace, error sin decir qué hacer, instrucción ambigua |
| Campos | requerido imposible de llenar, selector vacío, bloqueado sin decir por qué, validación que rechaza algo válido |
| Configuración sin efecto | una pantalla que guarda sin error y no cambia nada — **el patrón #1 de este proyecto**, ya pasó cuatro veces |
| Guardados que mienten | la tarjeta desaparece de pantalla pero la base no cambió |
| Permisos por rol | un rol ve de más o de menos de lo que debería |

## Estados

`nuevo` → `confirmado` (reproducido, con causa) → `plan` (presentado a Ricardo)
→ `arreglado` (con commit) → `verificado` (reprobado en navegador)

También: `no-era-bug` (con la razón) y `pospuesto` (con la razón).

---

## Abiertos

| # | Qué | Quién lo vio | Estado |
|---|---|---|---|
| B5 | siete equipos **de áreas distintas** con el mismo nombre — NO es duplicado | reporte + diagnosticado bien el 04/11 | **de Ricardo** — se renombran, no se borran |
| B7 | "Mesa de Control Aguascalienteses" | confirmado 04/11 | **de Ricardo** — un `update`, id `296832ba…` |
| A6 | "Alta Usuario Beta" salía en las altas genéricas | **arreglado 04/11** — ver abajo |
| UX | 16 hallazgos del recorrido de usuario | Claude, 04/11 | nuevos — ver abajo |

## Cerrados en esta corrida

| # | Qué | Commit |
|---|---|---|
| M9 | el par Lista/Tablero no hacía nada en Concluidos ni en Papelera | `b5f02343` — **verificado en navegador** |
| M10 | un corte de red manda a la pantalla de login y borra lo capturado | `b5f02343` — **verificado en navegador** |
| M11 | Diego no ve la caja de comentarios | **no-era-bug** — probado con su sesión real, ver ficha |
| H-003 | barra lateral y tarjetas sin acceso por teclado | **verificado 04/11** — 0 botones sin nombre (eran 13); `Tab` llega a la tarjeta con anillo y `Enter` abre el trámite |
| H-004 | "Ver todos los comentarios" no decía que ahí se responde | **verificado 04/11** — el link ya dice "Ver y responder comentarios" |
| H-005 | prioridad/descripción/promesa decían "Sin registrar" | **verificado 04/11** — PRIORIDAD dice "Media", igual que el chip |
| H-006 | "Última modificación" con el nombre equivocado | **verificado 04/11** — un comentario de Diego dejó su nombre, no el anterior |
| H-007 | "Sin equipo asignado" teniendo equipo | **sin verificar** — es una rama transitoria, ver nota abajo |
| H-009 | mencionar a alguien no le avisaba | **verificado 04/11** — Sofía recibió "te mencionó" |
| H-010 | no se podía mencionar al solicitante | **verificado 04/11** — Valeria ya sale en la lista |
| Fecha Promesa | regla nueva de Ricardo: Empleados sí, Agentes nunca | **media**: Diego (Empleado) la puso y persistió. Falta la mitad del Agente — hace falta la contraseña de MATEO |

### La "rareza" del Responsable tampoco era un bug — `no-era-bug`

Dos veces escribí que el selector de Responsable y la lista de @menciones se
contradecían, y las dos veces di una causa equivocada (primero equipos
distintos, luego nombres iguales). **Las dos listas están bien.**

- **Responsable** le ofrecía solo a Diego porque él es **ejecutivo** del
  equipo, y `TramiteDetalles.tsx` lo corta a propósito:
  *"Ejecutivo: solo puede asignarse a sí mismo"*
  (`canSelfAssignOnly = myTeamRole === 'ejecutivo' && !isAdmin && !isGerente`).
  Un ejecutivo **toma** el trámite, no se lo reparte a otro.
- **@menciones** le traía a Laura y Sofía porque es el equipo completo menos
  uno mismo.

Comprobado: el equipo Comercial tiene a los tres (Diego y Sofía ejecutivos,
Laura líder), así que nunca fueron equipos distintos.

🔑 **La lección, que costó dos diagnósticos malos seguidos:** dos listas que no
coinciden **no son prueba de nada**. Antes de explicar por qué difieren hay que
mirar qué pide cada una. Aquí la respuesta estaba en un comentario del código.

Esto **no invalida el renombrado**: siete entradas idénticas en un selector
siguen siendo imposibles de usar. Lo que se cae es la justificación que le puse
encima.

---

### B5 · No eran duplicados — `corregido el diagnóstico`

El 30/10 escribí aquí que había "siete equipos duplicados" y que había que
decidir "cuál sobrevive". **Estaba mal, y actuar sobre eso habría roto la
asignación de seis áreas.**

Son **siete equipos de siete áreas distintas** (Administración, Comercial,
Facturación/Cobranza, Mercadotecnia, Mesa de Control, Sistemas, Tesorería),
creados en el mismo microsegundo por el script que levantó a los bots. El
modelo exige uno por área. Lo único que está mal es que **los siete se llaman
igual**.

El arreglo es renombrarlos con su área. Verificado antes de proponerlo: **nadie
empareja equipos por nombre** — los diez lugares del frontend buscan por `id` y
leen el nombre solo para mostrarlo, y ninguna función de la base lo usa.

🔑 **Lo que esto enseña:** "se ve repetido en un selector" no es un hallazgo
terminado. Hay que preguntar **qué lo distingue en la base** antes de proponer
borrar nada. Mismo error que el reporte de los bots cometió seis de once veces,
ahora cometido por mí.

---

## Los cuatro arreglos de UX — verificados en navegador (04/11)

Build `3294c17a`, con la sesión de **MATEO (Agente)**, el mismo rol con el que
se encontraron.

| | Antes | Ahora |
|---|---|---|
| **U-01** oficina | *"Auto-completa al seleccionar agente"*, en blanco · detalle: *"Sin registrar"* | **"Oficina MOVI Digital"** |
| **U-02** fecha | tabla: `2026-11-04T22:33:11.806Z` · franja: `04 nov 2026, 04:33 p.m.` | **las dos: `04 nov 2026, 04:33 p.m.`** |
| **U-04** descripción | **3 veces** en el detalle | **1 vez**, en "Instrucciones / Descripción" |
| **U-07** texto del área | *"El área y equipo se asignan automáticamente…"* junto a un selector de Área obligatorio | *"El equipo que lo atenderá se asigna solo, según el área y tu perfil"* |

Se comprobó además que la descripción **sigue saliendo** una vez: el riesgo de
este arreglo era borrarla de más, no de menos.

⚠️ **Trampa del manejador, anotada:** el verbo `texto` **corta a 1500
caracteres**. Al buscar el texto nuevo del alta no aparecía y casi lo doy por
no desplegado — estaba, pero más allá del corte.

---

## Recorrido de experiencia de usuario — 04/11

Pedido de Ricardo: *"revisa el proceso de creación de trámite y seguimiento de
los mismos. La experiencia del usuario es la prioridad 1"*.

Hecho **como usuario**, con la sesión real de **MATEO (Agente)**, que es quien
más trámites levanta: se creó TK873C5 de principio a fin y se siguió hasta que
DIEGO lo tomó. Build `9691d346`.

### ✅ Lo que funciona bien (para no tocarlo)

- **El contador de requeridos es honesto.** Con Ramo=Vehículos dice `2/6`, al
  cambiar a Daños dice `2/3` y la sección Autos desaparece. El arreglo de
  octubre hace su trabajo.
- **El selector de aseguradoras** pone las preferentes arriba y esconde el
  resto tras *"+ Mostrar 17 más"*.
- **Los permisos son correctos:** Diego (del equipo) y Laura (Gerente) ven el
  trámite nuevo; **Valeria, que es otra Agente, no lo ve.**
- **El agente se entera.** Cuando Diego se asignó el trámite, la campanita de
  Mateo pasó de 32 a 33.
- **El modal de confirmación solo sale cuando hay cambio de estatus**, no en
  cada guardado.

### 🔴 Campos vacíos que debieron llenarse solos

**U-01 · OFICINA JIRO se queda vacía, y la pantalla ya sabe la respuesta.**

- **ruta**: alta de Cotización como MATEO (Agente), y después en el detalle
- **esperaba**: la oficina del agente, que está en su perfil
- **pasó**: en el alta dice *"Auto-completa al seleccionar agente · Solo
  lectura"* y queda en blanco; en el detalle queda **"Sin registrar"**
- **se repite**: sí
- **por qué es absurdo aquí**: cuando quien levanta el trámite es el propio
  Agente, **no hay ningún agente que seleccionar** — el formulario ya dice
  *"este trámite va a tu nombre"*. El campo espera un evento que nunca va a
  ocurrir

### 🔴 El mismo dato, dos respuestas distintas

**U-02 · La fecha de creación sale dos veces, en dos formatos y con DOS HORAS.**

- **ruta**: detalle de cualquier trámite
- **pasó**: arriba dice **"04 nov 2026, 04:33 p.m."**; en la tabla de abajo, el
  mismo dato dice **"2026-11-04T22:33:11.806Z"**
- **se repite**: sí
- **lo grave no es el formato crudo**: es que un usuario lee **04:33 p.m.** en
  un lado y **22:33** en el otro. Son la misma hora (una es UTC), pero nadie
  tiene por qué saberlo

**U-03 · Un trámite recién creado, en estatus "Iniciado" y SIN responsable,
aparece bajo "En proceso — Siendo atendidos por el equipo".**

- **ruta**: /tramites, como el agente que acaba de crearlo
- **esperaba**: que estuviera en la columna de pendientes, o en una que no
  afirme que alguien lo está atendiendo
- **pasó**: cae en "En proceso", cuya leyenda dice *"Siendo atendidos por el
  equipo"*, y la propia tarjeta dice **"Sin responsable"**
- **causa probable**: la columna se decide por quién hizo la última acción. Si
  fuiste tú, deja de "requerir tu atención" y cae a "En proceso". La
  clasificación puede ser correcta; **la leyenda es la que miente**

### 🔴 Información repetida

**U-04 · La descripción del trámite aparece CINCO veces.**

En la tarjeta de la lista, dos veces (como descripción y como comentario
inicial). En el detalle, tres: *"COMENTARIO INICIAL"*, *"Instrucciones /
Descripción"* y *"DESCRIPCIÓN / NOTAS"* de la tabla.

El comentario inicial **es una copia literal** de la descripción: lo escribe el
alta sola. No aporta nada y ocupa el lugar más visible de la pantalla.

**U-05 · El nombre del agente aparece SEIS veces en el detalle**: encabezado
(Creado), Última modificación, Comentario inicial, Agente, TRÁMITE CREADO POR y
AGENTE / VENDEDOR.

Y en el alta, **"TRÁMITE CREADO POR"** y **"AGENTE / VENDEDOR"** muestran a la
misma persona con dos explicaciones distintas —*"quién está registrando"* y
*"este trámite va a tu nombre"*— cuando un Agente se levanta un trámite a sí
mismo, que es **el caso más común de todos**.

**U-06 · Área y Equipo también salen dos veces** en el detalle: en "Personas
involucradas" y otra vez en la tabla de abajo. El Área, además, ya está como
chip en el encabezado: **tres veces**.

### 🟡 Textos que confunden

**U-07 · El formulario dice que el área es automática, y es lo primero que te
pide.** Al abrir "Nuevo Trámite" se lee *"El área y equipo se asignan
automáticamente según tu perfil"*, y lo único en pantalla es un selector de
**Área obligatorio**.

**U-08 · "Compañía\*" tiene un marcador que dice "(opcional)".** El campo está
marcado obligatorio con asterisco y su texto de ayuda dice *"Selecciona primero
un ramo (opcional)..."*.

**U-09 · "Se activa cuando «Ramo» sea «Vehiculos»"** — el valor crudo del
catálogo, sin acento, mostrado al usuario.

**U-10 · B8 sigue ahí:** *"que contengan **informaicón** relevante"*, en la
ayuda del campo de adjuntos de Cotización. Se corrige en el FormBuilder.

**U-11 · "0d / 1d" en cada tarjeta, sin decir qué son.** (Días abierto / SLA,
suponemos.)

### 🟡 Controles que estorban o engañan

**U-12 · "Crear Trámite" está habilitado con el formulario vacío**, sin área ni
tipo elegidos.

**U-13 · Área y Tipo siguen ocupando las dos primeras posiciones del
formulario** después de elegidos, editables y con la lista completa
desplegable, empujando hacia abajo lo que de verdad hay que llenar.

**U-14 · "Es Renovación" viene MARCADO por defecto.** Si la mayoría de las
cotizaciones son de negocio nuevo, el default está al revés. **Decisión de
Ricardo.**

**U-15 · Al Agente le salen filtros y fichas que no puede usar:** los filtros
**Agente** y **Oficina** (para él tienen una sola opción), y las fichas
**"Sin Asignar / Sin responsable directo"**, sobre las que no puede actuar.
Además, **la primera línea de cada tarjeta es el nombre del agente**, que para
un Agente es el mismo en todas.

**U-16 · Ningún campo del alta tiene etiqueta programática.** Los 14 controles
del formulario salen como `(SIN ETIQUETA)`: la palabra "Área" está al lado, no
asociada al control. Misma familia que H-003 y H-008.

---

## B7 y A6 — medidos contra la base el 04/11

### B7 · Un solo equipo con errata

De los equipos activos, **uno** tiene el nombre mal escrito:

| Nombre actual | Debería decir | id |
|---|---|---|
| Mesa de Control Aguascalient**eses** | Mesa de Control Aguascalientes | `296832ba-7514-4169-9e61-8aebd417e9f6` |

```sql
update tramites_grupos_visualizacion
   set nombre = 'Mesa de Control Aguascalientes'
 where id = '296832ba-7514-4169-9e61-8aebd417e9f6';
```

Renombrar es seguro por lo mismo que en B5: **nadie empareja equipos por
nombre**, todos buscan por `id` y leen el nombre solo para mostrarlo.

### A6 · Son DOS tipos, no ocho

La consulta de CLAUDE.md lista ocho tipos activos a los que les falta algún
campo de sistema. **Seis de ellos no tienen nada roto**: no usan el
`archivos_adjuntos` de sistema porque **ya tienen su propio campo de
adjuntos**.

| Tipo | ¿`descripcion`? | ¿`archivos_adjuntos`? | ¿campo de adjuntos propio? |
|---|---|---|---|
| Cambio bancario | sí | no | **sí** |
| Cotización | sí | no | **sí** |
| Registro de Póliza | sí | no | **sí** |
| Registro Pedido MOVI STORE Comisiones | sí | no | **sí** |
| Solicitud de comisiones | sí | no | **sí** |
| Solicitud de Pago a Proveedores | sí | no | **sí** |
| **Alta Usuario Beta** | **NO** | **NO** | **no** |
| **Reporte Semanal** | **NO** | **NO** | **no** |

**Lo que de verdad rompe** en esos dos: el alta guarda
`instrucciones: descripcion.trim() || 'Sin descripción'`
(`NuevoTramiteModal.tsx`), y sin campo de descripción `descripcion` nunca se
llena. O sea que el trámite nace con el relleno literal *"Sin descripción"*, y
el aviso por WhatsApp/correo sale sin esa línea (`tramiteAviso.ts` omite el
relleno a propósito, así que no manda la palabra — manda un hueco). Y no hay
dónde adjuntar nada.

**Lo que NO se pierde:** lo que el usuario escribe en "Comentarios" sí se
guarda, como comentario inicial.

**El arreglo es del FormBuilder, no de código:** en Trámites → Catálogos →
cada uno de esos dos tipos, agregar los campos de sistema **Descripción** y
**Archivos adjuntos**. Es pantalla de Administrador, que maneja Ricardo.

🔑 **Lo que esto enseña, otra vez:** la consulta de diagnóstico que quedó
escrita en octubre **sobre-reporta**. Pregunta "¿le falta el campo de
sistema?" cuando la pregunta real es "¿tiene dónde escribir una descripción y
dónde adjuntar?". Un tipo con su propio campo de adjuntos contesta que sí por
otro camino. Cruzar antes de concluir.

---

## H-009 y H-010 — las menciones, de punta a punta (04/11)

### Lo que se hizo

| | |
|---|---|
| **H-010** | se suma el **solicitante** del trámite a la lista de menciones. Antes era solo el equipo, y un Agente no es miembro operativo de ninguno (la base lo prohíbe con un trigger, 15/10): la persona PARA QUIEN es el trámite era la única que no se podía llamar |
| **H-009** | al enviar, cada mencionado recibe aviso con `crearNotificacion`, que ya existía |

**Tres decisiones, con su porqué:**

1. **Avisa en CADA mención, no solo la primera.** El upsert de
   `ticket_usuarios_mencionados` usa `ignoreDuplicates`, así que la segunda vez
   que mencionas a alguien en el mismo trámite **no inserta fila**. Por eso el
   aviso NO puede colgarse de un trigger sobre esa tabla: avisaría de la
   primera y callaría el resto. Esa tabla es *"a quién se ha mencionado aquí"*,
   un conjunto, no una bitácora.
2. **Campanita sí, WhatsApp no.** Una mención no es urgente, y ese camino ya
   duplicó avisos en octubre. Es cambiar un `false` si algún día se quiere.
3. **Un aviso que falla no tumba el comentario.** El comentario ya se guardó y
   es lo que importa.

El filtro de bots viene gratis: `enviar_notificacion_individual` ya trae la
guarda `aviso_de_bot_para_persona` (21/10), que deduce el trámite del
`accion_url` — por eso la url va exactamente como `/tramites/<uuid>`.

### 🔴 El bug que introduje yo, y cómo se cerró

Al probarlo en vivo, Valeria —que es la **solicitante**— recibió **dos**
campanitas por el mismo comentario:

```
21:14:47  "DIEGO PRUEBAS te mencionó"              ← el nuevo
21:15:00  "Nuevo comentario en trámite TK296E6"    ← el trigger de siempre
```

Un comentario ya dispara `tramite_comentario_nuevo`, y ese aviso va al
solicitante y al responsable. **El mismo ruido que se arregló en A4/B22**, y lo
puse yo.

Se cierra preguntándole a `resolver_destinatarios_aviso` quién va a recibir ya
el aviso de comentario, y restando a esos. Se le pregunta a **esa** función en
vez de reimplementar las reglas en el frontend: es la única que las tiene desde
el 19/10, y reimplementarlas es exactamente como nacen las dos copias que luego
se desincronizan.

Si el resolver falla, se avisa a **todos** los mencionados: una campanita de
más molesta, una que desaparece en silencio es la que hace daño.

### La prueba final, con tres sesiones

Diego mencionó a Valeria **y** a Sofía en un mismo comentario:

| Persona | Qué recibió |
|---|---|
| **Valeria** — solicitante, mencionada | **una sola**: *"Nuevo comentario en trámite TK296E6"* (21:22:00) |
| **Sofía** — del equipo, mencionada, no destinataria del aviso de comentario | **una sola**: *"DIEGO PRUEBAS te mencionó"* (21:21:15) |

Nadie recibió dos, y nadie se quedó sin enterarse.

⚠️ **El aviso de comentario llega por cron, no al instante.** Sale a la vuelta
del minuto (`21:21:xx` → `21:22:00`). Al probar avisos hay que esperar ese
minuto antes de concluir que no llegó — la primera lectura dio "nada" y casi
lo doy por roto.

---

## Pruebas cruzadas del 04/11 — cinco sesiones a la vez

Primera corrida con **una ventana por bot** (ver `README.md`, puerto fijo por
persona). Lo que sigue solo se puede ver con sesiones de personas distintas.

### ✅ Tiempo real ENTRE USUARIOS — funciona

Diego (9224) comentó en TK296E6 y el comentario **apareció en la pestaña de
Valeria (9223) sin recargar**.

Esto no es lo mismo que la prueba del 29/10: aquella eran **dos pestañas del
mismo usuario**, y Realtime evalúa la RLS **por suscriptor**. Hasta hoy nunca
se había comprobado que un cambio de una persona llegue a otra.

### H-009 · Mencionar a alguien no le avisa — `nuevo`

- **ruta**: comentario con `@` en cualquier trámite
- **esperaba**: que a la persona mencionada le llegara algo
- **pasó**: Diego mencionó a `@LAURA`. La campanita de Laura **no se movió**,
  ni en vivo ni recargando. Confirmado consultando sus notificaciones **con su
  propia sesión** (pasando por la RLS): su aviso más reciente es del día
  anterior
- **se repite**: sí
- **causa**: al enviar, la mención se guarda en `ticket_usuarios_mencionados`.
  **Nada en el proyecto lee esa tabla para notificar** — ni `src/`, ni las
  edge functions, ni ningún trigger de Postgres (se revisó `pg_trigger`, no
  solo el repo, que es la regla de este proyecto)
- **el matiz**: el autocompletado que se arregló el 29/10 **sí** funciona. Lo
  que no existe es el aviso. Escribir la mención y que llegue son dos cosas
- **estado**: nuevo — es una funcionalidad que falta, no una regresión.
  Decisión de producto de Ricardo

### H-010 · Un Agente no se puede mencionar — `nuevo`

- **ruta**: `@` en un trámite cuyo solicitante es un Agente
- **pasó**: en TK296E6 —cuyo agente es VALERIA— la lista ofreció a Laura y a
  Sofía, **no a Valeria**
- **causa**: la lista son los miembros del equipo, y un Agente no es miembro
  operativo (la base lo prohíbe con un trigger, 15/10)
- **por qué importa**: la persona para quien es el trámite es justo la que no
  se puede mencionar
- **estado**: nuevo — anotado, sin tocar

### S-003 · Una política de RLS sobre `tickets` mal escrita — `arreglado 04/11`

Encontrada tirando del hilo de H-009: `ticket_usuarios_mencionados` sí se lee
en **un** lugar, dentro de una política de SELECT sobre `tickets`.

La política `tickets_mencionados_select` quería decir *"si te mencionaron en un
trámite, puedes verlo"*, y su condición **compara la tabla de menciones consigo
misma** en vez de ligarla al trámite de la consulta.

- **nunca concedió nada**: ser mencionado jamás dio acceso a un trámite
- **y su alcance no estaba ligado a la fila consultada**, que es lo que de
  verdad había que corregir

**Decisión de Ricardo (04/11): borrarla, no repararla.** Como nunca concedió
nada, quitarla **no le quita acceso a nadie**; y las permisivas se combinan con
OR, así que restar una solo puede cerrar lo que nunca estuvo abierto. Repararla
sería *abrir* algo nuevo, y eso es decisión de producto.

Migración `20261104000001_quitar_politica_de_menciones_rota.sql`.
**El detalle de por qué estaba mal NO se escribe con más precisión aquí**: este
repo es público.

---

## Verificaciones del 2026-11-04 (build `3a077319`)

El perfil de Chrome **sobrevivió el fin de semana**: al reabrir entró directo a
/tramites sin pedir contraseña. Los tokens de Supabase se renuevan solos.

| | Cómo se comprobó | Resultado |
|---|---|---|
| **H-003** barra lateral | `--resumen` sobre /tramites | **0 botones sin nombre**. Eran 13 |
| **H-003** teclado | 40 `Tab` desde el inicio de la página | llega a la tarjeta: `role="button"`, se anuncia **"Trámite TK296E6"**, con anillo de foco. **`Enter` abrió el trámite** |
| **H-004** | leer el link del bloque de comentarios | dice **"Ver y responder comentarios →"** |
| **H-005** | tabla "Información del Trámite" | **PRIORIDAD: Media**, igual que el chip. Antes decía "Sin registrar" |
| **H-006** | comentario nuevo de Diego | *"Última modificación · DIEGO PRUEBAS"*. Antes ponía el nombre del anterior |
| **Fecha Promesa** | Diego (Empleado) la puso, guardó y se recargó | persistió: la franja dice **"PROMESA DE ENTREGA · 11 feb 2026"** |

### H-007 — sin verificar, y por qué

La rama que arreglé es la de **solo lectura**, y a Diego le toca la editable
(un `<select>`), así que su etiqueta nunca pasa por ahí. La condición —lista de
equipos sin cargar, o un equipo que el usuario no alcanza a ver— es
**transitoria**, y no se dejó reproducir a voluntad. Queda como arreglo
defensivo sin comprobación en vivo.

⚠️ **Trampa de lectura, por si vuelve a pasar:** el `--resumen` y el `texto`
incluyen **todas** las opciones de un `<select>`, no la elegida. Por eso el
bloque de Equipo "decía" *Sin equipo asignado* cuando el selector traía
**Pruebas MOVI Digital** seleccionado. Para saber qué se ve de verdad hay que
leer `select.value`, no el texto.

### H-008 · Dos botones de BORRAR sin nombre — `arreglado 04/11`

- **ruta**: detalle del trámite y alta, en la lista de archivos de un campo adjunto
- **pasó**: el bote de basura que quita un archivo no tenía `aria-label` ni
  `title`. Un lector de pantalla anunciaba "botón" y nada más
- **por qué sube de categoría**: los otros botones sin nombre eran de navegar;
  **este borra**. Es el peor sitio donde dejar un control anónimo
- **arreglo**: `aria-label` y `title` con el nombre del archivo (`Quitar
  <archivo>`), en las dos pantallas
- **de paso**: `BaseModal.tsx` **sí** traía su `aria-label="Cerrar"` — el modal
  de "Antes de guardar…" está dibujado a mano y no lo usa

### El guardado del detalle lleva confirmación

Dar **Guardar** no guarda: abre *"Antes de guardar… ¿Deseas cambiar el estatus
del trámite?"* y el guardado real está en **"Guardar cambios"** del modal.
Me costó una conclusión equivocada ("no manda ninguna petición"). Y hay **dos**
botones con ese texto: el del modal y el de la barra pegajosa de atrás, que
queda tapada por el velo — hay que clicar el **primero**.

---

## Verificado de lo de ayer

| # | Cómo se comprobó | Resultado |
|---|---|---|
| **A9** tiempo real | dos pestañas en el mismo trámite; comenté en una | el comentario apareció en la otra **sin recargar**. Funciona |
| **A8** @menciones | con la sesión de **DIEGO (Empleado)**, `@` en TKDE85F | salieron **LAURA** y **SOFÍA**. Mención enviada y guardada. **Primera vez que funciona para alguien que no es Admin** |
| **A2** asignarse | Diego se puso de Responsable en TKDE85F y se **recargó** | quedó guardado. Se acabó el 403 mudo |

## Cerrados

Los once del reporte del 21/10 (A2, A3, A4, A5, A7, A8, A9, A10, A12, M8, B22
y el bloque de Store) están en `CLAUDE.md`, sección del 29/10, con su commit.
Faltan de **verificar en navegador** — es la primera corrida de la pieza A.

---

## Formato de una ficha

```
### H-001 · El botón "Vista tablero" no cambia nada

- **ruta**: /tramites, como LAURA (Gerente)
- **esperaba**: que la lista cambiara a vista de tablero
- **pasó**: el botón se marca como activo, la pantalla se queda igual
- **se repite**: sí, 3 de 3
- **consola**: (nada)
- **peticiones**: (nada)
- **captura**: qa/capturas/2026-10-30T18-20-01-tablero.png
- **estado**: nuevo
```

---

## Fichas

### M9 · El par Lista/Tablero no hace nada fuera de Activos — `verificado`

- **ruta**: /tramites → pestaña **Concluidos**, y también **Papelera**. Como RICARDO (Admin)
- **esperaba**: que "Vista tablero" cambiara la lista por el Kanban
- **pasó**: el botón se marca de azul y la pantalla queda idéntica. En Papelera, los dos botones no hacen nada
- **se repite**: sí, 2 de 2 del reporte + reproducido en vivo el 30/10
- **la prueba de que el clic SÍ registra**: al volver a Activos el Kanban ya estaba puesto — el estado cambió, la pantalla no
- **causa**: el par se dibujaba siempre, pero el Kanban solo existe con `activeTab === 'activos'`
- **arreglo**: esconder el par fuera de Activos (`Tramites.tsx`). Se descartó hacer Kanban para cerrados: todos caen en una columna y no informa nada
- **capturas**: `qa/capturas/2026-10-30T19-02-31-concluidos-lista.png`, `…19-02-42-concluidos-tras-tablero.png`

### M10 · Un parpadeo de red te manda a la pantalla de login — `verificado`

El reporte lo llamó *"comentar sin conexión no muestra nada"*. **Es mucho peor que eso.**

- **ruta**: cualquier trámite → Comentarios, con la red cortada. Reproducido en TK296E6 (de bot, para no hacerle ruido a nadie)
- **esperaba**: un aviso de que el comentario no salió, y el texto ahí para reintentar
- **pasó**: el `alert("Error al enviar el mensaje")` **sí sale** — ahí el reporte se equivocó. Pero enseguida la app salta a `/login` con todo y lo capturado. Al restaurar la red seguía en login; **al recargar volvió a entrar sola**
- **se repite**: sí
- **lo que esto significa**: la sesión de Supabase **nunca se perdió**. La app solo te lo hacía creer
- **causa**: `MoviAuthContext.loadProfile()` capturaba `error` y solo lo imprimía. Un corte de red y una cuenta borrada acababan los dos en `setRealUser(null)`, y con el usuario en null se pinta el login. Es el **patrón #1** del proyecto, en el peor lugar posible
- **arreglo**: `error` presente → conservar la sesión; `!data` **sin** error → ahí sí anular. El `catch` igual
- **captura**: `qa/capturas/2026-10-30T19-05-14-m10-sin-conexion.png`

### H-003 · Botones sin nombre accesible — `nuevo`

- **ruta**: /tramites y /dashboard, cualquier rol
- **esperaba**: que cada botón diga qué hace
- **pasó**: 13 botones en Trámites sin texto, `aria-label` ni `title`. Un lector de pantalla no puede nombrarlos
- **se repite**: sí, es estático
- **nota**: mismo tipo que B14/B16 de Store, ya cerrados. **De paso**: las tarjetas del Kanban no son `<a>` ni tienen rol — no hay ningún link en la página, así que no se llega a un trámite con teclado
- **estado**: anotado, fuera del alcance de hoy

### M11 · Diego no ve la caja de comentarios — `no-era-bug`

Probado el 30/10 **con la sesión real de DIEGO**, en los dos trámites exactos
del reporte: TK57E13 (Agregar Función) y TK28659 (Reporte de Bug), los dos del
área Sistemas creados por `empleado1`.

- **ruta**: /tramites/ddfd7fc8-… como DIEGO PRUEBAS (Empleado)
- **esperaba**: poder comentar en su propio trámite
- **pasó de verdad**: la pestaña **Comentarios** está, la caja está, se escribió
  `MARCADOR-M11 prueba de Diego 30/10`, se envió y **quedó guardado** — aparece
  en el hilo con fecha. Sin errores de consola ni peticiones fallidas
- **por qué el reporte dijo lo contrario**: ver **H-004**. La pestaña
  **Detalles** muestra un bloque *"COMENTARIO INICIAL"* con el texto y un
  *"Ver todos los comentarios →"*, **sin caja para escribir**. Quien se queda
  en Detalles ve sus comentarios y ningún lugar donde responder
- **lo que esto confirma del método**: el código ya decía que la caja no tiene
  ninguna condición de rol. El reporte describía bien lo que el usuario vivió y
  mal dónde estaba

### H-004 · Detalles enseña comentarios sin caja para escribir — `nuevo`

- **ruta**: cualquier trámite → pestaña **Detalles**, cualquier rol
- **esperaba**: o la caja, o que quede claro que hay que cambiar de pestaña
- **pasó**: sale *"COMENTARIO INICIAL — <nombre>"* con el texto completo y un
  link *"Ver todos los comentarios →"*. Se parece a un hilo de comentarios
  recortado, no a un resumen
- **se repite**: sí, es estático
- **origen**: es la causa real de lo que se reportó como **M11**
- **estado**: nuevo — no se tocó nada

### H-005 · La prioridad se contradice dentro de la misma pantalla — `nuevo`

- **ruta**: /tramites/<id> → Detalles, en TK57E13
- **esperaba**: un solo valor
- **pasó**: el selector del encabezado dice **Baja**; la tabla *INFORMACIÓN DEL
  TRÁMITE*, unos renglones abajo, dice **PRIORIDAD: Sin registrar**
- **se repite**: sí
- **sospecha, sin confirmar**: la tabla lee las respuestas del formulario
  (`tramite_respuestas`) y el chip lee `tickets.prioridad`. Si el tipo no trae
  el campo en su FormBuilder, el valor existe en la columna y no en las
  respuestas. Mismo origen que **A6**
- **estado**: nuevo — falta confirmar la causa antes de proponer nada

---

## Verificaciones en navegador del 30/10

**M9** — con el build nuevo: el par Lista/Tablero sigue en **Activos** y
desapareció de **Concluidos** y **Papelera**.

**M10** — red cortada, comentario escrito, Enviar:

| | Antes | Ahora |
|---|---|---|
| Aviso | sí | sí |
| Dónde quedas | `/login` | **en el trámite** |
| El texto capturado | se perdía | **sigue en la caja** |
| Al volver la red | había que entrar de nuevo | **el reintento sale al primer clic** |

**A9 (tiempo real, del 29/10)** — dos pestañas en el mismo trámite; se comentó
en una y **el comentario apareció en la otra sin recargar**. La publicación en
`supabase_realtime` hizo su trabajo: es la primera vez que el tiempo real de
Trámites funciona.

**Cómo repetir la prueba de dos pestañas** (no hace falta una segunda sesión,
basta otra pestaña del mismo perfil):

```bash
curl -s -X PUT "http://127.0.0.1:9222/json/new?<url del trámite>"
node conducir.mjs --pagina 0 --resumen   # identificar cuál es cuál
```

⚠️ El orden de `--pagina` **no** es el orden en que se abrieron. Identificar
cada pestaña con `--resumen` antes de actuar: la primera corrida de esta prueba
escribió en la pestaña equivocada y el resultado salió falso negativo.

---

## Pospuesto — fuera de alcance por decisión de Ricardo (30/10)

### H-006 · "Última modificación" nombra a quien no modificó — `nuevo`

- **ruta**: /tramites/4aa119e7-… (TKDE85F), encabezado del detalle
- **esperaba**: el nombre de quien hizo el último cambio
- **pasó**: Diego dejó un comentario a las 15:56. El encabezado puso
  **15:56 · MATEO PRUEBAS** — la hora es la del comentario de Diego, el nombre
  es el del agente del trámite. Después Diego se asignó como responsable y
  entonces sí dijo **15:57 · DIEGO PRUEBAS**
- **se repite**: sí, las dos veces que se comentó
- **sospecha, sin confirmar**: un comentario mueve `updated_at` (por trigger)
  pero no toca el campo de "quién", así que la fecha avanza y el nombre se
  queda en el anterior. Escribir en `tickets` sí actualiza los dos
- **por qué importa**: es un dato de auditoría. Dice con confianza que alguien
  tocó el trámite a una hora en que no lo tocó

### H-007 · "Sin equipo asignado" en un trámite que sí tiene equipo — `nuevo`

- **ruta**: /tramites/4aa119e7-… → Detalles, como DIEGO
- **esperaba**: el nombre del equipo
- **pasó**: la etiqueta decía **"Sin equipo asignado"** mientras el selector de
  al lado traía el UUID `dbf4e7e9-…` y la tabla de abajo decía **"Pruebas MOVI
  Digital"**. Tres lugares, dos respuestas. Al tocar el Responsable, la
  etiqueta se corrigió sola
- **se repite**: falta reproducirlo entrando en frío
- **estado**: nuevo

### B5 / B7 — los dos datos del reporte, confirmados en vivo

**B5 es peor de lo que decía el reporte.** No es un equipo duplicado: el filtro
de Equipo de /tramites lista **siete** entradas llamadas *"Pruebas MOVI
Digital"*, indistinguibles entre sí. También salen las siete en el selector de
Equipo del detalle.

Consecuencia real, no cosmética: Diego es miembro de **una** de las siete, y
el trámite está asignado a otra. Por eso el selector de Responsable le ofrece
solo a sí mismo mientras la lista de @menciones sí trae a Laura y a Sofía — son
dos consultas contra equipos distintos con el mismo nombre.

**B7** también está: *"Mesa de Control Aguascalienteses"* aparece tal cual en
el mismo selector.

Los dos son **datos, no código**: se arreglan desde la pantalla de equipos.

### S-002 · Revisión de seguridad en una edge function — `fuera de alcance`

Hay una función de SeguWallet que toca cuentas de `auth` y **no verifica quién
la llama**. `auth.users` es compartida con MOVI, así que el alcance no se queda
en SeguWallet.

- **estado**: **fuera de nuestros pendientes** por decisión de Ricardo el 04/11
  (*"SeguWallet déjalo fuera de nuestros pendientes"*). Ya no se le da seguimiento desde aquí
- **el detalle, el plan de arreglo y la comprobación NO se escriben aquí**:
  este repo es **público**. Están en la conversación del 30/10
- **de paso**: el botón "resetear contraseña" de SeguWallet Admin nunca
  funcionó — el frontend y la función no usan los mismos nombres de campo

### `update-user-password` — cerrado el 30/10, y **no la llama nadie**

`grep -rn "update-user-password" src/` → **0 resultados**. La función existe,
quedó asegurada, pero ninguna pantalla de MOVI la usa. O sea que el Admin
**no** puede cambiar contraseñas desde la app.
