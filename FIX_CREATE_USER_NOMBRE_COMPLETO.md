# Fix: Error 400 al Crear Usuarios

**Fecha:** 23 de diciembre de 2025
**Tipo:** Bugfix crítico
**Módulo:** Gestión de usuarios

## Problema

Al intentar crear usuarios desde el frontend, se recibía un error 400 del Edge Function `create-user`:

```
qhwvuuyjhcennqccgvse.supabase.co/functions/v1/create-user:1
Failed to load resource: the server responded with a status of 400 ()
```

## Causa Raíz

La columna `nombre_completo` en la tabla `usuarios` es una **columna generada automáticamente** por PostgreSQL:

```sql
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS nombre_completo text
GENERATED ALWAYS AS (nombre || ' ' || apellidos) STORED;
```

El Edge Function `create-user` intentaba insertar manualmente el valor de `nombre_completo`:

```typescript
const nombre_completo = `${userData.nombre} ${userData.apellidos}`.trim();

const insertData = {
  // ...
  nombre_completo: nombre_completo, // ❌ Error: no se puede insertar en columna generada
  // ...
};
```

PostgreSQL rechaza cualquier intento de insertar o actualizar columnas generadas, resultando en un error 400.

## Solución

Se eliminó la línea que insertaba `nombre_completo` del `insertData`:

**Antes:**
```typescript
const nombre_completo = `${userData.nombre} ${userData.apellidos}`.trim();

const insertData = {
  id: authData.user.id,
  nombre: userData.nombre,
  apellidos: userData.apellidos,
  nombre_completo: nombre_completo, // ❌
  // ...
};
```

**Después:**
```typescript
const insertData = {
  id: authData.user.id,
  nombre: userData.nombre,
  apellidos: userData.apellidos,
  // nombre_completo se genera automáticamente ✅
  // ...
};
```

## Archivos Modificados

- `supabase/functions/create-user/index.ts` (líneas 162-182)

## Cambios en el Edge Function

### Antes
```typescript
const nombre_completo = `${userData.nombre} ${userData.apellidos}`.trim();

const insertData = {
  id: authData.user.id,
  nombre: userData.nombre,
  apellidos: userData.apellidos,
  nombre_completo: nombre_completo,
  rol: userData.rol,
  email_laboral: userData.email_laboral,
  puesto: userData.puesto || '',
  oficina_id: userData.oficina_id || null,
  fecha_nacimiento: userData.fecha_nacimiento || null,
  fecha_ingreso: userData.fecha_ingreso || null,
  celular_personal: userData.celular_personal || '',
  email_personal: userData.email_personal || '',
  celular_laboral: userData.celular_laboral || '',
  extension_telefonica: userData.extension_telefonica || '',
  web_slug: userData.web_slug && userData.web_slug.trim() !== '' ? userData.web_slug.trim() : null,
  regimen_fiscal_id: userData.regimen_fiscal_id || null,
  banco: userData.banco || '',
  clabe: userData.clabe || '',
  dias_vacaciones_disponibles: userData.dias_vacaciones_disponibles || 0,
  estado: isGerente ? 'pendiente' : 'activo',
};
```

### Después
```typescript
const insertData = {
  id: authData.user.id,
  nombre: userData.nombre,
  apellidos: userData.apellidos,
  rol: userData.rol,
  email_laboral: userData.email_laboral,
  puesto: userData.puesto || '',
  oficina_id: userData.oficina_id || null,
  fecha_nacimiento: userData.fecha_nacimiento || null,
  fecha_ingreso: userData.fecha_ingreso || null,
  celular_personal: userData.celular_personal || '',
  email_personal: userData.email_personal || '',
  celular_laboral: userData.celular_laboral || '',
  extension_telefonica: userData.extension_telefonica || '',
  web_slug: userData.web_slug && userData.web_slug.trim() !== '' ? userData.web_slug.trim() : null,
  regimen_fiscal_id: userData.regimen_fiscal_id || null,
  banco: userData.banco || '',
  clabe: userData.clabe || '',
  dias_vacaciones_disponibles: userData.dias_vacaciones_disponibles || 0,
  estado: isGerente ? 'pendiente' : 'activo',
};
```

## Deployment

La función corregida fue desplegada a Supabase:

```bash
✅ Edge Function deployed successfully
Function: create-user
Slug: create-user
```

## Verificación

Después del fix, la creación de usuarios funciona correctamente:

1. El frontend llama a `create-user` con los datos del usuario
2. El Edge Function crea el usuario en `auth.users`
3. Se inserta el registro en `usuarios` SIN incluir `nombre_completo`
4. PostgreSQL genera automáticamente `nombre_completo` = `nombre || ' ' || apellidos`
5. Se envían notificaciones de bienvenida (email + WhatsApp)
6. Se devuelve éxito al frontend

## Prevención

Para evitar este tipo de errores en el futuro:

1. **Documentar columnas generadas:** Todas las columnas `GENERATED ALWAYS AS` deben estar claramente documentadas en las migraciones
2. **Revisar Edge Functions:** Al crear o modificar Edge Functions que insertan datos, verificar que no incluyan columnas generadas
3. **Pruebas automatizadas:** Implementar tests que validen la creación de usuarios

## Columnas Generadas en la Base de Datos

Actualmente, la tabla `usuarios` tiene la siguiente columna generada:

```sql
nombre_completo text GENERATED ALWAYS AS (nombre || ' ' || apellidos) STORED
```

**Regla importante:** NUNCA incluir esta columna en INSERTs o UPDATEs.

## Impacto

- ✅ Creación de usuarios restaurada
- ✅ No hay cambios en el frontend
- ✅ No hay cambios en la base de datos
- ✅ Funcionamiento normal de notificaciones

## Notas Técnicas

### ¿Por qué usar columnas generadas?

Las columnas generadas ofrecen varios beneficios:

1. **Consistencia:** El valor siempre es correcto
2. **Performance:** Se calcula una vez y se almacena (STORED)
3. **Índices:** Se pueden crear índices sobre columnas generadas
4. **Simplicidad:** No requiere triggers ni lógica de aplicación

### ¿Cuándo NO usar columnas generadas?

- Cuando el cálculo es muy complejo o lento
- Cuando depende de datos de otras tablas
- Cuando necesitas control manual sobre el valor

## Lecciones Aprendidas

1. Al agregar columnas generadas a tablas existentes, revisar todos los Edge Functions que insertan en esa tabla
2. Las columnas generadas son excelentes para valores derivados simples
3. PostgreSQL es estricto con las columnas generadas (no permite INSERT/UPDATE manual)

## Estado

✅ **Resuelto y desplegado**

La creación de usuarios funciona correctamente en producción.
