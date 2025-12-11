# Sistema de Notificaciones Centralizado - MOVI Digital

## Resumen Ejecutivo

Este documento describe el sistema centralizado de notificaciones que garantiza:
- Entrega 100% confiable por todos los canales (campanita, WhatsApp, email)
- Cero duplicados mediante idempotencia
- Trazabilidad total con logs y estados
- Observabilidad completa con métricas y dashboard

---

## 1. Catálogo de Eventos

### Eventos Implementados

| Evento | Código | Módulo | Canales | Estado |
|--------|--------|---------|---------|--------|
| Nuevo Comunicado | `nuevo_comunicado` | Comunicados | 🔔📧📱 | ✅ Activo |
| Nuevo Evento Aula | `nuevo_evento` | Seguros Education | 🔔📧📱 | ✅ Activo |
| Usuario Bienvenida | `bienvenida` | Usuarios | 📧📱 | ✅ Activo |
| Cuenta Activada | `cuenta_activada` | Usuarios | 🔔📧📱 | ✅ Activo |
| Reset Password | `password_reset` | Usuarios | 📧 | ✅ Activo |
| Comisiones Cerradas | `commission_batch_closed_agent` | Comisiones | 🔔📧📱 | ✅ Activo |
| Notificación Individual | `notificacion_individual` | Sistema | 🔔📱 | ✅ Activo |
| Notificación Global | `notificacion_global` | Sistema | 🔔📱 | ✅ Activo |

### Eventos Pendientes de Implementación

| Evento | Código | Módulo | Prioridad |
|--------|--------|---------|-----------|
| Solicitud Vacaciones | `vacaciones_solicitada` | Vacaciones | 🔴 Alta |
| Vacaciones Aprobada | `vacaciones_aprobada` | Vacaciones | 🔴 Alta |
| Vacaciones Rechazada | `vacaciones_rechazada` | Vacaciones | 🔴 Alta |
| Nuevo Trámite | `tramite_nuevo` | Trámites | 🔴 Alta |
| Trámite Asignado | `tramite_asignado` | Trámites | 🔴 Alta |
| Trámite Actualizado | `tramite_actualizado` | Trámites | 🟡 Media |
| Trámite Cerrado | `tramite_cerrado` | Trámites | 🟡 Media |
| Reserva Solicitada | `reserva_solicitada` | Espacio JIRO | 🔴 Alta |
| Reserva Aprobada | `reserva_aprobada` | Espacio JIRO | 🔴 Alta |
| Reserva Rechazada | `reserva_rechazada` | Espacio JIRO | 🔴 Alta |
| Recordatorio Reserva | `recordatorio_reserva` | Espacio JIRO | 🟡 Media |
| Nuevo Pedido Store | `store_nuevo_pedido` | Store | 🟡 Media |
| Pedido Actualizado | `store_pedido_actualizado` | Store | 🟡 Media |

**Leyenda:** 🔔 Campanita | 📧 Email | 📱 WhatsApp

---

## 2. Arquitectura del Sistema

### 2.1 Flujo de Notificaciones

```
┌─────────────────┐
│  Evento Origen  │ (Comunicado, Usuario, Comisión, etc)
└────────┬────────┘
         │
         v
┌─────────────────────────────────┐
│ Notification Orchestrator (RPC) │ ← Motor Central Único
│  - Valida datos                 │
│  - Resuelve destinatarios       │
│  - Verifica idempotencia        │
│  - Crea notification_job        │
└────────┬────────────────────────┘
         │
         v
┌────────────────────────────────────┐
│    Channel Dispatcher              │
│  ┌─────────┬─────────┬──────────┐ │
│  │Campanita│ WhatsApp│  Email   │ │
│  └────┬────┴────┬────┴────┬─────┘ │
└───────┼─────────┼─────────┼───────┘
        │         │         │
        v         v         v
   ┌────────┐ ┌──────┐ ┌──────┐
   │ Insert │ │Wazzup│ │Resend│
   │  DB    │ │ API  │ │ API  │
   └────┬───┘ └───┬──┘ └──┬───┘
        │         │        │
        v         v        v
   ┌─────────────────────────┐
   │ Notification Logs       │
   │  - Estado por canal     │
   │  - Provider IDs         │
   │  - Errores              │
   │  - Reintentos           │
   └─────────────────────────┘
```

### 2.2 Base de Datos - Tablas Centrales

#### `notification_events_catalog`
Catálogo central de todos los eventos de notificación.

```sql
CREATE TABLE notification_events_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text UNIQUE NOT NULL,
  event_name text NOT NULL,
  module text NOT NULL,
  description text,
  enable_in_app boolean DEFAULT true,
  enable_email boolean DEFAULT false,
  enable_whatsapp boolean DEFAULT false,
  template_in_app jsonb,
  template_email text,
  template_whatsapp text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `notification_jobs`
Un job por cada notificación + usuario + canal.

```sql
CREATE TABLE notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL REFERENCES notification_events_catalog(event_code),
  user_id uuid NOT NULL REFERENCES usuarios(id),
  channel text NOT NULL, -- 'in_app', 'email', 'whatsapp'
  status text NOT NULL DEFAULT 'pending', -- pending, sent, failed, retrying
  payload jsonb NOT NULL,
  idempotency_key text UNIQUE NOT NULL,
  attempt_count integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notification_jobs_status ON notification_jobs(status);
CREATE INDEX idx_notification_jobs_user ON notification_jobs(user_id);
CREATE INDEX idx_notification_jobs_event ON notification_jobs(event_code);
CREATE INDEX idx_notification_jobs_created ON notification_jobs(created_at DESC);
```

#### `notification_provider_logs`
Logs de interacción con providers externos (Wazzup24, Resend).

```sql
CREATE TABLE notification_provider_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES notification_jobs(id),
  provider text NOT NULL, -- 'wazzup24', 'resend'
  provider_message_id text,
  request_payload jsonb,
  response_payload jsonb,
  http_status integer,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_provider_logs_job ON notification_provider_logs(job_id);
CREATE INDEX idx_provider_logs_provider ON notification_provider_logs(provider);
```

#### `notification_delivery_attempts`
Historial de reintentos.

```sql
CREATE TABLE notification_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES notification_jobs(id),
  attempt_number integer NOT NULL,
  status text NOT NULL, -- 'sent', 'failed'
  error_message text,
  attempted_at timestamptz DEFAULT now()
);

CREATE INDEX idx_delivery_attempts_job ON notification_delivery_attempts(job_id);
```

---

## 3. Motor Central de Notificaciones

### 3.1 Función Principal: `notify()`

```sql
CREATE OR REPLACE FUNCTION notify(
  p_event_code text,
  p_user_ids uuid[],
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event record;
  v_user_id uuid;
  v_user record;
  v_idempotency_key text;
  v_job_id uuid;
  v_jobs_created integer := 0;
  v_jobs_skipped integer := 0;
  v_result jsonb;
BEGIN
  -- Obtener configuración del evento
  SELECT * INTO v_event
  FROM notification_events_catalog
  WHERE event_code = p_event_code AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento no encontrado o inactivo: %', p_event_code;
  END IF;

  -- Procesar cada usuario
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    -- Obtener datos del usuario
    SELECT
      id, nombre, apellidos, nombre_completo,
      correo_electronico_laboral, correo_electronico,
      celular_laboral, celular_personal,
      estado
    INTO v_user
    FROM usuarios
    WHERE id = v_user_id;

    IF NOT FOUND OR v_user.estado != 'activo' THEN
      CONTINUE;
    END IF;

    -- Canal: In-App (Campanita)
    IF v_event.enable_in_app THEN
      v_idempotency_key := p_event_code || '_' || v_user_id::text || '_in_app_' ||
        md5(p_payload::text);

      INSERT INTO notification_jobs (
        event_code, user_id, channel, status, payload, idempotency_key
      )
      VALUES (
        p_event_code, v_user_id, 'in_app', 'pending', p_payload, v_idempotency_key
      )
      ON CONFLICT (idempotency_key) DO NOTHING;

      IF FOUND THEN
        v_jobs_created := v_jobs_created + 1;
      ELSE
        v_jobs_skipped := v_jobs_skipped + 1;
      END IF;
    END IF;

    -- Canal: Email
    IF v_event.enable_email THEN
      IF v_user.correo_electronico_laboral IS NOT NULL OR v_user.correo_electronico IS NOT NULL THEN
        v_idempotency_key := p_event_code || '_' || v_user_id::text || '_email_' ||
          md5(p_payload::text);

        INSERT INTO notification_jobs (
          event_code, user_id, channel, status, payload, idempotency_key
        )
        VALUES (
          p_event_code, v_user_id, 'email', 'pending', p_payload, v_idempotency_key
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

        IF FOUND THEN
          v_jobs_created := v_jobs_created + 1;
        ELSE
          v_jobs_skipped := v_jobs_skipped + 1;
        END IF;
      END IF;
    END IF;

    -- Canal: WhatsApp
    IF v_event.enable_whatsapp THEN
      IF v_user.celular_laboral IS NOT NULL OR v_user.celular_personal IS NOT NULL THEN
        v_idempotency_key := p_event_code || '_' || v_user_id::text || '_whatsapp_' ||
          md5(p_payload::text);

        INSERT INTO notification_jobs (
          event_code, user_id, channel, status, payload, idempotency_key
        )
        VALUES (
          p_event_code, v_user_id, 'whatsapp', 'pending', p_payload, v_idempotency_key
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

        IF FOUND THEN
          v_jobs_created := v_jobs_created + 1;
        ELSE
          v_jobs_skipped := v_jobs_skipped + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Retornar estadísticas
  v_result := jsonb_build_object(
    'success', true,
    'jobs_created', v_jobs_created,
    'jobs_skipped', v_jobs_skipped,
    'event_code', p_event_code,
    'users_processed', array_length(p_user_ids, 1)
  );

  RETURN v_result;
END;
$$;
```

### 3.2 Funciones Helper de Resolución de Destinatarios

```sql
-- Obtener usuarios por rol
CREATE OR REPLACE FUNCTION get_users_by_role(p_role text)
RETURNS uuid[]
LANGUAGE sql
AS $$
  SELECT array_agg(id)
  FROM usuarios
  WHERE rol = p_role AND estado = 'activo';
$$;

-- Obtener usuarios por oficina
CREATE OR REPLACE FUNCTION get_users_by_office(p_office_id uuid)
RETURNS uuid[]
LANGUAGE sql
AS $$
  SELECT array_agg(id)
  FROM usuarios
  WHERE oficina_id = p_office_id AND estado = 'activo';
$$;

-- Obtener usuarios por rol en oficina (para gerentes)
CREATE OR REPLACE FUNCTION get_users_by_role_in_office(
  p_role text,
  p_office_id uuid
)
RETURNS uuid[]
LANGUAGE sql
AS $$
  SELECT array_agg(id)
  FROM usuarios
  WHERE rol = p_role AND oficina_id = p_office_id AND estado = 'activo';
$$;

-- Obtener todos los administradores
CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS uuid[]
LANGUAGE sql
AS $$
  SELECT array_agg(id)
  FROM usuarios
  WHERE rol = 'Administrador' AND estado = 'activo';
$$;
```

---

## 4. Normalización de Teléfonos

### 4.1 Función de Normalización

```sql
CREATE OR REPLACE FUNCTION normalize_phone_mx(p_phone text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_clean text;
  v_digits text;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN NULL;
  END IF;

  -- Remover espacios, guiones, paréntesis
  v_clean := regexp_replace(p_phone, '[^0-9+]', '', 'g');

  -- Si empieza con +52, remover
  IF v_clean LIKE '+52%' THEN
    v_clean := substring(v_clean from 4);
  END IF;

  -- Si empieza con 52, remover
  IF v_clean LIKE '52%' AND length(v_clean) = 12 THEN
    v_clean := substring(v_clean from 3);
  END IF;

  -- Validar que tenga exactamente 10 dígitos
  IF length(v_clean) != 10 THEN
    RETURN NULL;
  END IF;

  -- Retornar en formato E.164
  RETURN '+52' || v_clean;
END;
$$;
```

### 4.2 Trigger de Normalización Automática

```sql
CREATE OR REPLACE FUNCTION trigger_normalize_phones()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.celular_laboral := normalize_phone_mx(NEW.celular_laboral);
  NEW.celular_personal := normalize_phone_mx(NEW.celular_personal);
  RETURN NEW;
END;
$$;

CREATE TRIGGER usuarios_normalize_phones
BEFORE INSERT OR UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION trigger_normalize_phones();
```

---

## 5. Edge Functions Mejoradas

### 5.1 Dispatcher Worker (Procesador de Jobs)

**Archivo:** `supabase/functions/notification-dispatcher/index.ts`

```typescript
// Procesa jobs pendientes y los envía por el canal correspondiente
// Se ejecuta periódicamente (ej: cada 30 segundos)

Deno.serve(async (req) => {
  // 1. Obtener jobs pendientes (status = 'pending' o 'retrying')
  // 2. Para cada job:
  //    a. Marcar como 'processing'
  //    b. Según el canal:
  //       - in_app: Insert en tabla notificaciones
  //       - email: Llamar a Resend API
  //       - whatsapp: Llamar a Wazzup24 API
  //    c. Guardar log en notification_provider_logs
  //    d. Actualizar status del job
  //    e. Si falla y attempt_count < max_attempts: programar reintento
});
```

### 5.2 WhatsApp con Wazzup24

**Actualizar:** `supabase/functions/enviar-whatsapp/index.ts`

```typescript
const WAZZUP24_API_KEY = 'aeaecead58f14a3286b37e4d0b81dc3a';
const WAZZUP24_CHANNEL = '5215588545516';

async function sendWhatsApp(phone: string, message: string) {
  const response = await fetch('https://api.wazzup24.com/v3/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WAZZUP24_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channelId: WAZZUP24_CHANNEL,
      chatId: phone,
      chatType: 'whatsapp',
      text: message
    })
  });

  return response.json();
}
```

---

## 6. UI de Administración

### 6.1 Centro de Notificaciones Admin

**Componente:** `src/pages/NotificacionesObservabilidad.tsx`

**Funcionalidades:**
1. **Dashboard de Métricas**
   - Notificaciones enviadas hoy/semana/mes
   - % éxito por canal
   - Top 5 errores
   - Gráficas de tendencia

2. **Monitor de Jobs**
   - Tabla con todos los jobs
   - Filtros: evento, usuario, canal, estado, fecha
   - Acciones: Ver detalles, Reenviar

3. **Logs de Providers**
   - Request/Response de cada provider
   - Provider Message IDs
   - Errores detallados

4. **Catálogo de Eventos**
   - Lista de todos los eventos
   - Activar/desactivar canales por evento
   - Editar plantillas

### 6.2 Panel de Pruebas

**Componente:** `src/pages/NotificacionesPrueba.tsx`

**Funcionalidades:**
1. Seleccionar evento del catálogo
2. Seleccionar usuario destino
3. Seleccionar canales a probar
4. Ingresar datos de prueba (payload)
5. Ver resultado en tiempo real
6. Ver logs generados

---

## 7. Testing

### 7.1 Unit Tests

```typescript
// Normalización de teléfonos
test('normalize_phone_mx', () => {
  expect(normalize('5512345678')).toBe('+525512345678');
  expect(normalize('+525512345678')).toBe('+525512345678');
  expect(normalize('55 1234 5678')).toBe('+525512345678');
  expect(normalize('(55) 1234-5678')).toBe('+525512345678');
  expect(normalize('123')).toBe(null);
});

// Resolución de destinatarios
test('get_users_by_role', () => {
  const users = get_users_by_role('Agente');
  expect(users.length).toBeGreaterThan(0);
});

// Idempotencia
test('idempotency', () => {
  const result1 = notify('nuevo_comunicado', [user1], payload);
  const result2 = notify('nuevo_comunicado', [user1], payload);
  expect(result2.jobs_created).toBe(0);
  expect(result2.jobs_skipped).toBe(3); // 3 canales
});
```

### 7.2 Integration Tests

```typescript
test('comunicado_publishes_and_notifies', async () => {
  // 1. Crear comunicado
  const comunicado = await crearComunicado({...});

  // 2. Verificar jobs creados
  const jobs = await getJobsByEvent('nuevo_comunicado');
  expect(jobs.length).toBeGreaterThan(0);

  // 3. Verificar campanita
  const notifications = await getNotifications(userId);
  expect(notifications).toContainEqual(
    expect.objectContaining({ titulo: `Nuevo comunicado: ${titulo}` })
  );

  // 4. Verificar email (mock)
  expect(resendMock).toHaveBeenCalled();

  // 5. Verificar WhatsApp (mock)
  expect(wazzupMock).toHaveBeenCalled();
});
```

---

## 8. Roadmap de Implementación

### Fase 1: Infraestructura (Días 1-2)
- [x] Auditoría completa de eventos existentes
- [ ] Crear tablas de base de datos
- [ ] Implementar función `notify()` central
- [ ] Implementar normalización de teléfonos

### Fase 2: Motor y Workers (Días 3-4)
- [ ] Crear notification-dispatcher edge function
- [ ] Implementar integración Wazzup24
- [ ] Implementar sistema de reintentos
- [ ] Crear funciones de resolución de destinatarios

### Fase 3: UI Administración (Días 5-6)
- [ ] Dashboard de observabilidad
- [ ] Monitor de jobs
- [ ] Logs de providers
- [ ] Panel de pruebas

### Fase 4: Migración (Días 7-8)
- [ ] Migrar eventos existentes al nuevo sistema
- [ ] Implementar eventos pendientes (Vacaciones, Trámites, Reservas)
- [ ] Actualizar catálogo de eventos
- [ ] Crear plantillas para nuevos eventos

### Fase 5: Testing y QA (Días 9-10)
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests de cada módulo
- [ ] Testing de carga
- [ ] Testing de reintentos y errores

### Fase 6: Documentación y Entrega (Día 11)
- [ ] Documentación de API
- [ ] Guía de uso para desarrolladores
- [ ] Guía de administración
- [ ] Runbook de troubleshooting

---

## 9. Métricas de Éxito

El sistema se considera **100% funcional** cuando:

- ✅ Todos los eventos disparan notificaciones correctas
- ✅ No existen duplicados (idempotencia verificada)
- ✅ Logs y estados se guardan en todas las entregas
- ✅ UI de campanita refleja 100% de notificaciones
- ✅ WhatsApp y Email tienen envío trazable (provider ID + status)
- ✅ % de éxito global > 95%
- ✅ Tiempo promedio de entrega < 5 segundos
- ✅ Reintentos funcionan correctamente
- ✅ Dashboard de admin muestra métricas en tiempo real
- ✅ Panel de pruebas permite validar cualquier evento

---

## 10. Troubleshooting

### Notificación no se recibe

1. Verificar en `notification_jobs` si se creó el job
2. Verificar estado del job (pending, sent, failed)
3. Si failed, revisar `last_error`
4. Revisar logs en `notification_provider_logs`
5. Verificar datos del usuario (email/teléfono válido)

### Duplicados

1. Verificar idempotency_key en jobs
2. Revisar que payload sea consistente
3. Verificar que no haya múltiples llamadas a `notify()`

### WhatsApp falla

1. Verificar normalización de teléfono
2. Revisar API key de Wazzup24
3. Revisar logs de provider
4. Verificar saldo de Wazzup24

### Email falla

1. Verificar configuración de Resend
2. Revisar API key
3. Verificar dominio verificado
4. Revisar logs de provider

---

**Fin del documento**
