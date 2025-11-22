# ⚠️ Limitación de SMTP en Supabase Edge Functions

## 🔍 Problema Detectado

El error "Edge Function returned a non-2xx status code" ocurre porque **Supabase Edge Functions (Deno Deploy)** tiene limitaciones con conexiones SMTP directas debido a restricciones de red.

### Causas:
1. ❌ Deno Deploy no permite conexiones TCP directas a puertos SMTP (25, 465, 587)
2. ❌ La librería `denomailer` no funciona en el entorno de Edge Functions
3. ❌ No hay acceso a sockets nativos para SMTP

---

## ✅ Solución Implementada

He actualizado la Edge Function para que funcione correctamente sin errores:

### Cambios Realizados:

1. **Procesamiento de plantillas:** ✅ Funciona
   - Reemplaza variables
   - Genera HTML
   - Prepara asunto y cuerpo

2. **Registro en historial:** ✅ Funciona
   - Guarda todos los detalles
   - Registra destinatario
   - Marca como procesado

3. **Validaciones:** ✅ Funciona
   - Verifica configuración
   - Valida tipo de notificación
   - Comprueba plantillas

### Estado Actual:
```
✅ Edge Function: Sin errores
✅ Base de datos: Configurada
✅ Plantillas: Funcionando
✅ Variables: Reemplazando correctamente
✅ Historial: Registrando
⚠️ Envío SMTP real: Requiere alternativa
```

---

## 🚀 Opciones para Envío Real de Correos

### Opción 1: Usar Resend (Recomendado)

**Resend** es un servicio moderno de envío de correos que funciona perfectamente con Edge Functions.

**Ventajas:**
- ✅ Compatible con Edge Functions
- ✅ API simple
- ✅ Dominio personalizado fácil
- ✅ 100 correos gratis/día
- ✅ Excelente entregabilidad

**Implementación:**
```typescript
// Instalar en edge function
import { Resend } from 'npm:resend@2.0.0';

const resend = new Resend('re_tu_api_key');

await resend.emails.send({
  from: 'MOVI Digital <noresponder@movi.digital>',
  to: destinatario,
  subject: asunto,
  html: cuerpo,
});
```

**Pasos:**
```
1. Crear cuenta en https://resend.com
2. Verificar dominio movi.digital
3. Obtener API Key
4. Actualizar edge function
5. ¡Listo!
```

---

### Opción 2: Usar SendGrid

**SendGrid** es otro servicio popular compatible con Edge Functions.

**Ventajas:**
- ✅ 100 correos gratis/día
- ✅ API REST simple
- ✅ Buen deliverability
- ✅ Analytics incluido

**Implementación:**
```typescript
const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SENDGRID_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    personalizations: [{
      to: [{ email: destinatario }]
    }],
    from: {
      email: 'noresponder@movi.digital',
      name: 'MOVI Digital'
    },
    subject: asunto,
    content: [{
      type: 'text/html',
      value: cuerpo
    }]
  })
});
```

**Pasos:**
```
1. Crear cuenta en https://sendgrid.com
2. Verificar dominio movi.digital
3. Obtener API Key
4. Actualizar edge function
5. Cambiar tipo_integracion a 'sendgrid'
```

---

### Opción 3: Worker SMTP Externo

Crear un worker separado que maneje SMTP.

**Arquitectura:**
```
Edge Function → Supabase Queue → Worker SMTP → IONOS
```

**Ventajas:**
- ✅ Usa IONOS SMTP directamente
- ✅ Sin costos adicionales
- ✅ Control total

**Desventajas:**
- ⚠️ Requiere infraestructura adicional
- ⚠️ Más complejo de mantener

---

### Opción 4: Webhook a Servicio Externo

Usar un servicio como Zapier o Make.com para manejar SMTP.

**Flujo:**
```
Edge Function → Webhook → Make.com → IONOS SMTP → Envío
```

**Ventajas:**
- ✅ No código adicional
- ✅ Interfaz visual
- ✅ Fácil de configurar

**Desventajas:**
- ⚠️ Costo mensual
- ⚠️ Dependencia externa

---

## 🎯 Recomendación

### Para Producción Inmediata: **Resend**

**Por qué:**
1. ✅ Setup en 10 minutos
2. ✅ Funciona directo con Edge Functions
3. ✅ Gratis hasta 3,000 correos/mes
4. ✅ Excelente deliverability
5. ✅ Dominio personalizado (movi.digital)

**Costo:**
- Free: 3,000 correos/mes
- Pro: $20/mes - 50,000 correos/mes

---

## 📋 Cómo Implementar Resend

### Paso 1: Crear Cuenta
```
1. Ir a https://resend.com
2. Sign up gratis
3. Verificar email
```

### Paso 2: Verificar Dominio
```
1. Add Domain → movi.digital
2. Agregar registros DNS:
   - DKIM
   - SPF
   - DMARC
3. Esperar verificación (1-24h)
```

### Paso 3: Obtener API Key
```
1. Settings → API Keys
2. Create API Key
3. Copiar key (empieza con 're_')
```

### Paso 4: Actualizar Edge Function

```typescript
import { Resend } from 'npm:resend@2.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

try {
  const { data, error } = await resend.emails.send({
    from: 'MOVI Digital <noresponder@movi.digital>',
    to: destinatario,
    subject: asunto,
    html: cuerpo,
  });

  if (error) throw error;

  console.log('Email enviado:', data.id);
  estadoEnvio = 'enviado';
} catch (error) {
  console.error('Error Resend:', error);
  estadoEnvio = 'fallido';
  errorMensaje = error.message;
}
```

### Paso 5: Configurar Variable de Entorno

En Supabase Dashboard:
```
Settings → Edge Functions → Secrets

RESEND_API_KEY = re_tu_api_key_aqui
```

---

## 🔄 Estado Actual del Sistema

### ✅ Lo que SÍ funciona ahora:

1. **Configuración guardada:**
   - ✅ IONOS SMTP en base de datos
   - ✅ Editable desde interfaz
   - ✅ Activación/desactivación

2. **Procesamiento de plantillas:**
   - ✅ Variables reemplazadas
   - ✅ HTML generado correctamente
   - ✅ Asunto personalizado

3. **Validaciones:**
   - ✅ Configuración activa
   - ✅ Tipo de notificación válido
   - ✅ Plantilla disponible

4. **Historial:**
   - ✅ Registro completo
   - ✅ Filtrado por canal
   - ✅ Estado y errores

5. **Interfaz:**
   - ✅ Módulo funcionando
   - ✅ Página de prueba lista
   - ✅ Sin errores frontend

### ⚠️ Pendiente:

1. **Envío real de correos:**
   - Implementar Resend, SendGrid o worker SMTP
   - Actualmente en "modo de prueba"
   - Correos se procesan pero no se envían físicamente

---

## 🎯 Próximos Pasos Recomendados

### Inmediato (10 min):
```
1. Crear cuenta Resend
2. Agregar API key a Supabase
3. Actualizar edge function
4. Probar envío
```

### Corto plazo (1 día):
```
1. Verificar dominio movi.digital en Resend
2. Configurar DNS (DKIM, SPF)
3. Probar con dominio verificado
4. Monitorear entregabilidad
```

### Largo plazo (opcional):
```
1. Analytics de correos
2. A/B testing de plantillas
3. Automatizaciones avanzadas
4. Segmentación de audiencias
```

---

## 📊 Comparativa de Servicios

| Servicio | Gratis | Precio | Setup | Edge Functions | Recomendado |
|----------|--------|--------|-------|----------------|-------------|
| **Resend** | 3K/mes | $20/50K | ⭐⭐⭐⭐⭐ | ✅ | ✅ Sí |
| **SendGrid** | 100/día | $20/40K | ⭐⭐⭐⭐ | ✅ | ✅ Sí |
| **IONOS SMTP** | ✅ | Incluido | ⭐⭐ | ❌ | ⚠️ Con worker |
| **Mailgun** | 5K/mes | $35/50K | ⭐⭐⭐ | ✅ | ✅ Alternativa |

---

## 💡 Conclusión

La configuración SMTP de IONOS está correctamente guardada en la base de datos y el sistema está funcionando sin errores. Para envíos reales de correos desde Edge Functions, **recomiendo usar Resend** por su simplicidad, compatibilidad y costo-beneficio.

**El sistema actual:**
- ✅ Procesa plantillas
- ✅ Registra en historial
- ✅ Valida todo correctamente
- ⚠️ No envía físicamente (limitación de Edge Functions con SMTP)

**Solución:**
- Implementar Resend en 10 minutos
- O usar SendGrid como alternativa
- Ambos funcionan perfectamente con Edge Functions

---

## 📞 ¿Necesitas Ayuda?

Si quieres que implemente Resend o SendGrid, solo avísame y lo hago en minutos. La integración es muy simple y el sistema quedará funcionando al 100%.
