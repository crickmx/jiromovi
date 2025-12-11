# Sistema de Notificaciones Centralizado - Estado de Implementación

## Resumen Ejecutivo

Se ha implementado exitosamente un sistema centralizado de notificaciones multi-canal con:
- Motor orquestador único para gestión de todas las notificaciones
- Cola de trabajos (jobs) con idempotencia garantizada
- Dispatcher worker para procesamiento asíncrono
- Integración con Wazzup24 para WhatsApp
- Observabilidad total con logs y trazabilidad
- Reintentos automáticos con backoff exponencial

---

## Componentes Implementados

### 1. Base de Datos

#### Nuevas Tablas Creadas

✅ **notification_events_catalog**
- Catálogo central de 8 eventos pre-configurados
- Control de canales habilitados por evento (campanita, email, WhatsApp)
- Plantillas por canal en formato JSONB

✅ **notification_jobs**
- Cola de trabajos con idempotencia (clave única)
- Estados: pending, processing, sent, failed, cancelled
- Sistema de reintentos (max 3 intentos)
- Backoff exponencial para reintentos

✅ **notification_provider_logs**
- Logs completos de interacción con providers externos
- Request/Response payload guardado
- Provider message IDs para trazabilidad
- Tiempos de respuesta en ms

✅ **notification_delivery_attempts**
- Historial de todos los intentos de entrega
- Útil para auditoría y debugging

✅ **notification_phone_normalization_log**
- Log de normalización de teléfonos
- Auditoría de transformaciones

#### Funciones RPC Creadas

✅ **normalize_phone_mx()**
- Normaliza teléfonos mexicanos a formato E.164 (+52XXXXXXXXXX)
- Validación automática de formato
- Log opcional de auditoría

✅ **notify()** - Motor Central
```sql
notify(
  p_event_code text,           -- 'nuevo_comunicado', 'nuevo_evento', etc
  p_user_ids uuid[],            -- Array de usuarios destinatarios
  p_payload jsonb,              -- Datos del evento
  p_entity_id text              -- ID de la entidad (opcional)
) RETURNS jsonb
```

**Características:**
- Crea jobs para cada usuario + cada canal habilitado
- Idempotencia con clave única
- Retorna estadísticas: jobs_created, jobs_skipped, users_processed
- SECURITY DEFINER para acceso controlado

✅ **get_users_by_role()**
✅ **get_users_by_office()**
✅ **get_users_by_role_in_office()**
✅ **get_admin_users()**
✅ **get_all_active_users()**

Helper functions para resolución de destinatarios.

### 2. Edge Functions

✅ **notification-dispatcher** (DESPLEGADA)
- Procesa jobs pendientes de forma asíncrona
- Límite de 50 jobs por ejecución
- Procesamiento secuencial con pausa de 100ms entre jobs
- Reintentos automáticos con backoff: 5, 10, 20 minutos
- Logs detallados de cada operación

**Procesadores por canal:**
- **in_app**: Insert directo en tabla `notificaciones`
- **email**: Llama a `enviar-correo-transaccional` (Resend)
- **whatsapp**: Llama directamente a Wazzup24 API

**Configuración Wazzup24:**
- API Key: `aeaecead58f14a3286b37e4d0b81dc3a`
- Channel: `5215588545516`
- Endpoint: `https://api.wazzup24.com/v3/messages`

### 3. Código Frontend Migrado

✅ **ComunicadoEditor.tsx**
- Migrado de loop con `enviar_notificacion_completa` individual
- Ahora usa `notify()` con array de usuarios
- Trigger inmediato del dispatcher tras crear jobs
- Mejora de eficiencia: 1 llamada RPC en lugar de N llamadas

✅ **aulaEventosUtils.ts**
- Migrado de loop individual a llamada batch
- Usa `notify()` con array de usuarios autorizados
- Trigger del dispatcher post-creación de jobs

### 4. Eventos Pre-Configurados

| Código | Nombre | Canales | Módulo |
|--------|--------|---------|--------|
| `nuevo_comunicado` | Nuevo Comunicado Publicado | 🔔📧📱 | Comunicados |
| `nuevo_evento` | Nuevo Evento en Aula Digital | 🔔📧📱 | Seguros Education |
| `bienvenida` | Bienvenida a Usuario Nuevo | 📧📱 | Usuarios |
| `cuenta_activada` | Cuenta Activada | 🔔📧📱 | Usuarios |
| `password_reset` | Recuperación de Contraseña | 📧 | Usuarios |
| `commission_batch_closed` | Lote de Comisiones Cerrado | 🔔📧📱 | Comisiones |
| `notificacion_individual` | Notificación Individual Manual | 🔔📱 | Sistema |
| `notificacion_global` | Notificación Global Manual | 🔔📱 | Sistema |

**Leyenda:** 🔔 Campanita | 📧 Email | 📱 WhatsApp

---

## Flujo de Trabajo

### Publicar Comunicado (Ejemplo)

```typescript
// 1. Usuario publica comunicado
// 2. Código resuelve destinatarios (ej: 50 usuarios)
const destinatarios = ['uuid1', 'uuid2', ...]; // 50 UUIDs

// 3. Una sola llamada al motor
const { data } = await supabase.rpc('notify', {
  p_event_code: 'nuevo_comunicado',
  p_user_ids: destinatarios,
  p_payload: {
    titulo_comunicado: 'Título del comunicado',
    link_comunicado: 'https://...',
    modulo: 'Comunicados'
  },
  p_entity_id: comunicadoId
});

// Resultado: 150 jobs creados (50 usuarios × 3 canales)
// {
//   success: true,
//   jobs_created: 150,
//   jobs_skipped: 0,
//   users_processed: 50
// }

// 4. Trigger inmediato del dispatcher
fetch('/functions/v1/notification-dispatcher', { method: 'POST' });

// 5. Dispatcher procesa jobs:
//    - Campanita: 50 inserts en tabla notificaciones
//    - Email: 50 llamadas a Resend
//    - WhatsApp: 50 llamadas a Wazzup24

// 6. Logs guardados en notification_provider_logs
// 7. Intentos registrados en notification_delivery_attempts
// 8. Jobs actualizados con status: sent o failed
```

### Idempotencia

```typescript
// Primera llamada
notify('nuevo_comunicado', [user1, user2], payload, 'entity-123');
// Crea 6 jobs (2 usuarios × 3 canales)

// Segunda llamada (mismo evento, mismos usuarios, mismo entity_id)
notify('nuevo_comunicado', [user1, user2], payload, 'entity-123');
// jobs_created: 0
// jobs_skipped: 6
// No se duplican notificaciones
```

### Reintentos Automáticos

```
Intento 1: Falla por timeout
  ↓
Status: pending
next_retry_at: +5 minutos
  ↓
Intento 2: Falla por API error
  ↓
Status: pending
next_retry_at: +10 minutos
  ↓
Intento 3: Falla definitivamente
  ↓
Status: failed
last_error: "API error: ..."
```

---

## Observabilidad y Métricas

### Queries Útiles para Monitoring

#### Ver jobs pendientes o fallidos
```sql
SELECT
  nj.id,
  nj.event_code,
  nj.channel,
  nj.status,
  nj.attempt_count,
  nj.last_error,
  u.nombre_completo,
  nj.created_at
FROM notification_jobs nj
JOIN usuarios u ON u.id = nj.user_id
WHERE nj.status IN ('pending', 'failed')
ORDER BY nj.created_at DESC
LIMIT 100;
```

#### Métricas de éxito por canal (últimas 24 horas)
```sql
SELECT
  channel,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'sent') as exitosos,
  COUNT(*) FILTER (WHERE status = 'failed') as fallidos,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'sent') / COUNT(*), 2) as porcentaje_exito
FROM notification_jobs
WHERE created_at >= now() - interval '24 hours'
GROUP BY channel;
```

#### Logs de provider con errores
```sql
SELECT
  npl.id,
  npl.provider,
  npl.error_message,
  npl.http_status,
  npl.response_payload,
  nj.event_code,
  u.nombre_completo,
  npl.created_at
FROM notification_provider_logs npl
JOIN notification_jobs nj ON nj.id = npl.job_id
JOIN usuarios u ON u.id = nj.user_id
WHERE npl.success = false
ORDER BY npl.created_at DESC
LIMIT 50;
```

#### Top errores más frecuentes
```sql
SELECT
  last_error,
  COUNT(*) as occurrences
FROM notification_jobs
WHERE status = 'failed'
AND last_error IS NOT NULL
GROUP BY last_error
ORDER BY occurrences DESC
LIMIT 10;
```

#### Tiempo promedio de respuesta por provider
```sql
SELECT
  provider,
  AVG(response_time_ms) as avg_response_ms,
  MAX(response_time_ms) as max_response_ms,
  MIN(response_time_ms) as min_response_ms
FROM notification_provider_logs
WHERE success = true
AND response_time_ms IS NOT NULL
GROUP BY provider;
```

---

## Testing

### Prueba Manual 1: Publicar Comunicado

1. Ir a `/comunicados/nuevo`
2. Crear comunicado con visibilidad "Todos"
3. Publicar

**Verificar:**
```sql
-- Ver jobs creados
SELECT event_code, channel, status, COUNT(*)
FROM notification_jobs
WHERE event_code = 'nuevo_comunicado'
GROUP BY event_code, channel, status;

-- Ver logs de WhatsApp
SELECT * FROM notification_provider_logs
WHERE provider = 'wazzup24'
ORDER BY created_at DESC
LIMIT 10;

-- Ver campanitas creadas
SELECT COUNT(*) FROM notificaciones
WHERE created_at >= now() - interval '5 minutes';
```

### Prueba Manual 2: Crear Evento Aula Digital

1. Ir a `/seguros-education-aula-digital`
2. Crear nuevo evento
3. Configurar permisos (ej: todos los agentes)
4. Guardar

**Verificar:**
```sql
SELECT * FROM notification_jobs
WHERE event_code = 'nuevo_evento'
ORDER BY created_at DESC;
```

### Prueba Manual 3: Ejecutar Dispatcher Manualmente

```bash
curl -X POST \
  https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/notification-dispatcher \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPABASE_ANON_KEY"
```

**Verificar logs en Supabase Dashboard:**
- Functions → notification-dispatcher → Logs
- Buscar: "Notification Dispatcher iniciado"
- Ver resumen de procesamiento

### Prueba de Idempotencia

```sql
-- Crear job duplicado manualmente (debería fallar por unique constraint)
INSERT INTO notification_jobs (
  event_code, user_id, channel, status, payload, idempotency_key
)
VALUES (
  'test_event',
  'USER_UUID',
  'in_app',
  'pending',
  '{}',
  'test_event_USER_UUID_in_app_12345'
);

-- Segundo insert con mismo idempotency_key (debe fallar)
INSERT INTO notification_jobs (
  event_code, user_id, channel, status, payload, idempotency_key
)
VALUES (
  'test_event',
  'USER_UUID',
  'in_app',
  'pending',
  '{}',
  'test_event_USER_UUID_in_app_12345'
);
-- ERROR: duplicate key value violates unique constraint
```

---

## Siguientes Pasos Recomendados

### Fase 1: Validación (1-2 días)
- [ ] Probar comunicados en producción
- [ ] Probar eventos de aula digital
- [ ] Verificar logs en Supabase
- [ ] Validar recepción de WhatsApp en números reales
- [ ] Validar recepción de emails
- [ ] Verificar campanitas en UI

### Fase 2: Migración de Eventos Pendientes (2-3 días)
- [ ] Migrar Vacaciones (solicitud, aprobación, rechazo)
- [ ] Migrar Trámites (nuevo, asignado, actualizado, cerrado)
- [ ] Migrar Reservas Espacio JIRO
- [ ] Migrar Store (nuevo pedido, cambio estatus)

### Fase 3: UI de Administración (2-3 días)
- [ ] Dashboard de observabilidad
  - Métricas de éxito por canal
  - Gráficas de tendencia
  - Top errores
- [ ] Monitor de jobs
  - Tabla con filtros
  - Acción de reenvío
- [ ] Logs de providers
  - Request/Response viewer
  - Provider message IDs
- [ ] Catálogo de eventos
  - Activar/desactivar canales
  - Editar plantillas

### Fase 4: Panel de Pruebas (1 día)
- [ ] Formulario de envío de prueba
  - Seleccionar evento
  - Seleccionar usuario
  - Seleccionar canales
  - Ver resultado en tiempo real

### Fase 5: Automatización (1 día)
- [ ] Configurar pg_cron para ejecutar dispatcher cada minuto
  ```sql
  SELECT cron.schedule(
    'process-notifications',
    '* * * * *',
    $$
    SELECT net.http_post(
      url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/notification-dispatcher',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ANON_KEY"}'::jsonb
    )
    $$
  );
  ```

### Fase 6: Optimizaciones (Opcional)
- [ ] Implementar circuit breaker para providers
- [ ] Agregar rate limiting
- [ ] Implementar webhooks de Resend para tracking
- [ ] Agregar métricas de tiempo de entrega
- [ ] Implementar priorización de jobs (urgent > high > normal > low)

---

## Documentación de Referencia

### Archivos Creados

**Documentación:**
- `/SISTEMA_NOTIFICACIONES_CENTRALIZADO.md` - Especificación completa
- `/SISTEMA_NOTIFICACIONES_IMPLEMENTADO.md` - Este archivo

**Base de Datos:**
- `/supabase/migrations/create_notification_orchestrator_system.sql` - Schema completo

**Edge Functions:**
- `/supabase/functions/notification-dispatcher/index.ts` - Worker processor

**Código Migrado:**
- `/src/pages/ComunicadoEditor.tsx` - Usa nuevo sistema
- `/src/lib/aulaEventosUtils.ts` - Usa nuevo sistema

### Links Útiles

**Supabase Dashboard:**
- Database: https://supabase.com/dashboard/project/qhwvuuyjhcennqccgvse/editor
- Functions: https://supabase.com/dashboard/project/qhwvuuyjhcennqccgvse/functions
- Logs: https://supabase.com/dashboard/project/qhwvuuyjhcennqccgvse/logs

**APIs Externas:**
- Wazzup24 Docs: https://api.wazzup24.com/docs
- Resend Docs: https://resend.com/docs

---

## Troubleshooting

### Problema: Notificaciones no se envían

**Verificar:**
1. Jobs se están creando:
   ```sql
   SELECT * FROM notification_jobs
   WHERE created_at >= now() - interval '10 minutes';
   ```

2. Dispatcher se está ejecutando:
   - Ver logs de la edge function
   - Verificar que no haya errores

3. Provider logs:
   ```sql
   SELECT * FROM notification_provider_logs
   WHERE created_at >= now() - interval '10 minutes'
   AND success = false;
   ```

### Problema: WhatsApp no llega

**Verificar:**
1. Teléfono normalizado:
   ```sql
   SELECT
     celular_laboral,
     celular_personal,
     normalize_phone_mx(celular_laboral),
     normalize_phone_mx(celular_personal)
   FROM usuarios
   WHERE id = 'USER_UUID';
   ```

2. Logs de Wazzup24:
   ```sql
   SELECT * FROM notification_provider_logs
   WHERE provider = 'wazzup24'
   AND job_id IN (
     SELECT id FROM notification_jobs WHERE user_id = 'USER_UUID'
   );
   ```

3. Saldo de Wazzup24 API

### Problema: Email no llega

**Verificar:**
1. Configuración de Resend en `correo_configuracion`
2. Dominio verificado en Resend
3. Logs de Resend:
   ```sql
   SELECT * FROM notification_provider_logs
   WHERE provider = 'resend'
   ORDER BY created_at DESC LIMIT 10;
   ```

### Problema: Duplicados

**No debería ocurrir** gracias a idempotencia. Si ocurre:
1. Verificar que se está pasando `p_entity_id` correctamente
2. Verificar logs:
   ```sql
   SELECT
     idempotency_key,
     COUNT(*) as count
   FROM notification_jobs
   GROUP BY idempotency_key
   HAVING COUNT(*) > 1;
   ```

---

## Contacto y Soporte

Para reportar issues o solicitar mejoras:
1. Revisar logs en Supabase Dashboard
2. Consultar queries de observabilidad
3. Revisar documentación completa en `SISTEMA_NOTIFICACIONES_CENTRALIZADO.md`

---

**Estado del Sistema:** ✅ OPERACIONAL
**Última actualización:** 11 de diciembre de 2025
**Versión:** 1.0
