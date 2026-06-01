import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ChevronRight, Sparkles, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LoadingState } from '../components/ui/loading-state';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/ui/empty-state';

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

type BadgeVariant = 'success' | 'danger' | 'warning' | 'neutral';

const STATUS_LABELS: Record<string, { label: string; variant: BadgeVariant }> = {
  active:    { label: 'Vigente',    variant: 'success' },
  expired:   { label: 'Vencida',   variant: 'danger' },
  cancelled: { label: 'Cancelada', variant: 'danger' },
  pending:   { label: 'Pendiente', variant: 'warning' },
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
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Mis Pólizas</h1>
          <p className="text-neutral-500 dark:text-white/50 text-sm mt-0.5">
            {policies.length} póliza{policies.length !== 1 ? 's' : ''} registrada{policies.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/seguwallet/chava')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Preguntar a Chava
        </button>
      </div>

      {loading ? (
        <LoadingState compact />
      ) : policies.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin pólizas registradas"
          description="Contacta a tu agente para agregar tus pólizas."
          compact
        />
      ) : (
        <div className="space-y-3">
          {policies.map(p => {
            const st = STATUS_LABELS[p.status] || { label: p.status, variant: 'neutral' as BadgeVariant };
            const days = daysUntil(p.end_date);
            return (
              <button key={p.id} onClick={() => navigate(`/seguwallet/polizas/${p.id}`)}
                className="w-full bg-white dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/60 dark:border-white/8 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all text-left flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-neutral-800 dark:text-white">{p.insurer_name}</p>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-white/50">{p.ramo}{p.subramo ? ` · ${p.subramo}` : ''}</p>
                  <p className="text-xs text-neutral-400 dark:text-white/30 mt-1 font-mono">{p.policy_number}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-neutral-800 dark:text-white">{formatMXN(p.total_premium)}</p>
                  <p className="text-xs text-neutral-400 dark:text-white/30 mt-0.5">{p.payment_frequency || 'Anual'}</p>
                  <div className={`flex items-center gap-1 mt-1.5 justify-end text-xs font-medium ${
                    days < 0 ? 'text-red-500 dark:text-red-400' : days < 30 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-400 dark:text-white/30'
                  }`}>
                    <Calendar className="w-3 h-3" />
                    {days < 0 ? 'Vencida' : days === 0 ? 'Vence hoy' : `${days}d restantes`}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-white/20 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
