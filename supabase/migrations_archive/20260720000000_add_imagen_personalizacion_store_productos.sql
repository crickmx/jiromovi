ALTER TABLE store_productos
  ADD COLUMN IF NOT EXISTS imagen_personalizacion_url text;

COMMENT ON COLUMN store_productos.imagen_personalizacion_url IS
  'Imagen dedicada (lienzo) para el editor de personalizacion visual (logo/texto del asesor). Distinta de imagen_url, que es el thumbnail del catalogo.';
