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

export type FormaPagoOC = 'Contado' | 'Mensual' | 'Trimestral' | 'Semestral';

export type MetodoPagoOC =
  | 'Cargo a Oficina'
  | 'Cargo a Bono de Agente'
  | 'Pago Directo'
  | 'Descuento de Comisiones'
  | 'Cargo a Nómina'
  | 'Otro';

export interface StorePedido {
  id: string;
  usuario_id: string;
  notas_usuario?: string;
  direccion_entrega?: string;
  estatus_id: string;
  created_at: string;
  updated_at: string;
  total?: number;
  responsable_pago_id?: string;
  // Campos de Orden de Compra
  forma_pago?: FormaPagoOC;
  metodo_pago?: MetodoPagoOC;
  metodo_pago_otro_detalle?: string;
  folio_oc?: string;
  observaciones_oc?: string;
  oc_generada_por?: string;
  oc_generada_en?: string;
  // Relaciones
  estatus?: StoreEstatusPedido;
  usuario?: {
    nombre: string;
    nombre_completo?: string;
    nombre_sicas?: string;
    clave_agente?: string;
    oficina?: string;
    telefono?: string;
    celular_laboral?: string;
    celular_personal?: string;
    email?: string;
    email_laboral?: string;
    rol?: string;
  };
  responsable_pago?: {
    nombre_completo?: string;
    nombre?: string;
  };
  oc_generada_por_usuario?: {
    nombre_completo?: string;
  };
  detalles?: Array<{
    pedido_id: string;
    cantidad: number;
    precio_unitario: number;
    producto?: {
      titulo?: string;
      descripcion?: string;
    };
  }>;
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
