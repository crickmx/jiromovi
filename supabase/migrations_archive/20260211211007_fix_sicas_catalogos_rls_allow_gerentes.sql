/*
  # Fix SICAS Catalogos RLS - Permitir acceso a Gerentes
  
  1. Problema
    - Solo los admins pueden ver los catálogos SICAS
    - Los gerentes también necesitan acceso para mapear despachos/vendedores
    
  2. Solución
    - Actualizar política SELECT para incluir gerentes
    - Permitir que gerentes puedan crear mapeos
    
  3. Seguridad
    - Mantiene restricción de usuarios autenticados
    - Solo admins y gerentes activos tienen acceso
*/

-- Eliminar política restrictiva actual
DROP POLICY IF EXISTS "Admins pueden ver catálogos SICAS" ON sicas_catalogos;

-- Crear nueva política que incluye gerentes
CREATE POLICY "Admins y gerentes pueden ver catálogos SICAS"
ON sicas_catalogos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol IN ('admin', 'gerente')
    AND usuarios.estado = 'activo'
  )
);

-- Actualizar políticas de mapeo de despachos
DROP POLICY IF EXISTS "Admins pueden crear mapeos de despacho" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Admins pueden actualizar mapeos de despacho" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Admins pueden eliminar mapeos de despacho" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Admins pueden ver mapeos de despacho" ON sicas_mapeo_despacho_oficina;

CREATE POLICY "Admins y gerentes pueden ver mapeos de despacho"
ON sicas_mapeo_despacho_oficina
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol IN ('admin', 'gerente')
    AND usuarios.estado = 'activo'
  )
);

CREATE POLICY "Admins y gerentes pueden crear mapeos de despacho"
ON sicas_mapeo_despacho_oficina
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol IN ('admin', 'gerente')
    AND usuarios.estado = 'activo'
  )
);

CREATE POLICY "Admins y gerentes pueden actualizar mapeos de despacho"
ON sicas_mapeo_despacho_oficina
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol IN ('admin', 'gerente')
    AND usuarios.estado = 'activo'
  )
);

CREATE POLICY "Admins y gerentes pueden eliminar mapeos de despacho"
ON sicas_mapeo_despacho_oficina
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol IN ('admin', 'gerente')
    AND usuarios.estado = 'activo'
  )
);

-- Actualizar políticas de mapeo de vendedores
DROP POLICY IF EXISTS "Admins pueden crear mapeos de vendedor" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Admins pueden actualizar mapeos de vendedor" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Admins pueden eliminar mapeos de vendedor" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Admins pueden ver mapeos de vendedor" ON sicas_mapeo_vendedor_usuario;

CREATE POLICY "Admins y gerentes pueden ver mapeos de vendedor"
ON sicas_mapeo_vendedor_usuario
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol IN ('admin', 'gerente')
    AND usuarios.estado = 'activo'
  )
);

CREATE POLICY "Admins y gerentes pueden crear mapeos de vendedor"
ON sicas_mapeo_vendedor_usuario
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol IN ('admin', 'gerente')
    AND usuarios.estado = 'activo'
  )
);

CREATE POLICY "Admins y gerentes pueden actualizar mapeos de vendedor"
ON sicas_mapeo_vendedor_usuario
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol IN ('admin', 'gerente')
    AND usuarios.estado = 'activo'
  )
);

CREATE POLICY "Admins y gerentes pueden eliminar mapeos de vendedor"
ON sicas_mapeo_vendedor_usuario
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol IN ('admin', 'gerente')
    AND usuarios.estado = 'activo'
  )
);
