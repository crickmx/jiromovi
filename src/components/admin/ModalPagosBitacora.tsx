// El control de pagos de una fila de la bitácora, sin salir de la bitácora.
//
// Antes el clic navegaba a otra pantalla: se perdía la lista, los filtros y el
// lugar donde ibas. Revisar quién debe es un trabajo de ir fila por fila, así
// que el control se abre encima y al cerrarlo sigues donde estabas.

import { useCallback, useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PagosPremiumPanel } from '../marketing/PagosPremiumPanel';
import { ETIQUETA_MODULO, rutaDePagos, type BitacoraRow } from '../../lib/bitacoraConfig';
import type { PlanPremium } from '../../lib/mktPremiumPagos';

const pesos = (n: number) =>
  `$${(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface PagoStore {
  id: string;
  fecha: string;
  metodo: string;
  monto: number;
  comentario: string | null;
}

/** Los pagos de un pedido de Store, de solo lectura: registrarlos vive en el detalle del pedido. */
function PagosDePedido({ pedidoId }: { pedidoId: string }) {
  const [pagos, setPagos] = useState<PagoStore[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('store_pedido_pagos')
      .select('id, fecha, metodo, monto, comentario')
      .eq('pedido_id', pedidoId)
      .order('fecha', { ascending: false });
    setPagos((data ?? []) as PagoStore[]);
    setCargando(false);
  }, [pedidoId]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return <p className="text-sm text-neutral-400 py-4">Cargando pagos…</p>;
  if (pagos.length === 0) return <p className="text-sm text-neutral-400 py-4">Todavía no hay pagos registrados.</p>;

  return (
    <div className="divide-y divide-neutral-100 dark:divide-white/5">
      {pagos.map(p => (
        <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm text-neutral-800 dark:text-white/90">{pesos(Number(p.monto))}</p>
            <p className="text-xs text-neutral-500">
              {new Date(p.fecha).toLocaleDateString('es-MX')} · {p.metodo}
              {p.comentario ? ` · ${p.comentario}` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ModalPagosBitacora({ row, onCerrar }: { row: BitacoraRow; onCerrar: () => void }) {
  const navigate = useNavigate();

  // Cerrar con Escape: el modal se abre y se cierra decenas de veces seguidas
  // cuando se está revisando la cartera.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCerrar}>
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-neutral-900 flex items-start justify-between gap-3 px-6 py-4 border-b border-neutral-100 dark:border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${row.modulo === 'store' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                {ETIQUETA_MODULO[row.modulo]}
              </span>
              <span className="font-mono text-xs text-neutral-500">{row.folio ?? 'Sin folio'}</span>
            </div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white mt-1 truncate">
              {row.solicitante_nombre ?? '—'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {pesos(Number(row.monto))} · pagado {pesos(Number(row.pagado))} · saldo{' '}
              <strong className={Number(row.saldo) > 0.01 ? 'text-amber-600' : 'text-emerald-600'}>
                {pesos(Number(row.saldo))}
              </strong>
            </p>
          </div>
          <button onClick={onCerrar} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg shrink-0">
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        <div className="px-6 py-4">
          {row.modulo === 'premium' && row.solicitante_id ? (
            <PagosPremiumPanel
              usuarioId={row.solicitante_id}
              periodoId={row.id}
              folio={row.folio}
              plan={(row.plan ?? null) as PlanPremium | null}
              puedeEditar
            />
          ) : (
            <>
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-white mb-1">Pagos registrados</h3>
              <p className="text-xs text-neutral-500 mb-2">
                Para registrar un pago nuevo hay que abrir el pedido: ahí viven las validaciones de método y forma de pago.
              </p>
              <PagosDePedido pedidoId={row.destino_id} />
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-neutral-900 flex justify-end px-6 py-3 border-t border-neutral-100 dark:border-white/10">
          <button
            onClick={() => navigate(rutaDePagos(row))}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-accent text-white hover:opacity-90"
          >
            <ExternalLink className="w-4 h-4" />
            {row.modulo === 'store' ? 'Abrir el pedido' : 'Abrir la ficha del agente'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalPagosBitacora;
