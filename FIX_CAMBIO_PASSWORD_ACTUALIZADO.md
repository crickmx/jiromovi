# Fix: Cambio de Contraseña Actualizado

## Problema Reportado
El cambio de contraseña del usuario `ccjimenez@me.com` a `123456` desde el modal "Editar Usuario" no se guardaba correctamente.

## Solución Implementada

### 1. Edge Function Mejorada
Se actualizó `/supabase/functions/update-user-password/index.ts` con:
- **Logging detallado** para debug
- **Mejor manejo de errores** con stack trace
- **Respuestas más informativas** incluyendo userId y email confirmado

### 2. Cambios Realizados
```typescript
// Ahora retorna más información:
{
  success: true,
  userId: "uuid-del-usuario",
  email: "email@usuario.com",
  updated: true
}

// Logging agregado:
console.log('[update-user-password] Iniciando actualización...');
console.log('[update-user-password] Request:', { userId, hasPassword });
console.log('[update-user-password] Contraseña actualizada exitosamente');
```

### 3. Herramientas de Diagnóstico

#### 📋 Archivo: `public/diagnostico-cambio-password.html`
Herramienta completa para diagnosticar el problema:

**Paso 1:** Login como Admin
- Verifica sesión activa
- Confirma rol de Administrador

**Paso 2:** Buscar Usuario
- Busca por email: `ccjimenez@me.com`
- Obtiene ID del usuario
- Muestra datos completos

**Paso 3:** Cambiar Contraseña
- Llama a edge function con logging
- Muestra respuesta del servidor
- Captura errores detallados

**Paso 4:** Verificar Cambio
- Prueba login con nueva contraseña
- Confirma que el cambio funcionó

## Cómo Usar el Diagnóstico

1. **Abre:** `public/diagnostico-cambio-password.html`

2. **Login como Admin:**
   - Email: admin@jiro.mx
   - Contraseña: tu contraseña de admin

3. **Buscar Usuario:**
   - Click en "Buscar Usuario en BD"
   - Se encontrará automáticamente `ccjimenez@me.com`

4. **Cambiar Contraseña:**
   - Ingresa nueva contraseña (default: 123456)
   - Click en "Cambiar Contraseña"
   - Verifica respuesta del servidor

5. **Probar Login:**
   - Click en "Probar Login con Nueva Contraseña"
   - Debe mostrar LOGIN EXITOSO

## Verificación del Flujo

### En UserModal.tsx (líneas 197-220)
```typescript
// Solo cambia contraseña si se ingresó valor
if (formData.password) {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/update-user-password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        userId: user.id,
        password: formData.password,
      }),
    }
  );

  // Maneja errores
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Error al actualizar la contraseña');
  }
}
```

### En Edge Function
```typescript
// Usa service_role_key (permisos admin)
const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
  userId,
  { password: password }
);
```

## Posibles Causas del Problema Original

1. **Edge function no desplegada correctamente**
   - ✅ Ahora redesplegada con logging

2. **Error silencioso en la llamada**
   - ✅ Ahora con mejor manejo de errores

3. **Sesión expirada o inválida**
   - ✅ El diagnóstico verifica la sesión

4. **userId incorrecto**
   - ✅ El diagnóstico muestra el userId exacto

## Para Verificar en Logs de Supabase

Ir a: Dashboard Supabase → Edge Functions → update-user-password → Logs

Buscar:
```
[update-user-password] Iniciando actualización de contraseña
[update-user-password] Request: { userId: "...", hasPassword: true }
[update-user-password] Llamando a auth.admin.updateUserById...
[update-user-password] Contraseña actualizada exitosamente
```

## Prueba Rápida

1. En la app principal:
   - Login como admin
   - Configuración → Usuarios
   - Editar usuario ccjimenez@me.com
   - Tab "General" → cambiar contraseña
   - Guardar

2. Cerrar sesión

3. Login con:
   - Email: ccjimenez@me.com
   - Password: (la nueva que pusiste)

4. Si funciona → ✅ Fix correcto
5. Si no funciona → Usar `diagnostico-cambio-password.html` para debug

## Estado Actual

✅ Edge function desplegada con logging mejorado
✅ Herramienta de diagnóstico creada
✅ Build completado sin errores
✅ Listo para probar

## Siguiente Paso

**Prueba el cambio de contraseña** en la aplicación principal o usa el diagnóstico para identificar dónde falla exactamente.
