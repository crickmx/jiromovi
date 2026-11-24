# 🔍 Guía de Debug de Filtros SICAS H03400

## ⚠️ Problema Detectado

Tu request SOAP a H03400 tiene **3 focos rojos** que pueden causar "Reporte sin datos":

### 1. Campo de Fecha Incorrecto ❌
- **Actual**: Filtrando por `DatDocumentos.FDesde` (fecha de vigencia)
- **Ejemplo PDF**: Filtra por `DatDocumentos.FCaptura` (fecha de captura)
- **Impacto**: Si el reporte está diseñado para `FCaptura`, filtrar por `FDesde` puede devolver 0 registros

### 2. Falta de Horas en el Rango ❌
- **Actual**: `16/02/2025|16/02/2026` (sin horas)
- **Ejemplo PDF**: `11/05/2020 00:00|11/05/2020 23:59:59` (con horas)
- **Impacto**: Algunos reportes parsean mal fechas sin horas o aplican defaults incorrectos

### 3. Orden de Flags Diferente ❌
- **Actual**: `flag1=-1;flag2=0` → `-1;0`
- **Ejemplo PDF**: `flag1=0;flag2=-1` → `0;-1`
- **Impacto**: Si los flags significan algo (incluir/excluir, etc.), invertirlos puede invalidar el filtro

---

## 🎯 Solución: Debug Incremental

Hemos creado una herramienta que prueba **5 escenarios** para identificar exactamente qué filtro causa el problema.

### Cómo Usar

1. **Abre el archivo HTML**: `test-sicas-filtros-debug.html`
2. **Ejecuta los tests en orden**: 1 → 2 → 3 → 4A → 4B
3. **Analiza dónde falla**: El primer test que da 0 registros es el culpable

---

## 📊 Tests Disponibles

### Test 1: Sin Filtros (Baseline)
```
ConditionsAdd: (vacío)
```

**¿Qué valida?**
- Permisos del usuario en SICAS
- Disponibilidad del reporte H03400
- Existencia de datos en general

**Si da 0 registros:**
- ❌ Usuario no tiene acceso al reporte
- ❌ Reporte no habilitado para este perfil
- ❌ Base de datos vacía (poco probable)

**Si devuelve registros:**
- ✅ Usuario tiene permisos
- ✅ Reporte funciona
- ✅ Problema es específico de los filtros

---

### Test 2: Solo TipoDocto
```
ConditionsAdd: Documentos;2;0;1;Polizas;-1;0;DatDocumentos.TipoDocto
```

**¿Qué valida?**
- Filtro de tipo de documento funciona
- Existen pólizas en el sistema (vs otros documentos)

**Si da 0 registros:**
- ⚠️ No hay pólizas en el sistema (solo endosos, renovaciones, etc.)
- ⚠️ Filtro de TipoDocto está mal formado

**Si devuelve registros:**
- ✅ Filtro de TipoDocto funciona
- ✅ Hay pólizas disponibles

---

### Test 3: Estatus + TipoDocto
```
ConditionsAdd:
  Estatus;0;0;0;Vigentes;-1;0;DatDocumentos.Status!
  Documentos;2;0;1;Polizas;-1;0;DatDocumentos.TipoDocto
```

**¿Qué valida?**
- Combinación de múltiples filtros
- Existen pólizas vigentes

**Si da 0 registros:**
- ⚠️ No hay pólizas vigentes (todas vencidas o canceladas)
- ⚠️ Combinación de filtros con `!` mal formada

**Si devuelve registros:**
- ✅ Filtros múltiples funcionan
- ✅ Hay pólizas vigentes

---

### Test 4A: Todo + FCaptura (Ejemplo Oficial) ⭐
```
ConditionsAdd:
  Estatus;0;0;0;Vigentes;-1;0;DatDocumentos.Status!
  Documentos;2;0;1;Polizas;-1;0;DatDocumentos.TipoDocto!
  Desde|Hasta|Captura;3;1;DD/MM/YYYY 00:00|DD/MM/YYYY 23:59:59;DD/MM/YYYY|DD/MM/YYYY;0;-1;DatDocumentos.FCaptura
```

**¿Qué valida?**
- Filtro de fecha por **CAPTURA** (como el ejemplo oficial)
- Formato con horas
- Flags en orden `0;-1` (como el ejemplo)

**Si da 0 registros:**
- ⚠️ No hay pólizas capturadas en el último año
- ⚠️ Campo `FCaptura` no es el correcto para este reporte

**Si devuelve registros:**
- ✅ Este es el formato correcto
- ✅ Debes usar `FCaptura` en producción

---

### Test 4B: Todo + FDesde (Vigencia)
```
ConditionsAdd:
  Estatus;0;0;0;Vigentes;-1;0;DatDocumentos.Status!
  Documentos;2;0;1;Polizas;-1;0;DatDocumentos.TipoDocto!
  Desde|Hasta|Desde;3;1;DD/MM/YYYY 00:00|DD/MM/YYYY 23:59:59;DD/MM/YYYY|DD/MM/YYYY;0;-1;DatDocumentos.FDesde
```

**¿Qué valida?**
- Filtro de fecha por **VIGENCIA** (fecha desde)
- Formato con horas
- Flags en orden `0;-1`

**Si da 0 registros:**
- ⚠️ No hay pólizas vigentes en el último año por fecha de inicio

**Si devuelve registros:**
- ✅ Puedes usar `FDesde` para filtrar por vigencia

---

## 🎓 Cómo Interpretar Resultados

### Escenario 1: Test 1 devuelve 0
```
Test 1: 0 registros ❌
```

**Problema**: Usuario sin permisos o reporte no disponible

**Solución**:
1. Verificar permisos en SICAS
2. Contactar a SICAS para habilitar H03400
3. Confirmar credenciales correctas

---

### Escenario 2: Test 1 ✅ pero Test 2 devuelve 0
```
Test 1: 50 registros ✅
Test 2: 0 registros ❌
```

**Problema**: Filtro TipoDocto mal formado o no hay pólizas

**Solución**:
1. Revisar si existen pólizas en SICAS (puede que solo haya renovaciones/endosos)
2. Verificar el código correcto de "Pólizas" (puede no ser `1`)

---

### Escenario 3: Test 2 ✅ pero Test 3 devuelve 0
```
Test 1: 50 registros ✅
Test 2: 30 registros ✅
Test 3: 0 registros ❌
```

**Problema**: No hay pólizas vigentes o filtro de estatus incorrecto

**Solución**:
1. Confirmar que existen pólizas con Status=0 (vigentes)
2. Verificar el código correcto de "Vigentes" en tu SICAS

---

### Escenario 4: Test 3 ✅ pero Test 4A/4B devuelven 0
```
Test 1: 50 registros ✅
Test 2: 30 registros ✅
Test 3: 25 registros ✅
Test 4A: 0 registros ❌
Test 4B: 0 registros ❌
```

**Problema**: Rango de fechas demasiado restrictivo

**Solución**:
1. Ampliar el rango (por ejemplo, últimos 2 años en lugar de 1)
2. Verificar si las pólizas tienen fechas correctas en SICAS
3. Probar sin filtro de fecha

---

### Escenario 5: Test 4A ✅ pero Test 4B devuelve 0 (o viceversa)
```
Test 4A: 20 registros ✅ (FCaptura)
Test 4B: 0 registros ❌ (FDesde)
```

**Problema**: Campo de fecha incorrecto

**Solución**:
- Si 4A funciona: **USA `FCaptura`** en producción
- Si 4B funciona: **USA `FDesde`** en producción

---

## ✅ Formato Correcto Final

Basado en los resultados de tu debug, usa este formato:

### Opción A: Si Test 4A funciona (FCaptura)
```typescript
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
    name: 'Documentos',
    type: 2,
    subtype: 0,
    values: ['1'],
    texts: ['Polizas'],
    flag1: -1,
    flag2: 0,
    fieldDb: 'DatDocumentos.TipoDocto'
  },
  {
    name: 'Desde|Hasta|Captura', // ⚠️ Nombre cambiado
    type: 3,
    subtype: 1,
    values: ['01/01/2025 00:00', '31/12/2025 23:59:59'], // ⚠️ Con horas
    texts: ['01/01/2025', '31/12/2025'],
    flag1: 0,     // ⚠️ Flags invertidos
    flag2: -1,    // ⚠️ Flags invertidos
    fieldDb: 'DatDocumentos.FCaptura' // ⚠️ FCaptura
  }
];
```

### Opción B: Si Test 4B funciona (FDesde)
```typescript
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
    name: 'Documentos',
    type: 2,
    subtype: 0,
    values: ['1'],
    texts: ['Polizas'],
    flag1: -1,
    flag2: 0,
    fieldDb: 'DatDocumentos.TipoDocto'
  },
  {
    name: 'Desde|Hasta|Desde',
    type: 3,
    subtype: 1,
    values: ['01/01/2025 00:00', '31/12/2025 23:59:59'], // ⚠️ Con horas
    texts: ['01/01/2025', '31/12/2025'],
    flag1: 0,     // ⚠️ Flags invertidos
    flag2: -1,    // ⚠️ Flags invertidos
    fieldDb: 'DatDocumentos.FDesde' // FDesde (vigencia)
  }
];
```

---

## 🔐 Seguridad: Rotación de Credenciales

**⚠️ CRÍTICO**: El request que enviaste contiene credenciales reales expuestas:

```
UserName: W4sP3r
Password: wA5P3R 2020
```

### Acciones Inmediatas

1. **Rotar credenciales en SICAS** (cambiar password hoy)
2. **Mover a Supabase Secrets**:
   ```bash
   # En tu proyecto Supabase
   supabase secrets set SICAS_USERNAME=nuevo_usuario
   supabase secrets set SICAS_PASSWORD=nuevo_password
   ```
3. **Actualizar edge functions** para usar:
   ```typescript
   const username = Deno.env.get('SICAS_USERNAME');
   const password = Deno.env.get('SICAS_PASSWORD');
   ```

---

## 📞 Siguiente Paso

1. **Ejecuta el debug**: Abre `test-sicas-filtros-debug.html` y prueba los 5 tests
2. **Comparte resultados**: Dime cuál test es el primero que falla
3. **Ajustamos el código**: Actualizamos `sicasSoapReportClient.ts` con el formato correcto

---

## 🎯 Objetivo Final

Una vez que identifiques el formato correcto:

1. Actualizaremos los helpers en `sicasSoapReportClient.ts`
2. Ajustaremos todos los edge functions que usan H03400
3. Implementaremos el mismo patrón para H03117 (producción)
4. Documentaremos el formato oficial para futuros reportes

---

**¡Listo para debuguear!** 🚀
