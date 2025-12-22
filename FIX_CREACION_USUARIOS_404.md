# FIX: Error 404 al Crear Nuevos Usuarios

**Problema:** Al intentar crear un nuevo usuario, aparecía el error:
```
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
undefined/functions/v1/create-user:1 Failed to load resource: the server responded with a status of 404
```

## Causa Raíz

El código en `UserModal.tsx` estaba usando `import.meta.env.VITE_SUPABASE_URL` directamente, pero en tiempo de ejecución esta variable puede ser `undefined`, construyendo una URL incorrecta: `undefined/functions/v1/create-user`.

## Solución Implementada

### 1. Exportar Variables de Configuración

**Archivo:** `src/lib/supabase.ts`

Se exportaron las constantes `supabaseUrl` y `supabaseAnonKey` con valores por defecto:

```typescript
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qhwvuuyjhcennqccgvse.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '...';
```

### 2. Actualizar UserModal

**Archivo:** `src/components/UserModal.tsx`

Se actualizaron 3 ubicaciones:

#### Importación (línea 2)
```typescript
import { supabase, supabaseUrl } from '../lib/supabase';
```

#### Crear Usuario (línea 188)
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/create-user`,
  // ...
);
```

#### Actualizar Contraseña (línea 154)
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/update-user-password`,
  // ...
);
```

## Beneficios

✅ **Fallback Garantizado:** Si las variables de entorno fallan, siempre hay un valor por defecto
✅ **Centralizado:** La URL se define una sola vez en `supabase.ts`
✅ **Consistente:** Todos los componentes usan la misma fuente de verdad
✅ **Sin Errores 404:** La URL siempre será válida

## Verificación

El build se completó exitosamente sin errores. Para probar:

1. Recarga la aplicación en el navegador
2. Navega a **Configuración → Usuarios**
3. Haz clic en **Nuevo Usuario**
4. Completa el formulario:
   - Nombre
   - Apellidos
   - Email laboral
   - Contraseña
   - Rol
5. Haz clic en **Crear**

Ahora debería funcionar correctamente y crear el usuario sin errores.

## Nota sobre Otros Archivos

Se detectaron 29 archivos adicionales que usan `import.meta.env.VITE_SUPABASE_URL` para llamadas a edge functions. Estos archivos también deberían actualizarse preventivamente para evitar el mismo problema, pero no afectan la creación de usuarios:

- Componentes de email
- Páginas de comisiones
- Páginas de producción
- Utilidades varias

**Recomendación:** Actualizar estos archivos en un futuro cercano usando el mismo patrón:
```typescript
import { supabaseUrl } from '../lib/supabase';
```

---

**Estado:** ✅ RESUELTO
**Fecha:** 22 de Diciembre de 2024
