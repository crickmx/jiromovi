# Configuración SICAS - Resumen Completo

## ✅ Estado Actual (Actualizado)

### ⚠️ Corrección Aplicada
- ✅ **Fix crítico aplicado**: La función `sync-sicas-polizas-vigentes` ahora guarda correctamente en `sicas_documents` (tabla base) en lugar de `sicas_polizas_vigentes` (vista)
- ✅ La vista `sicas_polizas_vigentes` se actualiza automáticamente y filtra solo pólizas vigentes
- ✅ La función está deployada y lista para usar

### 1. Credenciales Configuradas
- ✅ Usuario SICAS: `j1r0%25$`
- ✅ Password: Configurado
- ✅ Endpoint: `http://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx`
- ✅ Última prueba de conexión: Exitosa

### 2. Catálogos Sincronizados
- ✅ **Despachos**: 37 registros
- ⚠️ **Vendedores**: 1 registro (creado manualmente para pruebas)
- ❌ **Documentos**: 0 registros (pendiente de sincronización)
- ❌ **Pólizas Vigentes**: 0 registros (pendiente de sincronización)

### 3. Mapeo de Usuarios
- ✅ Usuario: **CHRISTOFER CRUZ CHOUSAL** (Administrador)
  - ID Usuario: `5c22eb53-5090-49f7-9e36-7748baee5f2c`
  - ID Vendedor SICAS: `1`
  - Nombre Vendedor: `CHRISTOFER CRUZ CHOUSAL`

### 4. Configuración REST API
- ✅ KeyCode para Pólizas: `HWSDOC`
- ✅ Método de sincronización: REST API
- ✅ Función helper creada: `get_sicas_sync_stats()`

## 📋 Próximos Pasos

### Opción 1: Sincronización Automática (Recomendada)

1. **Acceder al módulo "Mis Pólizas"**
   - URL: `/mis-polizas`
   - El sistema intentará cargar las pólizas automáticamente
   - Si no hay datos, mostrará un mensaje vacío

2. **Ejecutar sincronización manual desde Integración SICAS**
   - URL: `/mi-produccion-sicas-mirror`
   - Hacer clic en el botón "Sincronizar Pólizas Vigentes"
   - La sincronización se ejecuta automáticamente y muestra el progreso

3. **Ejecutar desde consola del navegador (alternativa)**
   - Puedes llamar a la Edge Function directamente:

```javascript
// Abrir consola del navegador (F12) y ejecutar:
fetch(`${window.location.origin}/functions/v1/sync-sicas-polizas-vigentes`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
    'Content-Type': 'application/json',
  },
})
.then(res => res.json())
.then(data => console.log('✅ Sincronización completada:', data))
.catch(err => console.error('❌ Error:', err));
```

### Opción 2: Sincronización desde SicasAdmin

1. Acceder a `/sicas` (requiere rol Administrador)
2. Ir a la pestaña de "Sincronización"
3. Hacer clic en "Sincronizar Pólizas Vigentes"

### Opción 3: Sincronización vía Supabase Dashboard

1. Ir a Supabase Dashboard → Edge Functions
2. Encontrar la función: `sicas-sync-polizas-vigentes`
3. Ejecutar la función (botón "Invoke")

## 🔍 Verificación de Datos

Después de ejecutar la sincronización, verifica los datos con estas consultas SQL:

```sql
-- Ver estadísticas generales
SELECT * FROM get_sicas_sync_stats();

-- Ver últimas pólizas sincronizadas
SELECT
  id_docto,
  no_poliza,
  vend_nombre,
  cliente,
  compania,
  vigencia_desde,
  vigencia_hasta,
  prima_neta,
  synced_at
FROM sicas_documents
ORDER BY synced_at DESC
LIMIT 10;

-- Ver pólizas del usuario actual
SELECT COUNT(*) as total_polizas
FROM sicas_polizas_vigentes
WHERE vend_id = '1';
```

## ⚠️ Notas Importantes

### Acerca del Vendedor de Prueba
- Se creó un vendedor con ID `1` manualmente para permitir las pruebas
- Este vendedor está vinculado al usuario CHRISTOFER
- **IMPORTANTE**: Cuando se ejecute la sincronización real de vendedores desde SICAS, este vendedor de prueba podría ser reemplazado o actualizado

### Sincronización Real de Vendedores
Para obtener los vendedores reales de SICAS, necesitas:
1. Verificar que SICAS tenga un catálogo/reporte de vendedores disponible
2. Configurar el `rest_keycode` correcto en la tabla `sicas_catalog_types`
3. Crear una Edge Function para sincronizar vendedores (similar a `sicas-sync-polizas-vigentes`)

### Mapeo Automático vs Manual
El sistema soporta dos tipos de mapeo:
1. **Automático**: Durante la sincronización, intenta mapear vendedores por nombre
2. **Manual**: Los administradores pueden crear mapeos específicos en `/sicas`

## 🔧 Funciones Edge Disponibles

### Sincronización
- `sicas-sync-polizas-vigentes` - Sincroniza pólizas vigentes (SOAP)
- `sicas-sync-manual` - Sincronización completa manual
- `sicas-sync-basic` - Sincronización básica de diagnóstico

### Consultas
- `get-my-sicas-polizas` - Obtiene las pólizas del usuario autenticado
- `sicas-get-polizas-vigentes-rest` - Consulta pólizas via REST API

### Administración
- `sicas-map-despacho` - Mapear despacho a oficina
- `sicas-map-vendedor` - Mapear vendedor a usuario

## 📊 Estructura de Datos

### Tabla: `sicas_documents`
Almacena todos los documentos sincronizados desde SICAS
- `id_docto`: ID único del documento en SICAS
- `vend_id`: ID del vendedor en SICAS
- `usuario_id`: ID del usuario en Movi (mapeado)
- `poliza`: Número de póliza
- `cliente`: Nombre del cliente/contratante
- `vigencia_desde`, `vigencia_hasta`: Fechas de vigencia
- `prima_neta`: Monto de la prima

### Tabla: `sicas_polizas_vigentes` (Vista)
Vista optimizada de pólizas vigentes
- Incluye solo documentos con vigencia activa
- Vinculada a usuarios vía `sicas_mapeo_vendedor_usuario`

### Tabla: `sicas_mapeo_vendedor_usuario`
Relación entre usuarios de Movi y vendedores de SICAS
- `movi_user_id`: UUID del usuario en Movi
- `id_sicas_vendedor`: ID del vendedor en SICAS
- `mapped_by`: Usuario que creó el mapeo
- `mapped_at`: Fecha del mapeo

## 🎯 Próximos Desarrollos Sugeridos

1. **Cron Job Automático**
   - Configurar `pg_cron` para sincronizar pólizas cada noche
   - Ejemplo: Sincronizar a las 2:00 AM todos los días

2. **Sincronización Incremental**
   - Usar `sicas_sync_cursors` para trackear última sincronización
   - Solo traer pólizas nuevas/modificadas

3. **Notificaciones**
   - Alertar a usuarios cuando hay nuevas pólizas
   - Notificar sobre pólizas próximas a vencer

4. **Dashboard Analytics**
   - KPIs de producción por vendedor
   - Gráficas de tendencias
   - Comparativas mensuales

## 🆘 Troubleshooting

### Error: "No tienes un vendedor SICAS asignado"
**Solución**: Crear un mapeo en `/sicas` o ejecutar:
```sql
INSERT INTO sicas_mapeo_vendedor_usuario (movi_user_id, id_sicas_vendedor)
VALUES ('[TU_USER_ID]', '[ID_VENDEDOR_SICAS]');
```

### Error: "Credenciales SICAS no configuradas"
**Solución**: Verificar variables de entorno:
- `SICAS_USERNAME`
- `SICAS_PASSWORD`
- `SICAS_SOAP_ENDPOINT` (opcional)

### Error: "Error en SICAS: Variable de objeto no establecida"
**Solución**: Este es un error conocido de SICAS cuando:
- El reporte no existe o no está disponible
- Las credenciales no tienen permisos
- El keycode es incorrecto

### No se muestran pólizas en la interfaz
**Causas posibles**:
1. No se ha ejecutado la sincronización
2. El usuario no tiene mapeo a vendedor SICAS
3. El vendedor SICAS no tiene pólizas asignadas
4. RLS está bloqueando el acceso

**Verificar**:
```sql
-- 1. Verificar mapeo
SELECT * FROM sicas_mapeo_vendedor_usuario WHERE movi_user_id = '[USER_ID]';

-- 2. Verificar pólizas del vendedor
SELECT COUNT(*) FROM sicas_polizas_vigentes WHERE vend_id = '[VENDEDOR_ID]';

-- 3. Verificar permisos RLS
SELECT * FROM sicas_polizas_vigentes LIMIT 1; -- Ejecutar como el usuario
```

## 📞 Contacto y Soporte

Para problemas relacionados con:
- **Credenciales SICAS**: Contactar a SICAS directamente
- **Configuración del sistema**: Administrador de Movi
- **Bugs o mejoras**: Crear un ticket en el sistema de Tramites
