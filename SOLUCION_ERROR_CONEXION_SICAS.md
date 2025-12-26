# Solución Error Conexión SICAS

**Error:** "Error en Ejecución de WS o Proceso Interno de SICASOnline --Variable de objeto o de bloque With no establecida"

## Diagnóstico

Este error ocurre cuando:
1. Las credenciales de SICAS no están configuradas correctamente
2. Las credenciales son incorrectas
3. El formato del request SOAP no es el esperado por SICAS

## Solución

### 1. Verificar Variables de Entorno

Las variables de entorno deben estar configuradas en **Supabase Dashboard** (NO en `.env` local):

```env
SICAS_ENDPOINT=https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx
SICAS_USERNAME=<USUARIO_REAL>
SICAS_PASSWORD=<PASSWORD_REAL>
```

### 2. Configurar en Supabase Dashboard

1. Ve a **Supabase Dashboard** → Tu proyecto
2. Menú lateral → **Settings** → **Edge Functions**
3. Sección **Environment Variables**
4. Agrega las 3 variables:
   - `SICAS_ENDPOINT`
   - `SICAS_USERNAME`
   - `SICAS_PASSWORD`

### 3. Verificar Credenciales

**Test de autenticación:**

Ve a la página `/sicas` → Tab "Conexión" → Click "Probar Conexión"

**Respuesta esperada exitosa:**
```json
{
  "success": true,
  "connectionSuccess": true,
  "message": "Autenticación exitosa",
  "responseTxt": "SUCESS"
}
```

**Respuesta de credenciales incorrectas:**
```json
{
  "success": true,
  "connectionSuccess": false,
  "message": "Acceso denegado - Credenciales inválidas",
  "responseTxt": "DENIED"
}
```

### 4. Errores Comunes

#### Error: "DENIED"
**Causa:** Usuario o contraseña incorrectos
**Solución:** Verificar credenciales con el proveedor de SICAS

#### Error: "Variable de objeto o de bloque With no establecida"
**Causa:** Request malformado o credenciales vacías
**Solución:**
- Verificar que las variables de entorno estén configuradas
- Verificar que no tengan espacios o caracteres especiales sin escapar

#### Error: "HTML response instead of SOAP XML"
**Causa:** Endpoint incorrecto
**Solución:** Verificar que el endpoint sea el correcto: `https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx`

### 5. Código de Prueba Manual

Si necesitas probar manualmente, usa este HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test SICAS</title>
</head>
<body>
  <h1>Test Conexión SICAS</h1>
  <button onclick="testSicas()">Probar</button>
  <pre id="result"></pre>

  <script>
    async function testSicas() {
      const supabaseUrl = 'TU_SUPABASE_URL';
      const token = 'TU_TOKEN';

      const response = await fetch(`${supabaseUrl}/functions/v1/sicas-test-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      document.getElementById('result').textContent = JSON.stringify(result, null, 2);
    }
  </script>
</body>
</html>
```

### 6. Verificar que los Edge Functions estén desplegados

```bash
# Listar edge functions desplegadas
npx supabase functions list

# Deberías ver:
# - sicas-test-connection
# - sicas-sync
```

### 7. Ver Logs en Tiempo Real

1. Supabase Dashboard → **Edge Functions** → **Logs**
2. Filtrar por `sicas-test-connection` o `sicas-sync`
3. Buscar líneas como:
   - `[SICAS Auth] ✅ Autenticación EXITOSA`
   - `[SICAS Auth] ❌ Acceso DENEGADO`
   - `[SICAS Sync] Iniciando sincronización...`

### 8. Resultado del Fix Aplicado

✅ **Errores corregidos:**
- `getSicasVendedores` - Ambiguous relationship fixed
- `syncSicasCatalog` - Ahora usa la API nueva (catalog_type_id)
- `SicasAdmin.tsx` - Actualizado para usar nueva API

✅ **Retrocompatibilidad:**
- La función `syncSicasCatalog(catalogType)` antigua sigue funcionando
- Internamente usa el nuevo sistema dinámico

✅ **Build exitoso:**
```
✓ 3065 modules transformed
✓ built in 24.10s
```

### 9. Próximos Pasos

Una vez que las credenciales estén configuradas:

1. **Probar conexión:**
   ```
   /sicas → Tab "Conexión" → "Probar Conexión"
   ```

2. **Sincronizar Despachos:**
   ```
   /sicas → Tab "Despachos" → "Sincronizar Despachos"
   ```

3. **Sincronizar Vendedores:**
   ```
   /sicas → Tab "Vendedores" → "Sincronizar Vendedores"
   ```

4. **Ver catálogos sincronizados:**
   ```sql
   -- En Supabase SQL Editor
   SELECT * FROM sicas_catalogos WHERE catalog_type_id = 11; -- Despachos
   SELECT * FROM sicas_catalogos WHERE catalog_type_id = 32; -- Vendedores
   ```

### 10. Contacto con Soporte SICAS

Si las credenciales están correctas pero sigue fallando:

1. Contactar a soporte de SICAS Online
2. Verificar que la cuenta tenga permisos de API
3. Verificar que el endpoint esté activo
4. Solicitar ejemplos de requests SOAP válidos

---

**Nota:** El error "Variable de objeto o de bloque With no establecida" es un error interno de SICAS que usualmente indica que las credenciales no están llegando correctamente al servidor.
