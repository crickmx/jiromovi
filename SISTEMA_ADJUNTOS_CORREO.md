# Sistema de Adjuntos en Correos Electrónicos

## Resumen

El sistema de notificaciones por correo ahora soporta adjuntar archivos automáticamente. Los archivos pueden venir de Supabase Storage o proporcionarse directamente en base64.

## Cambios Realizados

### 1. URLs Corregidas
- ✅ Todas las URLs cambiadas de `moviapp.com` a `app.movi.digital`
- ✅ Plantillas de correo actualizadas
- ✅ Catálogo de eventos de notificación actualizado
- ✅ Funciones de triggers actualizadas

### 2. Soporte para Adjuntos
- ✅ Columna `attachments` agregada a `notification_jobs`
- ✅ Edge functions actualizadas para procesar adjuntos
- ✅ Soporte para múltiples fuentes de archivos

## Cómo Usar Adjuntos

### Formato de Adjuntos

Los adjuntos se especifican como un array JSON con la siguiente estructura:

```json
[
  {
    "filename": "documento.pdf",
    "content_type": "application/pdf",
    "url": "https://qhwvuuyjhcennqccgvse.supabase.co/storage/v1/object/public/documentos/archivo.pdf"
  },
  {
    "filename": "imagen.png",
    "storage_path": "imagenes/foto.png"
  },
  {
    "filename": "texto.txt",
    "content": "SGVsbG8gV29ybGQh"
  }
]
```

### Opciones de Fuente de Archivos

1. **URL completa** (`url`): URL pública de Supabase Storage
2. **Storage path** (`storage_path`): Ruta relativa en el storage (ej: `bucket/carpeta/archivo.pdf`)
3. **Content directo** (`content`): Contenido del archivo en base64

### Ejemplo 1: Enviar correo con adjuntos desde SQL

```sql
-- Usando la función helper
SELECT send_email_with_attachments(
  'usuario@ejemplo.com',
  'Documentos de tu trámite',
  '<h1>Hola</h1><p>Te enviamos los documentos solicitados.</p>',
  '[
    {
      "filename": "poliza.pdf",
      "storage_path": "polizas/poliza_12345.pdf"
    },
    {
      "filename": "recibo.pdf",
      "url": "https://qhwvuuyjhcennqccgvse.supabase.co/storage/v1/object/public/recibos/recibo_001.pdf"
    }
  ]'::jsonb
);
```

### Ejemplo 2: Crear notification job con adjuntos

```sql
INSERT INTO notification_jobs (
  user_id,
  event_code,
  channel,
  payload,
  attachments,
  status
) VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  'tramite_completado',
  'email',
  jsonb_build_object(
    'tramite_folio', 'TRM-2024-001',
    'tramite_tipo', 'Emisión'
  ),
  '[
    {
      "filename": "poliza_emitida.pdf",
      "storage_path": "polizas/2024/poliza_001.pdf"
    }
  ]'::jsonb,
  'pending'
);
```

### Ejemplo 3: Desde Edge Function o Trigger

```sql
CREATE OR REPLACE FUNCTION notify_tramite_con_documentos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_attachments jsonb;
BEGIN
  -- Obtener documentos del trámite desde ticket_archivos
  SELECT jsonb_agg(
    jsonb_build_object(
      'filename', nombre_archivo,
      'storage_path', ruta_archivo
    )
  ) INTO v_attachments
  FROM ticket_archivos
  WHERE ticket_id = NEW.id;

  -- Enviar notificación con adjuntos
  PERFORM send_transactional_notification(
    p_user_id := NEW.usuario_id,
    p_event_code := 'tramite_completado',
    p_channels := ARRAY['email']::text[],
    p_payload := jsonb_build_object(
      'tramite_folio', NEW.folio,
      'tramite_tipo', NEW.tipo,
      'url', 'https://app.movi.digital/tramites/' || NEW.id
    ),
    p_attachments := v_attachments
  );

  RETURN NEW;
END;
$$;
```

### Ejemplo 4: Envío directo desde JavaScript

```javascript
// Desde el frontend o una edge function
const response = await fetch(`${supabaseUrl}/functions/v1/send-direct-email`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: 'usuario@ejemplo.com',
    subject: 'Documentos adjuntos',
    html: '<p>Aquí están los documentos solicitados.</p>',
    attachments: [
      {
        filename: 'documento.pdf',
        url: 'https://qhwvuuyjhcennqccgvse.supabase.co/storage/v1/object/public/documentos/doc.pdf'
      }
    ]
  })
});
```

## Límites y Consideraciones

1. **Tamaño de archivos**: Resend tiene un límite de 40MB por correo (suma de todos los adjuntos)
2. **Formatos soportados**: Cualquier tipo de archivo (PDF, imágenes, Excel, Word, etc.)
3. **Cantidad**: Recomendado máximo 10 adjuntos por correo
4. **Seguridad**: Los archivos de storage privado requieren permisos RLS apropiados

## Edge Functions Actualizadas

- ✅ `send-direct-email`: Envío directo con adjuntos
- ✅ `enviar-correo-transaccional`: Correos transaccionales con adjuntos
- ✅ `notification-dispatcher`: Procesador automático de notification_jobs

## Verificación

Para verificar que un correo se envió con adjuntos:

```sql
-- Ver logs de provider
SELECT
  provider,
  success,
  request_payload->'attachments' as adjuntos_enviados,
  created_at
FROM notification_provider_logs
WHERE provider = 'resend'
ORDER BY created_at DESC
LIMIT 10;
```

## Solución de Problemas

### Los adjuntos no se envían
- Verificar que la URL o storage_path sea correcta
- Verificar permisos RLS en el bucket de storage
- Revisar logs de la edge function en Supabase Dashboard

### Error "Failed to download"
- El archivo no existe en la ruta especificada
- El bucket no es público y no hay permisos
- La URL está mal formada

### Correo enviado sin adjuntos
- El array de attachments está vacío
- Todos los adjuntos fallaron al descargar
- Revisar `notification_provider_logs` para ver detalles
