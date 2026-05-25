import { useEffect, useState } from 'react';
import {
  FileText, Search, Calendar, Building2, Shield, X, Download,
  ChevronRight, ExternalLink, FileCheck, Receipt, Tag, BookOpen,
  Award, AlertTriangle, Clock, CheckCircle, XCircle, Car, Heart,
  Home, Umbrella, RefreshCw, User, MapPin, DollarSign, Info,
  ChevronDown, ChevronUp, Folder,
} from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand } from '../lib/AgentBrandContext';
import { logDownload } from '../lib/seguwalletAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Policy {
  id: string;
  id_docto: string;
  poliza: string;
  aseguradora_nombre: string;
  compania: string;
  ramo: string;
  subramo: string;
  tipo_documento: string;
  subtipo_documento: string;
  cliente: string;
  vend_nombre: string;
  agente_nombre: string;
  desp_nombre: string;
  oficina_nombre: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  fecha_emision: string;
  fecha_captura: string;
  is_vigente: boolean;
  is_cancelada: boolean;
  is_renewable: boolean;
  renewal_days_remaining: number | null;
  status_texto: string;
  status_cobro: string;
  prima_neta: number | null;
  prima_total: number | null;
  derechos: number | null;
  impuestos: number | null;
  recargos: number | null;
  importe: number | null;
  moneda: string | null;
}

interface DigitalFile {
  id: string;
  nombre_archivo: string;
  extension: string;
  tipo_archivo: string;
  tamanio_bytes: number;
  tamanio_legible: string;
  fecha_subida: string;
  carpeta: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getDaysRemaining(dateStr: string): number {
  if (!dateStr) return 0;
  const end = new Date(dateStr);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function fmt(s: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('es-MX', opts || { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(n: number | null | undefined, currency?: string | null) {
  if (!n) return null;
  const formatted = n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${formatted}${currency && currency !== 'Pesos' ? ' ' + currency : ''}`;
}

function getRamoIcon(ramo: string) {
  const r = ramo?.toLowerCase() || '';
  if (r.includes('vehiculo') || r.includes('auto')) return Car;
  if (r.includes('vida') || r.includes('salud') || r.includes('gmm') || r.includes('gastos')) return Heart;
  if (r.includes('hogar') || r.includes('casa') || r.includes('inmueble')) return Home;
  return Shield;
}

function getStatusConfig(p: Policy) {
  if (p.is_cancelada) return {
    label: 'Cancelada', icon: XCircle,
    badgeCls: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    dot: 'bg-neutral-400',
    bannerCls: 'bg-neutral-50 border-neutral-200',
    textCls: 'text-neutral-600',
  };
  const days = getDaysRemaining(p.vigencia_hasta);
  if (!p.is_vigente) return {
    label: 'Vencida', icon: AlertTriangle,
    badgeCls: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
    bannerCls: 'bg-red-50 border-red-100',
    textCls: 'text-red-700',
  };
  if (days <= 30) return {
    label: 'Vigente', icon: AlertTriangle,
    badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    bannerCls: 'bg-amber-50 border-amber-100',
    textCls: 'text-amber-700',
    alert: `Vence en ${days} dia${days !== 1 ? 's' : ''}`,
  };
  return {
    label: 'Vigente', icon: CheckCircle,
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    bannerCls: 'bg-emerald-50 border-emerald-100',
    textCls: 'text-emerald-700',
    alert: days > 0 ? `${days} dias restantes` : 'Vence hoy',
  };
}

function DocTypeIcon({ ext }: { ext: string }) {
  const e = (ext || '').toLowerCase();
  if (e === 'pdf') return <FileText className="w-4 h-4 text-red-500" />;
  if (['xls', 'xlsx'].includes(e)) return <FileCheck className="w-4 h-4 text-emerald-500" />;
  if (['doc', 'docx'].includes(e)) return <BookOpen className="w-4 h-4 text-blue-500" />;
  if (['jpg', 'jpeg', 'png'].includes(e)) return <Award className="w-4 h-4 text-violet-500" />;
  return <FileText className="w-4 h-4 text-neutral-400" />;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
      <p className="text-sm font-semibold text-neutral-900 leading-tight">{value}</p>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, collapsible = false }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden">
      <button
        onClick={() => collapsible && setOpen(o => !o)}
        className={cn("w-full flex items-center justify-between px-4 py-3", collapsible && "hover:bg-neutral-100 transition-colors")}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-neutral-500" />
          <p className="text-xs font-bold text-neutral-700 uppercase tracking-wide">{title}</p>
        </div>
        {collapsible && (open ? <ChevronUp className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />)}
      </button>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Timeline ───────────────────────────────────────────────────────────────

function PolicyTimeline({ policy }: { policy: Policy }) {
  const items = [
    { label: 'Emision', date: policy.fecha_emision, icon: FileText },
    { label: 'Inicio vigencia', date: policy.vigencia_desde, icon: CheckCircle },
    { label: 'Fin vigencia', date: policy.vigencia_hasta, icon: Clock },
  ].filter(i => i.date);

  if (items.length === 0) return null;

  const nowTs = Date.now();
  return (
    <div className="relative">
      <div className="absolute left-[15px] top-4 bottom-4 w-px bg-neutral-200" />
      <div className="space-y-3">
        {items.map((item, idx) => {
          const ts = item.date ? new Date(item.date).getTime() : 0;
          const isPast = ts < nowTs;
          const isLast = idx === items.length - 1;
          return (
            <div key={item.label} className="flex items-start gap-3">
              <div className={cn(
                "w-7.5 h-7.5 w-[30px] h-[30px] rounded-full border-2 flex items-center justify-center flex-shrink-0 relative z-10 bg-white",
                isPast && !isLast ? "border-emerald-400" : isLast && !policy.is_vigente ? "border-red-300" : "border-neutral-300"
              )}>
                <item.icon className={cn(
                  "w-3 h-3",
                  isPast && !isLast ? "text-emerald-500" : isLast && !policy.is_vigente ? "text-red-400" : "text-neutral-400"
                )} />
              </div>
              <div className="pt-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{item.label}</p>
                <p className="text-sm font-bold text-neutral-900">{fmt(item.date)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function PolicyDetail({
  policy,
  onClose,
  primaryColor,
}: {
  policy: Policy;
  onClose: () => void;
  primaryColor: string;
}) {
  const { customer } = useSeguwallet();
  const [files, setFiles] = useState<DigitalFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesFetched, setFilesFetched] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [fileGroups, setFileGroups] = useState<Record<string, DigitalFile[]>>({});

  const st = getStatusConfig(policy);
  const RamoIcon = getRamoIcon(policy.ramo);
  const days = getDaysRemaining(policy.vigencia_hasta);

  useEffect(() => {
    if (policy.id_docto) fetchFiles();
  }, [policy.id_docto]);

  const fetchFiles = async () => {
    setFilesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seguwallet-get-policy-files`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ id_docto: policy.id_docto, poliza: policy.poliza }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const archivos: DigitalFile[] = data.archivos || [];
        setFiles(archivos);
        // Group by carpeta
        const groups: Record<string, DigitalFile[]> = {};
        for (const f of archivos) {
          const key = f.carpeta || 'General';
          if (!groups[key]) groups[key] = [];
          groups[key].push(f);
        }
        setFileGroups(groups);
      }
    } catch (err) {
      console.error('Error fetching policy files:', err);
    } finally {
      setFilesLoading(false);
      setFilesFetched(true);
    }
  };

  const handleDownload = async (file: DigitalFile) => {
    if (!customer) return;
    setDownloading(file.id);
    try {
      await logDownload(customer.id, {
        document_id: file.id,
        document_type: file.tipo_archivo,
        document_name: file.nombre_archivo,
        policy_number: policy.poliza,
      });
      // For SICAS Centro Digital, files are served through the SICAS URL embedded in the file object
      // If no direct URL, open a descriptive download attempt
      if ((file as any).url_descarga) {
        window.open((file as any).url_descarga, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* Color strip */}
        <div className="h-1" style={{ backgroundColor: primaryColor }} />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl flex-shrink-0" style={{ backgroundColor: primaryColor + '15' }}>
              <RamoIcon className="w-5 h-5" style={{ color: primaryColor }} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-neutral-900 text-base">{policy.poliza || 'Sin numero'}</p>
                <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1", st.badgeCls)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                  {st.label}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {policy.aseguradora_nombre || policy.compania || '-'}
                {policy.ramo && <span className="text-neutral-300 mx-1.5">·</span>}
                {policy.ramo}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <div className="p-5 space-y-4">

            {/* Status banner */}
            <div className={cn("rounded-2xl p-4 border", st.bannerCls)}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <st.icon className={cn("w-4 h-4", st.textCls)} />
                  <span className={cn("text-sm font-bold", st.textCls)}>{st.label}</span>
                </div>
                {st.alert && (
                  <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-lg border", st.badgeCls)}>{st.alert}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-neutral-600">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {fmt(policy.vigencia_desde)} — {fmt(policy.vigencia_hasta)}
                </span>
              </div>
            </div>

            {/* Datos generales */}
            <SectionCard title="Datos generales" icon={Info}>
              <InfoRow label="Numero de poliza" value={policy.poliza} />
              <InfoRow label="Aseguradora" value={policy.aseguradora_nombre || policy.compania} />
              <InfoRow label="Ramo" value={policy.ramo} />
              <InfoRow label="Subramo" value={policy.subramo} />
              <InfoRow label="Tipo documento" value={policy.tipo_documento} />
              <InfoRow label="Moneda" value={policy.moneda} />
              {policy.status_texto && <InfoRow label="Estatus SICAS" value={policy.status_texto} />}
              {policy.status_cobro && <InfoRow label="Estatus cobro" value={policy.status_cobro} />}
            </SectionCard>

            {/* Cliente */}
            <SectionCard title="Cliente" icon={User}>
              <InfoRow label="Asegurado / Contratante" value={policy.cliente} />
              <InfoRow label="Ejecutivo / Agente" value={policy.agente_nombre || policy.vend_nombre} />
              <InfoRow label="Despacho" value={policy.desp_nombre} />
              <InfoRow label="Oficina" value={policy.oficina_nombre} />
            </SectionCard>

            {/* Primas */}
            {(policy.prima_total || policy.prima_neta) && (
              <SectionCard title="Primas y montos" icon={DollarSign}>
                <InfoRow label="Prima total" value={fmtMoney(policy.prima_total, policy.moneda)} />
                <InfoRow label="Prima neta" value={fmtMoney(policy.prima_neta, policy.moneda)} />
                <InfoRow label="Derechos" value={fmtMoney(policy.derechos, policy.moneda)} />
                <InfoRow label="Impuestos" value={fmtMoney(policy.impuestos, policy.moneda)} />
                <InfoRow label="Recargos" value={fmtMoney(policy.recargos, policy.moneda)} />
              </SectionCard>
            )}

            {/* Timeline */}
            <div className="bg-neutral-50 rounded-2xl border border-neutral-100 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                <p className="text-xs font-bold text-neutral-700 uppercase tracking-wide">Fechas importantes</p>
              </div>
              <PolicyTimeline policy={policy} />
            </div>

            {/* Documents */}
            <div className="bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden">
              <div className="px-4 pt-3 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-neutral-500" />
                  <p className="text-xs font-bold text-neutral-700 uppercase tracking-wide">Documentos</p>
                  {!filesLoading && filesFetched && (
                    <span className="text-[10px] text-neutral-400 font-medium">({files.length})</span>
                  )}
                </div>
                {filesFetched && (
                  <button
                    onClick={fetchFiles}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-all"
                    title="Actualizar documentos"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", filesLoading && "animate-spin")} />
                  </button>
                )}
              </div>

              <div className="px-4 pb-4">
                {filesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-12 bg-neutral-200/60 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : files.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-neutral-500">Sin documentos disponibles</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {!policy.id_docto
                        ? 'No hay referencia de documento SICAS'
                        : 'Los documentos apareceran cuando esten disponibles en el Centro Digital'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(fileGroups).map(([folder, folderFiles]) => (
                      <div key={folder}>
                        {Object.keys(fileGroups).length > 1 && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Folder className="w-3 h-3 text-neutral-400" />
                            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">{folder}</p>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          {folderFiles.map(file => (
                            <div
                              key={file.id}
                              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-neutral-100 hover:border-neutral-200 transition-all group"
                            >
                              <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-100 flex-shrink-0">
                                <DocTypeIcon ext={file.extension} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-neutral-900 truncate leading-tight">
                                  {file.nombre_archivo}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {file.tipo_archivo && (
                                    <span className="text-[10px] text-neutral-400 uppercase font-medium">{file.tipo_archivo}</span>
                                  )}
                                  {file.tamanio_legible && (
                                    <span className="text-[10px] text-neutral-300">{file.tamanio_legible}</span>
                                  )}
                                  {file.fecha_subida && (
                                    <span className="text-[10px] text-neutral-300">{fmt(file.fecha_subida)}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleDownload(file)}
                                disabled={downloading === file.id}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex-shrink-0",
                                  "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                                )}
                              >
                                {downloading === file.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-neutral-400/30 border-t-neutral-500 rounded-full animate-spin" />
                                ) : (
                                  <ExternalLink className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ID docto reference (subtle) */}
            {policy.id_docto && (
              <p className="text-center text-[10px] text-neutral-300 font-mono">
                Ref. SICAS: {policy.id_docto}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SeguwalletPolizas() {
  const { customer } = useSeguwallet();
  const { brand } = useAgentBrand();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [filtered, setFiltered] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [aseguradoraFilter, setAseguradoraFilter] = useState('all');
  const [aseguradoras, setAseguradoras] = useState<string[]>([]);
  const [selected, setSelected] = useState<Policy | null>(null);

  const primary = brand.primaryColor;

  useEffect(() => { if (customer) loadPolicies(); }, [customer]);

  useEffect(() => {
    let r = [...policies];
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(p =>
        p.poliza?.toLowerCase().includes(q) ||
        p.cliente?.toLowerCase().includes(q) ||
        p.aseguradora_nombre?.toLowerCase().includes(q) ||
        p.ramo?.toLowerCase().includes(q) ||
        p.subramo?.toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'vigente') r = r.filter(p => p.is_vigente && !p.is_cancelada);
    else if (statusFilter === 'vencida') r = r.filter(p => !p.is_vigente && !p.is_cancelada);
    else if (statusFilter === 'cancelada') r = r.filter(p => p.is_cancelada);
    if (aseguradoraFilter !== 'all') r = r.filter(p => p.aseguradora_nombre === aseguradoraFilter);
    setFiltered(r);
  }, [search, statusFilter, aseguradoraFilter, policies]);

  const loadPolicies = async () => {
    if (!customer) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_seguwallet_polizas', { p_auth_id: user.id });
      if (error) throw error;

      const pols = (data || []) as Policy[];
      setPolicies(pols);
      setAseguradoras([...new Set(pols.map(p => p.aseguradora_nombre).filter(Boolean))].sort());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div>
          <div className="h-7 w-40 bg-neutral-200 rounded-xl animate-pulse mb-2" />
          <div className="h-4 w-64 bg-neutral-100 rounded-lg animate-pulse" />
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-4">
          <div className="h-10 bg-neutral-100 rounded-xl animate-pulse" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-5 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  // Stats summary
  const vigentesCount = policies.filter(p => p.is_vigente && !p.is_cancelada).length;
  const expiringCount = policies.filter(p => p.is_vigente && !p.is_cancelada && getDaysRemaining(p.vigencia_hasta) <= 30).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Mis Polizas</h1>
        <p className="text-sm text-neutral-500 mt-1">Consulta tus coberturas, vigencias y documentos</p>
      </div>

      {/* Summary strip */}
      {policies.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total', value: policies.length, color: 'text-neutral-900' },
            { label: 'Vigentes', value: vigentesCount, color: 'text-emerald-600' },
            { label: 'Por vencer', value: expiringCount, color: expiringCount > 0 ? 'text-amber-600' : 'text-neutral-400' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-3.5 text-center">
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-[10px] text-neutral-400 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por numero, cliente, aseguradora..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none"
          >
            <option value="all">Todos los estatus</option>
            <option value="vigente">Vigentes</option>
            <option value="vencida">Vencidas</option>
            <option value="cancelada">Canceladas</option>
          </select>
          {aseguradoras.length > 1 && (
            <select
              value={aseguradoraFilter}
              onChange={e => setAseguradoraFilter(e.target.value)}
              className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none"
            >
              <option value="all">Todas las aseguradoras</option>
              {aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Policy list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-12 text-center">
          <Shield className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-500">
            {policies.length === 0 ? 'No tienes polizas asignadas' : 'Sin resultados'}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {policies.length === 0
              ? 'Contacta a tu agente para mas informacion'
              : 'Prueba con otros filtros'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(policy => {
            const st = getStatusConfig(policy);
            const RamoIcon = getRamoIcon(policy.ramo);
            const days = getDaysRemaining(policy.vigencia_hasta);
            return (
              <button
                key={policy.id}
                onClick={() => setSelected(policy)}
                className="w-full bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-4 hover:shadow-md transition-all text-left group hover:border-neutral-300"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="p-2.5 rounded-xl flex-shrink-0 mt-0.5 transition-colors"
                    style={{ backgroundColor: primary + '12' }}
                  >
                    <RamoIcon className="w-4 h-4" style={{ color: primary }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-bold text-neutral-900 text-sm">{policy.poliza || 'Sin numero'}</p>
                      <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 leading-none", st.badgeCls)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", st.dot)} />
                        {st.label}
                      </span>
                      {st.alert && policy.is_vigente && days <= 30 && !policy.is_cancelada && (
                        <span className="text-[10px] font-semibold text-amber-600">{st.alert}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                      {policy.aseguradora_nombre && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 flex-shrink-0" />
                          {policy.aseguradora_nombre}
                        </span>
                      )}
                      {policy.ramo && (
                        <span className="text-neutral-400">{policy.subramo || policy.ramo}</span>
                      )}
                      <span className="flex items-center gap-1 text-neutral-400">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        {fmt(policy.vigencia_hasta)}
                      </span>
                    </div>

                    {policy.prima_total ? (
                      <p className="text-xs font-semibold text-neutral-700 mt-1.5">
                        {fmtMoney(policy.prima_total, policy.moneda)}
                        <span className="text-neutral-400 font-normal ml-1">prima total</span>
                      </p>
                    ) : null}
                  </div>

                  <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 transition-colors flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <PolicyDetail
          policy={selected}
          onClose={() => setSelected(null)}
          primaryColor={primary}
        />
      )}
    </div>
  );
}
