import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CreditCard, FolderOpen, Sparkles, ChevronRight, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface PolicySummary {
  id: string;
  insurer_name: string;
  ramo: string;
  policy_number: string;
  end_date: string;
  status: string;
}

interface BillingSummary {
  id: string;
  no_poliza: string;
  importe_pendiente: number;
  fecha_limite: string;
  dias_vencidos: number;
}

export default function Dashboard() {
  const { customer, office } = useAuth();
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [billing, setBilling] = useState<BillingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;
    Promise.all([
      supabase.from('seguwallet_external_policies')
        .select('id,insurer_name,ramo,policy_number,end_date,status')
        .eq('seguwallet_customer_id', customer.id)
        .is('deleted_at', null)
        .order('end_date', { ascending: true })
        .limit(5),
      supabase.from('sicas_cobranza_pendiente')
        .select('id,no_poliza,importe_pendiente,fecha_limite,dias_vencidos')
        .eq('usuario_id', customer.agent_user_id)
        .order('fecha_limite', { ascending: true })
        .limit(5),
    ]).then(([polRes, bilRes]) => {
      setPolicies(polRes.data || []);
      setBilling(bilRes.data || []);
      setLoading(false);
    });
  }, [customer]);

  const accentColor = office?.accent_color || '#0F4C81';
  const greeting = getGreeting();
  const firstName = customer?.full_name?.split(' ')[0] || 'Cliente';

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  function daysUntil(dateStr: string) {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function formatMXN(n: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
  }

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{greeting}, {firstName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Aquí tienes un resumen de tus seguros.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: FileText, label: 'Pólizas', value: policies.length, color: 'blue', path: '/seguwallet/polizas' },
          { icon: CreditCard, label: 'Pagos pendientes', value: billing.length, color: billing.length > 0 ? 'amber' : 'green', path: '/seguwallet/cobranza' },
          { icon: FolderOpen, label: 'Documentos', value: '—', color: 'slate', path: '/seguwallet/documentos' },
          { icon: Sparkles, label: 'Chava IA', value: 'Online', color: 'emerald', path: '/seguwallet/chava' },
        ].map(({ icon: Icon, label, value, color, path }) => (
          <button key={label} onClick={() => navigate(path)}
            className="bg-white rounded-2xl border border-slate-100 p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-${color}-50`}>
              <Icon className={`w-4 h-4 text-${color}-600`} />
            </div>
            <p className="text-xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Chava banner */}
      <div
        className="rounded-2xl p-5 mb-6 flex items-center gap-4 cursor-pointer hover:opacity-95 transition-opacity shadow-sm"
        style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}
        onClick={() => navigate('/seguwallet/chava')}
      >
        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white">Habla con Chava</p>
          <p className="text-white/80 text-sm mt-0.5">Tu asistente inteligente está lista para ayudarte con tus pólizas y seguros.</p>
        </div>
        <ChevronRight className="w-5 h-5 text-white/70 flex-shrink-0" />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Policies */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-800 text-sm">Mis pólizas</h2>
            <button onClick={() => navigate('/seguwallet/polizas')} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Ver todas</button>
          </div>
          {policies.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">No hay pólizas registradas.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {policies.map(p => {
                const days = daysUntil(p.end_date);
                return (
                  <button key={p.id} onClick={() => navigate(`/seguwallet/polizas/${p.id}`)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.insurer_name} · {p.ramo}</p>
                      <p className="text-xs text-slate-400">Póliza {p.policy_number}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-xs font-medium ${days < 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {days < 0 ? 'Vencida' : days === 0 ? 'Hoy' : `${days}d`}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Billing */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-800 text-sm">Pagos pendientes</h2>
            <button onClick={() => navigate('/seguwallet/cobranza')} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Ver todos</button>
          </div>
          {billing.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Sin pagos pendientes</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {billing.map(b => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${b.dias_vencidos > 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
                    {b.dias_vencidos > 0
                      ? <AlertTriangle className="w-4 h-4 text-red-500" />
                      : <Clock className="w-4 h-4 text-amber-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">Póliza {b.no_poliza}</p>
                    <p className="text-xs text-slate-400">{new Date(b.fecha_limite).toLocaleDateString('es-MX')}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{formatMXN(b.importe_pendiente)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
