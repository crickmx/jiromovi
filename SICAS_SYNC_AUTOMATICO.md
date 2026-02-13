# Configuración de Sincronización Automática SICAS

Este documento explica cómo configurar la sincronización automática de datos SICAS usando Supabase Scheduled Edge Functions.

## Resumen del Sistema

El sistema de sincronización consta de 4 edge functions principales:

1. **sicas-sync-documents** - Sincroniza documentos/pólizas cada 3 horas
2. **sicas-sync-commissions** - Sincroniza comisiones cada 6 horas
3. **sicas-sync-receivables** - Sincroniza cobranza pendiente cada 12 horas
4. **sicas-get-digital-files** - Carga archivos bajo demanda (no requiere cron)

---

## Opción 1: Supabase Dashboard (RECOMENDADO)

### Paso 1: Acceder al Dashboard de Supabase

1. Ingresa a https://supabase.com/dashboard
2. Selecciona tu proyecto MOVI
3. En el menú lateral, navega a **Edge Functions**

### Paso 2: Configurar Cron para Documentos

1. Busca la función `sicas-sync-documents` en la lista
2. Haz clic en el nombre de la función
3. Ve a la pestaña **Settings** o **Configuration**
4. Busca la sección **Cron Jobs** o **Scheduled Triggers**
5. Habilita el scheduled trigger
6. Configura el schedule usando sintaxis cron:
   ```
   0 */3 * * *
   ```
   Esto ejecutará la función cada 3 horas (a las 00:00, 03:00, 06:00, etc.)

7. Guarda la configuración

### Paso 3: Configurar Cron para Comisiones Pendientes

1. Busca la función `sicas-sync-commissions`
2. Configura el schedule:
   ```
   0 */6 * * *
   ```
   Esto ejecutará cada 6 horas

3. En el campo de configuración adicional o payload JSON, agrega:
   ```json
   {
     "source": "pendiente"
   }
   ```

### Paso 4: Configurar Cron para Comisiones Pagadas

Puedes usar la misma función pero con diferente schedule:

1. Crea un segundo scheduled trigger para `sicas-sync-commissions`
2. Configura el schedule:
   ```
   0 0,12 * * *
   ```
   Esto ejecutará cada 12 horas (medianoche y mediodía)

3. Configura el payload:
   ```json
   {
     "source": "pagada"
   }
   ```

### Paso 5: Configurar Cron para Cobranza

1. Busca la función `sicas-sync-receivables`
2. Configura el schedule:
   ```
   30 */12 * * *
   ```
   Esto ejecutará cada 12 horas (a las 00:30 y 12:30)

---

## Opción 2: Supabase CLI (Para desarrollo local)

Si estás trabajando localmente con Supabase CLI:

### 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2. Iniciar sesión

```bash
supabase login
```

### 3. Vincular proyecto

```bash
supabase link --project-ref YOUR_PROJECT_ID
```

### 4. Configurar cron jobs

Crea un archivo `supabase/functions/_config/cron.yaml`:

```yaml
jobs:
  - name: sync-sicas-documents
    function: sicas-sync-documents
    schedule: "0 */3 * * *"

  - name: sync-sicas-commissions-pending
    function: sicas-sync-commissions
    schedule: "0 */6 * * *"
    payload:
      source: "pendiente"

  - name: sync-sicas-commissions-paid
    function: sicas-sync-commissions
    schedule: "0 0,12 * * *"
    payload:
      source: "pagada"

  - name: sync-sicas-receivables
    function: sicas-sync-receivables
    schedule: "30 */12 * * *"
```

### 5. Desplegar configuración

```bash
supabase functions deploy
```

---

## Opción 3: Servicios Externos (Alternativa)

Si Supabase no soporta cron jobs en tu plan, puedes usar servicios externos:

### A) GitHub Actions

Crea `.github/workflows/sicas-sync.yml`:

```yaml
name: SICAS Sync

on:
  schedule:
    # Documentos cada 3 horas
    - cron: '0 */3 * * *'
    # Comisiones cada 6 horas
    - cron: '0 */6 * * *'
    # Cobranza cada 12 horas
    - cron: '30 */12 * * *'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sync Documents
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            https://YOUR_PROJECT.supabase.co/functions/v1/sicas-sync-documents
```

### B) Vercel Cron Jobs

En `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-documents",
      "schedule": "0 */3 * * *"
    },
    {
      "path": "/api/cron/sync-commissions",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Y crea endpoints en `api/cron/`:

```javascript
// api/cron/sync-documents.js
export default async function handler(req, res) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/sicas-sync-documents`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();
  res.json(data);
}
```

### C) Cron-job.org (Servicio gratuito)

1. Registra en https://cron-job.org
2. Crea un nuevo cron job
3. URL: `https://YOUR_PROJECT.supabase.co/functions/v1/sicas-sync-documents`
4. Método: POST
5. Headers:
   ```
   Authorization: Bearer YOUR_SERVICE_ROLE_KEY
   Content-Type: application/json
   ```
6. Schedule: cada 3 horas

---

## Verificar que los Cron Jobs Funcionen

### 1. Revisar la tabla de auditoría

```sql
SELECT
  module,
  keycode,
  status,
  records_fetched,
  records_upserted,
  records_failed,
  started_at,
  finished_at,
  duration_seconds
FROM sicas_sync_runs
ORDER BY started_at DESC
LIMIT 20;
```

### 2. Ver último sync por módulo

```sql
SELECT
  module,
  keycode,
  last_success_at,
  last_cursor_date,
  total_synced
FROM sicas_sync_cursors;
```

### 3. Monitorear logs en Supabase Dashboard

1. Ve a Edge Functions
2. Selecciona la función
3. Ve a la pestaña **Logs**
4. Filtra por tiempo para ver ejecuciones recientes

---

## Sintaxis de Cron

Referencia rápida de sintaxis cron:

```
┌───────────── minuto (0-59)
│ ┌───────────── hora (0-23)
│ │ ┌───────────── día del mes (1-31)
│ │ │ ┌───────────── mes (1-12)
│ │ │ │ ┌───────────── día de la semana (0-7, 0 y 7 = domingo)
│ │ │ │ │
* * * * *
```

Ejemplos comunes:

- `0 */3 * * *` - Cada 3 horas en punto
- `0 */6 * * *` - Cada 6 horas en punto
- `0 0,12 * * *` - A medianoche y mediodía
- `30 */12 * * *` - Cada 12 horas a los 30 minutos
- `0 9 * * *` - Todos los días a las 9:00 AM
- `0 0 * * 0` - Todos los domingos a medianoche
- `*/15 * * * *` - Cada 15 minutos

---

## Frecuencias Recomendadas

Basado en el uso típico:

| Módulo | Frecuencia | Razón |
|--------|-----------|-------|
| Documentos | Cada 3 horas | Producción activa requiere actualización frecuente |
| Comisiones Pendientes | Cada 6 horas | Se actualiza varias veces al día |
| Comisiones Pagadas | Cada 12-24 horas | Cambios menos frecuentes |
| Cobranza | Cada 12-24 horas | Actualización diaria es suficiente |

Puedes ajustar estas frecuencias según tu volumen de datos y necesidades.

---

## Troubleshooting

### El cron job no se ejecuta

1. Verifica que el scheduled trigger esté habilitado
2. Revisa los logs de la edge function
3. Confirma que la sintaxis cron sea correcta
4. Verifica que el proyecto tenga permisos suficientes

### Errores de token

Si ves errores de "Token Inactivo":

1. Verifica que las variables de entorno estén configuradas:
   - `SICAS_REST_API_URL`
   - `SICAS_USERNAME`
   - `SICAS_PASSWORD`

2. El token se renueva automáticamente, pero si hay problemas persistentes, contacta a soporte SICAS

### Errores de timeout

Si las sincronizaciones tardan mucho:

1. Reduce el `itemsPerPage` en las edge functions (cambiar de 100 a 50)
2. Aumenta la frecuencia de sync (sincronizar más seguido con menos datos cada vez)
3. Revisa si hay problemas de red con SICAS

### No se sincronizan todos los registros

1. Revisa la tabla `sicas_sync_cursors` para ver el último cursor
2. Ejecuta una sincronización manual con fechas específicas
3. Verifica que el mapeo de vendedores esté correcto

---

## Sincronización Manual desde UI

Los usuarios administradores pueden ejecutar sincronizaciones manuales desde:

**Ruta**: `/mi-produccion-sicas`

**Botón**: "Sincronizar" en la esquina superior derecha

Esto es útil para:
- Sincronización inicial
- Recuperación después de errores
- Forzar actualización inmediata
- Testing y debugging

---

## Mejores Prácticas

1. **Empieza con frecuencias bajas** (cada 12-24 horas) y ajusta según necesidad
2. **Monitorea logs** durante la primera semana
3. **Revisa tablas de auditoría** regularmente
4. **Mantén backups** de la base de datos espejo
5. **Documenta cambios** en configuración de cron
6. **Alerta a equipo** sobre cambios en frecuencias

---

## Contacto y Soporte

Si tienes problemas configurando los cron jobs:

1. Revisa los logs en Supabase Dashboard
2. Consulta la documentación de Supabase: https://supabase.com/docs/guides/functions
3. Ejecuta una sincronización manual para verificar que las funciones trabajen correctamente
