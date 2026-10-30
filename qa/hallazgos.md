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
| H-003 | 13 botones sin nombre accesible en Trámites (y varios en Dashboard) | Claude, 30/10 | nuevo |
| M11 | Diego no ve la caja de comentarios en trámites de Sistemas que él creó | bots, 22/10 | **bloqueado** — falta la contraseña de DIEGO |

## Cerrados en esta corrida

| # | Qué | Commit |
|---|---|---|
| M9 | el par Lista/Tablero no hacía nada en Concluidos ni en Papelera | `b5f02343` |
| M10 | un corte de red manda a la pantalla de login y borra lo capturado | `b5f02343` |

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

### M9 · El par Lista/Tablero no hace nada fuera de Activos — `arreglado`

- **ruta**: /tramites → pestaña **Concluidos**, y también **Papelera**. Como RICARDO (Admin)
- **esperaba**: que "Vista tablero" cambiara la lista por el Kanban
- **pasó**: el botón se marca de azul y la pantalla queda idéntica. En Papelera, los dos botones no hacen nada
- **se repite**: sí, 2 de 2 del reporte + reproducido en vivo el 30/10
- **la prueba de que el clic SÍ registra**: al volver a Activos el Kanban ya estaba puesto — el estado cambió, la pantalla no
- **causa**: el par se dibujaba siempre, pero el Kanban solo existe con `activeTab === 'activos'`
- **arreglo**: esconder el par fuera de Activos (`Tramites.tsx`). Se descartó hacer Kanban para cerrados: todos caen en una columna y no informa nada
- **capturas**: `qa/capturas/2026-10-30T19-02-31-concluidos-lista.png`, `…19-02-42-concluidos-tras-tablero.png`

### M10 · Un parpadeo de red te manda a la pantalla de login — `arreglado`

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

### M11 · Diego no ve la caja de comentarios — `bloqueado`

- **ruta**: un trámite del área Sistemas creado por DIEGO PRUEBAS (Empleado)
- **esperaba**: poder comentar en su propio trámite
- **pasó**: según el reporte, no aparece la caja
- **se repite**: según el reporte, sí
- **lo revisado en código (30/10)**: la pestaña Comentarios y su `<form>` **no tienen ninguna condición** — se dibujan para cualquiera. Así que el síntoma no puede ser lo que dice: o no podía abrir el trámite, o la barra de pestañas se le salió de la pantalla
- **bloqueo**: hace falta la sesión de DIEGO. Se le pone contraseña desde Supabase → Authentication → Users
