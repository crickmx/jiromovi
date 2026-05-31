import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriangleAlert as AlertTriangle, Clock, CircleCheck as CheckCircle2, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

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
          <h1 className="text-xl font-bold text-slate-800">Pagos y Cobranza</h1>
          <p className="text-slate-500 text-sm mt-0.5">{items.length} recibo{items.length !== 1 ? 's' : ''} pendiente{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openChavaCobranza}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-colors">
          <Sparkles className="w-4 h-4" />Preguntar a Chava
        </button>
      </div>

      {/* Summary cards */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500 mb-1">Total pendiente</p>
            <p className="text-xl font-bold text-slate-800">{formatMXN(totalPendiente)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500 mb-1">Recibos</p>
            <p className="text-xl font-bold text-slate-800">{items.length}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${vencidos.length > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
            <p className={`text-xs mb-1 ${vencidos.length > 0 ? 'text-red-500' : 'text-emerald-600'}`}>Vencidos</p>
            <p className={`text-xl font-bold ${vencidos.length > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{vencidos.length}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="font-semibold text-slate-600 mb-1">¡Todo al corriente!</p>
          <p className="text-sm text-slate-400">No tienes pagos pendientes en este momento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                item.dias_vencidos > 0 ? 'bg-red-50' : 'bg-amber-50'
              }`}>
                {item.dias_vencidos > 0
                  ? <AlertTriangle className="w-5 h-5 text-red-500" />
                  : <Clock className="w-5 h-5 text-amber-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">Póliza {item.no_poliza}</p>
                {item.cliente && <p className="text-xs text-slate-400 truncate">{item.cliente}</p>}
                <p className="text-xs text-slate-400 mt-0.5">
                  Límite: {new Date(item.fecha_limite).toLocaleDateString('es-MX')}
                  {item.dias_vencidos > 0 && (
                    <span className="ml-1 text-red-500 font-medium">· {item.dias_vencidos} días vencido</span>
                  )}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-slate-800">{formatMXN(item.importe_pendiente)}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  item.dias_vencidos > 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
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
