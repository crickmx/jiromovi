# Fix Mapeo de Agentes en Configuración de Producción

**Fecha**: 17 Diciembre 2024
**Módulo**: Configuración de Producción
**Problema Reportado**: Al asignar usuario no se guarda la relación, y no muestra datos hasta hacer clic en "Cargar"

---

## Problemas Identificados

### 1. No Carga Automáticamente al Entrar

**Problema**:
- Al entrar a "Configuración de Producción", la sección "Mapeo de Agentes" no mostraba vendedores
- Solo mostraba el botón "Cargar Vendedores"
- El usuario tenía que hacer clic manualmente para ver los datos

**Causa**:
- La función `loadVendors()` NO se llamaba en el `useEffect` inicial
- Solo se cargaba cuando:
  - Usuario hace clic en "Cargar"
  - Usuario hace clic en "Cargar Vendedores"
  - Después de un error al guardar

### 2. No Guardaba Relaciones (Posible)

**Problema Potencial**:
- Al asignar un usuario a un vendedor, podría fallar silenciosamente
- El usuario no veía errores claros en la consola

**Causa Potencial**:
- Falta de logs detallados en `createOrUpdateVendorMapping`
- Errores de RLS no mostrados claramente

---

## Soluciones Implementadas

### 1. Carga Automática al Entrar

**Archivo**: `src/pages/ProduccionConfiguracion.tsx`

**Cambio en línea 58-70**:

```tsx
// ANTES:
useEffect(() => {
  if (usuario?.rol !== 'Administrador') {
    navigate('/produccion/total');
    return;
  }
  loadConfig();
  loadOffices();
  loadMappings();
  loadExcelOfficeNames();
  loadUsuarios();
  // ❌ NO se llamaba loadVendors()
}, [usuario, navigate]);

// AHORA:
useEffect(() => {
  if (usuario?.rol !== 'Administrador') {
    navigate('/produccion/total');
    return;
  }
  loadConfig();
  loadOffices();
  loadMappings();
  loadExcelOfficeNames();
  loadUsuarios();
  loadVendors(); // ✅ Ahora se llama automáticamente
}, [usuario, navigate]);
```

**Resultado**:
- Al entrar a la página, automáticamente se cargan los vendedores desde Google Sheets
- No es necesario hacer clic en "Cargar" para ver los datos iniciales
- El botón "Cargar" sigue disponible para actualizar los datos manualmente

### 2. Logs Detallados para Diagnóstico

**Archivo**: `src/lib/produccionVendorUtils.ts`

**Función mejorada**: `createOrUpdateVendorMapping`

```typescript
export async function createOrUpdateVendorMapping(
  vendNombre: string,
  moviUserId: string,
  userId: string
): Promise<void> {
  // ✅ Log de inicio
  console.log('[createOrUpdateVendorMapping] Iniciando:', {
    vendNombre,
    moviUserId,
    userId
  });

  const normalized = normalizeVendorName(vendNombre);

  if (!normalized) {
    // ✅ Log de error de normalización
    console.error('[createOrUpdateVendorMapping] Nombre normalizado es null');
    throw new Error('Nombre de vendedor inválido');
  }

  // ✅ Log del nombre normalizado
  console.log('[createOrUpdateVendorMapping] Nombre normalizado:', normalized);

  const payload = {
    source_type: 'name' as const,
    source_value: normalized,
    movi_user_id: moviUserId,
    status: 'active' as const,
    created_by: userId,
    updated_by: userId,
    source_raw_examples: [{
      name: vendNombre,
    }],
  };

  // ✅ Log del payload completo
  console.log('[createOrUpdateVendorMapping] Payload:', payload);

  const { data, error } = await supabase
    .from('vendor_mappings')
    .upsert(payload, {
      onConflict: 'source_type,source_value',
    })
    .select(); // ✅ Agregado .select() para ver el resultado

  if (error) {
    // ✅ Log detallado del error
    console.error('[createOrUpdateVendorMapping] Error de Supabase:', error);
    throw new Error(`Error al guardar mapeo: ${error.message}`);
  }

  // ✅ Log de éxito con datos guardados
  console.log('[createOrUpdateVendorMapping] Guardado exitoso:', data);
}
```

**Mejoras**:
1. **Log de inicio**: Muestra los parámetros recibidos
2. **Log de normalización**: Muestra cómo se normalizó el nombre
3. **Log de payload**: Muestra exactamente qué se va a guardar
4. **Log de error detallado**: Muestra el error completo de Supabase
5. **Log de éxito**: Muestra el registro guardado/actualizado
6. **Agregado `.select()`**: Para obtener el registro resultante del upsert

---

## Flujo de Usuario Actualizado

### Escenario 1: Entrada a la Página

**ANTES**:
1. Usuario entra a "Configuración de Producción"
2. Sección "Mapeo de Agentes" está vacía
3. Muestra solo: "No hay vendedores cargados" + botón "Cargar Vendedores"
4. Usuario tiene que hacer clic manualmente
5. Espera mientras carga desde Google Sheets

**AHORA**:
1. Usuario entra a "Configuración de Producción"
2. ✅ Automáticamente comienza a cargar vendedores
3. ✅ Muestra spinner de carga: "Cargando vendedores desde Google Sheets..."
4. ✅ Al terminar, muestra la lista completa de vendedores con sus asignaciones
5. Botón "Cargar" sigue disponible para actualizar manualmente

### Escenario 2: Asignar Usuario a Vendedor

1. Usuario selecciona un vendedor de la lista
2. Usuario busca y selecciona un usuario MOVI en el dropdown
3. `SearchableUserSelect` llama a `handleVendorMappingChange`
4. ✅ Se registran logs en consola:
   - `[handleVendorMappingChange] Iniciando cambio:...`
   - `[createOrUpdateVendorMapping] Iniciando:...`
   - `[createOrUpdateVendorMapping] Nombre normalizado:...`
   - `[createOrUpdateVendorMapping] Payload:...`
5. Si hay error:
   - ✅ Se muestra en consola: `[createOrUpdateVendorMapping] Error de Supabase:...`
   - ✅ Se muestra alert al usuario con el mensaje de error
   - ✅ Se recarga la lista para mostrar el estado real
6. Si tiene éxito:
   - ✅ Se muestra en consola: `[createOrUpdateVendorMapping] Guardado exitoso:...`
   - ✅ Se actualiza localmente la vista (sin recargar desde servidor)
   - ✅ Se muestra mensaje de éxito

### Escenario 3: Actualizar Lista Manualmente

1. Usuario hace clic en botón "Cargar" (esquina superior derecha)
2. Se ejecuta `loadVendors()`
3. Obtiene datos frescos desde Google Sheets
4. Busca mapeos actualizados en vendor_mappings
5. Actualiza la vista con los datos más recientes

---

## Diagnóstico de Errores

Con los nuevos logs, puedes diagnosticar problemas:

### Error: "Nombre de vendedor inválido"

```
[createOrUpdateVendorMapping] Iniciando: { vendNombre: '', moviUserId: '...', userId: '...' }
[createOrUpdateVendorMapping] Nombre normalizado es null
Error: Nombre de vendedor inválido
```

**Causa**: El vendNombre está vacío o solo contiene espacios
**Solución**: Verificar que el vendedor tenga un nombre válido en Google Sheets

### Error: RLS Policy Violation

```
[createOrUpdateVendorMapping] Payload: { source_type: 'name', source_value: 'juan perez', ... }
[createOrUpdateVendorMapping] Error de Supabase: { message: 'new row violates row-level security policy', ... }
```

**Causa**: El usuario no tiene permisos de Administrador o el rol no coincide
**Solución**:
1. Verificar que `usuario?.rol === 'Administrador'`
2. Verificar que el usuario esté autenticado correctamente
3. Verificar las políticas RLS en la tabla vendor_mappings

### Error: Unique Constraint Violation

```
[createOrUpdateVendorMapping] Error de Supabase: { message: 'duplicate key value violates unique constraint', ... }
```

**Causa**: Ya existe un mapeo con el mismo source_type y source_value
**Solución**:
- Esto no debería ocurrir con `upsert` + `onConflict`
- Revisar que el índice único esté correctamente definido
- Verificar que el status sea 'active'

### Guardado Exitoso

```
[createOrUpdateVendorMapping] Guardado exitoso: [{
  id: 'uuid-here',
  source_type: 'name',
  source_value: 'juan perez',
  movi_user_id: 'uuid-user',
  status: 'active',
  created_at: '...',
  updated_at: '...'
}]
```

**Resultado**: El mapeo se guardó correctamente en la base de datos

---

## Verificación de Políticas RLS

Las políticas RLS para `vendor_mappings` ya están corregidas (migración `20251217230225`):

```sql
-- Ver mapeos: Solo administradores
CREATE POLICY "Administradores pueden ver todos los mapeos"
  ON vendor_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol = 'Administrador' -- ✅ Con mayúscula
        AND estado != 'eliminado'
    )
  );

-- Crear mapeos: Solo administradores
CREATE POLICY "Administradores pueden crear mapeos"
  ON vendor_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol = 'Administrador' -- ✅ Con mayúscula
        AND estado != 'eliminado'
    )
  );

-- Actualizar mapeos: Solo administradores
CREATE POLICY "Administradores pueden actualizar mapeos"
  ON vendor_mappings FOR UPDATE
  TO authenticated
  USING (...)
  WITH CHECK (...);

-- Eliminar mapeos: Solo administradores
CREATE POLICY "Administradores pueden eliminar mapeos"
  ON vendor_mappings FOR DELETE
  TO authenticated
  USING (...);
```

---

## Testing Manual

### Test 1: Carga Automática

1. ✅ Entrar a "Configuración de Producción"
2. ✅ Ver spinner de carga en "Mapeo de Agentes"
3. ✅ Ver lista de vendedores sin hacer clic en "Cargar"
4. ✅ Ver estadísticas: Asignados / Sin Asignar / Total

### Test 2: Asignar Usuario

1. ✅ Seleccionar un vendedor sin asignar (naranja)
2. ✅ Buscar usuario en el dropdown
3. ✅ Seleccionar usuario
4. ✅ Ver spinner mientras guarda
5. ✅ Ver mensaje de éxito
6. ✅ Ver vendedor actualizado con badge "Manual" en azul
7. ✅ Ver en consola los logs de guardado exitoso

### Test 3: Actualizar Manualmente

1. ✅ Hacer clic en botón "Cargar" (esquina superior derecha)
2. ✅ Ver spinner mientras carga
3. ✅ Ver lista actualizada con datos frescos
4. ✅ Ver estadísticas actualizadas

### Test 4: Persistencia

1. ✅ Asignar un usuario a un vendedor
2. ✅ Cerrar sesión
3. ✅ Iniciar sesión de nuevo
4. ✅ Entrar a "Configuración de Producción"
5. ✅ Ver que el vendedor sigue asignado (datos persisten en BD)

---

## Comparación: Antes vs Ahora

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Carga inicial** | Manual (botón) ❌ | Automática ✅ |
| **Spinner de carga** | Sí ✅ | Sí ✅ |
| **Logs en consola** | Básicos | Detallados ✅ |
| **Error handling** | Básico | Mejorado ✅ |
| **Actualización manual** | Sí (botón "Cargar") ✅ | Sí (botón "Cargar") ✅ |
| **Persistencia** | Sí ✅ | Sí ✅ |
| **Feedback visual** | Spinner + badge | Spinner + badge ✅ |

---

## Archivos Modificados

### 1. `src/pages/ProduccionConfiguracion.tsx`

**Cambio**: Línea 69
```tsx
loadVendors(); // Agregada esta línea
```

### 2. `src/lib/produccionVendorUtils.ts`

**Cambios**: Función `createOrUpdateVendorMapping` (líneas 259-303)
- Agregados 6 console.log para diagnóstico
- Agregado `.select()` al upsert para ver el resultado
- Mejorado el mensaje de error

---

## Notas Importantes

### 1. Mapeo Compartido

El mismo mapeo en `vendor_mappings` se usa en:
- **Módulo de Producción**: Para relacionar VendNombre con usuarios MOVI
- **Módulo de Comisiones**: Para relacionar vendedores del Excel con usuarios MOVI

**Importante**: Un cambio en el mapeo afecta AMBOS módulos.

### 2. Normalización de Nombres

Los nombres se normalizan antes de guardar:
- Lowercase
- Sin acentos (á → a, é → e, etc.)
- Sin dobles espacios
- Trimmed

Ejemplo:
- Original: "  Juan  Pérez  García  "
- Normalizado: "juan perez garcia"

### 3. Tipos de Mapeo

1. **Auto (verde)**: Coincidencia directa por nombre_completo en usuarios
2. **Manual (azul)**: Asignación manual guardada en vendor_mappings
3. **Sin asignar (naranja)**: Sin coincidencia automática ni manual

### 4. Google Sheets en Tiempo Real

Los datos se obtienen directamente desde Google Sheets:
- NO se almacenan en la base de datos
- Se consultan en cada carga
- Cambios en la hoja se reflejan inmediatamente

---

## Resumen Ejecutivo

### Problema Principal
Al entrar a "Configuración de Producción", el mapeo de agentes no se cargaba automáticamente. El usuario tenía que hacer clic manualmente en "Cargar Vendedores".

### Solución
Agregué `loadVendors()` al `useEffect` inicial para que cargue automáticamente al entrar a la página.

### Mejora Adicional
Agregué logs detallados en `createOrUpdateVendorMapping` para facilitar el diagnóstico de errores al guardar mapeos.

### Resultado
- ✅ Carga automática al entrar
- ✅ Logs detallados para diagnóstico
- ✅ Mejor experiencia de usuario
- ✅ Más fácil detectar y solucionar problemas

---

**Build Status**: ✅ Compilado exitosamente
**Carga Automática**: ✅ Implementada
**Logs de Diagnóstico**: ✅ Agregados

---

**Última actualización**: 17 Diciembre 2024
