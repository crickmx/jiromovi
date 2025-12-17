# Bug Fix: Información de Pago No Se Guardaba en Perfil

## Problema Reportado

Al editar la información bancaria (banco y clabe) en el perfil de usuario:
- Se mostraba el mensaje "Cambios guardados correctamente"
- Los datos ingresados desaparecían
- Los cambios NO se guardaban en la base de datos

## Causa del Problema

La función `handleSave` en `src/pages/Perfil.tsx` solo incluía campos en el update si pasaban la validación `isFieldEditable(key)`, que verifica la tabla `permisos_campos`.

Los campos `banco`, `clabe`, y `regimen_fiscal_id` no estaban en la tabla `permisos_campos`, por lo que aunque el usuario los editaba, no se incluían en el `updateData` enviado a Supabase.

### Código Problemático:

```typescript
const updateData: Partial<Usuario> = {};
Object.keys(formData).forEach((key) => {
  if (isFieldEditable(key)) {  // ← banco, clabe no pasaban esta validación
    updateData[key as keyof Usuario] = formData[key as keyof Usuario];
  }
});
```

## Solución Implementada

### 1. Forzar Inclusión de Campos de Pago

Se agregó lógica especial para siempre incluir los campos de información de pago en el update:

```typescript
const updateData: Partial<Usuario> = {};
Object.keys(formData).forEach((key) => {
  if (isFieldEditable(key)) {
    updateData[key as keyof Usuario] = formData[key as keyof Usuario];
  }
});

// Siempre incluir campos de información de pago si están presentes en formData
// Estos campos son editables desde PaymentFields y deben guardarse
const paymentFields = ['banco', 'clabe', 'regimen_fiscal_id'];
paymentFields.forEach((field) => {
  if (field in formData) {
    updateData[field as keyof Usuario] = formData[field as keyof Usuario];
  }
});
```

### 2. Corregir Detección de Cambios

Se corrigió la lógica para detectar cambios en información de pago:

**Antes:**
```typescript
const cambioBanco = updateData.banco !== undefined && updateData.banco !== originalBanco;
```

**Después:**
```typescript
// Comparar con los valores actuales en formData, no con updateData
const cambioBanco = formData.banco !== originalBanco;
```

### 3. Agregar Permisos en Base de Datos

Se creó la migración `20251217190000_add_payment_fields_to_permissions.sql` que agrega los campos de pago a la tabla `permisos_campos` para todos los roles:

```sql
INSERT INTO permisos_campos (rol, nombre_campo, visible, editable)
SELECT rol, campo, true, true
FROM (SELECT DISTINCT rol FROM permisos_campos) roles
CROSS JOIN (VALUES ('banco'), ('clabe'), ('regimen_fiscal_id')) AS campos(campo)
WHERE NOT EXISTS (
  SELECT 1 FROM permisos_campos pc
  WHERE pc.rol = roles.rol AND pc.nombre_campo = campos.campo
);
```

### 4. Debugging

Se agregó logging para facilitar el debugging:

```typescript
console.log('Datos a actualizar:', {
  banco: updateData.banco,
  clabe: updateData.clabe,
  regimen_fiscal_id: updateData.regimen_fiscal_id,
  totalFields: Object.keys(updateData).length
});
```

## Archivos Modificados

1. **`src/pages/Perfil.tsx`**
   - Forzar inclusión de campos de pago en updateData
   - Corregir detección de cambios
   - Agregar logging para debug
   - Usar formData en lugar de updateData para crear tickets

2. **`supabase/migrations/20251217190000_add_payment_fields_to_permissions.sql`**
   - Nueva migración para agregar permisos de campos de pago

## Verificación

Para verificar que el fix funciona:

1. Login como cualquier usuario
2. Ir a Perfil
3. Editar campos de Banco y CLABE
4. Guardar cambios
5. Verificar en consola del navegador que se muestra el log con los datos
6. Refrescar la página
7. Los datos deben persistir

## Notas Técnicas

- Las políticas RLS permiten que los usuarios actualicen su propio perfil (`USING (id = auth.uid())`)
- Los cambios en información de pago crean automáticamente tickets para revisión de administradores
- El componente `PaymentFields` está configurado con `editable={true}` explícitamente
- Los cambios ahora persisten correctamente en la base de datos

## Impacto

- Todos los usuarios ahora pueden actualizar su información bancaria correctamente
- Los cambios se guardan en la base de datos
- Los tickets de cambio bancario se crean correctamente
- El sistema es más robusto al no depender solo de permisos_campos para estos campos críticos
