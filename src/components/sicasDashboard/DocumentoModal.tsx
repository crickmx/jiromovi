import { useState, useEffect } from 'react';
import {
  X, FileText, User, Calendar, CreditCard, Building2,
  Hash, ChevronDown, ChevronUp, Loader2, AlertTriangle,
  Shield, Clock, DollarSign,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate, formatFullCurrency, daysUntilRenewal, renewalUrgencyColor } from '../../lib/sicasDashboardTypes';

interface Props {
  docId: string;
  isAdmin: boolean;
  onClose: () => void;
}

interface DocDetail {
  id: string;
  id_docto: string;
  poliza: string | null;
  cliente: string | null;
  compania: string | null;
  ramo: string | null;
  subramo: string | null;
  tipo_documento: string | null;
  status_texto: string | null;
  status_codigo: string | null;
  status_cobro: string | null;
  fecha_captura: string | null;
  fecha_emision: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  prima_neta: number;
  prima_total: number;
  importe: number;
  moneda: string | null;
  vend_nombre: string | null;
  vend_id: string | null;
  agente_nombre: string | null;
  sicas_id_agente: string | null;
  is_vigente: boolean;
  is_cancelada: boolean;
  is_renewable: boolean;
  renewal_days_remaining: number | null;
  raw_data: Record<string, unknown> | null;
}

export default function DocumentoModal({ docId, isAdmin, onClose }: Props) {
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('sicas_documents')
        .select('*')
        .eq('id', docId)
        .maybeSingle();
      if (!error && data) setDoc(data as DocDetail);
      setLoading(false);
    })();
  }, [docId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const days = doc ? daysUntilRenewal(doc.vigencia_hasta) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            {loading ? (
              <div className="h-6 w-48 bg-blue-500/40 rounded animate-pulse" />
            ) : doc ? (
              <>
                <p className="text-blue-200 text-[10px] font-medium uppercase tracking-wider">{doc.tipo_documento || 'Documento'}</p>
                <h2 className="text-lg font-bold text-white truncate">{doc.poliza || doc.id_docto}</h2>
                <p className="text-blue-200 text-xs mt-0.5">{doc.compania} - {doc.ramo}</p>
              </>
            ) : (
              <p className="text-white">Documento no encontrado</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {doc && <StatusBadge status={doc.status_texto} isVigente={doc.is_vigente} isCancelada={doc.is_cancelada} />}
            <button onClick={onClose} className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-gray-500 text-sm">Cargando detalle...</p>
            </div>
          ) : !doc ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">No se pudo cargar el documento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Cliente */}
              <Section icon={User} title="Cliente">
                <Field label="Nombre" value={doc.cliente} />
              </Section>

              {/* Vigencia */}
              <Section icon={Calendar} title="Vigencia">
                <Field label="Desde" value={formatDate(doc.vigencia_desde)} />
                <Field label="Hasta" value={formatDate(doc.vigencia_hasta)} />
                {doc.fecha_emision && <Field label="Emision" value={formatDate(doc.fecha_emision)} />}
                {doc.fecha_captura && <Field label="Captura" value={formatDate(doc.fecha_captura)} />}
                {doc.is_renewable && days !== null && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span className={`text-xs font-bold ${renewalUrgencyColor(days)}`}>
                      {days <= 0 ? 'VENCIDO' : `${days} dias para renovar`}
                    </span>
                  </div>
                )}
              </Section>

              {/* Importes */}
              <Section icon={DollarSign} title="Importes">
                <Field label="Prima Neta" value={formatFullCurrency(doc.prima_neta)} />
                <Field label="Prima Total" value={formatFullCurrency(doc.prima_total)} />
                <Field label="Importe" value={formatFullCurrency(doc.importe)} />
                <Field label="Moneda" value={doc.moneda || 'MXN'} />
              </Section>

              {/* Documento */}
              <Section icon={FileText} title="Documento">
                <Field label="Tipo" value={doc.tipo_documento} />
                {doc.subramo && <Field label="Subramo" value={doc.subramo} />}
                {doc.status_cobro && <Field label="Estatus Cobro" value={doc.status_cobro} />}
                <Field label="ID SICAS" value={doc.id_docto} />
              </Section>

              {/* Vendedor / Agente */}
              <Section icon={Building2} title="Vendedor / Agente">
                <Field label="Vendedor" value={doc.vend_nombre} />
                {doc.vend_id && <Field label="ID Vendedor" value={doc.vend_id} />}
                {doc.agente_nombre && <Field label="Agente" value={doc.agente_nombre} />}
                {doc.sicas_id_agente && <Field label="ID Agente" value={doc.sicas_id_agente} />}
              </Section>

              {/* Estatus */}
              <Section icon={Shield} title="Estatus">
                <Field label="Estatus" value={doc.status_texto} />
                <Field label="Codigo" value={doc.status_codigo} />
                <div className="mt-2 flex gap-2">
                  {doc.is_vigente && <Tag text="Vigente" color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" />}
                  {doc.is_cancelada && <Tag text="Cancelada" color="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" />}
                  {doc.is_renewable && <Tag text="Renovable" color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" />}
                </div>
              </Section>
            </div>
          )}

          {/* Raw data for admin */}
          {isAdmin && doc?.raw_data && (
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <button onClick={() => setShowRaw(!showRaw)} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <Hash className="w-4 h-4" /> Datos crudos (debug)
                {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showRaw && (
                <pre className="mt-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-xs overflow-x-auto max-h-64 text-gray-700 dark:text-gray-300">
                  {JSON.stringify(doc.raw_data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
        <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" /> {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-200 text-right truncate">{value}</span>
    </div>
  );
}

function StatusBadge({ status, isVigente, isCancelada }: { status: string | null; isVigente: boolean; isCancelada: boolean }) {
  const text = status || (isVigente ? 'Vigente' : isCancelada ? 'Cancelada' : '-');
  const classes = isVigente
    ? 'bg-emerald-100 text-emerald-800'
    : isCancelada
    ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-700';
  return <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${classes}`}>{text}</span>;
}

function Tag({ text, color }: { text: string; color: string }) {
  return <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded ${color}`}>{text}</span>;
}
