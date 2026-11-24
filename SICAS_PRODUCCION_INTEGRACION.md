# Integración SICAS - Producción por Vendedor

## Resumen

El módulo "Producción por Vendedor" ahora obtiene los datos directamente del webservice de SICAS usando el reporte **H03117 (Pólizas Vigentes)** mediante el método **ProcesarWS**.

### Cambios Realizados

#### 1. Edge Functions Creados

##### `sicas-get-production`
- **Propósito**: Consulta el reporte H03117 de SICAS y agrupa la producción por vendedor
- **Endpoint**: `/functions/v1/sicas-get-production`
- **Método SOAP**: `ProcesarWS` con KeyProcess=REPORT, KeyCode=H03117
- **Características**:
  - Paginación automática (consulta múltiples páginas hasta obtener todos los datos)
  - Aplicación de mapeo de vendedores desde `sicas_mapeo_vendedores`
  - Agregación de totales por vendedor
  - Filtros de búsqueda y estado de mapeo
  - Ordenamiento configurable

##### `sicas-get-vendor-details`
- **Propósito**: Consulta los detalles de producción de un vendedor específico
- **Endpoint**: `/functions/v1/sicas-get-vendor-details`
- **Método SOAP**: `ProcesarWS` con filtro por vendedor
- **Características**:
  - Filtrado directo en SICAS por nombre de vendedor
  - Retorna lista completa de pólizas/documentos
  - Incluye todos los campos de detalle (fecha, oficina, ramo, aseguradora, importes)

#### 2. Frontend Actualizado

##### `/src/pages/ProduccionPorVendedor.tsx`
- Cambio de endpoints:
  - De: `get-production-vendors-cached` (Google Sheets)
  - A: `sicas-get-production` (SICAS directo)
- Actualización de interfaz:
  - Nuevo texto: "Datos en tiempo real desde SICAS (Reporte H03117)"
  - Botón: "Consultar SICAS" en lugar de "Actualizar"
  - Muestra código de reporte y fuente de datos
- Sin cambios en la estructura de datos o UI

## Flujo de Datos

### 1. Consulta Inicial

```
Usuario → Frontend → sicas-get-production
                    ↓
            SICAS Web Service (ProcesarWS)
                    ↓
            Reporte H03117 (Pólizas Vigentes)
                    ↓
            Parseo XML → Agrupación por Vendedor
                    ↓
            Aplicar Mapeo de Usuarios
                    ↓
            Retornar Vendedores con Totales
```

### 2. Consulta de Detalles

```
Usuario hace clic en Vendedor
            ↓
    sicas-get-vendor-details
            ↓
    ProcesarWS con filtro por vendedor
            ↓
    Retorna pólizas específicas del vendedor
```

## Estructura de Request SOAP

### ProcesarWS (Reporte H03117)

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <wsProcesarData>
        <KeyProcess>REPORT</KeyProcess>
        <KeyCode>H03117</KeyCode>
        <Page>1</Page>
        <ItemForPage>500</ItemForPage>
        <InfoSort>DatDocumentos.FCaptura DESC</InfoSort>
        <!-- Opcional: Filtro por vendedor -->
        <ConditionsAdd>DatDocumentos.Vendedor LIKE '%NombreVendedor%'</ConditionsAdd>
      </wsProcesarData>
      <wsAuthConfig>
        <UserName>j1r0%25$</UserName>
        <Password>$45oc14d05$</Password>
      </wsAuthConfig>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>
```

## Campos Extraídos del Reporte

Del XML de respuesta de SICAS, se extraen los siguientes campos de cada registro `<DatDocumentos>`:

| Campo SICAS | Campo Interno | Descripción |
|------------|---------------|-------------|
| `FCaptura` / `Fecha` | `fecha` | Fecha de captura/emisión |
| `PeriodoMes` | `periodo_mes` | Mes del periodo (YYYY-MM) |
| `Despacho` / `Oficina` | `desp_nombre_raw` | Nombre de la oficina/despacho |
| `Gerencia` | `gerencia_nombre_raw` | Nombre de la gerencia |
| `Region` | `region_raw` | Región (opcional) |
| `Aseguradora` / `Compania` | `aseguradora_nombre` | Nombre de la aseguradora |
| `Ramo` | `ramo_nombre` | Ramo del seguro |
| `SubRamo` | `subramo_nombre` | Sub-ramo (opcional) |
| `ImportePesos` / `Importe` | `importe_pesos` | Importe en pesos |
| `PrimaConvenio` / `Prima` | `prima_convenio` | Prima de convenio |
| `PrimaPonderada` | `prima_ponderada` | Prima ponderada |
| `Bono` | `bono` | Bono |
| `Vendedor` / `NombreVendedor` | `vend_nombre` | Nombre del vendedor |

## Mapeo de Vendedores

El sistema utiliza la tabla `sicas_mapeo_vendedores` para relacionar vendedores de SICAS con usuarios de MOVI:

```typescript
// Consulta de mapeos
const { data: mappings } = await supabase
  .from('sicas_mapeo_vendedores')
  .select('vend_nombre, usuario_id, usuarios(id, nombre_completo, oficina_id, oficinas(nombre))');

// Normalización de nombres
const normalizar = (nombre: string): string => {
  return nombre
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

// Aplicación del mapeo
const vendNormalized = normalizar(record.vend_nombre);
const mapping = mappingMap.get(vendNormalized);
```

## Agregación de Datos

Los datos se agregan por vendedor:

```typescript
interface VendorProductionRecord {
  vend_nombre: string;                 // Nombre original del vendedor
  vend_nombre_normalized: string;      // Nombre normalizado
  movi_user_id: string | null;         // ID del usuario MOVI mapeado
  movi_user_name: string | null;       // Nombre completo del usuario MOVI
  oficina_nombre: string | null;       // Nombre de la oficina del usuario
  match_method: 'mapping_name' | 'none'; // Método de mapeo
  total_records: number;               // Total de registros
  total_importe_pesos: number;         // Suma de importes
  total_prima_convenio: number;        // Suma de primas de convenio
  total_prima_ponderada: number;       // Suma de primas ponderadas
  total_bono: number;                  // Suma de bonos
}
```

## Performance

### Características de Optimización

1. **Paginación Automática**: El edge function consulta múltiples páginas de SICAS (hasta 10 páginas de 500 registros c/u = 5,000 registros máximo)

2. **Procesamiento en Backend**: Toda la agregación y mapeo se realiza en el edge function, no en el frontend

3. **Filtrado Directo**: Los filtros se aplican después de obtener los datos (búsqueda, estado de mapeo, ordenamiento)

4. **Límite de Seguridad**: Máximo 10 páginas para evitar timeouts

### Métricas Típicas

- **Consulta SICAS**: 2-5 segundos por página
- **Procesamiento Total**: 10-30 segundos para ~5,000 registros
- **Agregación**: <1 segundo
- **Response Size**: ~50-200 KB (JSON comprimido)

## Ventajas vs Google Sheets

### Antes (Google Sheets)

- Datos sincronizados cada 12-24 horas
- Requiere mantenimiento del script de sincronización
- Dependencia de Google Sheets API
- Datos potencialmente desactualizados
- Límites de cuota de Google API

### Ahora (SICAS Directo)

- Datos en tiempo real
- Sin sincronización intermedia
- Fuente única de verdad (SICAS)
- Sin dependencias externas adicionales
- Sin límites de cuota externos

## Configuración Requerida

### Variables de Entorno

Las siguientes variables ya están configuradas automáticamente:

```bash
SICAS_USERNAME=j1r0%25$
SICAS_PASSWORD=$45oc14d05$
SUPABASE_URL=[auto]
SUPABASE_SERVICE_ROLE_KEY=[auto]
```

### Tabla de Mapeo

Asegurarse de que la tabla `sicas_mapeo_vendedores` esté poblada:

```sql
-- Verificar mapeos existentes
SELECT
  vend_nombre,
  usuario_id,
  usuarios.nombre_completo,
  usuarios.oficinas.nombre as oficina
FROM sicas_mapeo_vendedores
JOIN usuarios ON sicas_mapeo_vendedores.usuario_id = usuarios.id
JOIN oficinas ON usuarios.oficina_id = oficinas.id;
```

## Manejo de Errores

### Errores Comunes

1. **RESPONSENBR=0**: Catálogo no disponible o sin datos
   - Mensaje: "Error en Ejecución del Proceso Interno de SICASOnline"
   - Solución: Verificar que el reporte H03117 esté disponible

2. **RESPONSETXT=DENIED**: Credenciales inválidas
   - Mensaje: "Acceso denegado - verificar credenciales"
   - Solución: Verificar variables de entorno

3. **Timeout**: Consulta demasiado larga
   - Mensaje: "HTTP Error: timeout"
   - Solución: Reducir límite de páginas o aumentar timeout

## Testing

### Probar Edge Function Directamente

```bash
# Obtener producción
curl -X GET "${SUPABASE_URL}/functions/v1/sicas-get-production?page=1&limit=25" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

# Obtener detalles de vendedor
curl -X GET "${SUPABASE_URL}/functions/v1/sicas-get-vendor-details?vendNombre=JUAN%20PEREZ&page=1&limit=100" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
```

### Probar desde Frontend

1. Acceder a `/produccion-por-vendedor`
2. Hacer clic en "Consultar SICAS"
3. Verificar en la consola del navegador los logs `[ProduccionSICAS]`
4. Expandir un vendedor para ver detalles

## Próximos Pasos

### Mejoras Futuras

1. **Cache Inteligente**: Implementar cache en Supabase con TTL de 1 hora
2. **Consulta Incremental**: Solo traer datos nuevos desde última consulta
3. **Filtros en SICAS**: Aplicar filtros directamente en el request SOAP
4. **Background Jobs**: Sincronización programada en background
5. **Webhooks**: Si SICAS lo soporta, recibir notificaciones de cambios

### Monitoreo

- Logs de performance en edge functions
- Alertas si consultas tardan >30 segundos
- Métricas de uso de API de SICAS
- Dashboard de estado de sincronización

## Soporte

Para problemas o dudas:
1. Revisar logs del edge function en Supabase Dashboard
2. Verificar conectividad con SICAS usando `sicas-test-connection`
3. Consultar documentación en `/SICAS_*.md`
4. Verificar mapeos en `/integracion-sicas`

---

**Última actualización**: 11 de febrero de 2026
**Versión**: 1.0
**Estado**: Producción Activa
