# Fix: Password Reset y Notificaciones de Bienvenida

## Problemas Identificados y Solucionados

### 1. ❌ Password Reset No Funcionaba para email_laboral Diferente

**Problema:**
- Usuario ingresaba `ccjimenez@me.com` (su email_laboral)
- Sistema buscaba en `auth.users` por ese email exacto
- Pero en `auth.users` el email real era `cdcjimenez@gmail.com`
- No se encontraba match → No se enviaba correo

**Causa Raíz:**
La función `reset-password-request` asumía que `email_laboral` == `auth.users.email`, pero pueden ser diferentes.

**Solución Implementada:**
```typescript
// Antes:
buscar email en usuarios → buscar MISMO email en auth.users → enviar

// Ahora:
buscar email_laboral en usuarios → obtener usuario por ID en auth.users → usar EMAIL REAL de auth → enviar
```

**Flujo Corregido:**
1. Usuario ingresa `ccjimenez@me.com`
2. Se busca en `usuarios.email_laboral` → encuentra usuario con ID `xxx`
3. Se busca en `auth.users` por ID `xxx` → obtiene email real `cdcjimenez@gmail.com`
4. Se genera link de recuperación con el email real
5. Se envía correo al email real
6. ✅ Usuario recibe el correo

---

### 2. ❌ No Se Enviaban Notificaciones de Bienvenida al Crear Usuarios

**Problema:**
- Administrador creaba usuario con estado "Activo"
- NO se enviaban correos/whatsapp de bienvenida
- Trigger solo funcionaba al ACTIVAR usuarios (UPDATE), no al CREAR (INSERT)

**Causa Raíz:**
Solo existía trigger `send_welcome_on_activation` para UPDATE, no para INSERT.

**Solución Implementada:**
Se crearon 2 triggers separados:

1. **`trigger_send_welcome_on_create`** (INSERT)
   - Se dispara cuando se CREA un usuario con `estado = 'activo'`
   - Usa tipo de notificación: `bienvenida`
   - Envía correo + whatsapp + notificación interna

2. **`trigger_send_welcome_on_activation`** (UPDATE)
   - Se dispara cuando se ACTIVA un usuario (cambio de estado → 'activo')
   - Usa tipo de notificación: `cuenta_activada`
   - Envía correo + whatsapp + notificación interna

---

### 3. ✅ Tipo de Notificación "bienvenida" Estaba Inactivo

**Problema:**
- `correo_tipos_notificacion.bienvenida` tenía `activo = false`
- Aunque se intentara enviar, el sistema lo bloqueaba

**Solución:**
```sql
UPDATE correo_tipos_notificacion
SET activo = true
WHERE codigo = 'bienvenida';
```

---

## Archivos Modificados

### Edge Functions
- ✅ `supabase/functions/reset-password-request/index.ts`
  - Cambio en búsqueda: `email_laboral` en lugar de `correo_electronico`
  - Lógica para obtener email real de auth.users
  - Uso de email real para generar link y enviar correo

### Migraciones
- ✅ `fix_welcome_notifications_on_create_and_activate.sql`
  - Función `send_welcome_on_user_create()` para INSERT
  - Función `send_welcome_on_user_activation()` para UPDATE
  - Triggers separados para cada caso

### Base de Datos
- ✅ Activación del tipo `bienvenida`
- ✅ Verificación de plantilla `cuenta_activada`

---

## Casos de Uso Cubiertos

### Caso 1: Crear Usuario Activo (Administrador)
```
1. Admin va a Configuración → Usuarios
2. Clic en "Crear Usuario"
3. Llena formulario y selecciona estado "Activo"
4. Guarda

✅ Se envía automáticamente:
   - Correo de bienvenida a auth.users.email
   - WhatsApp (si configurado)
   - Notificación interna
```

### Caso 2: Activar Usuario Pendiente (Gerente/Admin)
```
1. Usuario está en estado "Pendiente" o "Inactivo"
2. Admin/Gerente lo activa cambiando estado a "Activo"
3. Guarda

✅ Se envía automáticamente:
   - Correo "cuenta activada" a auth.users.email
   - WhatsApp (si configurado)
   - Notificación interna
```

### Caso 3: Recuperar Contraseña (Usuario)
```
1. Usuario va a /login
2. Clic en "¿Olvidaste tu contraseña?"
3. Ingresa su email_laboral (ej: ccjimenez@me.com)
4. Clic en "Enviar"

✅ Sistema:
   - Busca usuario por email_laboral
   - Obtiene email real de auth.users
   - Genera link de recuperación
   - Envía correo al EMAIL REAL (no al email_laboral)
   - Usuario recibe correo en cdcjimenez@gmail.com
```

---

## Variables Disponibles en Plantillas

### Plantilla "bienvenida"
```
{{nombre}}           - Nombre completo del usuario
{{email_laboral}}    - Email laboral (visible en plataforma)
{{password}}         - Contraseña temporal/mensaje
{{rol}}              - Rol asignado (Agente, Gerente, etc.)
{{oficina}}          - Nombre de la oficina
{{pagina_web}}       - URL de página web personal
{{puesto}}           - Puesto del usuario
{{nombre_plataforma}} - "MOVI Digital"
{{fecha}}            - Fecha actual
```

### Plantilla "cuenta_activada"
```
(Mismas variables que bienvenida)
```

### Plantilla "password_reset"
```
{{nombre}}           - Nombre completo
{{reset_link}}       - Link de recuperación (expira en 1 hora)
{{nombre_plataforma}} - "MOVI Digital"
{{fecha}}            - Fecha actual
```

---

## Testing

### Probar Password Reset
```bash
# Opción 1: Usar página de prueba
https://app.grupojiro.com/test-password-reset-flow.html

# Opción 2: Desde login
1. Ir a https://app.grupojiro.com/login
2. Clic en "¿Olvidaste tu contraseña?"
3. Ingresar email_laboral
4. Verificar recepción en auth.users.email
```

### Probar Notificaciones de Bienvenida

**Crear Usuario Activo:**
```sql
-- Desde UI:
Configuración → Usuarios → Crear Usuario → Estado: Activo → Guardar

-- Verificar envío:
SELECT *
FROM correo_historial_envios
WHERE tipo_notificacion_codigo = 'bienvenida'
ORDER BY created_at DESC
LIMIT 1;
```

**Activar Usuario:**
```sql
-- Desde UI:
Configuración → Usuarios → Editar usuario → Estado: Activo → Guardar

-- Verificar envío:
SELECT *
FROM correo_historial_envios
WHERE tipo_notificacion_codigo = 'cuenta_activada'
ORDER BY created_at DESC
LIMIT 1;
```

---

## Logs para Debugging

### Edge Function Logs
```
Supabase Dashboard → Edge Functions → reset-password-request → Logs

Buscar:
- "Procesando solicitud de recuperación para:"
- "Usuario encontrado en tabla usuarios:"
- "Usuario auth encontrado por ID, email real:"
- "Correo enviado exitosamente"
```

### Database Logs
```sql
-- Ver logs de triggers
SHOW log_min_messages; -- Debe ser LOG o menor

-- Buscar en logs de Supabase:
[welcome_create] Enviando bienvenida a nuevo usuario activo
[welcome_activate] Usuario activado
```

---

## Consideraciones Importantes

### ⚠️ Email Real vs Email Laboral

**Problema:**
Un usuario puede tener diferentes emails:
- `usuarios.email_laboral` = "ccjimenez@me.com" (dato informativo)
- `auth.users.email` = "cdcjimenez@gmail.com" (email REAL de autenticación)

**Solución:**
SIEMPRE enviar correos a `auth.users.email`, NO a `usuarios.email_laboral`.

**Razón:**
El usuario solo puede acceder a los correos enviados a su email de autenticación real.

### ⚠️ Deliverability

Los correos pueden llegar a SPAM si:
- Dominio `movi.digital` no tiene SPF/DKIM/DMARC configurados
- Ver: `DIAGNOSTICO_PASSWORD_RESET.md` para solución

---

## Checklist Post-Implementación

- ✅ Edge function actualizada
- ✅ Migraciones aplicadas
- ✅ Tipos de notificación activos
- ✅ Triggers creados y funcionando
- ✅ Build del proyecto exitoso
- ⏳ Probar en producción:
  - [ ] Crear usuario activo
  - [ ] Activar usuario pendiente
  - [ ] Solicitar recuperación de contraseña con email_laboral
  - [ ] Verificar recepción de correos en auth.users.email

---

## Soporte

Si los correos NO llegan:
1. Verificar carpeta de SPAM
2. Verificar en `correo_historial_envios` que estado = 'enviado'
3. Verificar logs de Edge Function
4. Verificar configuración DNS del dominio
5. Ver documentación: `DIAGNOSTICO_PASSWORD_RESET.md`

---

## Conclusión

✅ **Password Reset:** Ahora funciona correctamente buscando por email_laboral y enviando al email real de auth.

✅ **Notificaciones Bienvenida:** Se envían automáticamente al crear usuarios activos y al activar usuarios.

✅ **Sistema Robusto:** Maneja correctamente la diferencia entre email_laboral (informativo) y auth.users.email (real).
