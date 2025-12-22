# PDFs de Comisiones con Logo de Oficina

## Cambio Implementado

Los PDFs de comisiones ahora muestran el **logotipo de oficina** del usuario en el encabezado, en lugar del logotipo personal ("Mi Logotipo").

## Jerarquía de Logos Actualizada

### Para PDFs de Comisiones
**Nueva jerarquía:**
1. Logo de Oficina del usuario
2. Logo JIRO (si la oficina no tiene logo)

**Antes (ya no se usa para PDFs de comisiones):**
1. Mi Logotipo Personal
2. Logo de Oficina
3. Logo JIRO

### Para Otros Contextos
En otros lugares de la aplicación se sigue usando la jerarquía completa:
- Mi Logotipo → Logo Oficina → Logo JIRO

## Archivos Modificados

### 1. src/lib/logoUtils.ts
**Nueva función agregada:**
```typescript
export async function getOfficeLogo(userId: string): Promise<string>
```

**Descripción:**
- Obtiene solo el logo de oficina del usuario
- Ignora el logotipo personal
- Si la oficina no tiene logo, devuelve `/logojiro.png`
- Si el usuario no tiene oficina, devuelve `/logojiro.png`

**Flujo:**
1. Consulta el `oficina_id` del usuario
2. Consulta el `logo_url` de la oficina
3. Retorna el URL del logo o el logo de JIRO

### 2. src/lib/pdfUtils.ts

**Import actualizado:**
```typescript
// Antes:
import { getEffectiveUserLogo } from './logoUtils';

// Ahora:
import { getOfficeLogo } from './logoUtils';
```

**Funciones modificadas:**

#### a) generateCommissionPDF (línea ~285)
```typescript
// Antes:
const logoUrl = await getEffectiveUserLogo(agent.id);

// Ahora:
const logoUrl = await getOfficeLogo(agent.id);
```

**Comentarios actualizados:**
- Antes: "Cargar el logo del usuario con dimensiones correctas"
- Ahora: "Cargar el logo de oficina del usuario con dimensiones correctas"

#### b) generateOrdenDePagoPDF (línea ~527)
```typescript
// Antes:
const logoUrl = await getEffectiveUserLogo(agent.id);

// Ahora:
const logoUrl = await getOfficeLogo(agent.id);
```

**Comentarios actualizados:**
- Antes: "Cargar el logo del usuario con dimensiones correctas"
- Ahora: "Cargar el logo de oficina del usuario con dimensiones correctas"

## PDFs Afectados

Los siguientes PDFs ahora usan el logo de oficina:

### 1. Comprobante de Comisiones
- Generado desde: **Comisiones → Ver lote → Descargar Comprobante**
- Generado desde: **Mis Comisiones → Descargar Comprobante**
- Ubicación del logo: Esquina superior izquierda
- Dimensiones máximas: 40mm ancho x 20mm alto

### 2. Orden de Pago
- Generado desde: **Comisiones → Ver lote → Descargar Orden de Pago**
- Generado desde: **Mis Comisiones → Descargar Orden de Pago**
- Ubicación del logo: Esquina superior izquierda
- Dimensiones máximas: 35mm ancho x 18mm alto

## Beneficios

### 1. Consistencia Corporativa
- Los documentos de comisiones muestran la identidad de la oficina
- Representa la estructura organizacional de la empresa

### 2. Claridad de Pertenencia
- Los documentos reflejan claramente la oficina a la que pertenece el agente
- Útil para reportes y auditorías

### 3. Separación de Contextos
- **"Mi Logotipo"** se reserva para materiales personales del agente
- **"Logo de Oficina"** se usa para documentos institucionales y administrativos

## Rutas Afectadas en la Aplicación

### Comisiones (Administradores)
**Ruta:** `/comisiones`

**Acciones:**
1. Click en cualquier lote de comisiones
2. Ver lista de agentes
3. Click en "Descargar Comprobante" o "Descargar Orden de Pago"
4. El PDF incluirá el logo de oficina del agente

### Mis Comisiones (Agentes)
**Ruta:** `/mis-comisiones`

**Acciones:**
1. Usuario agente ve sus propias comisiones
2. Click en "Descargar Comprobante" o "Descargar Orden de Pago"
3. El PDF incluirá el logo de su oficina

## Configuración de Logos de Oficina

### Para Administradores

**Configurar logo de oficina:**
1. Ir a `/oficinas`
2. Click en "Editar" en la oficina deseada
3. Subir logo de oficina (PNG/JPG, máx 5MB)
4. Guardar cambios

**Resultado:**
- Todos los PDFs de comisiones de agentes de esa oficina mostrarán el logo de oficina
- Los agentes sin oficina asignada usarán el logo de JIRO

## Testing Recomendado

### Test 1: Usuario con Oficina y Logo de Oficina
1. Crear/seleccionar usuario con oficina asignada
2. Verificar que la oficina tenga logo configurado
3. Generar PDF de comisiones (Comprobante u Orden de Pago)
4. Verificar que aparezca el logo de oficina en el encabezado

### Test 2: Usuario con Oficina sin Logo
1. Crear/seleccionar usuario con oficina asignada
2. Verificar que la oficina NO tenga logo
3. Generar PDF de comisiones
4. Verificar que aparezca el logo de JIRO

### Test 3: Usuario sin Oficina
1. Crear/seleccionar usuario sin oficina asignada
2. Generar PDF de comisiones
3. Verificar que aparezca el logo de JIRO

### Test 4: Usuario con Mi Logotipo Personal
1. Usuario con "Mi Logotipo" personal configurado
2. Usuario con oficina que tiene logo
3. Generar PDF de comisiones
4. Verificar que aparezca el **logo de oficina** (NO el logo personal)

### Test 5: Ambos PDFs
1. Generar "Comprobante de Comisiones"
2. Generar "Orden de Pago"
3. Verificar que ambos PDFs muestren el logo de oficina
4. Verificar dimensiones correctas en cada PDF

## Dimensiones del Logo

### Comprobante de Comisiones
- Máximo: **40mm ancho x 20mm alto**
- Mantiene proporción original del logo
- Centrado verticalmente en el espacio disponible

### Orden de Pago
- Máximo: **35mm ancho x 18mm alto**
- Mantiene proporción original del logo
- Centrado verticalmente en el espacio disponible

## Estado del Build

✅ **Compilación exitosa**
- Sin errores de TypeScript
- Sin errores de importación
- Funciones de generación de PDF actualizadas correctamente

## Notas Importantes

### 1. Retrocompatibilidad
- Los PDFs generados anteriormente no se modifican
- Solo afecta a PDFs generados después de este cambio

### 2. Manejo de Errores
- Si no se puede cargar el logo de oficina, se usa el logo de JIRO
- Los errores se registran en la consola para debugging
- El PDF se genera correctamente aunque falle la carga del logo

### 3. Carga Asíncrona
- Los logos se cargan de forma asíncrona
- No bloquean la generación del PDF
- Timeout implementado para evitar bloqueos

### 4. Optimización de Imágenes
- Los logos se redimensionan automáticamente
- Se mantiene la proporción original
- Se convierte a base64 para inclusión en PDF

## Documentos Relacionados

- `SISTEMA_LOGOTIPOS_IMPLEMENTADO.md` - Sistema completo de logos
- `LOGO_PDF_COMISIONES_SIN_DISTORSION.md` - Corrección de distorsión de logos
- `MEJORA_VISIBILIDAD_MI_LOGOTIPO_USUARIO.md` - Interfaz de configuración de logos

## Próximos Pasos (Opcional)

Si se requiere mayor personalización en el futuro:

1. **Logo por Tipo de Documento:**
   - Permitir logos diferentes para Comprobante vs Orden de Pago
   - Configuración a nivel de oficina

2. **Logo por Categoría de Agente:**
   - Logos diferentes según el rol o categoría del agente
   - Útil para oficinas con múltiples divisiones

3. **Watermark Opcional:**
   - Marca de agua con logo de oficina en el fondo
   - Para documentos confidenciales o borradores

4. **Firma Digital:**
   - Incluir firma digital del gerente de oficina
   - Para validación de documentos
