/*
  # Agregar Permisos para Campos de Información de Pago
  
  1. Cambios
    - Agregar permisos para campos de información de pago (banco, clabe, regimen_fiscal_id)
    - Hacer estos campos visibles y editables para todos los roles
    
  2. Seguridad
    - Los usuarios pueden editar su propia información de pago
    - Los cambios crean tickets automáticamente para revisión de administradores
*/

-- Agregar permisos para información de pago para todos los roles
INSERT INTO permisos_campos (rol, nombre_campo, visible, editable)
SELECT rol, campo, true, true
FROM (
  SELECT DISTINCT rol FROM permisos_campos
) roles
CROSS JOIN (
  VALUES ('banco'), ('clabe'), ('regimen_fiscal_id')
) AS campos(campo)
WHERE NOT EXISTS (
  SELECT 1 FROM permisos_campos pc
  WHERE pc.rol = roles.rol
  AND pc.nombre_campo = campos.campo
);
