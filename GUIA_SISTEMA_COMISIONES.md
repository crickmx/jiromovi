# Guía del Sistema de Comisiones

## Descripción General

El sistema de comisiones calcula automáticamente las comisiones de los agentes a partir de archivos Excel de las aseguradoras. El cálculo se realiza de forma simple usando la fórmula:

**Comisión Bruta = Prima Neta × (PortPart / 100)**

Donde:
- **Prima Neta**: Monto de la prima de la póliza
- **PortPart**: Porcentaje de comisión (viene en el Excel de la aseguradora)

## Estructura del Archivo Excel

El archivo Excel debe contener las siguientes columnas **obligatorias**:

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| **FPago** | Fecha de pago | 2024-12-01 |
| **EmailAgente** | Email del agente | agente@correo.com |
| **Ramo** | Tipo de seguro | Autos, Vida, GMM |
| **Aseguradora** | Nombre de la aseguradora | GNP, AXA, Qualitas |
| **PrimaNeta** | Prima neta de la póliza | 10000 |
| **PortPart** | Porcentaje de comisión | 12.5 |
| **Poliza** | Número de póliza | POL-12345 |
| **Concepto** | Concepto del pago (opcional) | Emisión |

### Columnas Alternativas

El sistema acepta nombres alternativos:
- **Email** en lugar de EmailAgente
- **CiaAbreviacion** en lugar de Aseguradora
- **Documento** en lugar de Poliza

## Cómo Funciona el Sistema

### 1. Gestión de Agentes

Los agentes se gestionan desde la lista de **Usuarios** de la plataforma:
- Solo los usuarios con rol **"Agente"** pueden recibir comisiones
- El email del agente en el Excel debe coincidir con el email personal o laboral del usuario
- Se puede configurar el régimen fiscal del agente en su perfil

### 2. Proceso de Carga

1. **Subir Archivo Excel**
   - Ve a: Comisiones → Nuevo Lote
   - Selecciona tu archivo .xlsx
   - El sistema valida automáticamente las columnas

2. **Análisis Automático**
   - El sistema agrupa las pólizas por semana
   - Muestra un resumen con el número de pólizas por semana
   - Detecta semanas duplicadas

3. **Selección de Semanas**
   - Marca las semanas que deseas procesar
   - Puedes seleccionar una o varias semanas
   - Solo se procesarán las semanas marcadas

4. **Procesamiento**
   - Haz clic en "Procesar Comisiones"
   - El sistema crea lotes por semana
   - Calcula comisiones e impuestos automáticamente

### 3. Cálculo de Comisiones

Para cada póliza:

```javascript
// 1. Comisión Bruta
commission_bruta = PrimaNeta * (PortPart / 100)

// Ejemplo: $10,000 × (12.5 / 100) = $1,250

// 2. Impuestos (según régimen fiscal del agente)
iva_trasladado = commission_bruta × tasa_iva_trasladado
iva_retenido   = commission_bruta × tasa_iva_retenido
isr            = commission_bruta × tasa_isr

// 3. Comisión Neta
commission_neta = commission_bruta + iva_trasladado - iva_retenido - isr
```

### Ejemplo Numérico

```
Datos de entrada:
- Prima Neta: $10,000
- PortPart: 12.5 (significa 12.5%)

Régimen Fiscal del Agente:
- IVA Trasladado: 16% (0.16)
- IVA Retenido: 10.66% (0.1066)
- ISR: 10% (0.10)

Cálculo:
1. Comisión Bruta = $10,000 × 0.125 = $1,250
2. IVA Trasladado = $1,250 × 0.16 = $200
3. IVA Retenido = $1,250 × 0.1066 = $133.25
4. ISR = $1,250 × 0.10 = $125
5. Comisión Neta = $1,250 + $200 - $133.25 - $125 = $1,191.75
```

## Configuración del Régimen Fiscal

Cada agente debe tener configurado su régimen fiscal. Esto se hace en:

**Usuarios → Perfil del Usuario → Régimen Fiscal**

Los regímenes fiscales más comunes:

### 1. Persona Física con Actividad Empresarial
```json
{
  "iva_trasladado": 0.16,
  "iva_retenido": 0.1066,
  "isr": 0.10
}
```

### 2. Persona Moral
```json
{
  "iva_trasladado": 0.16,
  "iva_retenido": 0.00,
  "isr": 0.30
}
```

### 3. Régimen de Incorporación Fiscal
```json
{
  "iva_trasladado": 0.16,
  "iva_retenido": 0.1066,
  "isr": 0.0125
}
```

## Manejo de Errores

El sistema registra automáticamente errores cuando:

### 1. Agente No Encontrado
```
Error: "Agente no encontrado: agente@correo.com"
Causa: El email del Excel no coincide con ningún usuario agente
Solución: Verifica que el usuario exista y tenga rol "Agente"
```

### 2. PortPart Vacío
```
Error: "La columna PortPart es requerida y no puede estar vacía"
Causa: El Excel tiene filas sin valor en PortPart
Solución: Completa la columna PortPart en el Excel
```

### 3. Fecha Inválida
```
Error: "Invalid Date"
Causa: La columna FPago tiene un formato incorrecto
Solución: Formatea la columna como fecha en Excel
```

## Estados de los Lotes

Los lotes pueden tener 3 estados:

### 1. Borrador (draft)
- Lote recién creado
- Puedes editar comisiones individuales
- Puedes eliminar el lote

### 2. Confirmado (confirmed)
- Lote revisado y confirmado
- Ya no se pueden editar comisiones
- Listo para pago

### 3. Cerrado (closed)
- Lote procesado y pagado
- Solo lectura
- Histórico permanente

## Ver y Gestionar Comisiones

### Para Administradores

**Comisiones → Ver Lotes**

- Ver todos los lotes
- Filtrar por estado (Borrador, Confirmado, Cerrado)
- Ver detalles de cada lote
- Ajustar comisiones individualmente
- Confirmar lotes
- Cerrar lotes

### Para Agentes

**Mis Comisiones**

- Ver solo sus propias comisiones
- Filtrar por fecha y estado
- Ver detalles de cada comisión
- Descargar reportes

## Ajustes Manuales

Los administradores pueden ajustar comisiones individualmente:

1. Ve al detalle del lote
2. Busca la comisión que deseas ajustar
3. Haz clic en "Ajustar"
4. Modifica la comisión bruta
5. El sistema recalcula automáticamente impuestos y neta

**Nota**: Las comisiones ajustadas se marcan con un indicador especial.

## Reportes y Exportación

### Exportar Lote a Excel

Desde el detalle del lote puedes exportar:
- Listado completo de comisiones
- Agrupado por agente
- Incluye todos los cálculos e impuestos
- Formato listo para contabilidad

### Reportes Disponibles

1. **Por Agente**: Suma de comisiones por agente
2. **Por Oficina**: Total por oficina
3. **Por Aseguradora**: Comisiones por compañía
4. **Por Ramo**: Distribución por tipo de seguro

## Diagnóstico de Problemas

### Problema: "Lotes creados: 0"

**Posibles causas y soluciones:**

1. **No hay semanas seleccionadas**
   - Solución: Marca al menos una semana antes de procesar

2. **Fechas inválidas en FPago**
   - Solución: Verifica el formato de fechas en Excel
   - Formato correcto: YYYY-MM-DD o DD/MM/YYYY

3. **Archivo vacío o mal formateado**
   - Solución: Revisa que el Excel tenga datos y todas las columnas

### Ver Logs de Procesamiento

Abre la consola del navegador (F12) y busca:

```
[process-commissions] Received rows: 150
[process-commissions] Selected weeks: 2
[process-commissions] Filtered rows: 75
[process-commissions] Batches to create: 2
[process-commissions] Week keys: ["2024-W48", "2024-W49"]
```

Esto te indica exactamente dónde está el problema.

## Preguntas Frecuentes

### ¿Qué pasa si un agente no tiene régimen fiscal?

El sistema calcula la comisión bruta pero no aplica impuestos (quedan en $0). Se recomienda configurar siempre el régimen fiscal.

### ¿Puedo procesar el mismo archivo dos veces?

Sí, pero se crearán lotes duplicados. Usa el filtro de fechas para evitar duplicados.

### ¿Cómo elimino un lote?

Solo se pueden eliminar lotes en estado "Borrador". Desde el detalle del lote, haz clic en "Eliminar Lote".

### ¿Los agentes pueden ver sus comisiones en tiempo real?

Sí, desde la página "Mis Comisiones" pueden ver todas sus comisiones procesadas.

### ¿Puedo cambiar el régimen fiscal de un agente después de procesar?

El cambio no afecta comisiones ya calculadas. Solo aplica a nuevos lotes.

## Flujo Completo del Sistema

```
1. Aseguradora genera Excel con comisiones
   ↓
2. Administrador sube archivo al sistema
   ↓
3. Sistema valida columnas y agrupa por semana
   ↓
4. Administrador selecciona semanas a procesar
   ↓
5. Sistema procesa cada póliza:
   - Busca agente por email
   - Calcula comisión: PrimaNeta × (PortPart / 100)
   - Aplica impuestos según régimen fiscal
   - Calcula comisión neta
   ↓
6. Sistema crea lotes por semana (estado: Borrador)
   ↓
7. Administrador revisa y ajusta si es necesario
   ↓
8. Administrador confirma lote (estado: Confirmado)
   ↓
9. Se procesa el pago a los agentes
   ↓
10. Administrador cierra lote (estado: Cerrado)
```

## Mejores Prácticas

1. **Valida el Excel antes de subir**
   - Verifica que todas las columnas estén completas
   - Asegúrate que los emails de agentes sean correctos
   - Revisa que las fechas estén bien formateadas

2. **Procesa por semanas completas**
   - Evita procesar semanas parciales
   - Agrupa todos los pagos de una semana en un solo lote

3. **Revisa antes de confirmar**
   - Verifica los totales por agente
   - Revisa que no haya errores
   - Ajusta si es necesario

4. **Mantén actualizado el régimen fiscal**
   - Revisa periódicamente los regímenes de los agentes
   - Actualiza cuando cambien las tasas de impuestos

5. **Documenta los ajustes manuales**
   - Cuando ajustes una comisión, agrega un comentario
   - Mantén registro de por qué se hizo el ajuste

## Soporte Técnico

Para problemas o dudas:

1. **Logs del navegador**: Consola (F12) → Console
2. **Logs de Supabase**: Dashboard → Edge Functions → process-commissions → Logs
3. **Revisar errores**: Desde el detalle del lote, pestaña "Errores"

---

**Última actualización**: Diciembre 2024
**Versión**: 2.0 (Sistema Simplificado)
