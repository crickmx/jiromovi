# Verificación del Sistema de Pedidos - Store MOVI

## 🎯 Objetivo

Verificar que:
1. ✅ **Administradores** pueden ver TODOS los pedidos de TODOS los usuarios
2. ✅ **Usuarios regulares** solo pueden ver SUS PROPIOS pedidos
3. ✅ Las políticas RLS funcionan correctamente

---

## 🔒 Políticas RLS Implementadas

### Tabla: `store_pedidos`

```sql
✅ "Admins pueden ver todos los pedidos" (SELECT)
   - Permite a administradores ver TODOS los pedidos
   - Condición: rol = 'Administrador'

✅ "Usuarios pueden ver sus pedidos" (SELECT)
   - Permite a usuarios ver SOLO sus pedidos
   - Condición: usuario_id = auth.uid()

✅ "Usuarios pueden crear pedidos" (INSERT)
   - Permite crear pedidos propios
   - Condición: usuario_id = auth.uid()

✅ "Admins pueden actualizar pedidos" (UPDATE)
   - Solo administradores pueden cambiar pedidos
   - Condición: rol = 'Administrador'
```

### Tablas Relacionadas

**store_pedidos_detalle:**
- ✅ Admins ven todo el detalle
- ✅ Usuarios ven solo detalle de sus pedidos

**store_pedidos_historial:**
- ✅ Admins ven todo el historial
- ✅ Usuarios ven solo historial de sus pedidos

**store_pedidos_notas:**
- ✅ Solo admins pueden ver/crear notas internas

---

## 🧪 Cómo Verificar el Sistema

### Paso 1: Verificar Datos Actuales

Ejecuta este SQL en Supabase SQL Editor:

```sql
-- Ver todos los pedidos y sus usuarios
SELECT
  p.id,
  u.nombre as usuario,
  u.rol,
  e.nombre as estatus,
  p.created_at
FROM store_pedidos p
LEFT JOIN usuarios u ON u.id = p.usuario_id
LEFT JOIN store_estatus_pedidos e ON e.id = p.estatus_id
ORDER BY p.created_at DESC;
```

### Paso 2: Crear Usuarios de Prueba (Si es necesario)

Si solo existe el administrador Christofer, crea usuarios adicionales:

```sql
-- Crear usuario de prueba 1
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'usuario1@test.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now()
) RETURNING id;

-- Anotar el ID generado y crear registro en usuarios
INSERT INTO usuarios (id, nombre, rol, estado)
VALUES
  ('[ID_DEL_USUARIO]', 'Usuario Test 1', 'Colaborador', 'activo');
```

O usar la función existente:

```sql
-- Usar función create-user (más fácil)
-- Llamar desde el edge function o crear manualmente
```

### Paso 3: Crear Pedidos de Prueba

```sql
-- Obtener IDs necesarios
-- 1. Usuario de prueba
SELECT id, nombre FROM usuarios WHERE rol != 'Administrador' LIMIT 1;

-- 2. Producto de prueba
SELECT id, titulo, precio FROM store_productos WHERE activo = true LIMIT 1;

-- 3. Estatus pendiente
SELECT id FROM store_estatus_pedidos WHERE nombre = 'Pendiente';

-- Crear pedido para usuario de prueba
DO $$
DECLARE
  v_usuario_id uuid;
  v_producto_id uuid;
  v_estatus_id uuid;
  v_pedido_id uuid;
BEGIN
  -- Obtener IDs
  SELECT id INTO v_usuario_id FROM usuarios WHERE rol != 'Administrador' LIMIT 1;
  SELECT id INTO v_producto_id FROM store_productos WHERE activo = true LIMIT 1;
  SELECT id INTO v_estatus_id FROM store_estatus_pedidos WHERE nombre = 'Pendiente';

  -- Verificar que tenemos los datos
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuarios no-admin disponibles';
  END IF;

  IF v_producto_id IS NULL THEN
    RAISE EXCEPTION 'No hay productos disponibles';
  END IF;

  -- Crear pedido
  INSERT INTO store_pedidos (usuario_id, estatus_id, notas_usuario)
  VALUES (v_usuario_id, v_estatus_id, 'Pedido de prueba')
  RETURNING id INTO v_pedido_id;

  -- Agregar detalle
  INSERT INTO store_pedidos_detalle (pedido_id, producto_id, cantidad, precio_unitario)
  SELECT
    v_pedido_id,
    id,
    2,
    precio
  FROM store_productos
  WHERE id = v_producto_id;

  -- Agregar historial
  INSERT INTO store_pedidos_historial (pedido_id, estatus_id, cambiado_por)
  VALUES (v_pedido_id, v_estatus_id, v_usuario_id);

  RAISE NOTICE 'Pedido creado exitosamente: %', v_pedido_id;
END $$;
```

### Paso 4: Verificar en la Aplicación

#### Como Administrador (Christofer):

1. Inicia sesión como administrador
2. Ve a **Store** → **Gestión de Pedidos**
3. Verifica en consola (F12):
   ```
   🔍 Administrador cargando TODOS los pedidos del sistema...
   ✅ Pedidos cargados: X pedidos de Y usuarios diferentes
   ```
4. Deberías ver:
   - ✅ TODOS los pedidos de TODOS los usuarios
   - ✅ Nombre del cliente en cada fila
   - ✅ Indicador: "X pedidos de Y usuarios"

#### Como Usuario Regular:

1. Cierra sesión
2. Inicia sesión como usuario de prueba
3. Ve a **Store** → **Mis Pedidos**
4. Verifica en consola (F12):
   ```
   🔍 Usuario [Nombre] cargando sus propios pedidos...
   ✅ Mis pedidos: X pedidos encontrados
   ```
5. Deberías ver:
   - ✅ SOLO tus propios pedidos
   - ❌ NO ver pedidos de otros usuarios
   - ✅ Botón "Mis Pedidos" (NO "Gestión de Pedidos")

---

## 📊 Logs de Verificación

### Logs del Administrador

```javascript
// En /store/pedidos
🔍 Administrador cargando TODOS los pedidos del sistema...
Obteniendo todos los pedidos...
Pedidos obtenidos: 5
✅ Pedidos cargados: 5 pedidos de 3 usuarios diferentes
```

### Logs del Usuario

```javascript
// En /store/mis-pedidos
🔍 Usuario Juan cargando sus propios pedidos...
✅ Mis pedidos: 2 pedidos encontrados
```

---

## ✅ Checklist de Verificación

### Administrador

- [ ] Ve el botón "Gestión de Pedidos" en Store home
- [ ] Puede acceder a `/store/pedidos`
- [ ] Ve TODOS los pedidos de TODOS los usuarios
- [ ] Ve el nombre del cliente en cada pedido
- [ ] Ve el indicador "X pedidos de Y usuarios"
- [ ] Puede ver detalle de cualquier pedido
- [ ] Puede cambiar estatus de pedidos
- [ ] Puede agregar notas internas
- [ ] Consola muestra logs de admin

### Usuario Regular

- [ ] Ve el botón "Mis Pedidos" en Store home
- [ ] NO ve botón "Gestión de Pedidos"
- [ ] NO puede acceder a `/store/pedidos` (redirigido)
- [ ] En `/store/mis-pedidos` ve SOLO sus pedidos
- [ ] NO ve pedidos de otros usuarios
- [ ] Puede ver detalle de sus propios pedidos
- [ ] NO puede cambiar estatus
- [ ] NO ve notas internas
- [ ] Consola muestra logs de usuario

---

## 🐛 Solución de Problemas

### Problema: Admin no ve todos los pedidos

**Causa:** Usuario no tiene rol 'Administrador'

**Solución:**
```sql
-- Verificar rol
SELECT id, nombre, rol FROM usuarios WHERE id = auth.uid();

-- Si no es admin, actualizar
UPDATE usuarios SET rol = 'Administrador' WHERE id = auth.uid();
```

### Problema: Usuario ve pedidos de otros

**Causa:** Políticas RLS incorrectas o deshabilitadas

**Solución:**
```sql
-- Verificar que RLS está habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'store_pedidos';

-- Si rowsecurity = false, habilitar
ALTER TABLE store_pedidos ENABLE ROW LEVEL SECURITY;

-- Verificar políticas
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'store_pedidos';
```

### Problema: Error al cargar pedidos

**Causa:** Campo 'email' no existe en usuarios

**Solución:**
Ya está corregido en el código:
```typescript
// ✅ CORRECTO (actual)
usuario:usuarios(nombre)

// ❌ INCORRECTO (anterior)
usuario:usuarios(nombre, email)
```

---

## 📱 Pruebas Adicionales

### Prueba 1: Crear pedido como usuario

1. Inicia sesión como usuario regular
2. Agrega producto al carrito
3. Completa la compra
4. Ve a "Mis Pedidos"
5. Verifica que aparece tu nuevo pedido

### Prueba 2: Admin ve nuevo pedido

1. Sin cerrar sesión del usuario, abre navegador incógnito
2. Inicia sesión como admin
3. Ve a "Gestión de Pedidos"
4. Verifica que aparece el pedido del usuario

### Prueba 3: Usuario no ve pedidos de admin

1. Como admin, crea un pedido
2. Cierra sesión
3. Inicia sesión como usuario regular
4. Ve a "Mis Pedidos"
5. Verifica que NO ves el pedido del admin

---

## 🔍 Consultas SQL Útiles

### Ver distribución de pedidos por usuario

```sql
SELECT
  u.nombre,
  u.rol,
  COUNT(p.id) as total_pedidos
FROM usuarios u
LEFT JOIN store_pedidos p ON p.usuario_id = u.id
GROUP BY u.id, u.nombre, u.rol
ORDER BY total_pedidos DESC;
```

### Ver pedidos recientes con cliente

```sql
SELECT
  p.id,
  u.nombre as cliente,
  u.rol,
  e.nombre as estatus,
  COUNT(d.id) as items,
  p.created_at
FROM store_pedidos p
LEFT JOIN usuarios u ON u.id = p.usuario_id
LEFT JOIN store_estatus_pedidos e ON e.id = p.estatus_id
LEFT JOIN store_pedidos_detalle d ON d.pedido_id = p.id
GROUP BY p.id, u.nombre, u.rol, e.nombre, p.created_at
ORDER BY p.created_at DESC
LIMIT 10;
```

### Verificar permisos de un usuario específico

```sql
-- Ejecutar como el usuario (requiere session)
SELECT
  'Puedo ver mis pedidos' as permiso,
  EXISTS(
    SELECT 1 FROM store_pedidos WHERE usuario_id = auth.uid()
  ) as tiene_acceso;

SELECT
  'Puedo ver todos los pedidos' as permiso,
  EXISTS(
    SELECT 1 FROM store_pedidos WHERE usuario_id != auth.uid()
  ) as tiene_acceso;
```

---

## 📋 Resumen de Funcionamiento

### ✅ LO QUE DEBE PASAR

**Administrador:**
- ✅ Ve TODOS los pedidos (propios + de otros usuarios)
- ✅ 1 admin, 3 usuarios → ve 10 pedidos total
- ✅ Indicador muestra: "10 pedidos de 4 usuarios"

**Usuario Regular:**
- ✅ Ve SOLO sus pedidos
- ✅ Usuario tiene 3 pedidos → ve 3 pedidos
- ✅ NO ve indicador de otros usuarios

### ❌ LO QUE NO DEBE PASAR

**Administrador:**
- ❌ Ver solo sus propios pedidos
- ❌ Ver tabla vacía si hay pedidos de otros

**Usuario Regular:**
- ❌ Ver pedidos de otros usuarios
- ❌ Ver botón "Gestión de Pedidos"
- ❌ Acceder a `/store/pedidos`
- ❌ Cambiar estatus de pedidos
- ❌ Ver notas internas

---

## 🎯 Estado Actual del Sistema

```
POLÍTICAS RLS: ✅ Configuradas correctamente
QUERIES: ✅ Corregidas (sin campo 'email')
LOGS: ✅ Implementados para debugging
UI INDICADORES: ✅ Muestran cantidad de usuarios
PERMISOS: ✅ Verificados en código
RUTAS: ✅ Protegidas con ProtectedRoute
```

---

## 📞 Si Necesitas Ayuda

Si después de seguir esta guía el sistema no funciona correctamente:

1. ✅ Abre la consola del navegador (F12)
2. ✅ Copia todos los logs que aparecen
3. ✅ Ejecuta los SQL de verificación
4. ✅ Copia los resultados
5. ✅ Reporta con toda la información

---

**Última actualización:** 2025-11-23
