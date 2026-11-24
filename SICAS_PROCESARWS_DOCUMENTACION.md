# SICAS ProcesarWS - Reportes con Filtros Avanzados

## Resumen

SICAS tiene **DOS métodos diferentes** para consumir datos:

| Método | Uso | Endpoint | Complejidad |
|--------|-----|----------|-------------|
| **ReadInfoData** | Catálogos simples | REST `/Report/ReadData` o SOAP `ReadInfoData` | Baja |
| **ProcesarWS** | Reportes con filtros | SOAP `ProcesarWS` | Alta |

## ProcesarWS - Estructura SOAP

### Envelope Completo

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:ProcesarWS>
      <tem:oDataWS>
        <tem:Credentials>
          <tem:UserName>W4sP3r</tem:UserName>
          <tem:Password>wA5P3R%2020</tem:Password>
        </tem:Credentials>
        <tem:TypeFormat>XML</tem:TypeFormat>
        <tem:KeyProcess>REPORT</tem:KeyProcess>
        <tem:KeyCode>H03400</tem:KeyCode>
        <tem:Page>1</tem:Page>
        <tem:ItemForPage>10</tem:ItemForPage>
        <tem:InfoSort>DatDocumentos.FDesde</tem:InfoSort>
        <tem:ConditionsAdd>Filtros aquí</tem:ConditionsAdd>
      </tem:oDataWS>
    </tem:ProcesarWS>
  </soapenv:Body>
</soapenv:Envelope>
```

### Parámetros Principales

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `UserName` | String | Usuario SICAS | `W4sP3r` |
| `Password` | String | Contraseña (URL encoded) | `wA5P3R%2020` |
| `TypeFormat` | String | Formato de respuesta | `XML` o `JSON` |
| `KeyProcess` | String | Tipo de proceso | `REPORT` |
| `KeyCode` | String | Código del reporte | `H03400`, `H03430_001` |
| `Page` | Integer | Número de página | `1` |
| `ItemForPage` | Integer | Registros por página | `10`, `-1` (todos) |
| `InfoSort` | String | Campo para ordenar | `DatDocumentos.FDesde` |
| `ConditionsAdd` | String | Filtros complejos | Ver sección Filtros |

## KeyCodes de Reportes

### Pólizas y Documentos

| KeyCode | Descripción | Uso |
|---------|-------------|-----|
| `H03400` | Pólizas Vigentes | Consulta pólizas vigentes con filtros |
| `H03410` | Documentos por ID | Buscar documento específico |
| `H02761` | Renovaciones | Consulta renovaciones |

### Cobranza

| KeyCode | Descripción | Uso |
|---------|-------------|-----|
| `H03430_001` | Cobranza con Filtros | Consulta cobranza pagada/liquidada |

### Comisiones

| KeyCode | Descripción | Uso |
|---------|-------------|-----|
| (Por determinar) | Comisiones Pagadas | Consulta comisiones |
| (Por determinar) | Comisiones Pendientes | Consulta comisiones pendientes |

## Sistema de Filtros (ConditionsAdd)

### Estructura de un Filtro

```
NombreFiltro;Tipo;Subtipo;Valor1|Valor2;Texto1|Texto2;Flag1;Flag2;CampoDB
```

**Componentes**:
1. **NombreFiltro**: Nombre descriptivo del filtro
2. **Tipo**: Tipo de filtro (0, 1, 2, 3)
   - `0`: Texto / Like
   - `1`: Exacto
   - `2`: Lista (múltiples valores)
   - `3`: Rango (desde-hasta)
3. **Subtipo**: Subtipo específico (0, 1)
4. **Valor1|Valor2**: Valores separados por `|` (pipe)
5. **Texto1|Texto2**: Texto para mostrar, separados por `|`
6. **Flag1**: Flag adicional (0, 1, -1)
7. **Flag2**: Flag adicional (0, 1, -1)
8. **CampoDB**: Campo de base de datos a filtrar

### Múltiples Filtros

Los filtros se concatenan con `!` (exclamación):

```xml
<tem:ConditionsAdd>
  Filtro1;params!
  Filtro2;params!
  Filtro3;params
</tem:ConditionsAdd>
```

## Ejemplos de Filtros Comunes

### 1. Filtro de Fecha (Rango)

**Desde/Hasta**:
```
Desde|Hasta|Desde;3;1;01/01/2025|12/03/2025;01/Ene/2025|12/Mar/2025;0;0;DatDocumentos.FDesde
```

**Explicación**:
- Nombre: `Desde|Hasta|Desde` (tres partes para el rango)
- Tipo: `3` (Rango)
- Subtipo: `1`
- Valores: `01/01/2025|12/03/2025` (formato: DD/MM/YYYY)
- Texto: `01/Ene/2025|12/Mar/2025` (formato para mostrar)
- Flags: `0;0`
- Campo: `DatDocumentos.FDesde`

### 2. Filtro de Estatus (Lista)

**Pólizas Vigentes**:
```
Estatus;0;0;0;Vigentes;-1;0;DatDocumentos.Status
```

**Cobranza Pagada/Liquidada**:
```
Cobranza;2;0;3|4;Pagado|Liquidado;-1;0;VDatRecibos.Status
```

**Explicación**:
- Nombre: `Cobranza`
- Tipo: `2` (Lista)
- Subtipo: `0`
- Valores: `3|4` (IDs de estatus)
- Texto: `Pagado|Liquidado` (nombres)
- Flags: `-1;0`
- Campo: `VDatRecibos.Status`

### 3. Filtro de Documentos (Lista)

**Pólizas Solamente**:
```
Documentos;2;0;1;Polizas;-1;0;DatDocumentos.TipoDocto
```

**Números de Documento Específicos**:
```
Documentos;2;0;3200372939|3200373166;Doc1|Doc2;0;-1;VDatDocumentos.Documento
```

### 4. Filtro de Vendedores (Lista)

**Múltiples Vendedores**:
```
Vendedor;2;0;69|53|68;PERLA TORRES CRISTOPHER JONATHAN|HERNANDEZ VALTIERRA ISAAC CHRISTIAN|WASPERT AGENTE DE SEGUROS SA DE CV;1;0;CatVendedores.IDVend
```

**Explicación**:
- Nombre: `Vendedor`
- Tipo: `2` (Lista)
- Subtipo: `0`
- Valores: `69|53|68` (IDs de vendedores)
- Texto: Nombres completos separados por `|`
- Flags: `1;0`
- Campo: `CatVendedores.IDVend`

### 5. Filtro de Compañía (Like/Wildcard)

**Búsqueda Parcial**:
```
Compañía;0;1;*Qualitas*;*Qualitas*;1;VCatCias.CiaNombre
```

**Explicación**:
- Nombre: `Compañía`
- Tipo: `0` (Texto/Like)
- Subtipo: `1`
- Valores: `*Qualitas*` (wildcards con asteriscos)
- Texto: `*Qualitas*`
- Flag: `1`
- Campo: `VCatCias.CiaNombre`

### 6. Filtro por ID (Exacto)

**Buscar por ID de Documento**:
```
ID_Documento;0;1;2908;2908;0;-1;VDatDocumentos.IDDocto
```

**Buscar por Número de Documento**:
```
Documento;0;1;0004185818;0004185818;0;-1;VDatDocumentos.Documento
```

## Ejemplo Completo: Pólizas Vigentes con Filtros

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:ProcesarWS>
      <tem:oDataWS>
        <tem:Credentials>
          <tem:UserName>W4sP3r</tem:UserName>
          <tem:Password>wA5P3R%2020</tem:Password>
        </tem:Credentials>
        <tem:TypeFormat>XML</tem:TypeFormat>
        <tem:KeyProcess>REPORT</tem:KeyProcess>
        <tem:KeyCode>H03400</tem:KeyCode>
        <tem:Page>1</tem:Page>
        <tem:ItemForPage>10</tem:ItemForPage>
        <tem:InfoSort>DatDocumentos.FDesde</tem:InfoSort>
        <tem:ConditionsAdd>Estatus;0;0;0;Vigentes;-1;0;DatDocumentos.Status!Desde|Hasta|Desde;3;1;01/01/2020|12/03/2025;01/Ene/2020|12/Mar/2025;0;0;DatDocumentos.FDesde!Documentos;2;0;1;Polizas;-1;0;DatDocumentos.TipoDocto!Vendedor;2;0;69|53|68;PERLA TORRES CRISTOPHER JONATHAN|HERNANDEZ VALTIERRA ISAAC CHRISTIAN|WASPERT AGENTE DE SEGUROS SA DE CV;1;0;CatVendedores.IDVend</tem:ConditionsAdd>
      </tem:oDataWS>
    </tem:ProcesarWS>
  </soapenv:Body>
</soapenv:Envelope>
```

**Filtros Aplicados**:
1. **Estatus**: Solo pólizas vigentes
2. **Fecha**: Del 01/Ene/2020 al 12/Mar/2025
3. **Tipo Documento**: Solo pólizas (no endosos ni otros)
4. **Vendedores**: IDs 69, 53, 68

## Ejemplo Completo: Cobranza con Filtros

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:ProcesarWS>
      <tem:oDataWS>
        <tem:Credentials>
          <tem:UserName>W4sP3r</tem:UserName>
          <tem:Password>wA5P3R%2020</tem:Password>
        </tem:Credentials>
        <tem:TypeFormat>XML</tem:TypeFormat>
        <tem:KeyProcess>REPORT</tem:KeyProcess>
        <tem:KeyCode>H03430_001</tem:KeyCode>
        <tem:Page>1</tem:Page>
        <tem:ItemForPage>10</tem:ItemForPage>
        <tem:InfoSort>DatRecibos.FDesde</tem:InfoSort>
        <tem:ConditionsAdd>Cobranza;2;0;3|4;Pagado|Liquidado;-1;0;VDatRecibos.Status!Desde|Hasta|Desde;3;1;01/01/2025|12/03/2025;01/Ene/2025|12/Mar/2025;0;0;DatDocumentos.FDesde!Vendedor;2;0;69|53|68;PERLA TORRES CRISTOPHER JONATHAN|HERNANDEZ VALTIERRA ISAAC CHRISTIAN|WASPERT AGENTE DE SEGUROS SA DE CV;1;0;CatVendedores.IDVend</tem:ConditionsAdd>
      </tem:oDataWS>
    </tem:ProcesarWS>
  </soapenv:Body>
</soapenv:Envelope>
```

**Filtros Aplicados**:
1. **Cobranza**: Pagado (ID 3) y Liquidado (ID 4)
2. **Fecha**: Del 01/Ene/2025 al 12/Mar/2025
3. **Vendedores**: IDs 69, 53, 68

## Ejemplo Completo: Renovaciones con Filtros

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:ProcesarWS>
      <tem:oDataWS>
        <tem:Credentials>
          <tem:UserName>Usuario</tem:UserName>
          <tem:Password>Password</tem:Password>
        </tem:Credentials>
        <tem:TypeFormat>XML</tem:TypeFormat>
        <tem:KeyProcess>REPORT</tem:KeyProcess>
        <tem:KeyCode>H02761</tem:KeyCode>
        <tem:Page>1</tem:Page>
        <tem:ItemForPage>50</tem:ItemForPage>
        <tem:InfoSort>VDatRecibos.IDRecibo</tem:InfoSort>
        <tem:ConditionsAdd>Desde|Hasta;3;1;01/05/2025|20/05/2025;01/May/2025|20/May/2025;0;VDatRecibos.FDesde!Compañía;0;1;*Qualitas*;*Qualitas*;1;VCatCias.CiaNombre!Documentos;2;0;3200372939|3200373166;Doc1|Doc2;0;-1;VDatDocumentos.Documento</tem:ConditionsAdd>
      </tem:oDataWS>
    </tem:ProcesarWS>
  </soapenv:Body>
</soapenv:Envelope>
```

**Filtros Aplicados**:
1. **Fecha**: Del 01/May/2025 al 20/May/2025
2. **Compañía**: Que contenga "Qualitas"
3. **Documentos**: Pólizas específicas 3200372939 y 3200373166

## Builder de ConditionsAdd (TypeScript)

```typescript
interface FilterCondition {
  name: string;
  type: 0 | 1 | 2 | 3; // 0=Like, 1=Exact, 2=List, 3=Range
  subtype: number;
  values: string[];
  texts: string[];
  flag1: number;
  flag2?: number;
  fieldDb: string;
}

function buildConditionsAdd(filters: FilterCondition[]): string {
  return filters.map(f => {
    const valuesStr = f.values.join('|');
    const textsStr = f.texts.join('|');
    const flag2Str = f.flag2 !== undefined ? `;${f.flag2}` : '';

    return `${f.name};${f.type};${f.subtype};${valuesStr};${textsStr};${f.flag1}${flag2Str};${f.fieldDb}`;
  }).join('!');
}

// Ejemplo de uso
const filters: FilterCondition[] = [
  {
    name: 'Estatus',
    type: 0,
    subtype: 0,
    values: ['0'],
    texts: ['Vigentes'],
    flag1: -1,
    flag2: 0,
    fieldDb: 'DatDocumentos.Status'
  },
  {
    name: 'Desde|Hasta|Desde',
    type: 3,
    subtype: 1,
    values: ['01/01/2025', '12/03/2025'],
    texts: ['01/Ene/2025', '12/Mar/2025'],
    flag1: 0,
    flag2: 0,
    fieldDb: 'DatDocumentos.FDesde'
  },
  {
    name: 'Vendedor',
    type: 2,
    subtype: 0,
    values: ['69', '53', '68'],
    texts: ['PERLA TORRES', 'HERNANDEZ VALTIERRA', 'WASPERT AGENTE'],
    flag1: 1,
    flag2: 0,
    fieldDb: 'CatVendedores.IDVend'
  }
];

const conditionsAdd = buildConditionsAdd(filters);
// Result: "Estatus;0;0;0;Vigentes;-1;0;DatDocumentos.Status!Desde|Hasta|Desde;3;1;01/01/2025|12/03/2025;01/Ene/2025|12/Mar/2025;0;0;DatDocumentos.FDesde!Vendedor;2;0;69|53|68;PERLA TORRES|HERNANDEZ VALTIERRA|WASPERT AGENTE;1;0;CatVendedores.IDVend"
```

## Campos de Base de Datos Comunes

### Documentos
- `DatDocumentos.IDDocto` - ID del documento
- `DatDocumentos.Documento` - Número de documento
- `DatDocumentos.FDesde` - Fecha desde
- `DatDocumentos.FHasta` - Fecha hasta
- `DatDocumentos.Status` - Estatus del documento
- `DatDocumentos.TipoDocto` - Tipo de documento
- `VDatDocumentos.*` - Vista de documentos

### Recibos/Cobranza
- `DatRecibos.IDRecibo` - ID del recibo
- `DatRecibos.FDesde` - Fecha desde
- `VDatRecibos.Status` - Estatus del recibo
- `VDatRecibos.IDRecibo` - ID del recibo (vista)

### Vendedores
- `CatVendedores.IDVend` - ID del vendedor
- `CatVendedores.NombreCompleto` - Nombre del vendedor

### Compañías
- `VCatCias.CiaNombre` - Nombre de la compañía

## Respuesta SOAP

La respuesta viene en formato XML escapado dentro del SOAP envelope:

```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWSResponse xmlns="http://tempuri.org/">
      <ProcesarWSResult>
        &lt;PROCESSDATA&gt;
          &lt;RESPONSETXT&gt;SUCESS&lt;/RESPONSETXT&gt;
          &lt;RESPONSENBR&gt;1&lt;/RESPONSENBR&gt;
          &lt;MESSAGE&gt;Proceso ejecutado correctamente&lt;/MESSAGE&gt;
          &lt;DATAINFO&gt;
            &lt;RECORD&gt;
              &lt;IDDocto&gt;12345&lt;/IDDocto&gt;
              &lt;Documento&gt;POL-001&lt;/Documento&gt;
              ...
            &lt;/RECORD&gt;
          &lt;/DATAINFO&gt;
        &lt;/PROCESSDATA&gt;
      </ProcesarWSResult>
    </ProcesarWSResponse>
  </soap:Body>
</soap:Envelope>
```

## Comparación: Catálogos vs Reportes

| Aspecto | Catálogos (ReadInfoData) | Reportes (ProcesarWS) |
|---------|--------------------------|----------------------|
| **Método SOAP** | `ReadInfoData` | `ProcesarWS` |
| **REST Equivalente** | `/Report/ReadData` | No disponible |
| **Identificador** | `enum_name` (ej: `eDespachos`) | `KeyCode` (ej: `H03400`) |
| **Filtros** | No soportados | `ConditionsAdd` complejo |
| **Paginación** | Limitada | `Page`, `ItemForPage` |
| **Ordenamiento** | No | `InfoSort` |
| **Complejidad** | Baja | Alta |
| **Uso** | Datos de catálogo | Datos transaccionales |

## Recomendaciones

1. **Para Catálogos**: Usar REST API `/Report/ReadData` (más simple, más rápido)
2. **Para Reportes**: Usar SOAP `ProcesarWS` (única opción, más flexible)
3. **Password**: Siempre URL encode (`%20` para espacios)
4. **ConditionsAdd**: Construir programáticamente, no manualmente
5. **Testing**: Probar filtros uno por uno antes de combinar
6. **Performance**: Usar paginación para datasets grandes

## Próximos Pasos

1. Implementar `SicasSoapReportClient` para manejar `ProcesarWS`
2. Crear builder para `ConditionsAdd`
3. Actualizar funciones de pólizas, cobranza y comisiones
4. Documentar todos los KeyCodes disponibles
5. Implementar parser para respuestas XML escapadas
