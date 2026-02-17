# Fix: Sincronización SICAS - Error 500 Resuelto

## 🔧 Problema Identificado

La función `sync-sicas-polizas-vigentes` estaba intentando hacer `INSERT`/`UPSERT` directamente en `sicas_polizas_vigentes`, que es una **VISTA** (VIEW) y no una tabla base.

En PostgreSQL/Supabase, **no se pueden insertar datos en vistas** a menos que tengan triggers especiales configurados.

### Error Original
```
POST /functions/v1/sync-sicas-polizas-vigentes 500 (Internal Server Error)
```

### Causa Raíz
```typescript
// ❌ INCORRECTO - Intentando insertar en una vista
await supabase
  .from('sicas_polizas_vigentes')  // Esta es una VISTA
  .upsert(polizas);
```

## ✅ Solución Aplicada

### 1. Identificación de la Estructura
```sql
-- sicas_polizas_vigentes es una VISTA que filtra sicas_documents
CREATE VIEW sicas_polizas_vigentes AS
SELECT *
FROM sicas_documents
WHERE vigencia_hasta >= CURRENT_DATE;
```

### 2. Corrección del Código
Actualicé la función para guardar en la **tabla base** `sicas_documents`:

```typescript
// ✅ CORRECTO - Guardando en la tabla base
const documentsToUpsert = batch.map(p => ({
  id_docto: p.id_documento,
  poliza: p.no_poliza,
  vend_id: p.vend_id,
  vend_nombre: p.vend_nombre,
  desp_nombre: p.desp_nombre,
  compania: p.aseguradora,
  ramo: p.ramo,
  subramo: p.subramo,
  cliente: p.contratante || p.asegurado,
  vigencia_desde: p.vigencia_desde,
  vigencia_hasta: p.vigencia_hasta,
  prima_neta: p.prima_neta,
  importe: p.prima_total,
  synced_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));

await supabase
  .from('sicas_documents')  // Tabla base
  .upsert(documentsToUpsert, {
    onConflict: 'id_docto',
  });
```

### 3. Deployment
La función corregida fue deployada exitosamente:
```
✅ sync-sicas-polizas-vigentes - deployed
```

## 📊 Flujo de Datos Corregido

```
SICAS API
    ↓
[sync-sicas-polizas-vigentes]
    ↓
sicas_documents (tabla base)
    ↓
sicas_polizas_vigentes (vista - filtro automático)
    ↓
Usuario ve solo pólizas vigentes
```

## 🧪 Cómo Probar la Corrección

### Método 1: Desde la Interfaz (Recomendado)

1. Ve a la página "Integración SICAS"
   - URL: `/mi-produccion-sicas-mirror`

2. Haz clic en el botón **"Sincronizar Pólizas Vigentes"**

3. Observa el progreso en la interfaz

4. Verifica el resultado:
   - ✅ Status 200: Sincronización exitosa
   - 📊 Se muestran las estadísticas de registros sincronizados

### Método 2: Desde la Consola del Navegador

1. Abre la consola del navegador (F12)

2. Ejecuta:
```javascript
const token = localStorage.getItem('supabase.auth.token');

fetch(`${window.location.origin}/functions/v1/sync-sicas-polizas-vigentes`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
})
.then(res => {
  console.log('Status:', res.status);
  return res.json();
})
.then(data => {
  console.log('✅ Resultado:', data);
  if (data.success) {
    console.log('📊 Registros sincronizados:', data.stats.records_inserted);
  } else {
    console.error('❌ Error:', data.error);
  }
});
```

### Método 3: Verificar Datos en Supabase Dashboard

1. Ve a Supabase Dashboard → Table Editor

2. Consulta la tabla `sicas_documents`:
```sql
SELECT
  COUNT(*) as total_documentos,
  COUNT(CASE WHEN vigencia_hasta >= CURRENT_DATE THEN 1 END) as polizas_vigentes,
  MIN(synced_at) as primera_sync,
  MAX(synced_at) as ultima_sync
FROM sicas_documents;
```

3. Consulta la vista `sicas_polizas_vigentes`:
```sql
SELECT
  COUNT(*) as total_vigentes,
  COUNT(DISTINCT vend_id) as vendedores_unicos,
  COUNT(DISTINCT compania) as aseguradoras_unicas
FROM sicas_polizas_vigentes;
```

## 📝 Cambios Realizados

### Archivos Modificados

1. **`/supabase/functions/sync-sicas-polizas-vigentes/index.ts`**
   - ✅ Función `guardarPolizasCache()`: Cambiado de `sicas_polizas_vigentes` a `sicas_documents`
   - ✅ Mapeo de campos ajustado al esquema de `sicas_documents`
   - ✅ Limpieza de tabla: Ahora limpia `sicas_documents` en lugar de la vista

2. **`/SICAS_CONFIGURACION_COMPLETA.md`**
   - ✅ Actualizado con información del fix
   - ✅ Añadidas instrucciones de prueba mejoradas

3. **`/FIX_SICAS_SYNC_POLIZAS.md`** (este archivo)
   - ✅ Documentación completa del problema y solución

## ✅ Verificación de Políticas RLS

Las políticas de seguridad están correctamente configuradas:

```sql
-- Service role tiene acceso completo para sincronización
Policy: "Service role full access on sicas_documents"
  Role: service_role
  Action: ALL
  USING: true
  WITH CHECK: true
```

Esto significa que las Edge Functions, que usan `SUPABASE_SERVICE_ROLE_KEY`, pueden realizar operaciones de INSERT/UPDATE/DELETE sin problemas.

## 🎯 Resultado Esperado

Después del fix, cuando ejecutes la sincronización deberías ver:

```json
{
  "success": true,
  "status": "success",
  "stats": {
    "records_fetched": 150,
    "records_inserted": 150,
    "records_updated": 0,
    "records_errors": 0,
    "pages_processed": 1
  },
  "metadata": {
    "synced_at": "2026-02-17T02:30:00.000Z",
    "duration_ms": 3542,
    "source": "SICAS Web Service"
  }
}
```

## 🚀 Próximos Pasos Recomendados

1. **Ejecutar la sincronización** usando uno de los métodos arriba
2. **Verificar los datos** en la tabla y vista
3. **Acceder a "Mis Pólizas"** (`/mis-polizas`) para ver tus pólizas
4. **Configurar sincronización automática** (opcional - cron job diario)

## 🆘 Si Encuentras Problemas

### Error: "No tienes un vendedor SICAS asignado"
Necesitas crear un mapeo:
```sql
INSERT INTO sicas_mapeo_vendedor_usuario (movi_user_id, id_sicas_vendedor)
VALUES ('[TU_USER_ID]', '[ID_VENDEDOR_SICAS]');
```

### Error: "No se obtuvieron registros de SICAS"
Posibles causas:
- El reporte H03400 no está disponible en tu cuenta SICAS
- No hay pólizas vigentes en el sistema
- Las credenciales no tienen permisos suficientes

Solución: Contactar a SICAS para verificar permisos de acceso a reportes.

### Error 401: "No autorizado"
Verifica que estés autenticado:
```javascript
// Verificar token
console.log('Token:', localStorage.getItem('supabase.auth.token'));
```

## 📚 Referencias

- **Documentación SICAS**: Páginas 27+ (ProcesarWS y reportes)
- **Configuración completa**: Ver `SICAS_CONFIGURACION_COMPLETA.md`
- **Edge Functions**: Código en `/supabase/functions/sync-sicas-polizas-vigentes/`

---

**Fecha del Fix**: 2026-02-17
**Status**: ✅ Completado y Deployado
**Versión**: 1.0
