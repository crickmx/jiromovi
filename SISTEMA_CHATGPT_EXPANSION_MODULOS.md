# Expansión del Sistema ChatGPT - Módulos Adicionales

## Resumen de Cambios

Se ha expandido el sistema de generación de mensajes automáticos del Dashboard para incluir información de **nuevos módulos**: Gamificación, Seguros Education, Comunicados, Trámites y Reservas.

---

## Nuevos Módulos Integrados

### 1. 🎮 Gamificación (Sistema Mi Progreso)

**Datos recopilados:**
- Nivel actual del agente (1-50)
- XP actual y XP necesario para siguiente nivel
- Jiro Coins (moneda virtual)
- Posición en ranking nacional (top 100)
- Logros recientes (últimos 7 días)
- Racha de días consecutivos activo

**Tablas consultadas:**
- `agent_gamification_profile`
- `agent_gamification_events`
- `fn_obtener_ranking_nacional()` (función RPC)

**Ejemplo de mensaje generado:**
> "Hola Carlos, estás en nivel 8 con racha de 12 días y en el puesto 5 del ranking. Tienes 2 cursos nuevos que podrían darte el XP que necesitas para subir de nivel."

---

### 2. 📚 Seguros Education

**Datos recopilados:**
- Cursos en progreso (iniciados pero no completados)
- Cursos completados totales
- Horas de capacitación del mes actual
- Próximas sesiones live (próximos 7 días)
- Cursos nuevos disponibles (últimos 30 días no vistos)
- Último curso completado

**Tablas consultadas:**
- `seguros_lessons`
- `seguros_progress`
- `seguros_sessions`

**Ejemplo de mensaje generado:**
> "Hola Laura, completaste 'Vida y GMM Intermedio' y llevas 8.5 horas de capacitación este mes. Tienes una sesión live mañana que complementaría bien tu aprendizaje."

---

### 3. 📢 Comunicados

**Datos recopilados:**
- Comunicados sin leer (relevantes para el usuario)
- Título del último comunicado publicado
- Fecha del último comunicado

**Tablas consultadas:**
- `comunicados`
- `comunicados_visibilidad`
- `comunicados_lecturas`

**Lógica de filtrado:**
- Solo comunicados publicados
- Filtra por visibilidad (para todos, oficina específica, o usuario específico)
- Excluye comunicados ya leídos

**Ejemplo de mensaje generado:**
> "Hola María, tienes 3 comunicados sin leer, incluyendo 'Nuevas tarifas GMM 2026'. Vale la pena revisarlos antes de atender tus 5 cotizaciones activas."

---

### 4. 📋 Trámites

**Datos recopilados:**
- Trámites pendientes de atención (asignados al usuario)
- Documentos por revisar en Centro Digital (solo admin/gerente)

**Tablas consultadas:**
- `tickets` (estatus: abierto, en_proceso)
- `centro_digital_archivos` (últimos 7 días, solo admin/gerente)

**Ejemplo de mensaje generado:**
> "Hola Roberto, tienes 4 trámites pendientes y 2 tareas vencidas que vale la pena atender hoy para no perder momentum."

---

### 5. 🏢 Reservas de Espacios

**Datos recopilados:**
- Reservas próximas (próximos 7 días)
- Solo reservas confirmadas o pendientes

**Tablas consultadas:**
- `reservas_espacio` (estados: confirmada, pendiente)

**Ejemplo de mensaje generado:**
> "Hola Sofía, tienes 4 trámites pendientes y 2 tareas vencidas. Cerrarlos antes de tus 2 reservas de esta semana te dejaría con buen ritmo."

---

## Cambios Técnicos Realizados

### 1. Archivo: `src/lib/dashboardWelcomeService.ts`

**Interfaz `UserWelcomeContext` expandida:**

```typescript
// Nuevos campos agregados:

// Gamificación
nivel_actual?: number;
xp_actual?: number;
xp_para_siguiente_nivel?: number;
jiro_coins?: number;
posicion_ranking?: number;
logros_recientes?: number;
dias_racha?: number;

// Seguros Education
cursos_en_progreso?: number;
cursos_completados?: number;
horas_capacitacion_mes?: number;
proximas_sesiones_live?: number;
cursos_nuevos_disponibles?: number;
ultimo_curso_completado?: string;

// Comunicados
comunicados_sin_leer?: number;
ultimo_comunicado_titulo?: string;
ultimo_comunicado_fecha?: string;

// Sistema general
tramites_pendientes_atencion?: number;
documentos_por_revisar?: number;
reservas_proximas?: number;
```

**Nuevas funciones agregadas:**

1. `getGamificacionData(userId: string)`
   - Consulta perfil de gamificación
   - Obtiene posición en ranking nacional
   - Cuenta logros recientes (últimos 7 días)

2. `getSegurosEducationData(userId: string)`
   - Cursos en progreso y completados
   - Calcula horas de capacitación del mes
   - Detecta sesiones live próximas
   - Identifica cursos nuevos no vistos

3. `getComunicadosData(userId: string)`
   - Filtra comunicados relevantes para el usuario
   - Verifica cuáles ha leído
   - Retorna último comunicado publicado

4. `getTramitesData(userId: string)`
   - Cuenta trámites asignados pendientes
   - Para admin/gerente: documentos recientes en Centro Digital

5. `getReservasData(userId: string)`
   - Reservas confirmadas o pendientes (próximos 7 días)

**Ejecución en paralelo:**
Todas las consultas se ejecutan simultáneamente usando `Promise.allSettled()` para máxima eficiencia.

---

### 2. Archivo: `supabase/functions/generate-welcome-message/index.ts`

**System Prompt actualizado:**

Se agregaron secciones completas sobre:

1. **DATOS DISPONIBLES EN EL CONTEXTO:**
   - Lista completa de módulos y datos disponibles
   - Explicación de cada tipo de información

2. **PRIORIDAD DE INFORMACIÓN:**
   ```
   1. Comunicados sin leer o importantes
   2. Cursos nuevos o sesiones live próximas
   3. Gamificación (nivel reciente, logros, posición en ranking)
   4. Tareas vencidas o trámites urgentes
   5. Producción y comisiones destacables
   6. Progreso en capacitación
   ```

3. **TIPOS DE MENSAJES EXPANDIDOS:**
   - Recordatorio de comunicados o cursos importantes
   - Reconocimiento de progreso en gamificación o capacitación
   - Felicitación por logros recientes (nivel nuevo, curso completado)
   - Motivación basada en datos reales

4. **EJEMPLOS ACTUALIZADOS:**
   Se agregaron ejemplos que combinan múltiples módulos:
   ```
   "Hola Carlos, subiste al nivel 8 y estás en racha de 12 días.
    Tienes 2 cursos nuevos disponibles que podrían interesarte."

   "Hola Laura, hay 3 comunicados sin leer y una sesión live mañana
    sobre GMM. Vale la pena revisarlos antes de empezar el día."
   ```

5. **INSTRUCCIONES ESPECIALES:**
   - Priorizar comunicados sin leer
   - Motivar participación en cursos y sesiones live
   - Reconocer logros en gamificación
   - Combinar información cuando tenga sentido

---

## Prioridades de Información

El sistema ahora prioriza la información de la siguiente manera:

### 🔴 Prioridad Alta (siempre se menciona si existe)
1. Comunicados sin leer
2. Cursos nuevos y sesiones live próximas

### 🟡 Prioridad Media (se menciona si es destacable)
3. Gamificación (niveles, logros, ranking top 10)
4. Tareas vencidas y trámites urgentes

### 🟢 Prioridad Normal (se menciona si hay espacio)
5. Producción y comisiones con crecimiento significativo
6. Progreso en capacitación y cursos completados

---

## Ejemplos de Mensajes Generados

### Combinando Gamificación + Educación
```
Contexto:
{
  "nombre": "Carlos Ramírez",
  "nivel_actual": 8,
  "dias_racha": 12,
  "cursos_nuevos_disponibles": 2,
  "xp_para_siguiente_nivel": 300
}

Mensaje:
"Hola Carlos, estás en nivel 8 con racha de 12 días. Tienes 2 cursos
nuevos que podrían darte el XP que necesitas para subir de nivel."
```

### Comunicados + Sesiones Live
```
Contexto:
{
  "nombre": "Laura Martínez",
  "comunicados_sin_leer": 3,
  "ultimo_comunicado_titulo": "Nuevas tarifas GMM 2026",
  "proximas_sesiones_live": 1,
  "cotizaciones_activas": 5
}

Mensaje:
"Hola Laura, tienes 3 comunicados sin leer, incluyendo 'Nuevas tarifas
GMM 2026'. Hay una sesión live mañana que te ayudará con tus 5 cotizaciones."
```

### Cursos Completados + Gamificación
```
Contexto:
{
  "nombre": "Diego Torres",
  "ultimo_curso_completado": "GMM Intermedio",
  "horas_capacitacion_mes": 8.5,
  "nivel_actual": 10,
  "logros_recientes": 5
}

Mensaje:
"Hola Diego, completaste 'GMM Intermedio' y subiste a nivel 10 con 5 logros
esta semana. Esas 8.5 horas de capacitación valen oro."
```

### Trámites + Producción
```
Contexto:
{
  "nombre": "Ana Pérez",
  "tramites_pendientes_atencion": 4,
  "tareas_vencidas": 2,
  "produccion_mes_actual": 185000,
  "produccion_mes_anterior": 145000
}

Mensaje:
"Hola Ana, tu producción creció 27% a $185,000. Tienes 4 trámites y 2 tareas
vencidas que al cerrarlos te darían un mes perfecto."
```

---

## Performance y Optimización

### Consultas en Paralelo
Todas las nuevas funciones se ejecutan simultáneamente:

```typescript
const [
  produccionData,
  tareasData,
  cotizacionesData,
  eventosData,
  comisionesData,
  gamificacionData,        // NUEVO
  educationData,           // NUEVO
  comunicadosData,         // NUEVO
  tramitesData,            // NUEVO
  reservasData,            // NUEVO
] = await Promise.allSettled([...]);
```

### Manejo de Errores
- `Promise.allSettled()` asegura que si una consulta falla, las demás continúan
- Cada función tiene su propio try/catch
- Si una función retorna `null`, simplemente no se incluye ese dato en el contexto

### Impacto en Tiempo de Carga
- Las consultas son ligeras (solo counts y selects específicos)
- Ejecución paralela: ~1-2 segundos para todas las consultas
- No bloquea la carga del dashboard (asíncrono)

---

## Costo de OpenAI

### Tokens por Mensaje (estimado)

**Antes (sin nuevos módulos):**
- Input: ~400 tokens
- Output: ~50 tokens
- Costo: ~$0.00010 por mensaje

**Ahora (con nuevos módulos):**
- Input: ~600 tokens (system prompt más largo + más contexto)
- Output: ~50 tokens
- Costo: ~$0.00015 por mensaje

**Incremento:** +50% en costo por mensaje (+$0.00005)

### Proyección Mensual (1000 usuarios activos)

```
1000 usuarios × 20 días × 1 mensaje/día = 20,000 mensajes/mes

Costo antes:  20,000 × $0.00010 = $2.00/mes
Costo ahora:  20,000 × $0.00015 = $3.00/mes

INCREMENTO: +$1.00/mes
```

**Conclusión:** El incremento es mínimo ($1/mes) para el valor agregado que aporta.

---

## Tablas de Base de Datos Involucradas

### Nuevas Tablas Consultadas

1. **Gamificación:**
   - `agent_gamification_profile`
   - `agent_gamification_events`

2. **Seguros Education:**
   - `seguros_categories`
   - `seguros_lessons`
   - `seguros_progress`
   - `seguros_sessions`

3. **Comunicados:**
   - `comunicados`
   - `comunicados_visibilidad`
   - `comunicados_lecturas`

4. **Trámites:**
   - `tickets`
   - `centro_digital_archivos`

5. **Reservas:**
   - `reservas_espacio`

**Total de tablas consultadas:** 17 tablas (antes: 9 tablas)

---

## Testing y Validación

### Casos de Prueba Recomendados

1. **Usuario con comunicados sin leer:**
   - Verificar que el mensaje prioriza comunicados
   - Verificar que menciona el título del último comunicado

2. **Usuario con nivel reciente en gamificación:**
   - Verificar que felicita por el nivel alcanzado
   - Verificar que menciona racha de días si >7

3. **Usuario con cursos nuevos disponibles:**
   - Verificar que motiva a tomar los cursos
   - Verificar que combina con sesiones live si existen

4. **Usuario sin datos nuevos:**
   - Verificar que sigue funcionando con datos antiguos
   - Verificar que no inventa información

5. **Usuario con múltiples módulos activos:**
   - Verificar que combina información inteligentemente
   - Verificar que respeta las prioridades definidas

### Comandos de Testing

```bash
# En browser console del Dashboard:

# Ver contexto completo recopilado
console.log('Contexto del usuario');

# Logs automáticos del sistema:
# 📊 Recopilando contexto para usuario: [id]
# ✅ Contexto recopilado: { nivel_actual: 8, cursos_en_progreso: 2, ... }
# 📝 Mensaje: "Hola Carlos, estás en nivel 8..."
```

---

## Próximos Pasos Sugeridos

1. **Monitorear engagement:**
   - Agregar analytics para ver qué tipos de mensajes generan más clics
   - Identificar qué módulos son más efectivos

2. **Ajustar prioridades:**
   - Basado en feedback de usuarios
   - A/B testing de diferentes estilos

3. **Expandir contexto:**
   - Agregar más métricas de gamificación (badges, misiones)
   - Incluir alertas de sistema importantes
   - Integrar calendario personal

4. **Optimizar costos:**
   - Caché de mensajes generados (24 horas)
   - Generar solo si hay cambios significativos en el contexto

---

## Documentación Actualizada

Toda la documentación ha sido actualizada en:
- `CHATGPT_CONFIGURACION_DASHBOARD.md` (completa)
- Este archivo: `SISTEMA_CHATGPT_EXPANSION_MODULOS.md` (resumen de cambios)

---

## Deployment

✅ Edge Function `generate-welcome-message` desplegada exitosamente
✅ Código frontend compilado sin errores
✅ Sistema listo para producción

---

## Conclusión

El sistema de mensajes automáticos del Dashboard ahora es **mucho más inteligente y contextual**, capaz de:

- Alertar sobre comunicados importantes
- Motivar la capacitación continua
- Reconocer logros y progreso
- Recordar pendientes importantes
- Combinar información de múltiples módulos

Todo esto manteniendo el tono cálido, personal y motivador que caracteriza al sistema.
