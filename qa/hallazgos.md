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
| B5 | **siete** equipos llamados "Pruebas MOVI Digital" | reporte + confirmado 30/10 | **de Ricardo** — es dato, no código |
| B7 | "Mesa de Control Aguascalienteses" | reporte + confirmado 30/10 | **de Ricardo** — es dato, no código |

## Cerrados en esta corrida

| # | Qué | Commit |
|---|---|---|
| M9 | el par Lista/Tablero no hacía nada en Concluidos ni en Papelera | `b5f02343` — **verificado en navegador** |
| M10 | un corte de red manda a la pantalla de login y borra lo capturado | `b5f02343` — **verificado en navegador** |
| M11 | Diego no ve la caja de comentarios | **no-era-bug** — probado con su sesión real, ver ficha |
| H-003 | barra lateral y tarjetas sin acceso por teclado | `DesktopSidebar.tsx` + `Tramites.tsx` — falta probar |
| H-004 | "Ver todos los comentarios" no decía que ahí se responde | `TramiteDetalle.tsx` — falta probar |
| H-005 | prioridad/descripción/promesa decían "Sin registrar" | `TramiteDetalle.tsx` — falta probar |
| H-006 | "Última modificación" con el nombre equivocado | migración `20261030000001` — **falta correrla** |
| H-007 | "Sin equipo asignado" teniendo equipo | `TramiteDetalles.tsx` — falta probar |
| Fecha Promesa | regla nueva de Ricardo: Empleados sí, Agentes nunca | `TramiteDetalle.tsx` — falta probar |

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

### S-002 · Revisión de seguridad pendiente en una edge function — `pospuesto`

Hay una función de SeguWallet que toca cuentas de `auth` y **no verifica quién
la llama**. `auth.users` es compartida con MOVI, así que el alcance no se queda
en SeguWallet.

- **razón del pospuesto**: *"ahorita no quiero tocar nada de seguwallet / sólo MOVI"* (30/10)
- **el detalle, el plan de arreglo y la comprobación NO se escriben aquí**:
  este repo es **público**. Están en la conversación del 30/10
- **de paso**: el botón "resetear contraseña" de SeguWallet Admin nunca
  funcionó — el frontend y la función no usan los mismos nombres de campo

### `update-user-password` — cerrado el 30/10, y **no la llama nadie**

`grep -rn "update-user-password" src/` → **0 resultados**. La función existe,
quedó asegurada, pero ninguna pantalla de MOVI la usa. O sea que el Admin
**no** puede cambiar contraseñas desde la app.
