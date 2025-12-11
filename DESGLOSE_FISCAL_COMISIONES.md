# Desglose Fiscal de Comisiones - Documentación

Este documento explica las reglas fiscales implementadas en el módulo de comisiones para el cálculo del Desglose Fiscal en la Orden de Pago.

## Función: `calcularDesgloseFiscal`

Ubicación: `src/lib/pdfUtils.ts`

Esta función calcula el desglose fiscal según el régimen fiscal del agente.

### Parámetros de entrada:

- `regimenFiscal`: string - Nombre del régimen fiscal (RESICO, HONORARIOS, ASIMILADOS)
- `resumenPorRamo`: Array de objetos con ramo, primaTotal y comisionNeta
- `totalComisionNeta`: number - Total de comisión neta del agente en el lote
- `resicoIsrRate`: number (opcional) - Tasa de ISR para RESICO (default: 0.0125 = 1.25%)
- `resicoIvaRate`: number (opcional) - Tasa de IVA para RESICO (default: 0)
- `resicoRetIvaRate`: number (opcional) - Tasa de retención de IVA para RESICO (default: 0)

### Valor de retorno:

Objeto `DesgloseFiscal` con los siguientes campos:
- `retContable`: Retención contable
- `costoDispersion`: Costo de dispersión
- `iva`: IVA trasladado
- `retIsr`: Retención de ISR
- `retIva`: Retención de IVA
- `totalAPagar`: Total neto a pagar al agente

---

## Reglas por Régimen Fiscal

### 1. ASIMILADOS (Régimen de Asimilados a Salarios)

**Requerimiento del negocio**: Para agentes en régimen de Asimilados a Salarios.

#### Cálculo de Retención Contable:
- Base: Suma de comisión neta **SOLO del ramo "Vida"**
- Fórmula: `retContable = baseVida × 0.16` (16%)
- Para todos los demás ramos (Autos, Daños, etc.), la retención contable es 0%

#### Costo de Dispersión:
- Base: Retención contable calculada
- Fórmula: `costoDispersion = retContable × 0.10` (10%)

#### IVA:
- En Asimilados NO se agrega IVA en este desglose
- `iva = 0`

#### Retenciones ISR e IVA:
- Para este régimen, no aplican retenciones adicionales en este desglose
- `retIsr = 0`
- `retIva = 0`

#### Total a pagar:
```
totalAPagar = totalComisionNeta
              - retContable
              - costoDispersion
              - retIsr
              - retIva
              + iva
```

**Ejemplo numérico:**
```
Total Comisión Neta: $10,000
  - Vida: $6,000
  - Autos: $4,000

Ret. Contable = $6,000 × 0.16 = $960
Costo Dispersión = $960 × 0.10 = $96
IVA = $0
Ret ISR = $0
Ret IVA = $0
Total a pagar = $10,000 - $960 - $96 = $8,944
```

---

### 2. RESICO (Régimen Simplificado de Confianza)

**Nota importante**: Las tasas para RESICO son **configurables** y no deben estar hardcodeadas, ya que pueden cambiar según la legislación fiscal vigente.

#### Base Fiscal:
- Usar `totalComisionNeta` como base de cálculo
- `baseFiscal = totalComisionNeta`

#### Retención de ISR:
- Tasa configurable (default: 1.25% según reglas actuales de retención a personas físicas en RESICO)
- Fórmula: `retIsr = baseFiscal × resicoIsrRate`
- Default: `resicoIsrRate = 0.0125`

#### IVA e IVA Retenido:
- Totalmente configurables porque dependen de si se causa IVA y si aplica retención
- `iva = baseFiscal × resicoIvaRate` (default: 0)
- `retIva = baseFiscal × resicoRetIvaRate` (default: 0)
- Inicialmente en 0; después se expondrán en una pantalla de configuración fiscal

#### Retención Contable y Costo de Dispersión:
- Por defecto, no aplican en este régimen (a menos que se configuren reglas distintas posteriormente)
- `retContable = 0`
- `costoDispersion = 0`

#### Total a pagar:
```
totalAPagar = baseFiscal
              - retContable
              - costoDispersion
              - retIsr
              - retIva
              + iva
```

**Ejemplo numérico (con defaults):**
```
Total Comisión Neta: $10,000

Ret. Contable = $0
Costo Dispersión = $0
IVA = $0
Ret ISR = $10,000 × 0.0125 = $125
Ret IVA = $0
Total a pagar = $10,000 - $125 = $9,875
```

---

### 3. HONORARIOS (Régimen de Actividad Empresarial y Profesional)

**Placeholder para futuro desarrollo**.

Por ahora, todos los conceptos están en 0:
- `retContable = 0`
- `costoDispersion = 0`
- `iva = 0`
- `retIsr = 0`
- `retIva = 0`
- `totalAPagar = totalComisionNeta`

**TODO**: Agregar reglas específicas para Honorarios cuando se definan los requisitos del negocio.

---

## Integración en el PDF

La función se integra en `generateOrdenDePagoPDF` de la siguiente manera:

1. Se construye el `resumenPorRamo` agrupando todas las comisiones por ramo
2. Se obtiene el `regimenFiscal` del agente (desde `agent.fiscal_regime?.name`)
3. Se calcula el `totalComisionNeta` sumando todas las comisiones del lote
4. Se llama a `calcularDesgloseFiscal()` con estos datos
5. El resultado se muestra en una tabla en la sección "Desglose Fiscal" del PDF

### Formato en el PDF:

```
Desglose Fiscal
┌────────────────────┬──────────────┐
│ Concepto           │ Importe      │
├────────────────────┼──────────────┤
│ Ret. Contable      │ $XXX.XX      │
│ Costo Dispersión   │ $XXX.XX      │
│ IVA                │ $XXX.XX      │
│ Ret ISR            │ $XXX.XX      │
│ Ret IVA            │ $XXX.XX      │
│ Total a pagar      │ $X,XXX.XX    │ (en verde, negritas)
└────────────────────┴──────────────┘
Régimen fiscal: [nombre del régimen]
```

---

## Notas de Implementación

### Separación de Lógica de Negocio y UI:
- La función `calcularDesgloseFiscal` es una función pura que solo calcula valores
- No tiene dependencias de jsPDF u otras librerías de UI
- Puede ser reutilizada en otros contextos (reportes, APIs, etc.)

### Configurabilidad:
- Las tasas para RESICO son parámetros opcionales con valores por default
- En el futuro se puede implementar una pantalla de configuración fiscal donde:
  - Administradores puedan ajustar `resicoIsrRate`, `resicoIvaRate`, `resicoRetIvaRate`
  - Se almacenen en base de datos (tabla `commission_fiscal_regimes` o similar)
  - Se pasen como parámetros a la función

### Formato de Moneda:
- Todos los montos se formatean con `formatCurrency()` que usa el formato MXN con dos decimales
- Ejemplo: `$1,234.56`

### Restricciones del PDF:
- El PDF se mantiene en formato A4 vertical (portrait)
- El desglose fiscal se muestra solo si hay espacio disponible (mínimo 18mm)
- Se muestran hasta 30 pólizas por orden de pago
- Todo debe caber en una sola página

---

## Referencias y Normatividad

### RESICO - Régimen Simplificado de Confianza:
- Implementado en México a partir de 2022
- Retención de ISR según Art. 113-J de la LISR
- Tasa de retención actual: 1.25% sobre pagos realizados
- Referencias: [SAT - RESICO](https://www.sat.gob.mx/)

### Asimilados a Salarios:
- Régimen para personas físicas que perciben ingresos asimilados a salarios
- Retención según el esquema específico del pagador
- La retención del 16% sobre Vida es un requerimiento específico del negocio

### Honorarios:
- Régimen general de actividad empresarial y profesional
- Requiere emisión de CFDI
- Retenciones según el tipo de servicio prestado

---

## Pruebas y Validación

Para validar el correcto funcionamiento:

1. Crear un lote de comisiones con agentes de diferentes regímenes
2. Verificar que cada agente tenga asignado su régimen fiscal correcto
3. Generar la Orden de Pago PDF
4. Verificar que:
   - Los cálculos coinciden con las fórmulas documentadas
   - El régimen fiscal se muestra correctamente
   - Los montos están formateados correctamente
   - El "Total a pagar" es correcto según el régimen

### Casos de prueba recomendados:

#### Caso 1: Asimilados con ramo Vida
- Comisiones: Vida $5,000 + Autos $3,000
- Esperado: Ret. Contable = $800, Costo Dispersión = $80

#### Caso 2: RESICO con defaults
- Comisión: $10,000
- Esperado: Ret ISR = $125

#### Caso 3: Honorarios (placeholder)
- Comisión: $10,000
- Esperado: Total a pagar = $10,000 (sin retenciones)

---

## Mantenimiento Futuro

### Próximos pasos sugeridos:

1. **Pantalla de Configuración Fiscal**:
   - Permitir ajustar tasas de RESICO
   - Configurar reglas para Honorarios
   - Validar rangos de tasas (0-100%)

2. **Reglas para Honorarios**:
   - Definir con el área de negocio
   - Implementar cálculos específicos
   - Agregar validaciones

3. **Auditoría y Trazabilidad**:
   - Registrar qué tasas se usaron para cada cálculo
   - Guardar histórico de cambios en tasas fiscales
   - Permitir recalcular lotes antiguos con nuevas tasas

4. **Validaciones adicionales**:
   - Verificar que el agente tenga régimen fiscal asignado
   - Alertar si faltan datos fiscales
   - Prevenir cálculos con regímenes inválidos

---

## Contacto y Soporte

Para dudas sobre esta implementación, consultar:
- Código fuente: `src/lib/pdfUtils.ts`
- Función principal: `calcularDesgloseFiscal()`
- Tipos: `DesgloseFiscal`, `ResumenPorRamo`
