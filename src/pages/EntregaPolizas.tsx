import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Search,
  Clock,
  UploadCloud,
  ShieldAlert,
  Ban,
  Zap,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/ui/page-header';
import VendorSearchCombobox from '../components/lectorQualitas/VendorSearchCombobox';
import CompletarDatosSicasModal from '../components/tramites/CompletarDatosSicasModal';
import SicasPreRegistrationModal from '../components/tramites/SicasPreRegistrationModal';
import type { SicasVendorOption } from '../lib/lectorQualitasTypes';

interface ExtractedCoverData {
  tipoPoliza?: string;
  numeroPoliza?: string;
  nombreCliente?: string;
  direccion?: string;
  cp?: string;
  municipio?: string;
  colonia?: string;
  rfcAsegurado?: string;
  descripcionVehiculo?: string;
  placas?: string;
  serie?: string;
  motor?: string;
  formaPago?: string;
  moneda?: string;
  primaNeta?: string;
  primaTotal?: string;
  inicioVigencia?: string;
  finVigencia?: string;
}

interface AdditionalFile {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
}

interface DeliveryRecord {
  id: string;
  created_at: string;
  created_by_name: string;
  vendor_sicas_name: string;
  vendor_sicas_key: string | null;
  sicas_office_name: string | null;
  policy_number: string | null;
  manual_policy_number: string | null;
  insured_name: string | null;
  vehicle_description: string | null;
  total_premium: string | null;
  start_date: string | null;
  end_date: string | null;
  ticket_folio: string | null;
  ticket_id: string | null;
  status: string;
  email_sent: boolean;
  notification_sent: boolean;
  extraction_successful: boolean;
  additional_files_count: number;
  exported_at: string | null;
  exported_by_name: string | null;
  sicas_registration_status: string | null;
  sicas_document_id: string | null;
  sicas_registration_attempts: number;
  sicas_error_message: string | null;
  sicas_duplicate_detected: boolean;
  sicas_duplicate_document_id: string | null;
  sicas_registered_at: string | null;
  sicas_manual_review_reason: string | null;
  sicas_last_attempt_at: string | null;
  sicas_override_tipo_docto: string | null;
  sicas_override_cia: string | null;
  sicas_override_ramo: string | null;
  sicas_override_subramo: string | null;
  sicas_override_moneda: string | null;
  sicas_override_fpago: string | null;
  sicas_override_ejecutivo: string | null;
  sicas_override_grupo: string | null;
  sicas_override_cliente: string | null;
  sicas_override_estatus: string | null;
  ticket_action_type: string | null;
  ticket_was_existing: boolean;
  ticket_closed_as_won: boolean;
  ticket_close_status: string | null;
  ticket_closed_at: string | null;
  ticket_closed_by: string | null;
}

function looksLikeMoviFolio(value: string): boolean {
  return /^[A-Z]{2,4}-\d{4}-\d{3,6}$/i.test(value.trim());
}

export default function EntregaPolizas() {
  const { usuario } = useAuth();
  const [activeTab, setActiveTab] = useState<'nueva' | 'historial'>('nueva');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entrega de Polizas"
        subtitle="Procesa caratulas de poliza, asigna vendedores y genera tramites automaticamente"
      />

      <div className="flex gap-1 bg-neutral-100 dark:bg-white/5 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('nueva')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'nueva'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
          }`}
        >
          Nueva Entrega
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'historial'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
          }`}
        >
          Historial
        </button>
      </div>

      {activeTab === 'nueva' ? (
        <NuevaEntregaTab usuario={usuario} />
      ) : (
        <HistorialTab usuario={usuario} />
      )}
    </div>
  );
}

// ========================
// NUEVA ENTREGA TAB
// ========================

const CLOSED_STATUSES = ['Emitido (Ganado)', 'No Emitido (Perdido)', 'Cerrado', 'Cancelado', 'Emitido'];

interface ExistingTicket {
  id: string;
  folio: string;
  tipo_tramite: string;
  instrucciones: string | null;
  poliza: string | null;
  prioridad: string;
  created_at: string;
  updated_at: string;
  estatus_nombre: string | null;
  agente_nombre: string | null;
  insurance_type_nombre: string | null;
}

function NuevaEntregaTab({ usuario }: { usuario: any }) {
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverDragActive, setCoverDragActive] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedCoverData | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionSuccess, setExtractionSuccess] = useState(false);

  const [additionalFiles, setAdditionalFiles] = useState<AdditionalFile[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<SicasVendorOption | null>(null);

  const [vendors, setVendors] = useState<SicasVendorOption[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);

  const [ticketAction, setTicketAction] = useState<'new' | 'existing' | null>(null);
  const [existingTickets, setExistingTickets] = useState<ExistingTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedExistingTicket, setSelectedExistingTicket] = useState<ExistingTicket | null>(null);
  const [ticketSearchTerm, setTicketSearchTerm] = useState('');
  const [showClosedTickets, setShowClosedTickets] = useState(true);

  const [isDelivering, setIsDelivering] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState<{
    success: boolean;
    folio?: string;
    ticketId?: string;
    emailSent?: boolean;
    emailError?: string;
    wasExistingTicket?: boolean;
  } | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const additionalInputRef = useRef<HTMLInputElement>(null);

  const loadVendors = useCallback(async () => {
    setVendorsLoading(true);
    try {
      // Only load vendors that have a MOVI user mapping
      const { data: mappings } = await supabase
        .from('sicas_mapeo_vendedor_usuario')
        .select('id_sicas_vendedor, movi_user_id');

      if (!mappings || mappings.length === 0) {
        setVendors([]);
        setVendorsLoading(false);
        return;
      }

      const mappedSicasIds = mappings.map(m => m.id_sicas_vendedor);
      const mappingMap = new Map<string, string>();
      mappings.forEach((m) => mappingMap.set(m.id_sicas_vendedor, m.movi_user_id));

      // Get MOVI user details
      const moviUserIds = [...new Set(mappings.map(m => m.movi_user_id).filter(Boolean))];
      const userMap = new Map<string, { nombre: string; apellidos: string; email_laboral?: string }>();
      if (moviUserIds.length > 0) {
        const { data: users } = await supabase
          .from('usuarios')
          .select('id, nombre, apellidos, email_laboral')
          .in('id', moviUserIds);
        if (users) {
          users.forEach((u) => userMap.set(u.id, u));
        }
      }

      // Get SICAS vendor records for those with mappings
      const { data: vendorRecords } = await supabase
        .from('sicas_catalogos')
        .select('id, id_sicas, nombre, raw')
        .eq('catalog_type_id', 32)
        .in('id_sicas', mappedSicasIds);

      if (!vendorRecords || vendorRecords.length === 0) {
        setVendors([]);
        setVendorsLoading(false);
        return;
      }

      const { data: despachoRecords } = await supabase
        .from('sicas_despachos')
        .select('id_sicas, nombre');

      const despachoMap = new Map<string, string>();
      if (despachoRecords) {
        despachoRecords.forEach((d) => despachoMap.set(d.id_sicas, d.nombre));
      }

      // Build options showing MOVI user name as primary, with SICAS vendor as secondary info
      const options: SicasVendorOption[] = vendorRecords
        .filter((v) => mappingMap.has(v.id_sicas))
        .map((v) => {
          const raw = v.raw || {};
          const despachoId = raw.IDDespacho?.toString() || '';
          const gerenciaId = raw.IDGerencia?.toString() || '';
          const moviUserId = mappingMap.get(v.id_sicas) || '';
          const moviUser = moviUserId ? userMap.get(moviUserId) : undefined;
          const moviUserName = moviUser ? `${moviUser.nombre || ''} ${moviUser.apellidos || ''}`.trim() : '';

          return {
            id: v.id,
            idSicas: v.id_sicas,
            nombre: moviUserName || v.nombre || raw.VendNombre || '',
            clave: raw.Clave || raw.VendAbreviacion || '',
            tipoVend: raw.TipoVend || '',
            gerenciaId,
            gerenciaName: raw.NombreGerencia || '',
            despachoId,
            despachoName: despachoMap.get(despachoId) || '',
            moviUserId,
            moviUserName: v.nombre || raw.VendNombre || '',
          };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      setVendors(options);
    } catch (err) {
      console.error('Error loading vendors:', err);
    } finally {
      setVendorsLoading(false);
    }
  }, []);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  // Load existing tickets when vendor changes
  const loadVendorTickets = useCallback(async (vendorMoviUserId: string) => {
    setTicketsLoading(true);
    setExistingTickets([]);
    setSelectedExistingTicket(null);

    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id, folio, tipo_tramite, instrucciones, poliza, prioridad, fecha_creacion, ultima_modificacion,
          ticket_estatus:estatus_id(nombre),
          agente:agente_usuario_id(nombre, apellidos),
          insurance_type:insurance_type_id(nombre)
        `)
        .or(`agente_usuario_id.eq.${vendorMoviUserId},agente_id.eq.${vendorMoviUserId},assigned_to_user_id.eq.${vendorMoviUserId},creado_por.eq.${vendorMoviUserId}`)
        .order('ultima_modificacion', { ascending: false })
        .limit(200);

      if (error) throw error;

      const mapped: ExistingTicket[] = (data || []).map((t: any) => ({
        id: t.id,
        folio: t.folio,
        tipo_tramite: t.tipo_tramite || '',
        instrucciones: t.instrucciones,
        poliza: t.poliza,
        prioridad: t.prioridad,
        created_at: t.fecha_creacion,
        updated_at: t.ultima_modificacion,
        estatus_nombre: t.ticket_estatus?.nombre || null,
        agente_nombre: t.agente ? `${t.agente.nombre || ''} ${t.agente.apellidos || ''}`.trim() : null,
        insurance_type_nombre: t.insurance_type?.nombre || null,
      }));

      setExistingTickets(mapped);
    } catch (err) {
      console.error('Error loading vendor tickets:', err);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedVendor?.moviUserId) {
      loadVendorTickets(selectedVendor.moviUserId);
    } else {
      setExistingTickets([]);
      setSelectedExistingTicket(null);
    }
    setTicketAction(null);
    setSelectedExistingTicket(null);
  }, [selectedVendor, loadVendorTickets]);

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCoverDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      setCoverFile(file);
      processWithLector(file);
    }
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      processWithLector(file);
    }
  };

  const processWithLector = async (file: File) => {
    setIsExtracting(true);
    setExtractionError(null);
    setExtractedData(null);
    setExtractionSuccess(false);

    try {
      const formData = new FormData();
      formData.append('files', file);

      const response = await fetch(`${supabaseUrl}/functions/v1/lector-qualitas-proxy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error del servicio: ${response.status}`);
      }

      const result = await response.json();

      // The lector-qualitas-proxy returns { success: boolean, data: [...] } or direct array
      let extractedItems: any[] = [];
      if (result.success && Array.isArray(result.data)) {
        extractedItems = result.data;
      } else if (Array.isArray(result)) {
        extractedItems = result;
      }

      if (extractedItems.length > 0) {
        const data = extractedItems[0];
        setExtractedData(data);
        setExtractionSuccess(true);
      } else if (result.error) {
        setExtractionError(result.error);
      } else {
        setExtractionError('No se pudieron extraer datos del PDF');
      }
    } catch (err) {
      setExtractionError(err instanceof Error ? err.message : 'Error procesando archivo');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAdditionalFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = 10 - additionalFiles.length;
    const toAdd = Array.from(files).slice(0, remaining);

    const newFiles: AdditionalFile[] = toAdd.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      name: f.name,
      type: f.type,
      size: f.size,
    }));

    setAdditionalFiles((prev) => [...prev, ...newFiles]);
    if (additionalInputRef.current) additionalInputRef.current.value = '';
  };

  const removeAdditionalFile = (id: string) => {
    setAdditionalFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const ticketActionValid = ticketAction === 'new' || (ticketAction === 'existing' && !!selectedExistingTicket);
  const canDeliver = coverFile && selectedVendor && ticketActionValid && !isDelivering;

  const handleDeliver = async () => {
    if (!canDeliver || !usuario || !coverFile || !selectedVendor) return;

    setIsDelivering(true);
    setDeliveryResult(null);

    try {
      // 1. Upload cover file to storage
      const coverExt = coverFile.name.split('.').pop() || 'pdf';
      const coverPath = `entregas/${Date.now()}-caratula.${coverExt}`;

      const { error: coverUploadErr } = await supabase.storage
        .from('ticket-archivos')
        .upload(coverPath, coverFile);

      if (coverUploadErr) throw new Error(`Error subiendo caratula: ${coverUploadErr.message}`);

      const { data: { publicUrl: coverPublicUrl } } = supabase.storage
        .from('ticket-archivos')
        .getPublicUrl(coverPath);

      // 2. Upload additional files
      const uploadedAdditional: Array<{ path: string; name: string; type: string; size: number }> = [];

      for (const af of additionalFiles) {
        const afExt = af.name.split('.').pop() || 'pdf';
        const afPath = `entregas/${Date.now()}-${Math.random().toString(36).slice(2)}.${afExt}`;

        const { error: afUploadErr } = await supabase.storage
          .from('ticket-archivos')
          .upload(afPath, af.file);

        if (afUploadErr) {
          console.error(`Error subiendo ${af.name}:`, afUploadErr);
          continue;
        }

        const { data: { publicUrl: afPublicUrl } } = supabase.storage
          .from('ticket-archivos')
          .getPublicUrl(afPath);

        uploadedAdditional.push({
          path: afPublicUrl,
          name: af.name,
          type: af.type,
          size: af.size,
        });
      }

      // 3. Call edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sesion no valida');

      const payload = {
        createdBy: usuario.id,
        createdByName: `${usuario.nombre || ''} ${usuario.apellidos || ''}`.trim(),
        vendor: {
          sicasId: selectedVendor.idSicas,
          sicasKey: selectedVendor.clave || undefined,
          sicasName: selectedVendor.moviUserName || selectedVendor.nombre,
          email: undefined as string | undefined,
          type: selectedVendor.tipoVend || undefined,
          moviUserId: selectedVendor.moviUserId || undefined,
          moviUserName: selectedVendor.nombre,
          officeId: selectedVendor.despachoId || undefined,
          officeName: selectedVendor.despachoName || undefined,
          managementId: selectedVendor.gerenciaId || undefined,
          managementName: selectedVendor.gerenciaName || undefined,
        },
        extraction: {
          successful: extractionSuccess,
          data: extractedData || {},
        },
        coverFile: {
          path: coverPublicUrl,
          name: coverFile.name,
        },
        additionalFiles: uploadedAdditional,
        ticketAction: ticketAction,
        existingTicketId: ticketAction === 'existing' ? selectedExistingTicket?.id : undefined,
        existingTicketFolio: ticketAction === 'existing' ? selectedExistingTicket?.folio : undefined,
      };

      const res = await fetch(`${supabaseUrl}/functions/v1/process-policy-delivery`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 404) {
        throw new Error('Funcion process-policy-delivery no encontrada (404). Verifica que este desplegada en Supabase.');
      }

      if (!res.ok && res.headers.get('content-type')?.includes('text/html')) {
        throw new Error(`Error HTTP ${res.status}. La funcion puede no estar disponible temporalmente.`);
      }

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Error procesando entrega');
      }

      setDeliveryResult({
        success: true,
        folio: result.ticket?.folio,
        ticketId: result.ticket?.id,
        emailSent: result.emailSent,
        emailError: result.emailError || undefined,
        wasExistingTicket: ticketAction === 'existing',
      });
    } catch (err) {
      setDeliveryResult({
        success: false,
        emailError: err instanceof Error ? err.message : 'Error desconocido',
      });
    } finally {
      setIsDelivering(false);
    }
  };

  const resetForm = () => {
    setCoverFile(null);
    setExtractedData(null);
    setExtractionError(null);
    setExtractionSuccess(false);
    setAdditionalFiles([]);
    setSelectedVendor(null);
    setDeliveryResult(null);
    setTicketAction(null);
    setSelectedExistingTicket(null);
    setTicketSearchTerm('');
  };

  // Auto-select ticketAction when tickets load
  useEffect(() => {
    if (existingTickets.length > 0 && !ticketAction) {
      const openTickets = existingTickets.filter(t => !CLOSED_STATUSES.includes(t.estatus_nombre || ''));
      if (openTickets.length > 0) {
        setTicketAction('existing');
      }
    }
  }, [existingTickets, ticketAction]);

  if (deliveryResult?.success) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white dark:bg-neutral-800/80 rounded-2xl border border-neutral-200 dark:border-white/10 p-6 text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Entrega completada</h2>
          <p className="text-sm text-neutral-600 dark:text-white/60">
            {deliveryResult.wasExistingTicket ? (
              <>Poliza agregada al tramite <span className="font-semibold text-neutral-900 dark:text-white">{deliveryResult.folio}</span> - Emitido (Ganado).</>
            ) : (
              <>Tramite <span className="font-semibold text-neutral-900 dark:text-white">{deliveryResult.folio}</span> creado - Emitido (Ganado).</>
            )}
          </p>
          {deliveryResult.emailSent && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Correo de notificacion enviado.</p>
          )}
          {deliveryResult.emailError && !deliveryResult.emailSent && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{deliveryResult.emailError}</p>
          )}
          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/80 rounded-lg text-sm font-medium hover:bg-neutral-200 dark:hover:bg-white/15 transition-colors"
            >
              Nueva entrega
            </button>
            {deliveryResult.ticketId && (
              <a
                href={`/tramites/${deliveryResult.ticketId}`}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors"
              >
                Ver tramite
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Row 1: PDF + Vendor side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cover File */}
        <div className="bg-white dark:bg-neutral-800/80 rounded-xl border border-neutral-200 dark:border-white/10 p-4">
          <p className="text-xs font-semibold text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-2">Caratula PDF</p>

          {!coverFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setCoverDragActive(true); }}
              onDragLeave={() => setCoverDragActive(false)}
              onDrop={handleCoverDrop}
              onClick={() => coverInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
                coverDragActive
                  ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/10'
                  : 'border-neutral-200 dark:border-white/15 hover:border-sky-300 dark:hover:border-sky-500/40'
              }`}
            >
              <Upload className="w-8 h-8 text-neutral-300 dark:text-white/20 mx-auto mb-2" />
              <p className="text-xs text-neutral-500 dark:text-white/50">Arrastra o selecciona el PDF</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 bg-neutral-50 dark:bg-white/5 rounded-lg">
              <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-neutral-800 dark:text-white truncate">{coverFile.name}</p>
                <p className="text-[10px] text-neutral-400">{(coverFile.size / 1024).toFixed(0)} KB</p>
              </div>
              {isExtracting && <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin" />}
              {extractionSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              {extractionError && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
              <button
                onClick={() => { setCoverFile(null); setExtractedData(null); setExtractionError(null); setExtractionSuccess(false); }}
                className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/10 rounded"
              >
                <X className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            </div>
          )}

          <input ref={coverInputRef} type="file" accept=".pdf" onChange={handleCoverSelect} className="hidden" />

          {extractionError && (
            <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">
              {extractionError}. Continua manualmente.
            </p>
          )}

          {extractedData && extractionSuccess && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> Datos extraidos
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                {extractedData.numeroPoliza && <DataField label="Poliza" value={extractedData.numeroPoliza} />}
                {extractedData.nombreCliente && <DataField label="Asegurado" value={extractedData.nombreCliente} />}
                {extractedData.descripcionVehiculo && <DataField label="Vehiculo" value={extractedData.descripcionVehiculo} />}
                {extractedData.placas && <DataField label="Placas" value={extractedData.placas} />}
                {extractedData.inicioVigencia && <DataField label="Vigencia" value={`${extractedData.inicioVigencia} - ${extractedData.finVigencia || ''}`} />}
                {extractedData.primaTotal && <DataField label="Prima total" value={extractedData.primaTotal} />}
              </div>
            </div>
          )}
        </div>

        {/* Vendor Selection */}
        <div className="bg-white dark:bg-neutral-800/80 rounded-xl border border-neutral-200 dark:border-white/10 p-4">
          <p className="text-xs font-semibold text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-2">Asignar a usuario</p>

          {vendorsLoading ? (
            <div className="flex items-center gap-2 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
              <span className="text-xs text-neutral-500 dark:text-white/40">Cargando...</span>
            </div>
          ) : (
            <VendorSearchCombobox
              vendors={vendors}
              selectedVendor={selectedVendor}
              onSelect={setSelectedVendor}
              placeholder="Buscar usuario..."
            />
          )}

          {selectedVendor && (
            <div className="mt-2 p-2 bg-sky-50 dark:bg-sky-900/10 rounded-lg flex items-center gap-2">
              <div className="w-7 h-7 bg-sky-100 dark:bg-sky-800/40 rounded-full flex items-center justify-center text-[10px] font-bold text-sky-700 dark:text-sky-300">
                {selectedVendor.nombre.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-sky-800 dark:text-sky-300 truncate">{selectedVendor.nombre}</p>
                <p className="text-[10px] text-sky-600/70 dark:text-sky-400/60 truncate">
                  {[selectedVendor.clave, selectedVendor.despachoName].filter(Boolean).join(' - ')}
                </p>
              </div>
            </div>
          )}

          {/* Additional Files inline */}
          <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-neutral-500 dark:text-white/40">
                Documentos extra ({additionalFiles.length}/10)
              </p>
              {additionalFiles.length < 10 && (
                <button
                  onClick={() => additionalInputRef.current?.click()}
                  className="text-[10px] font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
                >
                  + Agregar
                </button>
              )}
            </div>
            <input ref={additionalInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={handleAdditionalFiles} className="hidden" />
            {additionalFiles.length > 0 && (
              <div className="space-y-1">
                {additionalFiles.map((af) => (
                  <div key={af.id} className="flex items-center gap-1.5 text-[10px]">
                    <FileText className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                    <span className="text-neutral-600 dark:text-white/60 truncate flex-1">{af.name}</span>
                    <button onClick={() => removeAdditionalFile(af.id)} className="text-neutral-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Ticket selection + Deliver (appears after vendor is selected) */}
      {selectedVendor && (
        <div className="bg-white dark:bg-neutral-800/80 rounded-xl border border-neutral-200 dark:border-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-neutral-500 dark:text-white/40 uppercase tracking-wider">Tramite destino</p>
            <div className="flex gap-1">
              <button
                onClick={() => { setTicketAction('existing'); setSelectedExistingTicket(null); }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  ticketAction === 'existing'
                    ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                    : 'text-neutral-500 dark:text-white/40 hover:bg-neutral-100 dark:hover:bg-white/5'
                }`}
              >
                Existente
              </button>
              <button
                onClick={() => { setTicketAction('new'); setSelectedExistingTicket(null); }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  ticketAction === 'new'
                    ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                    : 'text-neutral-500 dark:text-white/40 hover:bg-neutral-100 dark:hover:bg-white/5'
                }`}
              >
                + Nuevo
              </button>
            </div>
          </div>

          {ticketAction === 'new' && (
            <div className="p-3 bg-neutral-50 dark:bg-white/5 rounded-lg text-center">
              <p className="text-xs text-neutral-600 dark:text-white/60">Se creara un nuevo tramite de Emision con los datos extraidos.</p>
            </div>
          )}

          {ticketAction === 'existing' && (
            <div className="space-y-2">
              {existingTickets.length > 3 && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
                  <input
                    type="text"
                    value={ticketSearchTerm}
                    onChange={(e) => setTicketSearchTerm(e.target.value)}
                    placeholder="Filtrar tramites..."
                    className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg outline-none focus:border-sky-300 dark:focus:border-sky-500/40 text-neutral-800 dark:text-white placeholder:text-neutral-400"
                  />
                </div>
              )}

              {(usuario?.rol === 'Administrador' || usuario?.rol === 'Gerente') && (
                <label className="flex items-center gap-1.5 text-[10px] text-neutral-500 dark:text-white/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showClosedTickets}
                    onChange={(e) => setShowClosedTickets(e.target.checked)}
                    className="rounded border-neutral-300 text-sky-600 w-3 h-3"
                  />
                  Incluir cerrados
                </label>
              )}

              {ticketsLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />
                  <span className="text-[10px] text-neutral-500 dark:text-white/40">Cargando...</span>
                </div>
              ) : (
                <TicketList
                  tickets={existingTickets}
                  searchTerm={ticketSearchTerm}
                  showClosed={showClosedTickets}
                  selectedId={selectedExistingTicket?.id || null}
                  onSelect={setSelectedExistingTicket}
                />
              )}
            </div>
          )}

          {!ticketAction && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              Elige si agregar a un tramite existente o crear uno nuevo.
            </p>
          )}
        </div>
      )}

      {/* Row 3: Deliver button */}
      <div className="bg-white dark:bg-neutral-800/80 rounded-xl border border-neutral-200 dark:border-white/10 p-4">
        {deliveryResult && !deliveryResult.success && (
          <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 rounded-lg">
            <p className="text-xs text-red-700 dark:text-red-400">{deliveryResult.emailError}</p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center gap-3">
            <StatusDot ok={!!coverFile} />
            <StatusDot ok={!!selectedVendor} />
            <StatusDot ok={ticketActionValid} />
            <span className="text-[10px] text-neutral-400 dark:text-white/30">
              {!coverFile ? 'Falta caratula' :
               !selectedVendor ? 'Falta usuario' :
               !ticketActionValid ? 'Falta tramite' :
               ticketAction === 'existing' ? `Agregar a ${selectedExistingTicket?.folio}` : 'Nuevo tramite'}
            </span>
          </div>

          <button
            onClick={handleDeliver}
            disabled={!canDeliver}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              canDeliver
                ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-600/20'
                : 'bg-neutral-100 dark:bg-white/5 text-neutral-400 dark:text-white/30 cursor-not-allowed'
            }`}
          >
            {isDelivering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Entregar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========================
// HISTORIAL TAB
// ========================

const SICAS_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  not_started: { label: 'Sin iniciar', color: 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-white/40', icon: Clock },
  pending_fields: { label: 'Pendiente', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400', icon: Clock },
  ready_to_register: { label: 'Listo', color: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400', icon: UploadCloud },
  resolving: { label: 'Resolviendo...', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400', icon: Loader2 },
  creating_client: { label: 'Creando cliente...', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400', icon: Loader2 },
  validating: { label: 'Validando', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400', icon: Loader2 },
  duplicate_found: { label: 'Duplicado', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400', icon: Ban },
  duplicate: { label: 'Duplicado', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400', icon: Ban },
  registering: { label: 'Registrando...', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400', icon: Loader2 },
  registered: { label: 'Registrado', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
  uploading_files: { label: 'Subiendo docs', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400', icon: Loader2 },
  completed: { label: 'Completado', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300', icon: CheckCircle2 },
  error: { label: 'Error', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400', icon: AlertCircle },
  timeout: { label: 'Timeout', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400', icon: AlertCircle },
  sicas_rejected: { label: 'Rechazado', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400', icon: AlertCircle },
  manual_review_required: { label: 'Revision manual', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300', icon: ShieldAlert },
};

function HistorialTab({ usuario }: { usuario: any }) {
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<DeliveryRecord | null>(null);
  const [completarDatosRecord, setCompletarDatosRecord] = useState<DeliveryRecord | null>(null);
  const [registering, setRegistering] = useState<string | null>(null);
  const [registerResult, setRegisterResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [preRegistrationModal, setPreRegistrationModal] = useState<{ record: DeliveryRecord; data: any } | null>(null);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const canRegisterSicas = isAdmin || isGerente || usuario?.rol === 'Empleado' || usuario?.rol === 'Ejecutivo';

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('policy_deliveries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (statusFilter) query = query.eq('status', statusFilter);
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error('Error loading records:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const filtered = searchTerm
    ? records.filter((r) => {
        const q = searchTerm.toLowerCase();
        return (
          r.vendor_sicas_name?.toLowerCase().includes(q) ||
          r.policy_number?.toLowerCase().includes(q) ||
          r.insured_name?.toLowerCase().includes(q) ||
          r.ticket_folio?.toLowerCase().includes(q)
        );
      })
    : records;

  const handleRegisterSicas = async (record: DeliveryRecord) => {
    setConfirmModal(null);
    setRegistering(record.id);
    setRegisterResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sesion no valida');

      const res = await fetch(`${supabaseUrl}/functions/v1/sicas-register-policy-delivery`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ delivery_id: record.id, action: 'register' }),
      });

      if (res.status === 404) {
        console.error('[EntregaPolizas] 404 en sicas-register-policy-delivery. URL:', `${supabaseUrl}/functions/v1/sicas-register-policy-delivery`, 'delivery_id:', record.id);
        throw new Error('Funcion de registro SICAS no encontrada (404). Verifica que sicas-register-policy-delivery este desplegada.');
      }

      if (!res.ok && res.headers.get('content-type')?.includes('text/html')) {
        throw new Error(`Error HTTP ${res.status} del servidor. La funcion puede no estar disponible temporalmente.`);
      }

      const result = await res.json();

      if (result.success) {
        setRegisterResult({ id: record.id, success: true, message: result.message || 'Registro exitoso' });
        loadRecords();
      } else {
        const errorMsg = result.error || result.message || result.sicas_raw_error || 'Error desconocido al comunicarse con SICAS';
        setRegisterResult({ id: record.id, success: false, message: errorMsg });
        loadRecords();
      }
    } catch (err) {
      setRegisterResult({ id: record.id, success: false, message: err instanceof Error ? err.message : 'Error de conexion' });
    } finally {
      setRegistering(null);
    }
  };

  const handleResolveSicas = async (record: DeliveryRecord) => {
    setResolving(record.id);
    setRegisterResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sesion no valida');

      const res = await fetch(`${supabaseUrl}/functions/v1/sicas-register-policy-delivery`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ delivery_id: record.id, action: 'auto' }),
      });

      if (res.status === 404) {
        console.error('[EntregaPolizas] 404 en sicas-register-policy-delivery (auto). URL:', `${supabaseUrl}/functions/v1/sicas-register-policy-delivery`, 'delivery_id:', record.id);
        throw new Error('Funcion de registro SICAS no encontrada (404). Verifica que sicas-register-policy-delivery este desplegada.');
      }

      if (!res.ok && res.headers.get('content-type')?.includes('text/html')) {
        throw new Error(`Error HTTP ${res.status} del servidor. La funcion puede no estar disponible temporalmente.`);
      }

      const result = await res.json();

      if (result.success && result.status === 'registered') {
        setRegisterResult({ id: record.id, success: true, message: result.message || 'Registrado en SICAS correctamente.' });
        loadRecords();
      } else if (result.status === 'duplicate_found') {
        setRegisterResult({ id: record.id, success: false, message: result.message || 'La poliza ya existe en SICAS.' });
        loadRecords();
      } else if (result.status === 'manual_review_required') {
        setPreRegistrationModal({ record, data: result });
        setRegisterResult({ id: record.id, success: false, message: result.message || 'Requiere revision manual.' });
        loadRecords();
      } else {
        setRegisterResult({
          id: record.id,
          success: false,
          message: result.message || result.error || 'Error al registrar en SICAS',
        });
        loadRecords();
      }
    } catch (err) {
      setRegisterResult({ id: record.id, success: false, message: err instanceof Error ? err.message : 'Error de conexion' });
    } finally {
      setResolving(null);
    }
  };

  const handleConfirmRegistration = async () => {
    if (!preRegistrationModal) return;
    const record = preRegistrationModal.record;
    setPreRegistrationModal(null);
    await handleRegisterSicas(record);
  };

  const canAttemptRegistration = (r: DeliveryRecord): boolean => {
    const status = r.sicas_registration_status || '';
    const blockedStates = ['registered', 'completed', 'validating', 'uploading_files'];
    if (blockedStates.includes(status)) return false;
    // Allow retry on stale "registering" (older than 3 minutes)
    if (status === 'registering') {
      const lastAttempt = r.sicas_last_attempt_at ? new Date(r.sicas_last_attempt_at).getTime() : 0;
      if (lastAttempt && Date.now() - lastAttempt > 3 * 60 * 1000) return true;
      return false;
    }
    if (!r.policy_number) return false;
    return true;
  };

  const handleExport = async () => {
    if (filtered.length === 0) return;
    setIsExporting(true);

    try {
      const rows = filtered.map((r) => ({
        'Fecha': new Date(r.created_at).toLocaleDateString('es-MX'),
        'Hora': new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        'Creado por': r.created_by_name,
        'Vendedor': r.vendor_sicas_name,
        'Clave vendedor': r.vendor_sicas_key || '',
        'Oficina': r.sicas_office_name || '',
        'No. Poliza': r.policy_number || '',
        'Asegurado': r.insured_name || '',
        'Vehiculo': r.vehicle_description || '',
        'Prima total': r.total_premium || '',
        'Vigencia inicio': r.start_date || '',
        'Vigencia fin': r.end_date || '',
        'Folio tramite': r.ticket_folio || '',
        'Accion tramite': r.ticket_action_type === 'existing_ticket' ? 'Existente' : 'Nuevo',
        'Cerrado como ganado': r.ticket_closed_as_won ? 'Si' : 'No',
        'Cerrado en': r.ticket_closed_at ? new Date(r.ticket_closed_at).toLocaleString('es-MX') : '',
        'Estado': r.status,
        'Email enviado': r.email_sent ? 'Si' : 'No',
        'Notificado': r.notification_sent ? 'Si' : 'No',
        'Docs adicionales': r.additional_files_count,
        'SICAS Estado': SICAS_STATUS_CONFIG[r.sicas_registration_status || 'not_started']?.label || r.sicas_registration_status || '',
        'SICAS IDDocto': r.sicas_document_id || '',
        'SICAS Duplicado': r.sicas_duplicate_detected ? 'Si' : 'No',
        'SICAS Intentos': r.sicas_registration_attempts || 0,
        'SICAS Error': r.sicas_error_message || '',
        'SICAS Registrado': r.sicas_registered_at ? new Date(r.sicas_registered_at).toLocaleString('es-MX') : '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Entregas');

      const colWidths = Object.keys(rows[0]).map((key) => ({ wch: Math.max(key.length, 12) }));
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `entregas_polizas_${new Date().toISOString().slice(0, 10)}.xlsx`);

      const ids = filtered.filter((r) => !r.exported_at).map((r) => r.id);
      if (ids.length > 0 && usuario) {
        await supabase
          .from('policy_deliveries')
          .update({
            exported_at: new Date().toISOString(),
            exported_by_name: `${usuario.nombre || ''} ${usuario.apellidos || ''}`.trim(),
          })
          .in('id', ids);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-neutral-800/80 rounded-2xl border border-neutral-200 dark:border-white/10 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-1 block">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Vendedor, poliza, asegurado, folio..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg outline-none focus:border-sky-300 dark:focus:border-sky-500/40 text-neutral-800 dark:text-white placeholder:text-neutral-400"
              />
            </div>
          </div>

          <div className="w-[130px]">
            <label className="text-[10px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-1 block">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg outline-none focus:border-sky-300 text-neutral-800 dark:text-white"
            />
          </div>

          <div className="w-[130px]">
            <label className="text-[10px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-1 block">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg outline-none focus:border-sky-300 text-neutral-800 dark:text-white"
            />
          </div>

          <div className="w-[130px]">
            <label className="text-[10px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-1 block">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg outline-none focus:border-sky-300 text-neutral-800 dark:text-white"
            >
              <option value="">Todos</option>
              <option value="completado">Completado</option>
              <option value="error">Error</option>
            </select>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting || filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg transition-colors disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Exportar ({filtered.length})
          </button>
        </div>
      </div>

      {/* Registration Result Toast */}
      {registerResult && (
        <div className={`p-3 rounded-xl border flex items-start gap-2 ${
          registerResult.success
            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-500/20'
            : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/20'
        }`}>
          {registerResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium ${registerResult.success ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
              {registerResult.success ? 'Registro SICAS exitoso' : 'Error en registro SICAS'}
            </p>
            <p className={`text-[11px] mt-0.5 ${registerResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {registerResult.message}
            </p>
          </div>
          <button onClick={() => setRegisterResult(null)} className="p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded">
            <X className="w-3.5 h-3.5 text-neutral-400" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800/80 rounded-2xl border border-neutral-200 dark:border-white/10 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400 dark:text-white/30">
            <FileText className="w-10 h-10 mb-2" />
            <p className="text-sm">Sin entregas registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-white/5 bg-neutral-50 dark:bg-white/5">
                  <th className="text-left px-3 py-2.5 font-semibold text-neutral-600 dark:text-white/50">Fecha</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-neutral-600 dark:text-white/50">Vendedor</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-neutral-600 dark:text-white/50">No. Poliza</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-neutral-600 dark:text-white/50">Asegurado</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-neutral-600 dark:text-white/50">Prima</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-neutral-600 dark:text-white/50">Folio MOVI</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-neutral-600 dark:text-white/50">Accion</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-neutral-600 dark:text-white/50">Estado</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-neutral-600 dark:text-white/50">SICAS</th>
                  {canRegisterSicas && <th className="text-center px-3 py-2.5 font-semibold text-neutral-600 dark:text-white/50">Accion</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  let sicasStatus = r.sicas_registration_status || 'not_started';
                  // Detect stale "registering" status (stuck for more than 3 minutes)
                  if (sicasStatus === 'registering' && registering !== r.id) {
                    const lastAttempt = r.sicas_last_attempt_at ? new Date(r.sicas_last_attempt_at).getTime() : 0;
                    if (lastAttempt && Date.now() - lastAttempt > 3 * 60 * 1000) {
                      sicasStatus = 'timeout';
                    }
                  }
                  const statusConfig = SICAS_STATUS_CONFIG[sicasStatus] || SICAS_STATUS_CONFIG.not_started;
                  const StatusIcon = statusConfig.icon;
                  const isCurrentlyRegistering = registering === r.id;

                  return (
                    <tr key={r.id} className="border-b border-neutral-50 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <p className="text-neutral-800 dark:text-white">{new Date(r.created_at).toLocaleDateString('es-MX')}</p>
                        <p className="text-[10px] text-neutral-400">{new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-neutral-800 dark:text-white truncate max-w-[140px]">{r.vendor_sicas_name}</p>
                        {r.vendor_sicas_key && <p className="text-[10px] text-neutral-400">{r.vendor_sicas_key}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-neutral-700 dark:text-white/70">{r.manual_policy_number || r.policy_number || '-'}</span>
                        {r.manual_policy_number && r.policy_number && r.manual_policy_number !== r.policy_number && (
                          <p className="text-[9px] text-neutral-400 dark:text-white/30 line-through">{r.policy_number}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-neutral-700 dark:text-white/70 truncate max-w-[120px]">{r.insured_name || '-'}</td>
                      <td className="px-3 py-2.5 text-neutral-700 dark:text-white/70">{r.total_premium || '-'}</td>
                      <td className="px-3 py-2.5">
                        {r.ticket_id ? (
                          <a href={`/tramites/${r.ticket_id}`} className="text-sky-600 dark:text-sky-400 hover:underline font-medium">
                            {r.ticket_folio}
                          </a>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          r.ticket_action_type === 'existing_ticket'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                            : 'bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-white/50'
                        }`}>
                          {r.ticket_action_type === 'existing_ticket' ? 'Existente' : 'Nuevo'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          r.status === 'completado'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                          {r.status === 'completado' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.color}`}>
                            <StatusIcon className={`w-2.5 h-2.5 ${(sicasStatus === 'validating' || sicasStatus === 'registering' || sicasStatus === 'uploading_files') ? 'animate-spin' : ''}`} />
                            {statusConfig.label}
                          </span>
                          {r.sicas_document_id && (
                            <span className="text-[9px] text-neutral-400 dark:text-white/30">ID: {r.sicas_document_id}</span>
                          )}
                          {r.sicas_error_message && (
                            <span className="text-[9px] text-red-500 dark:text-red-400 max-w-[140px] truncate" title={r.sicas_error_message}>
                              {r.sicas_error_message}
                            </span>
                          )}
                        </div>
                      </td>
                      {canRegisterSicas && (
                        <td className="px-3 py-2.5 text-center">
                          {isCurrentlyRegistering || resolving === r.id ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400">
                              <Loader2 className="w-3 h-3 animate-spin" /> Registrando en SICAS...
                            </span>
                          ) : r.sicas_registration_status === 'manual_review_required' ? (
                            <div className="flex items-center gap-1 justify-center">
                              <button
                                onClick={() => handleResolveSicas(r)}
                                disabled={resolving === r.id}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-md transition-colors disabled:opacity-50"
                                title="Reintentar registro automatico en SICAS"
                              >
                                <Zap className="w-3 h-3" />
                                Reintentar
                              </button>
                            </div>
                          ) : canAttemptRegistration(r) ? (
                            <div className="flex items-center gap-1 justify-center">
                              <button
                                onClick={() => handleResolveSicas(r)}
                                disabled={resolving === r.id}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-md transition-colors disabled:opacity-50"
                                title="Registrar poliza en SICAS automaticamente"
                              >
                                <Zap className="w-3 h-3" />
                                Registrar SICAS
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-neutral-400 dark:text-white/30" title={!r.policy_number ? 'Sin numero de poliza' : 'No disponible'}>
                              {!r.policy_number ? 'Sin poliza' : '-'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <SicasConfirmModal
          record={confirmModal}
          onConfirm={() => handleRegisterSicas(confirmModal)}
          onCancel={() => setConfirmModal(null)}
          onUpdatePolicyNumber={async (newNumber) => {
            await supabase
              .from('policy_deliveries')
              .update({ manual_policy_number: newNumber })
              .eq('id', confirmModal.id);
            setConfirmModal({ ...confirmModal, manual_policy_number: newNumber });
            loadRecords();
          }}
        />
      )}

      {completarDatosRecord && (
        <CompletarDatosSicasModal
          record={completarDatosRecord}
          onClose={() => setCompletarDatosRecord(null)}
          onSaved={() => loadRecords()}
        />
      )}

      {preRegistrationModal && (
        <SicasPreRegistrationModal
          record={preRegistrationModal.record}
          resolutionData={preRegistrationModal.data}
          onConfirm={handleConfirmRegistration}
          onClose={() => setPreRegistrationModal(null)}
          onReResolve={() => {
            const rec = preRegistrationModal.record;
            setPreRegistrationModal(null);
            handleResolveSicas(rec);
          }}
          isRegistering={!!registering}
        />
      )}
    </div>
  );
}

// ========================
// SICAS CONFIRM MODAL
// ========================

function SicasConfirmModal({ record, onConfirm, onCancel, onUpdatePolicyNumber }: {
  record: DeliveryRecord;
  onConfirm: () => void;
  onCancel: () => void;
  onUpdatePolicyNumber?: (newNumber: string) => void;
}) {
  const [editingPolicyNumber, setEditingPolicyNumber] = useState(false);
  const effectivePolicyNumber = record.manual_policy_number || record.policy_number || '';
  const [policyNumberInput, setPolicyNumberInput] = useState(effectivePolicyNumber);
  const [folioWarning, setFolioWarning] = useState('');

  const handlePolicyNumberChange = (val: string) => {
    setPolicyNumberInput(val);
    if (looksLikeMoviFolio(val)) {
      setFolioWarning('Esto parece un folio interno de MOVI, no un numero de poliza real.');
    } else {
      setFolioWarning('');
    }
  };

  const handleSavePolicyNumber = () => {
    const trimmed = policyNumberInput.trim();
    if (trimmed && !looksLikeMoviFolio(trimmed) && onUpdatePolicyNumber) {
      onUpdatePolicyNumber(trimmed);
    }
    setEditingPolicyNumber(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-xl">
            <UploadCloud className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Registrar en SICAS</h3>
            <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5">
              Se enviara la informacion de esta entrega a SICAS para crear el documento (HWCAPTURE).
            </p>
          </div>
        </div>

        <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3 space-y-1.5">
          {editingPolicyNumber ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-neutral-500 dark:text-white/40 w-20">No. Poliza:</span>
                <input
                  type="text"
                  value={policyNumberInput}
                  onChange={(e) => handlePolicyNumberChange(e.target.value)}
                  placeholder="Ej: 8650098597"
                  className={`flex-1 px-2 py-1 text-xs bg-white dark:bg-neutral-700 border rounded-md ${
                    folioWarning ? 'border-amber-400 dark:border-amber-500' : 'border-neutral-200 dark:border-white/10'
                  }`}
                  autoFocus
                />
                <button
                  onClick={handleSavePolicyNumber}
                  disabled={!policyNumberInput.trim() || !!folioWarning}
                  className="px-2 py-1 text-[10px] font-medium text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
              {folioWarning && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 pl-[84px] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {folioWarning}
                </p>
              )}
              <p className="text-[9px] text-neutral-400 dark:text-white/30 pl-[84px]">
                Ingresa el numero de poliza de la aseguradora (NO el folio MOVI como RA-2026-xxxx).
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <SummaryRow label="No. Poliza" value={effectivePolicyNumber || 'Sin numero'} />
              {onUpdatePolicyNumber && (
                <button
                  onClick={() => setEditingPolicyNumber(true)}
                  className="ml-auto text-[10px] text-sky-600 dark:text-sky-400 hover:underline"
                >
                  Editar
                </button>
              )}
            </div>
          )}
          {record.ticket_folio && (
            <SummaryRow label="Folio MOVI" value={record.ticket_folio} />
          )}
          <SummaryRow label="Asegurado" value={record.insured_name || 'Sin nombre'} />
          <SummaryRow label="Vendedor" value={record.vendor_sicas_name} />
          <SummaryRow label="Oficina" value={record.sicas_office_name || 'Sin asignar'} />
          <SummaryRow label="Prima total" value={record.total_premium || '-'} />
          <SummaryRow label="Vigencia" value={record.start_date && record.end_date ? `${record.start_date} - ${record.end_date}` : 'Sin vigencia'} />
          {record.sicas_registration_attempts > 0 && (
            <SummaryRow label="Intentos previos" value={`${record.sicas_registration_attempts}`} highlight />
          )}
        </div>

        {record.sicas_error_message && (
          <div className="p-2.5 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-500/20 rounded-lg">
            <p className="text-[10px] text-red-700 dark:text-red-400">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              Error previo: {record.sicas_error_message}
            </p>
          </div>
        )}

        {record.sicas_duplicate_detected && (
          <div className="p-2.5 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-500/20 rounded-lg">
            <p className="text-[10px] text-orange-700 dark:text-orange-400">
              <Ban className="w-3 h-3 inline mr-1" />
              Se detecto un posible duplicado anteriormente (IDDocto: {record.sicas_duplicate_document_id}).
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2.5 text-xs font-medium text-neutral-700 dark:text-white/70 bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/15 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors shadow-lg shadow-sky-600/20"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Confirmar registro
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-neutral-500 dark:text-white/40">{label}</span>
      <span className={`text-[11px] font-medium ${highlight ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-800 dark:text-white/80'} max-w-[200px] truncate text-right`}>
        {value}
      </span>
    </div>
  );
}

// ========================
// HELPER COMPONENTS
// ========================

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-neutral-400 dark:text-white/30">{label}: </span>
      <span className="text-neutral-700 dark:text-white/80 font-medium">{value}</span>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <div className="w-2 h-2 rounded-full bg-emerald-500" />
  ) : (
    <div className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-white/20" />
  );
}

function TicketList({ tickets, searchTerm, showClosed, selectedId, onSelect }: {
  tickets: ExistingTicket[];
  searchTerm: string;
  showClosed: boolean;
  selectedId: string | null;
  onSelect: (ticket: ExistingTicket) => void;
}) {
  const filtered = tickets.filter((t) => {
    if (!showClosed && CLOSED_STATUSES.includes(t.estatus_nombre || '')) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.folio?.toLowerCase().includes(q) ||
      t.poliza?.toLowerCase().includes(q) ||
      t.instrucciones?.toLowerCase().includes(q) ||
      t.agente_nombre?.toLowerCase().includes(q) ||
      t.insurance_type_nombre?.toLowerCase().includes(q)
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-[10px] text-neutral-400 dark:text-white/30">
          {tickets.length === 0 ? 'Este vendedor no tiene tramites registrados.' : 'No se encontraron tramites con ese criterio.'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
      {filtered.map((t) => {
        const isSelected = selectedId === t.id;
        const isClosed = CLOSED_STATUSES.includes(t.estatus_nombre || '');

        return (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className={`w-full text-left p-2.5 rounded-lg border transition-all ${
              isSelected
                ? 'border-sky-400 dark:border-sky-500 bg-sky-50/70 dark:bg-sky-900/15 ring-1 ring-sky-200 dark:ring-sky-500/30'
                : 'border-neutral-150 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20 hover:bg-neutral-50 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-neutral-800 dark:text-white">{t.folio}</span>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${
                    isClosed
                      ? 'bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-white/40'
                      : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  }`}>
                    {t.estatus_nombre || 'Sin estado'}
                  </span>
                </div>
                {t.poliza && (
                  <p className="text-[10px] text-neutral-600 dark:text-white/60 mt-0.5 truncate">Poliza: {t.poliza}</p>
                )}
                {t.insurance_type_nombre && (
                  <p className="text-[10px] text-neutral-500 dark:text-white/40 truncate">{t.insurance_type_nombre}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[9px] text-neutral-400 dark:text-white/30">
                  {new Date(t.updated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
