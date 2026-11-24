-- Limpia filas "muertas" de module_visibility escritas por el bug de "Toda la
-- sección" en Control de Módulos (ModulosAdmin.tsx): antes escribía
-- module_key = id del workspace (ej. 'produccion') en vez del path real del
-- item ('/produccion'), y el lado de lectura (isModuleVisible) nunca consulta
-- esa forma de llave — esas filas nunca tuvieron efecto. El bug ya está
-- corregido en el código (ahora aplica a cada item real); esto solo limpia
-- lo que ya se haya guardado con la llave vieja.
DELETE FROM module_visibility
WHERE module_key IN (
  'comercial', 'centro-contacto', 'cotizar', 'produccion',
  'mercadotecnia', 'operaciones', 'seguros-education', 'administracion'
);
