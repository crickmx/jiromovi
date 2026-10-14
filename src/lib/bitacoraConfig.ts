// La bitácora comercial: pedidos de MOVI Store y periodos de Marketing Premium
// en una sola tabla.
//
// Antes eran dos pantallas separadas, una por módulo, y para ver todo lo que un
// agente debe había que entrar a las dos. Ahora es una sola con filtros — por
// módulo, por oficina y por nombre.

import { tienePermisoAdminEnModulo, MODULOS, type UsuarioConPermisos } from './permisosUtils';
import { tieneAccesoEquipoStore } from './storeUtils';
import { tieneAccesoEquipoMkt } from './mktUtils';

export type ModuloBitacora = 'store' | 'premium';

export interface BitacoraRow {
  modulo: ModuloBitacora;
  id: string;
  /** A dónde lleva el clic: el pedido en Store, la ficha del agente en Premium. */
  destino_id: string;
  folio: string | null;
  fecha: string;
  solicitante_id: string | null;
  solicitante_nombre: string | null;
  oficina_id: string | null;
  oficina_nombre: string | null;
  responsable_nombre: string | null;
  cantidad: number;
  monto: number;
  forma_pago: string | null;
  metodo_pago: string | null;
  pagado: number;
  saldo: number;
  activo: boolean;
  estado_pago: 'al_corriente' | 'debe' | 'a_favor' | 'sin_plan' | 'sin_monto';
}

export const VISTA_BITACORA = 'bitacora_comercial_view';

export const ETIQUETA_MODULO: Record<ModuloBitacora, string> = {
  store: 'MOVI Store',
  premium: 'Marketing Premium',
};

/**
 * Qué módulos puede ver cada quien.
 *
 * No hay permiso nuevo: se reusa el mismo chequeo que ya usa el admin de cada
 * módulo. Quien solo administra Store ve solo las filas de Store.
 */
export async function modulosVisibles(
  usuario: UsuarioConPermisos & { id: string },
): Promise<ModuloBitacora[]> {
  const [store, premium] = await Promise.all([
    Promise.resolve(tienePermisoAdminEnModulo(usuario, MODULOS.STORE)).then(
      ok => ok || tieneAccesoEquipoStore(usuario.id),
    ),
    usuario.rol === 'Administrador' ? Promise.resolve(true) : tieneAccesoEquipoMkt(usuario.id),
  ]);

  const modulos: ModuloBitacora[] = [];
  if (store) modulos.push('store');
  if (premium) modulos.push('premium');
  return modulos;
}

/** A dónde va el clic de una fila: siempre al control de pagos de ese registro. */
export function rutaDePagos(row: BitacoraRow): string {
  return row.modulo === 'store'
    ? `/store/pedidos/${row.destino_id}`
    : `/mercadotecnia/admin?tab=premium&agente=${row.destino_id}`;
}

export const ETIQUETA_ESTADO: Record<BitacoraRow['estado_pago'], { texto: string; clase: string }> = {
  al_corriente: { texto: 'Al corriente', clase: 'bg-emerald-100 text-emerald-700' },
  debe:         { texto: 'Debe',         clase: 'bg-amber-100 text-amber-700' },
  a_favor:      { texto: 'A favor',      clase: 'bg-sky-100 text-sky-700' },
  sin_plan:     { texto: 'Sin plan',     clase: 'bg-neutral-100 text-neutral-500' },
  sin_monto:    { texto: 'Sin monto',    clase: 'bg-neutral-100 text-neutral-500' },
};
