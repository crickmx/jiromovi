import { useState, useEffect, useCallback } from 'react';
import {
  X, FileText, User, Calendar, CreditCard, Building2,
  Hash, ChevronDown, ChevronUp, Loader2, AlertTriangle,
  Shield, Clock, DollarSign, MapPin, FolderOpen, Download,
  File, Image, FileSpreadsheet, FileType,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate, formatFullCurrency, daysUntilRenewal, renewalUrgencyColor } from '../../lib/sicasDashboardTypes';
import type { SicasDocRow } from '../../lib/sicasDashboardTypes';

interface Props {
  docId: string;
  isAdmin: boolean;
  onClose: () => void;
}

interface CentroDigitalArchivo {
  id: string;
  nombre: string;
  nombre_archivo: string;
  tipo_archivo: string;
  extension: string;
  tamanio_bytes: number;
  tamanio_legible: string;
  fecha_subida: string;
  es_descargable: boolean;
}

export default function DocumentoModal({ docId, isAdmin, onClose }: Props) {
  const [doc, setDoc] = useState<SicasDocRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('resumen');

  // Centro Digital state
  const [archivos, setArchivos] = useState<CentroDigitalArchivo[]>([]);
  const [loadingArchivos, setLoadingArchivos] = useState(false);
  const [archivosError, setArchivosError] = useState<string | null>(null);
  const [archivosFetched, setArchivosFetched] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('sicas_documents')
        .select('*')
        .eq('id', docId)
        .maybeSingle();
      if (!error && data) setDoc(data as SicasDocRow);
      setLoading(false);
    })();
  }, [docId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const fetchCentroDigital = useCallback(async () => {
    if (!doc?.id_docto || archivosFetched) return;
    setLoadingArchivos(true);
    setArchivosError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No autenticado');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sicas-get-digital-files`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idDocto: doc.id_docto,
          identity: 'H02',
          valuePK: doc.id_docto,
        }),
      });

      const result = await response.json();
      if (result.success && result.files) {
        const mapped: CentroDigitalArchivo[] = result.files.map((f: Record<string, unknown>, idx: number) => {
          const fileName = (f.FileName || f.Nombre || 'Sin nombre') as string;
          const ext = ((f.FileExtension || f.Extension || fileName.split('.').pop()) as string || 'bin').replace(/^\./, '');
          const size = (f.FileSize || f.Tamanio || 0) as number;
          return {
            id: (f.IDFile || f.Id || `file_${idx}`) as string,
            nombre: fileName,
            nombre_archivo: fileName,
            tipo_archivo: (f.FileType || f.Tipo || 'application/octet-stream') as string,
            extension: ext,
            tamanio_bytes: size,
            tamanio_legible: formatFileSize(size),
            fecha_subida: (f.UploadDate || f.DocumentDate || f.FechaSubida || '') as string,
            es_descargable: f.IsDownloadable !== false,
          };
        });
        setArchivos(mapped);
      } else {
        setArchivosError(result.error || 'No se pudieron obtener los archivos');
      }
    } catch (err) {
      setArchivosError((err as Error).message);
    } finally {
      setLoadingArchivos(false);
      setArchivosFetched(true);
    }
  }, [doc?.id_docto, archivosFetched]);

  useEffect(() => {
    if (activeSection === 'centro-digital' && doc && !archivosFetched) {
      fetchCentroDigital();
    }
  }, [activeSection, doc, archivosFetched, fetchCentroDigital]);

  const days = doc ? daysUntilRenewal(doc.vigencia_hasta) : null;

  const sections = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'cliente', label: 'Cliente' },
    { id: 'vigencia', label: 'Vigencia' },
    { id: 'importes', label: 'Importes' },
    { id: 'clasificacion', label: 'Clasificacion' },
    { id: 'comercial', label: 'Relacion Comercial' },
    { id: 'centro-digital', label: 'Centro Digital' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            {loading ? (
              <div className="h-6 w-48 bg-blue-500/40 rounded animate-pulse" />
            ) : doc ? (
              <>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-blue-200 text-[10px] font-medium uppercase tracking-wider">{doc.tipo_documento || 'Documento'}</span>
                  {doc.moneda && doc.moneda !== 'MXN' && (
                    <span className="text-[9px] font-bold bg-blue-500/40 text-blue-100 px-1.5 py-0.5 rounded">{doc.moneda}</span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-white truncate">{doc.poliza || doc.id_docto}</h2>
                <p className="text-blue-200 text-xs mt-0.5">{doc.compania}{doc.ramo ? ` - ${doc.ramo}` : ''}</p>
              </>
            ) : (
              <p className="text-white">Documento no encontrado</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {doc && <HeaderStatusBadge status={doc.status_texto} isVigente={doc.is_vigente} isCancelada={doc.is_cancelada} />}
            <button onClick={onClose} className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Section tabs */}
        {doc && (
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 px-4 overflow-x-auto shrink-0">
            <div className="flex gap-0.5 min-w-max">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeSection === s.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

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
            <>
              {activeSection === 'resumen' && <ResumenSection doc={doc} days={days} />}
              {activeSection === 'cliente' && <ClienteSection doc={doc} />}
              {activeSection === 'vigencia' && <VigenciaSection doc={doc} days={days} />}
              {activeSection === 'importes' && <ImportesSection doc={doc} />}
              {activeSection === 'clasificacion' && <ClasificacionSection doc={doc} />}
              {activeSection === 'comercial' && <ComercialSection doc={doc} />}
              {activeSection === 'centro-digital' && (
                <CentroDigitalSection
                  archivos={archivos}
                  loading={loadingArchivos}
                  error={archivosError}
                  onRetry={() => { setArchivosFetched(false); }}
                />
              )}
            </>
          )}

          {isAdmin && doc?.raw_data && (
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <button onClick={() => setShowRaw(!showRaw)} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <Hash className="w-4 h-4" /> Datos crudos
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

function ResumenSection({ doc, days }: { doc: SicasDocRow; days: number | null }) {
  return (
    <div className="space-y-5">
      {/* Quick KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickStat label="Prima Neta" value={formatFullCurrency(doc.prima_neta)} icon={DollarSign} />
        <QuickStat label="Prima Total" value={formatFullCurrency(doc.prima_total)} icon={CreditCard} />
        <QuickStat
          label="Vigencia"
          value={days !== null ? (days <= 0 ? 'Vencido' : `${days} dias`) : formatDate(doc.vigencia_hasta)}
          icon={Calendar}
          color={days !== null && days <= 30 ? 'text-amber-600' : undefined}
        />
        <QuickStat label="Moneda" value={doc.moneda || 'MXN'} icon={DollarSign} />
      </div>

      {/* Key info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard icon={User} title="Cliente" fields={[
          { label: 'Nombre', value: doc.cliente },
        ]} />
        <InfoCard icon={Building2} title="Aseguradora" fields={[
          { label: 'Compania', value: doc.compania },
          { label: 'Ramo', value: doc.ramo },
          { label: 'Subramo', value: doc.subramo },
        ]} />
        <InfoCard icon={Calendar} title="Vigencia" fields={[
          { label: 'Desde', value: formatDate(doc.vigencia_desde) },
          { label: 'Hasta', value: formatDate(doc.vigencia_hasta) },
          { label: 'Emision', value: formatDate(doc.fecha_emision) },
        ]} />
        <InfoCard icon={Shield} title="Estatus" fields={[
          { label: 'Estado', value: doc.status_texto },
          { label: 'Cobro', value: doc.status_cobro },
        ]}>
          <div className="flex gap-1.5 mt-2">
            {doc.is_vigente && <Tag text="Vigente" color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" />}
            {doc.is_cancelada && <Tag text="Cancelada" color="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" />}
            {doc.is_renewable && <Tag text="Renovable" color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" />}
            {doc.is_poliza && <Tag text="Poliza" color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" />}
            {doc.is_fianza && <Tag text="Fianza" color="bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" />}
          </div>
        </InfoCard>
      </div>

      {/* Renewal warning */}
      {doc.is_renewable && days !== null && days <= 30 && (
        <div className={`flex items-center gap-3 p-3 rounded-lg ${
          days <= 0 ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
          days <= 7 ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
          days <= 15 ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800' :
          'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
        }`}>
          <Clock className={`w-5 h-5 shrink-0 ${renewalUrgencyColor(days)}`} />
          <div>
            <p className={`text-sm font-semibold ${renewalUrgencyColor(days)}`}>
              {days <= 0 ? 'Documento vencido' : `Vence en ${days} dias`}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              Vigencia hasta: {formatDate(doc.vigencia_hasta)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ClienteSection({ doc }: { doc: SicasDocRow }) {
  return (
    <div className="space-y-4">
      <InfoCard icon={User} title="Informacion del Cliente" fields={[
        { label: 'Nombre / Razon Social', value: doc.cliente },
      ]} />
      <InfoCard icon={FileText} title="Documento" fields={[
        { label: 'Numero de Poliza', value: doc.poliza },
        { label: 'ID Documento SICAS', value: doc.id_docto },
        { label: 'Tipo', value: doc.tipo_documento },
        { label: 'Subtipo', value: doc.subtipo_documento },
      ]} />
    </div>
  );
}

function VigenciaSection({ doc, days }: { doc: SicasDocRow; days: number | null }) {
  return (
    <div className="space-y-4">
      <InfoCard icon={Calendar} title="Fechas de Vigencia" fields={[
        { label: 'Vigencia Desde', value: formatDate(doc.vigencia_desde) },
        { label: 'Vigencia Hasta', value: formatDate(doc.vigencia_hasta) },
        { label: 'Fecha de Emision', value: formatDate(doc.fecha_emision) },
        { label: 'Fecha de Captura', value: formatDate(doc.fecha_captura) },
      ]} />
      {doc.is_renewable && (
        <InfoCard icon={Clock} title="Renovacion" fields={[
          { label: 'Es Renovable', value: doc.is_renewable ? 'Si' : 'No' },
          { label: 'Dias Restantes', value: days !== null ? (days <= 0 ? 'Vencido' : `${days} dias`) : '-' },
        ]}>
          {days !== null && (
            <div className="mt-2">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    days <= 0 ? 'bg-red-500' :
                    days <= 7 ? 'bg-red-500' :
                    days <= 15 ? 'bg-orange-500' :
                    days <= 30 ? 'bg-amber-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${Math.max(5, Math.min(100, ((90 - Math.max(0, days)) / 90) * 100))}%` }}
                />
              </div>
            </div>
          )}
        </InfoCard>
      )}
    </div>
  );
}

function ImportesSection({ doc }: { doc: SicasDocRow }) {
  const hasDesglose = doc.derechos || doc.impuestos || doc.recargos;
  return (
    <div className="space-y-4">
      <InfoCard icon={DollarSign} title="Importes Principales" fields={[
        { label: 'Prima Neta', value: formatFullCurrency(doc.prima_neta) },
        { label: 'Prima Total', value: formatFullCurrency(doc.prima_total) },
        { label: 'Importe', value: formatFullCurrency(doc.importe) },
        { label: 'Moneda', value: doc.moneda || 'MXN' },
      ]} />
      {hasDesglose && (
        <InfoCard icon={CreditCard} title="Desglose" fields={[
          { label: 'Derechos', value: doc.derechos != null ? formatFullCurrency(doc.derechos) : null },
          { label: 'Impuestos', value: doc.impuestos != null ? formatFullCurrency(doc.impuestos) : null },
          { label: 'Recargos', value: doc.recargos != null ? formatFullCurrency(doc.recargos) : null },
        ]} />
      )}
      <InfoCard icon={Shield} title="Cobro" fields={[
        { label: 'Estatus de Cobro', value: doc.status_cobro },
      ]} />
    </div>
  );
}

function ClasificacionSection({ doc }: { doc: SicasDocRow }) {
  return (
    <div className="space-y-4">
      <InfoCard icon={Building2} title="Aseguradora" fields={[
        { label: 'Compania', value: doc.compania },
        { label: 'Nombre Aseguradora', value: doc.aseguradora_nombre },
      ]} />
      <InfoCard icon={FileText} title="Clasificacion" fields={[
        { label: 'Ramo', value: doc.ramo },
        { label: 'Subramo', value: doc.subramo },
        { label: 'Tipo Documento', value: doc.tipo_documento },
        { label: 'Subtipo Documento', value: doc.subtipo_documento },
      ]}>
        <div className="flex gap-1.5 mt-2">
          {doc.is_poliza && <Tag text="Poliza" color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" />}
          {doc.is_fianza && <Tag text="Fianza" color="bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" />}
        </div>
      </InfoCard>
      <InfoCard icon={Shield} title="Estatus" fields={[
        { label: 'Estado', value: doc.status_texto },
        { label: 'Codigo', value: doc.status_codigo },
        { label: 'Cobro', value: doc.status_cobro },
      ]}>
        <div className="flex gap-1.5 mt-2">
          {doc.is_vigente && <Tag text="Vigente" color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" />}
          {doc.is_cancelada && <Tag text="Cancelada" color="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" />}
        </div>
      </InfoCard>
    </div>
  );
}

function ComercialSection({ doc }: { doc: SicasDocRow }) {
  return (
    <div className="space-y-4">
      <InfoCard icon={MapPin} title="Oficina" fields={[
        { label: 'Nombre', value: doc.oficina_nombre },
        { label: 'Despacho', value: doc.desp_nombre },
        { label: 'ID Despacho', value: doc.desp_id },
      ]} />
      <InfoCard icon={User} title="Vendedor" fields={[
        { label: 'Nombre', value: doc.vend_nombre },
        { label: 'ID Vendedor', value: doc.vend_id },
      ]} />
      <InfoCard icon={Building2} title="Agente" fields={[
        { label: 'Nombre', value: doc.agente_nombre },
        { label: 'ID Agente SICAS', value: doc.sicas_id_agente },
      ]} />
    </div>
  );
}

function CentroDigitalSection({ archivos, loading, error, onRetry }: {
  archivos: CentroDigitalArchivo[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
        <p className="text-gray-500 text-sm">Consultando Centro Digital de SICAS...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
        <p className="text-gray-700 dark:text-gray-300 font-medium text-sm">No se pudieron obtener los archivos</p>
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 max-w-md mx-auto">{error}</p>
        <button
          onClick={onRetry}
          className="mt-3 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (archivos.length === 0) {
    return (
      <div className="text-center py-10">
        <FolderOpen className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-700 dark:text-gray-300 font-medium text-sm">No hay archivos disponibles</p>
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Este documento no tiene archivos en el Centro Digital de SICAS</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-blue-600" />
          Archivos ({archivos.length})
        </h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {archivos.map(archivo => (
          <div key={archivo.id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <FileIcon extension={archivo.extension} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{archivo.nombre || archivo.nombre_archivo}</p>
              <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                <span className="uppercase font-medium">{archivo.extension}</span>
                <span>{archivo.tamanio_legible}</span>
                {archivo.fecha_subida && <span>{formatDate(archivo.fecha_subida)}</span>}
              </div>
            </div>
            {archivo.es_descargable && (
              <button className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors shrink-0">
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FileIcon({ extension }: { extension: string }) {
  const ext = (extension || '').toLowerCase();
  if (['pdf'].includes(ext)) return <FileText className="w-4 h-4 text-red-500" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return <Image className="w-4 h-4 text-emerald-500" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
  if (['doc', 'docx'].includes(ext)) return <FileType className="w-4 h-4 text-blue-600" />;
  return <File className="w-4 h-4 text-gray-400" />;
}

function QuickStat({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color || 'text-blue-600 dark:text-blue-400'}`} />
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">{label}</span>
      </div>
      <p className={`text-sm font-bold ${color || 'text-gray-900 dark:text-white'}`}>{value}</p>
    </div>
  );
}

function InfoCard({ icon: Icon, title, fields, children }: {
  icon: React.ElementType; title: string;
  fields: { label: string; value: string | number | null | undefined }[];
  children?: React.ReactNode;
}) {
  const hasContent = fields.some(f => f.value != null && f.value !== '' && f.value !== '-') || children;
  return (
    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">
        <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" /> {title}
      </h3>
      {hasContent ? (
        <div className="space-y-2">
          {fields.map((f, idx) => f.value != null && f.value !== '' ? (
            <div key={idx} className="flex justify-between items-baseline gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{f.label}</span>
              <span className="text-sm text-gray-800 dark:text-gray-200 text-right truncate font-medium">{f.value}</span>
            </div>
          ) : null)}
          {children}
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500">Sin datos</p>
      )}
    </div>
  );
}

function HeaderStatusBadge({ status, isVigente, isCancelada }: { status: string | null; isVigente: boolean; isCancelada: boolean }) {
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}
