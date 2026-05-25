import { useEffect, useState } from 'react';
import { FileText, Search, Calendar, Building2, Shield, X, Download, ChevronRight, ExternalLink, FileCheck, Receipt, Tag, BookOpen, Award } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { logDownload } from '../lib/seguwalletAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Policy {
  id: string;
  poliza: string;
  aseguradora_nombre: string;
  ramo: string;
  cliente: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  is_vigente: boolean;
  is_cancelada: boolean;
  prima_total: number | null;
  moneda: string | null;
}

interface DigitalFile {
  id: string;
  numero_poliza: string;
  descripcion: string;
  tipo_documento: string;
  url: string;
  nombre_archivo: string;
  created_at: string;
}

const DOC_ICONS: Record<string, React.ElementType> = {
  PDF: FileText,
  RECIBO: Receipt,
  FACTURA: Tag,
  ENDOSO: FileCheck,
  CONDICIONES: BookOpen,
  CERTIFICADO: Award,
};

function getDaysRemaining(dateStr: string): number {
  const now = new Date();
  const end = new Date(dateStr);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(s: string) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatusInfo(p: Policy) {
  if (p.is_cancelada) return { label: 'Cancelada', cls: 'bg-neutral-100 text-neutral-600 border-neutral-200', dot: 'bg-neutral-400' };
  if (p.is_vigente) return { label: 'Vigente', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
  return { label: 'Vencida', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' };
}

export function SeguwalletPolizas() {
  const { customer } = useSeguwallet();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [filtered, setFiltered] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [aseguradoraFilter, setAseguradoraFilter] = useState('all');
  const [aseguradoras, setAseguradoras] = useState<string[]>([]);

  const [selected, setSelected] = useState<Policy | null>(null);
  const [docs, setDocs] = useState<DigitalFile[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => { if (customer) loadPolicies(); }, [customer]);
  useEffect(() => { applyFilters(); }, [search, statusFilter, aseguradoraFilter, policies]);
  useEffect(() => { if (selected) loadDocs(selected.poliza); }, [selected]);

  const loadPolicies = async () => {
    if (!customer) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase.rpc('get_seguwallet_polizas', { p_auth_id: user.id });
      if (error) throw error;

      const pols = (data || []) as Policy[];
      setPolicies(pols);
      setAseguradoras([...new Set(pols.map((p: Policy) => p.aseguradora_nombre).filter(Boolean))]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocs = async (poliza: string) => {
    if (!poliza) { setDocs([]); return; }
    setDocsLoading(true);
    try {
      const { data } = await supabase
        .from('sicas_digital_files')
        .select('id, numero_poliza, descripcion, tipo_documento, url, nombre_archivo, created_at')
        .eq('numero_poliza', poliza)
        .order('created_at', { ascending: false });
      setDocs((data || []) as DigitalFile[]);
    } catch (err) {
      console.error(err);
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleDownload = async (doc: DigitalFile) => {
    if (!customer || !doc.url) return;
    setDownloading(doc.id);
    try {
      await logDownload(customer.id, {
        document_id: doc.id,
        document_type: doc.tipo_documento,
        document_name: doc.descripcion || doc.nombre_archivo,
        policy_number: doc.numero_poliza,
      });
      window.open(doc.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(null);
    }
  };

  const applyFilters = () => {
    let r = [...policies];
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(p =>
        p.poliza?.toLowerCase().includes(q) ||
        p.cliente?.toLowerCase().includes(q) ||
        p.aseguradora_nombre?.toLowerCase().includes(q) ||
        p.ramo?.toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'vigente') r = r.filter(p => p.is_vigente);
    else if (statusFilter === 'vencida') r = r.filter(p => !p.is_vigente && !p.is_cancelada);
    else if (statusFilter === 'cancelada') r = r.filter(p => p.is_cancelada);
    if (aseguradoraFilter !== 'all') r = r.filter(p => p.aseguradora_nombre === aseguradoraFilter);
    setFiltered(r);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-blue-200 border-t-[#1C37E0] rounded-full animate-spin" />
      </div>
    );
  }

  const daysRemaining = selected ? getDaysRemaining(selected.vigencia_hasta) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Mis Polizas</h1>
        <p className="text-sm text-neutral-500 mt-1">Consulta tus coberturas, vigencias y documentos</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por poliza, cliente, aseguradora..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">Todos los estatus</option>
            <option value="vigente">Vigente</option>
            <option value="vencida">Vencida</option>
            <option value="cancelada">Cancelada</option>
          </select>
          {aseguradoras.length > 1 && (
            <select
              value={aseguradoraFilter}
              onChange={e => setAseguradoraFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Todas las aseguradoras</option>
              {aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-12 text-center">
          <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-500">
            {policies.length === 0 ? 'No tienes polizas asignadas' : 'No se encontraron resultados'}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {policies.length === 0 ? 'Contacta a tu agente para mas informacion' : 'Intenta con otros filtros'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(policy => {
            const st = getStatusInfo(policy);
            return (
              <button
                key={policy.id}
                onClick={() => setSelected(policy)}
                className="w-full bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-5 hover:shadow-md hover:border-blue-100 transition-all text-left group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="p-2 rounded-xl bg-blue-50 flex-shrink-0 mt-0.5 group-hover:bg-blue-100 transition-colors">
                      <Shield className="w-4 h-4 text-[#1C37E0]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <p className="font-bold text-neutral-900 text-sm">{policy.poliza || 'Sin numero'}</p>
                        <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1", st.cls)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                          {st.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                        {policy.aseguradora_nombre && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {policy.aseguradora_nombre}
                          </span>
                        )}
                        {policy.ramo && <span className="text-neutral-400">{policy.ramo}</span>}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(policy.vigencia_desde)} — {formatDate(policy.vigencia_hasta)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {policy.prima_total ? (
                      <div className="text-right">
                        <p className="text-sm font-bold text-neutral-900">
                          ${policy.prima_total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-neutral-400">Prima total</p>
                      </div>
                    ) : null}
                    <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-[#1C37E0] transition-colors" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4 border-b border-neutral-100">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 flex-shrink-0">
                  <Shield className="w-5 h-5 text-[#1C37E0]" />
                </div>
                <div>
                  <p className="font-bold text-neutral-900">{selected.poliza || 'Sin numero'}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{selected.aseguradora_nombre || '-'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1">
              <div className="p-6 space-y-5">
                {/* Status + vigency */}
                {(() => {
                  const st = getStatusInfo(selected);
                  const days = daysRemaining;
                  return (
                    <div className={cn(
                      "rounded-2xl p-4",
                      selected.is_vigente && days <= 30 && !selected.is_cancelada
                        ? "bg-amber-50 border border-amber-100"
                        : selected.is_vigente
                          ? "bg-emerald-50 border border-emerald-100"
                          : "bg-neutral-50 border border-neutral-200"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn("px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5", st.cls)}>
                          <span className={cn("w-2 h-2 rounded-full", st.dot)} />
                          {st.label}
                        </span>
                        {selected.is_vigente && !selected.is_cancelada && (
                          <span className={cn("text-xs font-semibold", days <= 30 ? "text-amber-700" : "text-emerald-700")}>
                            {days > 0 ? `${days} dias restantes` : 'Vence hoy'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-600">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(selected.vigencia_desde)} — {formatDate(selected.vigencia_hasta)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Aseguradora', val: selected.aseguradora_nombre },
                    { label: 'Ramo', val: selected.ramo },
                    { label: 'Cliente', val: selected.cliente },
                    { label: 'Prima total', val: selected.prima_total ? `$${selected.prima_total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}${selected.moneda ? ' ' + selected.moneda : ''}` : null },
                  ].filter(r => r.val).map(row => (
                    <div key={row.label} className="bg-neutral-50 rounded-xl p-3">
                      <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide mb-1">{row.label}</p>
                      <p className="text-sm font-semibold text-neutral-900 leading-tight">{row.val}</p>
                    </div>
                  ))}
                </div>

                {/* Documents section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Download className="w-4 h-4 text-neutral-500" />
                    <p className="text-sm font-bold text-neutral-900">Documentos</p>
                    {!docsLoading && <span className="text-xs text-neutral-400">({docs.length})</span>}
                  </div>

                  {docsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-blue-200 border-t-[#1C37E0] rounded-full animate-spin" />
                    </div>
                  ) : docs.length === 0 ? (
                    <div className="bg-neutral-50 rounded-2xl p-6 text-center border border-neutral-100">
                      <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-xs text-neutral-500 font-medium">Sin documentos disponibles</p>
                      <p className="text-xs text-neutral-400 mt-0.5">Los documentos apareceran cuando esten disponibles</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {docs.map(doc => {
                        const DocIcon = DOC_ICONS[doc.tipo_documento?.toUpperCase()] || FileText;
                        const isLoading = downloading === doc.id;
                        return (
                          <button
                            key={doc.id}
                            onClick={() => handleDownload(doc)}
                            disabled={isLoading}
                            className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-neutral-50 hover:bg-blue-50 border border-neutral-100 hover:border-blue-200 transition-all group text-left disabled:opacity-60"
                          >
                            <div className="p-2 rounded-lg bg-white border border-neutral-200 group-hover:border-blue-200 transition-colors flex-shrink-0">
                              <DocIcon className="w-4 h-4 text-neutral-500 group-hover:text-[#1C37E0] transition-colors" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-neutral-900 truncate leading-tight">
                                {doc.descripcion || doc.nombre_archivo || 'Documento'}
                              </p>
                              {doc.tipo_documento && (
                                <p className="text-[10px] text-neutral-400 mt-0.5 uppercase tracking-wide">{doc.tipo_documento}</p>
                              )}
                            </div>
                            {isLoading ? (
                              <div className="w-4 h-4 border-2 border-blue-200 border-t-[#1C37E0] rounded-full animate-spin flex-shrink-0" />
                            ) : (
                              <ExternalLink className="w-3.5 h-3.5 text-neutral-300 group-hover:text-[#1C37E0] transition-colors flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
