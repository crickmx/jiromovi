import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, FileText, Download, Loader2, CheckCircle2, AlertCircle, X, Send, Search, Clock, UploadCloud, ShieldAlert, Ban, Zap, CreditCard as Edit3, Eye, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/ui/page-header';
import VendorSearchCombobox from '../components/lectorQualitas/VendorSearchCombobox';
import CompletarDatosSicasModal from '../components/tramites/CompletarDatosSicasModal';
import SicasPreRegistrationModal from '../components/tramites/SicasPreRegistrationModal';
import type { SicasVendorOption } from '../lib/lectorQualitasTypes';
import { preflight, releaseClientLock, checkCircuitBreaker, getSicasUserMessage } from '../lib/sicasRateControl';

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

function getDeliveryFieldValue(r: any, ...fieldNames: string[]): string | null {
  const isValid = (v: unknown): v is string | number =>
    v != null && String(v).trim() !== '' && v !== 'null' && v !== 'undefined' && v !== 'N/A';

  // 1. Direct fields on the delivery record
  for (const name of fieldNames) {
    if (isValid(r[name])) return String(r[name]).trim();
  }
  // 2. sicas_resolved_fields (historical resolution data)
  const resolved = r.sicas_resolved_fields as Record<string, any> | null;
  if (resolved) {
    for (const name of fieldNames) {
      const entry = resolved[name];
      if (entry) {
        const v = typeof entry === 'object' ? entry.value : entry;
        if (isValid(v) && !String(v).startsWith('__')) return String(v).trim();
      }
    }
  }
  // 3. extracted_data
  const ext = r.extracted_data as Record<string, any> | null;
  if (ext) {
    for (const name of fieldNames) {
      if (isValid(ext[name])) return String(ext[name]).trim();
    }
  }
  // 4. sicas_client_create_response_raw (client creation result)
  const clientResp = r.sicas_client_create_response_raw as Record<string, any> | null;
  if (clientResp) {
    for (const name of fieldNames) {
      if (isValid(clientResp[name])) return String(clientResp[name]).trim();
    }
  }
  return null;
}

function getMissingFieldsForRegistration(r: DeliveryRecord): string[] {
  const missing: string[] = [];
  const rec = r as any;
  if (!getDeliveryFieldValue(rec, 'policy_number', 'manual_policy_number', 'poliza', 'numero_poliza', 'document_number', 'Documento')) missing.push('Poliza');
  if (!getDeliveryFieldValue(rec, 'insured_name', 'asegurado', 'contratante', 'client_name', 'nombre_asegurado')) missing.push('Asegurado');
  if (!getDeliveryFieldValue(rec, 'total_premium', 'premium', 'prima', 'prima_neta', 'PrimaNeta')) missing.push('Prima');
  if (!getDeliveryFieldValue(rec, 'start_date', 'fecha_inicio', 'vigencia_inicio', 'FDesde')) missing.push('Fecha inicio');
  if (!getDeliveryFieldValue(rec, 'end_date', 'fecha_fin', 'vigencia_fin', 'FHasta')) missing.push('Fecha fin');
  return missing;
}

function getDeliveryValidationDetails(r: DeliveryRecord): { field: string; value: string | null; source: string }[] {
  const rec = r as any;
  const details: { field: string; value: string | null; source: string }[] = [];
  const resolved = rec.sicas_resolved_fields as Record<string, any> | null;
  const ext = rec.extracted_data as Record<string, any> | null;
  const clientResp = rec.sicas_client_create_response_raw as Record<string, any> | null;

  const isValid = (v: unknown): boolean =>
    v != null && String(v).trim() !== '' && v !== 'null' && v !== 'undefined' && v !== 'N/A';

  const findSource = (fieldNames: string[]): { value: string | null; source: string } => {
    for (const name of fieldNames) {
      if (isValid(rec[name])) return { value: String(rec[name]).trim(), source: `delivery.${name}` };
    }
    if (resolved) {
      for (const name of fieldNames) {
        const entry = resolved[name];
        if (entry) {
          const v = typeof entry === 'object' ? entry.value : entry;
          if (isValid(v) && !String(v).startsWith('__')) return { value: String(v).trim(), source: `resolved_fields.${name}` };
        }
      }
    }
    if (ext) {
      for (const name of fieldNames) {
        if (isValid(ext[name])) return { value: String(ext[name]).trim(), source: `extracted_data.${name}` };
      }
    }
    if (clientResp) {
      for (const name of fieldNames) {
        if (isValid(clientResp[name])) return { value: String(clientResp[name]).trim(), source: `sicas_client_response.${name}` };
      }
    }
    return { value: null, source: 'no encontrado' };
  };

  details.push({ field: 'Poliza', ...findSource(['policy_number', 'manual_policy_number', 'poliza', 'numero_poliza', 'document_number', 'Documento']) });
  details.push({ field: 'Asegurado', ...findSource(['insured_name', 'asegurado', 'contratante', 'client_name', 'nombre_asegurado']) });
  details.push({ field: 'Prima', ...findSource(['total_premium', 'premium', 'prima', 'prima_neta', 'PrimaNeta', 'net_premium']) });
  details.push({ field: 'Fecha inicio', ...findSource(['start_date', 'fecha_inicio', 'vigencia_inicio', 'FDesde']) });
  details.push({ field: 'Fecha fin', ...findSource(['end_date', 'fecha_fin', 'vigencia_fin', 'FHasta']) });
  details.push({ field: 'IDCli', ...findSource(['sicas_client_id', 'IDCli', 'client_id']) });
  details.push({ field: 'IDVend', ...findSource(['vendor_sicas_id', 'IDVend', 'vendor_id']) });

  return details;
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

      console.log('[EntregaPolizas] Calling process-policy-delivery', { ticketAction, hasFiles: !!coverFile });

      const { data: result, error: invokeError } = await supabase.functions.invoke('process-policy-delivery', {
        body: payload,
      });

      if (invokeError) {
        console.error('[EntregaPolizas] process-policy-delivery error:', invokeError);
        const msg = invokeError.message || 'Error de conexion';
        if (msg.includes('404') || msg.includes('Not Found')) {
          throw new Error('Funcion process-policy-delivery no encontrada. Verifica que este desplegada en Supabase.');
        }
        throw new Error(msg);
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Error procesando entrega');
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
  datos_incompletos: { label: 'Datos incompletos', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300', icon: ShieldAlert },
  error_cifrado: { label: 'Error cifrado', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400', icon: AlertCircle },
  pending_fields: { label: 'Pendiente', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400', icon: Clock },
  ready_to_register: { label: 'Listo', color: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400', icon: UploadCloud },
  resolving: { label: 'Resolviendo...', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400', icon: Loader2 },
  creating_client: { label: 'Creando cliente...', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400', icon: Loader2 },
  client_creation_failed: { label: 'Error cliente', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400', icon: AlertCircle },
  validating: { label: 'Validando', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400', icon: Loader2 },
  duplicate_found: { label: 'Duplicado', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400', icon: Ban },
  duplicate: { label: 'Duplicado', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400', icon: Ban },
  registering: { label: 'Registrando...', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400', icon: Loader2 },
  registered: { label: 'Registrado', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
  partial_success: { label: 'Pendiente registro', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400', icon: AlertCircle },
  unverified: { label: 'Pendiente verificacion', color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400', icon: AlertCircle },
  document_not_created: { label: 'Pendiente registro', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400', icon: AlertCircle },
  uploading_files: { label: 'Subiendo docs', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400', icon: Loader2 },
  completed: { label: 'Completado', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300', icon: CheckCircle2 },
  error: { label: 'Error', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400', icon: AlertCircle },
  timeout: { label: 'Timeout', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400', icon: AlertCircle },
  sicas_rejected: { label: 'Rechazado', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400', icon: AlertCircle },
  validation_failed: { label: 'Datos faltantes', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300', icon: ShieldAlert },
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

    const blocked = await preflight(`sicas-register-${record.id}`);
    if (blocked) {
      setRegisterResult({ id: record.id, success: false, message: blocked });
      return;
    }

    setRegistering(record.id);
    setRegisterResult(null);

    try {
      console.log('[EntregaPolizas][SICAS] Calling sicas-register-policy-delivery', { delivery_id: record.id, action: 'register' });

      const { data: result, error: invokeError } = await supabase.functions.invoke('sicas-register-policy-delivery', {
        body: { delivery_id: record.id, policy_delivery_id: record.id, action: 'register' },
      });

      if (invokeError) {
        console.error('[EntregaPolizas][SICAS] invoke error:', invokeError);
        const msg = invokeError.message || 'Error de conexion con la funcion SICAS';
        if (msg.includes('404') || msg.includes('Not Found') || msg.includes('not found')) {
          throw new Error('Funcion sicas-register-policy-delivery no encontrada. Revisa que este desplegada en Supabase.');
        }
        throw new Error(msg);
      }

      if (result?.success) {
        setRegisterResult({ id: record.id, success: true, message: result.message || 'Registro exitoso' });
        loadRecords();
      } else {
        const errorMsg = result?.error || result?.message || result?.sicas_raw_error || 'Error desconocido al comunicarse con SICAS';
        setRegisterResult({ id: record.id, success: false, message: errorMsg });
        loadRecords();
      }
    } catch (err) {
      setRegisterResult({ id: record.id, success: false, message: err instanceof Error ? err.message : 'Error de conexion' });
    } finally {
      setRegistering(null);
      releaseClientLock(`sicas-register-${record.id}`);
    }
  };

  const handleResolveSicas = async (record: DeliveryRecord) => {
    const blocked = await preflight(`sicas-resolve-${record.id}`);
    if (blocked) {
      setRegisterResult({ id: record.id, success: false, message: blocked });
      return;
    }

    setResolving(record.id);
    setRegisterResult(null);

    try {
      console.log('[EntregaPolizas][SICAS] Calling sicas-register-policy-delivery (auto)', { delivery_id: record.id, action: 'auto' });

      const { data: result, error: invokeError } = await supabase.functions.invoke('sicas-register-policy-delivery', {
        body: { delivery_id: record.id, policy_delivery_id: record.id, action: 'auto' },
      });

      if (invokeError) {
        console.error('[EntregaPolizas][SICAS] invoke error (auto):', invokeError);
        const msg = invokeError.message || 'Error de conexion con la funcion SICAS';
        if (msg.includes('404') || msg.includes('Not Found') || msg.includes('not found')) {
          throw new Error('Funcion sicas-register-policy-delivery no encontrada. Revisa que este desplegada en Supabase.');
        }
        throw new Error(msg);
      }

      if (result?.success && result?.status === 'registered') {
        setRegisterResult({ id: record.id, success: true, message: result.message || 'Registrado en SICAS correctamente.' });
        loadRecords();
      } else if (result?.status === 'partial_success' || result?.overall_status === 'partial_success') {
        setRegisterResult({ id: record.id, success: false, message: result.message || 'Contacto creado, pero la poliza no fue registrada.' });
        loadRecords();
      } else if (result?.status === 'duplicate_found') {
        setRegisterResult({ id: record.id, success: false, message: result.message || 'La poliza ya existe en SICAS.' });
        loadRecords();
      } else if (result?.status === 'unverified') {
        setRegisterResult({ id: record.id, success: false, message: result.message || 'SICAS confirmo guardado pero no devolvio IDDocto. Intente busqueda manual.' });
        loadRecords();
      } else if (result?.status === 'manual_review_required') {
        setPreRegistrationModal({ record, data: result });
        setRegisterResult({ id: record.id, success: false, message: result.message || 'Requiere revision manual.' });
        loadRecords();
      } else {
        setRegisterResult({
          id: record.id,
          success: false,
          message: result?.message || result?.error || 'Error al registrar en SICAS',
        });
        loadRecords();
      }
    } catch (err) {
      setRegisterResult({ id: record.id, success: false, message: err instanceof Error ? err.message : 'Error de conexion' });
    } finally {
      setResolving(null);
      releaseClientLock(`sicas-resolve-${record.id}`);
    }
  };

  const handleRegisterDocument = async (record: DeliveryRecord) => {
    const missingFields = getMissingFieldsForRegistration(record);
    if (missingFields.length > 0) {
      setRegisterResult({
        id: record.id,
        success: false,
        message: `No se puede registrar en SICAS porque faltan datos obligatorios: ${missingFields.join(', ')}.`
      });
      return;
    }

    const blocked = await preflight(`sicas-doc-${record.id}`);
    if (blocked) {
      setRegisterResult({ id: record.id, success: false, message: blocked });
      return;
    }

    setResolving(record.id);
    setRegisterResult(null);

    try {
      console.log('[SICAS] ===== REGISTRAR EN SICAS (HWCAPTURE) =====');
      console.log('[SICAS] Calling: sicas-register-document-delivery');
      console.log('[SICAS] Action: HWCAPTURE - Crear documento nuevo en SICAS');
      console.log('[SICAS] delivery_id:', record.id);
      console.log('[SICAS] policy_number:', record.policy_number || record.manual_policy_number);
      console.log('[SICAS] sicas_client_id:', (record as any).sicas_client_id);
      console.log('[SICAS] sicas_document_id (actual):', record.sicas_document_id || 'NULL - no existe aun');

      const { data: result, error: invokeError } = await supabase.functions.invoke('sicas-register-document-delivery', {
        body: { delivery_id: record.id },
      });

      console.log('[SICAS] Response:', result);
      console.log('[SICAS] InvokeError:', invokeError);

      if (invokeError) {
        const ctx = (invokeError as any).context;
        let parsedBody: any = null;
        try {
          if (typeof ctx === 'string') parsedBody = JSON.parse(ctx);
          else if (ctx?.body) parsedBody = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
        } catch {}

        if (parsedBody?.action_required === 'resolve_data' || parsedBody?.status === 'validation_failed') {
          const fields = (parsedBody.missing_fields || []).join(', ');
          setRegisterResult({ id: record.id, success: false, message: parsedBody.message || `Faltan datos: ${fields}. Use "Resolver datos".` });
          loadRecords();
          return;
        }

        const errorDetail = [
          `Funcion: sicas-register-document-delivery`,
          `delivery_id: ${record.id}`,
          invokeError.message || 'Sin mensaje de error',
          parsedBody?.message || null,
        ].filter(Boolean).join(' | ');
        throw new Error(`No se pudo invocar la funcion: ${errorDetail}`);
      }

      if (result?.success && result?.status === 'registered') {
        setRegisterResult({ id: record.id, success: true, message: result.message || 'Documento registrado en SICAS correctamente.' });
      } else if (result?.status === 'unverified') {
        setRegisterResult({ id: record.id, success: false, message: result.message || 'SICAS confirmo guardado pero no devolvio IDDocto. Usa busqueda para verificar.' });
      } else if (result?.status === 'validation_failed') {
        setRegisterResult({ id: record.id, success: false, message: result.error || `Validacion fallida: ${(result.validation_errors || []).join(', ')}` });
      } else if (result?.status === 'no_client_id') {
        setRegisterResult({ id: record.id, success: false, message: result.error || 'No existe IDCli. Primero resuelva el contacto en SICAS.' });
      } else {
        setRegisterResult({ id: record.id, success: false, message: result?.message || result?.error || 'No se pudo registrar el documento. Intente de nuevo.' });
      }
      loadRecords();
    } catch (err) {
      console.error('[SICAS] handleRegisterDocument error:', err);
      const msg = err instanceof Error ? err.message : 'Error de conexion con sicas-register-document-delivery';
      setRegisterResult({ id: record.id, success: false, message: msg });
    } finally {
      setResolving(null);
      releaseClientLock(`sicas-doc-${record.id}`);
    }
  };

  const handleRetryLookup = async (record: DeliveryRecord) => {
    if (!record.sicas_document_id && !record.sicas_registered_at) {
      setRegisterResult({ id: record.id, success: false, message: 'No existe IDDocto de SICAS. El documento no ha sido registrado aun. Usa "Registrar en SICAS" primero.' });
      return;
    }

    const blocked = await preflight(`sicas-lookup-${record.id}`);
    if (blocked) {
      setRegisterResult({ id: record.id, success: false, message: blocked });
      return;
    }

    setResolving(record.id);
    setRegisterResult(null);

    try {
      console.log('[SICAS] ===== BUSQUEDA / VERIFICACION =====');
      console.log('[SICAS] Calling: sicas-register-policy-delivery (retry_lookup)');
      console.log('[SICAS] Action: BUSCAR documento existente en SICAS');
      console.log('[SICAS] delivery_id:', record.id);
      console.log('[SICAS] sicas_document_id:', record.sicas_document_id);
      console.log('[SICAS] policy_number:', record.policy_number || record.manual_policy_number);

      const { data: result, error: invokeError } = await supabase.functions.invoke('sicas-register-policy-delivery', {
        body: { delivery_id: record.id, action: 'retry_lookup' },
      });

      if (invokeError) throw new Error(invokeError.message || 'Error de conexion');

      if (result?.success && result?.status === 'registered') {
        setRegisterResult({ id: record.id, success: true, message: result.message || 'Documento encontrado y verificado en SICAS.' });
      } else {
        setRegisterResult({ id: record.id, success: false, message: result?.message || 'Documento no encontrado en SICAS.' });
      }
      loadRecords();
    } catch (err) {
      setRegisterResult({ id: record.id, success: false, message: err instanceof Error ? err.message : 'Error de conexion' });
    } finally {
      setResolving(null);
      releaseClientLock(`sicas-lookup-${record.id}`);
    }
  };

  const [manualCaptureModal, setManualCaptureModal] = useState<DeliveryRecord | null>(null);
  const [manualDocId, setManualDocId] = useState('');
  const [diagnosticModal, setDiagnosticModal] = useState<DeliveryRecord | null>(null);

  const handleManualCapture = async () => {
    if (!manualCaptureModal || !manualDocId.trim()) return;
    const record = manualCaptureModal;

    const blocked = await preflight(`sicas-manual-${record.id}`);
    if (blocked) {
      setRegisterResult({ id: record.id, success: false, message: blocked });
      return;
    }

    setManualCaptureModal(null);
    setResolving(record.id);
    setRegisterResult(null);

    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('sicas-register-policy-delivery', {
        body: { delivery_id: record.id, action: 'manual_capture', sicas_document_id: manualDocId.trim() },
      });

      if (invokeError) throw new Error(invokeError.message || 'Error de conexion');

      if (result?.success) {
        setRegisterResult({ id: record.id, success: true, message: result.message || `Documento ${manualDocId} verificado y guardado.` });
      } else {
        setRegisterResult({ id: record.id, success: false, message: result?.message || 'No se pudo verificar el documento.' });
      }
      setManualDocId('');
      loadRecords();
    } catch (err) {
      setRegisterResult({ id: record.id, success: false, message: err instanceof Error ? err.message : 'Error de conexion' });
    } finally {
      setResolving(null);
      releaseClientLock(`sicas-manual-${record.id}`);
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
    if (status === 'registering') {
      const lastAttempt = r.sicas_last_attempt_at ? new Date(r.sicas_last_attempt_at).getTime() : 0;
      if (lastAttempt && Date.now() - lastAttempt > 3 * 60 * 1000) return true;
      return false;
    }
    if (!r.policy_number && !r.manual_policy_number) return false;
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
                            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono">ID: {r.sicas_document_id}</span>
                          )}
                          {!r.sicas_document_id && ['partial_success', 'document_not_created', 'error', 'sicas_rejected', 'client_creation_failed', 'validation_failed', 'manual_review_required'].includes(r.sicas_registration_status || '') && (
                            <span className="text-[9px] text-amber-600 dark:text-amber-400">
                              Pendiente: ejecutar HWCAPTURE
                            </span>
                          )}
                          {r.sicas_error_message && r.sicas_registration_status !== 'partial_success' && r.sicas_registration_status !== 'document_not_created' && (
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
                          ) : r.sicas_registration_status === 'unverified' && r.sicas_registered_at ? (
                            /* FLOW B: Document was sent to SICAS (HWCAPTURE executed) but IDDocto not confirmed yet */
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => handleRetryLookup(r)}
                                disabled={resolving === r.id}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30 rounded-md transition-colors disabled:opacity-50"
                                title="Buscar el documento en SICAS (HWCAPTURE ya fue ejecutado)"
                              >
                                <Search className="w-3 h-3" />
                                Verificar en SICAS
                              </button>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleRegisterDocument(r)}
                                  disabled={resolving === r.id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors disabled:opacity-50"
                                  title="Re-registrar documento en SICAS si la busqueda no encuentra nada"
                                >
                                  <Zap className="w-2.5 h-2.5" />
                                  Re-registrar
                                </button>
                                <button
                                  onClick={() => { setManualCaptureModal(r); setManualDocId(''); }}
                                  disabled={resolving === r.id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700/30 hover:bg-neutral-200 dark:hover:bg-neutral-700/50 rounded transition-colors disabled:opacity-50"
                                  title="Capturar manualmente el IDDocto de SICAS"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                  IDDocto
                                </button>
                                <button
                                  onClick={() => setDiagnosticModal(r)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/30 rounded transition-colors"
                                >
                                  <Eye className="w-2.5 h-2.5" />
                                  Diag
                                </button>
                              </div>
                            </div>
                          ) : ['partial_success', 'document_not_created', 'manual_review_required', 'validation_failed', 'error', 'sicas_rejected', 'client_creation_failed'].includes(r.sicas_registration_status || '') ? (
                            /* FLOW A: Document NOT yet registered in SICAS - needs HWCAPTURE */
                            getMissingFieldsForRegistration(r).length > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                                <ShieldAlert className="w-3 h-3" />
                                Datos incompletos
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setCompletarDatosRecord(r)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                  title={`Faltan: ${getMissingFieldsForRegistration(r).join(', ')}`}
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                  Resolver datos
                                </button>
                                <button
                                  onClick={() => setDiagnosticModal(r)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/30 rounded transition-colors"
                                >
                                  <Eye className="w-2.5 h-2.5" />
                                  Diag
                                </button>
                              </div>
                            </div>
                            ) : (
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => handleRegisterDocument(r)}
                                disabled={resolving === r.id}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50"
                                title="Registrar documento en SICAS via HWCAPTURE (el documento NO existe aun en SICAS)"
                              >
                                <Zap className="w-3 h-3" />
                                Registrar en SICAS
                              </button>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setDiagnosticModal(r)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/30 rounded transition-colors"
                                  title="Ver diagnostico de registro HWCAPTURE"
                                >
                                  <Eye className="w-2.5 h-2.5" />
                                  Diagnostico
                                </button>
                                <button
                                  onClick={() => { setManualCaptureModal(r); setManualDocId(''); }}
                                  disabled={resolving === r.id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700/30 hover:bg-neutral-200 dark:hover:bg-neutral-700/50 rounded transition-colors disabled:opacity-50"
                                  title="Capturar manualmente el IDDocto de SICAS"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                  IDDocto
                                </button>
                              </div>
                            </div>
                            )
                          ) : getMissingFieldsForRegistration(r).length > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              <button
                                disabled
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md opacity-70 cursor-not-allowed"
                                title={`Faltan datos: ${getMissingFieldsForRegistration(r).join(', ')}`}
                              >
                                <ShieldAlert className="w-3 h-3" />
                                Completar datos
                              </button>
                              <button
                                onClick={() => setCompletarDatosRecord(r)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                title="Completar datos faltantes para poder registrar en SICAS"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                                Editar
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
                            <span className="text-[10px] text-neutral-400 dark:text-white/30" title={!r.policy_number && !r.manual_policy_number ? 'Sin numero de poliza' : 'No disponible'}>
                              {!r.policy_number && !r.manual_policy_number ? 'Sin poliza' : '-'}
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
          onSavedAndRegister={() => {
            const rec = completarDatosRecord;
            loadRecords().then(() => {
              handleRegisterDocument(rec);
            });
          }}
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

      {manualCaptureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setManualCaptureModal(null)} />
          <div className="relative bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-xl">
                <Edit3 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white">Capturar IDDocto</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Ingresa el ID de documento que SICAS asigno a esta poliza. Se verificara contra SICAS antes de guardar.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">IDDocto SICAS</label>
              <input
                type="text"
                value={manualDocId}
                onChange={(e) => setManualDocId(e.target.value)}
                placeholder="Ej: 123456"
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                autoFocus
              />
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                Poliza: {manualCaptureModal.manual_policy_number || manualCaptureModal.policy_number || 'N/A'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setManualCaptureModal(null)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleManualCapture}
                disabled={!manualDocId.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Verificar y guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {diagnosticModal && (
        <DiagnosticModal
          record={diagnosticModal}
          onClose={() => setDiagnosticModal(null)}
        />
      )}
    </div>
  );
}

// ========================
// DIAGNOSTIC MODAL
// ========================

function DiagnosticModal({ record, onClose }: { record: DeliveryRecord; onClose: () => void }) {
  const lookupData = (record as any).sicas_document_lookup_response as Record<string, any> | null;
  const debugData = (record as any).sicas_request_debug as Record<string, any> | null;

  const regDiag = (debugData?.document_registration_diagnostic || debugData?.registration_diagnostics) as {
    executed?: boolean;
    method?: string;
    key_process?: string;
    key_code?: string;
    tproc?: string;
    type_format?: string;
    payload_fields?: Record<string, string>;
    missing_fields?: string[];
    field_mapping?: Record<string, string>;
    plain_data_xml?: string;
    encrypted_data_xml_length?: number;
    soap_request_redacted?: string;
    soap_response?: string;
    parsed_response?: { response_nbr: number | null; response_txt: string; has_success: boolean; has_error: boolean } | null;
    detected_id_docto?: string | null;
    document_stage_status?: string;
    encryption_used?: boolean;
    encryption_method?: string;
    iv_used?: string;
    error_message?: string | null;
    // Legacy fields (pre-update records)
    keyProcess?: string;
    keyCode?: string;
    tProc?: string;
    typeFormat?: string;
    dataXmlPlain?: string;
    dataXmlEncryptedLength?: number;
    soapResponsePreview?: string;
    fieldMapping?: Record<string, string>;
    encryptionUsed?: boolean;
    encryptionMethod?: string;
    ivUsed?: string;
  } | null;

  const diagnostics = lookupData?.diagnostics as Array<{
    strategy: string;
    request_summary: Record<string, string>;
    results_count: number;
    best_match_score: number;
    matched_id_docto: string | null;
    error?: string;
    duration_ms?: number;
  }> | null;
  const searchContext = lookupData?.search_context as Record<string, string> | null;
  const multipleMatches = lookupData?.multiple_matches as Array<{
    id_docto: string;
    documento: string;
    cliente: string;
    score: number;
    method: string;
  }> | null;

  const stageStatusLabels: Record<string, { label: string; color: string }> = {
    not_attempted: { label: 'No ejecutado', color: 'text-neutral-500 bg-neutral-100 dark:bg-neutral-700' },
    sent_to_sicas: { label: 'Enviado a SICAS', color: 'text-blue-700 bg-blue-100 dark:bg-blue-900/30' },
    success_with_id: { label: 'Creado (con ID)', color: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30' },
    success_without_id: { label: 'Exito sin ID', color: 'text-amber-700 bg-amber-100 dark:bg-amber-900/30' },
    not_created: { label: 'No creado', color: 'text-red-700 bg-red-100 dark:bg-red-900/30' },
    failed: { label: 'Fallo', color: 'text-red-700 bg-red-100 dark:bg-red-900/30' },
    duplicate: { label: 'Duplicado', color: 'text-amber-700 bg-amber-100 dark:bg-amber-900/30' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900 dark:text-white">Diagnostico SICAS</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        <div className="space-y-3">
          {/* === STAGE 0: DATA VALIDATION === */}
          {(() => {
            const validationDetails = getDeliveryValidationDetails(record);
            const missingFields = getMissingFieldsForRegistration(record);
            const allPresent = missingFields.length === 0;
            return (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider">Etapa 0: Validacion de datos</p>
                <div className={`border rounded-lg p-3 space-y-2 ${allPresent ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-neutral-500">Estado:</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${allPresent ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30' : 'text-red-700 bg-red-100 dark:bg-red-900/30'}`}>
                      {allPresent ? 'Datos completos' : `Faltan ${missingFields.length} campo(s)`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-[10px]">
                    {validationDetails.map((d) => (
                      <div key={d.field} className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${d.value ? 'bg-emerald-500' : 'bg-red-400'}`} />
                        <div className="min-w-0">
                          <span className="font-medium text-neutral-700 dark:text-neutral-300">{d.field}:</span>{' '}
                          <span className={`font-mono ${d.value ? 'text-neutral-800 dark:text-white' : 'text-red-500 italic'}`}>
                            {d.value || 'N/A'}
                          </span>
                          <span className="text-[9px] text-neutral-400 ml-1">({d.source})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!allPresent && (
                    <p className="text-[9px] text-red-600 dark:text-red-400 font-medium pt-1 border-t border-red-100 dark:border-red-800">
                      HWCAPTURE no se puede ejecutar porque faltan datos obligatorios. Use "Resolver datos" para completar.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* === STAGE 1: CONTACT / CLIENT === */}
          {(() => {
            const contactStatus = (record as any).sicas_contact_status as string | null;
            const clientId = (record as any).sicas_client_id as string | null;
            const clientName = (record as any).sicas_client_name as string | null;
            const clientMethod = (record as any).sicas_client_match_method as string | null;
            const contactLabels: Record<string, { label: string; color: string; icon: string }> = {
              created: { label: 'Creado', color: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30', icon: 'check' },
              created_no_id: { label: 'Creado (sin ID)', color: 'text-amber-700 bg-amber-100 dark:bg-amber-900/30', icon: 'alert' },
              existing: { label: 'Existente', color: 'text-blue-700 bg-blue-100 dark:bg-blue-900/30', icon: 'check' },
              creation_failed: { label: 'Fallo creacion', color: 'text-red-700 bg-red-100 dark:bg-red-900/30', icon: 'x' },
              not_attempted: { label: 'No requerido', color: 'text-neutral-500 bg-neutral-100 dark:bg-neutral-700', icon: 'minus' },
            };
            const info = contactLabels[contactStatus || ''] || contactLabels['not_attempted'];
            return (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Etapa 1: Contacto / Cliente</p>
                <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] text-neutral-500">Estado:</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
                    {clientId && clientId !== '0' && (
                      <span className="text-[10px] font-mono font-bold text-teal-700 dark:text-teal-300">IDCli: {clientId}</span>
                    )}
                  </div>
                  {clientName && (
                    <div className="text-[10px] text-neutral-600 dark:text-neutral-400"><span className="text-neutral-500">Nombre:</span> {clientName}</div>
                  )}
                  {clientMethod && (
                    <div className="text-[10px] text-neutral-600 dark:text-neutral-400"><span className="text-neutral-500">Metodo:</span> <span className="font-mono">{clientMethod}</span></div>
                  )}
                  {contactStatus === 'creation_failed' && (record as any).sicas_error_message && (record as any).sicas_error_step === 'create_client_if_needed' && (
                    <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1 mt-1">{(record as any).sicas_error_message}</div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* === STAGE 2: REGISTRATION DIAGNOSTIC SECTION === */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Etapa 2: Registro de documento / HWCAPTURE</p>
            {regDiag ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
                {/* Stage status badge */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-neutral-500">Estado:</span>
                  {(() => {
                    const status = regDiag.document_stage_status || 'sent_to_sicas';
                    const info = stageStatusLabels[status] || stageStatusLabels['sent_to_sicas'];
                    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>;
                  })()}
                  {regDiag.detected_id_docto && (
                    <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300">IDDocto: {regDiag.detected_id_docto}</span>
                  )}
                </div>

                {regDiag.error_message && (
                  <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">{regDiag.error_message}</div>
                )}

                {/* SOAP method info */}
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div><span className="text-neutral-500">Method:</span> <span className="font-mono font-medium text-blue-700 dark:text-blue-300">{regDiag.method || regDiag.key_process ? 'ProcesarWS' : 'N/A'}</span></div>
                  <div><span className="text-neutral-500">KeyProcess:</span> <span className="font-mono font-medium text-blue-700 dark:text-blue-300">{regDiag.key_process || regDiag.keyProcess || 'DATA'}</span></div>
                  <div><span className="text-neutral-500">KeyCode:</span> <span className="font-mono font-medium text-blue-700 dark:text-blue-300">{regDiag.key_code || regDiag.keyCode || 'HWCAPTURE'}</span></div>
                  <div><span className="text-neutral-500">TProc:</span> <span className="font-mono font-medium text-blue-700 dark:text-blue-300">{regDiag.tproc || regDiag.tProc || 'Save_Data'}</span></div>
                  <div><span className="text-neutral-500">TypeFormat:</span> <span className="font-mono font-medium text-blue-700 dark:text-blue-300">{regDiag.type_format || regDiag.typeFormat || 'XML'}</span></div>
                  <div><span className="text-neutral-500">Encriptacion:</span> <span className={`font-mono font-medium ${(regDiag.encryption_used ?? regDiag.encryptionUsed) ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{regDiag.encryption_method || regDiag.encryptionMethod || 'N/A'}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  {(regDiag.iv_used || regDiag.ivUsed) && <div><span className="text-neutral-500">IV:</span> <span className="font-mono text-blue-700 dark:text-blue-300">{regDiag.iv_used || regDiag.ivUsed}</span></div>}
                  {(regDiag.encrypted_data_xml_length || regDiag.dataXmlEncryptedLength) && <div><span className="text-neutral-500">DataXML enc. length:</span> <span className="font-mono text-blue-700 dark:text-blue-300">{regDiag.encrypted_data_xml_length || regDiag.dataXmlEncryptedLength}</span></div>}
                </div>

                {/* Payload fields */}
                {regDiag.payload_fields && Object.keys(regDiag.payload_fields).length > 0 && (
                  <div className="pt-2 border-t border-blue-100 dark:border-blue-800">
                    <p className="text-[9px] font-semibold text-neutral-500 mb-1">Campos del payload ({Object.keys(regDiag.payload_fields).length})</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                      {Object.entries(regDiag.payload_fields).map(([key, val]) => (
                        <div key={key} className="font-mono truncate">
                          <span className="text-neutral-500">{key}:</span>{' '}
                          <span className="text-blue-700 dark:text-blue-300 font-medium">{val || <span className="text-red-400 italic">vacio</span>}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing fields */}
                {regDiag.missing_fields && regDiag.missing_fields.length > 0 && (
                  <div className="pt-2 border-t border-blue-100 dark:border-blue-800">
                    <p className="text-[9px] font-semibold text-red-500 mb-1">Campos faltantes o vacios ({regDiag.missing_fields.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {regDiag.missing_fields.map((f) => (
                        <span key={f} className="text-[9px] font-mono bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field mapping */}
                {(regDiag.field_mapping || regDiag.fieldMapping) && Object.keys(regDiag.field_mapping || regDiag.fieldMapping || {}).length > 0 && (
                  <div className="pt-2 border-t border-blue-100 dark:border-blue-800">
                    <p className="text-[9px] font-semibold text-neutral-500 mb-1">Mapeo de campos (interno - SICAS)</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                      {Object.entries(regDiag.field_mapping || regDiag.fieldMapping || {}).map(([from, to]) => (
                        <div key={from} className="font-mono">
                          <span className="text-neutral-500">{from}</span>
                          <span className="text-neutral-400 mx-1">-&gt;</span>
                          <span className="text-blue-700 dark:text-blue-300">{to}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parsed response */}
                {regDiag.parsed_response && (
                  <div className="pt-2 border-t border-blue-100 dark:border-blue-800">
                    <p className="text-[9px] font-semibold text-neutral-500 mb-1">Respuesta parseada</p>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div><span className="text-neutral-500">RESPONSENBR:</span> <span className={`font-mono font-bold ${regDiag.parsed_response.response_nbr === 1 ? 'text-emerald-600' : 'text-red-600'}`}>{regDiag.parsed_response.response_nbr ?? 'null'}</span></div>
                      <div><span className="text-neutral-500">RESPONSETXT:</span> <span className="font-mono text-neutral-700 dark:text-neutral-300">{regDiag.parsed_response.response_txt || 'vacio'}</span></div>
                      <div><span className="text-neutral-500">hasSuccess:</span> <span className={`font-mono ${regDiag.parsed_response.has_success ? 'text-emerald-600' : 'text-neutral-400'}`}>{String(regDiag.parsed_response.has_success)}</span></div>
                      <div><span className="text-neutral-500">hasError:</span> <span className={`font-mono ${regDiag.parsed_response.has_error ? 'text-red-600' : 'text-neutral-400'}`}>{String(regDiag.parsed_response.has_error)}</span></div>
                    </div>
                  </div>
                )}

                {/* DataXML plain */}
                {(regDiag.plain_data_xml || regDiag.dataXmlPlain) && (
                  <div className="pt-2 border-t border-blue-100 dark:border-blue-800">
                    <p className="text-[9px] font-semibold text-neutral-500 mb-1">DataXML enviado (plain)</p>
                    <pre className="text-[9px] font-mono text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900/50 rounded p-2 overflow-x-auto max-h-28 whitespace-pre-wrap break-all">{regDiag.plain_data_xml || regDiag.dataXmlPlain}</pre>
                  </div>
                )}

                {/* SOAP Request redacted */}
                {regDiag.soap_request_redacted && (
                  <div className="pt-2 border-t border-blue-100 dark:border-blue-800">
                    <p className="text-[9px] font-semibold text-neutral-500 mb-1">SOAP Request (redactado)</p>
                    <pre className="text-[9px] font-mono text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900/50 rounded p-2 overflow-x-auto max-h-28 whitespace-pre-wrap break-all">{regDiag.soap_request_redacted.substring(0, 1500)}</pre>
                  </div>
                )}

                {/* SOAP Response */}
                {(regDiag.soap_response || regDiag.soapResponsePreview) && (
                  <div className="pt-2 border-t border-blue-100 dark:border-blue-800">
                    <p className="text-[9px] font-semibold text-neutral-500 mb-1">Respuesta SOAP</p>
                    <pre className="text-[9px] font-mono text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900/50 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">{(regDiag.soap_response || regDiag.soapResponsePreview || '').substring(0, 2000)}</pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Documento pendiente de registro en SICAS</p>
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  El registro HWCAPTURE no ha sido ejecutado. El documento no existe todavia en SICAS.
                </p>
                <div className="text-[10px] text-neutral-600 dark:text-neutral-300 space-y-1 pt-1 border-t border-amber-100 dark:border-amber-800">
                  <p><strong>Estado:</strong> No se ha enviado HWCAPTURE</p>
                  <p><strong>IDDocto SICAS:</strong> {record.sicas_document_id || 'No existe'}</p>
                  <p><strong>Registro SICAS:</strong> {record.sicas_registered_at ? new Date(record.sicas_registered_at).toLocaleString('es-MX') : 'Nunca'}</p>
                  <p><strong>Ultimo intento:</strong> {record.sicas_last_attempt_at ? new Date(record.sicas_last_attempt_at).toLocaleString('es-MX') : 'Nunca'}</p>
                  <p><strong>Intentos:</strong> {record.sicas_registration_attempts || 0}</p>
                </div>

                {record.sicas_error_message && (
                  <div className="pt-2 border-t border-amber-100 dark:border-amber-800">
                    <p className="text-[9px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Errores anteriores (intentos previos)</p>
                    <p className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-1.5 font-mono break-all">{record.sicas_error_message}</p>
                    <p className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1 italic">Este error corresponde a un intento anterior. HWCAPTURE no ha sido ejecutado exitosamente.</p>
                  </div>
                )}

                {(() => {
                  const missingFields = getMissingFieldsForRegistration(record);
                  if (missingFields.length > 0) {
                    return (
                      <div className="pt-2 border-t border-amber-100 dark:border-amber-800">
                        <p className="text-[9px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Datos obligatorios faltantes</p>
                        <ul className="text-[10px] text-red-600 dark:text-red-400 list-disc pl-3 space-y-0.5">
                          {missingFields.map(f => <li key={f}>{f}</li>)}
                        </ul>
                        <p className="text-[9px] text-amber-700 dark:text-amber-300 font-medium mt-1">Complete estos datos antes de intentar el registro.</p>
                      </div>
                    );
                  }
                  return null;
                })()}

                <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium pt-1">
                  {getMissingFieldsForRegistration(record).length > 0
                    ? 'Accion recomendada: Complete los datos faltantes y luego use "Registrar en SICAS".'
                    : 'Accion recomendada: Usa el boton "Registrar en SICAS" para ejecutar HWCAPTURE y crear el documento.'}
                </p>
              </div>
            )}
          </div>

          {/* === SEARCH CONTEXT SECTION === */}
          <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-lg p-3 space-y-1">
            <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Datos de busqueda</p>
            {searchContext ? (
              <div className="grid grid-cols-2 gap-1 text-xs">
                {Object.entries(searchContext).map(([key, val]) => val ? (
                  <div key={key}>
                    <span className="text-neutral-500 dark:text-neutral-400">{key.replace(/_/g, ' ')}:</span>{' '}
                    <span className="text-neutral-800 dark:text-white font-medium">{val}</span>
                  </div>
                ) : null)}
              </div>
            ) : (
              <div className="text-xs text-neutral-400">
                <p>Poliza: {record.manual_policy_number || record.policy_number || 'N/A'}</p>
                <p>Asegurado: {record.insured_name || 'N/A'}</p>
                <p>Intentos: {(record as any).sicas_document_lookup_attempts || 0}</p>
                <p>Ultimo intento: {(record as any).sicas_last_lookup_at ? new Date((record as any).sicas_last_lookup_at).toLocaleString('es-MX') : 'Nunca'}</p>
              </div>
            )}
          </div>

          {/* === SEARCH STRATEGIES SECTION === */}
          {diagnostics && diagnostics.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Estrategias de busqueda ejecutadas</p>
              {diagnostics.map((d, i) => (
                <div key={i} className={`rounded-lg border p-2.5 text-xs ${d.best_match_score >= 80 ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10' : d.best_match_score >= 60 ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10' : 'border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700/20'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-neutral-800 dark:text-white">{d.strategy}</span>
                    {d.duration_ms !== undefined && (
                      <span className="text-[9px] text-neutral-400">{d.duration_ms}ms</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-neutral-600 dark:text-neutral-300">
                    <span>Resultados: <strong>{d.results_count}</strong></span>
                    <span>Mejor score: <strong className={d.best_match_score >= 80 ? 'text-emerald-600' : d.best_match_score >= 60 ? 'text-amber-600' : ''}>{d.best_match_score}</strong></span>
                    {d.matched_id_docto && <span>IDDocto: <strong>{d.matched_id_docto}</strong></span>}
                    {d.error && <span className="col-span-2 text-red-500">{d.error}</span>}
                  </div>
                  {d.request_summary && Object.keys(d.request_summary).length > 0 && (
                    <div className="mt-1 pt-1 border-t border-neutral-100 dark:border-neutral-600">
                      <p className="text-[9px] text-neutral-400">
                        {Object.entries(d.request_summary).map(([k, v]) => `${k}=${v}`).join(' | ')}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : !regDiag ? (
            <div className="text-xs text-neutral-500 dark:text-neutral-400 py-2">
              No hay datos de busqueda. {record.sicas_document_id || record.sicas_registered_at
                ? 'Ejecuta "Verificar en SICAS" para buscar el documento.'
                : 'Primero registra el documento con "Registrar en SICAS", despues podras verificarlo.'}
            </div>
          ) : null}

          {/* === MULTIPLE MATCHES SECTION === */}
          {multipleMatches && multipleMatches.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Posibles coincidencias (score &lt; 80)</p>
              <div className="space-y-1">
                {multipleMatches.map((m, i) => (
                  <div key={i} className="flex items-center justify-between rounded border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10 px-2 py-1.5 text-xs">
                    <div>
                      <span className="font-medium text-neutral-800 dark:text-white">ID: {m.id_docto}</span>
                      <span className="text-neutral-500 ml-2">{m.documento}</span>
                      {m.cliente && <span className="text-neutral-400 ml-2 text-[10px]">{m.cliente.substring(0, 25)}</span>}
                    </div>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold text-[10px]">Score: {m.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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
