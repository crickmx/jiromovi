import { useEffect, useState, useRef } from 'react';
import { FileText, Search, Calendar, Building2, Shield, X, Download, ChevronRight, ExternalLink, FileCheck, BookOpen, Award, AlertTriangle, Clock, CheckCircle, XCircle, Car, Heart, Home, RefreshCw, User, DollarSign, Info, ChevronDown, ChevronUp, Folder, Plus, Upload, Trash2, CreditCard as Edit3, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand } from '../lib/AgentBrandContext';
import { logDownload } from '../lib/seguwalletAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// ─── Insurer Logo Map ─────────────────────────────────────────────────────────

const INSURER_LOGOS: Record<string, string> = {
  qualitas: '/qualitas-compania-de-seguros-logo-png_seeklogo-329374-2.png',
  ana: '/ana-seguros-logo-png_seeklogo-187684.png',
  chubb: '/chubb-logo-png_seeklogo-299281.png',
  aba: '/chubb-logo-png_seeklogo-299281.png',
  allianz: '/allianz-seguros-logo-png_seeklogo-179147.png',
  gnp: '/gnp-logo-png_seeklogo-61558.png',
  mapfre: '/mapfre-seguros-logo-png_seeklogo-225013.png',
  zurich: '/zurich-logo-png_seeklogo-156664.png',
  afirme: '/afirme-logo-png_seeklogo-4173.png',
  afirm: '/afirme-logo-png_seeklogo-4173.png',
  inbursa: '/inbursa-logo-png_seeklogo-403106.png',
  atlas: '/seguros-atlas-logo-png_seeklogo-251455.png',
  'bx+': '/logo-bx.png',
  bx: '/logo-bx.png',
  bupa: '/logo-bupa.png',
};

function getInsurerLogo(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const [key, logo] of Object.entries(INSURER_LOGOS)) {
    if (lower.includes(key)) return logo;
  }
  return null;
}

function InsurerLogo({ name, size = 36 }: { name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const logo = getInsurerLogo(name);
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  if (!logo || err) {
    return (
      <div
        className="rounded-xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-500 flex-shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {initials}
      </div>
    );
  }
  return (
    <div
      className="rounded-xl bg-white border border-neutral-100 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm"
      style={{ width: size, height: size }}
    >
      <img src={logo} alt={name} className="w-full h-full object-contain p-1.5" onError={() => setErr(true)} />
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
  url_descarga?: string;
}

interface ExternalPolicy {
  id: string;
  insurer_name: string;
  ramo: string;
  subramo: string;
  policy_number: string;
  contractor_name: string | null;
  insured_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  total_premium: number | null;
  currency: string;
  payment_method: string | null;
  payment_frequency: string | null;
  notes: string | null;
  insurer_phone: string | null;
  insurer_website: string | null;
  beneficiaries: string | null;
  vehicle_data: Record<string, string> | null;
  created_at: string;
}

interface ExternalDoc {
  id: string;
  document_type: string;
  document_name: string | null;
  file_url: string;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface ExternalPolicyForm {
  insurer_name: string;
  ramo: string;
  subramo: string;
  policy_number: string;
  start_date: string;
  end_date: string;
  contractor_name: string;
  insured_name: string;
  total_premium: string;
  currency: string;
  payment_method: string;
  payment_frequency: string;
  notes: string;
  insurer_phone: string;
  insurer_website: string;
  beneficiaries: string;
  vehicle_plates: string;
  vehicle_vin: string;
  vehicle_model: string;
  vehicle_year: string;
}

const SUBRAMOS = [
  'Auto individual', 'Auto flotilla', 'Gastos Médicos Mayores', 'Vida',
  'Hogar', 'Responsabilidad Civil', 'Daños', 'Empresarial',
  'Mascotas', 'Viaje', 'Accidentes Personales', 'Otro',
];

const RAMO_BY_SUBRAMO: Record<string, string> = {
  'Auto individual': 'Vehiculos',
  'Auto flotilla': 'Vehiculos',
  'Gastos Médicos Mayores': 'Salud',
  'Vida': 'Vida',
  'Hogar': 'Hogar',
  'Responsabilidad Civil': 'Daños',
  'Daños': 'Daños',
  'Empresarial': 'Daños',
  'Mascotas': 'Daños',
  'Viaje': 'Viaje',
  'Accidentes Personales': 'Vida',
  'Otro': 'Otro',
};

const DOC_TYPES = ['Póliza', 'Recibo', 'Endoso', 'Factura', 'Condiciones generales', 'Identificación', 'Otro'];

const EMPTY_FORM: ExternalPolicyForm = {
  insurer_name: '', ramo: '', subramo: '', policy_number: '',
  start_date: '', end_date: '', contractor_name: '', insured_name: '',
  total_premium: '', currency: 'MXN', payment_method: '', payment_frequency: '',
  notes: '', insurer_phone: '', insurer_website: '', beneficiaries: '',
  vehicle_plates: '', vehicle_vin: '', vehicle_model: '', vehicle_year: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysRemaining(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function fmt(s: string | null | undefined) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(n: number | null | undefined, currency?: string | null) {
  if (!n) return null;
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency && currency !== 'Pesos' && currency !== 'MXN' ? ' ' + currency : ''}`;
}

function getRamoIcon(ramo: string) {
  const r = (ramo || '').toLowerCase();
  if (r.includes('vehiculo') || r.includes('auto')) return Car;
  if (r.includes('vida') || r.includes('salud') || r.includes('gmm') || r.includes('gastos') || r.includes('accidente')) return Heart;
  if (r.includes('hogar') || r.includes('casa') || r.includes('inmueble')) return Home;
  return Shield;
}

function getStatusConfig(isVigente: boolean, isCancelada: boolean, endDate: string | null) {
  if (isCancelada) return {
    label: 'Cancelada', icon: XCircle,
    badgeCls: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    dot: 'bg-neutral-400',
    bannerCls: 'bg-neutral-50 border-neutral-200',
    textCls: 'text-neutral-600',
  };
  const days = endDate ? getDaysRemaining(endDate) : 999;
  if (!isVigente || days < 0) return {
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
    alert: `${days} dias restantes`,
  };
}

function DocTypeIcon({ ext }: { ext: string }) {
  const e = (ext || '').toLowerCase();
  if (e === 'pdf') return <FileText className="w-4 h-4 text-red-500" />;
  if (['xls', 'xlsx'].includes(e)) return <FileCheck className="w-4 h-4 text-emerald-500" />;
  if (['doc', 'docx'].includes(e)) return <BookOpen className="w-4 h-4 text-blue-500" />;
  if (['jpg', 'jpeg', 'png', 'webp'].includes(e)) return <Award className="w-4 h-4 text-orange-400" />;
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
  title: string; icon: React.ElementType; children: React.ReactNode; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden">
      <button
        onClick={() => collapsible && setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-4 py-3', collapsible && 'hover:bg-neutral-100 transition-colors')}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-neutral-500" />
          <p className="text-xs font-bold text-neutral-700 uppercase tracking-wide">{title}</p>
        </div>
        {collapsible && (open ? <ChevronUp className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />)}
      </button>
      {open && <div className="px-4 pb-4 grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>}
    </div>
  );
}

function PolicyTimeline({ desde, hasta, emision }: { desde: string; hasta: string; emision: string }) {
  const items = [
    { label: 'Emision', date: emision, icon: FileText },
    { label: 'Inicio vigencia', date: desde, icon: CheckCircle },
    { label: 'Fin vigencia', date: hasta, icon: Clock },
  ].filter(i => i.date);
  if (!items.length) return null;
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
              <div className={cn('w-[30px] h-[30px] rounded-full border-2 flex items-center justify-center flex-shrink-0 relative z-10 bg-white',
                isPast && !isLast ? 'border-emerald-400' : isLast ? 'border-neutral-300' : 'border-neutral-300')}>
                <item.icon className={cn('w-3 h-3', isPast && !isLast ? 'text-emerald-500' : 'text-neutral-400')} />
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

// ─── SICAS Policy Detail Modal ────────────────────────────────────────────────

function SicasPolicyDetail({ policy, onClose, primary }: {
  policy: Policy; onClose: () => void; primary: string;
}) {
  const { customer } = useSeguwallet();
  const [files, setFiles] = useState<DigitalFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesFetched, setFilesFetched] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [fileGroups, setFileGroups] = useState<Record<string, DigitalFile[]>>({});

  const st = getStatusConfig(policy.is_vigente, policy.is_cancelada, policy.vigencia_hasta);

  useEffect(() => { if (policy.id_docto) fetchFiles(); }, [policy.id_docto]);

  const fetchFiles = async () => {
    setFilesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seguwallet-get-policy-files`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
          body: JSON.stringify({ id_docto: policy.id_docto, poliza: policy.poliza }) }
      );
      if (res.ok) {
        const data = await res.json();
        const archivos: DigitalFile[] = data.archivos || [];
        setFiles(archivos);
        const groups: Record<string, DigitalFile[]> = {};
        for (const f of archivos) {
          const key = f.carpeta || 'General';
          if (!groups[key]) groups[key] = [];
          groups[key].push(f);
        }
        setFileGroups(groups);
      }
    } catch (err) { console.error(err); }
    finally { setFilesLoading(false); setFilesFetched(true); }
  };

  const handleDownload = async (file: DigitalFile) => {
    if (!customer) return;
    setDownloading(file.id);
    try {
      await logDownload(customer.id, { document_id: file.id, document_type: file.tipo_archivo, document_name: file.nombre_archivo, policy_number: policy.poliza });
      if (file.url_descarga) window.open(file.url_descarga, '_blank', 'noopener,noreferrer');
    } catch (err) { console.error(err); }
    finally { setDownloading(null); }
  };

  // Determine concept based on ramo/vehicle data
  const vehicleConcept = policy.subramo?.toLowerCase().includes('auto') || policy.ramo?.toLowerCase().includes('vehiculo')
    ? [policy.cliente].filter(Boolean).join(' — ')
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="h-1" style={{ backgroundColor: primary }} />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-start gap-3">
            <InsurerLogo name={policy.aseguradora_nombre || policy.compania || ''} size={44} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-neutral-900 text-base">{policy.poliza || 'Sin numero'}</p>
                <span className={cn('px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1', st.badgeCls)}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />{st.label}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {policy.aseguradora_nombre || policy.compania || '-'}
                {policy.ramo && <span className="text-neutral-300 mx-1.5">·</span>}
                {policy.subramo || policy.ramo}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <div className="p-5 space-y-4">

            {/* Status banner */}
            <div className={cn('rounded-2xl p-4 border', st.bannerCls)}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <st.icon className={cn('w-4 h-4', st.textCls)} />
                  <span className={cn('text-sm font-bold', st.textCls)}>{st.label}</span>
                </div>
                {(st as any).alert && <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-lg border', st.badgeCls)}>{(st as any).alert}</span>}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-neutral-600">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{fmt(policy.vigencia_desde)} — {fmt(policy.vigencia_hasta)}</span>
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
              {policy.status_texto && <InfoRow label="Estatus" value={policy.status_texto} />}
              {policy.status_cobro && <InfoRow label="Estatus cobro" value={policy.status_cobro} />}
            </SectionCard>

            {/* Asegurado */}
            {policy.cliente && (
              <SectionCard title="Asegurado" icon={User}>
                <InfoRow label="Nombre" value={policy.cliente} />
              </SectionCard>
            )}

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
            {(policy.vigencia_desde || policy.vigencia_hasta || policy.fecha_emision) && (
              <div className="bg-neutral-50 rounded-2xl border border-neutral-100 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                  <p className="text-xs font-bold text-neutral-700 uppercase tracking-wide">Fechas importantes</p>
                </div>
                <PolicyTimeline desde={policy.vigencia_desde} hasta={policy.vigencia_hasta} emision={policy.fecha_emision} />
              </div>
            )}

            {/* Documents */}
            <div className="bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden">
              <div className="px-4 pt-3 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-neutral-500" />
                  <p className="text-xs font-bold text-neutral-700 uppercase tracking-wide">Documentos</p>
                  {!filesLoading && filesFetched && <span className="text-[10px] text-neutral-400">({files.length})</span>}
                </div>
                {filesFetched && (
                  <button onClick={fetchFiles} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-all">
                    <RefreshCw className={cn('w-3.5 h-3.5', filesLoading && 'animate-spin')} />
                  </button>
                )}
              </div>
              <div className="px-4 pb-4">
                {filesLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-neutral-200/60 rounded-xl animate-pulse" />)}</div>
                ) : files.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-neutral-500">Sin documentos disponibles</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">Los documentos apareceran cuando esten disponibles en el Centro Digital</p>
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
                            <div key={file.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-neutral-100 hover:border-neutral-200 transition-all">
                              <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-100 flex-shrink-0"><DocTypeIcon ext={file.extension} /></div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-neutral-900 truncate">{file.nombre_archivo}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {file.tipo_archivo && <span className="text-[10px] text-neutral-400 uppercase">{file.tipo_archivo}</span>}
                                  {file.tamanio_legible && <span className="text-[10px] text-neutral-300">{file.tamanio_legible}</span>}
                                </div>
                              </div>
                              <button onClick={() => handleDownload(file)} disabled={downloading === file.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-all flex-shrink-0">
                                {downloading === file.id
                                  ? <div className="w-3.5 h-3.5 border-2 border-neutral-400/30 border-t-neutral-500 rounded-full animate-spin" />
                                  : <ExternalLink className="w-3.5 h-3.5" />}
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

            {policy.id_docto && <p className="text-center text-[10px] text-neutral-300 font-mono">Ref. SICAS: {policy.id_docto}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── External Policy Detail Modal ─────────────────────────────────────────────

function ExternalPolicyDetail({ policy, onClose, primary, onEdit, onDelete }: {
  policy: ExternalPolicy; onClose: () => void; primary: string;
  onEdit: () => void; onDelete: () => void;
}) {
  const { customer } = useSeguwallet();
  const [docs, setDocs] = useState<ExternalDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('Póliza');
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVigente = policy.end_date ? getDaysRemaining(policy.end_date) >= 0 : true;
  const isCancelada = policy.status === 'cancelled' || policy.status === 'cancelada';
  const st = getStatusConfig(isVigente, isCancelada, policy.end_date);
  const isVehicle = (policy.subramo || '').toLowerCase().includes('auto');

  useEffect(() => { if (customer) loadDocs(); }, [customer, policy.id]);

  const loadDocs = async () => {
    setDocsLoading(true);
    try {
      const { data } = await supabase
        .from('seguwallet_external_policy_documents')
        .select('*')
        .eq('external_policy_id', policy.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      setDocs((data || []) as ExternalDoc[]);
    } catch (err) { console.error(err); }
    finally { setDocsLoading(false); }
  };

  const handleUpload = async (file: File) => {
    if (!customer) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || '';
      const path = `seguwallet/${customer.id}/external-policies/${policy.id}/${Date.now()}_${file.name}`;
      const { data: uploaded, error: uploadError } = await supabase.storage
        .from('seguwallet-external-policies').upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('seguwallet-external-policies').getPublicUrl(path);

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('seguwallet_external_policy_documents').insert({
        external_policy_id: policy.id,
        seguwallet_customer_id: customer.id,
        document_type: uploadDocType,
        document_name: file.name,
        file_url: publicUrl,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.id,
        uploaded_by_type: 'seguwallet_customer',
      });
      await loadDocs();

      // Audit log
      await supabase.from('seguwallet_external_policy_logs').insert({
        external_policy_id: policy.id,
        seguwallet_customer_id: customer.id,
        actor_id: user?.id,
        actor_type: 'seguwallet_customer',
        event_type: 'doc_uploaded',
        metadata: { document_name: file.name, document_type: uploadDocType },
      });
    } catch (err: any) { console.error(err); alert('Error al subir el archivo: ' + err.message); }
    finally { setUploading(false); }
  };

  const handleDeleteDoc = async (doc: ExternalDoc) => {
    if (!confirm('¿Eliminar este documento?')) return;
    try {
      await supabase.from('seguwallet_external_policy_documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc.id);
      if (doc.file_path) await supabase.storage.from('seguwallet-external-policies').remove([doc.file_path]);
      setDocs(d => d.filter(x => x.id !== doc.id));
    } catch (err) { console.error(err); }
  };

  const handleConfirmDelete = async () => {
    if (!confirm('¿Eliminar esta póliza externa? Esta acción no se puede deshacer.')) return;
    setDeleting(true);
    try {
      await supabase.from('seguwallet_external_policies').update({ deleted_at: new Date().toISOString() }).eq('id', policy.id);
      onDelete();
    } catch (err) { console.error(err); setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="h-1" style={{ backgroundColor: primary }} />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-start gap-3">
            <InsurerLogo name={policy.insurer_name || ''} size={44} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-neutral-900 text-base">{policy.policy_number}</p>
                <span className={cn('px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1', st.badgeCls)}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />{st.label}
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-orange-50 text-orange-600 border-orange-200">Externa</span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {policy.insurer_name}
                {policy.subramo && <span className="text-neutral-300 mx-1.5">·</span>}
                {policy.subramo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onEdit} className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all"><Edit3 className="w-4 h-4" /></button>
            <button onClick={onClose} className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* External notice */}
        <div className="mx-5 mt-4 px-4 py-3 rounded-2xl bg-orange-50 border border-orange-100">
          <p className="text-xs text-orange-700 font-medium">Esta póliza fue agregada manualmente por ti y no forma parte de la cartera administrada por tu agente.</p>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <div className="p-5 space-y-4">

            {/* Status banner */}
            <div className={cn('rounded-2xl p-4 border', st.bannerCls)}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <st.icon className={cn('w-4 h-4', st.textCls)} />
                  <span className={cn('text-sm font-bold', st.textCls)}>{st.label}</span>
                </div>
                {(st as any).alert && <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-lg border', st.badgeCls)}>{(st as any).alert}</span>}
              </div>
              {(policy.start_date || policy.end_date) && (
                <div className="flex items-center gap-2 mt-2 text-xs text-neutral-600">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{fmt(policy.start_date)} — {fmt(policy.end_date)}</span>
                </div>
              )}
            </div>

            {/* Datos generales */}
            <SectionCard title="Datos generales" icon={Info}>
              <InfoRow label="Numero de póliza" value={policy.policy_number} />
              <InfoRow label="Aseguradora" value={policy.insurer_name} />
              <InfoRow label="Ramo" value={policy.ramo} />
              <InfoRow label="Subramo" value={policy.subramo} />
              <InfoRow label="Moneda" value={policy.currency} />
            </SectionCard>

            {/* Personas */}
            {(policy.contractor_name || policy.insured_name || policy.beneficiaries) && (
              <SectionCard title="Asegurado / Contratante" icon={User}>
                <InfoRow label="Contratante" value={policy.contractor_name} />
                <InfoRow label="Asegurado" value={policy.insured_name} />
                <InfoRow label="Beneficiarios" value={policy.beneficiaries} />
              </SectionCard>
            )}

            {/* Vehiculo */}
            {isVehicle && policy.vehicle_data && (
              <SectionCard title="Datos del vehiculo" icon={Car}>
                <InfoRow label="Placas" value={policy.vehicle_data.plates} />
                <InfoRow label="Serie / VIN" value={policy.vehicle_data.vin} />
                <InfoRow label="Modelo" value={policy.vehicle_data.model} />
                <InfoRow label="Año" value={policy.vehicle_data.year} />
              </SectionCard>
            )}

            {/* Financiero */}
            {(policy.total_premium || policy.payment_method || policy.payment_frequency) && (
              <SectionCard title="Prima y pago" icon={DollarSign}>
                <InfoRow label="Prima total" value={fmtMoney(policy.total_premium, policy.currency)} />
                <InfoRow label="Forma de pago" value={policy.payment_method} />
                <InfoRow label="Frecuencia" value={policy.payment_frequency} />
              </SectionCard>
            )}

            {/* Contacto aseguradora */}
            {(policy.insurer_phone || policy.insurer_website) && (
              <SectionCard title="Contacto aseguradora" icon={Building2}>
                <InfoRow label="Telefono" value={policy.insurer_phone} />
                <InfoRow label="Sitio web" value={policy.insurer_website} />
              </SectionCard>
            )}

            {/* Notas */}
            {policy.notes && (
              <div className="bg-neutral-50 rounded-2xl border border-neutral-100 p-4">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-2">Notas</p>
                <p className="text-sm text-neutral-700 whitespace-pre-line">{policy.notes}</p>
              </div>
            )}

            {/* Timeline */}
            {(policy.start_date || policy.end_date) && (
              <div className="bg-neutral-50 rounded-2xl border border-neutral-100 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                  <p className="text-xs font-bold text-neutral-700 uppercase tracking-wide">Vigencia</p>
                </div>
                <PolicyTimeline desde={policy.start_date || ''} hasta={policy.end_date || ''} emision="" />
              </div>
            )}

            {/* Documents */}
            <div className="bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden">
              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-neutral-500" />
                  <p className="text-xs font-bold text-neutral-700 uppercase tracking-wide">Documentos</p>
                  {!docsLoading && <span className="text-[10px] text-neutral-400">({docs.length})</span>}
                </div>
              </div>

              {/* Upload row */}
              <div className="px-4 pb-3 flex gap-2">
                <select
                  value={uploadDocType}
                  onChange={e => setUploadDocType(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs focus:outline-none"
                >
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold transition-all hover:opacity-90"
                  style={{ backgroundColor: primary }}
                >
                  {uploading
                    ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Upload className="w-3.5 h-3.5" />}
                  Subir
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
                />
              </div>

              <div className="px-4 pb-4">
                {docsLoading ? (
                  <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-neutral-200/60 rounded-xl animate-pulse" />)}</div>
                ) : docs.length === 0 ? (
                  <div className="py-6 text-center">
                    <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-neutral-500">Sin documentos</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">Sube la póliza, recibos u otros documentos</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {docs.map(doc => {
                      const ext = doc.document_name?.split('.').pop() || '';
                      return (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-neutral-100 hover:border-neutral-200 transition-all">
                          <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-100 flex-shrink-0"><DocTypeIcon ext={ext} /></div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-neutral-900 truncate">{doc.document_name || doc.document_type}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-neutral-400">{doc.document_type}</span>
                              {doc.file_size && <span className="text-[10px] text-neutral-300">{Math.round(doc.file_size / 1024)} KB</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-all">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button onClick={() => handleDeleteDoc(doc)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Danger zone */}
            <button
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="w-full py-3 rounded-2xl border border-red-100 text-red-500 text-sm font-semibold hover:bg-red-50 transition-all"
            >
              {deleting ? 'Eliminando...' : 'Eliminar póliza externa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── External Policy Wizard ───────────────────────────────────────────────────

function ExternalPolicyWizard({ onClose, onSaved, primary, customerId, agentUserId, editPolicy }: {
  onClose: () => void; onSaved: () => void; primary: string;
  customerId: string; agentUserId: string | null; editPolicy?: ExternalPolicy;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ExternalPolicyForm>(() => {
    if (editPolicy) {
      return {
        insurer_name: editPolicy.insurer_name || '',
        ramo: editPolicy.ramo || '',
        subramo: editPolicy.subramo || '',
        policy_number: editPolicy.policy_number || '',
        start_date: editPolicy.start_date || '',
        end_date: editPolicy.end_date || '',
        contractor_name: editPolicy.contractor_name || '',
        insured_name: editPolicy.insured_name || '',
        total_premium: editPolicy.total_premium ? String(editPolicy.total_premium) : '',
        currency: editPolicy.currency || 'MXN',
        payment_method: editPolicy.payment_method || '',
        payment_frequency: editPolicy.payment_frequency || '',
        notes: editPolicy.notes || '',
        insurer_phone: editPolicy.insurer_phone || '',
        insurer_website: editPolicy.insurer_website || '',
        beneficiaries: editPolicy.beneficiaries || '',
        vehicle_plates: editPolicy.vehicle_data?.plates || '',
        vehicle_vin: editPolicy.vehicle_data?.vin || '',
        vehicle_model: editPolicy.vehicle_data?.model || '',
        vehicle_year: editPolicy.vehicle_data?.year || '',
      };
    }
    return EMPTY_FORM;
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ExternalPolicyForm, string>>>({});

  const isVehicle = form.subramo.toLowerCase().includes('auto');
  const isEdit = !!editPolicy;

  const set = (key: keyof ExternalPolicyForm, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const validateStep1 = () => {
    const e: typeof errors = {};
    if (!form.insurer_name.trim()) e.insurer_name = 'Requerido';
    if (!form.subramo) e.subramo = 'Requerido';
    if (!form.policy_number.trim()) e.policy_number = 'Requerido';
    if (!form.start_date) e.start_date = 'Requerido';
    if (!form.end_date) e.end_date = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep(s => s + 1);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const vehicle_data = isVehicle ? {
        plates: form.vehicle_plates, vin: form.vehicle_vin, model: form.vehicle_model, year: form.vehicle_year,
      } : null;

      const payload = {
        seguwallet_customer_id: customerId,
        agent_user_id: agentUserId || user?.id,
        insurer_name: form.insurer_name.trim(),
        ramo: RAMO_BY_SUBRAMO[form.subramo] || form.subramo,
        subramo: form.subramo,
        policy_number: form.policy_number.trim(),
        contractor_name: form.contractor_name.trim() || null,
        insured_name: form.insured_name.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        total_premium: form.total_premium ? parseFloat(form.total_premium) : null,
        currency: form.currency,
        payment_method: form.payment_method || null,
        payment_frequency: form.payment_frequency || null,
        notes: form.notes.trim() || null,
        insurer_phone: form.insurer_phone.trim() || null,
        insurer_website: form.insurer_website.trim() || null,
        beneficiaries: form.beneficiaries.trim() || null,
        vehicle_data,
        created_by: user?.id,
      };

      if (isEdit) {
        await supabase.from('seguwallet_external_policies').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editPolicy!.id);
        await supabase.from('seguwallet_external_policy_logs').insert({
          external_policy_id: editPolicy!.id, seguwallet_customer_id: customerId,
          actor_id: user?.id, actor_type: 'seguwallet_customer', event_type: 'updated',
        });
      } else {
        const { data: inserted } = await supabase.from('seguwallet_external_policies').insert(payload).select('id').single();
        if (inserted) {
          await supabase.from('seguwallet_external_policy_logs').insert({
            external_policy_id: inserted.id, seguwallet_customer_id: customerId,
            actor_id: user?.id, actor_type: 'seguwallet_customer', event_type: 'created',
          });
        }
      }
      onSaved();
    } catch (err: any) { console.error(err); alert('Error al guardar: ' + err.message); }
    finally { setSaving(false); }
  };

  const stepLabels = ['Datos de póliza', 'Información adicional', 'Confirmar'];
  const Field = ({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-semibold text-neutral-600 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
  const inputCls = (err?: string) => cn('w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all', err ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-400');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="h-1" style={{ backgroundColor: primary }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-neutral-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-neutral-900 text-base">{isEdit ? 'Editar póliza externa' : 'Agregar póliza externa'}</h2>
            <p className="text-xs text-neutral-400 mt-0.5">{stepLabels[step - 1]}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all"><X className="w-5 h-5" /></button>
        </div>

        {/* Progress */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0">
          <div className="flex gap-1.5">
            {[1, 2, 3].map(s => (
              <div key={s} className={cn('h-1.5 flex-1 rounded-full transition-all', s <= step ? '' : 'bg-neutral-200')}
                style={{ backgroundColor: s <= step ? primary : undefined }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">

          {step === 1 && (
            <div className="space-y-4">
              <Field label="Aseguradora" required error={errors.insurer_name}>
                <input type="text" value={form.insurer_name} onChange={e => set('insurer_name', e.target.value)}
                  placeholder="Ej. Qualitas, GNP, ANA Seguros..." className={inputCls(errors.insurer_name)} />
              </Field>

              <Field label="Subramo / Tipo de seguro" required error={errors.subramo}>
                <select value={form.subramo} onChange={e => set('subramo', e.target.value)} className={inputCls(errors.subramo)}>
                  <option value="">Seleccionar...</option>
                  {SUBRAMOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Número de póliza" required error={errors.policy_number}>
                <input type="text" value={form.policy_number} onChange={e => set('policy_number', e.target.value)}
                  placeholder="Ej. 5735439" className={inputCls(errors.policy_number)} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Vigencia desde" required error={errors.start_date}>
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputCls(errors.start_date)} />
                </Field>
                <Field label="Vigencia hasta" required error={errors.end_date}>
                  <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={inputCls(errors.end_date)} />
                </Field>
              </div>

              {isVehicle && (
                <div className="rounded-2xl bg-neutral-50 border border-neutral-100 p-4 space-y-3">
                  <p className="text-xs font-bold text-neutral-600 uppercase tracking-wide">Datos del vehículo</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Placas"><input type="text" value={form.vehicle_plates} onChange={e => set('vehicle_plates', e.target.value)} placeholder="ABC-1234" className={inputCls()} /></Field>
                    <Field label="Serie / VIN"><input type="text" value={form.vehicle_vin} onChange={e => set('vehicle_vin', e.target.value)} className={inputCls()} /></Field>
                    <Field label="Modelo"><input type="text" value={form.vehicle_model} onChange={e => set('vehicle_model', e.target.value)} placeholder="Ej. Nissan Versa" className={inputCls()} /></Field>
                    <Field label="Año"><input type="text" value={form.vehicle_year} onChange={e => set('vehicle_year', e.target.value)} placeholder="Ej. 2022" className={inputCls()} /></Field>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contratante"><input type="text" value={form.contractor_name} onChange={e => set('contractor_name', e.target.value)} className={inputCls()} /></Field>
                <Field label="Asegurado"><input type="text" value={form.insured_name} onChange={e => set('insured_name', e.target.value)} className={inputCls()} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prima total">
                  <div className="flex gap-1.5">
                    <input type="number" value={form.total_premium} onChange={e => set('total_premium', e.target.value)} placeholder="0.00" className={cn(inputCls(), 'flex-1 min-w-0')} />
                    <select value={form.currency} onChange={e => set('currency', e.target.value)} className="px-2 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none bg-white">
                      <option>MXN</option><option>USD</option>
                    </select>
                  </div>
                </Field>
                <Field label="Frecuencia de pago">
                  <select value={form.payment_frequency} onChange={e => set('payment_frequency', e.target.value)} className={inputCls()}>
                    <option value="">-</option>
                    <option>Anual</option><option>Semestral</option><option>Trimestral</option><option>Mensual</option>
                  </select>
                </Field>
              </div>
              <Field label="Forma de pago">
                <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className={inputCls()}>
                  <option value="">-</option>
                  <option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Domiciliación</option>
                </select>
              </Field>
              <Field label="Beneficiarios"><input type="text" value={form.beneficiaries} onChange={e => set('beneficiaries', e.target.value)} placeholder="Opcional" className={inputCls()} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tel. aseguradora"><input type="tel" value={form.insurer_phone} onChange={e => set('insurer_phone', e.target.value)} className={inputCls()} /></Field>
                <Field label="Sitio web"><input type="url" value={form.insurer_website} onChange={e => set('insurer_website', e.target.value)} placeholder="https://..." className={inputCls()} /></Field>
              </div>
              <Field label="Notas">
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Notas adicionales..." className={cn(inputCls(), 'resize-none')} />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-neutral-50 border border-neutral-100 p-4 space-y-3">
                <p className="text-xs font-bold text-neutral-600 uppercase tracking-wide mb-2">Resumen</p>
                <div className="space-y-2">
                  {[
                    ['Aseguradora', form.insurer_name],
                    ['Subramo', form.subramo],
                    ['Número de póliza', form.policy_number],
                    ['Vigencia', form.start_date && form.end_date ? `${fmt(form.start_date)} — ${fmt(form.end_date)}` : '-'],
                    form.total_premium ? ['Prima total', `$${parseFloat(form.total_premium).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${form.currency}`] : null,
                    form.contractor_name ? ['Contratante', form.contractor_name] : null,
                    form.insured_name ? ['Asegurado', form.insured_name] : null,
                    isVehicle && form.vehicle_plates ? ['Placas', form.vehicle_plates] : null,
                    isVehicle && form.vehicle_model ? ['Modelo', `${form.vehicle_model} ${form.vehicle_year}`] : null,
                  ].filter(Boolean).map(([label, value]: any) => (
                    <div key={label} className="flex justify-between items-start gap-2">
                      <span className="text-xs text-neutral-500 flex-shrink-0">{label}</span>
                      <span className="text-xs font-semibold text-neutral-900 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {!isEdit && (
                <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                  <p className="text-xs text-blue-700 font-medium">Después de guardar podrás subir documentos como la póliza, recibos y endosos desde el detalle.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-100 flex items-center gap-3 flex-shrink-0">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-all">
              <ArrowLeft className="w-4 h-4" /> Atrás
            </button>
          )}
          <div className="flex-1" />
          {step < 3 ? (
            <button onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: primary }}>
              Siguiente <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: primary }}>
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {isEdit ? 'Guardar cambios' : 'Guardar póliza'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Policy Card (shared) ─────────────────────────────────────────────────────

function SicasPolicyCard({ policy, primary, onClick }: { policy: Policy; primary: string; onClick: () => void }) {
  const st = getStatusConfig(policy.is_vigente, policy.is_cancelada, policy.vigencia_hasta);
  const days = getDaysRemaining(policy.vigencia_hasta);
  const isExpiringSoon = policy.is_vigente && !policy.is_cancelada && days >= 0 && days <= 30;
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-neutral-200/40 shadow-sm p-4 hover:shadow-lg transition-all duration-200 text-left group hover:border-neutral-300 hover:-translate-y-0.5 flex flex-col gap-3"
    >
      {/* Top: logo + status */}
      <div className="flex items-start justify-between gap-2">
        <InsurerLogo name={policy.aseguradora_nombre || policy.compania || ''} size={40} />
        <span className={cn('px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 leading-none flex-shrink-0', st.badgeCls)}>
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', st.dot)} />{st.label}
        </span>
      </div>

      {/* Policy number */}
      <div className="min-w-0">
        <p className="font-bold text-neutral-900 text-sm truncate leading-tight">{policy.poliza || 'Sin numero'}</p>
        <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{policy.subramo || policy.ramo}</p>
      </div>

      {/* Bottom: date */}
      <div className="flex items-center justify-between mt-auto">
        <span className="text-[11px] text-neutral-400 flex items-center gap-1">
          <Calendar className="w-3 h-3 flex-shrink-0" />
          {fmt(policy.vigencia_hasta)}
        </span>
        {isExpiringSoon && (
          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">{days}d</span>
        )}
      </div>
    </button>
  );
}

function ExternalPolicyCard({ policy, primary, onClick }: { policy: ExternalPolicy; primary: string; onClick: () => void }) {
  const isVigente = policy.end_date ? getDaysRemaining(policy.end_date) >= 0 : true;
  const isCancelada = policy.status === 'cancelled' || policy.status === 'cancelada';
  const st = getStatusConfig(isVigente, isCancelada, policy.end_date);
  const days = policy.end_date ? getDaysRemaining(policy.end_date) : 999;
  const isExpiringSoon = isVigente && !isCancelada && days >= 0 && days <= 30;
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-orange-100 shadow-sm p-4 hover:shadow-lg transition-all duration-200 text-left group hover:border-orange-200 hover:-translate-y-0.5 flex flex-col gap-3"
    >
      {/* Top: logo + status + externa badge */}
      <div className="flex items-start justify-between gap-2">
        <InsurerLogo name={policy.insurer_name || ''} size={40} />
        <div className="flex flex-col items-end gap-1">
          <span className={cn('px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 leading-none flex-shrink-0', st.badgeCls)}>
            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', st.dot)} />{st.label}
          </span>
          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-orange-50 text-orange-600 border-orange-200 leading-none">Externa</span>
        </div>
      </div>

      {/* Policy number */}
      <div className="min-w-0">
        <p className="font-bold text-neutral-900 text-sm truncate leading-tight">{policy.policy_number}</p>
        <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{policy.subramo}</p>
      </div>

      {/* Bottom: date */}
      <div className="flex items-center justify-between mt-auto">
        {policy.end_date ? (
          <span className="text-[11px] text-neutral-400 flex items-center gap-1">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            {fmt(policy.end_date)}
          </span>
        ) : <span />}
        {isExpiringSoon && (
          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">{days}d</span>
        )}
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SeguwalletPolizas() {
  const { customer } = useSeguwallet();
  const { brand } = useAgentBrand();
  const [tab, setTab] = useState<'sicas' | 'externas'>('sicas');

  // SICAS state
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [filtered, setFiltered] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [aseguradoraFilter, setAseguradoraFilter] = useState('all');
  const [aseguradoras, setAseguradoras] = useState<string[]>([]);
  const [selectedSicas, setSelectedSicas] = useState<Policy | null>(null);

  // External policies state
  const [extPolicies, setExtPolicies] = useState<ExternalPolicy[]>([]);
  const [extLoading, setExtLoading] = useState(false);
  const [extLoaded, setExtLoaded] = useState(false);
  const [selectedExt, setSelectedExt] = useState<ExternalPolicy | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [editingExt, setEditingExt] = useState<ExternalPolicy | undefined>(undefined);

  const primary = brand.primaryColor;

  useEffect(() => { if (customer) { loadPolicies(); loadExternal(); } }, [customer]);

  useEffect(() => {
    let r = [...policies];
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(p => p.poliza?.toLowerCase().includes(q) || p.aseguradora_nombre?.toLowerCase().includes(q) || p.subramo?.toLowerCase().includes(q));
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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadExternal = async () => {
    if (!customer) return;
    setExtLoading(true);
    try {
      const { data } = await supabase
        .from('seguwallet_external_policies')
        .select('*')
        .eq('seguwallet_customer_id', customer.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      setExtPolicies((data || []) as ExternalPolicy[]);
    } catch (err) { console.error(err); }
    finally { setExtLoading(false); setExtLoaded(true); }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div><div className="h-7 w-40 bg-neutral-200 rounded-xl animate-pulse mb-2" /><div className="h-4 w-64 bg-neutral-100 rounded-lg animate-pulse" /></div>
        <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-4"><div className="h-10 bg-neutral-100 rounded-xl animate-pulse" /></div>
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-5 h-24 animate-pulse" />)}
      </div>
    );
  }

  const vigentesCount = policies.filter(p => p.is_vigente && !p.is_cancelada).length;
  const extVigentesCount = extPolicies.filter(p => {
    const v = p.end_date ? getDaysRemaining(p.end_date) >= 0 : true;
    return v && p.status !== 'cancelled';
  }).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Mis Pólizas</h1>
        <p className="text-sm text-neutral-500 mt-1">Consulta tus coberturas, vigencias y documentos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 p-1 rounded-2xl">
        <button
          onClick={() => setTab('sicas')}
          className={cn('flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all', tab === 'sicas' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700')}
        >
          Mis pólizas
          {policies.length > 0 && (
            <span className={cn('ml-2 text-xs px-1.5 py-0.5 rounded-md font-bold', tab === 'sicas' ? 'bg-neutral-100 text-neutral-700' : 'bg-neutral-200 text-neutral-500')}>
              {vigentesCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('externas'); if (!extLoaded) loadExternal(); }}
          className={cn('flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all', tab === 'externas' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700')}
        >
          Externas
          {extPolicies.length > 0 && (
            <span className={cn('ml-2 text-xs px-1.5 py-0.5 rounded-md font-bold', tab === 'externas' ? 'bg-orange-100 text-orange-700' : 'bg-neutral-200 text-neutral-500')}>
              {extVigentesCount}
            </span>
          )}
        </button>
      </div>

      {/* ── SICAS tab ─────────────────────────────────────────────────────── */}
      {tab === 'sicas' && (
        <>
          {policies.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total', value: policies.length, color: 'text-neutral-900' },
                { label: 'Vigentes', value: vigentesCount, color: 'text-emerald-600' },
                { label: 'Por vencer', value: policies.filter(p => p.is_vigente && !p.is_cancelada && getDaysRemaining(p.vigencia_hasta) <= 30).length, color: 'text-amber-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-3.5 text-center">
                  <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-[10px] text-neutral-400 font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por número, aseguradora..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none transition-all" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="flex-1 min-w-[120px] px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none">
                <option value="all">Todos los estatus</option>
                <option value="vigente">Vigentes</option>
                <option value="vencida">Vencidas</option>
                <option value="cancelada">Canceladas</option>
              </select>
              {aseguradoras.length > 1 && (
                <select value={aseguradoraFilter} onChange={e => setAseguradoraFilter(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none">
                  <option value="all">Todas las aseguradoras</option>
                  {aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-12 text-center">
              <Shield className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-neutral-500">{policies.length === 0 ? 'No tienes pólizas asignadas' : 'Sin resultados'}</p>
              <p className="text-xs text-neutral-400 mt-1">{policies.length === 0 ? 'Contacta a tu agente para más información' : 'Prueba con otros filtros'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(p => <SicasPolicyCard key={p.id} policy={p} primary={primary} onClick={() => setSelectedSicas(p)} />)}
            </div>
          )}
        </>
      )}

      {/* ── External tab ──────────────────────────────────────────────────── */}
      {tab === 'externas' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">Pólizas agregadas manualmente por ti</p>
            <button
              onClick={() => { setEditingExt(undefined); setShowWizard(true); }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 shadow-sm"
              style={{ backgroundColor: primary }}
            >
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>

          {extLoading ? (
            <div className="space-y-2.5">{[1,2].map(i => <div key={i} className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-5 h-24 animate-pulse" />)}</div>
          ) : extPolicies.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-orange-300" />
              </div>
              <p className="text-sm font-semibold text-neutral-600">Sin pólizas externas</p>
              <p className="text-xs text-neutral-400 mt-1 mb-4">Agrega pólizas de cualquier aseguradora como tu bóveda personal de seguros</p>
              <button
                onClick={() => { setEditingExt(undefined); setShowWizard(true); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: primary }}
              >
                <Plus className="w-4 h-4" /> Agregar mi primera póliza
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {extPolicies.map(p => <ExternalPolicyCard key={p.id} policy={p} primary={primary} onClick={() => setSelectedExt(p)} />)}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {selectedSicas && <SicasPolicyDetail policy={selectedSicas} onClose={() => setSelectedSicas(null)} primary={primary} />}

      {selectedExt && (
        <ExternalPolicyDetail
          policy={selectedExt}
          onClose={() => setSelectedExt(null)}
          primary={primary}
          onEdit={() => { setEditingExt(selectedExt); setSelectedExt(null); setShowWizard(true); }}
          onDelete={() => { setSelectedExt(null); loadExternal(); }}
        />
      )}

      {showWizard && customer && (
        <ExternalPolicyWizard
          onClose={() => { setShowWizard(false); setEditingExt(undefined); }}
          onSaved={() => { setShowWizard(false); setEditingExt(undefined); loadExternal(); setTab('externas'); }}
          primary={primary}
          customerId={customer.id}
          agentUserId={customer.agent_user_id}
          editPolicy={editingExt}
        />
      )}
    </div>
  );
}
