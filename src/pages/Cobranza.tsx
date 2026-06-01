import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriangleAlert as AlertTriangle, Clock, CircleCheck as CheckCircle2, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LoadingState } from '../components/ui/loading-state';
import { EmptyState } from '../components/ui/empty-state';

interface BillingItem {
  id: string;
  no_poliza: string;
  cliente: string;
  importe_pendiente: number;
  fecha_limite: string;
  dias_vencidos: number;
  status: string;
}

export default function Cobranza() {
  const { customer } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<BillingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;
    supabase.from('sicas_cobranza_pendiente')
      .select('id,no_poliza,cliente,importe_pendiente,fecha_limite,dias_vencidos,status')
      .eq('usuario_id', customer.agent_user_id)
      .order('fecha_limite', { ascending: true })
      .then(({ data }) => { setItems(data || []); setLoading(false); });
  }, [customer]);

  function formatMXN(n: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
  }

  const totalPendiente = items.reduce((s, i) => s + i.importe_pendiente, 0);
  const vencidos = items.filter(i => i.dias_vencidos > 0);

  function openChavaCobranza() {
    navigate('/seguwallet/chava', { state: { modulo: 'cobranza', totalPendiente, totalRecibos: items.length } });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Pagos y Cobranza</h1>
          <p className="text-neutral-500 dark:text-white/50 text-sm mt-0.5">
            {items.length} recibo{items.length !== 1 ? 's' : ''} pendiente{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={openChavaCobranza}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
          <Sparkles className="w-4 h-4" />Preguntar a Chava
        </button>
      </div>

      {items.length > 0 && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-white dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/60 dark:border-white/8 p-4">
            <p className="text-xs text-neutral-500 dark:text-white/50 mb-1">Total pendiente</p>
            <p className="text-xl font-bold text-neutral-800 dark:text-white">{formatMXN(totalPendiente)}</p>
          </div>
          <div className="bg-white dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/60 dark:border-white/8 p-4">
            <p className="text-xs text-neutral-500 dark:text-white/50 mb-1">Recibos</p>
            <p className="text-xl font-bold text-neutral-800 dark:text-white">{items.length}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${vencidos.length > 0 ? 'bg-red-50 dark:bg-red-500/15 border-red-100 dark:border-red-500/20' : 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-100 dark:border-emerald-500/20'}`}>
            <p className={`text-xs mb-1 ${vencidos.length > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>Vencidos</p>
            <p className={`text-xl font-bold ${vencidos.length > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{vencidos.length}</p>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState compact />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="¡Todo al corriente!"
          description="No tienes pagos pendientes en este momento."
          compact
        />
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/60 dark:border-white/8 p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                item.dias_vencidos > 0 ? 'bg-red-50 dark:bg-red-500/15' : 'bg-amber-50 dark:bg-amber-500/15'
              }`}>
                {item.dias_vencidos > 0
                  ? <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                  : <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-neutral-800 dark:text-white text-sm">Póliza {item.no_poliza}</p>
                {item.cliente && <p className="text-xs text-neutral-400 dark:text-white/30 truncate">{item.cliente}</p>}
                <p className="text-xs text-neutral-400 dark:text-white/30 mt-0.5">
                  Límite: {new Date(item.fecha_limite).toLocaleDateString('es-MX')}
                  {item.dias_vencidos > 0 && (
                    <span className="ml-1 text-red-500 dark:text-red-400 font-medium">· {item.dias_vencidos} días vencido</span>
                  )}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-neutral-800 dark:text-white">{formatMXN(item.importe_pendiente)}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  item.dias_vencidos > 0
                    ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400'
                    : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                }`}>
                  {item.dias_vencidos > 0 ? 'Vencido' : 'Pendiente'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
