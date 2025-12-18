# Columnas del Excel para "Mi Producción"

## Columnas Obligatorias

Estas columnas **DEBEN existir** para que el registro sea válido:

| Columna | Alternativas Aceptadas | Para qué sirve |
|---------|------------------------|----------------|
| **FechaSimp** | `Fecha`, `fechasimp`, `fecha` | Fecha de la operación |
| **NombreCompleto** | `nombrecompleto`, `nombre completo` | Nombre del cliente |
| **VendNombre** | `vendnombre`, `vendedor` | Nombre del vendedor (para identificar al agente) |

## Columnas Recomendadas

Estas columnas son muy importantes para mostrar información completa:

| Columna | Alternativas Aceptadas | Para qué sirve |
|---------|------------------------|----------------|
| **IMPORTE PESOS** | `importe pesos`, `importe` | Monto principal de la operación |
| **Nombre Compañía** | `nombre compañia`, `nombre compania`, `compañia` | Aseguradora |
| **Sub Ramo** | `sub ramo`, `subramo`, `RamosNombre`, `ramos` | Ramo del seguro |

## Columnas Opcionales

Estas columnas agregan información adicional pero no son obligatorias:

| Columna | Alternativas Aceptadas | Para qué sirve |
|---------|------------------------|----------------|
| Prima de convenio | `prima de convenio`, `prima convenio` | Monto alternativo (se usa si IMPORTE PESOS está vacío) |
| Prima Ponderada | `prima ponderada` | Para cálculos adicionales |
| Bono | `bono` | Bono del agente |
| % BONO | `porcentaje bono`, `porciento bono` | Porcentaje de bono |
| CONVENIO | `convenio` | Si es una operación de convenio (Si/No) |
| GerenciaNombre | `gerencianombre` | Nombre de la gerencia |
| Dirección Regional | `direccion regional`, `region` | Región del cliente |
| Concepto | `concepto` | Detalles adicionales de la operación |

---

## Ejemplo de Excel Mínimo

```
FechaSimp | NombreCompleto | VendNombre | IMPORTE PESOS | Nombre Compañía | Sub Ramo
----------|----------------|------------|---------------|-----------------|----------
15/01/2024 | Juan Pérez | María López | $15,000 | AXA | Autos
20/01/2024 | Empresa ABC | María López | $50,000 | GNP | GMM
```

## Ejemplo de Excel Completo

```
FechaSimp | NombreCompleto | VendNombre | IMPORTE PESOS | Prima de convenio | Nombre Compañía | Sub Ramo | Concepto | GerenciaNombre | Bono | % BONO
----------|----------------|------------|---------------|-------------------|-----------------|----------|----------|----------------|------|--------
15/01/2024 | Juan Pérez | María López | $15,000 | $14,500 | AXA | Autos | Renovación | Gerencia Norte | $1,500 | 10%
20/01/2024 | Empresa ABC | María López | $50,000 | $48,000 | GNP | GMM | Nueva | Gerencia Centro | $5,000 | 10%
```

---

## Notas Importantes

1. **Nombres de columnas flexibles**: El sistema busca múltiples variantes (mayúsculas, minúsculas, con/sin acentos)

2. **Formato de fecha**: Acepta varios formatos
   - DD/MM/YYYY (15/01/2024)
   - MM/DD/YYYY (01/15/2024)
   - Fechas de Excel (número serial)

3. **Formato de montos**: Acepta varios formatos
   - Con símbolo: $15,000.00
   - Sin símbolo: 15000
   - Con comas: 15,000

4. **VendNombre**: Este campo es CRÍTICO
   - Se usa para identificar qué producción pertenece a cada agente
   - Debe coincidir con el nombre del usuario en el sistema O tener un mapeo manual configurado

5. **Si falta IMPORTE PESOS**: El sistema usará "Prima de convenio" como valor alternativo

6. **Registros descartados**: Si falta FechaSimp o NombreCompleto, el registro NO se procesará
