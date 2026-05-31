import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ChevronRight, Sparkles, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Policy {
  id: string;
  insurer_name: string;
  ramo: string;
  subramo: string | null;
  policy_number: string;
  insured_name: string | null;
  start_date: string;
  end_date: string;
  status: string;
  total_premium: number | null;
  currency: string | null;
  payment_frequency: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Vigente', color: 'emerald' },
  expired: { label: 'Vencida', color: 'red' },
  cancelled: { label: 'Cancelada', color: 'red' },
  pending: { label: 'Pendiente', color: 'amber' },
};

export default function Polizas() {
  const { customer } = useAuth();
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;
    supabase.from('seguwallet_external_policies')
      .select('*')
      .eq('seguwallet_customer_id', customer.id)
      .is('deleted_at', null)
      .order('end_date', { ascending: true })
      .then(({ data }) => { setPolicies(data || []); setLoading(false); });
  }, [customer]);

  function formatMXN(n: number | null) {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
  }

  function daysUntil(d: string) {
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Mis Pólizas</h1>
          <p className="text-slate-500 text-sm mt-0.5">{policies.length} póliza{policies.length !== 1 ? 's' : ''} registrada{policies.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/seguwallet/chava')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Preguntar a Chava
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : policies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-600 mb-1">Sin pólizas registradas</p>
          <p className="text-sm text-slate-400">Contacta a tu agente para agregar tus pólizas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map(p => {
            const st = STATUS_LABELS[p.status] || { label: p.status, color: 'slate' };
            const days = daysUntil(p.end_date);
            return (
              <button key={p.id} onClick={() => navigate(`/seguwallet/polizas/${p.id}`)}
                className="w-full bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all text-left flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-800">{p.insurer_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-${st.color}-50 text-${st.color}-700`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{p.ramo}{p.subramo ? ` · ${p.subramo}` : ''}</p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">{p.policy_number}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-800">{formatMXN(p.total_premium)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.payment_frequency || 'Anual'}</p>
                  <div className={`flex items-center gap-1 mt-1.5 justify-end text-xs font-medium ${
                    days < 0 ? 'text-red-500' : days < 30 ? 'text-amber-600' : 'text-slate-400'
                  }`}>
                    <Calendar className="w-3 h-3" />
                    {days < 0 ? 'Vencida' : days === 0 ? 'Vence hoy' : `${days}d restantes`}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
