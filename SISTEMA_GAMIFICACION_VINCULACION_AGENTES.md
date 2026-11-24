# Sistema de Gamificación - Vinculación con Agentes Activos

## Estado Actual del Sistema

### Vinculación Existente

El sistema de gamificación **YA está vinculado directamente con usuarios** a través de:

1. **Tabla Principal: `agent_gamification_profile`**
   ```sql
   CREATE TABLE agent_gamification_profile (
     user_id uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
     xp_total bigint NOT NULL DEFAULT 0,
     jiro_coins_balance bigint NOT NULL DEFAULT 0,
     nivel_actual int NOT NULL DEFAULT 1,
     rango_actual text NOT NULL DEFAULT 'Agente Base',
     anios_antiguedad numeric(5,2) NOT NULL DEFAULT 0,
     multiplicador_veterano numeric(5,2) NOT NULL DEFAULT 1.0,
     fecha_ingreso_empresa date NOT NULL DEFAULT CURRENT_DATE,
     updated_at timestamptz DEFAULT now()
   );
   ```

2. **Vinculación por `user_id`**
   - Usa `usuarios.id` como FK principal
   - Filtro por rol: `rol = 'Agente'`
   - Eliminación en cascada si se elimina el usuario

3. **Eventos de Gamificación**
   ```sql
   CREATE TABLE agent_gamification_events (
     user_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
     tipo_evento tipo_evento_gamificacion NOT NULL,
     xp_delta int NOT NULL DEFAULT 0,
     jc_delta int NOT NULL DEFAULT 0,
     ...
   );
   ```

### Tipos de Eventos Soportados

```typescript
type TipoEventoGamificacion =
  | 'poliza_emitida'        // Al emitir una póliza
  | 'prospecto'             // Al agregar un prospecto
  | 'curso_completado'      // Al completar un curso
  | 'certificacion_aprobada'// Al aprobar una certificación
  | 'resena_5_estrellas'    // Al recibir reseña 5 estrellas
  | 'renovacion'            // Al renovar una póliza
  | 'bono_antiguedad'       // Bono por años de antigüedad
  | 'mision_completada'     // Al completar una misión
  | 'ajuste_manual'         // Ajuste manual por admin
  | 'cancelacion_poliza'    // Al cancelar póliza (resta puntos)
  | 'expiracion_jc';        // Expiración de Jiro Coins
```

## Problema Detectado: ¿Cómo Activar el Sistema?

### ¿Cómo se vinculan los agentes actualmente?

**Automáticamente** a través de:

1. **Trigger de creación automática**
   - Cuando se crea un usuario con `rol = 'Agente'`
   - Se crea automáticamente un perfil en `agent_gamification_profile`

2. **Creación bajo demanda**
   - La función `fn_registrar_evento_gamificacion` crea el perfil si no existe:
   ```sql
   INSERT INTO agent_gamification_profile (user_id)
   VALUES (p_user_id)
   ON CONFLICT (user_id) DO NOTHING;
   ```

### El Problema: Eventos No Se Están Registrando

**No hay triggers automáticos** para registrar eventos cuando:
- Se emite una póliza → No se registra `poliza_emitida`
- Se agrega un prospecto → No se registra `prospecto`
- Se completa un curso → No se registra `curso_completado`

## Solución: Sistema de Integración Automática

### Opción 1: Triggers en Tablas de Producción ✅ (RECOMENDADO)

Crear triggers que detecten eventos automáticamente:

```sql
-- Trigger: Al crear comisión (póliza emitida)
CREATE OR REPLACE FUNCTION trigger_gamification_poliza_emitida()
RETURNS TRIGGER AS $$
DECLARE
  v_xp_base INTEGER := 50;  -- XP base por póliza
  v_jc_base INTEGER := 10;  -- Jiro Coins base
  v_multiplicador NUMERIC;
BEGIN
  -- Solo para usuarios con rol 'Agente'
  IF EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = NEW.usuario_id
    AND rol = 'Agente'
    AND deleted_at IS NULL
  ) THEN
    -- Obtener multiplicador por ramo
    SELECT COALESCE(factor, 1.0) INTO v_multiplicador
    FROM agent_xp_multipliers
    WHERE tipo = 'ramo'
      AND referencia = NEW.ramo
      AND activo = true
      AND CURRENT_DATE BETWEEN fecha_inicio AND COALESCE(fecha_fin, '2099-12-31')
    LIMIT 1;

    -- Registrar evento
    PERFORM fn_registrar_evento_gamificacion(
      p_user_id := NEW.usuario_id,
      p_tipo_evento := 'poliza_emitida'::tipo_evento_gamificacion,
      p_xp_delta := (v_xp_base * COALESCE(v_multiplicador, 1.0))::INTEGER,
      p_jc_delta := v_jc_base,
      p_referencia_tipo := 'commission_detail',
      p_referencia_id := NEW.id::TEXT,
      p_reversible := true,
      p_metadata := jsonb_build_object(
        'poliza', NEW.poliza,
        'ramo', NEW.ramo,
        'aseguradora', NEW.aseguradora,
        'comision', NEW.commission_neta
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
CREATE TRIGGER after_commission_detail_insert_gamification
  AFTER INSERT ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION trigger_gamification_poliza_emitida();
```

### Opción 2: Webhooks/Eventos en Frontend ⚡ (MÁS FLEXIBLE)

Registrar eventos desde el frontend cuando ocurren acciones:

```typescript
// En src/lib/gamificationIntegration.ts

import { registrarEventoGamificacion } from './gamificationUtils';

/**
 * Registra evento de póliza emitida
 */
export async function registrarPolizaEmitida(params: {
  userId: string;
  polizaId: string;
  ramo: string;
  aseguradora: string;
  comision: number;
}) {
  // XP base: 50 puntos
  let xpBase = 50;

  // Multiplicadores por ramo
  const multiplicadoresPorRamo: Record<string, number> = {
    'VIDA': 1.5,        // 75 XP
    'GMM': 2.0,         // 100 XP
    'AUTOS': 1.0,       // 50 XP
    'DAÑOS': 1.2,       // 60 XP
  };

  const multiplicador = multiplicadoresPorRamo[params.ramo] || 1.0;
  const xpFinal = Math.floor(xpBase * multiplicador);

  await registrarEventoGamificacion({
    userId: params.userId,
    tipoEvento: 'poliza_emitida',
    xpDelta: xpFinal,
    jcDelta: 10,
    referenciaTipo: 'poliza',
    referenciaId: params.polizaId,
    reversible: true,
    metadata: {
      ramo: params.ramo,
      aseguradora: params.aseguradora,
      comision: params.comision,
    },
  });
}

/**
 * Registra evento de prospecto agregado
 */
export async function registrarProspectoAgregado(params: {
  userId: string;
  contactoId: string;
  nombre: string;
}) {
  await registrarEventoGamificacion({
    userId: params.userId,
    tipoEvento: 'prospecto',
    xpDelta: 10,   // 10 XP por prospecto
    jcDelta: 2,    // 2 Jiro Coins
    referenciaTipo: 'contacto',
    referenciaId: params.contactoId,
    reversible: false,
    metadata: {
      nombre: params.nombre,
    },
  });
}

/**
 * Registra evento de curso completado
 */
export async function registrarCursoCompletado(params: {
  userId: string;
  cursoId: string;
  titulo: string;
  categoria: string;
}) {
  // XP por categoría
  const xpPorCategoria: Record<string, number> = {
    'cedulaA': 200,      // Cédula A da más XP
    'educacion': 100,    // Cursos educativos
    'default': 50,       // Otros cursos
  };

  const xpFinal = xpPorCategoria[params.categoria] || xpPorCategoria['default'];

  await registrarEventoGamificacion({
    userId: params.userId,
    tipoEvento: 'curso_completado',
    xpDelta: xpFinal,
    jcDelta: 25,
    referenciaTipo: 'curso',
    referenciaId: params.cursoId,
    reversible: false,
    metadata: {
      titulo: params.titulo,
      categoria: params.categoria,
    },
  });
}

/**
 * Registra evento de certificación aprobada
 */
export async function registrarCertificacionAprobada(params: {
  userId: string;
  examenId: string;
  titulo: string;
  calificacion: number;
}) {
  // Bonus por calificación alta
  let xpBase = 500;  // Certificación vale mucho
  if (params.calificacion >= 90) {
    xpBase = 750;  // Bonus por excelencia
  } else if (params.calificacion >= 80) {
    xpBase = 600;
  }

  await registrarEventoGamificacion({
    userId: params.userId,
    tipoEvento: 'certificacion_aprobada',
    xpDelta: xpBase,
    jcDelta: 100,  // Gran recompensa en Jiro Coins
    referenciaTipo: 'certificacion',
    referenciaId: params.examenId,
    reversible: false,
    metadata: {
      titulo: params.titulo,
      calificacion: params.calificacion,
    },
  });
}
```

### Opción 3: Sistema Híbrido (MEJOR PRÁCTICA) 🎯

Combinar ambos enfoques:

1. **Triggers SQL** para eventos críticos de negocio:
   - Pólizas emitidas
   - Renovaciones
   - Cancelaciones

2. **Eventos Frontend** para interacciones de usuario:
   - Prospectos agregados
   - Cursos completados
   - Certificaciones aprobadas

## Integración con Módulos Existentes

### 1. Comisiones → Gamificación

**Archivo:** `supabase/migrations/create_gamification_commission_trigger.sql`

```sql
-- Trigger: Póliza emitida
CREATE TRIGGER after_commission_detail_insert_gamification
  AFTER INSERT ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION trigger_gamification_poliza_emitida();
```

### 2. CRM → Gamificación

**Archivo:** `src/pages/CRMContactos.tsx`

```typescript
import { registrarProspectoAgregado } from '../lib/gamificationIntegration';

// Al crear contacto
const handleCrearContacto = async (data) => {
  const nuevoContacto = await crearContacto(data);

  // Registrar evento de gamificación
  if (user?.rol === 'Agente') {
    await registrarProspectoAgregado({
      userId: user.id,
      contactoId: nuevoContacto.id,
      nombre: `${data.nombre} ${data.apellidos}`,
    });
  }
};
```

### 3. Educación → Gamificación

**Archivo:** `src/pages/SegurosEducationOnDemand.tsx`

```typescript
import { registrarCursoCompletado } from '../lib/gamificationIntegration';

// Al completar lección
const handleCompletarLeccion = async (leccionId) => {
  await marcarLeccionCompletada(leccionId);

  // Si completó todas las lecciones del curso
  if (progreso === 100) {
    await registrarCursoCompletado({
      userId: user!.id,
      cursoId: cursoId,
      titulo: curso.titulo,
      categoria: curso.categoria,
    });
  }
};
```

### 4. Cédula A → Gamificación

**Archivo:** `src/pages/ExamenInterface.tsx`

```typescript
import { registrarCertificacionAprobada } from '../lib/gamificationIntegration';

// Al aprobar examen
const handleExamenAprobado = async (resultado) => {
  if (resultado.aprobado) {
    await registrarCertificacionAprobada({
      userId: user!.id,
      examenId: examen.id,
      titulo: examen.titulo,
      calificacion: resultado.calificacion,
    });
  }
};
```

## Activación del Sistema

### Para Agentes Existentes

```sql
-- Crear perfiles para todos los agentes que no tienen uno
INSERT INTO agent_gamification_profile (user_id, fecha_ingreso_empresa)
SELECT
  u.id,
  COALESCE(u.created_at::DATE, CURRENT_DATE)
FROM usuarios u
WHERE u.rol = 'Agente'
  AND u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM agent_gamification_profile agp
    WHERE agp.user_id = u.id
  );
```

### Para Nuevos Agentes

El trigger ya está configurado para crear perfiles automáticamente.

## Configuración de Recompensas

### Tabla de Valores XP Recomendados

| Evento | XP Base | Multiplicador | JC |
|--------|---------|---------------|-----|
| **Prospectos** |
| Agregar prospecto | 10 | - | 2 |
| **Pólizas** |
| Póliza Autos | 50 | 1.0x | 10 |
| Póliza Daños | 60 | 1.2x | 12 |
| Póliza Vida | 75 | 1.5x | 15 |
| Póliza GMM | 100 | 2.0x | 20 |
| **Educación** |
| Curso normal | 50 | - | 10 |
| Curso educativo | 100 | - | 25 |
| Cédula A completa | 500 | - | 100 |
| **Certificaciones** |
| Aprobar 70-79% | 400 | - | 75 |
| Aprobar 80-89% | 600 | - | 100 |
| Aprobar 90-100% | 750 | - | 150 |
| **Renovaciones** |
| Renovar póliza | 75 | ramo | 15 |
| **Reseñas** |
| 5 estrellas | 25 | - | 5 |

## Dashboard de Gamificación

El sistema incluye widgets para el Dashboard:

```typescript
// src/components/ProgresoGamificacion.tsx
// Ya implementado - Muestra:
// - XP Total
// - Jiro Coins
// - Nivel y Rango actual
// - Posición en ranking
```

## Ranking y Competencia

### Funciones de Ranking

```sql
-- Ver top 10 agentes
SELECT * FROM fn_obtener_ranking_global(10);

-- Ver ranking por oficina
SELECT * FROM fn_obtener_ranking_por_oficina('oficina_id', 10);

-- Ver ranking del mes
SELECT * FROM fn_obtener_ranking_mensual(10);
```

## Misiones y Objetivos

### Crear Misiones Personalizadas

```sql
-- Misión: Emitir 10 pólizas en el mes
INSERT INTO agent_missions (nombre, descripcion, tipo_periodo, regla_json, xp_reward, jc_reward)
VALUES (
  'Vendedor Estrella',
  'Emite 10 pólizas este mes',
  'mensual',
  jsonb_build_object(
    'tipo_evento', 'poliza_emitida',
    'cantidad_objetivo', 10,
    'periodo', 'mensual'
  ),
  500,  -- 500 XP al completar
  100   -- 100 JC al completar
);
```

## Resumen de Implementación

### ✅ Ya Implementado

1. Tablas de gamificación
2. Funciones de registro de eventos
3. Cálculo de niveles y rangos
4. Sistema de Jiro Coins con expiración
5. Multiplicadores por ramo y evento
6. Rankings (global, oficina, mensual)
7. Widget de progreso en Dashboard
8. Políticas RLS de seguridad

### 🚧 Falta Implementar

1. **Triggers automáticos** en tablas de producción
2. **Integración en frontend** para registrar eventos
3. **Página completa** de gamificación (`/mi-progreso`)
4. **Sistema de misiones** con progreso en tiempo real
5. **Tienda de Jiro Coins** (canjear por premios)
6. **Notificaciones** de logros y subidas de nivel

## Próximos Pasos Recomendados

1. ✅ Crear archivo `gamificationIntegration.ts` con funciones helper
2. ✅ Agregar triggers SQL para eventos de comisiones
3. ✅ Integrar en CRM para prospectos
4. ✅ Integrar en Educación para cursos
5. ✅ Crear página completa `/mi-progreso`
6. ✅ Implementar notificaciones de logros

¿Quieres que implemente alguno de estos puntos específicamente?
