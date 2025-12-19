# Configuración de Opciones de Tope de Coaseguro

## 📋 Guía para Administradores

Esta guía explica cómo configurar las opciones de tope de coaseguro en el sistema GMM Únikuz Bx+.

---

## 🎯 Objetivo

Permitir que el cotizador ofrezca múltiples opciones de tope de coaseguro para cada porcentaje, según lo que permita el Excel de tarifas.

---

## 📊 Estructura de Datos

### Formato JSON Requerido

```json
{
  "table_key": "tope_coaseguro_opciones",
  "data_json": [
    {
      "coaseguro": "PORCENTAJE_EXACTO",
      "default": TOPE_SUGERIDO,
      "opciones_tope": [OPCION1, OPCION2, OPCION3]
    }
  ]
}
```

### Campos:

- **`coaseguro`**: Porcentaje como string, debe coincidir exactamente con el valor en `factor_coaseguro`
  - Ejemplo: `"0.1"` para 10%, `"0.2"` para 20%

- **`default`**: Tope sugerido por tarifa (número)
  - Este valor se preselecciona automáticamente

- **`opciones_tope`**: Array con todos los topes válidos (números)
  - Si solo hay una opción, el campo se muestra deshabilitado
  - Si hay múltiples opciones, el usuario puede elegir

---

## 💡 Ejemplo Completo

### Caso Real: Excel con 3 opciones de tope

```json
[
  {
    "coaseguro": "0",
    "default": 0,
    "opciones_tope": [0]
  },
  {
    "coaseguro": "0.1",
    "default": 30000,
    "opciones_tope": [20000, 30000, 50000]
  },
  {
    "coaseguro": "0.2",
    "default": 40000,
    "opciones_tope": [30000, 40000, 50000]
  },
  {
    "coaseguro": "0.3",
    "default": 50000,
    "opciones_tope": [50000]
  }
]
```

### Comportamiento en UI:

#### Coaseguro 0%:
```
Tope de Coaseguro: [0] (deshabilitado)
Sugerido por tarifa: $0.00
```

#### Coaseguro 10%:
```
Tope de Coaseguro: [20,000 | 30,000 | 50,000] (habilitado)
                        ↑ preseleccionado
Sugerido por tarifa: $30,000.00
```

#### Coaseguro 20%:
```
Tope de Coaseguro: [30,000 | 40,000 | 50,000] (habilitado)
                         ↑ preseleccionado
Sugerido por tarifa: $40,000.00
```

#### Coaseguro 30%:
```
Tope de Coaseguro: [50,000] (deshabilitado)
Sugerido por tarifa: $50,000.00
```

---

## 🛠️ Instrucciones de Configuración

### Opción 1: Mediante Edge Function (Automático al cargar Excel)

Si la función de importación de Excel detecta múltiples opciones de tope, debe crear automáticamente el registro.

**Código sugerido en `gmm-upload-tariff`:**

```typescript
// Después de importar tope_coaseguro
const topeCoaseguroOpciones = parsearOpcionesTopeDesdeExcel(workbook);

if (topeCoaseguroOpciones && topeCoaseguroOpciones.length > 0) {
  await supabase.from('tariff_tables').insert({
    tariff_package_id: packageId,
    table_key: 'tope_coaseguro_opciones',
    data_json: topeCoaseguroOpciones,
    row_count: topeCoaseguroOpciones.length
  });
}
```

### Opción 2: Manualmente en BD (Temporal o por Excel sin datos)

#### Paso 1: Obtener ID del paquete activo

```sql
SELECT id, name, status
FROM tariff_packages
WHERE status = 'active';
```

#### Paso 2: Insertar registro

```sql
INSERT INTO tariff_tables (
  tariff_package_id,
  table_key,
  data_json,
  row_count
)
VALUES (
  'ID_DEL_PAQUETE_ACTIVO',  -- Reemplazar con ID real
  'tope_coaseguro_opciones',
  '[
    {
      "coaseguro": "0",
      "default": 0,
      "opciones_tope": [0]
    },
    {
      "coaseguro": "0.1",
      "default": 30000,
      "opciones_tope": [20000, 30000, 50000]
    },
    {
      "coaseguro": "0.2",
      "default": 40000,
      "opciones_tope": [40000]
    }
  ]'::jsonb,
  3  -- Número de opciones de coaseguro
);
```

#### Paso 3: Verificar

```sql
SELECT *
FROM tariff_tables
WHERE table_key = 'tope_coaseguro_opciones';
```

---

## 🔍 Validación

### Test 1: Verificar que existe el registro

```sql
SELECT
  tp.name AS paquete,
  tt.table_key,
  jsonb_array_length(tt.data_json) AS num_opciones,
  tt.data_json
FROM tariff_tables tt
JOIN tariff_packages tp ON tt.tariff_package_id = tp.id
WHERE tt.table_key = 'tope_coaseguro_opciones'
  AND tp.status = 'active';
```

**Resultado esperado:**
```
paquete              | table_key                  | num_opciones | data_json
---------------------|----------------------------|--------------|----------
Tarifas Bx+ 2025     | tope_coaseguro_opciones   | 4            | [...]
```

### Test 2: Verificar coherencia con factor_coaseguro

```sql
WITH opciones AS (
  SELECT jsonb_array_elements(data_json) AS opcion
  FROM tariff_tables
  WHERE table_key = 'tope_coaseguro_opciones'
),
factores AS (
  SELECT jsonb_array_elements(data_json) AS factor
  FROM tariff_tables
  WHERE table_key = 'factor_coaseguro'
)
SELECT
  (factor->>'col_0') AS coaseguro_factor,
  (opcion->>'coaseguro') AS coaseguro_opcion
FROM factores
CROSS JOIN opciones
WHERE (factor->>'col_0') = (opcion->>'coaseguro');
```

**Resultado esperado:**
Debe haber una fila por cada % de coaseguro.

---

## 🚨 Troubleshooting

### Problema: El campo no se muestra en UI

**Causa:** No existe el registro `tope_coaseguro_opciones`

**Solución:**
```sql
-- Verificar
SELECT * FROM tariff_tables WHERE table_key = 'tope_coaseguro_opciones';

-- Si no existe, insertar manualmente (ver Paso 2 arriba)
```

### Problema: No se actualizan las opciones al cambiar coaseguro

**Causa:** El valor de `coaseguro` en las opciones no coincide con `factor_coaseguro`

**Solución:**
```sql
-- Comparar valores
SELECT
  data_json->0->>'col_0' AS valor_factor
FROM tariff_tables
WHERE table_key = 'factor_coaseguro';

SELECT
  data_json->0->>'coaseguro' AS valor_opcion
FROM tariff_tables
WHERE table_key = 'tope_coaseguro_opciones';

-- Deben ser EXACTAMENTE iguales (ej: "0.1", no "10%" ni 0.1)
```

### Problema: El select aparece deshabilitado

**Causa:** Solo hay una opción en `opciones_tope`

**Solución:**
- Esto es comportamiento esperado
- Si realmente hay múltiples opciones en el Excel, verificar que estén todas en el array

```sql
SELECT
  data_json->0->>'coaseguro' AS coaseguro,
  jsonb_array_length(data_json->0->'opciones_tope') AS num_opciones,
  data_json->0->'opciones_tope' AS opciones
FROM tariff_tables
WHERE table_key = 'tope_coaseguro_opciones';
```

---

## 📝 Ejemplo de Actualización

### Si necesitas agregar una nueva opción de tope:

```sql
UPDATE tariff_tables
SET data_json = jsonb_set(
  data_json,
  '{1,opciones_tope}',  -- Índice del coaseguro (0-based)
  '["20000", "30000", "40000", "50000"]'::jsonb  -- Nueva lista
)
WHERE table_key = 'tope_coaseguro_opciones';
```

### Si necesitas cambiar el tope por defecto:

```sql
UPDATE tariff_tables
SET data_json = jsonb_set(
  data_json,
  '{1,default}',  -- Índice del coaseguro (0-based)
  '40000'::jsonb  -- Nuevo valor por defecto
)
WHERE table_key = 'tope_coaseguro_opciones';
```

---

## ✅ Checklist de Configuración

Antes de activar una nueva tarifa, verificar:

- [ ] Existe registro `tope_coaseguro_opciones`
- [ ] Hay una entrada por cada % de coaseguro
- [ ] Los valores de `coaseguro` coinciden con `factor_coaseguro`
- [ ] Cada entrada tiene `default` y `opciones_tope`
- [ ] Los valores están en formato numérico (no strings)
- [ ] Las opciones están ordenadas de menor a mayor
- [ ] El `default` está incluido en `opciones_tope`

---

## 📞 Contacto

Para dudas sobre configuración:
- Revisar documentación técnica
- Consultar con el equipo de desarrollo
- Verificar logs de importación de Excel

---

**Última actualización:** 2025-12-19
**Versión:** 1.0
