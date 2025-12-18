# Información de "Mi Producción" desde Google Sheets

## Resumen
La sección "Mi Producción" muestra a los agentes su desempeño individual basado en datos extraídos de Google Sheets y almacenados en la tabla `production_records`.

---

## Columnas del Google Sheets que se Utilizan

### 📅 Información Temporal
| Campo en Excel | Columna Alternativa | Campo en DB | Descripción |
|----------------|---------------------|-------------|-------------|
| `FechaSimp` | `Fecha` | `fecha` | Fecha de la operación |
| - | - | `anio` | Año extraído de la fecha |
| - | - | `mes` | Mes extraído de la fecha |
| - | - | `dia` | Día extraído de la fecha |
| - | - | `periodo_mes` | Formato YYYY-MM |
| - | - | `periodo_anio` | Año como entero |

### 👤 Información del Agente
| Campo en Excel | Columna Alternativa | Campo en DB | Descripción |
|----------------|---------------------|-------------|-------------|
| `VendNombre` | `vendnombre`, `vendedor` | `agente_nombre` | **Nombre del vendedor/agente** |

**CRÍTICO:** Este campo se usa para filtrar y mostrar la producción del agente.

### 👥 Información del Cliente
| Campo en Excel | Columna Alternativa | Campo en DB | Descripción |
|----------------|---------------------|-------------|-------------|
| `NombreCompleto` | `nombrecompleto` | `desp_nombre_raw` | **Nombre del cliente** |
| `GerenciaNombre` | `gerencianombre` | `gerencia_nombre_raw` | Nombre de la gerencia |
| `Dirección Regional` | `direccion regional`, `region` | `region_raw` | Región del cliente |

### 🏢 Información del Producto
| Campo en Excel | Columna Alternativa | Campo en DB | Descripción |
|----------------|---------------------|-------------|-------------|
| `Nombre Compañía` | `nombre compañia`, `compañia` | `aseguradora_nombre` | **Nombre de la aseguradora** |
| `Sub Ramo` | `subramo`, `RamosNombre`, `ramos` | `ramo_nombre` | **Ramo del seguro** |
| `Concepto` | `concepto` | `concepto` | Concepto de la operación |

### 💰 Información Financiera
| Campo en Excel | Columna Alternativa | Campo en DB | Descripción |
|----------------|---------------------|-------------|-------------|
| `IMPORTE PESOS` | `importe pesos`, `importe` | `importe_pesos` | **Monto principal** |
| `Prima de convenio` | `prima de convenio`, `prima convenio` | `prima_convenio` | Prima de convenio |
| `Prima Ponderada` | `prima ponderada` | `prima_ponderada` | Prima ponderada |
| `Bono` | `bono` | `bono` | Bono del agente |
| `% BONO` | `porcentaje bono` | `porcentaje_bono` | Porcentaje de bono |
| `CONVENIO` | `convenio` | `convenio_flag` | Si es convenio (boolean) |

---

## Datos Calculados y Mostrados al Agente

### 📊 KPIs Principales
```javascript
{
  total_produccion: number,      // Suma de importe_pesos (o prima_convenio si importe=0)
  total_documentos: number,       // Cantidad de registros del agente
  clientes_unicos: number,        // Clientes únicos (desp_nombre_raw)
  aseguradora_top: string,        // Aseguradora con mayor producción
  ramo_top: string                // Ramo con mayor producción
}
```

### 📈 Gráficas y Análisis

#### 1. **Producción por Ramo** (Top 10)
```javascript
[
  { ramo: string, total: number },
  ...
]
```
Muestra los 10 ramos con mayor producción.

#### 2. **Producción por Aseguradora** (Top 10)
```javascript
[
  { aseguradora: string, total: number },
  ...
]
```
Muestra las 10 aseguradoras con mayor producción.

#### 3. **Top 10 Clientes**
```javascript
[
  {
    cliente: string,
    total: number,           // Monto total del cliente
    documentos: number       // Cantidad de operaciones
  },
  ...
]
```

#### 4. **Evolución Temporal** (por mes)
```javascript
[
  { mes: string, total: number },  // mes formato: "YYYY-MM"
  ...
]
```

### 📋 Tabla de Registros Paginados

Cada registro incluye TODOS los campos:

```javascript
{
  // Temporal
  fecha: "YYYY-MM-DD",
  anio: number,
  mes: number,
  dia: number,
  periodo_mes: "YYYY-MM",
  periodo_anio: number,

  // Cliente
  desp_nombre_raw: string,
  nombre_cliente: string | null,     // Campo adicional de producción
  gerencia_nombre_raw: string,
  region_raw: string | null,

  // Producto
  agente_nombre: string,
  aseguradora_nombre: string,
  ramo_nombre: string,
  subramo_nombre: string | null,
  concepto: string | null,

  // Financiero
  importe_pesos: number,
  prima_convenio: number,
  prima_ponderada: number,
  bono: number,
  porcentaje_bono: number | null,
  convenio_flag: boolean
}
```

---

## Filtros Disponibles

El agente puede filtrar su producción por:

1. **Rango de Fechas**
   - `fechaDesde`: Fecha inicial (YYYY-MM-DD)
   - `fechaHasta`: Fecha final (YYYY-MM-DD)

2. **Ramos**
   - Array de nombres de ramos

3. **Aseguradoras**
   - Array de nombres de aseguradoras

4. **Búsqueda de Cliente**
   - Busca en: `desp_nombre_raw`, `nombre_cliente`, `gerencia_nombre_raw`

5. **Paginación**
   - `page`: Número de página (default: 1)
   - `limit`: Registros por página (default: 50)

---

## Lógica de Cálculo de Producción

Para cada registro:
```javascript
const produccion = importe_pesos > 0 ? importe_pesos : prima_convenio;
```

**Prioridad:**
1. Si `importe_pesos` > 0, usar ese valor
2. Si no, usar `prima_convenio`

---

## Relación Usuario → Vendedor

Para mostrar la producción correcta, el sistema busca el vendedor asociado al usuario en 3 niveles:

### 1. **Cache (production_vendors_cache)**
- Búsqueda más rápida
- Mapeo pre-calculado

### 2. **Mapeos Manuales (vendor_mappings)**
- Mapeos configurados por administradores
- Permite asociar nombres diferentes

### 3. **Coincidencia Directa**
- Busca en `production_records` por nombre
- Match usando `ilike` (case-insensitive)

---

## Campos CRÍTICOS del Google Sheets

Los siguientes campos **DEBEN existir** en el Excel para que el sistema funcione:

### Obligatorios
1. ✅ `FechaSimp` o `Fecha` - Sin fecha, el registro se descarta
2. ✅ `NombreCompleto` - Nombre del cliente (sin esto, registro se descarta)
3. ✅ `VendNombre` - Nombre del agente (para filtrar)

### Altamente Recomendados
4. ⚠️ `IMPORTE PESOS` - Monto principal de la operación
5. ⚠️ `Nombre Compañía` - Aseguradora
6. ⚠️ `Sub Ramo` - Ramo del seguro

### Opcionales pero Útiles
7. `Prima de convenio` - Usado si IMPORTE PESOS = 0
8. `Prima Ponderada` - Para reportes adicionales
9. `Bono` y `% BONO` - Información de bonos
10. `GerenciaNombre` - Información organizacional
11. `Concepto` - Detalles adicionales

---

## Notas Importantes

1. **Normalización de Nombres**
   - Los nombres se normalizan (lowercase, sin acentos)
   - Permite matching flexible entre Excel y usuarios

2. **Alternativas de Columnas**
   - El sistema busca múltiples variantes de nombres de columnas
   - Soporta mayúsculas, minúsculas, con/sin acentos

3. **Valores por Defecto**
   - Campos numéricos vacíos = 0
   - Campos de texto vacíos = '' o null
   - `convenio_flag` se calcula automáticamente

4. **Performance**
   - Los datos se consultan desde `production_records` (DB)
   - Ya NO se consulta Google Sheets en cada carga
   - La sincronización desde Sheets se hace manualmente

5. **Caching**
   - Los mapeos de vendedores se cachean
   - Mejora significativamente el rendimiento
   - Requiere sincronización manual cuando cambian datos
