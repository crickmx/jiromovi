# Fix: Cambio de Contraseña Actualizado

## Problema Reportado
El cambio de contraseña del usuario `ccjimenez@me.com` a `123456` desde el modal "Editar Usuario" no se guardaba correctamente.

## ⚠️ Problemas Detectados

### Issue 1: URL Incorrecta (Resuelto)
El diagnóstico inicial falló con "Failed to fetch" porque tenía una **URL de Supabase incorrecta**:
- ❌ URL antigua: `jqcstvcvvrdbchplfdva.supabase.co`
- ✅ URL correcta: `qhwvuuyjhcennqccgvse.supabase.co`

### Issue 2: Discrepancia de Emails (CAUSA RAÍZ)
El usuario tiene **dos emails diferentes**:
- 📋 Email en tabla `usuarios`: `ccjimenez@me.com`
- 🔐 Email en `auth.users`: `cdcjimenez@gmail.com`

**✅ Contraseña actualizada correctamente a `123456`**
**⚠️ Para login debe usar:** `cdcjimenez@gmail.com` (el de auth.users)

#### Validación en BD:
```sql
SELECT u.email_laboral, au.email as auth_email
FROM usuarios u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.id = 'e721d4ed-4ba4-499a-a08c-3b881ff380ea';
```

**Resultado:**
| email_laboral | auth_email |
|--------------|------------|
| ccjimenez@me.com | cdcjimenez@gmail.com |

**Conclusión:** La contraseña funciona correctamente, solo hay que usar el email correcto.

## Solución Implementada

### 1. Edge Function Mejorada
Se actualizó `/supabase/functions/update-user-password/index.ts` con:
- **Logging detallado** para debug
- **Mejor manejo de errores** con stack trace
- **Respuestas más informativas** incluyendo userId y email confirmado

### 2. Herramienta de Diagnóstico Mejorada
El archivo `public/diagnostico-cambio-password.html` ahora:
- ✅ Usa la URL correcta de Supabase
- ✅ Muestra logs detallados en consola del navegador
- ✅ Manejo de errores mejorado con causas posibles
- ✅ Validación de campos vacíos
- ✅ Mensajes de progreso en cada paso

### 3. Cambios Realizados
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

## Nueva Herramienta: Test Login Directo

### 📋 Archivo: `public/test-login-ccjimenez.html`
Herramienta específica para probar el login de este usuario:

**Características:**
- ✅ Muestra claramente la discrepancia de emails
- ✅ Botón para login con email correcto (cdcjimenez@gmail.com)
- ✅ Botón para login con email incorrecto (para demostrar el problema)
- ✅ Información sobre sincronización de emails

**Cómo usar:**
1. Abre `public/test-login-ccjimenez.html`
2. Click en "Probar Login con cdcjimenez@gmail.com"
3. Verás login exitoso con toda la información del usuario

## Estado Actual

✅ Edge function desplegada con logging mejorado
✅ Herramienta de diagnóstico creada
✅ Nueva herramienta de test login directo
✅ Build completado sin errores
✅ **Contraseña actualizada correctamente a `123456`**
✅ **Login funciona con email `cdcjimenez@gmail.com`**

## Solución Final

**Para hacer login como AGENTE DEMO:**
```
Email: cdcjimenez@gmail.com
Password: 123456
```

**NO usar:** `ccjimenez@me.com` (ese email no existe en auth.users)

## Opciones de Corrección

### Opción A: Cambiar comportamiento del login
Modificar el login para buscar el usuario por `email_laboral` en la tabla `usuarios` y luego usar el `auth.email` correspondiente.

### Opción B: Sincronizar emails
Actualizar el email en `auth.users` para que coincida con `usuarios.email_laboral`.

### Opción C: Dejar como está
Documentar que el email de login es `cdcjimenez@gmail.com`.
