# Módulo "Mis Pólizas" - Documentación Completa

## Descripción General

El módulo "Mis Pólizas" permite a los usuarios consultar sus pólizas vigentes desde SICAS con acceso al Centro Digital para ver y descargar documentos asociados. Implementa permisos por rol con arquitectura de base de datos espejo para máximo rendimiento.

---

## Características Principales

### 1. Consulta de Pólizas
- Lee desde tabla espejo `sicas_documents` (rápido, sin latencia de SICAS)
- Filtros avanzados por: estatus, fechas, aseguradora, ramo, búsqueda general
- Paginación server-side (50 registros por página)
- Ordenamiento configurable

### 2. Centro Digital
- Acceso a archivos de pólizas directamente desde la interfaz
- Modal con lista de archivos disponibles
- Descarga y preview de documentos
- Cache de 10 minutos para archivos

### 3. Permisos por Rol
- **Administrador**: Ve TODAS las pólizas de todos los usuarios/oficinas
- **Gerente**: Solo pólizas de SU oficina
- **Empleado**: Solo pólizas de SU oficina
- **Agente**: Solo SUS pólizas (mapeadas por vendedor SICAS)

### 4. Sincronización
- Solo Admin y Gerente pueden sincronizar
- Usa la misma función de sincronización de "Mi Producción SICAS"
- Actualiza la tabla espejo desde SICAS

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND                               │
│  /mis-polizas (MisPolizas.tsx)                              │
│    - Tabla con filtros                                       │
│    - Modal Centro Digital                                    │
│    - Estadísticas                                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─► Edge Function: sicas-polizas-list
                   │   - Lee de sicas_documents
                   │   - Aplica filtros RLS
                   │   - Paginación
                   │
                   ├─► Edge Function: sicas-centro-digital-files
                   │   - Consulta Centro Digital SICAS
                   │   - Cache en sicas_centro_digital_cache
                   │   - Verifica permisos
                   │
                   └─► Edge Function: sicas-sync-polizas-vigentes
                       - Sincroniza desde SICAS
                       - Guarda en sicas_documents
                       - Mapea vendedores → usuarios
```

---

## Base de Datos

### Tablas Creadas

#### 1. `sicas_user_mapping`
Mapea usuarios de la app con IDs de SICAS (vendedor, oficina, gerencia).

**Campos principales:**
- `usuario_id` (uuid) - ID del usuario en la app
- `sicas_id_vendedor` (text) - ID del vendedor en SICAS
- `sicas_nombre_vendedor` (text) - Nombre del vendedor en SICAS
- `sicas_id_oficina` (text) - ID de la oficina en SICAS
- `sicas_nombre_oficina` (text) - Nombre de la oficina
- `es_mapeo_principal` (boolean) - Si es el mapeo principal del usuario
- `activo` (boolean) - Si el mapeo está activo

**RLS:**
- Usuarios ven su propio mapeo
- Admin y Gerente pueden ver todos los mapeos
- Solo Admin puede modificar

#### 2. `sicas_centro_digital_cache`
Cache de archivos del Centro Digital por documento.

**Campos principales:**
- `id_docto` (text) - ID del documento en SICAS
- `id_cont` (text) - ID del contrato (opcional)
- `identity_type` (text) - Tipo de identidad (H02 para pólizas)
- `archivos` (jsonb) - Array de archivos
- `total_archivos` (integer) - Cantidad de archivos
- `tiene_archivos` (boolean) - Si tiene archivos disponibles
- `expires_at` (timestamptz) - Fecha de expiración del cache (10 min)

**RLS:**
- Admin ve todo
- Usuarios ven solo archivos de sus documentos
- Gerentes ven archivos de documentos de su oficina

#### 3. `sicas_config`
Configuración global de SICAS (KeyCodes, parámetros).

**Campos principales:**
- `keycode_polizas_vigentes` (text) - KeyCode para consultar pólizas vigentes
- `keycode_centro_digital` (text) - KeyCode para Centro Digital
- `items_per_page_default` (integer) - Items por página por defecto (100)
- `cache_ttl_minutes` (integer) - TTL del cache en minutos (10)
- `debug_mode` (boolean) - Modo debug

**RLS:**
- Todos pueden leer
- Solo Admin puede modificar

---

## Edge Functions

### 1. `sicas-polizas-list`
**Ruta**: `/functions/v1/sicas-polizas-list`

**Input:**
```json
{
  "filters": {
    "searchText": "string",
    "estatus": "vigente" | "no_vigente" | "todas",
    "fecha_desde": "YYYY-MM-DD",
    "fecha_hasta": "YYYY-MM-DD",
    "tipo_fecha": "vigencia" | "captura" | "emision",
    "aseguradora": "string",
    "ramo": "string",
    "subramo": "string",
    "sort_by": "vigencia_desde" | "vigencia_hasta" | "prima_neta",
    "sort_order": "asc" | "desc"
  },
  "page": 1,
  "items_per_page": 50
}
```

**Output:**
```json
{
  "success": true,
  "polizas": [
    {
      "id": "uuid",
      "id_docto": "string",
      "poliza": "string",
      "cliente": "string",
      "compania": "string",
      "ramo": "string",
      "vigencia_desde": "ISO date",
      "vigencia_hasta": "ISO date",
      "prima_neta": 0,
      "estatus": "string",
      "es_vigente": true
    }
  ],
  "pagination": {
    "page": 1,
    "items_per_page": 50,
    "total_records": 100,
    "total_pages": 2,
    "has_next_page": true,
    "has_prev_page": false
  },
  "metadata": {
    "source": "database",
    "cached_at": "ISO date"
  }
}
```

**Permisos aplicados automáticamente:**
- Admin: sin filtros
- Gerente/Empleado: solo su oficina
- Agente: solo sus pólizas

### 2. `sicas-centro-digital-files`
**Ruta**: `/functions/v1/sicas-centro-digital-files`

**Input:**
```json
{
  "id_docto": "string (required)",
  "id_cont": "string (optional)",
  "identity_type": "H02",
  "force_refresh": false
}
```

**Output:**
```json
{
  "success": true,
  "id_docto": "string",
  "identity_type": "H02",
  "archivos": [
    {
      "id": "string",
      "nombre_archivo": "string",
      "extension": "pdf",
      "tamanio_bytes": 1024,
      "tamanio_legible": "1 KB",
      "fecha_subida": "ISO date",
      "es_descargable": true
    }
  ],
  "total_archivos": 1,
  "tiene_archivos": true,
  "source": "cache" | "sicas"
}
```

**Verificación de permisos:**
- Verifica que el usuario pueda ver el documento
- Admin: acceso total
- Gerente: solo documentos de su oficina
- Agente: solo sus documentos

### 3. `sicas-sync-polizas-vigentes`
**Ruta**: `/functions/v1/sicas-sync-polizas-vigentes`

**Input:** Ninguno (solo requiere autenticación)

**Output:**
```json
{
  "success": true,
  "message": "Sincronización completada",
  "stats": {
    "records_synced": 150,
    "run_id": "uuid"
  }
}
```

**Qué hace:**
1. Conecta a SICAS SOAP API
2. Consulta pólizas vigentes (últimos 6 meses a +6 meses)
3. Mapea vendedores a usuarios
4. Guarda/actualiza en `sicas_documents`
5. Registra auditoría

---

## Frontend (UI)

### Página: `/mis-polizas`

**Componentes principales:**

1. **Header**
   - Título con icono
   - Botón "Sincronizar" (solo Admin/Gerente)
   - Mensajes de éxito/error

2. **Estadísticas (Cards)**
   - Total Pólizas
   - Prima Neta Total
   - Importe Total
   - Próximas a Vencer (30 días)

3. **Filtros (Colapsables)**
   - Búsqueda general (póliza, cliente, ID)
   - Estatus (Vigentes / No Vigentes / Todas)
   - Aseguradora
   - Ramo
   - Fecha Desde / Fecha Hasta
   - Botones: Limpiar / Buscar

4. **Tabla de Pólizas**
   - Columnas: Póliza, Cliente, Aseguradora/Ramo, Vigencia, Prima Neta, Estatus, Acciones
   - Badge de estatus con colores:
     - Verde: Vigente (más de 30 días)
     - Naranja: Por vencer (0-30 días)
     - Rojo: Vencida
   - Botón "Centro Digital" por fila

5. **Paginación**
   - Anterior / Siguiente
   - Indicador de página actual / total

6. **Modal Centro Digital**
   - Lista de archivos del documento
   - Botones: Ver / Descargar
   - Información: nombre, tamaño, extensión
   - Estado de carga

---

## Tipos TypeScript

### Interfaces Principales

Ubicación: `src/lib/misPolizasTypes.ts`

```typescript
interface SicasPoliza {
  id: string;
  id_docto: string;
  poliza: string;
  compania: string;
  ramo: string;
  cliente: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  prima_neta: number;
  importe: number;
  estatus: string;
  es_vigente: boolean;
  vend_nombre: string;
  // ... más campos
}

interface SicasArchivoCentroDigital {
  id: string;
  nombre_archivo: string;
  extension: string;
  tamanio_bytes: number;
  tamanio_legible: string;
  fecha_subida: string;
  es_descargable: boolean;
}

interface SicasPolizasFilters {
  searchText?: string;
  estatus?: 'vigente' | 'no_vigente' | 'todas';
  fecha_desde?: string;
  fecha_hasta?: string;
  aseguradora?: string;
  ramo?: string;
  // ... más filtros
}
```

---

## Configuración Requerida

### Variables de Entorno (Supabase)

Ya están configuradas automáticamente en Supabase:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `SICAS_USERNAME` | `j1r0%25$` | Usuario SICAS |
| `SICAS_PASSWORD` | `$45oc14d05$` | Contraseña SICAS |
| `SICAS_REST_API_URL` | `https://security-services.sicasonline.info/api` | URL API REST |
| `SICAS_SOAP_ENDPOINT` | `https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx` | URL SOAP |

No necesitas configurarlas manualmente.

---

## Cómo Usar el Módulo

### Para Administradores

1. **Acceder al módulo**
   - Navega a: `/mis-polizas`
   - Verás TODAS las pólizas de TODOS los usuarios

2. **Sincronizar desde SICAS**
   - Haz clic en "Sincronizar"
   - Espera 10-30 segundos
   - Se actualizará la tabla con datos frescos de SICAS

3. **Filtrar pólizas**
   - Expande "Filtros"
   - Busca por texto, aseguradora, ramo, fechas
   - Haz clic en "Buscar"

4. **Ver Centro Digital**
   - Haz clic en "Centro Digital" en cualquier fila
   - Se abrirá modal con archivos disponibles
   - Puedes ver o descargar archivos

### Para Gerentes

1. **Acceder al módulo**
   - Navega a: `/mis-polizas`
   - Verás solo pólizas de TU oficina

2. **Sincronizar**
   - Mismo proceso que Admin
   - Solo sincronizará pólizas de tu oficina

3. **Filtros limitados**
   - No puedes filtrar por oficina (solo ves la tuya)
   - Resto de filtros funcionan igual

### Para Agentes

1. **Acceder al módulo**
   - Navega a: `/mis-polizas`
   - Verás solo TUS pólizas (mapeadas por vendedor SICAS)

2. **Sin sincronización**
   - No tienes botón "Sincronizar"
   - Espera a que Admin/Gerente sincronice

3. **Consulta y Centro Digital**
   - Usa filtros normalmente
   - Accede al Centro Digital de tus pólizas

---

## Mapeo Usuario ↔ Vendedor SICAS

Para que los agentes vean sus pólizas, deben tener un mapeo en `sicas_user_mapping`.

### Opción 1: Mapeo Manual (SQL)

```sql
INSERT INTO sicas_user_mapping (
  usuario_id,
  sicas_id_vendedor,
  sicas_nombre_vendedor,
  es_mapeo_principal,
  activo
)
VALUES (
  'uuid-del-usuario',
  'ID_VENDEDOR_EN_SICAS',
  'NOMBRE_EN_SICAS',
  true,
  true
);
```

### Opción 2: Mapeo Automático

El sistema ya tiene una tabla `sicas_mapeo_vendedores` que mapea vendedores a usuarios. Los mapeos se crean automáticamente durante la sincronización basándose en:

1. Coincidencia de nombre (`vend_nombre` = `sicas_nombre_vendedor`)
2. O asignación manual previa

---

## Troubleshooting

### "No hay pólizas disponibles"

**Causas posibles:**
1. No se ha sincronizado desde SICAS
   - **Solución**: Admin/Gerente debe hacer clic en "Sincronizar"

2. Usuario agente sin mapeo a vendedor SICAS
   - **Solución**: Crear mapeo en `sicas_user_mapping`

3. No hay pólizas en el rango de fechas sincronizado
   - **Solución**: Verificar que existan pólizas vigentes en SICAS

### "Error al cargar Centro Digital"

**Causas posibles:**
1. Credenciales SICAS incorrectas
   - **Solución**: Verificar variables de entorno

2. Centro Digital no disponible para ese documento
   - **Solución**: Normal, algunos documentos no tienen archivos

3. Timeout en SICAS
   - **Solución**: Intentar nuevamente en unos minutos

### "Usuario no autenticado"

**Causa**: Token de sesión expirado

**Solución**: Cerrar sesión y volver a iniciar

---

## Monitoreo y Diagnóstico

### Ver últimas sincronizaciones

```sql
SELECT *
FROM sicas_sync_runs
WHERE module = 'documents'
ORDER BY created_at DESC
LIMIT 10;
```

### Ver mapeos de usuarios

```sql
SELECT
  u.email,
  u.nombre,
  u.rol,
  sum.sicas_nombre_vendedor,
  sum.sicas_nombre_oficina,
  sum.es_mapeo_principal,
  sum.activo
FROM sicas_user_mapping sum
JOIN usuarios u ON u.id = sum.usuario_id
ORDER BY u.email;
```

### Ver pólizas por usuario

```sql
SELECT
  COUNT(*) as total_polizas,
  vend_nombre,
  usuario_id
FROM sicas_documents
GROUP BY vend_nombre, usuario_id
ORDER BY total_polizas DESC;
```

### Limpiar cache de Centro Digital

```sql
-- Manual
DELETE FROM sicas_centro_digital_cache
WHERE expires_at < now();

-- O usar la función
SELECT cleanup_expired_centro_digital_cache();
```

---

## Permisos y Seguridad

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado con políticas específicas:

**sicas_documents:**
- Admin: SELECT all
- Gerente: SELECT where oficina_id = user.oficina_id
- Agente: SELECT where usuario_id = auth.uid()

**sicas_centro_digital_cache:**
- Basado en permisos del documento relacionado

**sicas_config:**
- Todos: SELECT
- Solo Admin: UPDATE

### Service Role

Las Edge Functions usan `SUPABASE_SERVICE_ROLE_KEY` para:
- Bypasear RLS temporalmente durante operaciones de servicio
- Aplicar filtros manualmente según rol del usuario
- Garantizar que cada usuario vea solo lo permitido

---

## Próximas Mejoras (Opcionales)

1. **Descarga masiva de archivos**
   - Descargar todos los archivos de una póliza en ZIP

2. **Notificaciones de vencimiento**
   - Email/WhatsApp cuando una póliza esté por vencer (30, 15, 7 días)

3. **Sincronización automática**
   - Cron job cada 6 horas

4. **Filtros avanzados**
   - Por vendedor (Admin)
   - Por tipo de póliza
   - Por prima (rangos)

5. **Exportar a Excel**
   - Exportar tabla filtrada

6. **Vista de detalle de póliza**
   - Página completa con toda la info del documento
   - Historial de endosos
   - Historial de pagos

---

## Archivos Creados

### Base de Datos
- `supabase/migrations/create_mis_polizas_module_fixed.sql`

### Edge Functions
- `supabase/functions/sicas-polizas-list/index.ts`
- `supabase/functions/sicas-centro-digital-files/index.ts`

### Frontend
- `src/lib/misPolizasTypes.ts` (tipos TypeScript)
- `src/pages/MisPolizas.tsx` (página principal)
- `src/App.tsx` (ruta agregada)

### Documentación
- `MIS_POLIZAS_DOCUMENTACION.md` (este archivo)

---

## Contacto y Soporte

Si encuentras problemas o necesitas ayuda:

1. Revisa los logs de las Edge Functions:
   ```bash
   npx supabase functions logs sicas-polizas-list --project-ref qhwvuuyjhcennqccgvse
   npx supabase functions logs sicas-centro-digital-files --project-ref qhwvuuyjhcennqccgvse
   ```

2. Revisa la consola del navegador (F12) para errores de frontend

3. Consulta esta documentación para casos comunes

---

**Versión**: 1.0
**Fecha**: 2026-02-17
**Estado**: Producción
