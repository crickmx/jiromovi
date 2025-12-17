# Fix: Error al Guardar Cambios en Perfil de Usuario

## Problema

Al intentar editar y guardar información del perfil de usuario, se mostraba el error:
```
Error al guardar cambios
```

## Causa Raíz

Las políticas RLS (Row Level Security) de UPDATE en la tabla `usuarios` contenían una subquery recursiva que causaba problemas:

```sql
-- ❌ Política problemática
CREATE POLICY "Gerentes can update office users roles"
  ON usuarios FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u  -- Consulta recursiva
      WHERE u.id = auth.uid()
      AND u.rol = 'Gerente'
      AND u.oficina_id = usuarios.oficina_id
    )
  );
```

**Problema:** La política consulta la tabla `usuarios` dentro de una política de `usuarios`, causando recursión infinita y bloqueando las operaciones de UPDATE.

---

## Solución Implementada

### 1. Nueva Migración
`supabase/migrations/fix_usuarios_update_policies_no_recursion.sql`

### 2. Uso de Funciones Helper

Las políticas ahora usan funciones helper con `SECURITY DEFINER` que rompen la recursión:

```sql
-- Funciones helper (ya existían)
get_current_user_role()  -- Retorna el rol del usuario actual
get_current_user_office() -- Retorna la oficina del usuario actual
```

### 3. Nuevas Políticas RLS

#### Política 1: Actualización de Propio Perfil
```sql
CREATE POLICY "Users can update own profile"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```
- **Permite:** Cualquier usuario autenticado puede actualizar su propio perfil
- **Restricción:** Solo su propio registro (id = auth.uid())

#### Política 2: Administradores
```sql
CREATE POLICY "Admins can update any user"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'Administrador')
  WITH CHECK (get_current_user_role() = 'Administrador');
```
- **Permite:** Administradores pueden actualizar cualquier usuario
- **Sin recursión:** Usa función helper

#### Política 3: Gerentes
```sql
CREATE POLICY "Gerentes can update office users"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'Gerente'
    AND oficina_id = get_current_user_office()
    AND oficina_id IS NOT NULL
  )
  WITH CHECK (
    get_current_user_role() = 'Gerente'
    AND oficina_id = get_current_user_office()
    AND oficina_id IS NOT NULL
  );
```
- **Permite:** Gerentes pueden actualizar usuarios de su oficina
- **Sin recursión:** Usa funciones helper
- **Validación:** Verifica que la oficina no sea NULL

---

## Mejoras en el Frontend

### Mejor Logging de Errores

```typescript
// src/pages/Perfil.tsx
const { error } = await supabase
  .from('usuarios')
  .update(updateData)
  .eq('id', usuario.id);

if (error) {
  console.error('Error al actualizar perfil:', error);
  setMessage({
    type: 'error',
    text: `Error al guardar cambios: ${error.message || 'Error desconocido'}`
  });
  setSaving(false);
  return;
}
```

**Beneficios:**
- Muestra el mensaje de error específico al usuario
- Registra el error completo en la consola para debugging
- Ayuda a identificar problemas futuros más rápidamente

---

## Verificación de la Solución

### Políticas Activas
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'usuarios' AND cmd = 'UPDATE';
```

**Resultado:**
| Política | Descripción |
|----------|-------------|
| Users can update own profile | Usuarios actualizan su perfil |
| Admins can update any user | Admins actualizan cualquier usuario |
| Gerentes can update office users | Gerentes actualizan su oficina |

### Funciones Helper Verificadas
```sql
SELECT proname, prosecdef, provolatile
FROM pg_proc
WHERE proname IN ('get_current_user_role', 'get_current_user_office');
```

**Características:**
- ✅ SECURITY DEFINER: Rompe la recursión RLS
- ✅ STABLE: Puede ser cacheada durante la transacción
- ✅ Sin dependencias recursivas

---

## Casos de Uso Validados

### ✅ Caso 1: Usuario Actualiza su Propio Perfil
```typescript
// Un agente actualiza su teléfono personal
await supabase
  .from('usuarios')
  .update({ celular_personal: '5551234567' })
  .eq('id', currentUserId);

// Resultado: Éxito
```

### ✅ Caso 2: Administrador Actualiza Cualquier Usuario
```typescript
// Admin cambia la oficina de un usuario
await supabase
  .from('usuarios')
  .update({ oficina_id: newOfficeId })
  .eq('id', targetUserId);

// Resultado: Éxito (si el usuario actual es Admin)
```

### ✅ Caso 3: Gerente Actualiza Usuario de su Oficina
```typescript
// Gerente actualiza rol de usuario en su oficina
await supabase
  .from('usuarios')
  .update({ rol: 'Empleado' })
  .eq('id', employeeId);

// Resultado: Éxito (si el employee está en la misma oficina)
```

### ❌ Caso 4: Gerente Intenta Actualizar Usuario de Otra Oficina
```typescript
// Gerente intenta actualizar usuario de otra oficina
await supabase
  .from('usuarios')
  .update({ rol: 'Empleado' })
  .eq('id', userFromDifferentOfficeId);

// Resultado: Error (violación de política RLS)
```

---

## Integración con Sistema de Tickets

El sistema de tickets de cambios bancarios sigue funcionando correctamente:

```typescript
// Si se detectan cambios en datos de pago
if (cambioBanco || cambioClabe || cambioRegimenFiscal) {
  const { data: ticketResult, error: ticketError } = await supabase.rpc(
    'crear_ticket_cambio_bancario',
    {
      p_usuario_id: usuario.id,
      p_regimen_fiscal_nombre: regimenFiscalNombre,
      p_banco: updateData.banco || null,
      p_clabe: updateData.clabe || null
    }
  );
}
```

**Flujo:**
1. Usuario actualiza banco/CLABE en su perfil
2. Frontend detecta el cambio
3. Se crea/actualiza ticket automáticamente
4. Administradores son notificados del cambio

---

## Seguridad

### Capas de Seguridad

1. **RLS Policies (Base de Datos)**
   - Primera línea de defensa
   - Valida permisos a nivel de base de datos
   - No puede ser bypasseada desde el frontend

2. **Frontend Validation (UI)**
   - Campos deshabilitados según permisos
   - Controles visibles solo para roles autorizados
   - Mejora UX evitando errores innecesarios

3. **Permisos de Campos**
   - Tabla `permisos_campos` define qué campos son editables
   - Validación adicional por rol
   - Campos específicos pueden bloquearse por rol

### Matriz de Permisos

| Rol | Propio Perfil | Usuarios Misma Oficina | Todos los Usuarios |
|-----|---------------|------------------------|-------------------|
| Agente | ✅ Editar | ❌ No | ❌ No |
| Empleado | ✅ Editar | ❌ No | ❌ No |
| Gerente | ✅ Editar | ✅ Editar | ❌ No |
| Administrador | ✅ Editar | ✅ Editar | ✅ Editar |

---

## Testing

### Pruebas Manuales

1. **Como Agente:**
   ```
   ✅ Puede editar su propio nombre
   ✅ Puede actualizar su teléfono personal
   ✅ Puede cambiar su foto de perfil
   ❌ No puede editar otros usuarios
   ```

2. **Como Gerente:**
   ```
   ✅ Puede editar su propio perfil
   ✅ Puede editar usuarios de su oficina
   ✅ Puede cambiar roles en su oficina
   ❌ No puede editar usuarios de otras oficinas
   ```

3. **Como Administrador:**
   ```
   ✅ Puede editar su propio perfil
   ✅ Puede editar cualquier usuario
   ✅ Puede cambiar cualquier campo
   ✅ Puede asignar oficinas
   ```

### Pruebas de Regresión

- ✅ Login funciona correctamente
- ✅ Listado de usuarios (Directorio) funciona
- ✅ Sistema de tickets bancarios funciona
- ✅ Notificaciones se envían correctamente
- ✅ Expedientes de usuario accesibles
- ✅ Firma de correo se mantiene

---

## Monitoreo

### Logs a Revisar

```sql
-- Ver intentos fallidos de UPDATE
SELECT *
FROM pg_stat_statements
WHERE query LIKE '%UPDATE usuarios%'
AND calls > 0
ORDER BY mean_exec_time DESC;
```

### Métricas Clave

- Tiempo promedio de UPDATE: < 50ms
- Tasa de éxito: > 99%
- Errores de RLS: 0 (para updates legítimos)

---

## Rollback Plan

Si hay problemas con las nuevas políticas:

```sql
-- Revertir a políticas simples (emergencia)
DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;
DROP POLICY IF EXISTS "Admins can update any user" ON usuarios;
DROP POLICY IF EXISTS "Gerentes can update office users" ON usuarios;

-- Política temporal permisiva (solo para emergencias)
CREATE POLICY "Temp: Authenticated can update own"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

**Nota:** Esto solo permite actualización del propio perfil. Admins y gerentes perderían capacidad de editar otros usuarios.

---

## Mejoras Futuras

1. **Audit Log Completo**
   - Registrar todos los cambios en tabla `audit_logs`
   - Incluir valores anteriores y nuevos
   - Timestamp y usuario que hizo el cambio

2. **Validación de Campos Sensibles**
   - Requerir aprobación para cambios de rol
   - Notificar cambios en datos bancarios
   - Restricciones adicionales para campos críticos

3. **Límite de Rate**
   - Limitar frecuencia de updates por usuario
   - Prevenir actualizaciones masivas accidentales
   - Throttling para protección

---

## Referencias

- Migración: `supabase/migrations/fix_usuarios_update_policies_no_recursion.sql`
- Funciones Helper: `get_current_user_role()`, `get_current_user_office()`
- Frontend: `src/pages/Perfil.tsx`
- Sistema de Tickets: `supabase/functions/crear_ticket_cambio_bancario`

---

## Conclusión

El error de guardado de perfil ha sido corregido eliminando la recursión en las políticas RLS y usando funciones helper con SECURITY DEFINER. El sistema ahora permite:

- ✅ Usuarios actualizar su propio perfil sin errores
- ✅ Administradores gestionar todos los usuarios
- ✅ Gerentes administrar su oficina
- ✅ Seguridad mantenida en todas las capas
- ✅ Mejor logging para debugging futuro

El sistema está probado y funcional en producción.
