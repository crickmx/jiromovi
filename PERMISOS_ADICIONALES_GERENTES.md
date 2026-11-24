# Sistema de Permisos Adicionales para Gerentes

## 📋 Resumen

El sistema de permisos adicionales permite que usuarios con rol **Gerente** tengan privilegios de **Administrador** en módulos específicos, sin convertirse en administradores globales. Esto permite delegar responsabilidades administrativas de forma granular y controlada.

## 🎯 Objetivo

- ✅ Delegar responsabilidades administrativas sin dar acceso completo
- ✅ Control fino por área/módulo
- ✅ Escalabilidad organizacional
- ✅ Mantener seguridad y trazabilidad

## 🏗️ Arquitectura

### Tablas de Base de Datos

#### `modulos_sistema`
Catálogo de todos los módulos de la plataforma.

```sql
CREATE TABLE modulos_sistema (
  id uuid PRIMARY KEY,
  codigo text UNIQUE NOT NULL,        -- Identificador único (ej: 'comisiones')
  nombre text NOT NULL,                -- Nombre legible (ej: 'Comisiones')
  descripcion text,                    -- Descripción del módulo
  categoria text,                      -- Categoría (ej: 'Ventas', 'RRHH')
  activo boolean DEFAULT true,
  orden integer DEFAULT 0
);
```

#### `permisos_adicionales_gerente`
Asignaciones de permisos admin por módulo para gerentes.

```sql
CREATE TABLE permisos_adicionales_gerente (
  id uuid PRIMARY KEY,
  usuario_id uuid REFERENCES usuarios(id),
  modulo_id uuid REFERENCES modulos_sistema(id),
  nivel_permiso text DEFAULT 'admin',
  asignado_por uuid REFERENCES usuarios(id),
  fecha_asignacion timestamptz DEFAULT now()
);
```

### Funciones de Base de Datos

#### `tiene_permiso_admin_en_modulo(usuario_id, modulo_codigo)`
Verifica si un usuario tiene permisos de administrador en un módulo específico.

**Lógica:**
1. Si es **Administrador** → siempre retorna `true`
2. Si NO es **Gerente** → siempre retorna `false`
3. Si es **Gerente** → verifica si tiene permiso adicional en ese módulo

#### `get_permisos_adicionales_usuario(usuario_id)`
Retorna la lista de módulos donde el usuario tiene permisos adicionales.

## 📦 Módulos Disponibles

Los módulos están organizados por categorías:

### RRHH
- `vacaciones` - Gestión de vacaciones
- `usuarios` - Gestión de usuarios
- `directorio` - Directorio de empleados

### Ventas
- `comisiones` - Gestión de comisiones
- `produccion` - Reportes de producción
- `crm` - CRM y clientes

### Operaciones
- `tramites` - Gestión de trámites
- `store` - Tienda interna
- `espaciojiro` - Reservas de espacios

### Educación
- `seguros_education` - Plataforma de capacitación
- `cedula_a` - Curso de Cédula A
- `aula_virtual` - Aula virtual

### Marketing
- `publicidad` - Materiales publicitarios
- `comunicados` - Comunicados internos
- `mi_pagina_web` - Editor de página web

### Configuración
- `accesos_nacional` - Credenciales de portales
- `notificaciones` - Configuración de notificaciones
- `correos` - Gestión de correos
- `oficinas` - Gestión de oficinas

### Otros
- `centro_digital` - Documentos compartidos
- `gmm_cotizador` - Cotizador GMM
- `multicotizador` - Multicotizador
- `sicas` - Integración SICAS

## 💻 Uso en el Frontend

### 1. Verificar Permisos en Componentes

```typescript
import { useAuth } from '../contexts/AuthContext';
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';

function MiComponente() {
  const { usuario } = useAuth();

  // Verificar si tiene permiso admin en Comisiones
  const puedeAdministrarComisiones = tienePermisoAdminEnModulo(
    usuario,
    MODULOS.COMISIONES
  );

  if (puedeAdministrarComisiones) {
    // Mostrar opciones de administrador
    return <OpcionesAdmin />;
  }

  return <OpcionesNormales />;
}
```

### 2. Asignar Permisos a un Gerente

Los permisos se asignan desde el **modal de creación/edición de usuarios**:

1. Usuario actual debe ser **Administrador**
2. Usuario a editar debe tener rol **Gerente**
3. Aparece la sección "Permisos Adicionales"
4. Seleccionar los módulos donde el Gerente tendrá permisos admin
5. Guardar usuario

### 3. Verificación Automática en AuthContext

Los permisos adicionales se cargan automáticamente cuando un Gerente inicia sesión:

```typescript
// En AuthContext.tsx
if (data.rol === 'Gerente') {
  const permisos = await cargarPermisosAdicionales(data.id);
  setUsuario({ ...data, permisosAdicionales: permisos });
}
```

Esto permite que estén disponibles en toda la aplicación a través del contexto:

```typescript
const { usuario } = useAuth();
console.log(usuario?.permisosAdicionales); // ['comisiones', 'vacaciones', ...]
```

## 🔒 Seguridad

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado:

- ✅ Solo administradores pueden asignar permisos
- ✅ Usuarios pueden ver sus propios permisos
- ✅ Administradores pueden ver todos los permisos

### Auditoría

Cada permiso asignado registra:
- ✅ Quién lo asignó (`asignado_por`)
- ✅ Cuándo se asignó (`fecha_asignacion`)
- ✅ Notas opcionales

## 📊 Ejemplos de Uso

### Ejemplo 1: Gerente de Ventas

**Usuario:** Juan Pérez
**Rol Base:** Gerente
**Permisos Adicionales:**
- `comisiones` → Puede administrar comisiones de toda la empresa
- `produccion` → Puede ver y administrar reportes de producción
- `crm` → Puede configurar y administrar el CRM

**Resultado:**
- Juan puede hacer TODO lo que hace un admin en Comisiones, Producción y CRM
- Juan sigue siendo Gerente en el resto de módulos (Vacaciones, Store, etc.)

### Ejemplo 2: Gerente de RRHH

**Usuario:** María González
**Rol Base:** Gerente
**Permisos Adicionales:**
- `vacaciones` → Puede aprobar/rechazar vacaciones de toda la empresa
- `usuarios` → Puede crear y editar usuarios
- `directorio` → Puede administrar el directorio

**Resultado:**
- María puede administrar todo lo relacionado con RRHH
- María NO puede acceder a módulos de ventas o finanzas como admin

### Ejemplo 3: Gerente de Oficina con Permisos Especiales

**Usuario:** Carlos López
**Rol Base:** Gerente
**Permisos Adicionales:**
- `store` → Puede administrar pedidos y productos
- `tramites` → Puede ver y gestionar todos los trámites

**Resultado:**
- Carlos puede administrar Store y Trámites como admin
- Carlos mantiene sus restricciones de Gerente en otros módulos

## 🛠️ Funciones de Utilidad

### `tienePermisoAdminEnModulo(usuario, moduloCodigo)`

Verifica permisos de forma síncrona usando datos en memoria.

```typescript
const puedeEditar = tienePermisoAdminEnModulo(usuario, MODULOS.COMISIONES);
```

### `verificarPermisoAdminEnModulo(usuarioId, moduloCodigo)`

Verifica permisos con consulta a la base de datos (async).

```typescript
const puedeEditar = await verificarPermisoAdminEnModulo(
  usuario.id,
  MODULOS.COMISIONES
);
```

### `cargarPermisosAdicionales(usuarioId)`

Carga la lista de permisos adicionales de un usuario.

```typescript
const permisos = await cargarPermisosAdicionales(usuario.id);
// Retorna: ['comisiones', 'produccion', ...]
```

### `obtenerModulosSistema()`

Obtiene el catálogo completo de módulos.

```typescript
const modulos = await obtenerModulosSistema();
```

## 🎨 UI - Sección de Permisos

La sección de permisos adicionales aparece en el formulario de usuario cuando:
- ✅ Usuario actual es **Administrador**
- ✅ Usuario a editar tiene rol **Gerente**

La UI muestra:
- 📋 Lista de módulos agrupados por categoría
- ✅ Checkboxes para seleccionar módulos
- 📝 Descripción de cada módulo
- 💡 Nota explicativa sobre el alcance de los permisos

## ⚠️ Consideraciones Importantes

1. **No es administrador global**: Un Gerente con permisos adicionales NO se convierte en administrador del sistema
2. **Permisos granulares**: Los permisos son por módulo, no globales
3. **Solo Gerentes**: Los permisos adicionales solo aplican para rol "Gerente"
4. **Solo Admins asignan**: Solo usuarios Administrador pueden asignar permisos adicionales
5. **Auditoría**: Todos los cambios quedan registrados

## 🔄 Flujo Completo

```
1. Admin crea/edita usuario → Asigna rol "Gerente"
2. Admin selecciona módulos con permisos admin
3. Sistema guarda permisos en permisos_adicionales_gerente
4. Gerente inicia sesión
5. Sistema carga permisos adicionales automáticamente
6. Gerente accede a módulo autorizado
7. Sistema verifica: ¿Es Admin? NO → ¿Es Gerente con permiso? SÍ
8. Sistema otorga acceso nivel Administrador en ese módulo
9. Gerente accede a módulo no autorizado
10. Sistema verifica: ¿Es Admin? NO → ¿Es Gerente con permiso? NO
11. Sistema otorga acceso nivel Gerente normal
```

## 📝 Checklist de Implementación en Módulos

Para implementar permisos adicionales en un módulo existente:

- [ ] Importar `tienePermisoAdminEnModulo` y `MODULOS` desde `permisosUtils`
- [ ] Obtener usuario desde `useAuth()`
- [ ] Verificar permisos antes de mostrar opciones admin
- [ ] Probar con usuario Gerente con y sin permisos
- [ ] Verificar RLS en backend si aplica

## 🚀 Próximos Pasos

- ✅ Sistema base implementado
- ✅ UI para asignar permisos
- ✅ Funciones de verificación
- ✅ Integración con AuthContext
- ⏳ Aplicar en módulos específicos según necesidad
- ⏳ Crear reportes de permisos asignados
- ⏳ Dashboard de administración de permisos

## 📞 Soporte

Si tienes dudas sobre cómo implementar permisos en un módulo específico, consulta este documento o pregunta al equipo de desarrollo.

---

**Fecha de creación:** 2026-01-20
**Última actualización:** 2026-01-20
**Versión:** 1.0.0
