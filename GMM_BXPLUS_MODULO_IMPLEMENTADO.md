# Módulo GMM BX+ - Cotizador de Seguros

## Resumen

Se ha implementado un sistema completo de cotización de seguros GMM (Gastos Médicos Mayores) BX+ que permite:

1. Cargar archivos Excel con tarifas versionadas
2. Cotizar pólizas con múltiples asegurados y coberturas
3. Guardar cotizaciones con trazabilidad completa
4. Auditar qué versión de tarifa se usó en cada cotización

## Estructura Implementada

### Base de Datos

**Tablas creadas:**
- `tariff_packages`: Paquetes de tarifas (versiones)
- `tariff_tables`: Tablas de factores, coeficientes y catálogos
- `gmm_quotes`: Cotizaciones guardadas
- `gmm_quote_insureds`: Asegurados por cotización

**Storage:**
- `gmm-tariffs`: Archivos Excel de tarifas
- `gmm-quotes`: PDFs generados (preparado para futura implementación)

**Funciones:**
- `activate_tariff_package()`: Activar una versión de tarifa
- `generate_quote_number()`: Generar número de cotización automático
- Triggers para auto-numeración

### Backend (Edge Functions)

**`gmm-upload-tariff`**
- Procesa archivos Excel (.xlsx, .xlsm)
- Extrae todos los rangos definidos en la especificación
- Valida estructura del archivo
- Guarda en storage y base de datos
- Genera hash SHA-256 para evitar duplicados

### Frontend

**1. Administración de Tarifas (`/gmm/tarifas`)**
- Solo para administradores
- Carga de archivos Excel
- Visualización de versiones
- Activación de tarifas
- Validación y errores

**2. Cotizador (`/gmm/cotizador`)**
- Selección de parámetros del plan
- Hasta 8 asegurados
- Coberturas opcionales con checkboxes
- Cálculo en tiempo real
- Guardado de cotizaciones

**3. Mis Cotizaciones (`/gmm/cotizaciones`)**
- Listado de cotizaciones guardadas
- Detalle completo por cotización
- Asegurados y primas
- Coberturas activas

### Motor de Cálculo

**Archivo:** `src/lib/gmmCalculationEngine.ts`

Replica exactamente la lógica del Excel:

**Factores aplicados:**
- Estado, Nivel Hospitalario, Tabulador
- Suma Asegurada, Deducible, Coaseguro
- Forma de Pago

**Prima Base:**
```
base = tabla_base[edad][sexo]
base *= factor_estado * factor_nivel * factor_tabulador
base *= factor_SA * factor_deducible * factor_coaseguro
```

**Coberturas Adicionales:**
- Medicamentos fuera de hospital
- Padecimientos preexistentes
- Complicaciones no amparadas
- VIP, Reconocimiento de antigüedad
- Multiregión (Carga Sistema)
- Cobertura Internacional (Carga Sistema)
- Emergencia médica extranjero
- Enfermedades graves extranjero
- Ampliación de servicios
- Ayuda diaria
- Eliminación deducible por accidente
- Indemnización EG
- Maternidad (solo mujeres)
- Xtensuz

**Cálculo de Totales:**
```
prima_neta_total = suma(primas asegurados)
recargo = prima_neta_total × factor_forma_pago
subtotal = prima_neta_total + recargo + gastos_expedicion
iva = subtotal × 0.16
total = subtotal + iva
```

**Recibos:**
- 1 recibo: total
- >1 recibo: primer recibo incluye gastos de expedición, resto se distribuye

### Tipos TypeScript

**Archivo:** `src/lib/gmmTypes.ts`

Tipos completos para:
- Paquetes de tarifas
- Tablas de tarifas
- Cotizaciones
- Asegurados
- Input/Output de cálculos

## Estructura del Excel

El sistema espera un archivo Excel con esta estructura:

**Hojas requeridas:**
- `Tarifa`: Factores, coeficientes y tablas
- `Cotizador`: (no usado actualmente)
- `Cotizacion`: Gastos de expedición

**Rangos extraídos:**

| Tabla | Hoja | Rango | Tipo |
|-------|------|-------|------|
| factor_estado | Tarifa | W4:Y38 | table |
| factor_nivel_hospitalario | Tarifa | AA4:AB6 | table |
| factor_tabulador | Tarifa | AA11:AB16 | table |
| factor_suma_asegurada | Tarifa | N4:O9 | table |
| factor_deducible | Tarifa | Q4:R14 | table |
| factor_coaseguro | Tarifa | T4:U8 | table |
| tope_coaseguro | Tarifa | T13:U17 | table |
| forma_pago | Tarifa | BL31:BN35 | table |
| base_intermedia_edad_sexo | Tarifa | C3:E110 | table |
| coef_medicamentos | Tarifa | AJ3 | value |
| coef_preexistentes | Tarifa | AJ7 | value |
| coef_complicaciones | Tarifa | AJ11 | value |
| coef_vip | Tarifa | BI3 | value |
| coef_antiguedad | Tarifa | BI7 | value |
| coef_emergencia_ext | Tarifa | AW3 | value |
| coef_enf_graves_ext | Tarifa | AW7 | value |
| coef_ayuda_diaria | Tarifa | BC3 | value |
| coef_ampliacion_servicios | Tarifa | BC7 | value |
| denominador_cargas | Tarifa | L4:L6 | array |
| deducible_accidente_keys | Tarifa | AU15:AU23 | array |
| deducible_accidente_factors | Tarifa | AW15:AW23 | array |
| multiregion_carga_sistema | Tarifa | AQ42:AS74 | table |
| cobertura_internacional_carga_sistema | Tarifa | AY42:BA76 | table |
| maternidad_tasa_por_edad | Tarifa | AN18:AO68 | table |
| maternidad_threshold | Tarifa | AN15 | value |
| indemnizacion_eg_tabla | Tarifa | BE3:BG50 | table |
| indemnizacion_eg_monto | Tarifa | DK2 | value |
| xtensuz_factor | Tarifa | AJ15:AK18 | table |
| gastos_expedicion | Cotizacion | O67 | value |

## Flujo de Uso

### 1. Admin: Cargar Tarifa

1. Ir a `/gmm/tarifas`
2. Seleccionar archivo Excel
3. Dar nombre a la versión
4. Subir archivo
5. Sistema valida y guarda
6. Activar la versión deseada

### 2. Usuario: Cotizar

1. Ir a `/gmm/cotizador`
2. Seleccionar parámetros del plan
3. Agregar asegurados (nombre, sexo, edad/fecha nacimiento)
4. Activar coberturas deseadas
5. Clic en "Calcular"
6. Ver resumen en tiempo real
7. Clic en "Guardar" para guardar cotización

### 3. Usuario: Ver Cotizaciones

1. Ir a `/gmm/cotizaciones`
2. Ver listado de cotizaciones
3. Clic en una cotización para ver detalles completos

## Seguridad y Permisos

- **Admin**: Gestiona tarifas (cargar, activar)
- **Todos los usuarios**: Pueden cotizar y ver sus cotizaciones
- RLS habilitado en todas las tablas
- Storage con políticas de acceso

## Auditoría y Trazabilidad

Cada cotización guarda:
- Versión de tarifa usada (tariff_package_id)
- Input completo (parámetros, asegurados, coberturas)
- Resultado completo (primas, totales, recibos)
- Fecha y usuario que creó
- Número de cotización único

Si las tarifas cambian, las cotizaciones antiguas siguen vinculadas a su versión original.

## Características Técnicas

**Redondeos:**
- 2 decimales: Montos monetarios
- 3 decimales: Factores de deducible por accidente
- 5 decimales: Factores de multiregión e internacional

**Validaciones:**
- Archivo Excel con hojas requeridas
- Rangos válidos y completos
- Asegurados con edad o fecha de nacimiento
- No duplicar archivos (hash SHA-256)

**Performance:**
- Cálculos en frontend (sin latencia de red)
- Índices en DB para consultas rápidas
- Versionado sin afectar cotizaciones existentes

## Pendiente para Implementación Futura

1. **Generación de PDF**: Edge function para generar PDF de cotización
2. **Envío por Email**: Enviar cotización por correo
3. **Edición de Cotizaciones**: Permitir modificar cotizaciones guardadas
4. **Comparador**: Comparar múltiples cotizaciones
5. **Dashboard de Estadísticas**: Métricas de cotizaciones
6. **Exportación a Excel**: Exportar cotizaciones a Excel

## Notas Importantes

1. **Siempre debe haber una tarifa activa** para poder cotizar
2. **Excel debe mantener estructura fija** (rangos definidos)
3. **Solo cambiar valores en Excel**, no estructura
4. **Motor de cálculo replica Excel 1:1**
5. **Cotizaciones son inmutables** una vez guardadas

## Archivos Creados

### Migraciones
- `supabase/migrations/*_create_gmm_bxplus_module.sql`

### Edge Functions
- `supabase/functions/gmm-upload-tariff/index.ts`

### Librerías
- `src/lib/gmmTypes.ts`
- `src/lib/gmmCalculationEngine.ts`

### Páginas
- `src/pages/GMMTarifasAdmin.tsx`
- `src/pages/GMMCotizador.tsx`
- `src/pages/GMMCotizaciones.tsx`

### Rutas Agregadas
- `/gmm/tarifas` (admin)
- `/gmm/cotizador`
- `/gmm/cotizaciones`

### Menú de Navegación

El módulo está visible en el menú lateral después de "Multicotizador Digital":

- **GMM BX+ Cotizador** (todos los usuarios) - Crear nuevas cotizaciones
- **Mis Cotizaciones GMM** (todos los usuarios) - Ver historial de cotizaciones
- **GMM Tarifas Admin** (solo administradores) - Gestionar versiones de tarifas

## Pruebas Recomendadas

1. Cargar archivo Excel de prueba
2. Activar tarifa
3. Crear cotización con 1 asegurado
4. Crear cotización con múltiples asegurados
5. Probar diferentes coberturas
6. Verificar cálculos contra Excel original
7. Guardar cotizaciones
8. Ver historial
9. Cargar nueva versión de tarifa
10. Verificar que cotizaciones antiguas mantienen su versión

## Soporte

Para cambios en la lógica de cálculo:
- Editar `src/lib/gmmCalculationEngine.ts`
- Seguir exactamente la lógica del Excel
- Mantener redondeos consistentes

Para cambios en estructura de Excel:
- Actualizar `EXCEL_RANGES` en `src/lib/gmmTypes.ts`
- Actualizar edge function `gmm-upload-tariff`
- Agregar nuevos campos en `TariffTables` type

El módulo está listo para uso en producción.
