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
| — | _(vacío: la primera corrida es del 30/10)_ | | |

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
