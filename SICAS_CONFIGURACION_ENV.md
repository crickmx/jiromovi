# Configuración de Variables de Entorno SICAS

## Variables Requeridas

Las siguientes variables de entorno son necesarias para la integración con SICAS Online:

```bash
SICAS_USERNAME=j1r0%25$
SICAS_PASSWORD=$45oc14d05$
SICAS_ENDPOINT=https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx
```

## Configuración en Desarrollo Local

Las variables ya están configuradas en el archivo `.env` del proyecto.

## Configuración en Producción (Supabase)

Para configurar estas variables en el entorno de producción de Supabase:

### Opción 1: Panel de Supabase (Recomendado)

1. Ve al panel de Supabase: https://supabase.com/dashboard/project/qhwvuuyjhcennqccgvse
2. Navega a **Settings** → **Edge Functions** → **Environment Variables**
3. Agrega las siguientes variables:

   ```
   SICAS_USERNAME = j1r0%25$
   SICAS_PASSWORD = $45oc14d05$
   SICAS_ENDPOINT = https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx
   ```

4. Guarda los cambios

### Opción 2: CLI de Supabase (Avanzado)

Si tienes instalado el CLI de Supabase, puedes usar estos comandos:

```bash
# Configurar las variables de entorno
supabase secrets set SICAS_USERNAME="j1r0%25$"
supabase secrets set SICAS_PASSWORD='$45oc14d05$'
supabase secrets set SICAS_ENDPOINT="https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx"

# Verificar las variables configuradas
supabase secrets list
```

## Edge Functions que Utilizan Estas Credenciales

Las siguientes Edge Functions requieren las credenciales de SICAS:

1. **sicas-test-connection** - Prueba la conexión con SICAS
2. **sicas-sync** - Sincroniza catálogos desde SICAS
3. **sicas-test-catalog** - Prueba la descarga de catálogos específicos

## Notas de Seguridad

- Estas credenciales son sensibles y no deben compartirse públicamente
- Las variables de entorno en Supabase están cifradas
- Solo las Edge Functions tienen acceso a estas variables
- No se exponen al frontend de la aplicación

## Verificar la Configuración

Para verificar que las credenciales están correctamente configuradas:

1. Ve al módulo de administración SICAS en la aplicación
2. Haz clic en "Probar Conexión"
3. Deberías ver un mensaje de "Autenticación exitosa"

## Formato de las Credenciales

**Usuario:** `j1r0%25$`
- Nota: El `%25` es la codificación URL del símbolo `%`, representando `j1r0%$`

**Contraseña:** `$45oc14d05$`
- Los símbolos `$` son parte literal de la contraseña

**Endpoint:** `https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx`
- Este es el endpoint del webservice SOAP de SICAS Online
