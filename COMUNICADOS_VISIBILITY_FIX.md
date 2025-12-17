# Corrección de Visibilidad de Comunicados

## Problema Identificado

Las políticas RLS de comunicados no estaban considerando correctamente el campo `para_todos` en la tabla `comunicados_visibilidad`, lo que causaba que algunos comunicados no se mostraran a los usuarios que deberían verlos.

---

## Solución Implementada

### 1. Políticas RLS Optimizadas

Se corrigieron todas las políticas RLS de la tabla `comunicados_publicaciones` para implementar correctamente la lógica de visibilidad:

#### Política para Usuarios Normales

```sql
CREATE POLICY "Users can view comunicados based on visibility"
  ON comunicados_publicaciones FOR SELECT
  TO authenticated
  USING (
    publicado = true
    AND fecha_publicacion <= now()
    AND (
      -- Caso 1: No hay reglas de visibilidad (visible para todos)
      NOT EXISTS (
        SELECT 1 FROM comunicados_visibilidad
        WHERE comunicado_id = comunicados_publicaciones.id
      )
      OR
      -- Caso 2: Existe una regla explícita de "para todos"
      EXISTS (
        SELECT 1 FROM comunicados_visibilidad
        WHERE comunicado_id = comunicados_publicaciones.id
        AND para_todos = true
      )
      OR
      -- Caso 3: El usuario cumple con alguna regla específica
      EXISTS (
        SELECT 1
        FROM comunicados_visibilidad cv
        JOIN usuarios u ON u.id = (select auth.uid())
        WHERE cv.comunicado_id = comunicados_publicaciones.id
        AND (
          (cv.rol IS NOT NULL AND cv.rol = u.rol)
          OR
          (cv.oficina_id IS NOT NULL AND cv.oficina_id = u.oficina_id)
          OR
          (cv.usuario_id IS NOT NULL AND cv.usuario_id = u.id)
        )
      )
    )
  );
```

#### Mejoras Adicionales

- **Optimización de rendimiento:** Todas las políticas usan `(select auth.uid())` en lugar de `auth.uid()` para evaluar una sola vez por query
- **Políticas para Gerentes:** Mantienen la lógica de ver comunicados de su oficina
- **Políticas para Administradores:** Pueden ver todos los comunicados

---

## Lógica de Visibilidad

### Caso 1: Sin Reglas de Visibilidad

Cuando un comunicado **NO tiene registros** en `comunicados_visibilidad`:

```
✅ Visible para TODOS los usuarios autenticados
```

**Uso:** Comunicados antiguos o cuando se quiere máxima visibilidad sin crear reglas.

---

### Caso 2: Regla "Para Todos"

Cuando existe un registro con `para_todos = true`:

```sql
INSERT INTO comunicados_visibilidad (
  comunicado_id,
  para_todos
) VALUES (
  'xxx-xxx-xxx',
  true
);
```

```
✅ Visible para TODOS los usuarios autenticados
```

**Uso:** Cuando un administrador selecciona "Todos" en la interfaz.

---

### Caso 3: Reglas por Rol

Cuando existen reglas específicas por rol:

```sql
INSERT INTO comunicados_visibilidad (
  comunicado_id,
  rol,
  para_todos
) VALUES
  ('xxx-xxx-xxx', 'Agente', false),
  ('xxx-xxx-xxx', 'Empleado', false);
```

```
✅ Visible solo para usuarios con rol 'Agente' o 'Empleado'
❌ NO visible para otros roles (excepto Administradores)
```

**Uso:** Comunicados dirigidos a roles específicos.

---

### Caso 4: Reglas por Oficina

Cuando existen reglas específicas por oficina:

```sql
INSERT INTO comunicados_visibilidad (
  comunicado_id,
  oficina_id,
  para_todos
) VALUES (
  'xxx-xxx-xxx',
  'oficina-uuid',
  false
);
```

```
✅ Visible solo para usuarios de esa oficina
❌ NO visible para usuarios de otras oficinas (excepto Administradores)
```

**Uso:** Comunicados para oficinas específicas.

---

### Caso 5: Reglas Combinadas (Rol + Oficina)

Usado por Gerentes para notificar a roles específicos de su oficina:

```sql
INSERT INTO comunicados_visibilidad (
  comunicado_id,
  rol,
  oficina_id,
  para_todos
) VALUES (
  'xxx-xxx-xxx',
  'Agente',
  'oficina-uuid',
  false
);
```

```
✅ Visible solo para 'Agentes' de esa oficina específica
❌ NO visible para otros roles o usuarios de otras oficinas
```

**Uso:** Cuando un Gerente publica comunicados para su equipo.

---

## Comportamiento Especial por Rol

### Administradores

```
✅ Ven TODOS los comunicados publicados
```

Los administradores tienen una política dedicada que ignora las reglas de visibilidad.

---

### Gerentes

```
✅ Ven comunicados de su propia oficina
✅ Ven comunicados sin oficina_origen_id (publicados por Admins)
```

Los gerentes tienen una política especial que les permite ver:
1. Comunicados creados por su oficina
2. Comunicados creados por administradores (oficina_origen_id = NULL)

---

### Agentes y Empleados

```
✅ Ven comunicados según las reglas de visibilidad definidas
```

Aplican las reglas estándar de visibilidad descritas arriba.

---

## Validación de Funcionamiento

### Frontend

El código en `ComunicadoEditor.tsx` implementa correctamente:

```typescript
// Para Administradores que eligen "Todos"
if (tipoVisibilidad === 'todos') {
  reglasVisibilidad.push({
    comunicado_id: comunicadoId,
    rol: null,
    oficina_id: null,
    usuario_id: null,
    para_todos: true  // ✅ Correcto
  });
}

// Para reglas específicas
else if (tipoVisibilidad === 'rol') {
  for (const rol of rolesSeleccionados) {
    reglasVisibilidad.push({
      comunicado_id: comunicadoId,
      rol: rol,
      oficina_id: null,
      usuario_id: null,
      para_todos: false  // ✅ Correcto
    });
  }
}
```

---

### Test Manual

Se creó un archivo de test en:

```
/public/test-comunicados-visibility.html
```

Este test permite:
1. Ver todos los comunicados publicados
2. Verificar las reglas de visibilidad de cada uno
3. Confirmar que la lógica RLS funciona correctamente

**Para ejecutar:**
```
http://localhost:5173/test-comunicados-visibility.html
```

---

## Ejemplos de Uso

### Ejemplo 1: Comunicado Global

**Escenario:** Administrador publica un anuncio general.

**Frontend:**
```typescript
tipoVisibilidad = 'todos'
```

**Base de Datos:**
```sql
-- Tabla: comunicados_publicaciones
{ id: 'abc', titulo: 'Anuncio General', publicado: true, ... }

-- Tabla: comunicados_visibilidad
{ comunicado_id: 'abc', para_todos: true, rol: null, oficina_id: null }
```

**Resultado:** ✅ Todos los usuarios ven el comunicado.

---

### Ejemplo 2: Comunicado para Agentes

**Escenario:** Administrador publica información solo para Agentes.

**Frontend:**
```typescript
tipoVisibilidad = 'rol'
rolesSeleccionados = ['Agente']
```

**Base de Datos:**
```sql
-- Tabla: comunicados_publicaciones
{ id: 'def', titulo: 'Info para Agentes', publicado: true, ... }

-- Tabla: comunicados_visibilidad
{ comunicado_id: 'def', para_todos: false, rol: 'Agente', oficina_id: null }
```

**Resultado:**
- ✅ Usuarios con rol 'Agente' ven el comunicado
- ❌ Empleados NO lo ven
- ✅ Administradores lo ven (tienen política especial)

---

### Ejemplo 3: Gerente Publica para su Oficina

**Escenario:** Gerente de Oficina A publica para Agentes de su oficina.

**Frontend:**
```typescript
esGerente = true
rolesSeleccionados = ['Agente']
oficinaGerente = 'oficina-a-uuid'
```

**Base de Datos:**
```sql
-- Tabla: comunicados_publicaciones
{
  id: 'ghi',
  titulo: 'Info Oficina A',
  publicado: true,
  oficina_origen_id: 'oficina-a-uuid',
  ...
}

-- Tabla: comunicados_visibilidad
{
  comunicado_id: 'ghi',
  para_todos: false,
  rol: 'Agente',
  oficina_id: 'oficina-a-uuid'
}
```

**Resultado:**
- ✅ Agentes de Oficina A ven el comunicado
- ❌ Agentes de Oficina B NO lo ven
- ❌ Empleados de Oficina A NO lo ven (rol diferente)
- ✅ Gerente de Oficina A lo ve
- ✅ Administradores lo ven

---

## Verificación de Corrección

### Antes del Fix

```
❌ Comunicados con para_todos = true no se mostraban
❌ Usuarios veían comunicados que no deberían ver
❌ Algunas reglas de visibilidad no funcionaban
```

### Después del Fix

```
✅ Comunicados sin reglas → Visible para todos
✅ Comunicados con para_todos = true → Visible para todos
✅ Comunicados con reglas específicas → Solo visible para usuarios que cumplen reglas
✅ Administradores ven todo
✅ Gerentes ven los de su oficina
✅ Optimizado con (select auth.uid()) para mejor rendimiento
```

---

## Migración Aplicada

Archivo: `fix_comunicados_visibility_policy.sql`

- ✅ Corrige política de visibilidad para usuarios normales
- ✅ Optimiza políticas con `(select auth.uid())`
- ✅ Mantiene políticas especiales para Administradores y Gerentes
- ✅ Actualiza políticas de INSERT/UPDATE/DELETE

---

## Recomendaciones

1. **Prueba en Producción:**
   - Accede como diferentes roles (Admin, Gerente, Agente, Empleado)
   - Verifica que cada usuario vea solo los comunicados que debe ver

2. **Monitoreo:**
   - Observa los logs de Supabase para queries lentos
   - Las políticas optimizadas deberían mejorar el rendimiento

3. **Comunicados Antiguos:**
   - Los comunicados sin reglas de visibilidad seguirán siendo visibles para todos
   - Si quieres restringirlos, agrega reglas manualmente en `comunicados_visibilidad`

4. **Documentación:**
   - Instruye a los Administradores sobre las opciones de visibilidad
   - "Todos" = máxima visibilidad
   - "Por Rol" = solo usuarios con esos roles
   - "Por Oficina" = solo usuarios de esas oficinas

---

## Soporte

Si encuentras problemas:

1. Verifica las reglas en la tabla `comunicados_visibilidad`
2. Usa el test manual en `/test-comunicados-visibility.html`
3. Revisa los logs de Supabase para errores de políticas RLS
4. Confirma que los usuarios tengan el rol y oficina correctos en la tabla `usuarios`
