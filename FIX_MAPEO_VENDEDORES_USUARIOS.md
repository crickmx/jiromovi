# Fix: Mapeo de Vendedores - Lista de Usuarios

## Problema Reportado

En la página "Mapeo de Agentes" (MapeoVendedores), se cargan los vendedores pero no aparecen usuarios en el select de asignación, solo muestra "--Sin asignar--".

## Causa Raíz Probable

El problema puede deberse a:

1. **Políticas RLS (Row Level Security)** muy restrictivas en la tabla `usuarios` que impiden que los usuarios autenticados vean a otros usuarios
2. **Error silencioso** en la consulta a la base de datos que no se mostraba en UI
3. **Usuarios eliminados** incluidos en los resultados

## Cambios Implementados

### 1. Mejoras en Logging

**Archivo**: `src/lib/vendorMappingUtils.ts`

```typescript
export async function obtenerUsuariosMOVI() {
  console.log('[obtenerUsuariosMOVI] Obteniendo usuarios...');
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, email, oficina_id')
    .neq('estado', 'eliminado')  // ← NUEVO: Excluir usuarios eliminados
    .order('nombre_completo');

  if (error) {
    console.error('[obtenerUsuariosMOVI] Error:', error);
    throw error;
  }

  console.log('[obtenerUsuariosMOVI] Usuarios obtenidos:', data?.length || 0);
  return data;
}
```

**Mejoras**:
- Filtra usuarios con `estado = 'eliminado'`
- Logs detallados en consola
- Muestra cantidad de usuarios obtenidos

### 2. Mejoras en UI - Select con Opciones Por Defecto

**Archivo**: `src/pages/MapeoVendedores.tsx`

```typescript
<select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
  <option value="">--Sin asignar--</option>
  {usuarios.length === 0 ? (
    <option disabled>No hay usuarios disponibles</option>
  ) : (
    usuarios.map((u) => (
      <option key={u.id} value={u.id}>
        {u.nombre_completo} ({u.email})
      </option>
    ))
  )}
</select>
{usuarios.length === 0 && (
  <p className="text-sm text-red-600 mt-1">
    No se pudieron cargar los usuarios. Verifica la consola del navegador (F12).
  </p>
)}
```

**Mejoras**:
- Opción por defecto "--Sin asignar--"
- Mensaje claro cuando no hay usuarios
- Alerta visual cuando falla la carga

### 3. Manejo de Errores Mejorado

```typescript
const cargarDatos = async () => {
  try {
    setLoading(true);
    const [mapeosData, usuariosData] = await Promise.all([
      obtenerVendorMappings(filtroEstatus === 'all' ? undefined : filtroEstatus),
      obtenerUsuariosMOVI(),
    ]);
    console.log('[MapeoVendedores] Usuarios cargados:', usuariosData?.length || 0);
    setMapeos(mapeosData);
    setUsuarios(usuariosData || []);
  } catch (error) {
    console.error('[MapeoVendedores] Error al cargar datos:', error);
    alert('Error al cargar datos: ' + (error as Error).message);  // ← NUEVO
  } finally {
    setLoading(false);
  }
};
```

## Diagnóstico Paso a Paso

Sigue estos pasos para diagnosticar el problema:

### Paso 1: Verificar Logs en Consola

1. Abre la página "Mapeo de Agentes"
2. Presiona `F12` para abrir DevTools
3. Ve a la pestaña "Console"
4. Busca estos mensajes:

```
[obtenerUsuariosMOVI] Obteniendo usuarios...
[obtenerUsuariosMOVI] Usuarios obtenidos: X
[MapeoVendedores] Usuarios cargados: X
```

**Si ves "Usuarios obtenidos: 0"**:
- Problema de RLS o no hay usuarios en la tabla

**Si ves un error**:
- Problema con las políticas RLS o estructura de tabla

### Paso 2: Verificar RLS en Tabla Usuarios

Ejecuta esta query en Supabase Dashboard → SQL Editor:

```sql
-- Ver las políticas RLS actuales
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'usuarios';
```

**Debe existir una política SELECT como**:

```sql
CREATE POLICY "Authenticated users can view all users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (estado != 'eliminado');
```

### Paso 3: Verificar Usuarios en BD

```sql
-- Ver cuántos usuarios activos hay
SELECT
  COUNT(*) as total_usuarios,
  COUNT(*) FILTER (WHERE estado = 'activo') as activos,
  COUNT(*) FILTER (WHERE estado = 'eliminado') as eliminados
FROM usuarios;
```

### Paso 4: Probar Query Manualmente

```sql
-- Simular la query que hace la app
SELECT id, nombre_completo, email, oficina_id
FROM usuarios
WHERE estado != 'eliminado'
ORDER BY nombre_completo;
```

**Si devuelve resultados**: Problema con RLS
**Si no devuelve nada**: No hay usuarios en la tabla

## Soluciones por Escenario

### Escenario 1: RLS Muy Restrictiva

**Síntoma**: Query manual funciona pero app no carga usuarios

**Solución**: Actualizar política RLS

```sql
-- Eliminar política restrictiva (si existe)
DROP POLICY IF EXISTS "Users can view own data" ON usuarios;

-- Crear política permisiva para lectura
CREATE POLICY "Authenticated users can view all active users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (estado != 'eliminado');
```

### Escenario 2: No Hay Usuarios en la BD

**Síntoma**: Query devuelve 0 resultados

**Solución**: Insertar usuarios de prueba

```sql
-- Insertar usuario de prueba
INSERT INTO usuarios (email, nombre_completo, rol, estado)
VALUES
  ('usuario1@ejemplo.com', 'Usuario Prueba 1', 'Agente', 'activo'),
  ('usuario2@ejemplo.com', 'Usuario Prueba 2', 'Agente', 'activo');
```

### Escenario 3: Todos los Usuarios Están Eliminados

**Síntoma**: Hay usuarios pero todos tienen `estado = 'eliminado'`

**Solución**: Reactivar usuarios

```sql
-- Reactivar usuarios eliminados
UPDATE usuarios
SET estado = 'activo'
WHERE estado = 'eliminado';
```

### Escenario 4: Columna 'estado' No Existe

**Síntoma**: Error "column 'estado' does not exist"

**Solución**: Remover filtro temporalmente

Edita `src/lib/vendorMappingUtils.ts`:

```typescript
export async function obtenerUsuariosMOVI() {
  console.log('[obtenerUsuariosMOVI] Obteniendo usuarios...');
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, email, oficina_id')
    // .neq('estado', 'eliminado')  // ← COMENTAR esta línea
    .order('nombre_completo');

  if (error) {
    console.error('[obtenerUsuariosMOVI] Error:', error);
    throw error;
  }

  console.log('[obtenerUsuariosMOVI] Usuarios obtenidos:', data?.length || 0);
  return data;
}
```

## Verificación Post-Fix

Una vez aplicada la solución:

1. **Refrescar la página** (F5)
2. **Abrir consola** (F12)
3. **Verificar logs**:
   ```
   [obtenerUsuariosMOVI] Obteniendo usuarios...
   [obtenerUsuariosMOVI] Usuarios obtenidos: 5
   [MapeoVendedores] Usuarios cargados: 5
   ```
4. **Abrir modal "Nuevo Mapeo"**
5. **Verificar que el select muestra usuarios**:
   - Opción 1: --Sin asignar--
   - Opción 2: Juan Pérez (juan@ejemplo.com)
   - Opción 3: María García (maria@ejemplo.com)
   - etc.

## Recomendación de Política RLS Ideal

Para permitir que los usuarios vean otros usuarios pero con restricciones apropiadas:

```sql
-- Política SELECT: Todos los usuarios autenticados pueden ver usuarios activos
CREATE POLICY "Authenticated users view active users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (estado != 'eliminado');

-- Política UPDATE: Solo admins pueden modificar usuarios
CREATE POLICY "Only admins can update users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Política INSERT: Solo admins pueden crear usuarios
CREATE POLICY "Only admins can insert users"
  ON usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );
```

## Monitoreo Continuo

Para evitar este problema en el futuro:

1. **Agregar logging permanente** en funciones críticas
2. **Mostrar errores en UI** de manera clara
3. **Validar RLS** después de cada migración
4. **Tests automatizados** para queries críticas

## Contacto de Soporte

Si el problema persiste después de seguir esta guía:

1. Captura de pantalla de la consola (F12)
2. Query ejecutada manualmente en Supabase
3. Resultado de verificación de políticas RLS
4. Compartir para diagnóstico avanzado

---

**Implementado**: Diciembre 2024
**Estado**: Listo para deployment
**Build**: Exitoso
