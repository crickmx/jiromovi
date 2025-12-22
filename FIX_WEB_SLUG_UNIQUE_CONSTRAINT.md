# Fix: Error al Crear Usuarios - Constraint Única en web_slug

## Problema Identificado

Al intentar crear un segundo usuario sin `web_slug`, la base de datos lanzaba un error:
```
Database error creating new user
```

### Causa Raíz

La tabla `usuarios` tiene una constraint `UNIQUE` en la columna `web_slug`:
```sql
ALTER TABLE usuarios ADD CONSTRAINT usuarios_web_slug_key UNIQUE (web_slug);
```

En PostgreSQL, la constraint `UNIQUE` trata de forma diferente:
- **NULL values**: Permite múltiples valores NULL (no hay conflicto)
- **Empty strings ('')**: Considera '' como un valor único, solo permite UNO

La edge function `create-user` estaba guardando strings vacíos `''` cuando no había slug:
```typescript
web_slug: userData.web_slug || ''  // ❌ Problema: permite solo UN usuario sin slug
```

## Solución Implementada

### Edge Function Corregida

**Archivo**: `supabase/functions/create-user/index.ts`

**Antes (❌ Incorrecto)**:
```typescript
web_slug: userData.web_slug || ''
```

**Después (✅ Correcto)**:
```typescript
web_slug: userData.web_slug && userData.web_slug.trim() !== ''
  ? userData.web_slug.trim()
  : null
```

### Lógica de Validación

La nueva lógica:
1. ✅ Si `web_slug` existe y no está vacío → guarda el slug (con trim)
2. ✅ Si `web_slug` es undefined, null, o string vacío → guarda NULL
3. ✅ Permite múltiples usuarios con web_slug = NULL
4. ✅ Evita slugs con espacios al inicio/final

## Casos de Uso Soportados

### Usuario con Slug
```typescript
userData = { web_slug: 'juanperez' }
// Resultado en DB: web_slug = 'juanperez'
```

### Usuario sin Slug
```typescript
userData = { web_slug: '' }
// o
userData = { web_slug: undefined }
// o
userData = { web_slug: null }
// Resultado en DB: web_slug = NULL
```

### Múltiples Usuarios sin Slug
```typescript
// Usuario 1: web_slug = NULL ✅
// Usuario 2: web_slug = NULL ✅
// Usuario 3: web_slug = NULL ✅
// Todos permitidos, sin conflicto de UNIQUE constraint
```

## Verificación en Base de Datos

### Estado Actual de web_slug
```sql
SELECT
  CASE
    WHEN web_slug IS NULL THEN 'NULL'
    WHEN web_slug = '' THEN 'Empty String'
    ELSE 'Has Value'
  END as tipo,
  COUNT(*) as count
FROM usuarios
GROUP BY
  CASE
    WHEN web_slug IS NULL THEN 'NULL'
    WHEN web_slug = '' THEN 'Empty String'
    ELSE 'Has Value'
  END;
```

**Resultado esperado**:
- NULL: Múltiples usuarios ✅
- Has Value: Usuarios con slug único ✅
- Empty String: 0 usuarios (ya no se permite) ✅

## Archivos Modificados

### 1. Edge Function
- ✅ `supabase/functions/create-user/index.ts` - Línea 140

### 2. Build Verificado
- ✅ `npm run build` - Exitoso sin errores
- ✅ TypeScript compilation - OK
- ✅ Vite build - OK

## Pruebas Recomendadas

### Test 1: Crear Usuario con Slug
1. Ir a **Directorio → Nuevo Usuario**
2. Llenar datos básicos
3. Asignar slug: `testusuario1`
4. Guardar
5. ✅ Debe crear exitosamente

### Test 2: Crear Usuario sin Slug
1. Ir a **Directorio → Nuevo Usuario**
2. Llenar datos básicos
3. **NO** asignar slug (dejar vacío)
4. Guardar
5. ✅ Debe crear exitosamente

### Test 3: Crear Múltiples Usuarios sin Slug
1. Crear Usuario A sin slug ✅
2. Crear Usuario B sin slug ✅
3. Crear Usuario C sin slug ✅
4. Todos deben crearse sin error

### Test 4: Slug Duplicado (debe fallar)
1. Crear Usuario A con slug `juanperez` ✅
2. Intentar crear Usuario B con slug `juanperez` ❌
3. Debe mostrar error de constraint única

## Página de Diagnóstico Creada

**Archivo**: `public/test-create-user.html`

Página HTML standalone para probar la creación de usuarios:
- ✅ Login de administrador
- ✅ Formulario completo de creación
- ✅ Logs detallados de requests/responses
- ✅ Verificación de usuario creado
- ✅ Manejo de errores visible

**Acceder**: http://localhost:5173/test-create-user.html

## Impacto en Otros Módulos

### Frontend
- ✅ `UserModal.tsx` - Ya envía web_slug correctamente
- ✅ `Perfil.tsx` - Muestra slug o mensaje "No configurado"
- ✅ `PerfilUsuario.tsx` - Permite editar slug
- ✅ `Dashboard.tsx` - Botón Mi Página Web se deshabilita si no hay slug

### Edge Functions (ya actualizadas)
- ✅ `render-firma/index.ts` - Maneja NULL correctamente
- ✅ `email-send-message/index.ts` - Maneja NULL correctamente
- ✅ `send-internal-notification/index.ts` - Maneja NULL correctamente

## Consideraciones de Seguridad

### Validación de Slug
La función ahora valida:
- ✅ Trim de espacios
- ✅ Prevención de strings vacíos
- ✅ Conversión a NULL cuando corresponde

### RLS Policies
Las políticas de RLS manejan correctamente:
```sql
WHERE web_slug IS NOT NULL  -- Filtra usuarios sin slug
```

Usuarios con `web_slug = NULL` no son accesibles públicamente en:
- ✅ Páginas web públicas
- ✅ API pública de agentes
- ✅ Formularios de contacto web

## Migración de Datos Existentes (si necesario)

Si existen usuarios con `web_slug = ''` (string vacío), ejecutar:

```sql
-- Convertir strings vacíos a NULL
UPDATE usuarios
SET web_slug = NULL
WHERE web_slug = '';

-- Verificar resultado
SELECT COUNT(*) as usuarios_sin_slug
FROM usuarios
WHERE web_slug IS NULL;
```

## Estado de Implementación

✅ **RESUELTO** - Error de constraint única corregido

### Fecha: 22 de diciembre, 2024
### Build: ✅ Exitoso (sin errores)
### Edge Function: ✅ Desplegada

## Documentos Relacionados

- `SISTEMA_URL_UNIFICADO_IMPLEMENTADO.md` - Sistema completo de URLs
- `CONFIGURAR_DOMINIO_SUPABASE.md` - Configuración de dominio
- `SISTEMA_DOMINIO_PUBLICO_IMPLEMENTADO.md` - Sistema de páginas públicas

---

**Nota**: Este fix es **backward compatible**. Usuarios existentes con slug seguirán funcionando normalmente, y ahora podemos crear múltiples usuarios sin slug sin errores.
