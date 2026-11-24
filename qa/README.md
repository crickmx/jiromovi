# QA con usuarios bot — cómo se maneja desde Claude Code

Los agentes de IA son **usuarios reales de MOVI** con su oficina, su equipo y su
rol. Navegan como personas, no corren un guion. Esta carpeta es lo que hace
falta para manejarlos desde esta máquina.

## Las tres piezas

| | Qué es | Dónde |
|---|---|---|
| **A — exploración** | Claude maneja una ventana de Chrome real, paso a paso, y lee consola, peticiones fallidas y estructura de pantalla | `abrir.cmd` + `conducir.mjs` |
| **B — regresión** | Cada bug confirmado se vuelve una prueba corta que lo reproduce | `tests/` (todavía vacío) |
| **C — registro** | Dónde quedan los hallazgos antes de decidir qué se arregla | `hallazgos.md` |

La pieza A es la que encuentra bugs. **Un guion fijo recorre el camino feliz y
no ve parpadeos, botones muertos ni campos que no se dejan llenar** — eso ya
pasó el 21/10, cuando salieron ocho trámites idénticos. La pieza B solo
protege lo ya arreglado.

## Arrancar

```
cd C:\Users\RICARDO JIMENEZ\Desktop\jiromovi-main\qa
abrir.cmd ricardo
```

Se abre una ventana de Chrome aislada en la pantalla de login. **Inicias sesión
tú, a mano.** La contraseña no pasa por el chat ni queda en ningún archivo que
Claude escriba. La sesión se guarda sola en el perfil y sobrevive a cerrar la
ventana.

Para dos sesiones a la vez (probar tiempo real, o un Gerente y un Empleado
mirando el mismo trámite), puertos distintos:

```
abrir.cmd laura 9222
abrir.cmd diego 9223
```

## Dónde vive cada cosa

| | Dónde | Por qué |
|---|---|---|
| Perfiles con la sesión iniciada | `%LOCALAPPDATA%\movi-qa\perfiles\<perfil>` | **Fuera del repo**: son tokens de Supabase y un `git add .` distraído los publicaría |
| Capturas y reportes | `qa/capturas/` | ignorado por git |
| `node_modules` | `qa/node_modules` | ignorado por git |

**No copiar los perfiles de otra máquina.** Supabase rota los tokens: si dos
equipos usan la misma sesión, cuando uno la renueva el otro se queda con un
token viejo y se cae la sesión en los dos.

## Los cinco usuarios bot, y su puerto fijo

Todos en la oficina **MOVI Digital**, apellido **PRUEBAS**, marcados con
`usuarios.es_bot = true` — por eso no ensucian el tablero del Admin ni le
mandan notificaciones a nadie (21/10).

**Cada quien tiene SIEMPRE el mismo puerto**, para que decir "el 9224" sea
siempre Diego, aquí y en el chat:

| Puerto | Quién | Rol de sistema | Correo | Qué alcanza a ver |
|---|---|---|---|---|
| **9222** | MATEO | Agente | `ccjimenez+agente1@` | solo sus propios trámites |
| **9223** | VALERIA | Agente | `ccjimenez+agente2@` | solo sus propios trámites |
| **9224** | DIEGO | Empleado | `ccjimenez+empleado1@` | lo suyo + lo de sus equipos |
| **9225** | SOFÍA | Empleado | `ccjimenez+empleado2@` | lo suyo + lo de sus equipos |
| **9226** | LAURA | Gerente | `ccjimenez+gerente@` | lo de sus equipos |

Todos los correos son **alias con `+`** de Christofer (`@jiro.com.mx`), así que
**él recibe el correo de los cinco**, incluidos códigos de acceso y avisos de
cambio de contraseña. Tenerlo presente antes de disparar algo que mande correo.

**Ninguno es Administrador**, a propósito: ese rol lo maneja Ricardo.

Para abrir las cinco de un golpe:

```
cd C:\Users\RICARDO JIMENEZ\Desktop\jiromovi-main\qa
abrir-todos.cmd
```

⚠️ **Van de una en una con pausa a propósito.** Lanzar las cinco a la vez **no
funciona**: Chrome se pisa a sí mismo y solo arranca una (probado el 04/11).

### Ponerles contraseña

Desde el SQL Editor de Supabase, las cinco de un golpe. **Comillas simples**:

```sql
update auth.users
set encrypted_password = crypt('LA-QUE-SEA', gen_salt('bf'))
where email in (
  'ccjimenez+agente1@jiro.com.mx',    -- MATEO    (Agente)
  'ccjimenez+agente2@jiro.com.mx',    -- VALERIA  (Agente)
  'ccjimenez+empleado1@jiro.com.mx',  -- DIEGO    (Empleado)
  'ccjimenez+empleado2@jiro.com.mx',  -- SOFÍA    (Empleado)
  'ccjimenez+gerente@jiro.com.mx'     -- LAURA    (Gerente)
);
```

Debe contestar **`UPDATE 5`**. Con comillas dobles sale
`column "..." does not exist`: en Postgres las dobles son nombres de columna.

**La contraseña la escribe Ricardo y no pasa por el chat.** La sesión se guarda
en el perfil y **sobrevive a cerrar Chrome y al fin de semana** — comprobado el
04/11: al reabrir entró directo, sin pedir nada.

## ⚠️ Lo que crean los bots cae en PRODUCCIÓN

Beta y producción comparten la misma base (`qhwvuuyjhcennqccgvse`). Un trámite
de prueba es un trámite real, con folio, en las tablas reales. `es_bot` lo
saca de la vista del Admin y le quita las notificaciones, pero ahí está.

Alcance autorizado por Ricardo el 30/10: **flujo completo, incluido cerrar.**

## conducir.mjs

Se conecta por CDP a la ventana ya abierta y hace lo que se le diga.

```bash
# qué hay en pantalla ahora mismo
node conducir.mjs --resumen

# una secuencia
node conducir.mjs --pasos '[["ir","https://beta.movi.digital/tramites"],["clic","boton=Nuevo Trámite"],["foto"]]'

# contra la segunda ventana
node conducir.mjs --puerto 9223 --resumen
```

**Verbos:** `ir` · `clic` · `escribir` · `elegir` · `tecla` · `esperar` ·
`texto` · `foto`.

**Selectores:** CSS normal, o `boton=Guardar` / `link=Trámites` /
`campo=Descripción` / `texto=Sin responsable` para apuntarle a lo que el
usuario ve.

Un paso que falla **no corta la corrida**: que un botón no responda es
justamente un hallazgo, y lo que pasa después del intento importa.

El reporte sale compacto a propósito. Un screenshot en base64 no cabe en una
conversación, y para decidir el siguiente clic hace falta la estructura de la
pantalla, no su imagen — la foto se guarda en disco y se mira cuando algo no
cuadra.
