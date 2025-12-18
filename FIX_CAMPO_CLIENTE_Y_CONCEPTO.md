# Fix: Campo Cliente y Concepto en Mi Producción

## Problema Reportado

1. **Campo "Cliente"** mostraba el nombre del despacho/oficina en lugar del nombre del cliente real
2. **Campo "Concepto"** no aparecía en el detalle del documento aunque existe en la fuente

## Causa Raíz

### Problema 1: Campo Cliente

El Google Sheet tiene DOS campos separados:
- **`DespNombre`**: Nombre del despacho/oficina (ej: "MARSELLA CORPORATIVO")
- **`NombreCompleto`**: Nombre del cliente/asegurado real (ej: "Juan Pérez García")

La tabla `production_records` solo tenía el campo `desp_nombre_raw` que se usaba para ambos propósitos, capturando solo uno de ellos según la lógica de importación.

### Problema 2: Campo Concepto

El campo `concepto` existe en la tabla pero todos los registros actuales tienen valor `NULL` porque:
- O no existe en el Excel original
- O la sincronización no estaba capturándolo correctamente

## Solución Implementada

### 1. Migración de Base de Datos ✅

**Archivo:** `supabase/migrations/..._add_nombre_cliente_to_production_records.sql`

**Cambios:**
```sql
-- Agregar nueva columna para separar cliente de despacho
ALTER TABLE production_records
  ADD COLUMN nombre_cliente text;

-- Índice para búsquedas eficientes
CREATE INDEX idx_production_records_nombre_cliente
  ON production_records(nombre_cliente);
```

**Resultado:**
- `desp_nombre_raw`: Almacena el nombre del despacho/oficina (campo `DespNombre`)
- `nombre_cliente`: Almacena el nombre del cliente real (campo `NombreCompleto`)

### 2. Edge Function: sync-google-sheets ✅

**Archivo:** `supabase/functions/sync-google-sheets/index.ts`

**Antes:**
```typescript
const clienteNombre = (getColumnValue(['NombreCompleto']) || '').toString().trim();
// ...
desp_nombre_raw: clienteNombre,
```

**Ahora:**
```typescript
// Capturar AMBOS campos del Excel
const despNombre = (getColumnValue(['DespNombre', 'despnombre']) || '').toString().trim();
const nombreCompleto = (getColumnValue(['NombreCompleto', 'nombrecompleto']) || '').toString().trim();

// ...
desp_nombre_raw: despNombre || nombreCompleto, // Oficina
nombre_cliente: nombreCompleto || null,         // Cliente
concepto: (getColumnValue(['Concepto', 'concepto']) || '').toString().trim() || null,
```

**Lógica:**
- Si existe `DespNombre` → va a `desp_nombre_raw`
- Si existe `NombreCompleto` → va a `nombre_cliente`
- Si solo existe uno, se usa como fallback para ambos

### 3. Edge Function: get-my-production ✅

**Archivo:** `supabase/functions/get-my-production/index.ts`

**Cambios:**
- El `select('*')` ya incluye automáticamente el nuevo campo `nombre_cliente`
- Actualizada búsqueda de clientes para incluir ambos campos:

```typescript
// Búsqueda de cliente (incluir nombre_cliente en la búsqueda)
if (clienteSearch) {
  query = query.or(`desp_nombre_raw.ilike.%${clienteSearch}%,nombre_cliente.ilike.%${clienteSearch}%,gerencia_nombre_raw.ilike.%${clienteSearch}%`);
}
```

### 4. Frontend: MiProduccion.tsx ✅

**Archivo:** `src/pages/MiProduccion.tsx`

**Cambios en Interfaz:**
```typescript
interface ProductionRecord {
  // ... otros campos
  desp_nombre_raw: string;
  nombre_cliente: string | null;  // NUEVO
  concepto: string | null;
  // ...
}
```

**Cambios en Tabla:**
```typescript
// ANTES: Solo mostraba despacho
<td>{record.desp_nombre_raw}</td>

// AHORA: Prioriza nombre del cliente
<td>{record.nombre_cliente || record.desp_nombre_raw}</td>
```

**Cambios en Búsqueda:**
```typescript
filtered = filtered.filter(r =>
  r.desp_nombre_raw?.toLowerCase().includes(search) ||
  r.nombre_cliente?.toLowerCase().includes(search) ||  // NUEVO
  r.aseguradora_nombre?.toLowerCase().includes(search) ||
  r.ramo_nombre?.toLowerCase().includes(search)
);
```

### 5. Modal de Detalle: DetalleDocumentoModal.tsx ✅

**Archivo:** `src/components/produccion/DetalleDocumentoModal.tsx`

**Cambios en Interfaz:**
```typescript
interface DocumentoDetalle {
  // ... otros campos
  desp_nombre_raw: string;
  nombre_cliente?: string | null;  // NUEVO
  concepto?: string | null;         // Ya existía
  // ...
}
```

**Cambios en UI:**
```tsx
<div className="bg-neutral-50 rounded-lg p-4 space-y-3">
  <h3>Cliente</h3>
  <div className="space-y-2">
    {/* Mostrar nombre del cliente */}
    <p className="text-sm font-medium">
      {documento.nombre_cliente || documento.desp_nombre_raw}
    </p>

    {/* Si ambos existen, mostrar también el despacho */}
    {documento.nombre_cliente && documento.desp_nombre_raw && (
      <div className="pt-2 border-t">
        <p className="text-xs text-neutral-500">Despacho/Oficina</p>
        <p className="text-sm">{documento.desp_nombre_raw}</p>
      </div>
    )}
  </div>
</div>

{/* Concepto ya se mostraba correctamente */}
<InfoItem
  icon={FileText}
  label="Concepto"
  value={documento.concepto || '-'}
/>
```

## Estado Actual

### Registros Existentes (524K registros)

Los registros actuales tienen:
- ✅ `desp_nombre_raw`: Poblado (contiene lo que había en `NombreCompleto`)
- ❌ `nombre_cliente`: `NULL` (columna recién creada)
- ❌ `concepto`: `NULL` (nunca se capturó)

**Comportamiento:**
- Frontend mostrará el valor de `desp_nombre_raw` como fallback
- No hay pérdida de funcionalidad
- Se ve igual que antes hasta que se sincronicen nuevos datos

### Nuevas Importaciones (Futuras)

Cuando se ejecute `sync-google-sheets` con el código actualizado:
- ✅ Capturará `DespNombre` → `desp_nombre_raw`
- ✅ Capturará `NombreCompleto` → `nombre_cliente`
- ✅ Capturará `Concepto` → `concepto`

**Comportamiento:**
- Frontend mostrará el nombre del cliente real
- Detalle mostrará tanto cliente como despacho (si ambos existen)
- Concepto aparecerá si está en el Excel

## Requisitos del Google Sheet

Para que todo funcione correctamente, el Google Sheet debe tener estas columnas:

### Columnas Requeridas

| Columna | Descripción | Ejemplo | Destino DB |
|---------|-------------|---------|------------|
| `FechaSimp` | Fecha del documento | 15/11/2024 | `fecha` |
| `VendNombre` | Nombre del agente | ACOSTA SANTILLAN IRMA | `agente_nombre` |
| **`DespNombre`** | Nombre del despacho/oficina | MARSELLA CORPORATIVO | `desp_nombre_raw` |
| **`NombreCompleto`** | Nombre del cliente/asegurado | Juan Pérez García | `nombre_cliente` |
| `GerenciaNombre` | Nombre de la gerencia | Irma Acosta | `gerencia_nombre_raw` |
| `Nombre Compañía` | Aseguradora | AXA | `aseguradora_nombre` |
| `Sub Ramo` | Ramo del seguro | Autos | `ramo_nombre` |
| **`Concepto`** | Concepto/descripción | Renovación | `concepto` |
| `IMPORTE PESOS` | Importe en pesos | 5000.00 | `importe_pesos` |
| `Prima de convenio` | Prima de convenio | 4500.00 | `prima_convenio` |

### Variaciones Aceptadas

El sistema busca las columnas con diferentes variaciones de mayúsculas/minúsculas:
- `DespNombre`, `despnombre`, `desp nombre`
- `NombreCompleto`, `nombrecompleto`, `nombre completo`
- `Concepto`, `concepto`

## Instrucciones para Activar los Cambios

### Para el Administrador

1. **Verificar Google Sheet**
   - Abrir el Google Sheet de producción
   - Confirmar que existen las columnas:
     - `DespNombre` o similar
     - `NombreCompleto` o similar
     - `Concepto` o similar
   - Si no existen, agregarlas con datos apropiados

2. **Ejecutar Sincronización**
   ```
   - Ir a "Configuración de Producción" en MOVI Digital
   - Hacer clic en "Sincronizar desde Google Sheets"
   - Esperar a que termine el proceso
   ```

3. **Verificar Resultados**
   - Ir a "Mi Producción" como agente
   - Confirmar que:
     - La columna "Cliente" muestra nombres de personas reales
     - El detalle del documento muestra "Concepto"
     - Si hay despacho y cliente, ambos aparecen en el detalle

### Para Usuarios Agente

**Sin sincronización nueva:**
- Todo sigue funcionando igual que antes
- No hay cambios visibles

**Después de sincronización:**
- La columna "Cliente" mostrará el nombre real del cliente
- El detalle mostrará información más completa
- Búsquedas funcionarán tanto con cliente como con despacho

## Casos de Uso

### Caso 1: Solo existe NombreCompleto en Excel
```
Excel:
  NombreCompleto: "Juan Pérez García"
  DespNombre: (vacío)

Base de Datos:
  desp_nombre_raw: "Juan Pérez García"
  nombre_cliente: "Juan Pérez García"

Frontend:
  Muestra: "Juan Pérez García"
```

### Caso 2: Solo existe DespNombre en Excel
```
Excel:
  NombreCompleto: (vacío)
  DespNombre: "MARSELLA CORPORATIVO"

Base de Datos:
  desp_nombre_raw: "MARSELLA CORPORATIVO"
  nombre_cliente: NULL

Frontend:
  Muestra: "MARSELLA CORPORATIVO"
```

### Caso 3: Existen ambos campos (IDEAL)
```
Excel:
  NombreCompleto: "Juan Pérez García"
  DespNombre: "MARSELLA CORPORATIVO"

Base de Datos:
  desp_nombre_raw: "MARSELLA CORPORATIVO"
  nombre_cliente: "Juan Pérez García"

Frontend (Lista):
  Muestra: "Juan Pérez García"

Frontend (Detalle):
  Cliente: "Juan Pérez García"
  Despacho/Oficina: "MARSELLA CORPORATIVO"
```

## Verificación de Corrección

### Query SQL para Verificar Datos

```sql
-- Ver registros con nombre_cliente poblado (después de sincronización)
SELECT
  fecha,
  desp_nombre_raw,
  nombre_cliente,
  concepto,
  agente_nombre,
  importe_pesos
FROM production_records
WHERE nombre_cliente IS NOT NULL
ORDER BY fecha DESC
LIMIT 10;
```

### Checklist de Verificación

- [ ] Migración aplicada exitosamente
- [ ] Edge function `sync-google-sheets` actualizada
- [ ] Edge function `get-my-production` actualizada
- [ ] Frontend `MiProduccion.tsx` actualizado
- [ ] Modal `DetalleDocumentoModal.tsx` actualizado
- [ ] Proyecto compila sin errores
- [ ] Google Sheet tiene columnas requeridas
- [ ] Sincronización ejecutada con éxito
- [ ] Nuevos registros muestran cliente correcto
- [ ] Concepto aparece en detalle (si existe en Excel)

## Notas Importantes

1. **Datos Existentes**: Los 524K registros existentes mantendrán `nombre_cliente = NULL` hasta que:
   - Se ejecute una re-sincronización completa (no recomendado por volumen)
   - O se agreguen solo registros nuevos

2. **Compatibilidad**: El sistema es retrocompatible. Si `nombre_cliente` es NULL, automáticamente usa `desp_nombre_raw` como fallback.

3. **Concepto**: El campo `concepto` siempre existió en el modal. El problema era que todos los registros tenían `concepto = NULL`. Con la sincronización actualizada, los nuevos registros tendrán concepto si existe en el Excel.

4. **Performance**: Se agregó índice en `nombre_cliente` para mantener búsquedas rápidas.

## Resumen de Archivos Modificados

### Base de Datos
- ✅ Nueva migración: `add_nombre_cliente_to_production_records.sql`

### Edge Functions
- ✅ `supabase/functions/sync-google-sheets/index.ts`
- ✅ `supabase/functions/get-my-production/index.ts`

### Frontend
- ✅ `src/pages/MiProduccion.tsx`
- ✅ `src/components/produccion/DetalleDocumentoModal.tsx`

### Documentación
- ✅ Este archivo: `FIX_CAMPO_CLIENTE_Y_CONCEPTO.md`

## Contacto y Soporte

Si después de la sincronización los datos no aparecen correctamente:
1. Verificar que el Google Sheet tenga las columnas con nombres correctos
2. Revisar logs de la sincronización en Supabase
3. Ejecutar la query SQL de verificación
4. Confirmar que la migración se aplicó correctamente
