import { useState, useEffect, useCallback } from 'react';
import {
  X, Mail, User, Brain, FileText, CheckCircle2, AlertCircle,
  Loader2, Sparkles, Search, ChevronDown, ChevronUp,
  Paperclip, ExternalLink, Shield, Clock, Building2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BaseModal } from '../BaseModal';
import { TIPO_TRAMITE_OPTIONS, type TipoTramiteConfig } from '@/lib/registroActividadesTypes';

interface EmailData {
  uid: number;
  messageId: string;
  from: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  subject: string;
  date: string;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: { filename: string; contentType: string; size: number; partId: string }[];
}

interface DetectedAgent {
  id: string;
  nombre_completo: string;
  oficina_id: string | null;
  method: string;
}

interface AIAnalysis {
  summary: string;
  request_type: string;
  suggested_procedure_type: string;
  priority: string;
  important_data: Record<string, string>;
  suggested_next_action: string;
  attachments_summary: { filename: string; possible_document_type: string; relevance: string }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  email: EmailData;
  emailAccount: string;
  currentFolder: string;
  onSuccess: (ticketId: string, folio: string) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'Baja', label: 'Baja', color: 'text-neutral-500 bg-neutral-50 border-neutral-200' },
  { value: 'Media', label: 'Media', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'Alta', label: 'Alta', color: 'text-orange-600 bg-orange-50 border-orange-200' },
];

const IMPORTANT_DATA_LABELS: Record<string, string> = {
  client_name: 'Cliente',
  insured_name: 'Asegurado',
  policy_number: 'No. Poliza',
  insurance_company: 'Aseguradora',
  line_of_business: 'Ramo',
  effective_date: 'Fecha vigencia',
  expiration_date: 'Fecha vencimiento',
  amount: 'Importe',
  phone: 'Telefono',
  email: 'Email contacto',
  deadline: 'Fecha limite',
  notes: 'Notas',
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function IniciarTramiteEmailModal({ isOpen, onClose, email, emailAccount, currentFolder, onSuccess }: Props) {
  const { usuario } = useAuth();

  // States
  const [step, setStep] = useState<'analyzing' | 'form' | 'creating' | 'success' | 'error'>('analyzing');
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [detectedAgent, setDetectedAgent] = useState<DetectedAgent | null>(null);
  const [existingTramite, setExistingTramite] = useState<{ id: string; folio: string } | null>(null);

  // Form fields
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [assignmentMethod, setAssignmentMethod] = useState<'automatic' | 'manual' | 'suggested'>('manual');
  const [tipoTramite, setTipoTramite] = useState('cotizacion_emision');
  const [prioridad, setPrioridad] = useState('Media');
  const [instrucciones, setInstrucciones] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [importantData, setImportantData] = useState<Record<string, string>>({});
  const [selectedAttachments, setSelectedAttachments] = useState<Set<number>>(new Set());
  const [showImportantData, setShowImportantData] = useState(false);

  // Agent search
  const [agentSearch, setAgentSearch] = useState('');
  const [agentResults, setAgentResults] = useState<{ id: string; nombre_completo: string; rol: string }[]>([]);
  const [searchingAgents, setSearchingAgents] = useState(false);
  const [showAgentSearch, setShowAgentSearch] = useState(false);

  // Result
  const [createdFolio, setCreatedFolio] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [attachmentResults, setAttachmentResults] = useState<{ nombre: string; success: boolean; error?: string }[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';

  // Run AI analysis on open
  useEffect(() => {
    if (isOpen && email) {
      analyzeEmail();
    }
    return () => {
      setStep('analyzing');
      setAnalysis(null);
      setDetectedAgent(null);
      setExistingTramite(null);
      setSelectedAgentId('');
      setAssignmentMethod('manual');
      setTipoTramite('cotizacion_emision');
      setPrioridad('Media');
      setInstrucciones('');
      setEditedSummary('');
      setImportantData({});
      setSelectedAttachments(new Set());
      setErrorMessage('');
    };
  }, [isOpen]);

  const analyzeEmail = async () => {
    setStep('analyzing');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesion');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-email-for-tramite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: email.subject,
          from: email.from,
          fromEmail: email.fromEmail,
          to: email.to,
          cc: email.cc,
          date: email.date,
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          attachments: email.attachments.map(a => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size,
          })),
        }),
      });

      const data = await resp.json();

      if (!resp.ok) throw new Error(data.error || 'Error al analizar');

      if (data.analysis) {
        setAnalysis(data.analysis);
        setEditedSummary(data.analysis.summary || '');
        setImportantData(data.analysis.important_data || {});
        if (data.analysis.suggested_procedure_type) {
          const matchType = TIPO_TRAMITE_OPTIONS.find(t => t.value === data.analysis.suggested_procedure_type);
          if (matchType) setTipoTramite(matchType.value);
        }
        if (data.analysis.priority) {
          const prioMap: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Alta' };
          setPrioridad(prioMap[data.analysis.priority] || 'Media');
        }
      }

      if (data.detectedAgent) {
        setDetectedAgent(data.detectedAgent);
        setSelectedAgentId(data.detectedAgent.id);
        setAssignmentMethod(data.detectedAgent.method as any);
      }

      if (data.existingTramite) {
        setExistingTramite(data.existingTramite);
      }

      // Select all attachments by default
      setSelectedAttachments(new Set(email.attachments.map((_, i) => i)));

      // Build instrucciones including AI summary
      const headerLine = `Email de: ${email.from} <${email.fromEmail}>\nAsunto: ${email.subject || '(Sin asunto)'}\nFecha: ${email.date ? new Date(email.date).toLocaleDateString('es-MX') : 'N/A'}`;
      const aiSummaryText = data.analysis?.summary ? `\n\nResumen IA:\n${data.analysis.summary}` : '';
      const nextAction = data.analysis?.suggested_next_action ? `\n\nAccion sugerida: ${data.analysis.suggested_next_action}` : '';
      setInstrucciones(`${headerLine}${aiSummaryText}${nextAction}`);

      setStep('form');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al analizar el correo');
      setStep('form');
      setSelectedAttachments(new Set(email.attachments.map((_, i) => i)));
      const defaultInstr = `Email de: ${email.from} <${email.fromEmail}>\nAsunto: ${email.subject || '(Sin asunto)'}`;
      setInstrucciones(defaultInstr);
    }
  };

  // Agent search
  const searchAgents = useCallback(async (query: string) => {
    if (query.length < 2) { setAgentResults([]); return; }
    setSearchingAgents(true);
    try {
      let q = supabase
        .from('usuarios')
        .select('id, nombre_completo, rol')
        .eq('activo', true)
        .ilike('nombre_completo', `%${query}%`)
        .limit(10);

      if (!isAdmin && usuario?.oficina_id) {
        q = q.eq('oficina_id', usuario.oficina_id);
      }

      const { data } = await q;
      setAgentResults(data || []);
    } finally {
      setSearchingAgents(false);
    }
  }, [isAdmin, usuario?.oficina_id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (agentSearch.trim()) searchAgents(agentSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [agentSearch, searchAgents]);

  // Create tramite
  const handleCreate = async (openAfter: boolean = false) => {
    if (!selectedAgentId) {
      setErrorMessage('Selecciona un agente para asignar el tramite');
      return;
    }
    if (!instrucciones.trim()) {
      setErrorMessage('Las instrucciones son requeridas');
      return;
    }

    setStep('creating');
    setErrorMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesion');

      const attachmentsPayload = email.attachments.map((a, i) => ({
        ...a,
        include: selectedAttachments.has(i),
      }));

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-tramite-from-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailAccount,
          emailFolder: currentFolder,
          emailUid: email.uid,
          emailMessageId: email.messageId,
          emailFromName: email.from,
          emailFromEmail: email.fromEmail,
          emailSubject: email.subject,
          emailDate: email.date,
          agentId: selectedAgentId,
          assignmentMethod,
          tipoTramite,
          prioridad,
          instrucciones: instrucciones.trim(),
          aiSummary: analysis?.summary || null,
          aiExtractedData: importantData,
          userEditedSummary: editedSummary !== analysis?.summary ? editedSummary : null,
          attachments: attachmentsPayload,
        }),
      });

      const data = await resp.json();

      if (resp.status === 409) {
        setExistingTramite(data.existing_tramite);
        setErrorMessage('Ya existe un tramite creado desde este correo');
        setStep('form');
        return;
      }

      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Error al crear tramite');
      }

      setCreatedFolio(data.folio);
      setCreatedId(data.ticket_id);
      setAttachmentResults(data.attachments_result || []);
      setStep('success');

      if (openAfter) {
        onSuccess(data.ticket_id, data.folio);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al crear tramite');
      setStep('form');
    }
  };

  const selectedAgentName = detectedAgent?.id === selectedAgentId
    ? detectedAgent.nombre_completo
    : agentResults.find(a => a.id === selectedAgentId)?.nombre_completo || '';

  if (!isOpen) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Iniciar tramite desde email" maxWidth="3xl">
      <div className="max-h-[70vh] overflow-y-auto px-1">
        {/* ANALYZING STATE */}
        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Brain className="w-7 h-7 text-accent animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Analizando correo con IA...</p>
              <p className="text-xs text-neutral-400 mt-1">Detectando tipo, prioridad y datos relevantes</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Buscando agente por email remitente...</span>
            </div>
          </div>
        )}

        {/* CREATING STATE */}
        {step === 'creating' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Creando tramite...</p>
              {selectedAttachments.size > 0 && (
                <p className="text-xs text-neutral-400 mt-1">Descargando y almacenando {selectedAttachments.size} adjunto{selectedAttachments.size !== 1 ? 's' : ''}</p>
              )}
            </div>
          </div>
        )}

        {/* SUCCESS STATE */}
        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Tramite creado correctamente</p>
              <p className="text-lg font-bold text-accent mt-1">{createdFolio}</p>
            </div>

            {attachmentResults.length > 0 && (
              <div className="w-full max-w-md mt-2 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50">
                <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Adjuntos</p>
                <div className="space-y-1.5">
                  {attachmentResults.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {r.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      )}
                      <span className={r.success ? 'text-neutral-600 dark:text-neutral-300' : 'text-red-500'}>
                        {r.nombre}
                      </span>
                      {r.error && <span className="text-[10px] text-red-400 ml-auto">{r.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { onSuccess(createdId, createdFolio); onClose(); }}
                className="px-4 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Ver tramite
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* FORM STATE */}
        {step === 'form' && (
          <div className="space-y-5">
            {/* Error banner */}
            {errorMessage && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-red-700 dark:text-red-300">{errorMessage}</p>
                  {existingTramite && (
                    <button
                      onClick={() => { onSuccess(existingTramite.id, existingTramite.folio); onClose(); }}
                      className="mt-1.5 text-[11px] font-medium text-red-600 hover:text-red-800 underline"
                    >
                      Ver tramite existente ({existingTramite.folio})
                    </button>
                  )}
                </div>
                <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-red-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Existing tramite warning */}
            {existingTramite && !errorMessage && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300 flex-1">
                  Este correo ya tiene un tramite relacionado: <span className="font-bold">{existingTramite.folio}</span>
                </p>
                <button
                  onClick={() => { onSuccess(existingTramite.id, existingTramite.folio); onClose(); }}
                  className="text-[11px] font-medium text-amber-600 hover:text-amber-800 underline flex-shrink-0"
                >
                  Ver tramite
                </button>
              </div>
            )}

            {/* Section A: Email origin */}
            <section className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50">
              <div className="flex items-center gap-2 mb-2.5">
                <Mail className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">Origen del correo</h3>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div><span className="text-neutral-400">De:</span> <span className="text-neutral-700 dark:text-neutral-200 font-medium">{email.from}</span></div>
                <div><span className="text-neutral-400">Email:</span> <span className="text-neutral-700 dark:text-neutral-200">{email.fromEmail}</span></div>
                <div className="col-span-2"><span className="text-neutral-400">Asunto:</span> <span className="text-neutral-700 dark:text-neutral-200 font-medium">{email.subject || '(Sin asunto)'}</span></div>
                <div><span className="text-neutral-400">Fecha:</span> <span className="text-neutral-700 dark:text-neutral-200">{email.date ? new Date(email.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span></div>
                <div><span className="text-neutral-400">Canal:</span> <span className="text-accent font-medium">Email</span></div>
              </div>
            </section>

            {/* Section B: Agent */}
            <section className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-2 mb-2.5">
                <User className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">Agente relacionado</h3>
              </div>

              {detectedAgent && detectedAgent.id === selectedAgentId && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    {assignmentMethod === 'automatic' ? 'Detectado automaticamente por correo remitente' : 'Coincidencia sugerida'}
                  </span>
                </div>
              )}

              {selectedAgentId && selectedAgentName && !showAgentSearch && (
                <div className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent">
                    {selectedAgentName.charAt(0)}
                  </div>
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200 flex-1">{selectedAgentName}</span>
                  <button
                    onClick={() => { setShowAgentSearch(true); setAgentSearch(''); }}
                    className="text-[10px] text-accent hover:underline"
                  >
                    Cambiar
                  </button>
                </div>
              )}

              {(!selectedAgentId || showAgentSearch) && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={agentSearch}
                      onChange={e => setAgentSearch(e.target.value)}
                      placeholder="Buscar agente por nombre..."
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-accent/50"
                    />
                    {searchingAgents && <Loader2 className="w-3 h-3 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin" />}
                  </div>
                  {agentResults.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700 divide-y divide-neutral-100 dark:divide-neutral-800">
                      {agentResults.map(a => (
                        <button
                          key={a.id}
                          onClick={() => {
                            setSelectedAgentId(a.id);
                            setAssignmentMethod('manual');
                            setShowAgentSearch(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
                        >
                          <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-[9px] font-bold text-accent">
                            {a.nombre_completo?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200 truncate">{a.nombre_completo}</p>
                            <p className="text-[10px] text-neutral-400">{a.rol}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {!selectedAgentId && !agentSearch && (
                    <p className="text-[11px] text-neutral-400 italic">No se detecto un agente. Busca para asignar uno.</p>
                  )}
                </div>
              )}
            </section>

            {/* Section C: Tipo + Prioridad */}
            <section className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 block">Tipo de tramite</label>
                <select
                  value={tipoTramite}
                  onChange={e => setTipoTramite(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-accent/50"
                >
                  {TIPO_TRAMITE_OPTIONS.filter(t => t.value !== 'formulario_cotizacion').map(t => (
                    <option key={t.value} value={t.value}>{t.label} ({t.area})</option>
                  ))}
                </select>
                {analysis?.suggested_procedure_type && (
                  <p className="text-[10px] text-accent mt-1 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> Sugerido por IA
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 block">Prioridad</label>
                <div className="flex gap-1.5">
                  {PRIORITY_OPTIONS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPrioridad(p.value)}
                      className={`flex-1 px-2.5 py-2 text-[11px] font-medium rounded-lg border transition ${
                        prioridad === p.value
                          ? p.color + ' ring-1 ring-offset-1 ring-accent/30'
                          : 'text-neutral-400 bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Section D: AI Summary */}
            {analysis && (
              <section className="p-3.5 rounded-xl bg-sky-50/50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <h3 className="text-xs font-semibold text-sky-800 dark:text-sky-200">Resumen IA</h3>
                </div>
                <textarea
                  value={editedSummary}
                  onChange={e => setEditedSummary(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-sky-200 dark:border-sky-800/50 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-sky-400/50 resize-y"
                />
                {analysis.suggested_next_action && (
                  <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-1.5 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> Accion sugerida: {analysis.suggested_next_action}
                  </p>
                )}
              </section>
            )}

            {/* Section E: Important data (collapsible) */}
            {Object.keys(importantData).some(k => importantData[k]) && (
              <section className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowImportantData(!showImportantData)}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  <Shield className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 flex-1 text-left">Informacion detectada</h3>
                  {showImportantData ? <ChevronUp className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />}
                </button>
                {showImportantData && (
                  <div className="p-3.5 grid grid-cols-2 gap-2.5">
                    {Object.entries(importantData).map(([key, value]) => {
                      if (!value && !IMPORTANT_DATA_LABELS[key]) return null;
                      return (
                        <div key={key}>
                          <label className="text-[10px] text-neutral-400 block mb-0.5">{IMPORTANT_DATA_LABELS[key] || key}</label>
                          <input
                            value={value || ''}
                            onChange={e => setImportantData(prev => ({ ...prev, [key]: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-[11px] rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-accent/50"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Section F: Attachments */}
            {email.attachments.length > 0 && (
              <section className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-2 mb-2.5">
                  <Paperclip className="w-4 h-4 text-neutral-500" />
                  <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                    Adjuntos ({selectedAttachments.size}/{email.attachments.length} seleccionados)
                  </h3>
                  <button
                    onClick={() => {
                      if (selectedAttachments.size === email.attachments.length) {
                        setSelectedAttachments(new Set());
                      } else {
                        setSelectedAttachments(new Set(email.attachments.map((_, i) => i)));
                      }
                    }}
                    className="text-[10px] text-accent hover:underline ml-auto"
                  >
                    {selectedAttachments.size === email.attachments.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {email.attachments.map((att, i) => {
                    const aiAtt = analysis?.attachments_summary?.find(a => a.filename === att.filename);
                    return (
                      <label
                        key={i}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
                          selectedAttachments.has(i)
                            ? 'bg-accent/5 border-accent/30'
                            : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAttachments.has(i)}
                          onChange={() => {
                            const next = new Set(selectedAttachments);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            setSelectedAttachments(next);
                          }}
                          className="rounded border-neutral-300 text-accent focus:ring-accent/50 w-3.5 h-3.5"
                        />
                        <FileText className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-neutral-700 dark:text-neutral-200 truncate">{att.filename}</p>
                          <p className="text-[10px] text-neutral-400">
                            {formatSize(att.size)}
                            {aiAtt?.possible_document_type && ` - ${aiAtt.possible_document_type}`}
                          </p>
                        </div>
                        {aiAtt?.relevance === 'alta' && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full font-medium">Relevante</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Section G: Instructions */}
            <section>
              <label className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 block">
                Instrucciones del tramite *
              </label>
              <textarea
                value={instrucciones}
                onChange={e => setInstrucciones(e.target.value)}
                rows={3}
                placeholder="Describe la solicitud o instrucciones para este tramite..."
                className="w-full px-3 py-2.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-accent/50 resize-y"
              />
            </section>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {step === 'form' && (
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-neutral-100 dark:border-neutral-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition"
          >
            Cancelar
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleCreate(false)}
              disabled={!selectedAgentId || !instrucciones.trim()}
              className="px-4 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Crear tramite
            </button>
            <button
              onClick={() => handleCreate(true)}
              disabled={!selectedAgentId || !instrucciones.trim()}
              className="px-4 py-2 text-xs font-medium border border-accent text-accent rounded-lg hover:bg-accent/5 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Crear y abrir
            </button>
          </div>
        </div>
      )}
    </BaseModal>
  );
}
