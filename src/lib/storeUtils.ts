import { supabase } from './supabase';
import type {
  StoreCategoria,
  StoreProducto,
  StoreCarritoItem,
  StoreEstatusPedido,
  StorePedido,
  StorePedidoDetalle,
  StorePedidoNota,
  StorePedidoHistorial,
  StorePedidoCompleto
} from './storeTypes';

// ============================================
// CATEGORÍAS
// ============================================

export async function obtenerCategorias() {
  const { data, error } = await supabase
    .from('store_categorias')
    .select('*')
    .eq('activo', true)
    .order('nombre');

  if (error) throw error;
  return data as StoreCategoria[];
}

export async function obtenerTodasCategorias() {
  const { data, error } = await supabase
    .from('store_categorias')
    .select('*')
    .order('nombre');

  if (error) throw error;
  return data as StoreCategoria[];
}

export async function crearCategoria(categoria: Omit<StoreCategoria, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('store_categorias')
    .insert(categoria)
    .select()
    .single();

  if (error) throw error;
  return data as StoreCategoria;
}

export async function actualizarCategoria(id: string, cambios: Partial<StoreCategoria>) {
  const { data, error } = await supabase
    .from('store_categorias')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as StoreCategoria;
}

export async function eliminarCategoria(id: string) {
  const { error } = await supabase
    .from('store_categorias')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// PRODUCTOS
// ============================================

export async function obtenerProductos(categoriaId?: string) {
  let query = supabase
    .from('store_productos')
    .select(`
      *,
      categoria:store_categorias(*)
    `)
    .eq('activo', true)
    .order('created_at', { ascending: false });

  if (categoriaId) {
    query = query.eq('categoria_id', categoriaId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as StoreProducto[];
}

export async function obtenerTodosProductos() {
  const { data, error } = await supabase
    .from('store_productos')
    .select(`
      *,
      categoria:store_categorias(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as StoreProducto[];
}

export async function obtenerProductoPorId(id: string) {
  const { data, error } = await supabase
    .from('store_productos')
    .select(`
      *,
      categoria:store_categorias(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as StoreProducto;
}

export async function crearProducto(producto: Omit<StoreProducto, 'id' | 'created_at' | 'categoria'>) {
  console.log('Creando producto con datos:', producto);

  const { data, error } = await supabase
    .from('store_productos')
    .insert(producto)
    .select()
    .single();

  if (error) {
    console.error('Error creando producto:', error);
    throw new Error(`Error al crear producto: ${error.message} (${error.code})`);
  }

  console.log('Producto creado exitosamente:', data);
  return data as StoreProducto;
}

export async function actualizarProducto(id: string, cambios: Partial<Omit<StoreProducto, 'categoria'>>) {
  const { data, error } = await supabase
    .from('store_productos')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as StoreProducto;
}

export async function eliminarProducto(id: string) {
  const { error } = await supabase
    .from('store_productos')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function subirImagenProducto(file: File): Promise<string> {
  try {
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const path = `productos/${timestamp}.${extension}`;

    console.log('Subiendo imagen:', { path, fileName: file.name, fileSize: file.size, fileType: file.type });

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('store-productos')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error subiendo imagen:', uploadError);
      throw new Error(`Error al subir imagen: ${uploadError.message}`);
    }

    console.log('Imagen subida exitosamente:', uploadData);

    const { data } = supabase.storage
      .from('store-productos')
      .getPublicUrl(path);

    console.log('URL pública generada:', data.publicUrl);

    return data.publicUrl;
  } catch (error: any) {
    console.error('Error en subirImagenProducto:', error);
    throw error;
  }
}

// ============================================
// CARRITO
// ============================================

export async function obtenerCarrito(usuarioId: string) {
  const { data, error } = await supabase
    .from('store_carrito')
    .select(`
      *,
      producto:store_productos(
        *,
        categoria:store_categorias(*)
      )
    `)
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as StoreCarritoItem[];
}

export async function agregarAlCarrito(usuarioId: string, productoId: string, cantidad: number) {
  const { data: existente } = await supabase
    .from('store_carrito')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('producto_id', productoId)
    .maybeSingle();

  if (existente) {
    const { data, error } = await supabase
      .from('store_carrito')
      .update({ cantidad: existente.cantidad + cantidad })
      .eq('id', existente.id)
      .select()
      .single();

    if (error) throw error;
    return data as StoreCarritoItem;
  } else {
    const { data, error } = await supabase
      .from('store_carrito')
      .insert({
        usuario_id: usuarioId,
        producto_id: productoId,
        cantidad
      })
      .select()
      .single();

    if (error) throw error;
    return data as StoreCarritoItem;
  }
}

export async function actualizarCantidadCarrito(id: string, cantidad: number) {
  const { data, error } = await supabase
    .from('store_carrito')
    .update({ cantidad })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as StoreCarritoItem;
}

export async function eliminarDelCarrito(id: string) {
  const { error } = await supabase
    .from('store_carrito')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function vaciarCarrito(usuarioId: string) {
  const { error } = await supabase
    .from('store_carrito')
    .delete()
    .eq('usuario_id', usuarioId);

  if (error) throw error;
}

// ============================================
// ESTATUS DE PEDIDOS
// ============================================

export async function obtenerEstatus() {
  const { data, error } = await supabase
    .from('store_estatus_pedidos')
    .select('*')
    .eq('activo', true)
    .order('orden');

  if (error) throw error;
  return data as StoreEstatusPedido[];
}

export async function obtenerTodosEstatus() {
  const { data, error } = await supabase
    .from('store_estatus_pedidos')
    .select('*')
    .order('orden');

  if (error) throw error;
  return data as StoreEstatusPedido[];
}

export async function crearEstatus(estatus: Omit<StoreEstatusPedido, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('store_estatus_pedidos')
    .insert(estatus)
    .select()
    .single();

  if (error) throw error;
  return data as StoreEstatusPedido;
}

export async function actualizarEstatus(id: string, cambios: Partial<StoreEstatusPedido>) {
  const { data, error } = await supabase
    .from('store_estatus_pedidos')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as StoreEstatusPedido;
}

// ============================================
// PEDIDOS
// ============================================

export async function obtenerPedidosUsuario(usuarioId: string) {
  const { data, error } = await supabase
    .from('store_pedidos')
    .select(`
      *,
      estatus:store_estatus_pedidos(*)
    `)
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as StorePedido[];
}

export async function obtenerTodosPedidos() {
  console.log('Obteniendo todos los pedidos...');

  const { data, error } = await supabase
    .from('store_pedidos')
    .select(`
      *,
      estatus:store_estatus_pedidos(*),
      usuario:usuarios(nombre)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error obteniendo pedidos:', error);
    throw error;
  }

  console.log('Pedidos obtenidos:', data?.length || 0);
  return data as StorePedido[];
}

export async function obtenerPedidoCompleto(pedidoId: string): Promise<StorePedidoCompleto> {
  const { data: pedido, error: pedidoError } = await supabase
    .from('store_pedidos')
    .select(`
      *,
      estatus:store_estatus_pedidos(*),
      usuario:usuarios(nombre)
    `)
    .eq('id', pedidoId)
    .single();

  if (pedidoError) throw pedidoError;

  const { data: detalle, error: detalleError } = await supabase
    .from('store_pedidos_detalle')
    .select(`
      *,
      producto:store_productos(
        *,
        categoria:store_categorias(*)
      )
    `)
    .eq('pedido_id', pedidoId);

  if (detalleError) throw detalleError;

  const { data: notas, error: notasError } = await supabase
    .from('store_pedidos_notas')
    .select(`
      *,
      admin:usuarios(nombre)
    `)
    .eq('pedido_id', pedidoId)
    .order('created_at', { ascending: false });

  if (notasError) throw notasError;

  const { data: historial, error: historialError } = await supabase
    .from('store_pedidos_historial')
    .select(`
      *,
      estatus:store_estatus_pedidos(*),
      usuario:usuarios(nombre)
    `)
    .eq('pedido_id', pedidoId)
    .order('created_at', { ascending: false });

  if (historialError) throw historialError;

  return {
    ...pedido,
    detalle: detalle as StorePedidoDetalle[],
    notas: notas as StorePedidoNota[],
    historial: historial as StorePedidoHistorial[]
  } as StorePedidoCompleto;
}

export async function crearPedido(
  usuarioId: string,
  itemsCarrito: StoreCarritoItem[],
  notasUsuario?: string,
  direccionEntrega?: string
) {
  const estatusPendiente = await obtenerEstatus();
  const estatusId = estatusPendiente.find(e => e.nombre === 'Pendiente')?.id;

  if (!estatusId) throw new Error('No se encontró el estatus "Pendiente"');

  const { data: pedido, error: pedidoError } = await supabase
    .from('store_pedidos')
    .insert({
      usuario_id: usuarioId,
      notas_usuario: notasUsuario,
      direccion_entrega: direccionEntrega,
      estatus_id: estatusId
    })
    .select()
    .single();

  if (pedidoError) throw pedidoError;

  const detalle = itemsCarrito.map(item => ({
    pedido_id: pedido.id,
    producto_id: item.producto_id,
    cantidad: item.cantidad,
    precio_unitario: item.producto!.precio
  }));

  const { error: detalleError } = await supabase
    .from('store_pedidos_detalle')
    .insert(detalle);

  if (detalleError) throw detalleError;

  const { error: historialError } = await supabase
    .from('store_pedidos_historial')
    .insert({
      pedido_id: pedido.id,
      estatus_id: estatusId,
      cambiado_por: usuarioId
    });

  if (historialError) throw historialError;

  await vaciarCarrito(usuarioId);

  return pedido as StorePedido;
}

export async function actualizarEstatusPedido(pedidoId: string, nuevoEstatusId: string) {
  const { data: pedido, error: pedidoError } = await supabase
    .from('store_pedidos')
    .update({ estatus_id: nuevoEstatusId })
    .eq('id', pedidoId)
    .select()
    .single();

  if (pedidoError) throw pedidoError;

  const { error: historialError } = await supabase
    .from('store_pedidos_historial')
    .insert({
      pedido_id: pedidoId,
      estatus_id: nuevoEstatusId,
      cambiado_por: (await supabase.auth.getUser()).data.user?.id
    });

  if (historialError) throw historialError;

  return pedido as StorePedido;
}

export async function agregarNotaPedido(pedidoId: string, nota: string) {
  const { data, error } = await supabase
    .from('store_pedidos_notas')
    .insert({
      pedido_id: pedidoId,
      nota,
      admin_id: (await supabase.auth.getUser()).data.user?.id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
