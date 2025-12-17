# Sistema de Producción por Vendedor

## Descripción General

El sistema de **Producción por Vendedor** agrega una nueva sección al módulo de Producción que permite visualizar y analizar los datos de producción agrupados por vendedor (VendNombre del Google Sheets), independiente de la vista actual por oficina.

Este sistema incluye un **mapeo centralizado de vendedores** que relaciona cada VendNombre del Excel con un usuario de la plataforma MOVI, y este mismo mapeo es compartido con el módulo de **Comisiones**.

---

## Características Principales

### 1. Nueva Sección: Producción por Vendedor

#### Ubicación
- **Ruta**: `/produccion/por-vendedor`
- **Menú**: "Producción por Vendedor" (visible para Administrador y Gerente)
- **Icono**: Users

#### Funcionalidad
- Agrupa todos los registros del Google Sheets por **VendNombre** (campo `agente_nombre`)
- Muestra métricas agregadas por vendedor:
  - Importe Pesos total
  - Prima Convenio total
  - Prima Ponderada total
  - Bono total
  - Número de registros
- Indica si el vendedor está **mapeado** a un usuario MOVI
- Muestra el nombre del usuario MOVI asignado
- Muestra la oficina del usuario MOVI
- Permite expandir cada vendedor para ver el detalle de sus registros

#### Filtros Disponibles
- Búsqueda por nombre de vendedor o usuario MOVI
- Estado de mapeo:
  - Todos
  - Asignados (vendedores que tienen usuario MOVI asignado)
  - Sin asignar (vendedores sin usuario MOVI)
- Fecha desde / hasta
- Ramo
- Aseguradora

#### Exportación
- Exportar a Excel con todos los registros de todos los vendedores
- Incluye información de mapeo en el export

---

### 2. Mapeo Centralizado de Vendedores

El mapeo de vendedores permite relacionar cada **VendNombre** del Google Sheets con un **usuario de la plataforma MOVI**.

#### Ubicación de Configuración
- **Ruta**: `/produccion/configuracion`
- **Sección**: "Mapeo de Agentes"

#### Funcionamiento

##### Mapeo Automático
El sistema intenta hacer el mapeo automáticamente:
1. Normaliza el VendNombre (quita acentos, convierte a minúsculas, elimina espacios dobles)
2. Busca coincidencia exacta en `usuarios.nombre_completo` (normalizado)
3. Si coincide, marca el mapeo como **Auto**

##### Mapeo Manual
El administrador puede:
1. **Cargar vendedores** desde el Google Sheets (botón "Cargar")
2. Ver la lista de vendedores únicos con su estado de mapeo
3. Asignar manualmente un usuario MOVI a cada vendedor usando un dropdown
4. Editar mapeos automáticos si son incorrectos
5. Eliminar mapeos (seleccionar "-- Sin asignar --")

##### Estadísticas
- Total de vendedores
- Vendedores asignados
- Vendedores sin asignar
- Número de registros por vendedor

##### Filtros de Configuración
- Búsqueda por nombre de vendedor
- Estado de mapeo (Todos / Asignados / Sin asignar)

---

### 3. Integración con Comisiones

El mapeo de vendedores NO es exclusivo de Producción. El mismo sistema se usa en el módulo de **Comisiones** para relacionar vendedores del Excel cargado con usuarios MOVI.

#### Tabla Compartida: `vendor_mappings`

Estructura:
```sql
- id (UUID)
- source_type ('email' | 'name')
- source_value (email o nombre normalizado)
- movi_user_id (FK a usuarios)
- status ('active' | 'inactive')
- created_by, updated_by
- source_raw_examples (JSONB con ejemplos originales)
- created_at, updated_at
```

#### Flujo Unificado
1. Al cargar datos de Producción, se consulta `vendor_mappings` para resolver VendNombre → usuario
2. Al cargar Excel en Comisiones, se consulta la misma tabla para resolver vendedor → usuario
3. Los mapeos manuales creados en cualquier módulo están disponibles en el otro

---

## Arquitectura Técnica

### Componentes Creados

#### 1. `ProduccionPorVendedor.tsx`
Página principal que:
- Obtiene datos del Google Sheets (edge function `fetch-production-sheets`)
- Agrupa registros por VendNombre usando `groupProductionByVendor()`
- Resuelve mapeos automáticamente con `findVendorMapping()`
- Muestra KPIs, gráficos y lista expandible de vendedores
- Exporta a Excel

#### 2. `produccionVendorUtils.ts`
Utilidades de negocio:
- `normalizeVendorName()`: Normaliza nombres (quitar acentos, minúsculas, etc.)
- `findVendorMapping()`: Busca mapeo automático para un VendNombre
- `groupProductionByVendor()`: Agrupa registros por vendedor y calcula totales
- `getUniqueVendorsFromProduction()`: Obtiene lista única de vendedores con estado de mapeo
- `createOrUpdateVendorMapping()`: Crea o actualiza mapeo manual
- `deleteVendorMapping()`: Elimina mapeo
- `getVendorMappingStats()`: Calcula estadísticas de mapeo

#### 3. Actualización de `ProduccionConfiguracion.tsx`
Agrega tercera sección:
- Carga vendedores desde Google Sheets
- Muestra lista con búsqueda y filtros
- Permite asignación manual con dropdown de usuarios
- Guarda automáticamente al cambiar (sin botón "Guardar")
- Muestra estadísticas en tiempo real

#### 4. Actualización de `Layout.tsx`
Menú de navegación:
- Separa "Producción por Oficina" y "Producción por Vendedor"
- Ambos visibles para Administrador y Gerente
- Iconos: Building (Oficina), Users (Vendedor)

#### 5. Actualización de `App.tsx`
Nueva ruta:
```tsx
<Route
  path="/produccion/por-vendedor"
  element={
    <ProtectedRoute requireAdmin={false} requireGerente>
      <Layout>
        <ProduccionPorVendedor />
      </Layout>
    </ProtectedRoute>
  }
/>
```

---

## Flujo de Datos

### Carga de Producción por Vendedor

```
1. Usuario navega a /produccion/por-vendedor
   ↓
2. Se llama al edge function fetch-production-sheets
   ↓
3. Se obtienen todos los registros del Google Sheets
   ↓
4. Se agrupan registros por VendNombre
   ↓
5. Para cada VendNombre:
   - Se normaliza el nombre
   - Se busca mapeo en vendor_mappings
   - Si no existe, se busca coincidencia directa en usuarios
   ↓
6. Se calculan totales por vendedor
   ↓
7. Se muestran en UI con estado de mapeo
```

### Configuración de Mapeo

```
1. Admin navega a /produccion/configuracion
   ↓
2. Hace clic en "Cargar" en sección "Mapeo de Agentes"
   ↓
3. Se llama a getUniqueVendorsFromProduction()
   ↓
4. Se obtienen vendedores únicos del Google Sheets
   ↓
5. Para cada vendedor se resuelve su mapeo actual
   ↓
6. Se muestra lista con estado (Auto/Manual/Sin asignar)
   ↓
7. Admin selecciona usuario en dropdown
   ↓
8. Se guarda en vendor_mappings (upsert por source_type + source_value)
   ↓
9. El mapeo está disponible para Producción y Comisiones
```

---

## Ventajas del Sistema

### 1. Vista Completa de Vendedores
- Permite ver producción de cada vendedor independientemente de su oficina
- Identifica vendedores de alto rendimiento
- Detecta vendedores no reconocidos por el sistema

### 2. Mapeo Centralizado
- Un solo lugar para configurar relaciones vendedor → usuario
- Reduce duplicación de datos
- Facilita mantenimiento
- Reutilizable en múltiples módulos

### 3. Detección Automática
- Menos trabajo manual para el administrador
- Mapeos automáticos para nombres que coinciden exactamente
- Solo se requiere intervención manual para casos ambiguos

### 4. Consistencia entre Módulos
- Producción y Comisiones usan el mismo mapeo
- Evita inconsistencias
- Datos unificados

### 5. Trazabilidad
- Cada mapeo tiene origen (auto/manual)
- Se registra quién creó/actualizó el mapeo
- Historial de cambios

---

## Casos de Uso

### Caso 1: Revisar Producción de un Vendedor Específico
1. Ir a "Producción por Vendedor"
2. Buscar el nombre del vendedor
3. Expandir para ver detalles
4. Ver métricas, registros y oficina asignada

### Caso 2: Detectar Vendedores Sin Asignar
1. Ir a "Producción por Vendedor"
2. Filtrar por "Sin asignar"
3. Ver lista de vendedores no reconocidos
4. Ir a Configuración → Mapeo de Agentes
5. Asignar usuarios manualmente

### Caso 3: Corregir Mapeo Automático Incorrecto
1. Ir a "Producción → Configuración"
2. Sección "Mapeo de Agentes" → Cargar
3. Buscar el vendedor
4. Cambiar el usuario asignado en el dropdown
5. El sistema guarda automáticamente

### Caso 4: Exportar Producción por Vendedor
1. Ir a "Producción por Vendedor"
2. Aplicar filtros deseados
3. Clic en "Exportar"
4. Se descarga Excel con:
   - VendNombre
   - Usuario MOVI asignado
   - Oficina
   - Estado de mapeo
   - Todos los registros detallados

---

## Validaciones y Reglas de Negocio

### 1. Normalización de Nombres
- Se quitan acentos (á → a, é → e, etc.)
- Se convierte a minúsculas
- Se eliminan espacios dobles
- Se hace trim de espacios al inicio y final

### 2. Unicidad de Mapeos
- Un VendNombre normalizado solo puede tener UN usuario asignado
- Si se intenta crear mapeo duplicado, se actualiza el existente

### 3. Mapeo Opcional
- No es obligatorio mapear todos los vendedores
- Vendedores sin mapeo se muestran como "Sin asignar"
- Datos de producción se muestran aunque no haya mapeo

### 4. Permisos
- Solo Administradores pueden configurar mapeos
- Administradores y Gerentes pueden ver producción por vendedor

---

## Próximos Pasos y Mejoras Futuras

### Posibles Mejoras
1. **Notificaciones de vendedores nuevos**: Alertar cuando aparezcan vendedores no reconocidos
2. **Sugerencias inteligentes**: Usar algoritmos de similitud de nombres para sugerir matches
3. **Historial de cambios**: Log detallado de cambios en mapeos
4. **Validación de duplicados**: Detectar si dos VendNombre diferentes apuntan al mismo usuario
5. **Importación masiva**: Permitir cargar mapeos desde CSV/Excel
6. **API REST**: Exponer endpoints para integrar con otros sistemas

---

## Soporte y Troubleshooting

### Problema: Vendedores no aparecen
**Solución**: Verificar que el Google Sheets tenga la columna `VendNombre` correctamente configurada

### Problema: Mapeo automático no funciona
**Solución**:
- Verificar que el nombre en el Sheet coincida EXACTAMENTE con `nombre_completo` en usuarios
- Usar mapeo manual si hay variaciones en el nombre

### Problema: Mapeo no se guarda
**Solución**:
- Verificar permisos (solo admin puede guardar)
- Revisar console del navegador (F12) para errores
- Verificar RLS policies en `vendor_mappings`

### Problema: Datos desactualizados
**Solución**: Los datos se consultan en tiempo real del Google Sheets. Si no se ven cambios recientes, verificar que el Sheet esté actualizado.

---

## Documentos Relacionados

- `SISTEMA_MAPEO_VENDEDORES.md`: Detalles técnicos del sistema de mapeo en Comisiones
- `SISTEMA_GOOGLE_SHEETS_PRODUCCION.md`: Configuración del Google Sheets
- `supabase/migrations/20251215175729_create_vendor_mapping_system.sql`: Migración de BD

---

**Desarrollado**: Diciembre 2024
**Módulos afectados**: Producción, Comisiones
**Versión**: 1.0
