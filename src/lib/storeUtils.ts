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
  const { data: pedidos, error } = await supabase
    .from('store_pedidos')
    .select(`
      *,
      estatus:store_estatus_pedidos(*)
    `)
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!pedidos || pedidos.length === 0) return [];

  // Obtener detalles para calcular totales
  const pedidoIds = pedidos.map(p => p.id);
  const { data: detalles } = await supabase
    .from('store_pedidos_detalle')
    .select('pedido_id, cantidad, precio_unitario')
    .in('pedido_id', pedidoIds);

  // Calcular totales
  const totalesPorPedido = new Map<string, number>();
  if (detalles) {
    detalles.forEach(detalle => {
      const total = totalesPorPedido.get(detalle.pedido_id) || 0;
      totalesPorPedido.set(
        detalle.pedido_id,
        total + (detalle.cantidad * detalle.precio_unitario)
      );
    });
  }

  // Agregar totales a pedidos
  const pedidosConTotal = pedidos.map(pedido => ({
    ...pedido,
    total: totalesPorPedido.get(pedido.id) || 0
  }));

  return pedidosConTotal as StorePedido[];
}

export async function obtenerTodosPedidos() {
  console.log('🔍 Obteniendo todos los pedidos del sistema...');

  try {
    // Primero obtener los pedidos con estatus
    const { data: pedidos, error: pedidosError } = await supabase
      .from('store_pedidos')
      .select(`
        *,
        estatus:store_estatus_pedidos(*)
      `)
      .order('created_at', { ascending: false });

    if (pedidosError) {
      console.error('❌ Error obteniendo pedidos:', pedidosError);
      throw pedidosError;
    }

    if (!pedidos || pedidos.length === 0) {
      console.log('ℹ️ No hay pedidos en el sistema');
      return [];
    }

    // Obtener IDs únicos de usuarios
    const usuarioIds = [...new Set(pedidos.map(p => p.usuario_id))];
    console.log(`📋 Pedidos: ${pedidos.length}, Usuarios: ${usuarioIds.length}`);

    // Obtener información de los usuarios
    const { data: usuarios, error: usuariosError } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .in('id', usuarioIds);

    if (usuariosError) {
      console.error('⚠️ Error obteniendo usuarios:', usuariosError);
      // Continuar sin nombres de usuario
    }

    // Obtener todos los detalles de pedidos para calcular totales
    const pedidoIds = pedidos.map(p => p.id);
    const { data: detalles, error: detallesError } = await supabase
      .from('store_pedidos_detalle')
      .select('pedido_id, cantidad, precio_unitario')
      .in('pedido_id', pedidoIds);

    if (detallesError) {
      console.error('⚠️ Error obteniendo detalles:', detallesError);
      // Continuar sin totales
    }

    // Calcular totales por pedido
    const totalesPorPedido = new Map<string, number>();
    if (detalles) {
      detalles.forEach(detalle => {
        const total = totalesPorPedido.get(detalle.pedido_id) || 0;
        totalesPorPedido.set(
          detalle.pedido_id,
          total + (detalle.cantidad * detalle.precio_unitario)
        );
      });
      console.log(`💰 Totales calculados para ${totalesPorPedido.size} pedidos`);
    }

    // Mapear usuarios y totales a los pedidos
    const pedidosConUsuarios = pedidos.map(pedido => ({
      ...pedido,
      usuario: usuarios?.find(u => u.id === pedido.usuario_id),
      total: totalesPorPedido.get(pedido.id) || 0
    }));

    console.log(`✅ Pedidos cargados exitosamente: ${pedidosConUsuarios.length} pedidos`);
    return pedidosConUsuarios as StorePedido[];

  } catch (error) {
    console.error('❌ Error fatal en obtenerTodosPedidos:', error);
    throw error;
  }
}

export async function obtenerPedidoCompleto(pedidoId: string): Promise<StorePedidoCompleto> {
  // Obtener pedido con estatus
  const { data: pedido, error: pedidoError } = await supabase
    .from('store_pedidos')
    .select(`
      *,
      estatus:store_estatus_pedidos(*)
    `)
    .eq('id', pedidoId)
    .single();

  if (pedidoError) throw pedidoError;

  // Obtener usuario del pedido con información completa
  const { data: usuarioData } = await supabase
    .from('usuarios')
    .select('nombre, nombre_completo, oficina_id, celular_laboral, celular_personal, email_laboral, rol')
    .eq('id', pedido.usuario_id)
    .single();

  // Obtener información de la oficina si existe
  let oficinaData = null;
  if (usuarioData?.oficina_id) {
    const { data } = await supabase
      .from('oficinas')
      .select('nombre')
      .eq('id', usuarioData.oficina_id)
      .single();
    oficinaData = data;
  }

  // Obtener nombre SICAS del usuario
  let nombreSicas = null;
  if (pedido.usuario_id) {
    const { data } = await supabase
      .from('accesos_nacional')
      .select('usuario_sicas')
      .eq('usuario_id', pedido.usuario_id)
      .maybeSingle();
    nombreSicas = data?.usuario_sicas || null;
  }

  // Obtener información del responsable de pago (si existe)
  let responsablePago = null;
  if (pedido.responsable_pago_id) {
    const { data } = await supabase
      .from('usuarios')
      .select('nombre, nombre_completo')
      .eq('id', pedido.responsable_pago_id)
      .maybeSingle();
    responsablePago = data;
  }

  // Obtener información del admin que generó la OC (si existe)
  let ocGeneradaPorUsuario = null;
  if (pedido.oc_generada_por) {
    const { data } = await supabase
      .from('usuarios')
      .select('nombre_completo')
      .eq('id', pedido.oc_generada_por)
      .single();
    ocGeneradaPorUsuario = data;
  }

  // Construir objeto usuario completo
  const usuario = {
    nombre: usuarioData?.nombre || '',
    nombre_completo: usuarioData?.nombre_completo || usuarioData?.nombre || '',
    nombre_sicas: nombreSicas,
    oficina: oficinaData?.nombre || 'Sin oficina asignada',
    telefono: usuarioData?.celular_laboral || usuarioData?.celular_personal || 'Sin teléfono',
    celular_laboral: usuarioData?.celular_laboral,
    celular_personal: usuarioData?.celular_personal,
    email_laboral: usuarioData?.email_laboral,
    rol: usuarioData?.rol
  };

  // Agregar usuario y responsable de pago al pedido
  const pedidoConUsuario = {
    ...pedido,
    usuario,
    responsable_pago: responsablePago
  };

  // Obtener detalle
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

  // Obtener notas con información del admin
  const { data: notasData, error: notasError } = await supabase
    .from('store_pedidos_notas')
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('created_at', { ascending: false });

  if (notasError) throw notasError;

  // Obtener información de admins para las notas
  let notas = notasData || [];
  if (notas.length > 0) {
    const adminIds = [...new Set(notas.map(n => n.admin_id).filter(Boolean))];
    if (adminIds.length > 0) {
      const { data: admins } = await supabase
        .from('usuarios')
        .select('id, nombre')
        .in('id', adminIds);

      notas = notas.map(nota => ({
        ...nota,
        admin: admins?.find(a => a.id === nota.admin_id)
      }));
    }
  }

  // Obtener historial con estatus
  const { data: historialData, error: historialError } = await supabase
    .from('store_pedidos_historial')
    .select(`
      *,
      estatus:store_estatus_pedidos(*)
    `)
    .eq('pedido_id', pedidoId)
    .order('created_at', { ascending: false });

  if (historialError) throw historialError;

  // Obtener información de usuarios para el historial
  let historial = historialData || [];
  if (historial.length > 0) {
    const usuarioIds = [...new Set(historial.map(h => h.cambiado_por).filter(Boolean))];
    if (usuarioIds.length > 0) {
      const { data: usuarios } = await supabase
        .from('usuarios')
        .select('id, nombre')
        .in('id', usuarioIds);

      historial = historial.map(h => ({
        ...h,
        usuario: usuarios?.find(u => u.id === h.cambiado_por)
      }));
    }
  }

  return {
    ...pedidoConUsuario,
    detalle: detalle as StorePedidoDetalle[],
    notas: notas as StorePedidoNota[],
    historial: historial as StorePedidoHistorial[],
    oc_generada_por_usuario: ocGeneradaPorUsuario
  } as StorePedidoCompleto;
}

export async function crearPedido(
  usuarioId: string,
  itemsCarrito: StoreCarritoItem[],
  notasUsuario?: string,
  direccionEntrega?: string,
  responsablePagoId?: string
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
      estatus_id: estatusId,
      responsable_pago_id: responsablePagoId || null
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

  // Obtener información del usuario que realizó el pedido
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nombre, nombre_completo')
    .eq('id', usuarioId)
    .single();

  const nombreUsuario = usuario?.nombre_completo || usuario?.nombre || 'Usuario';

  // Obtener todos los administradores
  const { data: administradores } = await supabase
    .from('usuarios')
    .select('id')
    .eq('rol', 'Administrador')
    .eq('estado', 'Activo');

  // Crear notificación para cada administrador
  if (administradores && administradores.length > 0) {
    const notificaciones = administradores.map(admin => ({
      usuario_id: admin.id,
      titulo: 'Nuevo pedido en Store',
      mensaje: `${nombreUsuario} realizó un nuevo pedido en Store.`,
      modulo: 'Store',
      accion_url: `/store/pedidos/${pedido.id}`,
      accion_texto: 'Ver pedido',
      leida: false
    }));

    const { error: notificacionesError } = await supabase
      .from('notificaciones')
      .insert(notificaciones);

    if (notificacionesError) {
      console.error('Error creando notificaciones:', notificacionesError);
    }
  }

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

export async function eliminarPedido(pedidoId: string) {
  const { error } = await supabase
    .from('store_pedidos')
    .delete()
    .eq('id', pedidoId);

  if (error) throw error;
}
