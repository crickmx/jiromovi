-- Permite que usuarios anónimos (sin login) lean productos y categorías activos.
-- Necesario para tienda.movi.digital (vitrina pública).

-- store_categorias
DROP POLICY IF EXISTS "store_categorias_anon_select" ON public.store_categorias;
CREATE POLICY "store_categorias_anon_select" ON public.store_categorias
  FOR SELECT TO anon
  USING (activo = true);

-- store_productos
DROP POLICY IF EXISTS "store_productos_anon_select" ON public.store_productos;
CREATE POLICY "store_productos_anon_select" ON public.store_productos
  FOR SELECT TO anon
  USING (activo = true);
