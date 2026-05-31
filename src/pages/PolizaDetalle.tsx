import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, FileText, Calendar, Shield, Phone, Globe, TriangleAlert as AlertTriangle, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Policy {
  id: string;
  insurer_name: string;
  ramo: string;
  subramo: string | null;
  policy_number: string;
  contractor_name: string | null;
  insured_name: string | null;
  start_date: string;
  end_date: string;
  status: string;
  total_premium: number | null;
  currency: string | null;
  payment_method: string | null;
  payment_frequency: string | null;
  notes: string | null;
  insurer_phone: string | null;
  insurer_website: string | null;
  beneficiaries: string | null;
  vehicle_data: Record<string, unknown> | null;
  health_life_data: Record<string, unknown> | null;
}

export default function PolizaDetalle() {
  const { id } = useParams<{ id: string }>();
  const { customer } = useAuth();
  const navigate = useNavigate();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [docs, setDocs] = useState<{ id: string; nombre_archivo: string; tipo_documento: string; archivo_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer || !id) return;
    Promise.all([
      supabase.from('seguwallet_external_policies')
        .select('*')
        .eq('id', id)
        .eq('seguwallet_customer_id', customer.id)
        .maybeSingle(),
      supabase.from('seguwallet_customer_documents')
        .select('id,nombre_archivo,tipo_documento,archivo_url')
        .eq('seguwallet_customer_id', customer.id),
    ]).then(([polRes, docRes]) => {
      setPolicy(polRes.data);
      setDocs(docRes.data || []);
      setLoading(false);
    });
  }, [customer, id]);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function formatMXN(n: number | null) {
    if (n == null) return '—';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
  }

  function openChava() {
    if (!policy) return;
    navigate('/seguwallet/chava', {
      state: {
        polizaId: policy.id,
        polizaNumero: policy.policy_number,
        aseguradora: policy.insurer_name,
        ramo: policy.ramo,
        vigenciaFin: policy.end_date,
        status: policy.status,
      }
    });
  }

  if (loading) return (
    <>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    </>
  );

  if (!policy) return (
    <>
      <div className="text-center py-16 text-slate-400">Póliza no encontrada.</div>
    </>
  );

  const days = Math.ceil((new Date(policy.end_date).getTime() - Date.now()) / 86400000);

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/seguwallet/polizas')}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">{policy.insurer_name} · {policy.ramo}</h1>
          <p className="text-xs text-slate-400 font-mono">{policy.policy_number}</p>
        </div>
      </div>

      {/* Chava CTA */}
      <button onClick={openChava}
        className="w-full mb-5 flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-95 transition-opacity shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-semibold text-sm">Preguntar a Chava sobre esta póliza</p>
          <p className="text-white/80 text-xs mt-0.5">Hola, soy Chava. Estoy revisando tu póliza de {policy.ramo} con {policy.insurer_name}. ¿Qué quieres saber?</p>
        </div>
      </button>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Policy info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" />Detalles de la póliza
          </h2>
          <div className="space-y-3 text-sm">
            {[
              ['Aseguradora', policy.insurer_name],
              ['Ramo', `${policy.ramo}${policy.subramo ? ` · ${policy.subramo}` : ''}`],
              ['Número de póliza', policy.policy_number],
              ['Contratante', policy.contractor_name || '—'],
              ['Asegurado', policy.insured_name || '—'],
              ['Prima total', formatMXN(policy.total_premium)],
              ['Forma de pago', policy.payment_frequency || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-500">{k}</span>
                <span className="font-medium text-slate-800">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vigencia */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />Vigencia
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Inicio</span>
              <span className="font-medium">{formatDate(policy.start_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Fin</span>
              <span className="font-medium">{formatDate(policy.end_date)}</span>
            </div>
            <div className={`mt-3 p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
              days < 0 ? 'bg-red-50 text-red-700' :
              days < 30 ? 'bg-amber-50 text-amber-700' :
              'bg-emerald-50 text-emerald-700'
            }`}>
              {days < 0 ? <AlertTriangle className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
              {days < 0 ? `Vencida hace ${Math.abs(days)} días` :
               days === 0 ? 'Vence hoy' : `${days} días restantes`}
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Contactar aseguradora</h3>
            {policy.insurer_phone && (
              <a href={`tel:${policy.insurer_phone}`}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors">
                <Phone className="w-3.5 h-3.5" />{policy.insurer_phone}
              </a>
            )}
            {policy.insurer_website && (
              <a href={policy.insurer_website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors">
                <Globe className="w-3.5 h-3.5" />{policy.insurer_website}
              </a>
            )}
          </div>
        </div>

        {/* Beneficiaries */}
        {policy.beneficiaries && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Beneficiarios</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{policy.beneficiaries}</p>
          </div>
        )}

        {/* Documents */}
        {docs.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />Documentos ({docs.length})
            </h2>
            <div className="space-y-2">
              {docs.map(d => (
                <div key={d.id} className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  <span className="flex-1 text-sm text-slate-700 truncate">{d.nombre_archivo}</span>
                  {d.archivo_url && (
                    <a href={d.archivo_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {policy.notes && (
        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-sm font-medium text-amber-800 mb-1">Notas</p>
          <p className="text-sm text-amber-700">{policy.notes}</p>
        </div>
      )}
    </>
  );
}
