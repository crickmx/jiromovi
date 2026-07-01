import { supabase } from '../../../lib/supabase';

// Fire-and-forget: no bloquea el flujo de la acción principal
export function logHistorial(
  tramiteTipoId: string,
  accion: string,
  detalles: Record<string, any>,
  usuarioId?: string,
  usuarioNombre?: string,
): void {
  supabase.from('tramite_tipo_historial').insert({
    tramite_tipo_id: tramiteTipoId,
    accion,
    detalles,
    usuario_id: usuarioId ?? null,
    usuario_nombre: usuarioNombre ?? null,
  }).then(() => {});
}
