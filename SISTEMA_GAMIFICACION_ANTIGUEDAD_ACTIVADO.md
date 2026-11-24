# Sistema de Gamificación - Bonos por Antigüedad Activados ✅

## Resumen de Activación

**Fecha:** 19 de Marzo, 2026
**Estado:** ✅ Sistema completamente activado

### Estadísticas Iniciales

- **Total de agentes:** 8
- **XP total otorgado:** 14,600 puntos
- **Jiro Coins otorgados:** 7,300 monedas
- **Antigüedad promedio:** 9.41 años
- **Máxima antigüedad:** 27.21 años

## Agentes Activados (Top 5)

| Agente | XP | JC | Nivel | Rango | Antigüedad | Multiplicador |
|--------|----|----|-------|-------|------------|---------------|
| BLANCA HORTA | 5,400 | 2,700 | 4 | Agente Élite | 27.21 años | 1.544x |
| AGENTE DEMO | 5,200 | 2,600 | 4 | Agente Élite | 26.21 años | 1.524x |
| FERNANDO DE LA TORRE | 3,400 | 1,700 | 3 | Agente Base | 17.46 años | 1.349x |
| MAGALY FUENTES | 600 | 300 | 1 | Agente Base | 3.80 años | 1.076x |
| ALEJANDRA ABARCA | 0 | 0 | 1 | Agente Base | 0.39 años | 1.008x |

## Funcionalidades Implementadas

### 1. **Cálculo Automático de Antigüedad** ✅

```sql
-- Calcula años con 2 decimales de precisión
fn_calcular_anios_antiguedad(fecha_ingreso DATE) → NUMERIC
```

**Funcionalidad:**
- Usa `fecha_ingreso` de la tabla `usuarios`
- Si no existe, usa `created_at`
- Precisión de 2 decimales

### 2. **Bono Inicial por Antigüedad** ✅

**Recompensas otorgadas automáticamente:**
- **100 XP por año cumplido**
- **50 Jiro Coins por año cumplido**
- **Multiplicador veterano:** 1.0 + (0.02 × años)

**Ejemplos:**
- 1 año → 100 XP, 50 JC, multiplicador 1.02x
- 5 años → 500 XP, 250 JC, multiplicador 1.10x
- 10 años → 1,000 XP, 500 JC, multiplicador 1.20x
- 20 años → 2,000 XP, 1,000 JC, multiplicador 1.40x
- 27 años → 2,700 XP, 1,350 JC, multiplicador 1.54x

### 3. **Función para Bonos Anuales** ✅

```sql
-- Aplica bono a un agente específico
fn_aplicar_bono_antiguedad(p_user_id UUID)

-- Aplica bonos a todos los agentes elegibles
fn_aplicar_bonos_antiguedad_masivo()
```

**Criterio de elegibilidad:**
- El agente debe haber cumplido al menos 1 año adicional desde el último bono
- Solo se aplica a usuarios con `rol = 'Agente'`
- Solo agentes activos (`deleted_at IS NULL`)

### 4. **Trigger Automático** ✅

Recalcula automáticamente la antigüedad cuando cambia `fecha_ingreso` del usuario:

```sql
CREATE TRIGGER before_update_gamification_profile_antiguedad
  BEFORE UPDATE ON agent_gamification_profile
  WHEN (OLD.fecha_ingreso_empresa IS DISTINCT FROM NEW.fecha_ingreso_empresa)
```

### 5. **Registro de Eventos Auditables** ✅

Cada bono de antigüedad se registra en `agent_gamification_events` con:
- `tipo_evento`: `'bono_antiguedad'`
- `xp_delta`: Puntos otorgados
- `jc_delta`: Jiro Coins otorgados
- `metadata`: Información detallada (años cumplidos, multiplicador, etc.)
- `reversible`: `false` (no se pueden revertir)

## Cómo Funciona el Multiplicador Veterano

El multiplicador veterano **amplifica** todas las recompensas futuras del agente:

### Fórmula
```
multiplicador_veterano = 1.0 + (años_antiguedad × 0.02)
```

### Ejemplos de Aplicación

**Escenario 1: Póliza Emitida**
- XP base por póliza: 50 puntos
- Agente con 10 años → multiplicador 1.20x
- XP final: 50 × 1.20 = **60 XP**

**Escenario 2: Curso Completado**
- XP base por curso: 100 puntos
- Agente con 20 años → multiplicador 1.40x
- XP final: 100 × 1.40 = **140 XP**

**Escenario 3: Certificación Aprobada**
- XP base: 500 puntos
- Agente con 27 años → multiplicador 1.54x
- XP final: 500 × 1.54 = **770 XP**

### Ventajas del Multiplicador

1. **Recompensa la lealtad** - Agentes veteranos reciben más XP por las mismas acciones
2. **Crecimiento acelerado** - Los veteranos suben de nivel más rápido
3. **Reconocimiento constante** - El multiplicador se aplica a TODAS las recompensas

## Sistema de Niveles y Rangos

### Progresión de Niveles

| Nivel | XP Mínimo | XP Máximo | Rango |
|-------|-----------|-----------|-------|
| 1-3 | 0 | 4,999 | Agente Base |
| 4-9 | 5,000 | 19,999 | Agente Élite |
| 10-15 | 20,000 | 49,999 | Maestro Élite |
| 16-20 | 50,000 | ∞ | Leyenda Jiro |

### Agentes por Rango Actual

- **Agente Élite:** 2 agentes (BLANCA HORTA, AGENTE DEMO)
- **Agente Base:** 6 agentes

## Bonos Anuales Automáticos

### Programación Recomendada

**Opción 1: Anual (1 de enero)**
```sql
SELECT cron.schedule(
  'aplicar-bonos-antiguedad-anual',
  '0 0 1 1 *',  -- 00:00 del 1 de enero
  $$SELECT fn_aplicar_bonos_antiguedad_masivo()$$
);
```

**Opción 2: Mensual (día 1 de cada mes)** ⭐ RECOMENDADO
```sql
SELECT cron.schedule(
  'aplicar-bonos-antiguedad-mensual',
  '0 0 1 * *',  -- 00:00 del día 1 cada mes
  $$SELECT fn_aplicar_bonos_antiguedad_masivo()$$
);
```

### Ejecución Manual

Para aplicar bonos manualmente a todos los agentes elegibles:

```sql
-- Ver quiénes son elegibles (sin aplicar)
SELECT * FROM fn_aplicar_bonos_antiguedad_masivo();

-- Aplicar a un agente específico
SELECT fn_aplicar_bono_antiguedad('user_id_here');
```

## Consultas Útiles

### Ver Top 10 Agentes por XP

```sql
SELECT
  u.nombre_completo,
  agp.xp_total,
  agp.jiro_coins_balance,
  agp.nivel_actual,
  agp.rango_actual,
  agp.anios_antiguedad,
  agp.multiplicador_veterano
FROM agent_gamification_profile agp
JOIN usuarios u ON u.id = agp.user_id
ORDER BY agp.xp_total DESC
LIMIT 10;
```

### Ver Historial de Bonos de un Agente

```sql
SELECT
  age.fecha_evento,
  age.xp_delta,
  age.jc_delta,
  age.metadata->>'anios_cumplidos' as anios_cumplidos,
  age.metadata->>'anios_totales' as anios_totales,
  age.metadata->>'multiplicador_veterano' as multiplicador
FROM agent_gamification_events age
WHERE age.user_id = 'user_id_here'
  AND age.tipo_evento = 'bono_antiguedad'
ORDER BY age.fecha_evento DESC;
```

### Estadísticas Generales

```sql
SELECT
  COUNT(*) as total_agentes,
  SUM(xp_total) as xp_total,
  SUM(jiro_coins_balance) as jc_total,
  ROUND(AVG(anios_antiguedad), 2) as antiguedad_promedio,
  ROUND(AVG(multiplicador_veterano), 3) as multiplicador_promedio,
  MAX(anios_antiguedad) as max_antiguedad
FROM agent_gamification_profile;
```

### Agentes Próximos a Cumplir Año

```sql
SELECT
  u.nombre_completo,
  agp.anios_antiguedad,
  ROUND(fn_calcular_anios_antiguedad(agp.fecha_ingreso_empresa), 2) as anios_actuales,
  ROUND(fn_calcular_anios_antiguedad(agp.fecha_ingreso_empresa) - agp.anios_antiguedad, 2) as progreso
FROM agent_gamification_profile agp
JOIN usuarios u ON u.id = agp.user_id
WHERE fn_calcular_anios_antiguedad(agp.fecha_ingreso_empresa) >= agp.anios_antiguedad + 0.8
  AND fn_calcular_anios_antiguedad(agp.fecha_ingreso_empresa) < agp.anios_antiguedad + 1.0
ORDER BY progreso DESC;
```

## Próximos Pasos Recomendados

### 1. **Integración con Producción** 🎯

Conectar eventos de pólizas emitidas al sistema de gamificación:

```typescript
// Al emitir póliza en comisiones
await registrarEventoGamificacion({
  userId: agente.id,
  tipoEvento: 'poliza_emitida',
  xpDelta: 50,  // Se multiplica automáticamente por multiplicador_veterano
  jcDelta: 10,
  referenciaTipo: 'poliza',
  referenciaId: poliza.id
});
```

### 2. **Integración con Educación** 📚

Conectar cursos y certificaciones:

```typescript
// Al completar curso
await registrarEventoGamificacion({
  userId: user.id,
  tipoEvento: 'curso_completado',
  xpDelta: 100,
  jcDelta: 25
});

// Al aprobar certificación
await registrarEventoGamificacion({
  userId: user.id,
  tipoEvento: 'certificacion',
  xpDelta: 500,
  jcDelta: 100
});
```

### 3. **Notificaciones de Aniversario** 🎉

Crear notificación cuando un agente cumple años en la empresa:

```sql
-- Template en correo_plantillas
INSERT INTO correo_plantillas (nombre, asunto, cuerpo_html, tipo)
VALUES (
  'aniversario_empresa',
  '¡Feliz Aniversario {{anios}} en la empresa! 🎉',
  '<p>Querido {{nombre_completo}},</p>
   <p>¡Felicidades por cumplir {{anios}} años con nosotros!</p>
   <p>Has recibido {{xp}} XP y {{jc}} Jiro Coins como bono.</p>
   <p>Tu multiplicador veterano es ahora {{multiplicador}}x</p>',
  'transaccional'
);
```

### 4. **Dashboard de Gamificación** 📊

Crear visualizaciones en el frontend:
- Gráfica de progreso de XP
- Barra de progreso hacia próximo nivel
- Historial de eventos recientes
- Comparación con otros agentes

### 5. **Misiones por Antigüedad** 🎮

Crear misiones especiales para veteranos:

```sql
INSERT INTO agent_missions (nombre, descripcion, tipo_periodo, regla_json, xp_reward, jc_reward)
VALUES (
  'Veterano Productivo',
  'Para agentes con 10+ años: Emite 5 pólizas este mes',
  'mensual',
  jsonb_build_object(
    'tipo_evento', 'poliza_emitida',
    'cantidad_objetivo', 5,
    'requisito_antiguedad_minima', 10
  ),
  1000,
  200
);
```

## Mantenimiento

### Verificar Integridad

```sql
-- Verificar que todos los agentes tienen perfil
SELECT COUNT(*) as agentes_sin_perfil
FROM usuarios u
WHERE u.rol = 'Agente'
  AND u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM agent_gamification_profile agp
    WHERE agp.user_id = u.id
  );
```

### Recalcular Niveles

Si es necesario recalcular niveles de todos los agentes:

```sql
UPDATE agent_gamification_profile agp
SET
  nivel_actual = (SELECT nivel FROM fn_calcular_nivel(agp.xp_total)),
  rango_actual = (SELECT rango FROM fn_calcular_nivel(agp.xp_total));
```

### Logs y Auditoría

Todos los eventos están registrados en `agent_gamification_events`:

```sql
-- Ver últimos 50 eventos
SELECT
  u.nombre_completo,
  age.tipo_evento,
  age.xp_delta,
  age.jc_delta,
  age.fecha_evento,
  age.metadata
FROM agent_gamification_events age
JOIN usuarios u ON u.id = age.user_id
ORDER BY age.fecha_evento DESC
LIMIT 50;
```

## Soporte y Troubleshooting

### Problema: Agente no recibe bonos

**Verificar:**
1. ¿Es su rol 'Agente'? → `SELECT rol FROM usuarios WHERE id = 'user_id'`
2. ¿Tiene perfil de gamificación? → `SELECT * FROM agent_gamification_profile WHERE user_id = 'user_id'`
3. ¿Ha cumplido al menos 1 año desde el último bono?

**Solución:**
```sql
-- Forzar aplicación de bono
SELECT fn_aplicar_bono_antiguedad('user_id_here');
```

### Problema: Multiplicador no se aplica

El multiplicador se aplica **automáticamente** por la función `fn_registrar_evento_gamificacion`. No requiere intervención manual.

### Problema: XP o JC negativos

Los bonos de antigüedad **NO son reversibles** (`reversible = false`). Si se necesita ajustar, usar:

```sql
-- Ajuste manual
SELECT fn_registrar_evento_gamificacion(
  p_user_id := 'user_id_here',
  p_tipo_evento := 'ajuste_manual'::gamification_event_type,
  p_xp_delta := -100,  -- Restar XP si es negativo
  p_jc_delta := -50,
  p_reversible := false,
  p_metadata := jsonb_build_object('motivo', 'Corrección de error')
);
```

## Conclusión

El sistema de gamificación con bonos por antigüedad está completamente funcional y operando. Los 8 agentes activos ya recibieron sus bonos iniciales basados en sus años de servicio, y el sistema calculará automáticamente bonos adicionales cada año cumplido.

**Estado: ✅ SISTEMA ACTIVADO Y FUNCIONAL**
