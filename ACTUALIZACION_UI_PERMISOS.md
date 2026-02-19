# Actualización: Permisos de Gerentes en Seguros Education

## Problemas Resueltos

### 1. Error al Crear Categorías
**Error anterior:**
```
POST .../rest/v1/seguros_categories 403 (Forbidden)
Error: new row violates row-level security policy for table "seguros_categories"
```

**Causa**: Las políticas RLS solo permitían a usuarios con rol `Administrador` crear categorías, pero no verificaban los permisos adicionales de los Gerentes.

**Usuario afectado**: `recluta.cdmx@jiro.mx` (rol: Gerente con permisos en `seguros_education`)

### 2. Cambios No Se Guardan al Editar Lecciones
**Síntoma**: Al editar el título u otros campos de una lección, los cambios no se guardaban.

**Causa**: Mismo problema de permisos RLS. Los Gerentes no tenían permisos de UPDATE en `seguros_lessons`.

## Solución Implementada

### Migración Aplicada: `fix_seguros_education_permissions_gerentes`

Se actualizaron las políticas RLS de las siguientes tablas:

#### 1. `seguros_categories`
**Antes:**
```sql
CREATE POLICY "Admins can manage categories"
  ON seguros_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );
```

**Ahora:**
```sql
CREATE POLICY "Admins and authorized gerentes can manage categories"
  ON seguros_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  )
  WITH CHECK (...); -- Similar al USING
```

#### 2. `seguros_lessons`
Se aplicó la misma actualización para permitir INSERT, UPDATE, DELETE a Gerentes con permisos.

#### 3. `seguros_sessions`
Se aplicó la misma actualización para permitir gestión de sesiones en vivo.

## Verificación

### Usuario: recluta.cdmx@jiro.mx

```sql
-- ✅ Permisos asignados correctamente
SELECT modulo FROM permisos_adicionales_gerente 
WHERE usuario_id = '7d8c03e2-db2e-4780-91dc-5b11b84bec83';

-- Resultado:
- publicidad
- comunicados
- directorio
- usuarios
- centro_digital
- seguros_education ✅
- crm
- aula_virtual
- cedula_a
- espaciojiro
```

```sql
-- ✅ Función verifica correctamente
SELECT tiene_permiso_admin_en_modulo(
  '7d8c03e2-db2e-4780-91dc-5b11b84bec83', 
  'seguros_education'
); 
-- Resultado: true ✅
```

## Permisos Ahora Disponibles

Los Gerentes con el permiso `seguros_education` ahora pueden:

### En Seguros Education (On Demand):
- ✅ **Crear** nuevas categorías
- ✅ **Editar** categorías existentes
- ✅ **Eliminar** categorías
- ✅ **Crear** nuevas lecciones/videos
- ✅ **Editar** lecciones existentes (título, descripción, etc.)
- ✅ **Eliminar** lecciones
- ✅ **Asignar** oficinas a lecciones

### En Aula Virtual:
- ✅ **Crear** nuevas sesiones en vivo
- ✅ **Editar** sesiones programadas
- ✅ **Eliminar** sesiones
- ✅ **Iniciar/detener** sesiones en vivo

## Testing

### Caso 1: Crear Categoría
1. Iniciar sesión como `recluta.cdmx@jiro.mx`
2. Ir a Seguros Education → On Demand
3. Hacer clic en "Nueva Categoría"
4. **Resultado esperado**: ✅ Categoría se crea sin errores

### Caso 2: Editar Lección
1. Iniciar sesión como `recluta.cdmx@jiro.mx`
2. Ir a Seguros Education → On Demand
3. Seleccionar una lección
4. Cambiar el título
5. Guardar
6. **Resultado esperado**: ✅ Cambios se guardan correctamente

### Caso 3: Usuario Sin Permisos
1. Iniciar sesión como un Gerente SIN el permiso `seguros_education`
2. Ir a Seguros Education → On Demand
3. Intentar crear categoría
4. **Resultado esperado**: ❌ Error 403 (comportamiento correcto)

## Cómo Asignar Permisos a Otros Gerentes

Para dar permisos de administrador de Seguros Education a otro Gerente:

```sql
-- 1. Obtener el ID del módulo
SELECT id FROM modulos_sistema WHERE codigo = 'seguros_education';
-- Resultado: [UUID_MODULO]

-- 2. Obtener el ID del usuario
SELECT id FROM usuarios WHERE email_laboral = 'gerente@ejemplo.com';
-- Resultado: [UUID_USUARIO]

-- 3. Asignar el permiso
INSERT INTO permisos_adicionales_gerente (usuario_id, modulo_id, asignado_por)
VALUES (
  '[UUID_USUARIO]',
  (SELECT id FROM modulos_sistema WHERE codigo = 'seguros_education'),
  auth.uid() -- El ID del admin que asigna
);
```

O más simple:
```sql
INSERT INTO permisos_adicionales_gerente (usuario_id, modulo_id)
SELECT '[UUID_GERENTE]', id 
FROM modulos_sistema 
WHERE codigo = 'seguros_education';
```

## Otros Módulos Disponibles

El mismo sistema de permisos está disponible para:

- `vacaciones` - Gestión de vacaciones
- `usuarios` - Gestión de usuarios
- `directorio` - Directorio de empleados
- `comisiones` - Gestión de comisiones
- `produccion` - Reportes de producción
- `crm` - CRM
- `tramites` - Trámites y tickets
- `store` - Tienda interna
- `espaciojiro` - Reservas de espacios
- `seguros_education` - Plataforma de capacitación ✅
- `cedula_a` - Curso Cédula A
- `aula_virtual` - Sesiones en vivo
- `publicidad` - Materiales publicitarios
- `comunicados` - Comunicados internos
- `mi_pagina_web` - Editor de página web
- `accesos_nacional` - Credenciales portales
- `notificaciones` - Configuración de notificaciones
- `correos` - Gestión de correos
- `oficinas` - Gestión de oficinas
- `centro_digital` - Documentos compartidos
- Y más...

## Resumen

✅ **Problema resuelto**: Gerentes con permisos ahora pueden gestionar Seguros Education
✅ **Políticas RLS actualizadas**: 3 tablas (categories, lessons, sessions)
✅ **Usuario verificado**: recluta.cdmx@jiro.mx tiene permisos correctos
✅ **Sistema escalable**: Fácil agregar permisos a otros Gerentes
✅ **Build exitoso**: Sin errores de compilación

**Los cambios están activos inmediatamente. No se requiere reinicio.**
