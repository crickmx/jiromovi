# Sistema de Gamificación MOVI

Sistema completo de niveles, experiencia (XP) y moneda virtual (Jiro Coins) para incentivar la actividad comercial, formación y desempeño de agentes.

## Características Principales

### ✅ XP (Experiencia)
- Valor acumulativo e irreversible (excepto cancelaciones)
- Determina nivel y rango del agente
- Multiplicador veterano: +2% por año de antigüedad
- No expira

### ✅ Jiro Coins (JC)
- Moneda virtual
- Se gana, se gasta y expira
- Expira a los 6 meses
- Puede quedar en balance negativo
- Se usa en la Tienda MOVI

### ✅ Niveles y Rangos

| Nivel | XP Mínimo | XP Máximo | Rango |
|-------|-----------|-----------|-------|
| 1-3 | 0 | 4,999 | Agente Base |
| 4-7 | 5,000 | 19,999 | Agente Élite |
| 8-10 | 20,000 | 49,999 | Maestro Élite |
| 11-13 | 50,000+ | ∞ | Leyenda Jiro |

## Eventos y Recompensas

### Póliza Emitida
- **XP Base:** 100
- **JC:** Prima neta / 1,000 (redondeado hacia abajo)
- **Reversible:** Sí (si se cancela en 30 días)
- **Multiplicadores:** Aplican según ramo/aseguradora

### Prospecto Registrado
- **XP:** 10
- **Límite:** 50 XP diarios máximo
- **Reversible:** No

### Curso Completado
- **XP:** 200
- **Reversible:** No

### Certificación Aprobada
- **XP:** 500
- **Reversible:** No

### Reseña 5 Estrellas
- **JC:** 50
- **Reversible:** No

### Renovación
- **JC:** 200
- **Reversible:** No

### Antigüedad
- Año 1: +1,000 XP
- Año 2: +2,000 XP
- Año 3: +3,500 XP
- Año 5+: +7,500 XP

## Misiones

### Misiones Predeterminadas

1. **Racha Imparable**
   - Emite 5 pólizas en una semana
   - Recompensa: +500 XP / +200 JC

2. **Estudiante Élite**
   - Completa 3 cursos en el mes
   - Recompensa: +300 XP / +100 JC

3. **Venta Millonaria**
   - Alcanza $200,000 en ventas del mes
   - Recompensa: +1,000 XP / +500 JC

4. **Maestro de Renovaciones**
   - Renueva 10 pólizas en el mes
   - Recompensa: +600 XP / +300 JC

5. **Prospector Experto**
   - Registra 20 prospectos válidos en el mes
   - Recompensa: +400 XP / +150 JC

## Arquitectura de Base de Datos

### Tablas Principales

#### `agent_gamification_profile`
Perfil de gamificación de cada agente.

```sql
- user_id (PK, FK a usuarios)
- xp_total
- jiro_coins_balance
- nivel_actual
- rango_actual
- anios_antiguedad
- multiplicador_veterano
- fecha_ingreso_empresa
- total_polizas_emitidas
- total_prospectos
- total_cursos_completados
- total_certificaciones
- total_renovaciones
```

#### `agent_gamification_events`
Registro auditable de todos los eventos.

```sql
- id (PK)
- user_id (FK)
- tipo_evento (ENUM)
- referencia_tipo
- referencia_id
- xp_delta
- jc_delta
- xp_antes / xp_despues
- jc_antes / jc_despues
- fecha_evento
- fecha_expiracion_jc
- reversible
- reversed_by_event_id
- metadata (JSONB)
```

#### `agent_missions`
Definición de misiones disponibles.

```sql
- id (PK)
- nombre
- descripcion
- tipo_periodo (semanal, mensual, unica, permanente)
- regla_json (JSONB)
- xp_reward
- jc_reward
- activa
```

#### `agent_mission_progress`
Progreso de misiones por agente.

```sql
- id (PK)
- user_id (FK)
- mission_id (FK)
- periodo
- progreso_actual
- meta_requerida
- completada
- fecha_completada
```

#### `agent_xp_multipliers`
Multiplicadores configurables.

```sql
- id (PK)
- tipo (ramo, evento, aseguradora, global)
- referencia
- factor
- fecha_inicio / fecha_fin
- activo
```

## Funciones RPC

### `add_gamification_event()`
Registra evento y actualiza perfil automáticamente.

```sql
SELECT add_gamification_event(
  p_user_id := 'uuid',
  p_tipo_evento := 'poliza_emitida',
  p_referencia_id := 'POL-123',
  p_xp_delta := 100,
  p_jc_delta := 50
);
```

### `reverse_gamification_event()`
Revierte un evento (cancelaciones).

```sql
SELECT reverse_gamification_event(
  p_event_id := 'event-uuid'
);
```

### `check_mission_progress()`
Verifica y actualiza progreso de misión.

```sql
SELECT check_mission_progress(
  p_user_id := 'uuid',
  p_mission_id := 'mission-uuid',
  p_incremento := 1
);
```

### `expire_jiro_coins()`
Expira JC vencidos (ejecutar con cron).

```sql
SELECT expire_jiro_coins();
```

### `update_agent_seniority()`
Actualiza antigüedad y multiplicador veterano.

```sql
SELECT update_agent_seniority();
```

## Edge Functions

### `/gamification-poliza-emitida`
Registra XP y JC cuando se emite una póliza.

**Request:**
```json
{
  "userId": "uuid",
  "polizaId": "POL-123",
  "primaNeta": 50000,
  "ramo": "VIDA",
  "aseguradora": "GNP"
}
```

### `/gamification-curso-completado`
Registra XP cuando se completa un curso.

**Request:**
```json
{
  "userId": "uuid",
  "cursoId": "curso-123",
  "cursoNombre": "Introducción a Seguros"
}
```

### `/gamification-prospecto`
Registra XP por prospecto (con límite diario).

**Request:**
```json
{
  "userId": "uuid",
  "prospectoId": "prosp-123",
  "prospectoNombre": "Juan Pérez"
}
```

## UI - Agente

### Página: Mi Progreso (`/mi-progreso`)

**Secciones:**
1. **Resumen de Stats**
   - XP Total con ranking
   - Jiro Coins con ranking
   - Nivel actual y rango

2. **Progreso al Siguiente Nivel**
   - Barra visual con porcentaje
   - XP restantes
   - Vista previa del próximo rango

3. **Misiones Activas**
   - Lista de misiones en progreso
   - Barra de progreso por misión
   - Recompensas visibles

4. **Actividad Reciente**
   - Últimos 10 eventos
   - XP y JC ganados/perdidos
   - Timestamp

5. **Estadísticas Generales**
   - Total pólizas emitidas
   - Total prospectos
   - Total cursos completados
   - Total certificaciones
   - Total renovaciones
   - Multiplicador veterano

## UI - Administrador

### Página: Gamificación (`/gamificacion`)

**Pestañas:**

#### 1. Ranking
- Top 50 agentes por XP
- Visualización de medallas para top 3
- Filtros por XP, JC, pólizas
- Información de oficina y rango

#### 2. Misiones
- Lista de misiones configuradas
- Crear/editar/eliminar misiones
- Activar/desactivar misiones
- Configurar reglas y recompensas

#### 3. Multiplicadores
- Lista de multiplicadores activos
- Crear multiplicadores por:
  - Ramo (ej: 1.5x para VIDA)
  - Aseguradora (ej: 1.3x para GNP)
  - Global (ej: 2x en campaña especial)
- Configurar vigencia

## Integraciones

### Módulos Integrados

1. **CRM** → Prospectos
   - Al crear prospecto válido
   - Llamar: `/gamification-prospecto`

2. **Producción/SICAS** → Pólizas
   - Al emitir póliza
   - Llamar: `/gamification-poliza-emitida`
   - Al cancelar póliza
   - Llamar: `reverse_gamification_event()`

3. **Seguros Education** → Cursos/Certificaciones
   - Al completar curso
   - Llamar: `/gamification-curso-completado`
   - Al aprobar certificación
   - Llamar con tipo `certificacion`

4. **Reseñas** → Calificaciones
   - Al recibir reseña 5 estrellas
   - Llamar con tipo `resena`

## Seguridad y RLS

### Políticas Implementadas

- ✅ Agentes pueden ver **solo su propio perfil**
- ✅ Agentes pueden ver **solo sus propios eventos**
- ✅ Administradores pueden ver **todos los perfiles**
- ✅ Service role puede **escribir eventos**
- ✅ Funciones RPC son **SECURITY DEFINER**

## Auditoría y Fair Play

### Reversión de Eventos

- Cancelación de póliza antes de 30 días revierte XP y JC
- Se registra evento de tipo `cancelacion`
- Campo `reversed_by_event_id` marca el evento original
- No se puede revertir dos veces

### Expiración de JC

- JC expiran a los 6 meses automáticamente
- Se registra evento de tipo `expiracion_jc`
- Ejecutar `expire_jiro_coins()` con cron diario

### Límites

- Prospectos: máximo 50 XP diarios
- Todos los eventos son registrados en `agent_gamification_events`
- Metadata JSONB almacena contexto adicional

## Mantenimiento

### Cron Jobs Recomendados

```sql
-- Diario a las 00:00
SELECT expire_jiro_coins();

-- Mensual (día 1)
SELECT update_agent_seniority();
```

### Monitoreo

```sql
-- Verificar eventos sin reversa
SELECT * FROM agent_gamification_events
WHERE reversed_by_event_id IS NOT NULL;

-- Ver top agentes
SELECT * FROM get_top_agents('xp_total', 10);

-- Verificar JC próximos a expirar
SELECT * FROM agent_gamification_events
WHERE fecha_expiracion_jc <= CURRENT_DATE + INTERVAL '7 days'
  AND reversed_by_event_id IS NULL;
```

## Ejemplo de Uso

### Emitir Póliza con Gamificación

```typescript
// 1. Emitir la póliza normalmente
const { data: poliza } = await supabase
  .from('polizas')
  .insert({ ... });

// 2. Registrar evento de gamificación
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/gamification-poliza-emitida`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: agent.id,
      polizaId: poliza.id,
      primaNeta: poliza.prima_neta,
      ramo: poliza.ramo,
      aseguradora: poliza.aseguradora,
    }),
  }
);

const result = await response.json();
// result = { success: true, eventId: "...", xpDelta: 100, jcDelta: 50 }
```

## Soporte

Para cualquier duda o problema:
1. Revisar logs de eventos en `agent_gamification_events`
2. Verificar perfiles en `agent_gamification_profile`
3. Consultar funciones RPC disponibles
4. Revisar políticas RLS activas

---

**Versión:** 1.0.0
**Última actualización:** Marzo 2026
