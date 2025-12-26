# Módulo SICAS V2 - Sistema Dinámico Universal

**Fecha:** 26 de diciembre de 2024
**Versión:** 2.0 (Dinámico)

## Resumen de Mejoras

El módulo SICAS ha sido **completamente refactorizado** para ser un sistema **100% dinámico** que soporta los **61 catálogos oficiales** de SICAS Online, sin asumir estructuras fijas y con parseo inteligente.

### Cambios Principales

| Antes (V1) | Después (V2) |
|------------|--------------|
| 2 catálogos hardcoded (Despachos, Vendedores) | **61 catálogos dinámicos** |
| Tablas específicas (`sicas_despachos`, `sicas_vendedores`) | **Tabla genérica** `sicas_catalogos` |
| Parser con estructura fija | **Parser universal** 100% dinámico |
| Sin historial de sincronizaciones | **Historial completo** con auditoría |
| ReadInfoData sin validación | **AutentificarWS + validación RESPONSETXT** |
| Sin soporte para DataSet | Preparado para **JSON y DataSet** |

---

## 🏗️ ARQUITECTURA

### Base de Datos

#### 1. `sicas_catalog_types`

Enum de los **61 catálogos oficiales** de SICAS.

```sql
CREATE TABLE sicas_catalog_types (
  id INTEGER PRIMARY KEY,              -- 1-61
  name TEXT NOT NULL UNIQUE,           -- "Despachos", "Vendedores", etc.
  description TEXT,
  enum_name TEXT NOT NULL,             -- "eDespachos", "eVendedores"
  is_mappable BOOLEAN DEFAULT false,   -- Si se puede mapear a entidades MOVI
  requires_auth BOOLEAN DEFAULT true
);
```

**Ejemplo de registros:**

| ID | Name | Enum Name | Mappable |
|----|------|-----------|----------|
| 11 | Despachos | eDespachos | true |
| 32 | Vendedores | eVendedores | true |
| 12 | Aseguradoras | eAseguradoras | false |
| 51 | Pólizas | ePolizas | false |

---

#### 2. `sicas_catalogos`

**Tabla genérica universal** para TODOS los catálogos.

```sql
CREATE TABLE sicas_catalogos (
  id UUID PRIMARY KEY,
  catalog_type_id INTEGER REFERENCES sicas_catalog_types(id),
  id_sicas TEXT NOT NULL,              -- Detectado dinámicamente
  nombre TEXT NOT NULL,                -- Detectado dinámicamente
  raw JSONB NOT NULL,                  -- Objeto completo original (NUNCA descartar)
  metadata JSONB DEFAULT '{}',         -- Metadatos adicionales extraídos
  is_active BOOLEAN DEFAULT true,
  is_mapped BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  UNIQUE(catalog_type_id, id_sicas)
);
```

**Índices optimizados:**
- `idx_sicas_catalogos_catalog_type` - Para filtrar por tipo
- `idx_sicas_catalogos_id_sicas` - Para búsquedas por ID SICAS
- `idx_sicas_catalogos_nombre` (GIN) - Para búsquedas full-text
- `idx_sicas_catalogos_raw` (GIN) - Para queries en raw JSONB

---

#### 3. `sicas_sync_history`

Historial completo de sincronizaciones.

```sql
CREATE TABLE sicas_sync_history (
  id UUID PRIMARY KEY,
  catalog_type_id INTEGER REFERENCES sicas_catalog_types(id),
  sync_started_at TIMESTAMPTZ NOT NULL,
  sync_completed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  records_found INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  request_payload JSONB,
  response_preview TEXT
);
```

---

### Edge Functions

#### 1. `sicas-test-connection` (Refactorizado)

**Cambio crítico:** Ahora usa **AutentificarWS** correctamente según especificación SICAS.

**Request SOAP:**

```xml
<AutentificarWS>
  <wsAuthConfig>
    <UserName>j1r0%25$</UserName>
    <Password>$45oc14d05$</Password>
  </wsAuthConfig>
</AutentificarWS>
```

**Validación RESPONSETXT:**

```typescript
if (responseTxt === 'SUCESS' || responseTxt === 'SUCCESS') {
  success = true;  // Autenticado
} else if (responseTxt === 'DENIED') {
  success = false; // ABORTAR - credenciales inválidas
}
```

**Respuesta:**

```json
{
  "success": true,
  "connectionSuccess": true,
  "message": "Autenticación exitosa",
  "responseTxt": "SUCESS"
}
```

---

#### 2. `sicas-sync` (100% Refactorizado)

**Antes:**
```json
{ "catalogType": "despachos" }  // Solo 2 opciones
```

**Ahora:**
```json
{ "catalog_type_id": 11 }  // Cualquiera de 1-61
```

**Proceso:**

1. Valida `catalog_type_id` (1-61)
2. Obtiene info del catálogo desde `sicas_catalog_types`
3. Llama a SICAS con `ReadInfoData`:
   ```xml
   <ReadInfoData>
     <wsReadData>
       <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
       <PropertyTypeReadData>11</PropertyTypeReadData>  <!-- Dinámico -->
     </wsReadData>
     <wsAuthConfig>...</wsAuthConfig>
   </ReadInfoData>
   ```
4. **Parser universal** procesa la respuesta (ver siguiente sección)
5. Inserta/actualiza en `sicas_catalogos`
6. Registra en `sicas_sync_history`

**Respuesta:**

```json
{
  "success": true,
  "catalog_type_id": 11,
  "catalog_name": "Despachos",
  "stats": {
    "totalRows": 50,
    "inserted": 5,
    "updated": 45,
    "failed": 0
  }
}
```

---

### Parser Universal (`sicasParser.ts`)

**Archivo compartido:** `supabase/functions/_shared/sicasParser.ts`

#### Funciones Principales

##### `parseSicasResponse(rawResponse, catalogName?)`

Parser 100% dinámico que **NUNCA asume estructuras fijas**.

**Detecta automáticamente:**

1. **Array de datos** (soporta múltiples estructuras):
   - `[...]` (array directo)
   - `{ data: [...] }`
   - `{ items: [...] }`
   - `{ NewDataSet: { Table: [...] } }`
   - Cualquier objeto con un array dentro

2. **Campo ID** (prioridad):
   - `ID<Entidad>` (ej: `IDDespacho`)
   - `Id<Entidad>` (ej: `IdVendedor`)
   - Cualquier campo con `"id"`
   - Primer campo numérico

3. **Campo Nombre** (prioridad):
   - `"Nombre"` exacto
   - Campo con `"nombre"`
   - `"Descripcion"` o `"desc"`
   - Campo con nombre de entidad
   - Primer string no vacío

**Resultado:**

```typescript
{
  success: true,
  records: [
    {
      id_sicas: "123",
      nombre: "Despacho XYZ",
      raw: { /* objeto completo original */ },
      metadata: { /* campos adicionales extraídos */ }
    }
  ],
  stats: {
    totalRows: 50,
    successfullyParsed: 50,
    failed: 0
  },
  errors: []
}
```

##### `parseSoapResponse(soapXml)`

Extrae `ReadInfoDataResult` del SOAP y decodifica HTML entities.

##### `checkSoapError(soapXml)`

Valida si hay errores SOAP:
- SOAP Fault
- `RESPONSETXT = DENIED`
- Mensajes de error

---

## 📊 FRONTEND

### Tipos TypeScript (`sicasTypes.ts`)

**Nuevos tipos:**

```typescript
export interface SicasCatalogType {
  id: number;
  name: string;
  enum_name: string;
  is_mappable: boolean;
}

export interface SicasCatalogo {
  id: string;
  catalog_type_id: number;
  id_sicas: string;
  nombre: string;
  raw: any;
  metadata: any;
  is_mapped: boolean;
}

export interface SicasSyncHistory {
  catalog_type_id: number;
  status: 'running' | 'completed' | 'failed';
  records_found: number;
  records_inserted: number;
  records_updated: number;
}

export const SICAS_CATALOG_IDS = {
  DESPACHOS: 11,
  VENDEDORES: 32,
  ASEGURADORAS: 12,
  POLIZAS: 51,
  // ... hasta 61
};
```

---

### Funciones Utils (`sicasUtils.ts`)

**Nuevas funciones genéricas:**

```typescript
// Obtener todos los tipos de catálogos
getAllCatalogTypes(): Promise<SicasCatalogType[]>

// Sincronizar cualquier catálogo por ID (1-61)
syncCatalogById(catalog_type_id: number): Promise<Response>

// Obtener registros de un catálogo con filtros
getCatalogRecords(
  catalog_type_id: number,
  options?: {
    onlyUnmapped?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<SicasCatalogo[]>

// Obtener estadísticas de todos los catálogos
getCatalogStats(): Promise<SicasCatalogStats[]>

// Obtener historial de sincronizaciones
getSyncHistory(catalog_type_id?: number): Promise<SicasSyncHistory[]>
```

---

## 🎯 CASOS DE USO

### 1. Sincronizar Catálogo de Aseguradoras (ID 12)

```typescript
const result = await syncCatalogById(12);

// Respuesta:
{
  success: true,
  catalog_name: "Aseguradoras",
  stats: {
    totalRows: 25,
    inserted: 25,
    updated: 0
  }
}
```

Datos guardados en:
```sql
SELECT * FROM sicas_catalogos WHERE catalog_type_id = 12;
```

---

### 2. Buscar Pólizas Sincronizadas (ID 51)

```typescript
const polizas = await getCatalogRecords(51, {
  search: 'GNP',
  limit: 10
});

console.log(polizas);
// [
//   {
//     id_sicas: "P-12345",
//     nombre: "Póliza GNP Auto",
//     raw: { /* datos completos */ },
//     metadata: { aseguradora: "GNP", tipo: "Auto" }
//   }
// ]
```

---

### 3. Ver Historial de Sincronizaciones

```typescript
const history = await getSyncHistory(11); // Solo Despachos

history.forEach(sync => {
  console.log(`
    Catálogo: ${sync.catalog_type.name}
    Estado: ${sync.status}
    Registros: ${sync.records_inserted} insertados, ${sync.records_updated} actualizados
    Fecha: ${sync.sync_completed_at}
  `);
});
```

---

## 🔐 SEGURIDAD (RLS)

**Todas las tablas nuevas:**
- RLS habilitado
- Solo **administradores** pueden ver/modificar
- **Service role** tiene acceso completo (para Edge Functions)

```sql
CREATE POLICY "Solo admins"
  ON sicas_catalogos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );
```

---

## 📈 BENEFICIOS

### Antes (V1)

- Solo 2 catálogos (Despachos, Vendedores)
- Estructura fija y rígida
- Sin historial
- Sin validación de autenticación
- Parser asume campos específicos

### Después (V2)

- **61 catálogos dinámicos**
- **Parser universal** que detecta campos automáticamente
- **Historial completo** de sincronizaciones
- **Autenticación validada** (RESPONSETXT)
- **Preparado para expansión** (Pólizas, Comisiones, Cobranza)
- **Raw siempre guardado** (nunca se pierde información)
- **Metadata extraída** automáticamente

---

## 🔧 CONFIGURACIÓN

### Variables de Entorno (Supabase)

```env
SICAS_ENDPOINT=https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx
SICAS_USERNAME=j1r0%25$
SICAS_PASSWORD=$45oc14d05$
```

---

## 📝 PRÓXIMOS PASOS

1. **Implementar Procesar_String/DataSet** para escritura
2. **Agregar soporte DataSet** (PropertyData_TypeDataReturn = 0)
3. **Crear funciones de mapeo universal** para catálogos mapeables
4. **Implementar CDigital** (Centro Digital)
5. **Reportes** (KeyProcess = REPORT)
6. **Frontend dinámico** con selector de 61 catálogos

---

## ✅ ESTADO ACTUAL

- **Base de datos:** 100% migrada y funcional
- **Parser universal:** 100% implementado y probado
- **Edge Functions:** Refactorizadas y desplegadas
- **Tipos TypeScript:** Actualizados con 61 catálogos
- **Utils:** Funciones genéricas agregadas
- **Documentación:** Completa

**El módulo está listo para:**
- Sincronizar cualquiera de los 61 catálogos
- Detectar automáticamente estructuras de datos
- Guardar raw completo
- Auditar sincronizaciones
- Validar autenticación

---

## 📚 REGLAS DE ORO

1. **Autentificar siempre** (AutentificarWS o en ReadInfoData)
2. **Nunca asumir estructura fija**
3. **Parsear dinámicamente**
4. **Guardar raw SIEMPRE**
5. **JSON preferido, DataSet fallback**
6. **Manejar errores en XML**
7. **Catálogos son expansibles**
8. **Todo debe poder mapearse**

---

## 🎓 EJEMPLO DE FLUJO COMPLETO

```typescript
// 1. Probar conexión
const auth = await testSicasConnection();
console.log(auth.message); // "Autenticación exitosa"

// 2. Obtener lista de catálogos disponibles
const catalogs = await getAllCatalogTypes();
console.log(catalogs); // 61 catálogos

// 3. Sincronizar un catálogo específico (ej: Aseguradoras)
const sync = await syncCatalogById(12);
console.log(`Sincronizados: ${sync.stats.inserted} registros`);

// 4. Consultar registros sincronizados
const aseguradoras = await getCatalogRecords(12, { limit: 10 });
aseguradoras.forEach(a => console.log(`${a.id_sicas}: ${a.nombre}`));

// 5. Ver estadísticas globales
const stats = await getCatalogStats();
stats.forEach(s => {
  console.log(`${s.catalog_name}: ${s.total_records} registros (${s.mapped_records} mapeados)`);
});

// 6. Ver historial de sincronizaciones
const history = await getSyncHistory();
console.log(`Última sincronización: ${history[0].sync_completed_at}`);
```

---

**Módulo SICAS V2** está **100% funcional** y listo para sincronizar **cualquiera de los 61 catálogos oficiales de SICAS Online**.
