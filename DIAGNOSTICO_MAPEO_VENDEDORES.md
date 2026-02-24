# Diagnóstico: Problema con Mapeo de Vendedores

## Problema Reportado
La página de "Mapeo de Vendedores" dentro de Integración SICAS se cierra y redirige al Dashboard.

## Correcciones Implementadas

### 1. Error Principal: Uso Incorrecto del Hook useAuth
**Problema**: La página usaba `user` del hook `useAuth()`, pero el AuthContext exporta `usuario`.
**Solución**: Cambiado todas las referencias de `user` a `usuario`.

```typescript
// ANTES (INCORRECTO)
const { user } = useAuth();
userId={user?.id || ''}

// DESPUÉS (CORRECTO)
const { usuario, loading: authLoading } = useAuth();
userId={usuario?.id || ''}
```

### 2. Falta de Guards de Carga
**Problema**: El componente intentaba cargar datos antes de que la autenticación terminara.
**Solución**: Agregados guards para esperar la autenticación.

```typescript
// Guard para carga de auth
if (authLoading) {
  return <LoadingSpinner />;
}

// Guard para usuario no disponible
if (!usuario) {
  return <ErrorMessage />;
}

// useEffect con condiciones
useEffect(() => {
  if (!authLoading && usuario) {
    cargarDatos();
  }
}, [filtroEstatus, authLoading, usuario]);
```

### 3. Rutas Habilitadas
Se descomentaron y habilitaron las rutas en `App.tsx`:
- `/comisiones/mapeo-vendedores` - Para el componente MapeoVendedores
- `/configuracion/mapeo-vendedores` - Para el componente MapeoVendedoresAdmin

### 4. Logging Extensivo Agregado
Se agregó logging detallado para diagnosticar el problema:

```typescript
console.log('[MapeoVendedores] 🚀 Componente renderizando');
console.log('[MapeoVendedores] Auth state:', { authLoading, usuarioId, rol });
console.log('[MapeoVendedores] cargarDatos iniciado');
console.log('[MapeoVendedores] Vendor mappings obtenidos:', count);
```

## Cómo Ver los Logs para Diagnóstico

1. Abre las DevTools del navegador:
   - Chrome/Edge: Presiona `F12` o `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Firefox: Presiona `F12` o `Ctrl+Shift+K`

2. Ve a la pestaña "Console"

3. Intenta acceder a la página de Mapeo de Vendedores

4. Busca los logs que empiezan con `[MapeoVendedores]` o `[ProtectedRoute]`

## Escenarios Posibles y Sus Logs

### Escenario 1: Usuario No Es Administrador
```
[ProtectedRoute] ❌ ACCESO DENEGADO - Admin requerido
[ProtectedRoute] Rol del usuario: Agente
[ProtectedRoute] Redirigiendo a /dashboard
```
**Solución**: Solo los usuarios con rol "Administrador" pueden acceder a esta página.

### Escenario 2: Error al Cargar Datos
```
[MapeoVendedores] ❌ ERROR al cargar datos: [mensaje de error]
[MapeoVendedores] Error completo: {...}
```
**Solución**: Revisa el mensaje de error específico. Podría ser un problema de permisos RLS.

### Escenario 3: Usuario No Cargado
```
[MapeoVendedores] Esperando condiciones: { authLoading: true, hasUsuario: false }
```
**Solución**: Normal durante la carga inicial. Si persiste, hay un problema con AuthContext.

### Escenario 4: Carga Exitosa
```
[MapeoVendedores] 🚀 Componente renderizando
[MapeoVendedores] Auth state: { authLoading: false, usuarioId: "xxx", rol: "Administrador" }
[MapeoVendedores] Condiciones cumplidas, llamando cargarDatos()
[MapeoVendedores] cargarDatos iniciado
[MapeoVendedores] Vendor mappings obtenidos: 5
[MapeoVendedores] Usuarios cargados: 23
[MapeoVendedores] Datos cargados correctamente
```

## Verificaciones Adicionales

### 1. Verificar Rol del Usuario
Ejecuta en la consola del navegador:
```javascript
// Ver el usuario actual
JSON.parse(localStorage.getItem('sb-[project-id]-auth-token'))
```

### 2. Verificar Permisos RLS
Si el error menciona "permission denied" o "policy", ejecuta en Supabase SQL:
```sql
-- Ver políticas RLS de vendor_mappings
SELECT * FROM pg_policies WHERE tablename = 'vendor_mappings';

-- Verificar rol del usuario
SELECT id, nombre_completo, rol FROM usuarios WHERE id = 'usuario-id-aqui';
```

### 3. Probar Query Directamente
En Supabase SQL Editor:
```sql
-- Probar query de vendor_mappings
SELECT
  vm.*,
  u.nombre_completo,
  u.email_laboral,
  u.email_personal
FROM vendor_mappings vm
LEFT JOIN usuarios u ON u.id = vm.movi_user_id
ORDER BY vm.created_at DESC;
```

## Próximos Pasos

1. **Ver los logs de la consola**: Esto te dirá exactamente dónde está fallando
2. **Verificar el rol del usuario**: Debe ser "Administrador"
3. **Si hay error de permisos**: Revisar las políticas RLS
4. **Si persiste el problema**: Compartir los logs completos de la consola

## Archivos Modificados

- `src/App.tsx` - Rutas habilitadas
- `src/pages/MapeoVendedores.tsx` - Correcciones principales y logging
- Build exitoso confirmado

## Notas Importantes

- El problema NO era de compilación (build exitoso)
- El problema era en runtime (ejecución)
- Los logs ahora revelarán el problema exacto
- La página requiere rol "Administrador"
