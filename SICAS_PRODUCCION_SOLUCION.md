# Solución de Mi Producción SICAS

## El Problema Original

Tenías 2 problemas distintos:

### 1. Error de CORS y Timeout
```
blocked by CORS policy: No 'Access-Control-Allow-Origin' header
504 (Gateway Timeout)
```

**Causa**: Intentabas llamar directamente a la API REST de SICAS desde el navegador, lo cual:
- Genera problemas de CORS
- Se va a timeout (más de 60 segundos)
- No es escalable ni eficiente

### 2. Respuesta "0" de `handleSync`
```json
{
  "success": true,
  "polizas_vigentes": 0,
  "cobranza_pendiente": 0
}
```

**Causa**: La Edge Function sí funciona, pero no encuentra registros con los filtros/reporte usados.

---

## La Solución Implementada

### Arquitectura Correcta (Base de Datos Espejo)

```
SICAS API
   ↓ (sincronización server-side)
Edge Function (sicas-sync-polizas-vigentes)
   ↓ (guarda en DB)
Tabla: sicas_documents
   ↑ (lee rápido)
Frontend (MiProduccionSICAS.tsx)
```

**Ventajas:**
- Sin CORS
- Sin timeout
- Rápido (lee de DB local)
- Paginación fácil
- Filtros locales
- Cacheable
- Auditable

---

## Qué Se Hizo

### 1. Edge Function: `sicas-sync-polizas-vigentes`
**Ubicación**: `/supabase/functions/sicas-sync-polizas-vigentes/index.ts`

**Qué hace:**
- Se conecta a SICAS SOAP API
- Trae pólizas vigentes (últimos 6 meses hasta + 6 meses)
- Mapea vendedores a usuarios automáticamente
- Guarda en `sicas_documents`
- Registra auditoría en `sicas_sync_runs` y `sicas_sync_cursors`

**Características:**
- Solo trae 50 registros por página (evita timeout)
- Filtros: solo vigentes, solo pólizas
- Ordenado por fecha de captura (más recientes primero)
- Con CORS completo

### 2. Frontend: `MiProduccionSICAS.tsx`
**Ubicación**: `/src/pages/MiProduccionSICAS.tsx`

**Qué hace:**
- Lee directamente de `sicas_documents` (rápido)
- Botón "Sincronizar" para actualizar desde SICAS
- Filtros locales (búsqueda, aseguradora, ramo)
- Estadísticas en tiempo real
- Muestra última fecha de sincronización

**Características:**
- Sin llamadas a API externa desde el navegador
- Filtrado instantáneo (sin recargas)
- Usuarios ven solo sus documentos
- Admins ven todos
- Responsive y con modo oscuro

### 3. Tabla Espejo: `sicas_documents`
**Ubicación**: Ya existía desde migración `20260213172344`

**Estructura:**
- `id_docto` (único)
- `poliza`, `compania`, `ramo`, `subramo`
- `cliente`, `vend_nombre`, `desp_nombre`
- `vigencia_desde`, `vigencia_hasta`
- `prima_neta`, `importe`
- `usuario_id`, `oficina_id` (para RLS)
- `raw_data` (JSON completo de SICAS)
- `synced_at` (timestamp de sincronización)

**RLS:**
- Usuarios ven solo sus documentos
- Gerentes ven documentos de su oficina
- Admins ven todo
- Service role tiene acceso completo

---

## Cómo Usar

### Paso 1: Configurar Credenciales SICAS en Supabase

**IMPORTANTE**: Las credenciales deben estar en Supabase, no solo en `.env` local.

Ve a: https://supabase.com/dashboard/project/qhwvuuyjhcennqccgvse/settings/functions

Agrega estos secrets:

| Nombre | Valor |
|--------|-------|
| `SICAS_USERNAME` | `j1r0%25$` |
| `SICAS_PASSWORD` | `$45oc14d05$` |
| `SICAS_REST_API_URL` | `https://security-services.sicasonline.info/api` |
| `SICAS_SOAP_ENDPOINT` | `https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx` |

Espera 60 segundos para que se apliquen.

### Paso 2: Primera Sincronización

1. Abre la app y ve a **Mi Producción SICAS**
2. Verás "No hay documentos sincronizados"
3. Haz clic en **"Sincronizar"**
4. Espera 10-30 segundos
5. Verás el mensaje: "Sincronización exitosa: X documentos actualizados"

### Paso 3: Usar la Aplicación

**Ver pólizas:**
- Todas las pólizas aparecen en la tabla
- Se muestran las más recientes primero

**Filtrar:**
- Haz clic en "Filtros"
- Busca por: póliza, cliente, ID
- Filtra por aseguradora o ramo

**Sincronizar nuevamente:**
- Haz clic en "Sincronizar" cuando quieras actualizar
- Los datos se actualizan automáticamente

**Estadísticas:**
- Total documentos
- Prima neta total
- Importe total
- Próximas a vencer (30 días)

---

## Troubleshooting

### Error: "Credenciales SICAS no configuradas"
**Solución**: Configura los secrets en Supabase (Paso 1).

### Error: "Error al cargar documentos desde la base de datos"
**Solución**: Verifica que la tabla `sicas_documents` existe. Revisa RLS policies.

### Sincronización devuelve 0 documentos
**Posibles causas:**
1. No hay pólizas vigentes en el rango de fechas (últimos 6 meses)
2. El usuario no tiene pólizas asignadas en SICAS
3. El mapeo vendedor→usuario no está configurado

**Solución para mapeo:**
```sql
-- Ver mapeos actuales
SELECT * FROM sicas_mapeo_vendedores;

-- Crear mapeo manual si falta
INSERT INTO sicas_mapeo_vendedores (vend_nombre, usuario_id)
VALUES ('NOMBRE_EN_SICAS', 'uuid_del_usuario');
```

### Timeout en sincronización
**Causa**: SICAS tarda mucho en responder.

**Solución temporal**: La Edge Function ya limita a 50 registros por página. Si sigue fallando:
1. Reduce el rango de fechas en la función
2. Aumenta el timeout de Supabase (requiere plan Pro)

---

## Próximos Pasos (Opcionales)

### 1. Sincronización Automática
Crear un cron job que sincronice cada 6 horas:

```sql
SELECT cron.schedule(
  'sicas-sync-daily',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/sicas-sync-polizas-vigentes',
    headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

### 2. Paginación en Frontend
Si hay muchos documentos, agregar paginación:
- Limitar a 50 por página
- Botones "Anterior" / "Siguiente"

### 3. Cobranza y Comisiones
Crear funciones similares para:
- `sicas-sync-cobranza` → tabla `sicas_receivables`
- `sicas-sync-comisiones` → tabla `sicas_commissions`

### 4. Cache por Vendedor
Si hay muchos vendedores, agregar índice:
```sql
CREATE INDEX idx_sicas_documents_vend_usuario
ON sicas_documents(vend_nombre, usuario_id);
```

---

## Archivos Modificados

1. **Edge Function**: `/supabase/functions/sicas-sync-polizas-vigentes/index.ts` (nuevo)
2. **Frontend**: `/src/pages/MiProduccionSICAS.tsx` (reescrito)
3. **Tabla**: Ya existía en migración `20260213172344`

---

## Comandos Útiles

```bash
# Ver logs de la Edge Function
npx supabase functions logs sicas-sync-polizas-vigentes --project-ref qhwvuuyjhcennqccgvse

# Ver últimas sincronizaciones
SELECT * FROM sicas_sync_runs ORDER BY created_at DESC LIMIT 5;

# Ver documentos sincronizados
SELECT COUNT(*), MAX(synced_at) FROM sicas_documents;

# Ver mapeos de vendedores
SELECT vend_nombre, COUNT(*)
FROM sicas_documents
GROUP BY vend_nombre
ORDER BY COUNT(*) DESC;
```

---

## Resumen

**Antes:**
- Frontend → API REST SICAS (directo)
- CORS, timeout, lento

**Ahora:**
- Frontend → Supabase DB (rápido)
- Edge Function → SICAS (server-side, cuando sincronizas)
- Sin CORS, sin timeout, escalable

**Resultado:**
- Carga instantánea
- Filtros locales rápidos
- Datos siempre disponibles
- Auditoría completa
