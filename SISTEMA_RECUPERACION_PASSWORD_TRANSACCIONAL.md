# Sistema de Recuperación de Contraseña con Notificaciones Transaccionales

## Descripción General

Se ha implementado un sistema completo de recuperación de contraseña que utiliza el módulo de **Notificaciones Transaccionales** en lugar del sistema de correos por defecto de Supabase Auth.

## Ventajas del Nuevo Sistema

1. **Control Total**: Diseño personalizado de correos con la identidad de MOVI Digital
2. **Historial Centralizado**: Todos los correos se registran en el historial de notificaciones
3. **Consistencia**: Los correos de recuperación mantienen el mismo estilo que otras notificaciones del sistema
4. **Trazabilidad**: Se puede auditar cada solicitud de recuperación de contraseña
5. **Flexibilidad**: Fácil modificación de plantillas sin cambiar código

## Componentes Implementados

### 1. Base de Datos - Tipo de Notificación

**Tabla**: `correo_tipos_notificacion`
- **Código**: `password_reset`
- **Nombre**: Recuperación de Contraseña
- **Estado**: Activo
- **Canales**: Solo correo (no WhatsApp)

### 2. Base de Datos - Plantilla de Correo

**Tabla**: `correo_plantillas`

**Variables disponibles**:
- `{{nombre}}`: Nombre completo del usuario
- `{{reset_link}}`: URL para restablecer la contraseña
- `{{nombre_plataforma}}`: MOVI Digital (automático)
- `{{fecha}}`: Fecha actual (automático)

**Diseño de la plantilla**:
- Header con gradiente púrpura
- Botón destacado para restablecer contraseña
- Advertencia de seguridad (expira en 1 hora)
- Footer profesional con branding
- Responsive y compatible con todos los clientes de correo

### 3. Edge Function - reset-password-request

**Ubicación**: `supabase/functions/reset-password-request/index.ts`

**Funcionalidad**:
1. Recibe el email del usuario
2. Busca el usuario en la base de datos
3. Genera el token de recuperación usando Supabase Auth Admin API
4. Envía el correo usando el sistema de notificaciones transaccionales
5. Registra el envío en el historial

**Endpoint**: `POST /functions/v1/reset-password-request`

**Request Body**:
```json
{
  "email": "usuario@jiro.mx"
}
```

**Response Success**:
```json
{
  "success": true,
  "message": "Se ha enviado un correo con instrucciones para recuperar tu contraseña"
}
```

**Response Error**:
```json
{
  "success": false,
  "error": "Error al procesar solicitud de recuperación",
  "details": "Mensaje de error detallado"
}
```

### 4. Frontend - Componente Login

**Archivo**: `src/pages/Login.tsx`

**Cambios realizados**:
- Reemplazado `supabase.auth.resetPasswordForEmail()` por llamada a edge function
- Mantiene la misma UX para el usuario
- Mejor manejo de errores
- Mensajes consistentes

**Flujo de usuario**:
1. Usuario hace clic en "¿Olvidaste tu contraseña?"
2. Ingresa su email laboral
3. El sistema llama a `reset-password-request`
4. Recibe correo con diseño personalizado
5. Hace clic en el botón del correo
6. Es redirigido a la página de cambio de contraseña

## Configuración Requerida

### Variables de Entorno (Ya configuradas)

```env
VITE_SUPABASE_URL=tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### Configuración en Base de Datos

1. **Configuración de Correo** (`correo_configuracion`)
   - Debe existir una configuración activa
   - Con Resend API key válida
   - Remitente verificado

2. **Tipo de Notificación** (`correo_tipos_notificacion`)
   - Código: `password_reset`
   - Activo: `true`
   - Enviar por correo: `true`

3. **Plantilla** (`correo_plantillas`)
   - Asociada al tipo `password_reset`
   - Con todas las variables configuradas

## Personalización

### Modificar el Diseño del Correo

1. Acceder a la tabla `correo_plantillas`
2. Buscar la plantilla con `tipo_notificacion_id` correspondiente a `password_reset`
3. Editar el campo `html_cuerpo`
4. Las variables `{{nombre}}` y `{{reset_link}}` deben mantenerse

### Cambiar el Tiempo de Expiración

Por defecto, Supabase genera tokens que expiran en 1 hora. Para cambiar esto:
1. Acceder al Dashboard de Supabase
2. Authentication > Email Templates
3. Configurar "Time before link expires"

### Agregar Variables Adicionales

1. Editar la edge function `reset-password-request`
2. Agregar las variables en el objeto `datos`
3. Actualizar el array `variables_disponibles` en la plantilla
4. Usar las variables en el HTML con sintaxis `{{nombre_variable}}`

## Monitoreo y Logs

### Historial de Envíos

Todos los correos se registran en `correo_historial_envios`:
- **Estado**: 'enviado' o 'fallido'
- **Destinatario**: Email del usuario
- **Fecha**: Timestamp del envío
- **Error**: Mensaje de error si falló

### Logs de Edge Function

Ver logs en tiempo real:
```bash
supabase functions logs reset-password-request
```

## Solución de Problemas

### El correo no llega

1. Verificar que existe configuración activa en `correo_configuracion`
2. Verificar que el tipo de notificación está activo
3. Revisar logs de la edge function
4. Verificar historial de envíos para ver estado

### Error al enviar

1. Verificar que Resend API key es válida
2. Verificar que el dominio del remitente está verificado en Resend
3. Revisar límites de envío en Resend

### Usuario no recibe el link

1. Verificar que el email existe en la tabla `usuarios`
2. Verificar que el email está en `auth.users`
3. Revisar carpeta de spam del usuario

## Pruebas

### Probar el Sistema

1. Ir a la página de login
2. Hacer clic en "¿Olvidaste tu contraseña?"
3. Ingresar un email válido
4. Verificar que llega el correo
5. Hacer clic en el botón del correo
6. Verificar redirección correcta

### Verificar en Base de Datos

```sql
-- Ver historial reciente
SELECT * FROM correo_historial_envios
WHERE tipo_notificacion_codigo = 'password_reset'
ORDER BY created_at DESC
LIMIT 10;

-- Ver configuración activa
SELECT * FROM correo_tipos_notificacion
WHERE codigo = 'password_reset';
```

## Seguridad

### Protecciones Implementadas

1. **No revelar existencia de usuarios**: Siempre retorna éxito aunque el email no exista
2. **Token temporal**: El link expira en 1 hora
3. **Un solo uso**: El token solo puede usarse una vez
4. **Validación de email**: Solo emails válidos son procesados
5. **Rate limiting**: Implementado por Supabase Edge Functions

### Mejores Prácticas

- Nunca exponer si un email existe o no
- Registrar intentos de recuperación para detectar abusos
- Monitorear patrones de uso inusuales
- Mantener actualizada la configuración de Resend

## Mantenimiento

### Tareas Regulares

1. **Revisar historial de envíos** (semanal)
   - Identificar patrones de fallo
   - Verificar tasas de entrega

2. **Actualizar plantillas** (según necesidad)
   - Mejorar diseño
   - Actualizar textos

3. **Monitorear logs** (diario)
   - Detectar errores tempranos
   - Optimizar rendimiento

### Backups

La configuración y plantillas están en la base de datos y se incluyen automáticamente en los backups de Supabase.

## Migración Aplicada

**Archivo**: `20251211190000_add_password_reset_notification_fixed.sql`

Esta migración:
- Crea el tipo de notificación `password_reset`
- Crea la plantilla de correo con diseño profesional
- Configura las variables disponibles
- Es idempotente (puede ejecutarse múltiples veces sin error)

## Referencias

- [Documentación de Supabase Auth](https://supabase.com/docs/guides/auth)
- [Documentación de Resend](https://resend.com/docs)
- [Guía de Notificaciones Transaccionales](./GUIA_NOTIFICACIONES_TRANSACCIONALES_COMISIONES.md)
