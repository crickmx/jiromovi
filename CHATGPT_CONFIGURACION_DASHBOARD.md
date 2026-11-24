# Configuración de ChatGPT para Mensajes Automáticos del Dashboard

## Resumen

El sistema genera mensajes de bienvenida personalizados en el Dashboard usando **ChatGPT (GPT-4o-mini)** con información en tiempo real del usuario.

---

## Arquitectura del Sistema

### 1. **Flujo de Generación**

```
Dashboard.tsx
    ↓
getUserWelcomeContext(userId)  →  Recopila datos del usuario
    ↓
generateWelcomeMessage(context) → Llama a Edge Function
    ↓
Edge Function: generate-welcome-message
    ↓
OpenAI API (GPT-4o-mini)
    ↓
Mensaje personalizado generado
    ↓
Mostrado en Dashboard
```

---

## Módulos Principales

### 📁 `src/lib/dashboardWelcomeService.ts`

**Funciones:**

#### 1. `getUserWelcomeContext(userId: string)`

**Qué hace:**
- Recopila información en tiempo real del usuario desde la base de datos
- Ejecuta múltiples consultas en paralelo para máxima eficiencia
- Retorna un objeto con todos los datos relevantes del usuario

**Datos que recopila:**

```typescript
interface UserWelcomeContext {
  // Información básica
  nombre: string;                           // Nombre completo
  rol: string;                              // Rol: Agente, Gerente, Admin, etc.
  oficina?: string;                         // Nombre de la oficina
  ultimo_acceso?: string;                   // Última vez que accedió

  // Producción
  produccion_mes_actual?: number;           // Prima ponderada del mes actual
  produccion_mes_anterior?: number;         // Prima ponderada del mes anterior
  posicion_nacional?: number;               // Ranking nacional (futuro)
  posicion_oficina?: number;                // Ranking en oficina (futuro)

  // CRM y Tareas
  tareas_pendientes?: number;               // Cantidad de tareas pendientes
  tareas_vencidas?: number;                 // Tareas que ya vencieron
  cotizaciones_activas?: number;            // Cotizaciones en proceso
  crm_contactos_sin_seguimiento?: number;   // Contactos sin actualizar >30 días

  // Eventos
  eventos_proximos?: number;                // Eventos en los próximos 7 días

  // Comisiones
  comisiones_mes_actual?: number;           // Comisiones del mes actual
  comisiones_mes_anterior?: number;         // Comisiones del mes anterior

  // 🎮 Gamificación (Sistema Mi Progreso)
  nivel_actual?: number;                    // Nivel del agente (1-50)
  xp_actual?: number;                       // Puntos de experiencia actuales
  xp_para_siguiente_nivel?: number;         // XP que falta para subir de nivel
  jiro_coins?: number;                      // Moneda virtual del sistema
  posicion_ranking?: number;                // Posición en ranking nacional
  logros_recientes?: number;                // Logros obtenidos últimos 7 días
  dias_racha?: number;                      // Días consecutivos activo

  // 📚 Seguros Education
  cursos_en_progreso?: number;              // Cursos iniciados pero no terminados
  cursos_completados?: number;              // Cursos completados totales
  horas_capacitacion_mes?: number;          // Horas estudiadas este mes
  proximas_sesiones_live?: number;          // Sesiones live próximos 7 días
  cursos_nuevos_disponibles?: number;       // Cursos nuevos últimos 30 días
  ultimo_curso_completado?: string;         // Título del último curso completado

  // 📢 Comunicados
  comunicados_sin_leer?: number;            // Comunicados publicados sin leer
  ultimo_comunicado_titulo?: string;        // Título del último comunicado
  ultimo_comunicado_fecha?: string;         // Fecha del último comunicado

  // 📋 Sistema general
  tramites_pendientes_atencion?: number;    // Trámites asignados abiertos/en proceso
  documentos_por_revisar?: number;          // Docs del Centro Digital (admin/gerente)
  reservas_proximas?: number;               // Reservas de espacios próximos 7 días
}
```

**Consultas que ejecuta:**

1. **Información del Usuario**
   ```sql
   SELECT nombre_completo, rol, updated_at, oficina_id, oficinas(nombre)
   FROM usuarios
   WHERE id = userId
   ```

2. **Producción** (desde `production_records` y `production_vendors_cache`)
   - Obtiene nombres de vendedor mapeados al usuario
   - Suma prima ponderada del mes actual y anterior
   - Filtra por mes y año

3. **Tareas CRM** (desde `crm_tareas` y `crm_contactos`)
   - Cuenta tareas pendientes y vencidas
   - Identifica contactos sin seguimiento reciente (>30 días)

4. **Cotizaciones** (desde `crm_cotizaciones`)
   - Cuenta cotizaciones con estatus "activa"

5. **Eventos** (desde `aula_eventos`)
   - Cuenta eventos próximos (hoy hasta +7 días)

6. **Comisiones** (desde `commission_batches` y `commission_details`)
   - Suma comisiones del mes actual y anterior
   - Filtra por rangos de fechas

7. **Gamificación** (desde `agent_gamification_profile` y `agent_gamification_events`)
   - Perfil completo: nivel, XP, Jiro Coins, racha de días
   - Posición en ranking nacional (top 100)
   - Logros recientes (últimos 7 días)

8. **Seguros Education** (desde `seguros_lessons`, `seguros_progress`, `seguros_sessions`)
   - Cursos en progreso y completados
   - Horas de capacitación del mes actual
   - Sesiones live programadas (próximos 7 días)
   - Cursos nuevos disponibles (últimos 30 días no vistos)
   - Último curso completado

9. **Comunicados** (desde `comunicados`, `comunicados_visibilidad`, `comunicados_lecturas`)
   - Comunicados publicados relevantes para el usuario
   - Comunicados sin leer (filtra por lectura)
   - Último comunicado con título y fecha

10. **Trámites** (desde `tickets` y `centro_digital_archivos`)
    - Trámites asignados pendientes o en proceso
    - Documentos recientes por revisar (solo admin/gerente, últimos 7 días)

11. **Reservas** (desde `reservas_espacio`)
    - Reservas confirmadas o pendientes (próximos 7 días)

**Manejo de errores:**
- Usa `Promise.allSettled()` para ejecutar consultas en paralelo
- Si una consulta falla, continúa con las demás
- Retorna solo los datos que estén disponibles

---

#### 2. `generateWelcomeMessage(context: UserWelcomeContext)`

**Qué hace:**
- Envía el contexto del usuario a la Edge Function
- Llama a OpenAI para generar un mensaje personalizado
- Retorna el mensaje generado o un mensaje de fallback

**Parámetros de la petición:**

```typescript
{
  context: UserWelcomeContext,     // Contexto limpio (sin valores null/undefined)
  force_regenerate: boolean,        // Forzar nueva generación
  timestamp: number                 // Timestamp para variación
}
```

**Mensaje de Fallback:**

Si falla la generación con IA, retorna mensajes predefinidos:

```typescript
// Con tareas pendientes
"Hola Juan, tienes 5 tareas pendientes. Vale la pena revisarlas para mantener el ritmo."

// Con cotizaciones activas
"Hola María, llevas 3 cotizaciones activas. Darle seguimiento puede marcar la diferencia."

// Mensajes genéricos aleatorios
"Hola Carlos, todo listo para arrancar. Tu espacio de trabajo está esperándote."
"Hola Laura, bienvenido de vuelta. Las herramientas que necesitas están a tu alcance."
```

---

### 📁 `supabase/functions/generate-welcome-message/index.ts`

**Edge Function que genera el mensaje usando OpenAI**

#### Variables de Entorno Requeridas:

```bash
OPENAI_API_KEY=sk-...        # API Key de OpenAI (REQUERIDA)
SUPABASE_URL=...             # URL de Supabase (auto-configurada)
SUPABASE_SERVICE_ROLE_KEY=...# Service Role Key (auto-configurada)
```

#### Configuración de OpenAI:

```typescript
{
  model: 'gpt-4o-mini',        // Modelo: GPT-4o-mini (rápido y económico)
  temperature: 0.9,            // Alta variación (0.0 = determinístico, 1.0 = creativo)
  max_tokens: 150,             // Máximo 150 tokens (~35-65 palabras)
}
```

#### System Prompt (Instrucciones para ChatGPT):

```
Eres un colega amigable que saluda al usuario de MOVI Digital al iniciar su día de trabajo.

REGLAS ESTRICTAS:
1. SIEMPRE empieza con "Hola [nombre]" usando el primer nombre
2. Máximo 2-3 renglones (35-65 palabras total)
3. Tono conversacional y cercano
4. NO uses emojis
5. NO uses signos de exclamación excesivos (máximo uno)
6. NO hagas preguntas directas al usuario
7. NUNCA inventes datos que no estén en el contexto
8. Habla en segunda persona (tienes, llevas, puedes)
9. Si mencionas números, hazlo de forma natural

TIPOS DE MENSAJES:
- Reconocimiento de logros o progreso
- Recordatorio amable de pendientes importantes
- Motivación basada en datos reales
- Resumen útil del estado actual
- Observación positiva sobre tendencias

EJEMPLOS DEL TONO DESEADO:
"Hola María, llevas un mes sólido con $125,000 en producción. Revisar esas 3 cotizaciones
pendientes podría darte un cierre fuerte."

"Hola Carlos, buen trabajo manteniendo el ritmo. Tienes 2 tareas vencidas que vale la pena
atender hoy para no perder momentum."
```

#### User Prompt (Petición específica):

```
Genera un mensaje de bienvenida personalizado para este usuario.

Contexto del usuario:
{
  "nombre": "Juan Pérez",
  "rol": "Agente",
  "oficina": "CDMX Centro",
  "produccion_mes_actual": 125000,
  "produccion_mes_anterior": 98000,
  "tareas_pendientes": 5,
  "tareas_vencidas": 2,
  "cotizaciones_activas": 3,
  "comisiones_mes_actual": 15000
}

Variación temporal: abc123 - 2026-03-31T10:30:00Z

Genera SOLO el mensaje, sin explicaciones adicionales.
```

---

### 📁 `src/pages/Dashboard.tsx`

**Dónde se usa:**

```typescript
// Línea 21: Importación
import { getUserWelcomeContext, generateWelcomeMessage } from '../lib/dashboardWelcomeService';

// Línea 42: Estado
const [welcomeMessage, setWelcomeMessage] = useState<string>('');
const [loadingWelcomeMessage, setLoadingWelcomeMessage] = useState(true);

// Línea 92: Se carga en paralelo al inicializar dashboard
loadWelcomeMessage(currentUser.id);

// Líneas 116-136: Función que ejecuta el proceso
const loadWelcomeMessage = async (userId: string) => {
  try {
    setLoadingWelcomeMessage(true);

    // 1. Recopilar contexto
    const context = await getUserWelcomeContext(userId);

    // 2. Generar mensaje
    const message = await generateWelcomeMessage(context);

    // 3. Mostrar mensaje
    setWelcomeMessage(message);
  } catch (error) {
    console.error('Error:', error);
    setWelcomeMessage('Bienvenido a tu plataforma digital.');
  } finally {
    setLoadingWelcomeMessage(false);
  }
};
```

**Visualización en UI:**

```typescript
// En el componente visual del dashboard
{loadingWelcomeMessage ? (
  <div className="animate-pulse">
    <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
  </div>
) : (
  <p className="text-xl text-gray-700 leading-relaxed">
    {welcomeMessage}
  </p>
)}
```

---

## Ejemplos de Mensajes Generados

### Ejemplo 1: Agente con comunicados sin leer

**Contexto:**
```json
{
  "nombre": "María González",
  "rol": "Agente",
  "comunicados_sin_leer": 3,
  "ultimo_comunicado_titulo": "Nuevas tarifas GMM 2026",
  "produccion_mes_actual": 156000,
  "cotizaciones_activas": 5
}
```

**Mensaje generado:**
> "Hola María, tienes 3 comunicados sin leer, incluyendo 'Nuevas tarifas GMM 2026'. Vale la pena revisarlos antes de atender tus 5 cotizaciones activas."

---

### Ejemplo 2: Agente con progreso en gamificación

**Contexto:**
```json
{
  "nombre": "Carlos Ramírez",
  "rol": "Agente",
  "nivel_actual": 8,
  "xp_actual": 4200,
  "xp_para_siguiente_nivel": 300,
  "dias_racha": 12,
  "posicion_ranking": 5,
  "cursos_nuevos_disponibles": 2
}
```

**Mensaje generado:**
> "Hola Carlos, estás en nivel 8 con racha de 12 días y en el puesto 5 del ranking. Tienes 2 cursos nuevos que podrían darte el XP que necesitas para subir de nivel."

---

### Ejemplo 3: Agente con cursos completados

**Contexto:**
```json
{
  "nombre": "Laura Martínez",
  "rol": "Agente",
  "cursos_completados": 12,
  "horas_capacitacion_mes": 8.5,
  "ultimo_curso_completado": "Vida y GMM Intermedio",
  "proximas_sesiones_live": 1
}
```

**Mensaje generado:**
> "Hola Laura, completaste 'Vida y GMM Intermedio' y llevas 8.5 horas de capacitación este mes. Tienes una sesión live mañana que complementaría bien tu aprendizaje."

---

### Ejemplo 4: Agente con sesiones live próximas

**Contexto:**
```json
{
  "nombre": "Roberto Silva",
  "rol": "Agente",
  "proximas_sesiones_live": 2,
  "cursos_nuevos_disponibles": 5,
  "nivel_actual": 3,
  "tareas_pendientes": 2
}
```

**Mensaje generado:**
> "Hola Roberto, hay 2 sesiones live esta semana y 5 cursos nuevos disponibles. Participar en ellas te dará XP para subir de nivel y conocimientos prácticos."

---

### Ejemplo 5: Gerente con visión general

**Contexto:**
```json
{
  "nombre": "Ana Pérez",
  "rol": "Gerente",
  "oficina": "Monterrey Norte",
  "produccion_mes_actual": 450000,
  "documentos_por_revisar": 8,
  "tramites_pendientes_atencion": 3,
  "comunicados_sin_leer": 1
}
```

**Mensaje generado:**
> "Hola Ana, tu oficina lleva $450,000 este mes. Hay 8 documentos recientes por revisar y 3 trámites pendientes que necesitan tu atención."

---

### Ejemplo 6: Usuario con logros recientes

**Contexto:**
```json
{
  "nombre": "Diego Torres",
  "rol": "Agente",
  "nivel_actual": 10,
  "jiro_coins": 2500,
  "logros_recientes": 5,
  "produccion_mes_actual": 185000,
  "produccion_mes_anterior": 145000
}
```

**Mensaje generado:**
> "Hola Diego, subiste a nivel 10 con 5 logros esta semana. Tu producción de $185,000 creció 27% vs mes pasado, ese momentum vale oro."

---

### Ejemplo 7: Usuario con trámites y reservas

**Contexto:**
```json
{
  "nombre": "Sofía Hernández",
  "rol": "Agente",
  "tramites_pendientes_atencion": 4,
  "reservas_proximas": 2,
  "tareas_vencidas": 2,
  "cursos_en_progreso": 1
}
```

**Mensaje generado:**
> "Hola Sofía, tienes 4 trámites pendientes y 2 tareas vencidas. Cerrarlos antes de tus 2 reservas de esta semana te dejaría con buen ritmo."

---

### Ejemplo 8: Usuario nuevo sin datos

**Contexto:**
```json
{
  "nombre": "Miguel López",
  "rol": "Agente"
}
```

**Mensaje generado:**
> "Hola Miguel, bienvenido. Tu plataforma está lista para empezar a construir tu producción, seguimiento de clientes y desarrollo profesional."

---

## Ventajas del Sistema

### 1. **Personalización Real**
- Usa datos actuales del usuario, no plantillas genéricas
- Cada mensaje es único y relevante

### 2. **Motivación Contextual**
- Reconoce logros específicos
- Señala áreas de mejora con tacto
- Mantiene al usuario informado de su estado

### 3. **Variación Natural**
- `temperature: 0.9` genera mensajes diferentes cada vez
- Timestamp y seed aleatorio evitan repetición
- Nunca dos mensajes iguales aunque el contexto sea similar

### 4. **Performance Optimizado**
- Consultas en paralelo con `Promise.allSettled()`
- Carga asíncrona no bloquea el dashboard
- Fallback inmediato si falla OpenAI

### 5. **Costo Eficiente**
- Modelo GPT-4o-mini (más económico que GPT-4)
- Max 150 tokens por mensaje (~$0.0001 por generación)
- Se genera solo al cargar dashboard (no en cada acción)

---

## Monitoreo y Logs

### En Desarrollo (Browser Console):

```
🚀 Iniciando carga de mensaje de bienvenida...
📊 Recopilando contexto para usuario: abc-123
👤 Usuario encontrado: María González - Agente
✅ Contexto recopilado: { nombre: "María González", tareas_pendientes: 5, ... }
📦 Contexto obtenido, generando mensaje...
📍 API URL: https://xxx.supabase.co/functions/v1/generate-welcome-message
🔑 Enviando petición a Edge Function...
📡 Response status: 200 (1234ms)
✅ Mensaje generado exitosamente
📝 Mensaje: "Hola María, llevas un mes sólido..."
🏁 Carga de mensaje finalizada
```

### En Edge Function (Supabase Logs):

```
=== GENERATE WELCOME MESSAGE START ===
User authenticated: abc-123
Context received:
- Keys: nombre, rol, produccion_mes_actual, tareas_pendientes
- Nombre: María González
- Rol: Agente
Calling OpenAI API...
OpenAI Response: 200 (856ms)
Welcome message generated successfully
Message length: 127
=== GENERATE WELCOME MESSAGE END ===
```

---

## Configuración Requerida

### 1. Variables de Entorno en Supabase

En el Dashboard de Supabase → Settings → Edge Functions → Environment Variables:

```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **CRÍTICO:** Sin esta variable, el sistema usará mensajes de fallback predefinidos.

### 2. API Key de OpenAI

1. Ir a https://platform.openai.com/api-keys
2. Crear una nueva API key
3. Copiar y pegar en Supabase
4. Configurar límites de uso (recomendado: $10/mes)

### 3. Tablas de Base de Datos Requeridas

El sistema consulta estas tablas:
- `usuarios` (información básica)
- `oficinas` (nombre de oficina)
- `production_records` (producción)
- `production_vendors_cache` (mapeo de vendedores)
- `crm_tareas` (tareas pendientes/vencidas)
- `crm_contactos` (seguimiento de contactos)
- `crm_cotizaciones` (cotizaciones activas)
- `aula_eventos` (eventos próximos)
- `commission_batches` y `commission_details` (comisiones)

---

## Troubleshooting

### Problema: "OPENAI_API_KEY not configured"

**Causa:** Variable de entorno no configurada en Supabase

**Solución:**
1. Ir a Supabase Dashboard → Settings → Edge Functions
2. Agregar `OPENAI_API_KEY` con tu API key de OpenAI
3. Redesplegar la Edge Function (se hace automáticamente)

---

### Problema: Mensaje siempre usa fallback

**Causa:** Error al llamar a OpenAI o respuesta vacía

**Solución:**
1. Verificar logs en Supabase Dashboard → Edge Functions → Logs
2. Verificar que la API key sea válida
3. Verificar saldo en cuenta de OpenAI
4. Revisar límites de rate limiting

---

### Problema: Mensaje repetitivo

**Causa:** Temperature muy bajo o caché de OpenAI

**Solución:**
- Ya está configurado con `temperature: 0.9` (alta variación)
- El timestamp y seed aseguran variación
- Si persiste, aumentar temperature a 1.0 en la Edge Function

---

### Problema: Datos incorrectos en el mensaje

**Causa:** Consultas a base de datos retornando información errónea

**Solución:**
1. Verificar mapeo de vendedores en `production_vendors_cache`
2. Verificar que las fechas de comisiones estén correctas
3. Revisar logs de `getUserWelcomeContext()` en browser console

---

## Prioridades de Información en los Mensajes

ChatGPT utiliza estas prioridades al generar mensajes (de mayor a menor importancia):

### 1. Comunicados sin leer (MÁXIMA PRIORIDAD)
- Si hay comunicados sin leer, siempre se mencionan
- Se incluye el título del último comunicado
- Motivar al usuario a revisarlos

**Ejemplo:**
> "Hola María, tienes 3 comunicados sin leer, incluyendo 'Nuevas tarifas GMM 2026'."

---

### 2. Cursos nuevos y sesiones live próximas
- Cursos publicados en los últimos 30 días
- Sesiones live en los próximos 7 días
- Motivar la participación y aprendizaje continuo

**Ejemplo:**
> "Hola Carlos, hay 2 sesiones live esta semana y 5 cursos nuevos disponibles."

---

### 3. Gamificación (logros y progreso)
- Niveles recientes alcanzados
- Posición destacada en ranking (top 10)
- Racha de días activos (>7 días)
- Reconocimiento de logros

**Ejemplo:**
> "Hola Laura, subiste a nivel 10 y estás en racha de 15 días. Vas en el puesto 5 del ranking."

---

### 4. Tareas vencidas y trámites urgentes
- Tareas con fecha de vencimiento pasada
- Trámites abiertos o en proceso
- Recordatorio amable para atenderlos

**Ejemplo:**
> "Hola Roberto, tienes 4 trámites pendientes y 2 tareas vencidas que vale la pena atender."

---

### 5. Producción y comisiones destacables
- Crecimientos significativos (>15%)
- Metas alcanzadas o cerca de alcanzarse
- Comparaciones mes actual vs anterior

**Ejemplo:**
> "Hola Ana, tu producción de $185,000 creció 27% vs mes pasado."

---

### 6. Progreso en capacitación
- Cursos completados recientemente
- Horas de capacitación acumuladas
- Felicitación por compromiso con el desarrollo

**Ejemplo:**
> "Hola Diego, completaste 'GMM Intermedio' y llevas 8.5 horas de capacitación este mes."

---

## Mejoras Futuras Sugeridas

- [ ] Caché de mensajes generados (evitar regenerar cada vez)
- [ ] A/B testing de diferentes estilos de mensajes
- [ ] Analytics de qué mensajes generan más engagement
- [ ] Soporte para múltiples idiomas
- [ ] Mensajes contextuales según hora del día
- [ ] Integración con notificaciones importantes del sistema
- [ ] Sugerencias de acciones basadas en datos
- [ ] Detección de patrones (ej: productividad baja, falta de capacitación)

---

## Costos Estimados

### GPT-4o-mini Pricing (OpenAI):

- **Input:** $0.150 por 1M tokens
- **Output:** $0.600 por 1M tokens

### Cálculo por mensaje:

- Input: ~500 tokens (system prompt + context)
- Output: ~50 tokens (mensaje generado)
- **Costo por mensaje:** ~$0.00013 USD

### Proyección mensual (1000 usuarios):

- 1000 usuarios × 20 días laborables × 1 mensaje al día = 20,000 mensajes
- 20,000 × $0.00013 = **$2.60 USD/mes**

**Conclusión:** Sistema muy económico para el valor que aporta.
