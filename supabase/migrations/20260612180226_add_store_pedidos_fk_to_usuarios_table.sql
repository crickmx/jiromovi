
-- Add FK constraints from store_pedidos to the usuarios table
-- so Supabase relational joins work correctly

ALTER TABLE store_pedidos
  ADD CONSTRAINT store_pedidos_usuario_id_usuarios_fkey
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE store_pedidos
  ADD CONSTRAINT store_pedidos_oc_generada_por_usuarios_fkey
    FOREIGN KEY (oc_generada_por) REFERENCES usuarios(id) ON DELETE SET NULL;
