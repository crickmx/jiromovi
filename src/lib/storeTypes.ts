export interface StoreCategoria {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  /** Productos de esta categoría se pueden pedir sin sesión en tienda.movi.digital */
  permite_pedido_publico?: boolean;
  created_at: string;
}

export type TipoItem = 'producto' | 'servicio';
export type Disponibilidad = 'por_existencia' | 'por_pedido';

export interface StoreProducto {
  id: string;
  categoria_id: string;
  orden: number;
  titulo: string;
  descripcion: string;
  precio: number;
  costo_base: number;
  imagen_url: string;
  imagen_personalizacion_url?: string | null;
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
  // Pedido público (sin sesión) — usuario_id es null hasta asociarlo
  es_publico?: boolean;
  invitado_nombre?: string | null;
  invitado_email?: string | null;
  invitado_whatsapp?: string | null;
  invitado_oficina_id?: string | null;
  invitado_oficina_nombre?: string | null;
  asociado_por?: string | null;
  asociado_en?: string | null;
  confirmacion_enviada_en?: string | null;
  confirmacion_email_ok?: boolean | null;
  confirmacion_whatsapp_ok?: boolean | null;
  confirmacion_error?: string | null;
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
  /**
   * Los cargos al cliente (envío, producción express…). Las listas los traen
   * resumidos —concepto y monto— porque el `total` de arriba ya los incluye y
   * sin ellos no habría forma de cuadrarlo. El pedido completo los trae enteros
   * en `StorePedidoCompleto.cargos`.
   */
  cargos?: Array<{ pedido_id: string; concepto: string; monto: number }>;
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

/** Lo que GASTA JIRO en el pedido. De aquí sale el margen; NO se le cobra al cliente. */
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

/**
 * Lo que se le COBRA al cliente además de los artículos: envío, producción
 * express, lo que surja. SUMA al total (`totalDelPedido` en
 * `storePedidoTotal.ts`).
 *
 * Es el reverso exacto de `StorePedidoGasto` y por eso son dos tablas: mezclar
 * "lo que gastamos" con "lo que cobramos" es lo que deja un pedido que nadie
 * puede leer sin preguntar de cuál de los dos se habla.
 */
export interface StorePedidoCargo {
  id: string;
  pedido_id: string;
  concepto: string;
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
  /** Los cargos al cliente. El total del pedido los suma. */
  cargos?: StorePedidoCargo[];
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
