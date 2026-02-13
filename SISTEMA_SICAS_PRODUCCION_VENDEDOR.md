# Sistema de Producción SICAS para Vendedores

## Resumen

Se ha implementado un sistema completo de sincronización y visualización de datos SICAS para vendedores individuales, siguiendo las mejores prácticas de arquitectura:

1. **Servicio de sincronización** (evita consultas directas al SOAP lento)
2. **Tablas espejo en MOVI** (datos pre-cargados y optimizados)
3. **UI responsive con tabs** (pólizas, cobranza, renovaciones, emisiones)
4. **Filtros avanzados** y exportación a Excel
5. **Tareas automáticas** de renovación con notificaciones

---

## 1. Arquitectura Implementada

### Base de Datos (Ya Existentes)

Las siguientes tablas y vistas ya existían en el sistema:

- `sicas_polizas_vigentes` - Pólizas activas sincronizadas desde SICAS
- `sicas_cobranza_pendiente` - Cobranza pendiente por vendedor
- `sicas_renovaciones_proximas` - Vista de pólizas próximas a vencer
- `sicas_emitidas_mes_actual` - Vista de emisiones del mes en curso
- `sicas_mapeo_vendedor_usuario` - Mapeo entre ID SICAS y usuarios MOVI

### Edge Functions Creadas

#### 1. `sicas-sync-cobranza`
- Sincroniza cobranza pendiente desde SICAS
- Llama al reporte SOAP `HAPPDATAL_D004`
- Parsea XML y almacena en `sicas_cobranza_pendiente`
- Ejecutable manual o por cron

#### 2. `sicas-sync-manual`
- Orquestador de sincronizaciones
- Permite sincronizar: `polizas`, `cobranza`, o `completa`
- Llama a otras edge functions según el tipo solicitado
- Retorna estadísticas de registros sincronizados

#### 3. `create-renewal-tasks`
- Crea tareas automáticas en CRM para renovaciones próximas
- Envía notificaciones en hitos clave: 30, 15, 7 días
- Evita duplicados verificando tareas existentes
- Asigna prioridad según días de vencimiento

**Cron Job:** Ejecuta diariamente a las 7:00 AM

---

## 2. Nueva Interfaz: Mi Producción SICAS

### Ruta
`/mi-produccion-sicas`

### Características

#### KPIs Principales
- Pólizas Vigentes (conteo)
- Cobranza Pendiente (suma total)
- Por Renovar (conteo)
- Emisiones del Mes (suma total)

#### Tabs Implementados

##### 1. Pólizas Vigentes
- Lista completa de pólizas activas
- Información: póliza, aseguradora, ramo, contratante, vigencia, prima
- Expandible para ver detalles completos
- Botón "Ver Centro Digital" (preparado para integración futura)

##### 2. Cobranza Pendiente
- Lista de cobranzas no pagadas
- Muestra: póliza, cliente, importe, días vencidos, fecha límite
- Resalta cobranzas vencidas en rojo

##### 3. Por Renovar
- Pólizas próximas a vencer
- Selector de ventana: 7, 15, 30, 45, 60 días
- Prioridad visual: alta (rojo), media (naranja), baja (amarillo)
- Información: días para vencer, cliente, aseguradora, prima

##### 4. Emitidas del Mes
- Pólizas emitidas en el mes actual
- Fecha de emisión, cliente, aseguradora, ramo, prima

### Filtros Disponibles

En todos los tabs:
- **Buscar:** Por cliente o número de póliza
- **Aseguradora:** Dropdown con todas las aseguradoras
- **Ramo:** Dropdown con todos los ramos

En "Por Renovar":
- **Días para vencimiento:** 7, 15, 30, 45, 60 días

### Exportación a Excel

Cada tab tiene su botón de exportación que genera un archivo Excel con:
- Nombre: `[tipo]_[fecha].xlsx`
- Todos los datos filtrados actualmente visibles
- Formato estándar con encabezados

### Sincronización Manual

Botón "Sincronizar" en la cabecera:
- Llama a `sicas-sync-manual` con `syncType: 'completa'`
- Actualiza todas las tablas espejo
- Muestra spinner durante el proceso
- Recarga datos automáticamente al terminar

---

## 3. Sistema de Tareas Automáticas

### Flujo de Trabajo

1. **Detección (Cron diario 7:00 AM)**
   - Escanea `sicas_renovaciones_proximas`
   - Filtra pólizas con vencimiento ≤ 60 días

2. **Creación de Tareas**
   - Verifica mapeo vendedor → usuario MOVI
   - Comprueba si ya existe tarea similar
   - Crea tarea en `crm_tareas` con:
     - Título: "Renovación: [cliente] - [póliza]"
     - Descripción detallada con datos de la póliza
     - Prioridad: alta/media/baja según días
     - Categoría: `renovacion`
     - Estado: `pendiente`

3. **Notificaciones Automáticas**
   - Se envían en hitos: **30, 15, 7 días**
   - Multi-canal: campana, email, WhatsApp
   - Incluye:
     - Datos de la póliza
     - Días para vencimiento
     - Enlace directo a tareas CRM
     - Información del cliente

### Prioridades

- **Alta:** 1-7 días para vencer
- **Media:** 8-30 días para vencer
- **Baja:** 31-60 días para vencer

---

## 4. Integración con Sistema Existente

### Mapeo de Usuarios

El sistema utiliza `sicas_mapeo_vendedor_usuario` para vincular:
- `id_sicas_vendedor` (ID en SICAS) ↔ `movi_user_id` (UUID en MOVI)

Solo se muestran datos del vendedor mapeado al usuario actual.

### Permisos RLS

Las tablas SICAS tienen RLS habilitado que permite:
- **Agentes:** Ver solo sus propios datos (a través del mapeo)
- **Gerentes:** Ver datos de su oficina
- **Admins:** Ver todos los datos

### Notificaciones Transaccionales

Las notificaciones de renovación utilizan el sistema unificado:
- Plantilla: `renovacion_proxima`
- Variables dinámicas: nombre, póliza, cliente, días, fecha, prima, URL
- Registradas en `notification_logs`

---

## 5. Flujo Completo de Usuario

### Para Agentes

1. Usuario inicia sesión
2. Navega a "Mi Producción SICAS" (`/mi-produccion-sicas`)
3. Ve sus KPIs personales instantáneamente
4. Explora tabs según necesidad:
   - **Pólizas Vigentes:** Consulta cartera actual
   - **Cobranza:** Identifica pagos pendientes
   - **Por Renovar:** Planifica seguimientos
   - **Emitidas:** Revisa producción del mes
5. Aplica filtros para encontrar casos específicos
6. Exporta datos a Excel para reportes propios
7. Recibe notificaciones automáticas de renovaciones
8. Abre CRM desde notificación → Ve tarea pre-creada
9. Si necesita datos frescos, presiona "Sincronizar"

### Para Gerentes/Admins

Mismas capacidades + ver datos de otros vendedores desde:
- `/produccion/por-vendedor` (vista consolidada de oficina)
- `/produccion/total` (vista global)

---

## 6. Ventajas de Esta Arquitectura

### Performance
- **Sin timeouts:** Datos pre-cargados en DB local
- **Queries rápidas:** Índices optimizados
- **Paginación eficiente:** No carga todo el universo

### UX
- **Carga instantánea:** No esperas del SOAP
- **Filtros en cliente:** Respuesta inmediata
- **Navegación fluida:** Tabs sin recarga

### Mantenibilidad
- **Código modular:** Edge functions independientes
- **Fácil extensión:** Agregar nuevo reporte = nueva función
- **Debugging simple:** Logs claros en cada paso

### Automatización
- **Proactivo:** Tareas creadas antes de que venza
- **Multi-canal:** Vendedor notificado donde esté
- **Sin intervención manual:** Sistema autónomo

---

## 7. Mejoras Futuras Sugeridas

### Centro Digital (Modal "Ver Centro Digital")

Actualmente el botón está preparado pero no implementado. Para completarlo:

1. Crear edge function `sicas-get-centro-digital`:
   ```typescript
   // Input: id_documento, tipo_documento
   // SOAP: CDIGITAL (consulta carpetas/documentos)
   // Output: árbol de carpetas + archivos
   ```

2. Crear modal `CentroDigitalModal.tsx`:
   - Tree view de carpetas
   - Lista de documentos
   - Botones descargar/ver
   - Preview de PDFs

3. Conectar en `MiProduccionSICAS.tsx`:
   - Al expandir póliza → Botón activo
   - Click → Abre modal con documentos

### Otros Reportes SICAS

Si hay más reportes disponibles en SICAS:
- Siniestros en trámite
- Comisiones pagadas
- Producción histórica

Patrón a seguir:
1. Crear tabla espejo
2. Crear edge function sync
3. Agregar a `sicas-sync-manual`
4. Agregar tab en UI

### Análisis y Gráficas

Agregar tab "Análisis" con:
- Gráfica de producción por mes
- Top 5 aseguradoras
- Distribución por ramo
- Tendencia de renovaciones

---

## 8. Troubleshooting

### "Error al cargar vendedores"

**Causa:** Usuario no tiene mapeo en `sicas_mapeo_vendedor_usuario`

**Solución:**
1. Admin va a `/mapeo-vendedores`
2. Asigna ID SICAS al usuario
3. Usuario recarga página

### "Sin datos en tabs"

**Causa:** Falta sincronización inicial o datos vacíos en SICAS

**Solución:**
1. Presionar "Sincronizar" en la UI
2. O ejecutar manualmente desde Admin:
   ```bash
   curl -X POST \
     https://[proyecto].supabase.co/functions/v1/sicas-sync-manual \
     -H "Authorization: Bearer [token]" \
     -d '{"syncType": "completa"}'
   ```

### "Tareas duplicadas en CRM"

**Causa:** La función `create-renewal-tasks` tiene verificación anti-duplicados pero podría fallar si cambia el título

**Solución:**
- El sistema verifica `titulo` + `estado='pendiente'` + `usuario_id`
- Si el formato del título cambia, podría crear duplicados
- Revisar logs de la función

---

## 9. Documentación Técnica

### Edge Functions

#### Endpoints

| Función | URL | Auth | Descripción |
|---------|-----|------|-------------|
| `sicas-sync-cobranza` | `/functions/v1/sicas-sync-cobranza` | JWT | Sincroniza cobranza pendiente |
| `sicas-sync-manual` | `/functions/v1/sicas-sync-manual` | JWT | Sincronización manual completa |
| `create-renewal-tasks` | `/functions/v1/create-renewal-tasks` | Service Role | Crea tareas de renovación (cron) |

#### Parámetros

**`sicas-sync-manual`:**
```json
{
  "syncType": "completa" | "polizas" | "cobranza"
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "polizas_vigentes": 1234,
    "cobranza_pendiente": 567,
    "errors": []
  },
  "synced_at": "2026-02-13T12:00:00Z"
}
```

### Tablas Principales

#### `sicas_polizas_vigentes`
```sql
- id_documento (PK)
- no_poliza
- vend_id (FK a sicas_vendedores)
- aseguradora, ramo, subramo
- contratante, asegurado
- vigencia_desde, vigencia_hasta
- prima_neta, prima_total
- synced_at
```

#### `sicas_cobranza_pendiente`
```sql
- vend_id (FK a sicas_vendedores)
- cliente, no_poliza
- importe_pendiente
- fecha_limite, dias_vencidos
- status
- synced_at
```

### Vistas

#### `sicas_renovaciones_proximas`
```sql
SELECT
  *,
  vigencia_hasta - CURRENT_DATE AS dias_para_vencer,
  CASE
    WHEN dias_para_vencer <= 7 THEN 'alta'
    WHEN dias_para_vencer <= 30 THEN 'media'
    ELSE 'baja'
  END AS prioridad_renovacion
FROM sicas_polizas_vigentes
WHERE vigencia_hasta > CURRENT_DATE
  AND vigencia_hasta <= CURRENT_DATE + INTERVAL '60 days'
```

---

## Conclusión

El sistema está completamente funcional y listo para producción. Los vendedores ahora tienen acceso instantáneo a su información de SICAS sin depender de consultas lentas al SOAP. Las tareas de renovación se crean automáticamente y las notificaciones se envían en el momento oportuno.

La arquitectura es escalable, mantenible y sigue las mejores prácticas de performance y UX.
