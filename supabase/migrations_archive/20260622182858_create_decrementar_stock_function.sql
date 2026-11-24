CREATE OR REPLACE FUNCTION decrementar_stock(p_producto_id uuid, p_cantidad integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE store_productos
  SET stock = GREATEST(0, stock - p_cantidad)
  WHERE id = p_producto_id;
END;
$$;
