# Checklist de QA: PDF de Cálculo Fiscal Limpio

**Fecha**: 17 Diciembre 2024
**Objetivo**: Validar que el PDF solo muestre campos permitidos

---

## Cómo Probar

### 1. Generar PDFs de Prueba

1. Ir a módulo "Mis Comisiones"
2. Seleccionar un lote cerrado
3. Descargar PDF de "Orden de Pago"
4. Buscar la sección "Cálculo Fiscal (Resumen)"

### 2. Probar con Diferentes Regímenes

Necesitas generar PDFs para agentes con cada régimen fiscal:

- [ ] HONORARIOS
- [ ] ASIMILADOS
- [ ] RESICO

---

## Checklist de Validación

### ✅ PASO 1: Verificar Título

- [ ] El título dice **"Cálculo Fiscal (Resumen)"**
- [ ] NO dice "Desglose Fiscal"
- [ ] El formato es limpio y profesional

---

### ✅ PASO 2: Verificar Campos PERMITIDOS (Por Régimen)

#### HONORARIOS

El PDF debe mostrar SOLO estos campos (cuando apliquen):

- [ ] IVA (con signo +)
- [ ] Ret. ISR (con signo -)
- [ ] Ret. IVA (con signo -)
- [ ] Total (siempre, destacado en verde)

Total de filas esperadas: 3-4 (depende de valores > 0)

#### ASIMILADOS

El PDF debe mostrar SOLO estos campos (cuando apliquen):

- [ ] Ret. Contable (con signo -)
- [ ] Costo Dispersión (con signo -)
- [ ] Ret. ISR (con signo -)
- [ ] IVA (con signo +, solo si aplica)
- [ ] Ret. IVA (con signo -, solo si aplica)
- [ ] Total (siempre, destacado en verde)

Total de filas esperadas: 3-6 (depende de valores > 0)

**Nota especial**: "Ret. ISR" en ASIMILADOS es la suma del ISR Total interno

#### RESICO

El PDF debe mostrar SOLO estos campos (cuando apliquen):

- [ ] IVA (con signo +)
- [ ] Ret. ISR (con signo -)
- [ ] Ret. IVA (con signo -)
- [ ] Ret. Contable (con signo -, solo si aplica)
- [ ] Costo Dispersión (con signo -, solo si aplica)
- [ ] Total (siempre, destacado en verde)

Total de filas esperadas: 3-6 (depende de valores > 0)

---

### ✅ PASO 3: Verificar Campos PROHIBIDOS

**CRÍTICO**: El PDF NO debe contener NINGUNA de estas palabras o frases:

#### Términos Técnicos Prohibidos

- [ ] NO aparece "Comisión Base Total"
- [ ] NO aparece "Prima Total"
- [ ] NO aparece "Prima Gravada"
- [ ] NO aparece "Prima No Gravada"

#### Desgloses Internos Prohibidos

- [ ] NO aparece "Vida" (como campo independiente)
- [ ] NO aparece "Sin Vida"
- [ ] NO aparece "Comisión Vida"
- [ ] NO aparece "Comisión Sin Vida"
- [ ] NO aparece "Comisión Daños"

#### Cálculos ISR Prohibidos

- [ ] NO aparece "ISR Vida"
- [ ] NO aparece "ISR Daños"
- [ ] NO aparece "ISR Total" (excepto que se muestre como "Ret. ISR")

#### Porcentajes Prohibidos

- [ ] NO aparece "(16% Vida)"
- [ ] NO aparece "(10% Sin Vida)"
- [ ] NO aparece "(10% Total)"
- [ ] NO aparece "(1.25%)"
- [ ] NO aparece "(10.667%)"
- [ ] NO aparece ningún porcentaje en los labels

---

### ✅ PASO 4: Verificar Formato Visual

#### Tabla

- [ ] Tiene 2 columnas: "Concepto" | "Importe"
- [ ] Header azul oscuro con texto blanco
- [ ] Filas normales alternadas blanco/gris claro
- [ ] Fila "Total" con fondo verde y texto blanco en negrita

#### Valores

- [ ] Formato de moneda correcto: $X,XXX.XX
- [ ] Signos correctos: "+" para IVA, "-" para retenciones
- [ ] Alineación derecha en columna de importes

#### Pie de Tabla

- [ ] Muestra: "Régimen fiscal: [NOMBRE]"
- [ ] Tamaño de fuente pequeño (7pt)
- [ ] Color gris

---

### ✅ PASO 5: Validar Consistencia de Total

Para cada PDF generado:

1. Anotar el "Total" que aparece en el PDF: $______
2. Verificar en la base de datos el `total_a_pagar` calculado: $______
3. Validar que coincidan (tolerancia de $0.01)

- [ ] Total del PDF coincide con cálculo backend

**Si NO coinciden**:
- Reportar inmediatamente
- Indicar régimen fiscal
- Indicar diferencia encontrada

---

### ✅ PASO 6: Validar Campos Condicionales

#### Si un campo es $0.00:

- [ ] El campo NO aparece en el PDF
- [ ] Excepto "Total" que siempre aparece

#### Ejemplo HONORARIOS con IVA = 0:

Debería mostrar solo:
```
Ret. ISR    - $500.00
Ret. IVA    - $320.00
Total       $7,180.00
```

NO debería mostrar:
```
IVA         + $0.00  ← NO DEBE APARECER
```

---

### ✅ PASO 7: Validar Múltiples Agentes

Probar con al menos 3 agentes diferentes:

1. **Agente 1** (HONORARIOS):
   - [ ] PDF correcto
   - [ ] Solo campos permitidos
   - [ ] Total consistente

2. **Agente 2** (ASIMILADOS):
   - [ ] PDF correcto
   - [ ] Solo campos permitidos
   - [ ] Total consistente

3. **Agente 3** (RESICO):
   - [ ] PDF correcto
   - [ ] Solo campos permitidos
   - [ ] Total consistente

---

## Casos de Borde a Probar

### Caso 1: Lote con solo pólizas de Vida

- [ ] ASIMILADOS: Debe mostrar "Ret. Contable" pero NO "Costo Dispersión"
- [ ] HONORARIOS: Debe mostrar solo "Ret. ISR", sin IVA ni Ret. IVA
- [ ] RESICO: Debe mostrar solo "Ret. ISR", sin IVA ni Ret. IVA

### Caso 2: Lote con solo pólizas sin Vida (Daños)

- [ ] ASIMILADOS: Debe mostrar "Costo Dispersión" pero NO "Ret. Contable"
- [ ] HONORARIOS: Debe mostrar IVA, Ret. ISR, y Ret. IVA
- [ ] RESICO: Debe mostrar IVA, Ret. ISR, y Ret. IVA

### Caso 3: Lote mixto (Vida + Daños)

- [ ] ASIMILADOS: Debe mostrar ambos "Ret. Contable" y "Costo Dispersión"
- [ ] HONORARIOS: Debe mostrar IVA, Ret. ISR, y Ret. IVA
- [ ] RESICO: Debe mostrar IVA, Ret. ISR, y Ret. IVA

### Caso 4: Lote con comisión ajustada manualmente

- [ ] El Total refleja la comisión ajustada
- [ ] No hay inconsistencias en los cálculos
- [ ] Solo se muestran campos permitidos

---

## Herramientas de Validación

### Búsqueda de Palabras Prohibidas

Abrir el PDF en un visor y buscar (Ctrl+F):

1. Buscar: "vida" → Solo debe aparecer en "Ret. IVA" o metadata, NO como campo independiente
2. Buscar: "prima" → NO debe encontrar resultados
3. Buscar: "base" → NO debe encontrar resultados en la sección fiscal
4. Buscar: "%" → NO debe encontrar resultados en labels de campos

### Validación Visual Rápida

Contar filas en la tabla de Cálculo Fiscal:

- **HONORARIOS**: Máximo 4 filas (IVA, Ret. ISR, Ret. IVA, Total)
- **ASIMILADOS**: Máximo 6 filas
- **RESICO**: Máximo 6 filas

Si hay MÁS filas, hay un problema.

---

## Criterios de Aprobación

Para aprobar esta funcionalidad, todos estos puntos deben cumplirse:

### Críticos (DEBE cumplir 100%)

- [ ] Ningún PDF muestra campos prohibidos
- [ ] El Total siempre coincide con backend
- [ ] Total siempre aparece destacado en verde
- [ ] Título correcto: "Cálculo Fiscal (Resumen)"

### Importantes (DEBE cumplir 100%)

- [ ] Campos condicionales funcionan (si = 0, no se muestra)
- [ ] Formato de moneda correcto
- [ ] Signos +/- correctos
- [ ] Los 3 regímenes funcionan correctamente

### Deseables (DEBE cumplir al menos 80%)

- [ ] Formato visual limpio y profesional
- [ ] Texto del pie de página correcto
- [ ] Responsive en diferentes tamaños de pantalla (al visualizar)

---

## Reportar Problemas

Si encuentras algún problema, reporta:

1. **Régimen fiscal** del agente
2. **ID del lote** de comisiones
3. **Campo problemático** que aparece
4. **Captura de pantalla** del PDF
5. **Valor esperado** vs **Valor obtenido**

### Ejemplo de Reporte

```
❌ PROBLEMA ENCONTRADO

Régimen: ASIMILADOS
Lote ID: batch_xyz123
Problema: Aparece campo "ISR Vida (10%)" en el PDF
Esperado: Solo "Ret. ISR"
Screenshot: [adjuntar]

Total PDF: $6,210.00
Total Backend: $6,210.00
```

---

## Checklist de Pre-Deploy

Antes de desplegar a producción:

- [ ] Todos los tests de validación pasaron
- [ ] Se probaron los 3 regímenes fiscales
- [ ] Se probaron al menos 5 lotes diferentes
- [ ] No se encontraron palabras prohibidas
- [ ] Los totales coinciden en todos los casos
- [ ] El formato visual es consistente
- [ ] La documentación está actualizada

---

## Contacto en Caso de Dudas

Si tienes dudas durante la validación:

1. Revisar `PDF_CALCULO_FISCAL_LIMPIO.md`
2. Ver ejemplos visuales en la documentación
3. Ejecutar tests de validación: `npm run build`
4. Consultar con el equipo de desarrollo

---

**Estado**: ⏳ Pendiente de validación QA
**Prioridad**: Alta
**Bloqueante**: No (funcionalidad anterior sigue funcionando)

---

**Última actualización**: 17 Diciembre 2024
