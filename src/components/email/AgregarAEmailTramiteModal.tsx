import { useState, useEffect, useMemo } from 'react';
import {
  Check, Loader2, AlertCircle, Plus, User, CheckSquare,
  ClipboardList, Paperclip, FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BaseModal } from '../BaseModal';

interface EmailData {
  uid: number;
  messageId: string;
  from: string;
  fromEmail: string;
  subject: string;
  date: string;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: { filename: string; contentType: string; size: number; partId: string }[];
}

interface OpenTicket {
  id: string;
  folio: string;
  instrucciones: string;
  tipo_tramite: string;
  estatus_nombre: string;
  agente: { id: string; nombre_completo: string } | null;
  responsable: { id: string; nombre_completo: string } | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  email: EmailData;
  emailAccount: string;
  currentFolder: string;
  onSuccess?: (folio: string) => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function AgregarAEmailTramiteModal({ isOpen, onClose, email, emailAccount, currentFolder, onSuccess }: Props) {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';
  const isEmpleado = ['Empleado', 'Ejecutivo', 'Gerente'].includes(usuario?.rol || '');
  const currentUserId = usuario?.id || '';

  const [openTickets, setOpenTickets] = useState<OpenTicket[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [filterAgente, setFilterAgente] = useState('');
  const [filterResponsable, setFilterResponsable] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [agentesList, setAgentesList] = useState<Array<{ id: string; nombre_completo: string }>>([]);
  const [responsablesList, setResponsablesList] = useState<Array<{ id: string; nombre_completo: string }>>([]);

  const [selectedAttachments, setSelectedAttachments] = useState<Set<number>>(new Set());
  const [addingToTicket, setAddingToTicket] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [attachmentResults, setAttachmentResults] = useState<{ nombre: string; success: boolean; error?: string }[]>([]);

  // Load open tickets + filter lists on open
  useEffect(() => {
    if (!isOpen) return;
    setTicketSearch('');
    setFilterAgente('');
    setFilterResponsable('');
    setFilterTipo('');
    setAddError('');
    setAddSuccess('');
    setAttachmentResults([]);
    setSelectedAttachments(new Set(email.attachments.map((_, i) => i)));
    loadTickets();
    return () => {
      setOpenTickets([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadTickets = async () => {
    setTicketLoading(true);
    setAddError('');
    try {
      let query = supabase
        .from('tickets')
        .select(`id, folio, instrucciones, tipo_tramite,
          agente:agente_id(id, nombre_completo),
          responsable:assigned_to_user_id(id, nombre_completo),
          estatus:estatus_id(nombre)`)
        .is('cerrado_en', null)
        .is('eliminado_at', null)
        .order('fecha_creacion', { ascending: false })
        .limit(200);

      if (!isAdmin && !isEmpleado) {
        query = (query as any).or(`agente_id.eq.${currentUserId},assigned_to_user_id.eq.${currentUserId}`);
      }

      const { data } = await query;
      const mapped: OpenTicket[] = ((data || []) as any[]).map(t => ({
        id: t.id,
        folio: t.folio || '',
        instrucciones: t.instrucciones || '',
        tipo_tramite: t.tipo_tramite || '',
        estatus_nombre: (t.estatus as any)?.nombre || '',
        agente: t.agente || null,
        responsable: t.responsable || null,
      }));
      setOpenTickets(mapped);

      if (isAdmin || isEmpleado) {
        const { data: agentes } = await supabase
          .from('usuarios').select('id, nombre_completo').eq('rol', 'Agente').order('nombre_completo');
        setAgentesList((agentes || []) as Array<{ id: string; nombre_completo: string }>);
      }
      if (isAdmin) {
        const { data: resps } = await supabase
          .from('usuarios').select('id, nombre_completo').neq('rol', 'Agente').order('nombre_completo');
        setResponsablesList((resps || []) as Array<{ id: string; nombre_completo: string }>);
      }
    } catch {
      setAddError('Error al cargar trámites');
    }
    setTicketLoading(false);
  };

  const filteredTickets = useMemo(() => {
    const q = norm(ticketSearch);
    return openTickets.filter(t => {
      const matchSearch = !ticketSearch || norm(t.folio).includes(q) || norm(t.instrucciones || '').includes(q);
      const matchAgente = !filterAgente || t.agente?.id === filterAgente;
      const matchResponsable = !filterResponsable || t.responsable?.id === filterResponsable;
      const matchTipo = !filterTipo || t.tipo_tramite === filterTipo;
      return matchSearch && matchAgente && matchResponsable && matchTipo;
    });
  }, [openTickets, ticketSearch, filterAgente, filterResponsable, filterTipo]);

  const addToTicket = async (ticketId: string, folio: string) => {
    setAddingToTicket(ticketId);
    setAddError('');
    setAddSuccess('');
    setAttachmentResults([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión');

      const attachmentsPayload = email.attachments.map((a, i) => ({
        filename: a.filename,
        contentType: a.contentType,
        size: a.size,
        partId: a.partId,
        include: selectedAttachments.has(i),
      }));

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-email-to-tramite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId,
          emailAccount,
          emailFolder: currentFolder,
          emailUid: email.uid,
          emailMessageId: email.messageId,
          emailFromName: email.from,
          emailFromEmail: email.fromEmail,
          emailSubject: email.subject,
          emailDate: email.date,
          emailBodyText: email.bodyText || email.bodyHtml?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '',
          attachments: attachmentsPayload,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Error al agregar al trámite');
      }

      const results = (data.attachments_result || []) as { nombre: string; success: boolean; error?: string }[];
      setAttachmentResults(results);
      const okCount = results.filter(r => r.success).length;
      const parts = ['Correo agregado al trámite ' + folio];
      if (okCount > 0) parts.push(`${okCount} adjunto${okCount !== 1 ? 's' : ''}`);
      setAddSuccess(parts.join(' · '));

      onSuccess?.(folio);
      setTimeout(() => { onClose(); }, 2000);
    } catch (err: any) {
      setAddError(err.message || 'Error al agregar al trámite');
    } finally {
      setAddingToTicket(null);
    }
  };

  const tipoOptions = useMemo(
    () => [...new Set(openTickets.map(t => t.tipo_tramite))].filter(Boolean),
    [openTickets]
  );

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Agregar correo a trámite existente" maxWidth="2xl">
      {addSuccess ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-semibold text-green-700 dark:text-green-400 text-center">{addSuccess}</p>
          {attachmentResults.some(r => !r.success) && (
            <div className="w-full max-w-md mt-1 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40">
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1">Algunos adjuntos no se pudieron subir:</p>
              {attachmentResults.filter(r => !r.success).map((r, i) => (
                <p key={i} className="text-[11px] text-amber-600 dark:text-amber-400">• {r.nombre}{r.error ? ` — ${r.error}` : ''}</p>
              ))}
            </div>
          )}
          <p className="text-xs text-neutral-400">Cerrando...</p>
        </div>
      ) : (
        <>
          {/* Email summary */}
          <div className="mb-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50">
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 truncate">{email.subject || '(Sin asunto)'}</p>
            <p className="text-[11px] text-neutral-400 truncate">{email.from} {email.fromEmail ? `<${email.fromEmail}>` : ''}</p>
          </div>

          {/* Attachment selection */}
          {email.attachments.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                  <Paperclip className="w-3 h-3" />
                  Adjuntos ({selectedAttachments.size}/{email.attachments.length})
                </p>
                <button
                  onClick={() => {
                    if (selectedAttachments.size === email.attachments.length) setSelectedAttachments(new Set());
                    else setSelectedAttachments(new Set(email.attachments.map((_, i) => i)));
                  }}
                  className="text-[11px] text-accent hover:underline"
                >
                  {selectedAttachments.size === email.attachments.length ? 'Quitar todos' : 'Incluir todos'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {email.attachments.map((att, i) => {
                  const checked = selectedAttachments.has(i);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedAttachments(prev => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        });
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition ${
                        checked
                          ? 'border-accent/50 bg-accent/5 text-neutral-700 dark:text-neutral-200'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 opacity-60'
                      }`}
                    >
                      <input type="checkbox" readOnly checked={checked} className="w-3 h-3 accent-current pointer-events-none" />
                      <FileText className="w-3 h-3" />
                      <span className="truncate max-w-[130px]">{att.filename}</span>
                      <span className="text-neutral-300 dark:text-neutral-500">({formatSize(att.size)})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-3">
            <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              value={ticketSearch}
              onChange={e => setTicketSearch(e.target.value)}
              placeholder="Buscar por folio o descripción..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-accent/40 text-neutral-800 dark:text-white placeholder:text-neutral-400"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-3">
            {(isAdmin || isEmpleado) && agentesList.length > 0 && (
              <select
                value={filterAgente}
                onChange={e => setFilterAgente(e.target.value)}
                className="flex-1 min-w-[130px] px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-white/80 focus:outline-none focus:ring-1 focus:ring-accent/40"
              >
                <option value="">Todos los agentes</option>
                {agentesList.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                ))}
              </select>
            )}
            {isAdmin && responsablesList.length > 0 && (
              <select
                value={filterResponsable}
                onChange={e => setFilterResponsable(e.target.value)}
                className="flex-1 min-w-[130px] px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-white/80 focus:outline-none focus:ring-1 focus:ring-accent/40"
              >
                <option value="">Todos los responsables</option>
                {responsablesList.map(r => (
                  <option key={r.id} value={r.id}>{r.nombre_completo}</option>
                ))}
              </select>
            )}
            <select
              value={filterTipo}
              onChange={e => setFilterTipo(e.target.value)}
              className="flex-1 min-w-[130px] px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-white/80 focus:outline-none focus:ring-1 focus:ring-accent/40"
            >
              <option value="">Todos los tipos</option>
              {tipoOptions.map(tipo => (
                <option key={tipo} value={tipo}>{tipo.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Results count */}
          {!ticketLoading && (
            <p className="text-[11px] text-neutral-400 dark:text-white/30 mb-2 px-0.5">
              {filteredTickets.length} trámite{filteredTickets.length !== 1 ? 's' : ''} encontrado{filteredTickets.length !== 1 ? 's' : ''}
            </p>
          )}

          {/* Error */}
          {addError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 mb-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>
            </div>
          )}

          {/* List */}
          {ticketLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-300" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="w-8 h-8 text-neutral-200 dark:text-neutral-700 mx-auto mb-2" />
              <p className="text-xs text-neutral-400">Sin trámites que coincidan</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '21rem' }}>
              {filteredTickets.map(t => (
                <div
                  key={t.id}
                  className="rounded-xl border border-neutral-100 dark:border-neutral-700 overflow-hidden hover:border-accent/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 bg-neutral-50 dark:bg-neutral-800/60">
                    <span className="text-xs font-bold text-neutral-800 dark:text-white tracking-wide">{t.folio}</span>
                    <div className="flex items-center gap-1.5">
                      {t.estatus_nombre && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-500 dark:text-white/60 font-medium">{t.estatus_nombre}</span>}
                      {t.tipo_tramite && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">{t.tipo_tramite.replace(/_/g, ' ')}</span>}
                    </div>
                  </div>
                  <div className="px-3 pb-2 pt-1">
                    {(t.agente || t.responsable) && (
                      <div className="flex items-center gap-3 mb-1.5">
                        {t.agente && (
                          <span className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-white/40">
                            <User className="w-3 h-3" />
                            {t.agente.nombre_completo}
                          </span>
                        )}
                        {t.responsable && (
                          <span className="flex items-center gap-1 text-[10px] text-neutral-400 dark:text-white/30">
                            <CheckSquare className="w-3 h-3" />
                            {t.responsable.nombre_completo}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-neutral-500 dark:text-white/50 line-clamp-2 leading-relaxed mb-2">{t.instrucciones}</p>
                    <button
                      onClick={() => addToTicket(t.id, t.folio)}
                      disabled={!!addingToTicket}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all disabled:opacity-60"
                    >
                      {addingToTicket === t.id
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Agregando...</>
                        : <><Plus className="w-3.5 h-3.5" /> Agregar a este trámite</>
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </BaseModal>
  );
}
