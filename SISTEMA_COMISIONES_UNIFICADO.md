# Sistema de Comisiones Unificado - Implementación Completa

## Resumen Ejecutivo

**Problema**: Los lotes convertidos desde "Documentos Importar" se mostraban vacíos.

**Causa raíz**: 
- Mapeo de columnas diferente entre "Nuevo Lote" y "Convertir"  
- Bug crítico: usaba `prima_neta` como fallback para `importe_base`
- Sin validación de columnas obligatorias
- Cálculo incorrecto de comisiones

**Solución**: Sistema unificado con validación estricta y cálculo correcto.

## Regla de Oro (NO negociable)

```
Comisión = Importe × (PorPart / 100)
```

**PrimaNeta es SOLO informativo y NUNCA se usa para cálculo.**

## Columnas Obligatorias

| Columna | Sinónimos | Descripción |
|---------|-----------|-------------|
| FPago | fpago, fecha, fechapago | Fecha de pago |
| Email | email, emailagente, mail | Email del agente |
| Ramo | ramo, branch | Ramo del seguro |
| Aseguradora | aseguradora, ciaabreviacion, cia | Compañía aseguradora |
| **Importe** | importe, importebase, base | **BASE de cálculo** |
| **PorPart** | porpart, porcentaje, percentage | **Porcentaje de comisión** |
| Poliza | poliza, documento | Número de póliza |

## Archivos Creados/Modificados

1. **commissionIngestionService.ts** (nuevo): Servicio unificado
2. **convert-import-to-commission-batches/index.ts** (reescrito): Edge function
3. **ComisionesLote.tsx** (mejorado): Logging y respaldo automático

## Verificación

**Antes**: Lote vacío después de convertir  
**Después**: Lote muestra todas las pólizas con datos correctos

