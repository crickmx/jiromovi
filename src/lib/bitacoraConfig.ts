// Lo que distingue a la bitácora de MOVI Store de la de Marketing Premium.
//
// Mismo criterio que triggersConfig.ts: un solo componente de tabla
// (BitacoraComercial.tsx), un objeto de configuración por módulo. Si mañana
// hay un tercer módulo con bitácora, lo que hace falta es otra entrada aquí.

import { tienePermisoAdminEnModulo, MODULOS, type UsuarioConPermisos } from './permisosUtils';
import { tieneAccesoEquipoStore } from './storeUtils';
import { tieneAccesoEquipoMkt } from './mktUtils';

export interface BitacoraRow {
  id: string;
  folio: string;
  fecha: string;
  solicitante_id: string | null;
  solicitante_nombre: string | null;
  responsable_id: string | null;
  responsable_nombre: string | null;
  cantidad: number;
  monto: number;
  forma_pago: string | null;
  metodo_pago: string | null;
  pagado: number;
  saldo: number;
  estado_pago: 'al_corriente' | 'debe' | 'a_favor' | 'sin_plan' | 'sin_monto';
  // Solo Marketing Premium: un periodo puede seguir activo o ya haberse cerrado.
  fecha_fin?: string | null;
  activo?: boolean;
}

export interface ConfigBitacora {
  vista: string;
  titulo: string;
  descripcion: string;
  /** Mismo chequeo de acceso que ya usa el admin de ese módulo -- nada nuevo. */
  tieneAcceso: (usuario: UsuarioConPermisos & { id: string }) => Promise<boolean>;
  nombreArchivoExport: string;
  labelFolio: string;
  labelCantidad: string;
  labelFormaPago: string;
  /** Marketing muestra columna "Activo/Cerrado"; Store no la necesita (no tiene ese concepto). */
  mostrarActivo?: boolean;
}

export const CONFIG_BITACORA_STORE: ConfigBitacora = {
  vista: 'store_bitacora_view',
  titulo: 'Bitácora de Pedidos — MOVI Store',
  descripcion: 'Folio, solicitante, responsable y pagos aplicados de cada pedido.',
  tieneAcceso: async (usuario) =>
    tienePermisoAdminEnModulo(usuario, MODULOS.STORE) || tieneAccesoEquipoStore(usuario.id),
  nombreArchivoExport: 'bitacora_store',
  labelFolio: 'Folio OC',
  labelCantidad: 'Cantidad',
  labelFormaPago: 'Forma de pago',
};

export const CONFIG_BITACORA_MKT: ConfigBitacora = {
  vista: 'mkt_premium_bitacora_view',
  titulo: 'Bitácora de Marketing Premium',
  descripcion: 'Periodos contratados, folio, pagos aplicados y estatus de cada agente.',
  tieneAcceso: async (usuario) =>
    usuario.rol === 'Administrador' || tieneAccesoEquipoMkt(usuario.id),
  nombreArchivoExport: 'bitacora_mkt_premium',
  labelFolio: 'Folio Premium',
  labelCantidad: 'Periodos',
  labelFormaPago: 'Plan',
  mostrarActivo: true,
};
