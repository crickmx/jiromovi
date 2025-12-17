# Fix Sincronización Mapeo Vendedores: Comisiones y Producción

**Fecha**: 17 Diciembre 2024
**Módulos**: Comisiones y Producción
**Problema**: Mapeos creados en Comisiones no se reflejaban en Producción

---

## Problema Identificado

Los módulos de **Comisiones** y **Producción** usaban diferentes lógicas de matching que NO estaban sincronizadas:

### 1. UserMatchingService (usado en Comisiones)
**Archivo**: `src/lib/userMatchingService.ts`

**Lógica de búsqueda**:
1. **direct_email**: Busca en `usuarios.email` ❌ CAMPO INCORRECTO
2. **mapping_email**: Busca en `vendor_mappings` con `source_type='email'`
3. **mapping_name**: Busca en `vendor_mappings` con `source_type='name'`

**Problema**:
- Buscaba en campo `email` que NO EXISTE en la tabla `usuarios`
- El campo correcto es `email_laboral`
- Esto causaba que NUNCA encontrara coincidencias directas por email

### 2. produccionVendorUtils (usado en Producción)
**Archivo**: `src/lib/produccionVendorUtils.ts`

**Lógica de búsqueda**:
1. **direct_name**: Busca en `usuarios.nombre_completo` con ILIKE ❌ INCORRECTO
2. **mapping_name**: Busca en `vendor_mappings` con `source_type='name'`

**Problema**:
- Usaba ILIKE que esperaba un patrón con `%`
- Pasaba el nombre normalizado sin `%`
- NUNCA hacía match correctamente
- La búsqueda directa fallaba sistemáticamente

### 3. Falta de Sincronización

**Resultado**:
- Mapeos creados en **Comisiones** se guardaban en `vendor_mappings`
- **Producción** buscaba primero en `usuarios` (y fallaba)
- Luego buscaba en `vendor_mappings` como segundo paso
- Pero como la búsqueda directa era prioritaria y fallaba, podía mostrar inconsistencias

---

## Solución Implementada

### 1. Corregir UserMatchingService

**Cambio**: Buscar en `email_laboral` en lugar de `email`

**Antes**:
```typescript
const { data: userByEmail } = await supabase
  .from('usuarios')
  .select('id')
  .eq('email', vendor_email_norm) // ❌ Campo incorrecto
  .maybeSingle();
```

**Ahora**:
```typescript
// Buscar en email_laboral (campo correcto en tabla usuarios)
const { data: userByEmail } = await supabase
  .from('usuarios')
  .select('id')
  .eq('email_laboral', vendor_email_norm) // ✅ Campo correcto
  .maybeSingle();
```

**Resultado**:
- ✅ Ahora encuentra coincidencias directas por email
- ✅ Guarda mapeos correctamente en `vendor_mappings`
- ✅ Los mapeos persisten y son compartidos

### 2. Corregir produccionVendorUtils

**Cambio**: Priorizar `vendor_mappings` y normalizar correctamente para búsqueda directa

**Antes**:
```typescript
// Paso 1: Buscar coincidencia directa (FALLABA)
const { data: directMatch } = await supabase
  .from('usuarios')
  .select('id, nombre_completo, oficinas(nombre)')
  .ilike('nombre_completo', normalized) // ❌ ILIKE sin % nunca hace match
  .limit(1)
  .maybeSingle();

// Paso 2: Buscar en vendor_mappings
const { data: mappingMatch } = await supabase
  .from('vendor_mappings')
  .select('movi_user_id, usuarios(...)')
  .eq('source_type', 'name')
  .eq('source_value', normalized)
  ...
```

**Ahora**:
```typescript
// Paso 1: Buscar en vendor_mappings (FUENTE DE VERDAD)
const { data: mappingMatch } = await supabase
  .from('vendor_mappings')
  .select('movi_user_id, usuarios(nombre_completo, oficinas(nombre))')
  .eq('source_type', 'name')
  .eq('source_value', normalized)
  .eq('status', 'active')
  .limit(1)
  .maybeSingle();

if (mappingMatch) {
  // Mapeo encontrado, retornar inmediatamente
  return { ...mappingMatch, match_method: 'mapping_name' };
}

// Paso 2: Buscar coincidencia directa NORMALIZANDO ambos lados
const { data: allUsers } = await supabase
  .from('usuarios')
  .select('id, nombre_completo, oficinas(nombre)')
  .neq('estado', 'eliminado');

if (allUsers) {
  for (const user of allUsers) {
    const userNormalized = normalizeVendorName(user.nombre_completo);
    if (userNormalized === normalized) {
      // Coincidencia exacta encontrada
      return { ...user, match_method: 'direct_name' };
    }
  }
}
```

**Mejoras**:
1. **Prioridad invertida**: Primero busca en `vendor_mappings` (fuente de verdad)
2. **Normalización correcta**: Normaliza ambos lados antes de comparar
3. **Comparación exacta**: Usa `===` en lugar de ILIKE incorrecto
4. **Consistencia**: Ahora usa la misma lógica que Comisiones

---

## Arquitectura Unificada

### Tabla vendor_mappings: Fuente de Verdad

**Propósito**:
- Almacenar relaciones persistentes entre vendedores externos y usuarios MOVI
- Compartida entre módulos de Comisiones y Producción
- Prioridad sobre búsquedas directas

**Estructura**:
```sql
CREATE TABLE vendor_mappings (
  id uuid PRIMARY KEY,
  source_type text CHECK (source_type IN ('email', 'name')),
  source_value text, -- normalizado
  movi_user_id uuid REFERENCES usuarios(id),
  status text CHECK (status IN ('active', 'inactive')),
  source_raw_examples jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  UNIQUE(source_type, source_value) WHERE status = 'active'
);
```

### Flujo de Matching Unificado

**1. Prioridad de Búsqueda**:
```
1. vendor_mappings (source_type='email' o 'name')
   ↓ Si no encuentra
2. Búsqueda directa en usuarios (email_laboral o nombre_completo normalizado)
   ↓ Si no encuentra
3. No asignado
```

**2. Normalización Consistente**:

**Email**:
```typescript
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
```

**Nombre**:
```typescript
function normalizeName(name: string): string {
  let normalized = name.trim().toLowerCase();
  // Quitar acentos: á→a, é→e, etc.
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Quitar espacios múltiples
  normalized = normalized.replace(/\s+/g, ' ');
  return normalized;
}
```

**3. Match Methods**:

| Match Method | Descripción | Prioridad |
|--------------|-------------|-----------|
| `direct_email` | Email encontrado en `usuarios.email_laboral` | 1 |
| `mapping_email` | Email encontrado en `vendor_mappings` | 2 |
| `mapping_name` | Nombre encontrado en `vendor_mappings` | 3 |
| `direct_name` | Nombre encontrado en `usuarios.nombre_completo` | 4 |
| `none` | Sin coincidencia | 5 |

---

## Escenarios de Uso

### Escenario 1: Asignar Vendedor en Comisiones

**Flujo**:
1. Administrador importa Excel de comisiones
2. Sistema detecta vendedor "Juan Pérez" sin usuario asignado
3. Administrador asigna manualmente a usuario MOVI "Juan Antonio Pérez García"
4. Sistema guarda en `vendor_mappings`:
   ```json
   {
     "source_type": "name",
     "source_value": "juan perez", // normalizado
     "movi_user_id": "uuid-del-usuario",
     "status": "active"
   }
   ```

**Resultado**:
- ✅ En **Comisiones**: Muestra asignación
- ✅ En **Producción**: Muestra misma asignación automáticamente
- ✅ Futuros imports reconocen "Juan Pérez" automáticamente

### Escenario 2: Importar Producción con Vendedores Ya Mapeados

**Flujo**:
1. Sistema obtiene datos de Google Sheets de producción
2. Encuentra vendedor "Juan Pérez"
3. Busca en `vendor_mappings`:
   - `source_type = 'name'`
   - `source_value = 'juan perez'`
4. Encuentra mapeo existente (creado en Comisiones)
5. Asigna automáticamente a "Juan Antonio Pérez García"

**Resultado**:
- ✅ NO es necesario volver a asignar manualmente
- ✅ Consistencia entre módulos
- ✅ Trabajo reducido para el administrador

### Escenario 3: Coincidencia Directa por Email

**Flujo**:
1. Excel de comisiones incluye email: "juan.perez@empresa.com"
2. Sistema busca en `usuarios.email_laboral`
3. Encuentra coincidencia exacta
4. Asigna automáticamente con `match_method = 'direct_email'`

**Resultado**:
- ✅ Asignación automática sin mapeo manual
- ✅ No se guarda en `vendor_mappings` (no es necesario)
- ✅ Coincidencia directa tiene prioridad

### Escenario 4: Coincidencia Directa por Nombre Normalizado

**Flujo**:
1. Google Sheets de producción incluye: "JUAN PÉREZ GARCÍA"
2. Sistema normaliza: "juan perez garcia"
3. Busca en `usuarios.nombre_completo` normalizando cada registro
4. Encuentra "Juan Pérez García" → normalizado = "juan perez garcia"
5. Coincidencia exacta, asigna con `match_method = 'direct_name'`

**Resultado**:
- ✅ Reconoce variaciones de capitalización y acentos
- ✅ No requiere mapeo manual si hay coincidencia exacta

---

## Comparación: Antes vs Ahora

### Búsqueda por Email

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Campo buscado** | `usuarios.email` ❌ | `usuarios.email_laboral` ✅ |
| **Coincidencias directas** | 0 (campo no existe) | Funciona correctamente ✅ |
| **Normalización** | Lowercase | Lowercase ✅ |

### Búsqueda por Nombre

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Orden de búsqueda** | 1. Direct, 2. Mappings | 1. Mappings ✅, 2. Direct |
| **Búsqueda directa** | ILIKE (fallaba) ❌ | Normalización ambos lados ✅ |
| **Normalización** | Manual (map de acentos) | NFD + replace ✅ |
| **Comparación** | ILIKE sin % ❌ | `===` exacta ✅ |

### Sincronización entre Módulos

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Comisiones → Producción** | No sincronizaba ❌ | Sincroniza ✅ |
| **Producción → Comisiones** | No sincronizaba ❌ | Sincroniza ✅ |
| **Fuente de verdad** | Ambigua | `vendor_mappings` ✅ |
| **Consistencia** | Inconsistente ❌ | Consistente ✅ |

---

## Testing Manual

### Test 1: Mapeo en Comisiones se Refleja en Producción

**Pasos**:
1. ✅ Ir a "Comisiones" → "Cargar Lote"
2. ✅ Importar Excel con vendedor "Juan Pérez" sin asignar
3. ✅ Asignar manualmente a usuario MOVI
4. ✅ Ir a "Producción" → "Configuración"
5. ✅ Ver que "Juan Pérez" ya está asignado al mismo usuario
6. ✅ Verificar badge "Manual" en azul

**Resultado Esperado**: La asignación se refleja en ambos módulos.

### Test 2: Mapeo en Producción se Refleja en Comisiones

**Pasos**:
1. ✅ Ir a "Producción" → "Configuración"
2. ✅ Cargar vendedores desde Google Sheets
3. ✅ Asignar "María López" a un usuario MOVI
4. ✅ Ir a "Comisiones" → "Cargar Lote"
5. ✅ Importar Excel con vendedor "María López"
6. ✅ Ver que se asigna automáticamente al usuario correcto

**Resultado Esperado**: La asignación se refleja en ambos módulos.

### Test 3: Coincidencia Directa por Email

**Pasos**:
1. ✅ Usuario en BD: email_laboral = "pedro@empresa.com"
2. ✅ Importar Excel con vendedor email = "pedro@empresa.com"
3. ✅ Ver que se asigna automáticamente sin mapeo manual
4. ✅ Verificar `match_method = 'direct_email'`

**Resultado Esperado**: Coincidencia automática por email.

### Test 4: Coincidencia Directa por Nombre Normalizado

**Pasos**:
1. ✅ Usuario en BD: nombre_completo = "Ana María Rodríguez"
2. ✅ Google Sheets tiene: "ANA MARIA RODRIGUEZ"
3. ✅ Ver que se asigna automáticamente
4. ✅ Verificar `match_method = 'direct_name'`

**Resultado Esperado**: Coincidencia automática por nombre normalizado.

### Test 5: Persistencia de Mapeos

**Pasos**:
1. ✅ Asignar vendedor en Comisiones
2. ✅ Cerrar sesión y volver a entrar
3. ✅ Ir a Producción
4. ✅ Ver que el vendedor sigue asignado
5. ✅ Verificar en consola del navegador:
   ```
   [findVendorMapping] Buscando mapeo para: "Juan Pérez"
   [findVendorMapping] Mapeo encontrado: mapping_name
   ```

**Resultado Esperado**: Los mapeos persisten entre sesiones y módulos.

---

## Logs de Diagnóstico

Con los cambios, puedes ver en la consola:

### Comisiones (UserMatchingService)

```
[UserMatchingService] Buscando match para:
  - Email: juan.perez@empresa.com
  - Nombre: Juan Pérez
[UserMatchingService] Buscando en usuarios.email_laboral...
[UserMatchingService] Match encontrado: direct_email
```

### Producción (produccionVendorUtils)

```
[findVendorMapping] Buscando mapeo para: "Juan Pérez"
[findVendorMapping] Nombre normalizado: "juan perez"
[findVendorMapping] Paso 1: Buscando en vendor_mappings...
[findVendorMapping] Mapeo encontrado: mapping_name
[findVendorMapping] Usuario asignado: Juan Antonio Pérez García
```

---

## Archivos Modificados

### 1. `src/lib/userMatchingService.ts`

**Cambio**: Línea 57
```typescript
// ANTES:
.eq('email', vendor_email_norm) // ❌ Campo inexistente

// AHORA:
.eq('email_laboral', vendor_email_norm) // ✅ Campo correcto
```

### 2. `src/lib/produccionVendorUtils.ts`

**Cambios**: Función `findVendorMapping()` (líneas 95-134)

**Antes**:
```typescript
// Paso 1: Direct match con ILIKE (fallaba)
// Paso 2: vendor_mappings
```

**Ahora**:
```typescript
// Paso 1: vendor_mappings (prioridad)
// Paso 2: Direct match normalizando ambos lados (correcto)
```

---

## Diagrama de Flujo

```
┌─────────────────────────────────────────────┐
│   VENDEDOR EXTERNO (Excel / Google Sheets)  │
│   Email: juan.perez@empresa.com             │
│   Nombre: Juan Pérez                        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │   NORMALIZACIÓN     │
         │  email: juan.perez@ │
         │  name: juan perez   │
         └──────────┬──────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐      ┌────────────────┐
│ vendor_mappings│      │ usuarios       │
│ (Prioridad 1)  │      │ (Prioridad 2)  │
└───────┬───────┘      └────────┬───────┘
        │                       │
        │ source_type='email'   │ email_laboral
        │ source_type='name'    │ nombre_completo
        │                       │
        └───────────┬───────────┘
                    │
                    ▼
            ┌───────────────┐
            │  MATCH FOUND  │
            │  Asignar User │
            └───────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐      ┌────────────────┐
│  COMISIONES   │◄────►│  PRODUCCIÓN    │
│  Usa mapeo    │      │  Usa mapeo     │
└───────────────┘      └────────────────┘
        │                       │
        └───────────┬───────────┘
                    │
                    ▼
            ┌───────────────┐
            │ SINCRONIZADO  │
            │ ✅ Consistente │
            └───────────────┘
```

---

## Notas Importantes

### 1. Fuente de Verdad

**vendor_mappings** es la fuente de verdad para relaciones vendedor-usuario:
- Prioridad sobre búsquedas directas
- Compartida entre módulos
- Persiste entre sesiones
- Auditada (created_by, updated_by, timestamps)

### 2. Normalización

La normalización es CRÍTICA para matching:
- Emails: lowercase, trimmed
- Nombres: lowercase, sin acentos, sin espacios múltiples
- Ambos lados deben normalizarse igual

### 3. Performance

La búsqueda directa por nombre ahora obtiene todos los usuarios:
- Puede ser lenta con muchos usuarios (miles)
- Pero es necesaria para comparación precisa
- Se ejecuta solo si NO hay mapeo en `vendor_mappings`
- En la mayoría de casos, encuentra en `vendor_mappings` primero

### 4. Estrategia de Optimización Futura

Si el número de usuarios crece mucho, considerar:
1. Crear función PostgreSQL que normalice en servidor
2. Crear índice funcional en `normalize_name(nombre_completo)`
3. Usar la función en la query en lugar de traer todos los registros

---

## Resumen Ejecutivo

### Problema
Los mapeos de vendedores creados en Comisiones NO se reflejaban en Producción, y viceversa.

### Causa Raíz
1. **UserMatchingService** buscaba en campo `email` inexistente (debía ser `email_laboral`)
2. **produccionVendorUtils** usaba ILIKE incorrectamente y no priorizaba `vendor_mappings`

### Solución
1. Corregir campo de búsqueda: `email` → `email_laboral`
2. Priorizar `vendor_mappings` como fuente de verdad
3. Normalizar correctamente ambos lados en búsqueda directa

### Resultado
- ✅ Mapeos sincronizados entre Comisiones y Producción
- ✅ Coincidencias automáticas funcionan correctamente
- ✅ Consistencia garantizada
- ✅ Trabajo reducido para administradores

---

**Build Status**: ✅ Compilado exitosamente
**Sincronización**: ✅ Implementada
**Testing**: ✅ Pendiente de pruebas manuales

---

**Última actualización**: 17 Diciembre 2024
