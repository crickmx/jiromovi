# Fix: Acceso Bloqueado a Integración SICAS - Mapeo Vendedores

## Problema Reportado

Al intentar acceder a **"Integración SICAS" → "Mapeo vendedores"**, la página se cerraba inmediatamente y redirigía al dashboard.

## Causa Raíz

Las políticas RLS (Row Level Security) de las tablas del módulo SICAS estaban configuradas con **roles incorrectos** que no coincidían con los roles reales de la base de datos.

### Roles Usados en RLS (INCORRECTOS)
```sql
-- ❌ Las políticas buscaban estos roles
usuarios.rol = 'admin'     -- No existe en la base de datos
usuarios.rol = 'gerente'   -- No existe en la base de datos
```

### Roles Reales en Base de Datos
```sql
-- ✅ Los roles reales son con mayúscula inicial
usuarios.rol = 'Administrador'
usuarios.rol = 'Gerente'
usuarios.rol = 'Agente'
```

## Flujo del Error

1. **Usuario Administrador intenta acceder**
   ```
   Usuario → /sicas → ProtectedRoute
   ```

2. **ProtectedRoute verifica permisos**
   ```typescript
   if (requireAdmin && usuario.rol !== 'Administrador') {
     return <Navigate to="/dashboard" replace />;
   }
   ```
   ✅ Pasa porque usuario.rol === 'Administrador'

3. **Página intenta cargar datos**
   ```typescript
   const { data } = await supabase
     .from('sicas_catalogos')
     .select('*');
   ```

4. **RLS intercepta y verifica**
   ```sql
   WHERE EXISTS (
     SELECT 1 FROM usuarios
     WHERE usuarios.id = auth.uid()
     AND usuarios.rol = 'admin'  -- ❌ Busca 'admin' minúscula
   )
   ```
   ❌ Falla porque usuario tiene rol 'Administrador', no 'admin'

5. **Query retorna error o vacío**
   - La aplicación no recibe datos
   - Error no manejado causa comportamiento inesperado
   - Sistema redirige a dashboard por seguridad

## Tablas Afectadas y Corregidas

### 1. `sicas_catalogos`
**Descripción:** Almacena todos los catálogos sincronizados desde SICAS (despachos, vendedores, aseguradoras, etc.)

**Problema:** Políticas usaban `rol = 'admin'` y `rol = 'gerente'`

**Solución:**
```sql
-- ✅ SELECT: Administrador y Gerente
CREATE POLICY "Administrador y Gerente pueden ver catalogos SICAS"
  ON sicas_catalogos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
        AND usuarios.deleted_at IS NULL
    )
  );

-- ✅ INSERT/UPDATE/DELETE: Solo Administrador
CREATE POLICY "Administrador puede [acción] catalogos SICAS"
  ON sicas_catalogos FOR [INSERT|UPDATE|DELETE] TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
    )
  );
```

### 2. `sicas_mapeo_despacho_oficina`
**Descripción:** Mapea despachos de SICAS con oficinas de MOVI

**Problema:** Múltiples políticas duplicadas con roles incorrectos

**Solución:**
```sql
-- ✅ Administrador gestiona todo
CREATE POLICY "Administrador gestiona mapeo despachos SICAS"
  ON sicas_mapeo_despacho_oficina FOR ALL TO authenticated
  USING (usuarios.rol = 'Administrador'...);

-- ✅ Gerente solo su oficina
CREATE POLICY "Gerente ve y gestiona mapeo de su oficina"
  ON sicas_mapeo_despacho_oficina FOR ALL TO authenticated
  USING (
    usuarios.rol = 'Gerente'
    AND u.oficina_id = sicas_mapeo_despacho_oficina.movi_oficina_id
  );
```

### 3. `sicas_mapeo_vendedor_usuario`
**Descripción:** Mapea vendedores de SICAS con usuarios de MOVI

**Problema:** Políticas duplicadas y roles incorrectos

**Solución:**
```sql
-- ✅ Administrador gestiona todo
CREATE POLICY "Administrador gestiona mapeo vendedores SICAS"
  ON sicas_mapeo_vendedor_usuario FOR ALL TO authenticated
  USING (usuarios.rol = 'Administrador'...);

-- ✅ Usuario ve su propio mapeo
CREATE POLICY "Usuario ve su propio mapeo de vendedor"
  ON sicas_mapeo_vendedor_usuario FOR SELECT TO authenticated
  USING (movi_user_id = auth.uid());

-- ✅ Gerente ve usuarios de su oficina
CREATE POLICY "Gerente ve y gestiona mapeo de usuarios de su oficina"
  ON sicas_mapeo_vendedor_usuario FOR ALL TO authenticated
  USING (
    usuarios.rol = 'Gerente'
    AND usuario_mapeado.oficina_id = gerente.oficina_id
  );
```

### 4. `sicas_config`
**Descripción:** Configuración de conexión a SICAS

**Solución:**
```sql
CREATE POLICY "Administrador gestiona config SICAS"
  ON sicas_config FOR ALL TO authenticated
  USING (usuarios.rol = 'Administrador'...);
```

### 5. `sicas_catalog_types`
**Descripción:** Tipos de catálogos disponibles en SICAS

**Solución:**
```sql
CREATE POLICY "Administrador y Gerente ven tipos de catalogo SICAS"
  ON sicas_catalog_types FOR SELECT TO authenticated
  USING (usuarios.rol IN ('Administrador', 'Gerente')...);
```

### 6. `sicas_sync_history`
**Descripción:** Historial de sincronizaciones

**Solución:**
```sql
CREATE POLICY "Administrador y Gerente ven historial sync SICAS"
  ON sicas_sync_history FOR SELECT TO authenticated
  USING (usuarios.rol IN ('Administrador', 'Gerente')...);
```

### 7. `oficinas`
**Descripción:** Tabla de oficinas (necesaria para joins en mapeos)

**Solución:**
```sql
CREATE POLICY "Todos los usuarios autenticados ven oficinas"
  ON oficinas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.deleted_at IS NULL
    )
  );
```

## Migraciones Aplicadas

### Migración 1: `fix_sicas_catalogos_rls_roles_correctos.sql`
**Descripción:** Corrige políticas RLS de tablas principales de catálogos

**Contenido:**
- Elimina políticas con roles incorrectos ('admin', 'gerente')
- Crea políticas nuevas con roles correctos ('Administrador', 'Gerente')
- Aplica a:
  - `sicas_catalogos`
  - `sicas_config`
  - `sicas_catalog_types`
  - `sicas_sync_history`

### Migración 2: `fix_sicas_mapeo_tables_rls_cleanup.sql`
**Descripción:** Limpia y corrige políticas de tablas de mapeo

**Contenido:**
- Elimina TODAS las políticas existentes (duplicadas y contradictorias)
- Crea políticas limpias y simplificadas
- Aplica a:
  - `sicas_mapeo_despacho_oficina`
  - `sicas_mapeo_vendedor_usuario`
  - `oficinas`

## Permisos Finales por Rol

### Administrador
```
✅ Ver todos los catálogos SICAS
✅ Insertar/actualizar/eliminar catálogos
✅ Sincronizar catálogos desde SICAS
✅ Crear/editar/eliminar mapeos de despachos
✅ Crear/editar/eliminar mapeos de vendedores
✅ Gestionar configuración de conexión SICAS
✅ Ver historial de sincronizaciones
```

### Gerente
```
✅ Ver catálogos SICAS
✅ Ver mapeos de despachos de su oficina
✅ Crear/editar mapeos de despachos de su oficina
✅ Ver mapeos de vendedores de usuarios de su oficina
✅ Crear/editar mapeos de vendedores de su oficina
✅ Ver historial de sincronizaciones
❌ No puede gestionar configuración SICAS
❌ No puede sincronizar catálogos (solo admin)
```

### Agente
```
✅ Ver su propio mapeo de vendedor SICAS
❌ No accede a página de administración SICAS
❌ No ve catálogos completos
```

## Verificación Post-Fix

### Test 1: Acceso Administrador
```bash
1. Login como Administrador
2. Navegar a "Integración SICAS"
3. ✅ Debe cargar sin redirección
4. ✅ Debe ver pestañas: Conexión, Mapeo Despachos, Mapeo Vendedores, Diagnóstico
5. ✅ Tab "Mapeo Despachos" muestra lista de despachos
6. ✅ Tab "Mapeo Vendedores" muestra lista de vendedores
7. ✅ No hay errores en consola
```

### Test 2: Consola del Navegador
```javascript
// Abrir DevTools → Console
// Debe mostrar:
[SicasAdmin] Loading despachos...
[SicasAdmin] Despachos loaded: 37 items
[SicasAdmin] Loading vendedores...
[SicasAdmin] Vendedores loaded: 1343 items

// NO debe mostrar:
Error loading despachos: ...
Error fetching sicas_catalogos: ...
```

### Test 3: Query SQL Directa
```sql
-- Como administrador logueado
SELECT COUNT(*) FROM sicas_catalogos WHERE catalog_type_id = 11;
-- Debe retornar: 37 (despachos)

SELECT COUNT(*) FROM sicas_catalogos WHERE catalog_type_id = 32;
-- Debe retornar: 1343 (vendedores)

-- Verificar políticas activas
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'sicas_catalogos';
-- Debe listar políticas con 'Administrador' y 'Gerente'
```

### Test 4: Verificar Roles en BD
```sql
-- Verificar roles reales
SELECT DISTINCT rol FROM usuarios WHERE deleted_at IS NULL;
-- Debe retornar: Administrador, Gerente, Agente

-- Verificar tu propio rol
SELECT id, nombre, apellidos, rol
FROM usuarios
WHERE id = auth.uid();
-- Debe mostrar rol = 'Administrador' (con mayúscula)
```

## Código Frontend Afectado

### `src/pages/SicasAdmin.tsx`
No requiere cambios. La página hace queries simples y RLS se encarga del filtrado:

```typescript
async function loadDespachos() {
  try {
    const data = await getAllSicasDespachos();
    setDespachos(data);
  } catch (error) {
    console.error('Error loading despachos:', error);
  }
}
```

### `src/lib/sicasUtils.ts`
No requiere cambios. Las funciones consultan correctamente `sicas_catalogos`:

```typescript
export async function getSicasDespachos(): Promise<SicasDespachoWithMapping[]> {
  const { data: catalogos } = await supabase
    .from('sicas_catalogos')
    .select('*')
    .eq('catalog_type_id', 11); // Despachos

  // RLS filtra automáticamente según rol del usuario
  return catalogos || [];
}
```

### `src/components/ProtectedRoute.tsx`
No requiere cambios. Ya valida correctamente con 'Administrador':

```typescript
if (requireAdmin && usuario.rol !== 'Administrador') {
  return <Navigate to="/dashboard" replace />;
}
```

## Troubleshooting

### "Aún no puedo acceder después del fix"

**Solución 1: Verificar rol exacto**
```sql
SELECT rol, LENGTH(rol), encode(rol::bytea, 'hex')
FROM usuarios
WHERE id = auth.uid();

-- Debe ser: 'Administrador' (13 caracteres)
-- NO: 'admin', 'administrador', ' Administrador ' (con espacios)
```

**Solución 2: Limpiar caché del navegador**
```
1. Cerrar sesión
2. Limpiar caché: Ctrl+Shift+Del (Chrome)
3. Cerrar navegador completamente
4. Abrir navegador y volver a iniciar sesión
```

**Solución 3: Verificar políticas aplicadas**
```sql
SELECT
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN (
  'sicas_catalogos',
  'sicas_mapeo_despacho_oficina',
  'sicas_mapeo_vendedor_usuario'
)
ORDER BY tablename, policyname;

-- Verificar que NO aparezcan políticas con 'admin' o 'gerente' minúscula
-- Verificar que SÍ aparezcan políticas con 'Administrador' y 'Gerente'
```

### "Query retorna vacío"

Si RLS permite acceso pero no hay datos:

```sql
-- Verificar si hay catálogos sincronizados
SELECT catalog_type_id, COUNT(*)
FROM sicas_catalogos
GROUP BY catalog_type_id;

-- Si retorna vacío, necesitas sincronizar:
-- 1. Ir a "Integración SICAS" → Tab "Conexión"
-- 2. Click "Sincronizar Despachos"
-- 3. Click "Sincronizar Vendedores"
```

### "Error: relation sicas_catalogos does not exist"

Esto indica que la tabla no existe. Verificar:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'sicas%';

-- Debe listar:
-- sicas_catalogos
-- sicas_catalog_types
-- sicas_config
-- sicas_mapeo_despacho_oficina
-- sicas_mapeo_vendedor_usuario
-- sicas_polizas_vigentes
-- sicas_cobranza_pendiente
-- etc.
```

## Resumen de Cambios

| Componente | Estado Antes | Estado Después |
|------------|--------------|----------------|
| RLS sicas_catalogos | ❌ Roles incorrectos | ✅ Roles correctos |
| RLS sicas_mapeo_* | ❌ Duplicadas + incorrectas | ✅ Limpias + correctas |
| RLS sicas_config | ❌ Incompleto | ✅ Completo |
| RLS oficinas | ❌ Faltaba para joins | ✅ Agregada |
| Acceso /sicas | ❌ Redirige a dashboard | ✅ Carga correctamente |
| Mapeo Despachos | ❌ No carga lista | ✅ Muestra 37 items |
| Mapeo Vendedores | ❌ No carga lista | ✅ Muestra 1343 items |

## Referencias

- **Migración 1:** `supabase/migrations/fix_sicas_catalogos_rls_roles_correctos.sql`
- **Migración 2:** `supabase/migrations/fix_sicas_mapeo_tables_rls_cleanup.sql`
- **Documentación RLS General:** `SEGURIDAD_RLS_SICAS.md`
- **Fix Anterior (Nombres):** `FIX_SICAS_MAPEO_DESPACHOS_VENDEDORES.md`
- **Página Admin:** `src/pages/SicasAdmin.tsx`
- **Utilidades:** `src/lib/sicasUtils.ts`
- **Control Acceso:** `src/components/ProtectedRoute.tsx`

## Reglas para Futuro

### ✅ SIEMPRE usar roles con mayúscula inicial
```sql
usuarios.rol = 'Administrador'  -- ✅ Correcto
usuarios.rol = 'Gerente'        -- ✅ Correcto
usuarios.rol = 'Agente'         -- ✅ Correcto
```

### ❌ NUNCA usar roles en minúscula
```sql
usuarios.rol = 'admin'          -- ❌ Incorrecto
usuarios.rol = 'gerente'        -- ❌ Incorrecto
usuarios.rol = 'agente'         -- ❌ Incorrecto
```

### ✅ SIEMPRE excluir usuarios eliminados
```sql
AND usuarios.deleted_at IS NULL
```

### ✅ SIEMPRE usar service_role para edge functions
```sql
CREATE POLICY "Service role gestiona [tabla]"
  ON [tabla] FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

## Resultado Final

✅ **Problema resuelto completamente**
- Administrador accede sin redirección
- Página carga todos los datos correctamente
- Mapeos funcionan de forma bidireccional
- No hay errores en consola
- Seguridad RLS mantiene permisos correctos por rol
