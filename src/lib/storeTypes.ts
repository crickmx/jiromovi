export interface StoreCategoria {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at: string;
}

export type TipoItem = 'producto' | 'servicio';
export type Disponibilidad = 'por_existencia' | 'por_pedido';

export interface StoreProducto {
  id: string;
  categoria_id: string;
  titulo: string;
  descripcion: string;
  precio: number;
  costo_base: number;
  imagen_url: string;
  activo: boolean;
  stock: number;
  stock_umbral: number;
  tipo?: string | null;
  tipo_item: TipoItem;
  disponibilidad: Disponibilidad;
  created_at: string;
  categoria?: StoreCategoria;
  costos_extras?: StoreProductoCostoExtra[];
  atributos?: StoreProductoAtributo[];
}

export interface StoreProductoCostoExtra {
  id: string;
  producto_id: string;
  concepto: string;
  tipo: string;
  descripcion?: string;
  monto: number;
  created_at: string;
}

export interface StoreProductoAtributo {
  id: string;
  producto_id: string;
  nombre: string;
  orden: number;
  created_at: string;
  opciones?: StoreProductoAtributoOpcion[];
}

export interface StoreProductoAtributoOpcion {
  id: string;
  atributo_id: string;
  valor: string;
  orden: number;
  activo: boolean;
  precio?: number | null;
  created_at: string;
}

export type TipoGasto = 'proveedor' | 'envio' | 'empaque' | 'comision' | 'logistica' | 'otro';

export interface StoreCarritoItem {
  id: string;
  usuario_id: string;
  producto_id: string;
  cantidad: number;
  atributos_seleccionados?: Record<string, string>;
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

export interface StoreMetodoPago {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

export interface StoreParcialidad {
  id: string;
  cantidad: number;
  orden: number;
  activo: boolean;
}

export interface StoreFrecuenciaPago {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

export interface StoreMetodoPagoCombinacion {
  id: string;
  metodo_id: string;
  parcialidad_id: string;
  frecuencia_id: string;
}

export interface StorePedido {
  id: string;
  usuario_id: string;
  notas_usuario?: string;
  direccion_entrega?: string;
  area_entrega?: string;
  estatus_id: string;
  created_at: string;
  updated_at: string;
  total?: number;
  responsable_pago_id?: string;
  // Campos de Orden de Compra
  forma_pago?: string;
  metodo_pago?: string;
  metodo_pago_otro_detalle?: string;
  folio_oc?: string;
  observaciones_oc?: string;
  oc_generada_por?: string;
  oc_generada_en?: string;
  // Campos de revision y cobro
  revisado_por?: string;
  cobrado?: boolean;
  cobrado_en?: string;
  cobrado_por?: string;
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
    atributos_seleccionados?: Record<string, string>;
    producto?: {
      titulo?: string;
      descripcion?: string;
      categoria?: {
        nombre?: string;
      };
    };
  }>;
}

export interface StorePedidoDetalle {
  id: string;
  pedido_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  costo_unitario_override?: number;
  atributos_seleccionados?: Record<string, string>;
  producto?: StoreProducto;
  gastos?: StorePedidoDetalleGasto[];
}

export interface StorePedidoGasto {
  id: string;
  pedido_id: string;
  concepto: string;
  tipo: string;
  descripcion?: string;
  monto: number;
  creado_por?: string;
  created_at: string;
}

export interface StorePedidoDetalleGasto {
  id: string;
  detalle_id: string;
  concepto: string;
  tipo: string;
  descripcion?: string;
  monto: number;
  monto_unitario: number;
  creado_por?: string;
  created_at: string;
}

export interface StoreGastoGeneral {
  id: string;
  concepto: string;
  tipo: string;
  descripcion?: string;
  monto: number;
  fecha: string;
  creado_por?: string;
  created_at: string;
}

export interface StoreMetaUtilidad {
  id: string;
  nombre: string;
  descripcion?: string;
  monto_objetivo: number;
  fecha_inicio: string;
  fecha_fin: string;
  activa: boolean;
  creado_por?: string;
  created_at: string;
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

export interface StorePedidoPago {
  id: string;
  pedido_id: string;
  fecha: string;
  metodo: string;
  monto: number;
  comentario?: string;
  registrado_por?: string;
  created_at: string;
  registrado_por_usuario?: {
    nombre: string;
  };
}

export const METODO_PAGO_OPCIONES = [
  'Transferencia',
  'Efectivo',
  'Tarjeta',
  'Cheque',
  'Descuento de Comisiones',
  'Cargo a Nomina',
  'Otro',
] as const;

export interface StorePedidoCompleto extends StorePedido {
  detalle: StorePedidoDetalle[];
  notas: StorePedidoNota[];
  historial: StorePedidoHistorial[];
  gastos?: StorePedidoGasto[];
  pagos?: StorePedidoPago[];
}

export const TIPO_GASTO_OPTIONS: { value: string; label: string }[] = [
  { value: 'proveedor', label: 'Proveedor' },
  { value: 'envio', label: 'Envio' },
  { value: 'empaque', label: 'Empaque' },
  { value: 'comision', label: 'Comision' },
  { value: 'logistica', label: 'Logistica' },
  { value: 'otro', label: 'Otro' },
];
