# Plan de trabajo en equipo y módulo de automatización

**Para quién es este documento:** Cualquier persona del equipo JIRO que vaya a colaborar
en el proyecto MOVI, aunque no sea desarrollador de software.

**Tiempo estimado de lectura:** 15 minutos

---

## Parte 1 — Trabajar en equipo en MOVI sin pisarse

### ¿Cuál es el problema actual?

El código de MOVI vive en GitHub (una plataforma que guarda versiones del código,
como un historial de cambios). Dentro de GitHub, el código puede tener "ramas" —
imagínalas como copias paralelas del mismo proyecto donde cada persona hace sus cambios
sin afectar a los demás.

Hoy existen dos ramas activas:

| Rama | ¿Quién trabaja ahí? | ¿Qué contiene? |
|------|---------------------|----------------|
| `produccion` | Tú (Ricardo) | Trámites, equipos, auto-asignación, notificaciones, RLS |
| `main` | El otro miembro del equipo | Directorio, Perfil, Tienda, CentroDigital, Login |

El riesgo es que si alguien toma la rama equivocada como base, puede perder cambios
del otro. También hay un riesgo especial con la base de datos (explicado más abajo).

---

### Concepto clave: Las migraciones de Supabase

Cada vez que se modifica algo en la base de datos (una tabla nueva, una columna nueva,
una regla de seguridad), eso se guarda como un archivo de "migración" dentro del
proyecto en la carpeta `supabase/migrations/`.

Estos archivos son como instrucciones ordenadas que le dicen a Supabase:
*"Primero haz esto, luego esto otro, luego esto otro."*

**La rama `produccion` tiene ~15 migraciones que `main` NO tiene.**

Si alguien en el equipo trabaja desde `main` y hace un despliegue sin esas migraciones,
la base de datos quedaría desincronizada con el código y la plataforma dejaría de funcionar.

**Regla de oro: Las migraciones de `produccion` nunca deben perderse al hacer un merge.**

---

### ¿Qué es un "merge"?

Un merge es cuando combinas dos ramas en una sola. Git (el sistema de versiones)
intenta fusionar los cambios automáticamente. Cuando dos personas cambiaron el
mismo archivo, Git avisa que hay un "conflicto" y alguien tiene que decidir
manualmente cuál versión queda.

En el caso de MOVI, como cada quien trabaja en áreas distintas, los conflictos
esperados son pocos: solo `App.tsx` (el archivo que conecta todas las páginas)
y posiblemente `package.json` (la lista de herramientas que usa el proyecto).

---

### Plan de trabajo recomendado (sin merge aún)

Mientras los dos miembros del equipo siguen trabajando en paralelo, seguir estas reglas:

**Regla 1 — Cada quien trabaja en su propia rama**

No trabajar directamente en `main` ni en `produccion`.
Cada nueva funcionalidad o corrección va en una rama propia:

```
Ricardo trabajando en notificaciones:
  → Crear rama: feature/mejora-notificaciones
  → Hacer cambios ahí
  → Cuando esté listo, hacer merge a produccion

El otro miembro trabajando en el Directorio:
  → Crear rama: feature/nuevo-directorio
  → Hacer cambios ahí
  → Cuando esté listo, hacer merge a main
```

Esto evita que los commits de uno bloqueen o confundan al otro.

**Regla 2 — Nunca perder las migraciones**

Cuando se haga el merge final, la persona que lo ejecute debe verificar
que todos los archivos de `supabase/migrations/` de `produccion` estén
presentes en la rama final.

**Regla 3 — Comunicar antes de hacer el merge final**

El merge final (unir `main` y `produccion`) debe hacerse en un momento
en que ambos miembros del equipo estén disponibles para probar
que todo funciona después.

---

### Cómo hacer el merge final (cuando estén listos)

Este proceso lo puede ejecutar Claude Code contigo, paso a paso.

**¿Qué hace este proceso?**
Crea una copia temporal que contiene los cambios de ambas ramas,
resuelve los conflictos puntuales, y esa copia se convierte en la nueva
versión oficial de todos.

**Pasos resumidos:**

1. **Crear una rama de integración**
   - Se crea una nueva rama llamada `integracion` (o similar)
   - Esta rama parte de `main` (la rama del otro miembro)
   - Ejemplo: `git checkout -b integracion origin/main`

2. **Traer los cambios de `produccion`**
   - Se hace un merge de `produccion` hacia `integracion`
   - Git muestra automáticamente si hay conflictos
   - Ejemplo: `git merge origin/produccion`

3. **Resolver conflictos (si los hay)**
   - En MOVI, los conflictos esperados son solo en `App.tsx` y `package.json`
   - Claude Code los revisa y propone la solución correcta
   - Tú apruebas cada decisión

4. **Probar que todo funciona**
   - Se hace un build de prueba
   - Ambos miembros del equipo revisan sus respectivas funcionalidades
   - Si algo falla, se corrige antes de continuar

5. **Reemplazar `produccion` con `integracion`**
   - Una vez probado, `integracion` se convierte en la nueva `produccion`
   - El servidor se actualiza desde esa rama
   - `main` también recibe los cambios para que el otro miembro esté al día

**Tiempo estimado:** 1–2 horas, incluyendo pruebas

---

### Esquema visual del proceso

```
ANTES:
  main       →  Login, Directorio, Perfil, Tienda, CentroDigital
  produccion →  Trámites, Equipos, Auto-asignación, Notificaciones, RLS

DURANTE EL MERGE:
  integracion  ←  main + produccion (conflictos resueltos)

DESPUÉS:
  produccion  →  TODO junto (versión unificada)
  main        →  TODO junto (ambos sincronizados)
```

---

### ¿Qué NO se debe hacer?

- ❌ No hacer `git push --force` en `main` ni en `produccion` — borra el trabajo del otro
- ❌ No aplicar migraciones de Supabase en el servidor de producción sin haberlas probado antes
- ❌ No hacer el merge final un viernes o en horario pico — hay que tener tiempo para corregir si algo falla
- ❌ No empezar trabajo nuevo durante el merge — congela los cambios mientras se integra

---

## Parte 2 — Módulo de automatización de WhatsApp

### ¿Qué es el módulo de automatización hoy?

Dentro del Centro de Contacto de MOVI, la sección de WhatsApp tiene una función
de "Modo Automático". Cuando se activa, un asistente de inteligencia artificial
puede responder mensajes, capturar datos de un cliente y eventualmente crear un
trámite automáticamente.

Hoy ese módulo está construido de forma entrelazada con el resto del Centro de
Contacto — es decir, su código está mezclado con el código del chat, del historial
de mensajes, del compositor de respuestas, etc.

Esto significa que:
- Si alguien quiere mejorar o rediseñar la automatización, puede romper el chat
- No se puede dejar que un desarrollador externo trabaje en eso sin darle acceso a todo
- Cada vez que se corrige un bug en el chat, hay que revisar también si afectó la automatización

---

### La solución: separar el módulo

La idea es convertir la automatización en una "caja negra" independiente.

Una caja negra es un componente que:
- Recibe información de MOVI (la conversación activa, el usuario, etc.)
- Hace lo que tiene que hacer (automatizar, capturar datos, responder)
- Le avisa a MOVI cuando termina o cuando necesita que MOVI haga algo (enviar un mensaje, crear un trámite)

MOVI no necesita saber cómo funciona la caja por dentro. Solo necesita saber:
- Qué información darle
- Qué esperar que devuelva

Y el desarrollador externo no necesita entender todo MOVI. Solo necesita saber:
- Qué información va a recibir
- Qué funciones puede llamar para comunicarse con MOVI

---

### Cómo se implementa técnicamente

**Paso 1 — Crear la carpeta aislada del módulo**

Se crea una carpeta específica dentro del proyecto:

```
src/modules/automation/
  ├── index.ts             ← Punto de entrada. Lo que MOVI importa.
  ├── types.ts             ← El "contrato": qué recibe y qué devuelve el módulo
  ├── AutomationPanel.tsx  ← El componente visual principal
  ├── hooks/               ← Lógica interna del módulo
  └── components/          ← Partes visuales internas
```

Todo lo que hace la automatización vive dentro de esa carpeta.
**Nadie fuera de esa carpeta necesita saber qué hay adentro.**

**¿Qué hace este paso?**
Poner límites claros. Si el desarrollador externo solo tiene permiso para tocar
`src/modules/automation/`, no puede romper accidentalmente el chat, los trámites
o cualquier otra parte de MOVI.

---

**Paso 2 — Definir el contrato**

El archivo `types.ts` define exactamente qué información intercambian MOVI y el módulo.
Es como firmar un contrato antes de empezar a trabajar.

Ejemplo simplificado de lo que incluye ese contrato:

```
Lo que MOVI le da al módulo:
  - La conversación activa (quién es el contacto, su teléfono, el historial)
  - El ID del usuario que está operando MOVI en ese momento
  - Una función para enviar mensajes de WhatsApp
  - Una función para crear un trámite
  - Una función para avisarle a MOVI que la automatización terminó

Lo que el módulo le da a MOVI:
  - Un componente visual que se muestra cuando la automatización está activa
  - Una función para iniciar una sesión de automatización
  - Una función para detenerla
```

**¿Qué hace este paso?**
Evitar sorpresas. Si el contrato dice que el módulo recibe "el historial de mensajes"
y lo devuelve de cierta forma, tanto MOVI como el módulo saben exactamente qué esperar.
Si algo no coincide, TypeScript (el lenguaje de programación) avisa antes de que llegue
a producción.

---

**Paso 3 — Crear un placeholder temporal**

Mientras el desarrollador externo trabaja en el nuevo módulo, MOVI sigue funcionando
con un placeholder — un componente vacío que ocupa el lugar del módulo real pero no
hace nada todavía.

Esto es como dejar el espacio reservado en una pared para una pantalla que aún no llega.
La habitación funciona, solo falta la pantalla.

El placeholder muestra algo como:
```
[ Módulo de automatización en desarrollo — disponible próximamente ]
```

**¿Qué hace este paso?**
Permite que el trabajo de rediseño del módulo se haga sin interrumpir a los demás
ni bloquear los deploys del proyecto.

---

**Paso 4 — El desarrollador externo trabaja en su rama**

El desarrollador externo recibe acceso al repositorio de GitHub con permiso
para crear ramas y hacer cambios solo en `src/modules/automation/`.

Su flujo de trabajo:
1. Hace una copia de la rama `produccion` (o `main` unificada) como base
2. Trabaja en su propia rama: por ejemplo `feature/automation-v2`
3. Prueba su módulo cargando MOVI localmente
4. Cuando está listo, abre un "Pull Request" — una solicitud de revisión

Un Pull Request es como enviar un documento para aprobación antes de que se publique.
Tú o Claude Code revisan qué cambios propone, y si están bien, se aprueba y se fusiona.

**¿Qué hace este paso?**
Da autonomía al desarrollador externo sin arriesgar el código de producción.
Todo lo que proponga pasa por una revisión antes de llegar a los usuarios.

---

**Paso 5 — Integración en MOVI**

Cuando el nuevo módulo esté aprobado, integrarlo en MOVI requiere cambiar
**exactamente dos líneas** en el código:

```typescript
// Antes (usando el placeholder):
import { AutomationPanel } from '../modules/automation/placeholder';

// Después (usando el módulo real):
import { AutomationPanel } from '../modules/automation';
```

Eso es todo. El resto de MOVI no sabe ni nota la diferencia — sigue hablándole
a la misma "caja negra", solo que ahora la caja tiene el contenido real.

**¿Qué hace este paso?**
Integrar meses de trabajo externo en producción con un riesgo mínimo y de forma
reversible — si algo falla, se puede regresar al placeholder en segundos.

---

### Esquema visual del resultado final

```
MOVI (Centro de Contacto — WhatsApp)
│
├── Chat y historial de mensajes  ← trabaja el equipo JIRO
├── Crear/agregar trámite         ← trabaja el equipo JIRO
├── Plantillas y formularios      ← trabaja el equipo JIRO
│
└── [ Módulo de Automatización ]  ← trabaja el desarrollador externo
      │
      ├── Recibe: conversación activa, funciones de MOVI
      ├── Hace:   flujos IA, formularios inteligentes, captura de datos
      └── Devuelve: mensajes para enviar, datos para crear trámites
```

---

### Ventajas de esta arquitectura

| Situación | Sin la separación | Con la separación |
|-----------|-------------------|-------------------|
| El dev externo rompe algo | Puede afectar todo MOVI | Solo afecta su carpeta |
| Hay un bug en el chat | Puede afectar la automatización | Son independientes |
| Se quiere cambiar el proveedor de IA | Cirugía mayor en el código | Se reescribe solo la carpeta |
| Alguien quiere entender el módulo | Tiene que leer 3,000 líneas | Lee solo la carpeta aislada |
| Se quiere revertir un cambio | Difícil deshacer | Se regresa al placeholder en segundos |

---

### Resumen de pasos para implementar la separación

| Paso | ¿Quién lo hace? | ¿Cuándo? | Tiempo estimado |
|------|-----------------|----------|-----------------|
| 1. Crear la carpeta y el contrato | Claude Code + Ricardo | Antes de contactar al dev externo | 2–3 horas |
| 2. Crear el placeholder | Claude Code | Mismo día que el paso 1 | 1 hora |
| 3. Reemplazar el código actual de automatización con el placeholder | Claude Code + Ricardo | Una vez que el contrato esté definido | 2–3 horas |
| 4. El dev externo trabaja en el módulo nuevo | Desarrollador externo | En paralelo, sin bloquear a nadie | Semanas |
| 5. Revisión y aprobación del Pull Request | Claude Code + Ricardo | Cuando el dev diga que está listo | 2–4 horas |
| 6. Integrar el módulo real | Claude Code | Inmediatamente después de la aprobación | 30 minutos |

---

### ¿Qué información necesita el desarrollador externo?

Para que pueda trabajar de forma autónoma, hay que darle:

- **Acceso al repositorio de GitHub** (con permiso de solo lectura en `main`, lectura y escritura en su propia rama)
- **El archivo `types.ts` con el contrato** (lo genera Claude Code en el Paso 1)
- **Credenciales de un ambiente de prueba** (no el de producción — un Supabase de desarrollo separado)
- **Documentación de las edge functions** que puede llamar (qué funciones existen, qué parámetros reciben)

Lo que NO necesita:
- Acceso a producción
- Entender el resto del código de MOVI
- Credenciales de los servidores de Plesk

---

## Resumen ejecutivo

**Para trabajar en equipo sin conflictos:**
1. Cada quien trabaja en su propia rama (no directamente en `main` o `produccion`)
2. Las migraciones de Supabase de `produccion` nunca deben perderse
3. El merge final se hace en un momento tranquilo, con Claude Code guiando el proceso
4. Tiempo estimado: 1–2 horas cuando ambos estén disponibles

**Para el módulo de automatización:**
1. Claude Code prepara la carpeta aislada y el contrato (Pasos 1–3)
2. El desarrollador externo trabaja de forma independiente (Paso 4)
3. Una revisión y dos líneas de código lo integran a producción (Pasos 5–6)
4. Si algo falla, se revierte en segundos sin afectar nada más

---

*Documento generado el 2026-06-23*
