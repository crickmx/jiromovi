import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Mail, Search, Filter, Send, Phone, Building2, User, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, ChevronLeft, RefreshCw, X, MessageSquare, Zap, Check, ListTodo, Plus, Link2, FileText, Image, Music, Video, Paperclip, UserX, UserPlus, Eye, Download, ExternalLink, Smile, LayoutTemplate as BookTemplate, ClipboardList, Star, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronRight, Globe, Lock, ChevronDown, Bot, Play, Pause, ArrowRightLeft, StopCircle, ChevronUp, Settings, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getDisplayName } from '../lib/utils';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface ConversationSummary {
  agent_user_id: string | null;
  agent_name: string;
  agent_email: string | null;
  agent_phone: string | null;
  agent_office_id: string | null;
  office_name: string | null;
  agent_rol: string;
  agent_activo: boolean;
  last_message_body: string;
  last_message_channel: string;
  last_message_at: string;
  last_message_status: string;
  total_messages: number;
  unread_count: number;
  contact_phone_ext: string | null;
  contact_name_ext: string | null;
  is_external: boolean;
}

interface Message {
  id: string;
  agent_user_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  sender_user_id: string | null;
  sender_type: string;
  channel: string;
  message_type: string;
  direction: string;
  subject: string | null;
  body: string;
  html_body: string | null;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  source_module: string | null;
  source_event: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  attachment_urls?: Array<{ url?: string; type?: string; name?: string }> | null;
  read_at: string | null;
  sender_name?: string;
  attachments?: Attachment[];
  linked_task_id?: string | null;
}

interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  mime_type: string | null;
  file_url: string | null;
  direction: string;
}

interface Oficina {
  id: string;
  nombre: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  channel: string;
  is_active: boolean;
  is_global: boolean;
  created_by: string | null;
  office_id: string | null;
  variables: Array<{ name: string; label: string }>;
  created_at: string;
}

interface QuoteFormTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  form_type: string;
  slug: string | null;
  allowed_roles: string[] | null;
  is_global: boolean;
  is_active: boolean;
}

interface TramiteOption {
  id: string;
  folio: string;
  instrucciones: string;
  prioridad: string;
  tipo_tramite: string;
  estatus_nombre: string;
  agente_nombre: string | null;
  fecha_creacion: string;
}

interface CcAssistant {
  id: string;
  nombre: string;
  descripcion: string;
  source: 'manual' | 'form';
  is_active: boolean;
  is_global: boolean;
  office_id: string | null;
  welcome_message: string;
  consent_message: string;
  completion_message: string;
  transfer_message: string;
  auto_create_tramite: boolean;
  total_sessions: number;
  completed_sessions: number;
}

interface CcSessionFieldData {
  field_key: string;
  field_label: string;
  value: string | null;
  confidence_score: number | null;
  status: 'captured' | 'pending' | 'skipped' | 'low_confidence' | 'prefilled';
  requires_human_review: boolean;
  priority: 'required' | 'recommended' | 'optional';
}

interface CcSessionState {
  session_id: string;
  status: string;
  current_stage: string;
  consent_given: boolean;
  started_at: string;
  messages_received: number;
  assistant_name: string;
  captured_count: number;
  total_fields: number;
  session_data?: CcSessionFieldData[];
  show_field_details?: boolean;
  ticket_id?: string | null;
  folio?: string | null;
  creation_error?: string | null;
}

type ConversationMode = 'normal' | 'automatic';

async function callApi(slug: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { success: false, error: 'Sesion no disponible' };
  const res = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { success: false, error: text }; }
}

export default function CentroContacto() {
  const { usuario } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterOffice, setFilterOffice] = useState<string>('');
  const [filterUnassigned, setFilterUnassigned] = useState(false);

  // Thread filters
  const [threadFilterChannel, setThreadFilterChannel] = useState<string>('');
  const [threadFilterType, setThreadFilterType] = useState<string>('');

  // Composer
  const [composerChannel, setComposerChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [composerMessage, setComposerMessage] = useState('');
  const [composerSubject, setComposerSubject] = useState('');
  const [sending, setSending] = useState(false);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  // Task modals
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showAddToTaskModal, setShowAddToTaskModal] = useState(false);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Attachment preview
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  // Emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Templates modal
  const [showPlantillasModal, setShowPlantillasModal] = useState(false);

  // Formularios modal
  const [showFormulariosModal, setShowFormulariosModal] = useState(false);

  // Automatic mode state
  const [conversationMode, setConversationMode] = useState<ConversationMode>('normal');
  const [activeSession, setActiveSession] = useState<CcSessionState | null>(null);
  const [showStartAutoModal, setShowStartAutoModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [autoModeLoading, setAutoModeLoading] = useState(false);
  const [showFieldDetails, setShowFieldDetails] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const canFilterOffice = isAdmin || isGerente;

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_contact_center_summary', {
        p_user_id: usuario.id,
        p_channel: filterChannel || null,
        p_message_type: filterType || null,
        p_office_id: filterOffice || null,
        p_search: searchQuery || null,
        p_limit: 100,
        p_offset: 0,
      });
      if (!error && data) {
        let filtered = data as ConversationSummary[];
        if (filterUnassigned) {
          filtered = filtered.filter(c => {
            const meta = c as unknown as Record<string, unknown>;
            return meta.agent_activo === false || (c.last_message_status === 'received' && !c.agent_email);
          });
        }
        setConversations(filtered);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [usuario, filterChannel, filterType, filterOffice, searchQuery, filterUnassigned]);

  // Load messages
  const loadMessages = useCallback(async (agentId: string, isExternal?: boolean, contactPhone?: string | null) => {
    setLoadingMessages(true);
    try {
      let query = supabase
        .from('contact_center_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (isExternal && contactPhone) {
        query = query.eq('contact_phone', contactPhone).is('agent_user_id', null);
      } else {
        query = query.eq('agent_user_id', agentId);
      }

      if (threadFilterChannel) query = query.eq('channel', threadFilterChannel);
      if (threadFilterType) query = query.eq('message_type', threadFilterType);

      const { data } = await query.limit(500);

      if (data) {
        const senderIds = [...new Set(data.filter(m => m.sender_user_id).map(m => m.sender_user_id))];
        let senderMap: Record<string, string> = {};
        if (senderIds.length > 0) {
          const { data: senders } = await supabase
            .from('usuarios')
            .select('id, nombre_completo')
            .in('id', senderIds);
          if (senders) senderMap = Object.fromEntries(senders.map(s => [s.id, s.nombre_completo || 'Usuario']));
        }

        // Load attachments for messages
        const msgIds = data.map(m => m.id);
        const { data: attachments } = await supabase
          .from('contact_center_attachments')
          .select('id, message_id, file_name, file_type, mime_type, file_url, direction')
          .in('message_id', msgIds);

        const attachMap: Record<string, Attachment[]> = {};
        if (attachments) {
          for (const att of attachments) {
            if (!attachMap[att.message_id]) attachMap[att.message_id] = [];
            attachMap[att.message_id].push(att);
          }
        }

        // Load task links for messages
        const { data: taskLinks } = await supabase
          .from('task_contact_center_items')
          .select('contact_center_message_id, task_id')
          .in('contact_center_message_id', msgIds)
          .not('task_id', 'is', null);

        const taskLinkMap: Record<string, string> = {};
        if (taskLinks) {
          for (const link of taskLinks) {
            if (link.contact_center_message_id) {
              taskLinkMap[link.contact_center_message_id] = link.task_id;
            }
          }
        }

        setMessages(data.map(m => {
          let atts = attachMap[m.id] || [];
          // Fallback: synthesize from attachment_urls JSONB if no records in attachments table
          if (atts.length === 0 && m.attachment_urls && Array.isArray(m.attachment_urls)) {
            atts = (m.attachment_urls as Array<{ url?: string; type?: string; name?: string }>).filter(a => a.url).map((a, i) => ({
              id: `${m.id}_synth_${i}`,
              file_name: a.name || 'Archivo',
              file_type: a.type || 'document',
              mime_type: null,
              file_url: a.url || null,
              direction: m.direction,
            }));
          }
          // Fallback: use metadata.content_uri for old messages
          if (atts.length === 0 && (m.metadata as Record<string, unknown>)?.content_uri) {
            const meta = m.metadata as Record<string, unknown>;
            const mType = (meta.message_type as string) || 'document';
            atts = [{
              id: `${m.id}_meta`,
              file_name: mType === 'image' ? 'Imagen' : mType === 'video' ? 'Video' : mType === 'audio' ? 'Audio' : 'Archivo',
              file_type: mType === 'sticker' ? 'image' : mType,
              mime_type: null,
              file_url: meta.content_uri as string,
              direction: m.direction,
            }];
          }
          const inboundName = m.contact_name
            || (m.metadata as Record<string, unknown>)?.contact_name as string | null
            || m.contact_phone
            || (m.metadata as Record<string, unknown>)?.sender_phone as string | null
            || 'Cliente';
          return {
            ...m,
            sender_name: m.direction === 'inbound'
              ? inboundName
              : (m.sender_type === 'system' ? 'Sistema' : (m.sender_user_id ? senderMap[m.sender_user_id] || 'Asesor' : 'Asesor')),
            attachments: atts,
            linked_task_id: taskLinkMap[m.id] || null,
          };
        }));

        // Mark messages as read and update local unread count
        if (usuario && !isExternal) {
          await supabase.rpc('mark_contact_messages_read', {
            p_agent_user_id: agentId,
            p_user_id: usuario.id,
          });
        } else if (isExternal && contactPhone) {
          // Mark external contact messages as read directly
          await supabase
            .from('contact_center_messages')
            .update({ read_at: new Date().toISOString(), read_by_user_id: usuario?.id })
            .eq('contact_phone', contactPhone)
            .is('agent_user_id', null)
            .is('read_at', null);
        }
        setConversations(prev =>
          prev.map(c => {
            if (isExternal) return c.contact_phone_ext === contactPhone ? { ...c, unread_count: 0 } : c;
            return c.agent_user_id === agentId ? { ...c, unread_count: 0 } : c;
          })
        );
      }
    } catch { /* silent */ }
    setLoadingMessages(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [threadFilterChannel, threadFilterType, usuario]);

  // Initial load
  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    supabase.from('oficinas').select('id, nombre').order('nombre').then(({ data }) => {
      if (data) setOficinas(data);
    });
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      loadMessages(
        selectedAgent.agent_user_id || '',
        selectedAgent.is_external,
        selectedAgent.contact_phone_ext,
      );
    }
  }, [selectedAgent, loadMessages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('contact-center-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'contact_center_messages',
      }, (payload) => {
        const newMsg = payload.new as Message;
        // Update conversation list
        loadConversations();
        // If we're viewing this agent's thread, add the message
        const msgMatchesSelected = selectedAgent && (
          (selectedAgent.is_external
            ? (newMsg as unknown as Record<string, unknown>).contact_phone === selectedAgent.contact_phone_ext
            : newMsg.agent_user_id === selectedAgent.agent_user_id)
        );
        if (msgMatchesSelected) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            let realtimeAtts: Attachment[] = [];
            const rawPayload = payload.new as Record<string, unknown>;
            if (rawPayload.attachment_urls && Array.isArray(rawPayload.attachment_urls)) {
              realtimeAtts = (rawPayload.attachment_urls as Array<{ url?: string; type?: string; name?: string }>).filter(a => a.url).map((a, i) => ({
                id: `${newMsg.id}_rt_${i}`,
                file_name: a.name || 'Archivo',
                file_type: a.type || 'document',
                mime_type: null,
                file_url: a.url || null,
                direction: newMsg.direction,
              }));
            } else if ((newMsg.metadata as Record<string, unknown>)?.content_uri) {
              const meta = newMsg.metadata as Record<string, unknown>;
              const mType = (meta.message_type as string) || 'document';
              realtimeAtts = [{
                id: `${newMsg.id}_rt_meta`,
                file_name: mType === 'image' ? 'Imagen' : mType === 'video' ? 'Video' : mType === 'audio' ? 'Audio' : 'Archivo',
                file_type: mType === 'sticker' ? 'image' : mType,
                mime_type: null,
                file_url: meta.content_uri as string,
                direction: newMsg.direction,
              }];
            }
            const rtInboundName = newMsg.contact_name
              || (newMsg.metadata as Record<string, unknown>)?.contact_name as string | null
              || newMsg.contact_phone
              || (newMsg.metadata as Record<string, unknown>)?.sender_phone as string | null
              || 'Cliente';
            const enriched: Message = {
              ...newMsg,
              sender_name: newMsg.direction === 'inbound'
                ? rtInboundName
                : 'Asesor',
              attachments: realtimeAtts,
            };
            return [...prev, enriched];
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
          // Mark as read immediately
          if (usuario && newMsg.direction === 'inbound') {
            if (newMsg.agent_user_id) {
              supabase.rpc('mark_contact_messages_read', {
                p_agent_user_id: newMsg.agent_user_id,
                p_user_id: usuario.id,
              });
              setConversations(prev =>
                prev.map(c => c.agent_user_id === newMsg.agent_user_id ? { ...c, unread_count: 0 } : c)
              );
            } else if (newMsg.contact_phone) {
              supabase.from('contact_center_messages')
                .update({ read_at: new Date().toISOString(), read_by_user_id: usuario.id })
                .eq('id', newMsg.id);
              setConversations(prev =>
                prev.map(c => c.contact_phone_ext === newMsg.contact_phone ? { ...c, unread_count: 0 } : c)
              );
            }
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'contact_center_messages',
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, status: updated.status } : m));
        // Refresh conversation list on meaningful inbound status changes
        if (updated.direction === 'inbound') loadConversations();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'contact_center_assistant_sessions',
      }, (payload) => {
        const updated = payload.new as Record<string, unknown>;
        // If this session belongs to the currently viewed agent, refresh mode state
        setActiveSession(prev => {
          if (!prev || prev.session_id !== updated.id) return prev;
          const newStage = (updated.current_stage as string) || prev.current_stage;
          const ticketId = (updated.ticket_id as string | null) ?? prev.ticket_id;
          const creationError = (updated.tramite_creation_error as string | null) ?? prev.creation_error;
          // If tramite just created, fetch folio async then update
          if (ticketId && !prev.folio) {
            supabase.from('tickets').select('folio').eq('id', ticketId).maybeSingle().then(({ data }) => {
              setActiveSession(s => s ? { ...s, folio: data?.folio || null } : s);
            });
          }
          return { ...prev, current_stage: newStage, ticket_id: ticketId, creation_error: creationError };
        });
        // If mode changed to normal (session ended), reload mode
        if (selectedAgent?.agent_user_id && (updated.status === 'completed' || updated.status === 'cancelled' || updated.status === 'transferred')) {
          loadConversationMode(selectedAgent.agent_user_id);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'contact_center_conversation_modes',
      }, (payload) => {
        const updated = payload.new as Record<string, unknown>;
        if (selectedAgent?.agent_user_id && updated.agent_user_id === selectedAgent.agent_user_id) {
          loadConversationMode(selectedAgent.agent_user_id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedAgent, usuario, loadConversations]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const insertEmoji = (emoji: string) => {
    setComposerMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleSelectAgent = (conv: ConversationSummary) => {
    setSelectedAgent(conv);
    setComposerMessage('');
    setComposerSubject('');
    setSelectionMode(false);
    setSelectedMessageIds(new Set());
    // Load conversation mode for registered users only
    if (!conv.is_external && conv.agent_user_id) loadConversationMode(conv.agent_user_id);
  };

  const loadConversationMode = useCallback(async (agentUserId: string) => {
    try {
      const result = await callApi('contact-center-assistant-process', {
        action: 'get_session_state',
        agent_user_id: agentUserId,
      });
      if (result.mode === 'automatic' && result.active_session) {
        setConversationMode('automatic');
        const s = result.active_session;
        const rawData: Array<Record<string, unknown>> = s.contact_center_assistant_session_data || [];
        const sessionData: CcSessionFieldData[] = rawData.map((d) => {
          const val = d.value_text != null ? String(d.value_text) : (d.value != null ? String(d.value) : null);
          const fieldMeta = d.contact_center_assistant_fields as Record<string, unknown> | undefined;
          return {
            field_key: String(d.field_key || ''),
            field_label: String(d.field_label || fieldMeta?.label || d.field_key || ''),
            value: val,
            confidence_score: d.confidence_score != null ? Number(d.confidence_score) : null,
            status: (d.status as CcSessionFieldData['status']) || (val ? 'captured' : 'pending'),
            requires_human_review: Boolean(d.requires_human_review),
            priority: (fieldMeta?.priority as CcSessionFieldData['priority']) || 'optional',
          };
        });
        const capturedCount = sessionData.filter(d => ['captured','prefilled','low_confidence'].includes(d.status)).length;
        // Fetch folio if tramite was created
        let tramiteFolio: string | null = null;
        if (s.ticket_id) {
          const { data: tkt } = await supabase.from('tickets').select('folio').eq('id', s.ticket_id).maybeSingle();
          tramiteFolio = tkt?.folio || null;
        }
        setActiveSession({
          session_id: s.id,
          status: s.status,
          current_stage: s.current_stage,
          consent_given: s.consent_given,
          started_at: s.started_at,
          messages_received: s.messages_received,
          assistant_name: s.contact_center_assistants?.nombre || 'Asistente',
          captured_count: capturedCount,
          total_fields: sessionData.length || 0,
          session_data: sessionData,
          ticket_id: s.ticket_id || null,
          folio: tramiteFolio,
          creation_error: s.tramite_creation_error || null,
        });
      } else {
        setConversationMode('normal');
        setActiveSession(null);
      }
    } catch { /* silent */ }
  }, []);

  const handleActivateAutoMode = async (assistantId: string) => {
    if (!selectedAgent) return;
    setAutoModeLoading(true);
    try {
      const result = await callApi('contact-center-assistant-process', {
        action: 'start_session',
        agent_user_id: selectedAgent.agent_user_id,
        assistant_id: assistantId,
      });
      if (result.ok) {
        setConversationMode('automatic');
        setActiveSession({
          session_id: result.session_id,
          status: 'active',
          current_stage: result.stage || 'welcome',
          consent_given: false,
          started_at: new Date().toISOString(),
          messages_received: 0,
          assistant_name: result.assistant_name || 'Asistente',
          captured_count: 0,
          total_fields: result.total_fields || 0,
          session_data: [],
        });
        setShowStartAutoModal(false);
        // Send welcome message via WhatsApp
        if (result.welcome_message) {
          await callApi('send-contact-whatsapp', {
            ...(selectedAgent.is_external
              ? { contactPhone: selectedAgent.contact_phone_ext }
              : { agentUserId: selectedAgent.agent_user_id }),
            message: result.welcome_message,
          });
          loadMessages(selectedAgent.agent_user_id || '', selectedAgent.is_external, selectedAgent.contact_phone_ext);
        }
      } else {
        alert(result.error || 'No se pudo iniciar el modo automático');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al activar modo automático');
    }
    setAutoModeLoading(false);
  };

  const handleDeactivateAutoMode = async () => {
    if (!activeSession) return;
    setAutoModeLoading(true);
    try {
      await callApi('contact-center-assistant-process', {
        action: 'cancel_session',
        session_id: activeSession.session_id,
      });
      setConversationMode('normal');
      setActiveSession(null);
    } catch { /* silent */ }
    setAutoModeLoading(false);
  };

  const handleTransferSession = async (transferToId?: string, reason?: string) => {
    if (!activeSession) return;
    setAutoModeLoading(true);
    try {
      const result = await callApi('contact-center-assistant-process', {
        action: 'transfer',
        session_id: activeSession.session_id,
        transfer_to: transferToId,
        transfer_reason: reason || 'Transferido por operador',
      });
      if (result.ok) {
        setConversationMode('normal');
        setActiveSession(null);
        setShowTransferModal(false);
        if (result.transfer_message && selectedAgent) {
          await callApi('send-contact-whatsapp', {
            ...(selectedAgent.is_external
              ? { contactPhone: selectedAgent.contact_phone_ext }
              : { agentUserId: selectedAgent.agent_user_id }),
            message: result.transfer_message,
          });
          loadMessages(selectedAgent.agent_user_id || '', selectedAgent.is_external, selectedAgent.contact_phone_ext);
        }
      }
    } catch { /* silent */ }
    setAutoModeLoading(false);
  };

  const handleSend = async () => {
    if (!selectedAgent || sending) return;
    if (composerChannel === 'email' && (!composerSubject.trim() || !composerMessage.trim())) return;
    if (composerChannel === 'whatsapp' && !composerMessage.trim()) return;

    setSending(true);
    try {
      if (composerChannel === 'whatsapp') {
        const result = await callApi('send-contact-whatsapp', {
          ...(selectedAgent.is_external
            ? { contactPhone: selectedAgent.contact_phone_ext }
            : { agentUserId: selectedAgent.agent_user_id }),
          message: composerMessage.trim(),
        });
        if (!result.success) alert(result.error || 'No se pudo enviar el WhatsApp.');
      } else {
        const result = await callApi('send-contact-email', {
          agentUserId: selectedAgent.agent_user_id,
          subject: composerSubject.trim(),
          body: composerMessage.trim(),
        });
        if (!result.success) alert(result.error || 'No se pudo enviar el correo.');
      }
      setComposerMessage('');
      setComposerSubject('');
      loadMessages(selectedAgent.agent_user_id || '', selectedAgent.is_external, selectedAgent.contact_phone_ext);
      loadConversations();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al enviar');
    }
    setSending(false);
  };

  const handleRetry = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || msg.status !== 'failed' || !selectedAgent) return;
    setSending(true);
    try {
      if (msg.channel === 'whatsapp') {
        await callApi('send-contact-whatsapp', {
          ...(selectedAgent.is_external
            ? { contactPhone: selectedAgent.contact_phone_ext }
            : { agentUserId: msg.agent_user_id }),
          message: msg.body,
        });
      } else {
        await callApi('send-contact-email', { agentUserId: msg.agent_user_id, subject: msg.subject || 'Reenvio', body: msg.body });
      }
      loadMessages(selectedAgent.agent_user_id || '', selectedAgent.is_external, selectedAgent.contact_phone_ext);
    } catch { /* silent */ }
    setSending(false);
  };

  const toggleMessageSelection = (msgId: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return d.toLocaleDateString('es-MX', { weekday: 'short' });
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  };

  const formatFullDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const isUnassigned = selectedAgent && selectedAgent.last_message_status === 'received' && !selectedAgent.agent_email;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          {selectedAgent && (
            <button onClick={() => setSelectedAgent(null)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <MessageSquare className="w-5 h-5 text-teal-600" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Centro de Contacto</h1>
          {conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0) > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)}
            </span>
          )}
        </div>
        <button onClick={loadConversations} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className={`w-full lg:w-80 xl:w-96 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-900 ${selectedAgent ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-3 border-b border-gray-100 dark:border-gray-800 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar agente..."
                className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <button onClick={() => setShowFilters(!showFilters)} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${showFilters ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 gap-2">
                <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} className="text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1.5 px-2">
                  <option value="">Todos canales</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="system">Sistema</option>
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1.5 px-2">
                  <option value="">Todo tipo</option>
                  <option value="manual">Manual</option>
                  <option value="automatic">Automatico</option>
                </select>
                {canFilterOffice && (
                  <select value={filterOffice} onChange={e => setFilterOffice(e.target.value)} className="text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1.5 px-2 col-span-2">
                    <option value="">Todas oficinas</option>
                    {oficinas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                )}
                <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={filterUnassigned} onChange={e => setFilterUnassigned(e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  <UserX className="w-3.5 h-3.5" /> No asignados
                </label>
              </div>
            )}
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Sin conversaciones</p>
              </div>
            ) : (
              conversations.map(conv => {
                const convKey = conv.is_external ? `ext_${conv.contact_phone_ext}` : conv.agent_user_id;
                const isSelected = conv.is_external
                  ? selectedAgent?.contact_phone_ext === conv.contact_phone_ext
                  : selectedAgent?.agent_user_id === conv.agent_user_id;
                return (
                <button
                  key={convKey}
                  onClick={() => handleSelectAgent(conv)}
                  className={`w-full text-left p-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isSelected ? 'bg-teal-50 dark:bg-teal-900/20 border-l-2 border-l-teal-500' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative ${conv.is_external ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-teal-400 to-teal-600'}`}>
                      <span className="text-white text-xs font-bold">{conv.agent_name?.charAt(0) || '?'}</span>
                      {(conv.unread_count || 0) > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${(conv.unread_count || 0) > 0 ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>{conv.agent_name}</p>
                        <span className="text-[10px] text-gray-400 shrink-0">{formatTime(conv.last_message_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <ChannelIcon channel={conv.last_message_channel} size={12} />
                        {conv.last_message_status === 'received' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        )}
                        <p className={`text-xs truncate ${(conv.unread_count || 0) > 0 ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>{conv.last_message_body}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {conv.is_external && <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-1.5 py-0.5 rounded">Externo</span>}
                        {conv.office_name && <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{conv.office_name}</span>}
                        <span className="text-[10px] text-gray-400">{conv.total_messages} msgs</span>
                      </div>
                    </div>
                  </div>
                </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center Panel */}
        <div className={`flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 ${!selectedAgent ? 'hidden lg:flex' : 'flex'}`}>
          {!selectedAgent ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecciona un agente para ver la conversacion</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedAgent.is_external ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-teal-400 to-teal-600'}`}>
                    <span className="text-white text-xs font-bold">{selectedAgent.agent_name?.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedAgent.agent_name}</p>
                      {selectedAgent.is_external && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Externo</span>}
                    </div>
                    <p className="text-[11px] text-gray-500">{selectedAgent.agent_email || selectedAgent.agent_phone || selectedAgent.contact_phone_ext || 'Sin datos'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Mode toggle badge */}
                  {conversationMode === 'automatic' && activeSession ? (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <Bot className="w-3 h-3" />
                        <span className="hidden sm:inline">{activeSession.assistant_name}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      </span>
                      <button
                        onClick={() => setShowTransferModal(true)}
                        title="Transferir a humano"
                        className="p-1.5 rounded text-[11px] text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleDeactivateAutoMode}
                        title="Desactivar modo automático"
                        disabled={autoModeLoading}
                        className="p-1.5 rounded text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowStartAutoModal(true)}
                      title="Activar Modo Automático"
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 border border-gray-200 dark:border-gray-700 transition-colors"
                    >
                      <Bot className="w-3 h-3" /> Auto
                    </button>
                  )}
                  {isUnassigned && (isAdmin || isGerente) && (
                    <button onClick={() => setShowAssignModal(true)} className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                      <UserPlus className="w-3 h-3" /> Asignar
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectionMode(!selectionMode); if (selectionMode) cancelSelection(); }}
                    className={`p-1.5 rounded text-[11px] ${selectionMode ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}`}
                    title="Seleccionar mensajes"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <select value={threadFilterChannel} onChange={e => setThreadFilterChannel(e.target.value)} className="text-[11px] rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-1 px-1.5">
                    <option value="">Todos</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="system">Sistema</option>
                  </select>
                  <select value={threadFilterType} onChange={e => setThreadFilterType(e.target.value)} className="text-[11px] rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-1 px-1.5">
                    <option value="">Todo</option>
                    <option value="manual">Manual</option>
                    <option value="automatic">Auto</option>
                  </select>
                  <button onClick={() => setShowAgentPanel(!showAgentPanel)} className="hidden xl:block p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                    <User className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Selection toolbar */}
              {selectionMode && selectedMessageIds.size > 0 && (
                <div className="flex items-center justify-between px-4 py-2 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-200 dark:border-teal-800">
                  <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
                    {selectedMessageIds.size} {selectedMessageIds.size === 1 ? 'mensaje seleccionado' : 'mensajes seleccionados'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowCreateTaskModal(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                      <Plus className="w-3 h-3" /> Crear tramite
                    </button>
                    <button onClick={() => setShowAddToTaskModal(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-gray-800 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors">
                      <Link2 className="w-3 h-3" /> Agregar a tramite
                    </button>
                    <button onClick={cancelSelection} className="p-1.5 rounded hover:bg-teal-100 dark:hover:bg-teal-900/40 text-teal-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Automatic mode panel */}
              {conversationMode === 'automatic' && activeSession && (
                <div className={`border-b ${
                  activeSession.current_stage === 'completion'
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
                    : activeSession.creation_error
                    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                    : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10'
                }`}>

                  {/* Completion banner — tramite created */}
                  {activeSession.current_stage === 'completion' && activeSession.ticket_id && (
                    <div className="px-4 py-2.5 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          Tramite creado — modo automatico desactivado
                        </p>
                        <a
                          href={`/tramites/${activeSession.ticket_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {activeSession.folio ? `Tramite #${activeSession.folio}` : 'Ver tramite'}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Completion banner — no tramite (form without auto_create) */}
                  {activeSession.current_stage === 'completion' && !activeSession.ticket_id && !activeSession.creation_error && (
                    <div className="px-4 py-2 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        Sesion completada — modo automatico desactivado
                      </span>
                    </div>
                  )}

                  {/* Error banner */}
                  {activeSession.creation_error && (
                    <div className="px-4 py-2 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-red-700 dark:text-red-400">Error al crear tramite</p>
                        <p className="text-[10px] text-red-600 dark:text-red-500 mt-0.5 truncate max-w-[260px]">{activeSession.creation_error}</p>
                      </div>
                    </div>
                  )}

                  {/* Active session header */}
                  {activeSession.current_stage !== 'completion' && (
                    <>
                      <div className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Bot className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 truncate max-w-[130px]">
                            {activeSession.assistant_name}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                            activeSession.current_stage === 'welcome'    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                            activeSession.current_stage === 'consent'    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                            activeSession.current_stage === 'capturing'  ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' :
                            activeSession.current_stage === 'summary'    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                            activeSession.current_stage === 'error'      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {activeSession.current_stage === 'welcome'   ? 'Bienvenida' :
                             activeSession.current_stage === 'consent'   ? 'Consentimiento' :
                             activeSession.current_stage === 'capturing' ? 'Capturando' :
                             activeSession.current_stage === 'summary'   ? 'Confirmando' :
                             activeSession.current_stage === 'error'     ? 'Error' :
                             activeSession.current_stage}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {activeSession.total_fields > 0 && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              {activeSession.captured_count}/{activeSession.total_fields}
                            </span>
                          )}
                          {(activeSession.session_data?.length ?? 0) > 0 && (
                            <button
                              onClick={() => setShowFieldDetails(v => !v)}
                              className="p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-800 text-emerald-600 dark:text-emerald-400 transition-colors"
                              title={showFieldDetails ? 'Ocultar campos' : 'Ver campos capturados'}
                            >
                              {showFieldDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      {activeSession.total_fields > 0 && (
                        <div className="px-4 pb-2">
                          <div className="w-full h-1.5 bg-emerald-200 dark:bg-emerald-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.round((activeSession.captured_count / activeSession.total_fields) * 100)}%`,
                                background: activeSession.session_data?.some(d => d.requires_human_review) ? '#f59e0b' : '#10b981',
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Field details panel */}
                  {showFieldDetails && (activeSession.session_data?.length ?? 0) > 0 && (
                    <div className="px-4 pb-2.5 space-y-1 max-h-48 overflow-y-auto">
                      {activeSession.session_data!.map((field) => (
                        <div
                          key={field.field_key}
                          className={`flex items-start gap-2 py-1 px-2 rounded-md text-[11px] ${
                            field.status === 'prefilled'
                              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800'
                              : field.requires_human_review
                              ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800'
                              : field.status === 'captured' || field.status === 'low_confidence'
                              ? 'bg-white dark:bg-gray-800 border border-emerald-100 dark:border-emerald-800'
                              : field.status === 'skipped'
                              ? 'bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700'
                              : 'bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {field.status === 'prefilled' ? (
                              <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center">
                                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                              </div>
                            ) : field.requires_human_review ? (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                            ) : field.status === 'captured' || field.status === 'low_confidence' ? (
                              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            ) : field.status === 'skipped' ? (
                              <div className="w-3.5 h-3.5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                                <X className="w-2 h-2 text-white" />
                              </div>
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-600 dark:text-gray-300 truncate">{field.field_label}</span>
                              {field.priority === 'required' && (
                                <span className="text-[9px] text-red-500 font-semibold uppercase">req</span>
                              )}
                              {field.status === 'prefilled' && (
                                <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1 rounded">WA</span>
                              )}
                              {field.confidence_score != null && field.confidence_score < 0.7 && field.value && (
                                <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 px-1 rounded">
                                  {Math.round(field.confidence_score * 100)}%
                                </span>
                              )}
                            </div>
                            {field.value ? (
                              <span className="text-gray-800 dark:text-gray-200 truncate block">{field.value}</span>
                            ) : field.status === 'skipped' ? (
                              <span className="text-gray-400 italic">omitido</span>
                            ) : (
                              <span className="text-gray-400 italic">pendiente</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {activeSession.session_data!.some(d => d.requires_human_review) && (
                        <div className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-400">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span>Algunos campos requieren revision manual</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {loadingMessages ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">Sin mensajes</div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isAdmin={isAdmin}
                      onRetry={handleRetry}
                      formatDate={formatFullDate}
                      selectionMode={selectionMode}
                      isSelected={selectedMessageIds.has(msg.id)}
                      onToggleSelect={() => toggleMessageSelection(msg.id)}
                      linkedTaskId={msg.linked_task_id}
                      onPreviewAttachment={setPreviewAttachment}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setComposerChannel('whatsapp')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${composerChannel === 'whatsapp' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                  <button
                    onClick={() => setComposerChannel('email')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${composerChannel === 'email' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                  >
                    <Mail className="w-3.5 h-3.5" /> Correo
                  </button>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => { setShowPlantillasModal(true); setShowEmojiPicker(false); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
                      title="Plantillas de mensaje"
                    >
                      <BookTemplate className="w-3.5 h-3.5" /> Plantillas
                    </button>
                    <button
                      onClick={() => { setShowFormulariosModal(true); setShowEmojiPicker(false); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
                      title="Compartir formulario de cotizacion"
                    >
                      <ClipboardList className="w-3.5 h-3.5" /> Formularios
                    </button>
                  </div>
                </div>

                {composerChannel === 'email' && (
                  <input
                    type="text"
                    value={composerSubject}
                    onChange={e => setComposerSubject(e.target.value)}
                    placeholder="Asunto del correo..."
                    className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                )}

                <div className="flex items-end gap-2">
                  {composerChannel === 'whatsapp' && (
                    <div className="relative" ref={emojiPickerRef}>
                      <button
                        onClick={() => setShowEmojiPicker(p => !p)}
                        className={`p-2 rounded-lg border transition-colors ${showEmojiPicker ? 'border-teal-400 text-teal-600 bg-teal-50 dark:bg-teal-900/20' : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        title="Emojis"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                      {showEmojiPicker && <EmojiPickerPanel onSelect={insertEmoji} />}
                    </div>
                  )}
                  <textarea
                    value={composerMessage}
                    onChange={e => setComposerMessage(e.target.value)}
                    placeholder={composerChannel === 'whatsapp' ? 'Escribe un mensaje...' : 'Cuerpo del correo...'}
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-teal-500"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && composerChannel === 'whatsapp') { e.preventDefault(); handleSend(); } }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !composerMessage.trim() || (composerChannel === 'email' && !composerSubject.trim())}
                    className="p-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                {composerChannel === 'whatsapp' && (
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-gray-400">Enter para enviar, Shift+Enter para nueva linea.</p>
                    <p className={`text-[10px] ${composerMessage.length > 500 ? 'text-red-500' : 'text-gray-400'}`}>{composerMessage.length}/550</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Panel */}
        {selectedAgent && showAgentPanel && (
          <div className="hidden xl:flex w-72 flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase">Ficha del Agente</h3>
                <button onClick={() => setShowAgentPanel(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mb-3">
                <span className="text-white text-lg font-bold">{selectedAgent.agent_name?.charAt(0)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white text-center">{selectedAgent.agent_name}</p>
              <p className="text-xs text-gray-500 text-center mt-0.5">{selectedAgent.agent_rol}</p>
            </div>
            <div className="p-4 space-y-3">
              <InfoRow icon={Mail} label="Correo" value={selectedAgent.agent_email || 'Sin correo'} />
              <InfoRow icon={Phone} label="Telefono" value={selectedAgent.agent_phone || 'Sin telefono'} />
              <InfoRow icon={Building2} label="Oficina" value={selectedAgent.office_name || 'Sin asignar'} />
              <InfoRow icon={MessageSquare} label="Total mensajes" value={String(selectedAgent.total_messages)} />
              <InfoRow icon={Eye} label="No leidos" value={String(selectedAgent.unread_count || 0)} />
              <InfoRow icon={Clock} label="Ultimo contacto" value={selectedAgent.last_message_at ? formatTime(selectedAgent.last_message_at) : 'Nunca'} />
              <div className="pt-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${selectedAgent.agent_activo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedAgent.agent_activo ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {selectedAgent.agent_activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateTaskModal && selectedAgent && (
        <CreateTaskModal
          agentUserId={selectedAgent.agent_user_id}
          agentName={selectedAgent.agent_name}
          selectedMessages={messages.filter(m => selectedMessageIds.has(m.id))}
          onClose={() => setShowCreateTaskModal(false)}
          onSuccess={() => { setShowCreateTaskModal(false); cancelSelection(); }}
        />
      )}

      {/* Add to Task Modal */}
      {showAddToTaskModal && selectedAgent && (
        <AddToTaskModal
          agentUserId={selectedAgent.agent_user_id}
          agentName={selectedAgent.agent_name}
          selectedMessages={messages.filter(m => selectedMessageIds.has(m.id))}
          onClose={() => setShowAddToTaskModal(false)}
          onSuccess={() => { setShowAddToTaskModal(false); cancelSelection(); }}
        />
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedAgent && (
        <AssignConversationModal
          currentAgentId={selectedAgent.agent_user_id}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => { setShowAssignModal(false); loadConversations(); }}
        />
      )}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}

      {showPlantillasModal && selectedAgent && (
        <PlantillasModal
          channel={composerChannel}
          agentName={selectedAgent.agent_name}
          contactName={selectedAgent.agent_name}
          onInsert={(text) => { setComposerMessage(text); setShowPlantillasModal(false); }}
          onClose={() => setShowPlantillasModal(false)}
        />
      )}

      {showFormulariosModal && selectedAgent && (
        <FormulariosModal
          agentName={selectedAgent.agent_name}
          onInsert={(text) => { setComposerMessage(text); setShowFormulariosModal(false); }}
          onClose={() => setShowFormulariosModal(false)}
        />
      )}

      {/* Start Auto Mode Modal */}
      {showStartAutoModal && selectedAgent && (
        <StartAutoModeModal
          agentName={selectedAgent.agent_name}
          officeId={selectedAgent.agent_office_id}
          onStart={handleActivateAutoMode}
          onClose={() => setShowStartAutoModal(false)}
          loading={autoModeLoading}
        />
      )}

      {/* Transfer Modal */}
      {showTransferModal && activeSession && (
        <TransferSessionModal
          sessionId={activeSession.session_id}
          onTransfer={handleTransferSession}
          onClose={() => setShowTransferModal(false)}
          loading={autoModeLoading}
        />
      )}
    </div>
  );
}

// ============================================================
// MessageBubble Component
// ============================================================

function MessageBubble({ message, isAdmin, onRetry, formatDate, selectionMode, isSelected, onToggleSelect, linkedTaskId, onPreviewAttachment }: {
  message: Message; isAdmin: boolean; onRetry: (id: string) => void; formatDate: (s: string) => string;
  selectionMode: boolean; isSelected: boolean; onToggleSelect: () => void; linkedTaskId?: string | null;
  onPreviewAttachment?: (att: Attachment) => void;
}) {
  const isInbound = message.direction === 'inbound';
  const isSystem = message.sender_type === 'system' && !isInbound;
  const isFailed = message.status === 'failed';

  const align = isInbound ? 'items-start' : (isSystem ? 'items-center' : 'items-end');

  return (
    <div className={`flex flex-col ${align} group`}>
      <div className={`flex items-start gap-2 ${isInbound ? '' : 'flex-row-reverse'}`}>
        {selectionMode && (
          <button onClick={onToggleSelect} className={`mt-2 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-300 dark:border-gray-600 hover:border-teal-500'}`}>
            {isSelected && <Check className="w-3 h-3" />}
          </button>
        )}

        {isSystem && !isInbound ? (
          <div className="max-w-[85%] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">{message.source_module || 'Sistema'} - {message.source_event || 'automatico'}</span>
              <ChannelIcon channel={message.channel} size={11} />
            </div>
            {message.subject && <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">{message.subject}</p>}
            <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{message.body}</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-gray-400">{formatDate(message.created_at)}</span>
              <StatusBadge status={message.status} />
            </div>
          </div>
        ) : isInbound ? (
          <div className={`max-w-[75%] rounded-xl rounded-tl-sm px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm ${isSelected ? 'ring-2 ring-teal-500' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <ChannelIcon channel={message.channel} size={12} />
              <span className="text-[10px] font-medium text-green-600 dark:text-green-400">{message.sender_name}</span>
              <span className="text-[9px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1 py-0.5 rounded">Recibido</span>
              {linkedTaskId && (
                <span className="text-[9px] bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-1 py-0.5 rounded flex items-center gap-0.5">
                  <ListTodo className="w-2.5 h-2.5" /> Vinculado
                </span>
              )}
            </div>
            {message.subject && <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">{message.subject}</p>}
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{message.body}</p>
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.attachments.map(att => (
                  <AttachmentChip key={att.id} attachment={att} onPreview={onPreviewAttachment} />
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-gray-400">{formatDate(message.created_at)}</span>
            </div>
          </div>
        ) : (
          <div className={`max-w-[75%] rounded-xl rounded-tr-sm px-3.5 py-2.5 ${isFailed ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800'} ${isSelected ? 'ring-2 ring-teal-500' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <ChannelIcon channel={message.channel} size={12} />
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{message.sender_name}</span>
              {message.message_type === 'automatic' && <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded">Auto</span>}
              {linkedTaskId && (
                <span className="text-[9px] bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-1 py-0.5 rounded flex items-center gap-0.5">
                  <ListTodo className="w-2.5 h-2.5" /> Vinculado
                </span>
              )}
            </div>
            {message.subject && <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">{message.subject}</p>}
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{message.body}</p>
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.attachments.map(att => (
                  <AttachmentChip key={att.id} attachment={att} onPreview={onPreviewAttachment} />
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-2 gap-3">
              <span className="text-[10px] text-gray-400">{formatDate(message.created_at)}</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={message.status} />
                {isFailed && (
                  <button onClick={() => onRetry(message.id)} className="text-[10px] text-red-600 hover:text-red-700 font-medium flex items-center gap-0.5">
                    <RefreshCw className="w-3 h-3" /> Reintentar
                  </button>
                )}
              </div>
            </div>
            {isFailed && isAdmin && message.error_message && (
              <p className="mt-1.5 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/10 rounded px-2 py-1">{message.error_message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// AttachmentChip
// ============================================================

function AttachmentChip({ attachment, onPreview }: { attachment: Attachment; onPreview?: (att: Attachment) => void }) {
  const iconMap: Record<string, typeof FileText> = { image: Image, audio: Music, video: Video, document: FileText };
  const Icon = iconMap[attachment.file_type] || Paperclip;
  const isImage = attachment.file_type === 'image';
  const isVideo = attachment.file_type === 'video';
  const isAudio = attachment.file_type === 'audio';

  if (isImage && attachment.file_url) {
    return (
      <div className="mt-1">
        <div
          className="relative group cursor-pointer rounded-lg overflow-hidden max-w-[220px] border border-gray-200 dark:border-gray-700"
          onClick={() => onPreview?.(attachment)}
        >
          <img
            src={attachment.file_url}
            alt={attachment.file_name}
            className="w-full max-h-[180px] object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[220px]">{attachment.file_name}</p>
      </div>
    );
  }

  if (isAudio && attachment.file_url) {
    return (
      <div className="mt-1 max-w-[250px]">
        <audio controls className="w-full h-8" preload="none">
          <source src={attachment.file_url} type={attachment.mime_type || 'audio/ogg'} />
        </audio>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{attachment.file_name}</p>
      </div>
    );
  }

  if (isVideo && attachment.file_url) {
    return (
      <div className="mt-1">
        <div
          className="relative group cursor-pointer rounded-lg overflow-hidden max-w-[220px] border border-gray-200 dark:border-gray-700 bg-black"
          onClick={() => onPreview?.(attachment)}
        >
          <video className="w-full max-h-[150px] object-cover" preload="metadata">
            <source src={attachment.file_url} type={attachment.mime_type || 'video/mp4'} />
          </video>
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
              <Video className="w-5 h-5 text-gray-800" />
            </div>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[220px]">{attachment.file_name}</p>
      </div>
    );
  }

  return (
    <button
      onClick={() => onPreview?.(attachment)}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group cursor-pointer"
    >
      <Icon className="w-4 h-4 text-gray-500 shrink-0" />
      <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate max-w-[150px]">{attachment.file_name}</span>
      <Eye className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

function AttachmentPreviewModal({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const isImage = attachment.file_type === 'image';
  const isVideo = attachment.file_type === 'video';
  const isDocument = attachment.file_type === 'document' || (!isImage && !isVideo && attachment.file_type !== 'audio');
  const isPdf = isDocument && (
    attachment.mime_type?.includes('pdf') ||
    attachment.file_name?.toLowerCase().endsWith('.pdf') ||
    attachment.file_url?.toLowerCase().includes('.pdf')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={`relative ${isDocument ? 'w-[90vw] h-[90vh] max-w-4xl' : 'max-w-[90vw] max-h-[90vh]'} flex flex-col`} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center z-10 hover:bg-gray-100 dark:hover:bg-gray-700">
          <X className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        {isImage && (
          <img
            src={attachment.file_url || ''}
            alt={attachment.file_name}
            className="max-w-[85vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
          />
        )}
        {isVideo && (
          <video controls autoPlay className="max-w-[85vw] max-h-[80vh] rounded-lg shadow-2xl">
            <source src={attachment.file_url || ''} type={attachment.mime_type || 'video/mp4'} />
          </video>
        )}
        {isDocument && isPdf && (
          <div className="flex-1 rounded-lg overflow-hidden shadow-2xl bg-white">
            <iframe
              src={attachment.file_url || ''}
              className="w-full h-full"
              title={attachment.file_name}
            />
          </div>
        )}
        {isDocument && !isPdf && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-8">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-gray-800 dark:text-gray-200">{attachment.file_name}</p>
              {attachment.mime_type && (
                <p className="text-sm text-gray-500 mt-1">{attachment.mime_type}</p>
              )}
              <p className="text-sm text-gray-400 mt-3">Vista previa no disponible para este tipo de archivo</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={attachment.file_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" /> Descargar
              </a>
              <a
                href={attachment.file_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Abrir en nueva ventana
              </a>
            </div>
          </div>
        )}
        <div className="flex items-center justify-center gap-3 mt-3">
          <span className="text-sm text-white/80">{attachment.file_name}</span>
          <a
            href={attachment.file_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs rounded-md transition-colors"
          >
            <Download className="w-3 h-3" /> Descargar
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Create Task Modal
// ============================================================

function CreateTaskModal({ agentUserId, agentName, selectedMessages, onClose, onSuccess }: {
  agentUserId: string; agentName: string; selectedMessages: Message[];
  onClose: () => void; onSuccess: () => void;
}) {
  const { usuario } = useAuth();
  const [instrucciones, setInstrucciones] = useState(() => {
    const header = `Informacion agregada desde Centro de Contacto:\nAgente: ${agentName}\nCanal: WhatsApp\nFecha de captura: ${new Date().toLocaleString('es-MX')}\n\nMensajes seleccionados:\n`;
    const msgs = selectedMessages.map((m, i) =>
      `${i + 1}. [${new Date(m.created_at).toLocaleString('es-MX')}] ${m.direction === 'inbound' ? agentName : (m.sender_name || 'Usuario')}:\n${m.body}`
    ).join('\n\n');
    return header + msgs;
  });
  const [tipoTramite, setTipoTramite] = useState('cotizacion_emision');
  const [prioridad, setPrioridad] = useState('Media');
  const [saving, setSaving] = useState(false);

  const isAgent = usuario?.rol === 'Agente';
  const COMMERCIAL_TYPES = ['renovaciones', 'cobranza', 'otros_comercial'];
  const isCommercialType = COMMERCIAL_TYPES.includes(tipoTramite);

  const tipoOptions = [
    { value: 'cotizacion_emision', label: 'Cotizacion / Emision' },
    { value: 'renovaciones', label: 'Renovaciones' },
    { value: 'cobranza', label: 'Cobranza' },
    { value: 'otros_comercial', label: 'Otros (Comercial)' },
  ].filter(t => !isAgent || !COMMERCIAL_TYPES.includes(t.value));

  const handleSave = async () => {
    if (!instrucciones.trim()) return;
    setSaving(true);
    const allAtts = selectedMessages.flatMap(m => m.attachments || []);
    const realAttIds = allAtts.filter(a => !a.id.includes('_synth_') && !a.id.includes('_meta') && !a.id.includes('_rt_')).map(a => a.id);
    const directAtts = allAtts.filter(a => (a.id.includes('_synth_') || a.id.includes('_meta') || a.id.includes('_rt_')) && a.file_url)
      .map(a => ({ file_name: a.file_name, file_url: a.file_url!, file_type: a.file_type, mime_type: a.mime_type }));

    const result = await callApi('create-task-from-contact-messages', {
      agentUserId,
      messageIds: selectedMessages.map(m => m.id),
      attachmentIds: realAttIds,
      directAttachments: directAtts,
      task: {
        instrucciones: instrucciones.trim(),
        tipo_tramite: tipoTramite,
        prioridad,
        is_commercial: isCommercialType,
      },
    });
    setSaving(false);
    if (result.success) {
      alert(`Tramite ${result.folio || ''} creado correctamente con los mensajes seleccionados.`);
      onSuccess();
    } else {
      alert(result.error || 'Error al crear el tramite');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Crear tramite desde mensajes</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">{selectedMessages.length} mensaje(s) de {agentName}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Tipo de tramite</label>
              <select value={tipoTramite} onChange={e => setTipoTramite(e.target.value)} className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 px-3">
                {tipoOptions.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Prioridad</label>
              <select value={prioridad} onChange={e => setPrioridad(e.target.value)} className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 px-3">
                <option>Alta</option><option>Media</option><option>Baja</option>
              </select>
            </div>
          </div>
          {isCommercialType && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
              <AlertCircle className="w-4 h-4 text-sky-600 flex-shrink-0" />
              <p className="text-xs text-sky-700 dark:text-sky-300">
                Este tramite se te asignara automaticamente y se vinculara al agente <span className="font-medium">{agentName}</span>.
              </p>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Instrucciones</label>
            <textarea value={instrucciones} onChange={e => setInstrucciones(e.target.value)} rows={8} className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 px-3 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !instrucciones.trim()} className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 font-medium">
            {saving ? 'Creando...' : 'Crear tramite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Add to Task Modal
// ============================================================

function AddToTaskModal({ agentUserId, agentName, selectedMessages, onClose, onSuccess }: {
  agentUserId: string; agentName: string; selectedMessages: Message[];
  onClose: () => void; onSuccess: () => void;
}) {
  const { usuario } = useAuth();
  const [tramites, setTramites] = useState<TramiteOption[]>([]);
  const [loadingTramites, setLoadingTramites] = useState(true);
  const [searchTramite, setSearchTramite] = useState('');
  const [selectedTramiteId, setSelectedTramiteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!usuario) return;
      setLoadingTramites(true);
      const result = await callApi('get-agent-open-tickets', { agentUserId });
      if (result.success && result.tickets) {
        setTramites((result.tickets as Record<string, unknown>[]).map((t) => ({
          id: t.id as string,
          folio: (t.folio as string) || '',
          instrucciones: (t.instrucciones as string) || '',
          prioridad: (t.prioridad as string) || 'Media',
          tipo_tramite: (t.tipo_tramite as string) || '',
          estatus_nombre: (t.estatus_nombre as string) || '',
          agente_nombre: agentName,
          fecha_creacion: t.fecha_creacion as string,
        })));
      }
      setLoadingTramites(false);
    })();
  }, [usuario, agentUserId, agentName]);

  const filteredTramites = tramites.filter(t =>
    !searchTramite ||
    t.folio.toLowerCase().includes(searchTramite.toLowerCase()) ||
    t.instrucciones.toLowerCase().includes(searchTramite.toLowerCase()) ||
    (t.agente_nombre || '').toLowerCase().includes(searchTramite.toLowerCase())
  );

  const handleAdd = async () => {
    if (!selectedTramiteId) return;
    setSaving(true);
    const commentText = `Informacion agregada desde Centro de Contacto:\nAgente: ${agentName}\nCanal: WhatsApp\nAgregado por: ${getDisplayName(usuario) || 'Usuario'}\nFecha: ${new Date().toLocaleString('es-MX')}\n\nMensajes seleccionados:\n` +
      selectedMessages.map((m, i) =>
        `${i + 1}. [${new Date(m.created_at).toLocaleString('es-MX')}] ${m.direction === 'inbound' ? agentName : (m.sender_name || 'Usuario')}:\n${m.body}`
      ).join('\n\n');

    const allAtts = selectedMessages.flatMap(m => m.attachments || []);
    const realAttIds = allAtts.filter(a => !a.id.includes('_synth_') && !a.id.includes('_meta') && !a.id.includes('_rt_')).map(a => a.id);
    const directAtts = allAtts.filter(a => (a.id.includes('_synth_') || a.id.includes('_meta') || a.id.includes('_rt_')) && a.file_url)
      .map(a => ({ file_name: a.file_name, file_url: a.file_url!, file_type: a.file_type, mime_type: a.mime_type }));

    const result = await callApi('add-contact-messages-to-task', {
      agentUserId,
      ticketId: selectedTramiteId,
      messageIds: selectedMessages.map(m => m.id),
      attachmentIds: realAttIds,
      directAttachments: directAtts,
      commentText,
    });
    setSaving(false);
    if (result.success) {
      alert('Mensajes agregados correctamente al tramite.');
      onSuccess();
    } else {
      alert(result.error || 'Error al agregar mensajes');
    }
  };

  const estatusColor = (estatus: string) => {
    if (estatus === 'Iniciado') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    if (estatus === 'En proceso') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Agregar a tramite existente</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">{selectedMessages.length} mensaje(s) de {agentName}</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTramite}
              onChange={e => setSearchTramite(e.target.value)}
              placeholder="Buscar por folio, instrucciones o agente..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
            />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
            {loadingTramites ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
            ) : filteredTramites.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No se encontraron tramites abiertos</p>
            ) : (
              filteredTramites.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTramiteId(t.id)}
                  className={`w-full text-left p-2.5 rounded-lg transition-colors ${selectedTramiteId === t.id ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-300 dark:border-teal-700' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-teal-700 dark:text-teal-400">{t.folio}</span>
                    {t.agente_nombre && <span className="text-[10px] text-gray-500 dark:text-gray-400">- {t.agente_nombre}</span>}
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 mt-0.5">{t.instrucciones}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${estatusColor(t.estatus_nombre)}`}>{t.estatus_nombre}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.prioridad === 'Alta' ? 'bg-red-100 text-red-700' : t.prioridad === 'Media' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{t.prioridad}</span>
                    <span className="text-[10px] text-gray-400">{new Date(t.fecha_creacion).toLocaleDateString('es-MX')}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Cancelar</button>
          <button onClick={handleAdd} disabled={saving || !selectedTramiteId} className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 font-medium">
            {saving ? 'Agregando...' : 'Agregar a tramite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Assign Conversation Modal
// ============================================================

function AssignConversationModal({ currentAgentId, onClose, onSuccess }: {
  currentAgentId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [users, setUsers] = useState<{ id: string; nombre_completo: string; rol: string }[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { usuario } = useAuth();

  useEffect(() => {
    supabase.from('usuarios').select('id, nombre_completo, rol').eq('activo', true).neq('id', currentAgentId).order('nombre_completo').then(({ data }) => {
      if (data) setUsers(data);
    });
  }, [currentAgentId]);

  const filtered = users.filter(u => !search || u.nombre_completo?.toLowerCase().includes(search.toLowerCase()));

  const handleAssign = async () => {
    if (!selectedUserId || !usuario) return;
    setSaving(true);
    const { error } = await supabase.rpc('assign_unassigned_conversation', {
      p_old_agent_id: currentAgentId,
      p_new_agent_id: selectedUserId,
      p_assigned_by: usuario.id,
    });
    setSaving(false);
    if (!error) {
      alert('Conversacion asignada correctamente.');
      onSuccess();
    } else {
      alert('Error: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Asignar conversacion</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar agente..." className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800" />
          <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
            {filtered.slice(0, 30).map(u => (
              <button key={u.id} onClick={() => setSelectedUserId(u.id)} className={`w-full text-left p-2 rounded-lg text-sm ${selectedUserId === u.id ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'}`}>
                <span className="text-gray-800 dark:text-gray-200">{u.nombre_completo}</span>
                <span className="text-[10px] text-gray-400 ml-2">{u.rol}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Cancelar</button>
          <button onClick={handleAssign} disabled={saving || !selectedUserId} className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 font-medium">
            {saving ? 'Asignando...' : 'Asignar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Start Auto Mode Modal
// ============================================================

function StartAutoModeModal({ agentName, officeId, onStart, onClose, loading }: {
  agentName: string;
  officeId: string | null;
  onStart: (assistantId: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [assistants, setAssistants] = useState<CcAssistant[]>([]);
  const [loadingAssistants, setLoadingAssistants] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoadingAssistants(true);
      const { data } = await supabase
        .from('contact_center_assistants')
        .select('*')
        .eq('is_active', true)
        .or(`is_global.eq.true${officeId ? `,office_id.eq.${officeId}` : ''}`)
        .order('nombre');
      setAssistants((data || []) as CcAssistant[]);
      setLoadingAssistants(false);
    })();
  }, [officeId]);

  const filtered = assistants.filter(a =>
    !search || a.nombre.toLowerCase().includes(search.toLowerCase()) || a.descripcion?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Modo Automático</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Selecciona un asistente para {agentName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar asistente..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2">
            {loadingAssistants ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {assistants.length === 0
                    ? 'No hay asistentes configurados. Crea uno en Configuración.'
                    : 'Sin resultados para tu búsqueda'}
                </p>
              </div>
            ) : (
              filtered.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                    selectedId === a.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${a.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{a.nombre}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {a.source === 'form' && (
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">Formulario</span>
                      )}
                      {a.is_global && (
                        <Globe className="w-3 h-3 text-gray-400" />
                      )}
                    </div>
                  </div>
                  {a.descripcion && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 pl-4">{a.descripcion}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 pl-4">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> {a.total_sessions || 0} sesiones
                    </span>
                    {a.auto_create_tramite && (
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Crea trámite
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => selectedId && onStart(selectedId)}
            disabled={!selectedId || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Iniciar modo automático
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Transfer Session Modal
// ============================================================

function TransferSessionModal({ sessionId: _sessionId, onTransfer, onClose, loading }: {
  sessionId: string;
  onTransfer: (transferToId?: string, reason?: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  const [users, setUsers] = useState<{ id: string; nombre_completo: string; rol: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('usuarios')
      .select('id, nombre_completo, rol')
      .eq('activo', true)
      .in('rol', ['Administrador', 'Gerente', 'Empleado', 'Ejecutivo'])
      .order('nombre_completo')
      .then(({ data }) => {
        if (data) setUsers(data);
      });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Transferir a agente</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">El asistente dejará de gestionar la conversación</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Motivo de transferencia</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ej: El cliente requiere atención personalizada..."
              rows={3}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Asignar a (opcional)</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              <button
                onClick={() => setSelectedUserId(null)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${!selectedUserId ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
              >
                Sin asignación específica
              </button>
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedUserId === u.id ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                >
                  {u.nombre_completo}
                  <span className="text-[10px] text-gray-400 ml-1.5">{u.rol}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onTransfer(selectedUserId || undefined, reason || undefined)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            Transferir
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helper Components
// ============================================================

function ChannelIcon({ channel, size = 14 }: { channel: string; size?: number }) {
  if (channel === 'whatsapp') return <MessageCircle style={{ width: size, height: size }} className="text-green-500" />;
  if (channel === 'email') return <Mail style={{ width: size, height: size }} className="text-blue-500" />;
  return <Zap style={{ width: size, height: size }} className="text-amber-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
    sent: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Enviado' },
    delivered: { icon: CheckCircle2, color: 'text-blue-500', label: 'Entregado' },
    read: { icon: CheckCircle2, color: 'text-teal-500', label: 'Leido' },
    received: { icon: CheckCircle2, color: 'text-green-500', label: 'Recibido' },
    pending: { icon: Clock, color: 'text-gray-400', label: 'Pendiente' },
    failed: { icon: XCircle, color: 'text-red-500', label: 'Error' },
    cancelled: { icon: AlertCircle, color: 'text-gray-400', label: 'Cancelado' },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return <span className={`flex items-center gap-0.5 text-[10px] ${c.color}`}><Icon className="w-3 h-3" /> {c.label}</span>;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-gray-400 uppercase">{label}</p>
        <p className="text-xs text-gray-700 dark:text-gray-300 break-all">{value}</p>
      </div>
    </div>
  );
}

// ============================================================
// Emoji Picker Panel
// ============================================================

const EMOJI_CATEGORIES = [
  {
    label: 'Caras', emojis: [
      '😊', '😄', '😃', '😁', '🙂', '😉', '😍', '🥰', '😘', '😎',
      '🤗', '🤔', '😮', '😯', '🥳', '🎉', '👍', '🙌', '💪', '🤝',
      '❤️', '💙', '💚', '💛', '🧡', '🔥', '⭐', '✅', '✔️', '💯',
    ],
  },
  {
    label: 'Seguros', emojis: [
      '🛡️', '📋', '📄', '📝', '🖊️', '💼', '🏠', '🚗', '✈️', '🏥',
      '💊', '💰', '💵', '📊', '📈', '🔒', '🗓️', '📅', '⏰', '🕐',
      '📞', '📱', '💬', '📧', '🔔', '📣', '🎯', '🤓', '👔', '🏢',
    ],
  },
];

function EmojiPickerPanel({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
      <div className="flex border-b border-gray-100 dark:border-gray-800">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            onClick={() => setActiveCategory(i)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${activeCategory === i ? 'text-teal-600 border-b-2 border-teal-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div className="p-2 grid grid-cols-10 gap-0.5 max-h-32 overflow-y-auto">
        {EMOJI_CATEGORIES[activeCategory].emojis.map(emoji => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="text-lg p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors leading-none"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Plantillas Modal
// ============================================================

// Variables that are filled automatically — never shown as manual inputs
const AUTO_VARS = new Set(['nombre_agente', 'nombre_contacto', 'fecha']);

// All known variable tokens with descriptions
const VARIABLE_TOKENS = [
  { token: '{{nombre_contacto}}', label: 'Nombre del contacto', auto: true },
  { token: '{{nombre_agente}}',   label: 'Tu nombre',           auto: true },
  { token: '{{fecha}}',           label: 'Fecha de hoy',        auto: true },
  { token: '{{link_formulario}}', label: 'Link de formulario',  auto: false },
  { token: '{{nombre_formulario}}', label: 'Nombre formulario', auto: false },
  { token: '{{numero_poliza}}',   label: 'No. de póliza',       auto: false },
  { token: '{{aseguradora}}',     label: 'Aseguradora',         auto: false },
  { token: '{{monto}}',           label: 'Monto',               auto: false },
];

const PRESET_CATEGORIES = ['General', 'Bienvenida', 'Seguimiento', 'Documentos', 'Renovacion', 'Formularios', 'Cobranza', 'Siniestros'];

function PlantillasModal({ channel, agentName, contactName, onInsert, onClose }: {
  channel: 'whatsapp' | 'email';
  agentName: string;
  contactName?: string;
  onInsert: (text: string) => void;
  onClose: () => void;
}) {
  const { usuario } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [previewText, setPreviewText] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('message_templates')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('name');
    if (data) setTemplates(data as MessageTemplate[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  const filtered = templates.filter(t => {
    const matchesChannel = channel === 'whatsapp' ? t.channel !== 'email' : t.channel !== 'whatsapp';
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.content.toLowerCase().includes(search.toLowerCase());
    return matchesChannel && matchesCategory && matchesSearch;
  });

  // Build auto-variable values from context
  const autoValues = useCallback((): Record<string, string> => {
    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    return {
      nombre_contacto: contactName || agentName || '',
      nombre_agente: usuario ? `${usuario.nombre} ${usuario.apellidos}`.trim() : agentName,
      fecha: today,
    };
  }, [contactName, agentName, usuario]);

  const applyVariables = useCallback((content: string, manualVars: Record<string, string>) => {
    const autos = autoValues();
    let result = content;
    // Apply auto vars first
    for (const [key, val] of Object.entries(autos)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    }
    // Then manual vars
    for (const [key, val] of Object.entries(manualVars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `[${key}]`);
    }
    return result;
  }, [autoValues]);

  useEffect(() => {
    if (selectedTemplate) {
      setPreviewText(applyVariables(selectedTemplate.content, variableValues));
    }
  }, [selectedTemplate, variableValues, applyVariables]);

  const handleSelectTemplate = (tpl: MessageTemplate) => {
    setSelectedTemplate(tpl);
    const vars: Record<string, string> = {};
    if (tpl.variables && Array.isArray(tpl.variables)) {
      for (const v of tpl.variables) {
        if (!AUTO_VARS.has(v.name)) vars[v.name] = '';
      }
    }
    setVariableValues(vars);
    setPreviewText(applyVariables(tpl.content, vars));
  };

  const handleInsert = () => {
    if (!selectedTemplate) return;
    onInsert(previewText);
  };

  const handleDelete = async (tpl: MessageTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Eliminar la plantilla "${tpl.name}"?`)) return;
    await supabase.from('message_templates').delete().eq('id', tpl.id);
    if (selectedTemplate?.id === tpl.id) setSelectedTemplate(null);
    loadTemplates();
  };

  const handleEdit = (tpl: MessageTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTemplate(tpl);
  };

  if (showCreateForm || editingTemplate) {
    return (
      <TemplateFormModal
        template={editingTemplate}
        existingCategories={Array.from(new Set(templates.map(t => t.category)))}
        onSave={() => { setShowCreateForm(false); setEditingTemplate(null); loadTemplates(); }}
        onClose={() => { setShowCreateForm(false); setEditingTemplate(null); }}
      />
    );
  }

  const manualVarsForTemplate = selectedTemplate?.variables?.filter(
    (v: { name: string; label: string }) => !AUTO_VARS.has(v.name)
  ) || [];

  const autoVarsInTemplate = selectedTemplate?.variables?.filter(
    (v: { name: string; label: string }) => AUTO_VARS.has(v.name)
  ) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <BookTemplate className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Plantillas de Mensaje</h2>
            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full capitalize">{channel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nueva
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: list */}
          <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar plantilla..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-1 focus:ring-teal-500"
                />
              </div>
              {/* Category dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowCategoryDropdown(p => !p)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-teal-400 transition-colors"
                >
                  <span>{activeCategory === 'all' ? 'Todas las categorias' : activeCategory}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showCategoryDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setActiveCategory(cat); setShowCategoryDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${activeCategory === cat ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                      >
                        {cat === 'all' ? 'Todas las categorias' : cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto" onClick={() => setShowCategoryDropdown(false)}>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">
                  <BookTemplate className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Sin plantillas</p>
                  <button onClick={() => setShowCreateForm(true)} className="mt-2 text-xs text-teal-600 hover:underline">Crear primera plantilla</button>
                </div>
              ) : (
                filtered.map(tpl => (
                  <div
                    key={tpl.id}
                    className={`group border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selectedTemplate?.id === tpl.id ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}
                  >
                    <button className="w-full text-left p-3" onClick={() => handleSelectTemplate(tpl)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {tpl.is_global
                              ? <Globe className="w-3 h-3 text-teal-500 shrink-0" />
                              : <Lock className="w-3 h-3 text-gray-400 shrink-0" />}
                            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{tpl.name}</p>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">{tpl.content.substring(0, 80)}</p>
                          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{tpl.category}</span>
                        </div>
                        {selectedTemplate?.id === tpl.id && <Check className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />}
                      </div>
                    </button>
                    {/* Actions — visible on hover for owner or admin/gerente */}
                    <div className="flex items-center gap-1 px-3 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(usuario?.rol === 'Administrador' || usuario?.rol === 'Gerente' || tpl.created_by === usuario?.id) && (
                        <>
                          <button onClick={e => handleEdit(tpl, e)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600" title="Editar">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={e => handleDelete(tpl, e)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500" title="Eliminar">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: preview / variable input */}
          <div className="w-1/2 flex flex-col" onClick={() => setShowCategoryDropdown(false)}>
            {!selectedTemplate ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center p-6">
                  <Star className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Selecciona una plantilla para previsualizar</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-0.5">{selectedTemplate.name}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{selectedTemplate.category}</span>
                </div>

                {/* Auto-filled variables info */}
                {autoVarsInTemplate.length > 0 && (
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Relleno automatico
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {autoVarsInTemplate.map((v: { name: string; label: string }) => {
                        const autos = autoValues();
                        const val = autos[v.name] || '';
                        return (
                          <div key={v.name} className="flex items-center gap-1 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-md px-2 py-0.5">
                            <span className="text-[10px] font-mono text-teal-600 dark:text-teal-400">{`{{${v.name}}}`}</span>
                            <span className="text-[10px] text-gray-400">→</span>
                            <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 max-w-[80px] truncate" title={val}>{val || '(vacío)'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Manual variables */}
                {manualVarsForTemplate.length > 0 && (
                  <div className="px-4 pb-3 border-b border-gray-100 dark:border-gray-800 space-y-2">
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-2">Completar</p>
                    {manualVarsForTemplate.map((v: { name: string; label: string }) => (
                      <div key={v.name}>
                        <label className="text-[11px] text-gray-500 block mb-0.5 capitalize">{v.label || v.name.replace(/_/g, ' ')}</label>
                        <input
                          type="text"
                          value={variableValues[v.name] || ''}
                          onChange={e => setVariableValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                          placeholder={`Escribe ${v.label || v.name.replace(/_/g, ' ')}...`}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview */}
                <div className="flex-1 p-4 overflow-y-auto">
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Vista previa</p>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{previewText}</p>
                  </div>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={handleInsert}
                    className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <ChevronRight className="w-4 h-4" /> Usar esta plantilla
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Template Form Modal (Create / Edit)
// ============================================================

function TemplateFormModal({ template, existingCategories, onSave, onClose }: {
  template: MessageTemplate | null;
  existingCategories?: string[];
  onSave: () => void;
  onClose: () => void;
}) {
  const { usuario } = useAuth();
  const [name, setName] = useState(template?.name || '');
  const [category, setCategory] = useState(template?.category || 'General');
  const [customCategory, setCustomCategory] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [content, setContent] = useState(template?.content || '');
  const [channel, setChannel] = useState(template?.channel || 'whatsapp');
  const [isGlobal, setIsGlobal] = useState(template?.is_global ?? false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const allCategories = Array.from(new Set([...PRESET_CATEGORIES, ...(existingCategories || [])])).sort();
  const detectedVars = Array.from(new Set((content.match(/\{\{(\w+)\}\}/g) || []).map(v => v.replace(/[{}]/g, ''))));

  const insertToken = (token: string) => {
    const ta = textareaRef.current;
    if (!ta) { setContent(prev => prev + token); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  const selectCategory = (cat: string) => {
    setCategory(cat);
    setCustomCategory('');
    setShowCategoryDropdown(false);
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) return;
    const finalCategory = customCategory.trim() || category;
    setSaving(true);
    const variables = detectedVars.map(v => ({ name: v, label: v.replace(/_/g, ' ') }));
    const payload = { name: name.trim(), category: finalCategory, content: content.trim(), channel, is_global: isGlobal, variables, updated_at: new Date().toISOString() };
    if (template) {
      await supabase.from('message_templates').update(payload).eq('id', template.id);
    } else {
      await supabase.from('message_templates').insert({ ...payload, created_by: usuario?.id, is_active: true });
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{template ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Nombre</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:outline-none" placeholder="Nombre de la plantilla" />
            </div>

            {/* Category dropdown */}
            <div className="relative">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Categoria</label>
              <button
                type="button"
                onClick={() => setShowCategoryDropdown(p => !p)}
                className="mt-1 w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-teal-400 transition-colors focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <span>{customCategory.trim() || category}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showCategoryDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
                  <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                    <input
                      type="text"
                      value={customCategory}
                      onChange={e => setCustomCategory(e.target.value)}
                      placeholder="Nueva categoria..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      onClick={e => e.stopPropagation()}
                    />
                    {customCategory.trim() && (
                      <button
                        type="button"
                        onClick={() => selectCategory(customCategory.trim())}
                        className="mt-1.5 w-full text-left px-2.5 py-1.5 text-xs rounded-md bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 hover:bg-teal-100 transition-colors"
                      >
                        + Crear "{customCategory.trim()}"
                      </button>
                    )}
                  </div>
                  <div className="max-h-36 overflow-y-auto">
                    {allCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => selectCategory(cat)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${category === cat && !customCategory.trim() ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Canal</label>
              <select value={channel} onChange={e => setChannel(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="both">Ambos</option>
              </select>
            </div>
          </div>

          <div onClick={() => setShowCategoryDropdown(false)}>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Contenido</label>
            {/* Variable tokens grouped */}
            <div className="mb-2 space-y-1.5">
              <p className="text-[11px] text-gray-400">Automaticas (se rellenan al usar):</p>
              <div className="flex flex-wrap gap-1">
                {VARIABLE_TOKENS.filter(v => v.auto).map(v => (
                  <button
                    key={v.token}
                    type="button"
                    title={v.label}
                    onClick={() => insertToken(v.token)}
                    className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 text-[11px] font-mono border border-teal-200 dark:border-teal-800 hover:bg-teal-100 transition-colors"
                  >
                    {v.token}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">Manuales (el agente las completa):</p>
              <div className="flex flex-wrap gap-1">
                {VARIABLE_TOKENS.filter(v => !v.auto).map(v => (
                  <button
                    key={v.token}
                    type="button"
                    title={v.label}
                    onClick={() => insertToken(v.token)}
                    className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[11px] font-mono border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors"
                  >
                    {v.token}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 resize-none focus:ring-2 focus:ring-teal-500 focus:outline-none"
              placeholder="Escribe el contenido de la plantilla..."
            />
            {detectedVars.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {detectedVars.map(v => (
                  <span key={v} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${AUTO_VARS.has(v) ? 'bg-teal-50 text-teal-600 border border-teal-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                    {`{{${v}}}`} {AUTO_VARS.has(v) ? '· auto' : '· manual'}
                  </span>
                ))}
              </div>
            )}
          </div>

          {usuario?.rol === 'Administrador' && (
            <label className="flex items-center gap-2 cursor-pointer" onClick={() => setShowCategoryDropdown(false)}>
              <div
                onClick={() => setIsGlobal(p => !p)}
                className={`w-10 h-5 rounded-full relative transition-colors ${isGlobal ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isGlobal ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-xs text-gray-700 dark:text-gray-300">Disponible para todos (global)</span>
            </label>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !content.trim()} className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 font-medium transition-colors">
            {saving ? 'Guardando...' : 'Guardar plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Formularios Modal
// ============================================================

const APP_BASE_URL = 'https://app.movidigital.com.mx';

function FormulariosModal({ agentName, onInsert, onClose }: {
  agentName: string;
  onInsert: (text: string) => void;
  onClose: () => void;
}) {
  const { usuario } = useAuth();
  const [forms, setForms] = useState<QuoteFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedForm, setSelectedForm] = useState<QuoteFormTemplate | null>(null);
  const [messageTemplate, setMessageTemplate] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('quote_form_templates')
        .select('id, title, description, category, form_type, slug, allowed_roles, is_global, is_active')
        .eq('is_active', true)
        .order('category')
        .order('title');
      if (data) {
        const userRole = usuario?.rol;
        const filtered = (data as QuoteFormTemplate[]).filter(f => {
          if (!f.allowed_roles || f.allowed_roles.length === 0) return true;
          if (f.is_global) return true;
          return userRole ? f.allowed_roles.includes(userRole) : false;
        });
        setForms(filtered);
      }
      setLoading(false);
    })();
  }, [usuario]);

  const categories = ['all', ...Array.from(new Set(forms.map(f => f.category)))];

  const filtered = forms.filter(f => {
    const matchesCategory = activeCategory === 'all' || f.category === activeCategory;
    const matchesSearch = !search || f.title.toLowerCase().includes(search.toLowerCase()) || f.category.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const grouped = filtered.reduce<Record<string, QuoteFormTemplate[]>>((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {});

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleSelectForm = (form: QuoteFormTemplate) => {
    setSelectedForm(form);
    const slug = form.slug || form.form_type;
    const link = `${APP_BASE_URL}/tramites/formularios/nuevo/${slug}`;
    const defaultMessage = `Hola ${agentName}! Para continuar con tu cotizacion, por favor completa el siguiente formulario:\n\n*${form.title}*\n${link}\n\nSi tienes dudas estoy a tus ordenes.`;
    setMessageTemplate(defaultMessage);
  };

  const handleInsert = () => {
    if (!selectedForm) return;
    onInsert(messageTemplate);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Compartir Formulario de Cotizacion</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: form list */}
          <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar formulario..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${activeCategory === cat ? 'bg-teal-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                  >
                    {cat === 'all' ? 'Todos' : cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
              ) : activeCategory !== 'all' ? (
                // Flat list for filtered category
                filtered.map(form => (
                  <button
                    key={form.id}
                    onClick={() => handleSelectForm(form)}
                    className={`w-full text-left px-4 py-2.5 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selectedForm?.id === form.id ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{form.title}</p>
                      {selectedForm?.id === form.id && <Check className="w-3.5 h-3.5 text-teal-500 shrink-0" />}
                    </div>
                    {form.description && <p className="text-[11px] text-gray-500 truncate mt-0.5">{form.description}</p>}
                  </button>
                ))
              ) : (
                // Grouped accordion
                Object.entries(grouped).map(([cat, catForms]) => {
                  const isExpanded = expandedCategories.has(cat) || (search.length > 0);
                  return (
                    <div key={cat}>
                      <button
                        onClick={() => toggleCategory(cat)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{cat}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">{catForms.length}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {isExpanded && catForms.map(form => (
                        <button
                          key={form.id}
                          onClick={() => handleSelectForm(form)}
                          className={`w-full text-left px-5 py-2.5 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selectedForm?.id === form.id ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{form.title}</p>
                            {selectedForm?.id === form.id && <Check className="w-3.5 h-3.5 text-teal-500 shrink-0" />}
                          </div>
                          {form.description && <p className="text-[11px] text-gray-500 truncate mt-0.5">{form.description}</p>}
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: message preview & edit */}
          <div className="w-1/2 flex flex-col">
            {!selectedForm ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center p-6">
                  <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Selecciona un formulario</p>
                  <p className="text-xs mt-1 text-gray-300">El link se incluira automaticamente en el mensaje</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{selectedForm.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{selectedForm.category}</p>
                  <div className="flex items-center gap-1.5 mt-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <Link2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate font-mono">
                      {APP_BASE_URL}/tramites/formularios/nuevo/{selectedForm.slug || selectedForm.form_type}
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto flex flex-col">
                  <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400 uppercase mb-2">Mensaje a enviar</p>
                  <textarea
                    value={messageTemplate}
                    onChange={e => setMessageTemplate(e.target.value)}
                    rows={8}
                    className="flex-1 w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 resize-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1.5">Puedes editar el mensaje antes de enviarlo.</p>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={handleInsert}
                    className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Insertar en mensaje
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

