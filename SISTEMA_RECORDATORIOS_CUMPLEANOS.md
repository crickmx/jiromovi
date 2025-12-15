# Sistema de Recordatorios de Cumpleaños - Mi CRM

## ¿Qué hace este sistema?

El sistema de recordatorios de cumpleaños detecta automáticamente cuando un contacto del CRM cumple años y:

1. ✅ Genera una **notificación interna** (campanita) para el usuario dueño del contacto
2. ✅ Crea un **evento en el calendario del Dashboard** visible para el usuario
3. ✅ Evita duplicados (solo 1 recordatorio por año por contacto)
4. ✅ Respeta permisos (solo el dueño del contacto recibe el recordatorio)

---

## Componentes del Sistema

### 1. Base de Datos

Se crearon las siguientes tablas:

- **`crm_contactos.fecha_nacimiento`**: Campo DATE para almacenar la fecha de nacimiento (solo para tipo "Persona")
- **`crm_birthday_reminders`**: Rastrea recordatorios ya generados (evita duplicados)
- **`dashboard_calendar_events`**: Almacena eventos del calendario del Dashboard

### 2. Edge Function

**Función**: `process-birthday-reminders`
**Ubicación**: `/supabase/functions/process-birthday-reminders/index.ts`

Esta función:
- Se ejecuta diariamente
- Detecta contactos con cumpleaños hoy (día/mes, ignora año)
- Solo procesa contactos tipo "Persona" con fecha_nacimiento
- Verifica que no exista recordatorio para este año
- Genera notificación interna y evento de calendario
- Registra el recordatorio para evitar duplicados

### 3. UI Mejorada

**Formulario de Contacto**:
- Nuevo campo "Fecha de Nacimiento" (solo visible para tipo "Persona")
- Validación automática (no permite fechas futuras)
- Mensaje informativo sobre recordatorios automáticos

**Perfil de Contacto**:
- Muestra cumpleaños con formato DD/MM
- Muestra edad calculada
- Badge animado "🎂 ¡Hoy!" cuando es el cumpleaños del contacto

---

## Configuración del Cron Job

### Opción 1: Cron Service Externo (Recomendado)

Usar un servicio de cron externo para ejecutar la función diariamente:

**1. Cron-job.org (Gratis)**
- Ir a: https://cron-job.org
- Crear cuenta
- Crear nuevo job:
  - **URL**: `https://[tu-proyecto].supabase.co/functions/v1/process-birthday-reminders`
  - **Método**: POST
  - **Headers**:
    - `Authorization: Bearer [SUPABASE_ANON_KEY]`
    - `Content-Type: application/json`
  - **Schedule**: Diario a las 08:00 AM (hora del servidor)

**2. EasyCron (Gratis hasta 20 jobs)**
- Ir a: https://www.easycron.com
- Similar configuración

**3. GitHub Actions (Gratis para repos públicos)**

Crear archivo `.github/workflows/birthday-reminders.yml`:

```yaml
name: Birthday Reminders
on:
  schedule:
    - cron: '0 8 * * *'  # Diario a las 08:00 UTC
  workflow_dispatch:  # Permite ejecución manual

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Birthday Reminders
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            https://[tu-proyecto].supabase.co/functions/v1/process-birthday-reminders
```

### Opción 2: Supabase pg_cron (Requiere upgrade)

Si tienes un plan de Supabase Pro o superior:

```sql
-- Habilitar pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Configurar job diario
SELECT cron.schedule(
  'birthday-reminders-daily',
  '0 8 * * *',  -- Diario a las 08:00
  $$
  SELECT net.http_post(
    url := 'https://[tu-proyecto].supabase.co/functions/v1/process-birthday-reminders',
    headers := '{"Authorization": "Bearer [SUPABASE_ANON_KEY]", "Content-Type": "application/json"}',
    body := '{}'
  )
  $$
);
```

---

## Ejecución Manual (Pruebas)

### Desde cURL:

```bash
curl -X POST \
  -H "Authorization: Bearer [SUPABASE_ANON_KEY]" \
  -H "Content-Type: application/json" \
  https://[tu-proyecto].supabase.co/functions/v1/process-birthday-reminders
```

### Respuesta esperada:

```json
{
  "success": true,
  "message": "Procesados 2 cumpleaños",
  "date": "15/12/2024",
  "total_found": 2,
  "processed": 2,
  "results": [
    {
      "contacto": "Juan Pérez",
      "success": true,
      "notificacion": true,
      "calendario": true
    },
    {
      "contacto": "María González",
      "success": true,
      "notificacion": true,
      "calendario": true
    }
  ]
}
```

---

## Pruebas

### Escenario 1: Cumpleaños Hoy

1. Crear contacto tipo "Persona"
2. Establecer fecha_nacimiento con día/mes de hoy (cualquier año)
3. Ejecutar manualmente el Edge Function
4. Verificar:
   - ✅ Aparece notificación en campanita
   - ✅ Aparece evento en calendario Dashboard
   - ✅ Badge "🎂 ¡Hoy!" visible en perfil del contacto

### Escenario 2: No Duplicados

1. Ejecutar la función 2 veces el mismo día
2. Verificar:
   - ✅ Solo 1 notificación generada
   - ✅ Solo 1 evento en calendario
   - ✅ Registro en `crm_birthday_reminders` para este año

### Escenario 3: Contacto Tipo Empresa

1. Crear contacto tipo "Empresa" con fecha_nacimiento
2. Ejecutar la función
3. Verificar:
   - ✅ NO genera notificación ni evento

### Escenario 4: Sin Fecha de Nacimiento

1. Crear contacto sin fecha_nacimiento
2. Ejecutar la función
3. Verificar:
   - ✅ NO genera notificación ni evento

---

## Seguridad y Privacidad

✅ **RLS Habilitado**: Solo el dueño del contacto ve sus recordatorios
✅ **No Expone Datos**: Las notificaciones solo van al usuario correcto
✅ **Idempotencia**: No genera duplicados por año
✅ **Service Role**: El Edge Function usa credenciales de servicio para crear notificaciones

---

## Monitoreo

### Ver recordatorios generados:

```sql
SELECT
  cr.year,
  cc.nombre_completo,
  u.nombre || ' ' || u.apellidos as usuario,
  cr.notificacion_enviada,
  cr.calendario_creado,
  cr.fecha_generado
FROM crm_birthday_reminders cr
JOIN crm_contactos cc ON cr.contacto_id = cc.id
JOIN usuarios u ON cr.usuario_id = u.id
WHERE cr.year = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY cr.fecha_generado DESC;
```

### Ver eventos de cumpleaños en calendario:

```sql
SELECT
  dce.titulo,
  dce.fecha_inicio,
  u.nombre || ' ' || u.apellidos as usuario
FROM dashboard_calendar_events dce
JOIN usuarios u ON dce.usuario_id = u.id
WHERE dce.tipo_evento = 'cumpleanos'
  AND EXTRACT(YEAR FROM dce.fecha_inicio) = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY dce.fecha_inicio DESC;
```

---

## Mantenimiento

### Limpiar recordatorios antiguos (anualmente):

```sql
-- Eliminar recordatorios de años anteriores (enero cada año)
DELETE FROM crm_birthday_reminders
WHERE year < EXTRACT(YEAR FROM CURRENT_DATE);
```

### Limpiar eventos de calendario antiguos:

```sql
-- Eliminar eventos de cumpleaños del año pasado
DELETE FROM dashboard_calendar_events
WHERE tipo_evento = 'cumpleanos'
  AND EXTRACT(YEAR FROM fecha_inicio) < EXTRACT(YEAR FROM CURRENT_DATE);
```

---

## Troubleshooting

### ❌ No se generan notificaciones

**Verificar**:
1. El contacto es tipo "Persona"
2. Tiene fecha_nacimiento configurada
3. El día/mes coincide con hoy
4. No existe recordatorio para este año
5. El Edge Function tiene permisos correctos

**Solución**:
```sql
-- Verificar contactos con cumpleaños hoy
SELECT
  id,
  nombre_completo,
  fecha_nacimiento,
  tipo_contacto
FROM crm_contactos
WHERE tipo_contacto = 'Persona'
  AND fecha_nacimiento IS NOT NULL
  AND EXTRACT(MONTH FROM fecha_nacimiento) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(DAY FROM fecha_nacimiento) = EXTRACT(DAY FROM CURRENT_DATE);
```

### ❌ Duplicados

**Causa**: El job corre múltiples veces por día

**Solución**:
1. Configurar cron para ejecutar solo 1 vez al día
2. Verificar que no existen múltiples jobs configurados
3. El sistema ya previene duplicados, pero es mejor evitar ejecuciones extras

---

## Próximos Pasos (Opcional)

### Mejoras Futuras:

1. **Recordatorio Anticipado**: Notificar 1 día antes del cumpleaños
2. **Email Automático**: Enviar email además de notificación interna
3. **WhatsApp**: Integrar con sistema de WhatsApp para envío automático
4. **Plantillas Personalizadas**: Permitir al usuario personalizar el mensaje
5. **Estadísticas**: Dashboard de cumpleaños del mes

---

## Resumen

✅ Sistema completamente funcional
✅ Sin duplicados
✅ Respeta permisos y privacidad
✅ UI mejorada con indicadores visuales
✅ Edge Function desplegado y listo
⚠️ **Falta**: Configurar cron job para ejecución diaria automática

**Acción Requerida**: Configurar un cron job usando una de las opciones mencionadas arriba para que el sistema funcione completamente automático.
