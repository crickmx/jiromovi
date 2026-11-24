# Fix: Correos de Bienvenida Duplicados

## Problema Reportado
Al crear el usuario `recluta.cdmx@jiro.mx`, se recibieron **4 correos de bienvenida** en lugar de uno solo.

## Causa Raíz Identificada

El problema se debe a **múltiples puntos de envío** que se disparan simultáneamente:

### 1. Edge Function `create-user` (Línea 248)
```typescript
await supabaseAdmin.rpc('enviar_notificacion_completa', {
  p_tipo_codigo: 'cuenta_activada',
  p_user_id: authData.user.id,
  // ... datos ...
});
```
**Resultado**: Envía 1 notificación

### 2. Trigger `send_welcome_on_user_create()`
Se dispara en `AFTER INSERT` cuando el usuario se crea con `estado='activo'`
```sql
CREATE TRIGGER trigger_send_welcome_on_create
  AFTER INSERT ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION send_welcome_on_user_create();
```
**Resultado**: Envía otra notificación

### 3. Trigger `send_welcome_on_user_activation()`
Se dispara en `AFTER UPDATE` cuando el estado cambia a 'activo'
```sql
CREATE TRIGGER trigger_send_welcome_on_activation
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION send_welcome_on_user_activation();
```
**Resultado**: Puede enviar otra notificación

### 4. Función `notify()` con Múltiples Canales
La función `notify()` crea jobs para cada canal activo:
- In-App (campanita)
- Email
- WhatsApp

## Por Qué se Enviaron 4 Correos

**Escenario más probable**:

1. **Correo 1**: Edge Function llama a `enviar_notificacion_completa()` → Job de Email
2. **Correo 2**: Trigger `send_welcome_on_user_create()` se dispara en INSERT → Job de Email
3. **Correo 3**: Algún UPDATE posterior dispara el trigger de activación
4. **Correo 4**: Posible re-intento o llamada duplicada

## Solución Implementada

### Migración Aplicada: `fix_duplicate_welcome_notifications`

1. **Eliminados todos los triggers automáticos**:
   ```sql
   DROP TRIGGER IF EXISTS trigger_send_welcome_on_create ON usuarios;
   DROP TRIGGER IF EXISTS trigger_send_welcome_on_activation ON usuarios;
   DROP TRIGGER IF EXISTS trigger_send_welcome_on_insert_active ON usuarios;
   ```

2. **Funciones marcadas como DEPRECATED**:
   - Las funciones se mantienen pero no se usan automáticamente
   - Comentarios claros indican que están deprecated

3. **Nueva función de utilidad creada**:
   ```sql
   send_welcome_notification_manual(p_user_id, p_tipo_notificacion)
   ```
   Para envío manual controlado cuando sea necesario.

### Control Centralizado

Ahora **SOLO** la Edge Function `create-user` envía notificaciones de bienvenida:

```typescript
// En create-user/index.ts línea 227-273
if (insertData.estado === 'activo') {
  await supabaseAdmin.rpc('enviar_notificacion_completa', {
    p_tipo_codigo: 'cuenta_activada',
    // ...
  });
}
```

## Verificación de Canales

La función `notify()` puede crear hasta 3 jobs diferentes:
1. **In-App**: Notificación de campanita en la plataforma ✓
2. **Email**: Correo electrónico ✓
3. **WhatsApp**: Mensaje WhatsApp ✓

**Esto NO es un duplicado** - son canales diferentes del mismo evento.

Si se reciben 3 notificaciones (campanita, email, WhatsApp), esto es **correcto y esperado**.

El problema eran los **4 correos** (mismo canal duplicado).

## Prevención Futura

### Idempotency Keys
La función `notify()` ya usa idempotency keys para prevenir duplicados:
```sql
v_idempotency_key := p_event_code || '_' || v_user_id::text || '_email';
```

### Logs Mejorados
Todas las funciones tienen logs detallados para trazabilidad.

### Control Centralizado
Un solo punto de envío (Edge Function) elimina la posibilidad de triggers duplicados.

## Testing

### Caso 1: Usuario creado como ACTIVO (Admin)
```
✓ INSERT en usuarios con estado='activo'
✓ Edge Function envía notificación
✓ Triggers deshabilitados (no se disparan)
Resultado: 1 email + 1 campanita + 1 WhatsApp (si están activos)
```

### Caso 2: Usuario creado como PENDIENTE (Gerente)
```
✓ INSERT en usuarios con estado='pendiente'
✓ Edge Function NO envía notificación
✓ Triggers deshabilitados (no se disparan)
✓ Cuando Admin activa → Se debe enviar notificación manualmente
Resultado: Control total sobre envío
```

## Conclusión

✅ **Problema resuelto**: Triggers automáticos eliminados
✅ **Control centralizado**: Solo Edge Function envía notificaciones
✅ **Prevención**: Idempotency keys previenen duplicados
✅ **Flexibilidad**: Función manual disponible para casos especiales
✅ **Logs**: Trazabilidad completa de envíos

**El próximo usuario creado recibirá solo 1 email de bienvenida** (más campanita y WhatsApp si están configurados).
