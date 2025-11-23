export interface StoreCategoria {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at: string;
}

export interface StoreProducto {
  id: string;
  categoria_id: string;
  titulo: string;
  descripcion: string;
  precio: number;
  imagen_url: string;
  activo: boolean;
  created_at: string;
  categoria?: StoreCategoria;
}

export interface StoreCarritoItem {
  id: string;
  usuario_id: string;
  producto_id: string;
  cantidad: number;
  created_at: string;
  producto?: StoreProducto;
}

export interface StoreEstatusPedido {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at: string;
}

export interface StorePedido {
  id: string;
  usuario_id: string;
  notas_usuario?: string;
  direccion_entrega?: string;
  estatus_id: string;
  created_at: string;
  updated_at: string;
  total?: number;
  estatus?: StoreEstatusPedido;
  usuario?: {
    nombre: string;
  };
}

export interface StorePedidoDetalle {
  id: string;
  pedido_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  producto?: StoreProducto;
}

export interface StorePedidoNota {
  id: string;
  pedido_id: string;
  admin_id: string;
  nota: string;
  created_at: string;
  admin?: {
    nombre: string;
  };
}

export interface StorePedidoHistorial {
  id: string;
  pedido_id: string;
  estatus_id: string;
  cambiado_por?: string;
  created_at: string;
  estatus?: StoreEstatusPedido;
  usuario?: {
    nombre: string;
  };
}

export interface StorePedidoCompleto extends StorePedido {
  detalle: StorePedidoDetalle[];
  notas: StorePedidoNota[];
  historial: StorePedidoHistorial[];
}
