import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowLeft, Loader as Loader2, MoveVertical as MoreVertical, SquareCheck as CheckSquare, Square, Sparkles, Bot, FileText, FolderInput as FormInput, ListTodo, Plus, Smile, X, ClipboardList, ExternalLink, Image as ImageIcon, File, MapPin, Check, CheckCheck, CircleAlert as AlertCircle, Clock, Paperclip, User, Star, Zap, RefreshCw, WifiOff, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  type UnifiedConversation, type UnifiedMessage,
  getConversationDisplayName, CHANNEL_LABELS, formatMoviPhone,
} from '@/lib/unifiedContactCenter';
import { ChannelBadge } from './ChannelBadge';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callEdgeFn(slug: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      'Apikey': supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Emoji categories ──────────────────────────────────────────────────────────
const EMOJIS = [
  '👍','👋','🙏','😊','❤️','✅','👏','💪','🎉','😍','🤝','💯','⭐',
  '📋','📞','💬','✨','😀','😅','😂','🙂','😇','🥰','🤩','😘','😋',
  '😛','🤑','🤗','🤔','🤐','😏','😒','😌','😔','😴','😷','🤒','😵',
  '🤠','🥳','😎','🤓','😕','😮','😲','😳','🥺','😦','😨','😰','😢',
  '😭','😱','😡','🤬','📱','💻','📄','📊','📈','🔒','🗓️','💼','🎯',
];

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  channel: string;
  variables: Array<{ name: string; label: string }>;
}

interface QuoteForm {
  id: string;
  title: string;
  category: string;
  slug: string | null;
  form_type: string;
}

interface OpenTicket {
  id: string;
  folio: string;
  instrucciones: string;
  tipo_tramite: string;
  estatus_nombre: string;
}

interface CcAssistant {
  id: string;
  nombre: string;
  descripcion: string;
  source: string;
  is_active: boolean;
}

interface SessionState {
  status: string;
  current_stage: string;
  assistant_name: string;
  captured_count: number;
  total_fields: number;
}

interface UserTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
  is_favorite: boolean;
}

interface PendingAttachment {
  file: File;
  preview: string | null;
  base64: string;
  uploading: boolean;
  error: string | null;
}

interface Props {
  conversation: UnifiedConversation;
  onBack?: () => void;
  currentUserId: string;
  participantNames: Record<string, string>;
}

// ── Status icon ───────────────────────────────────────────────────────────────
function StatusIcon({ status, outbound }: { status: string; outbound?: boolean }) {
  if (status === 'read') return <CheckCheck className={cn('w-3.5 h-3.5', outbound ? 'text-blue-300' : 'text-blue-500')} />;
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-neutral-400" />;
  if (status === 'sent') return <Check className="w-3.5 h-3.5 text-neutral-400" />;
  if (status === 'failed') return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  return <Clock className="w-3.5 h-3.5 text-neutral-300" />;
}

// ── Rich message bubble ───────────────────────────────────────────────────────
function RichMessageBubble({
  msg, isOut, onImageClick, onRetry,
}: {
  msg: UnifiedMessage;
  isOut: boolean;
  onImageClick?: (url: string) => void;
  onRetry?: () => void;
}) {
  const type = msg.messageType;
  const raw = msg.raw as Record<string, unknown> | undefined;
  // For wa_personal messages the raw record has all the original columns
  const mediaDownloadStatus = (raw?.media_download_status as string) || null;
  const mediaCaption = (raw?.media_caption as string) || null;
  const metadata = (raw?.metadata as Record<string, unknown>) || {};

  const textColor = isOut ? 'text-white' : 'text-neutral-800 dark:text-white/80';
  const dimColor = isOut ? 'text-white/60' : 'text-neutral-400';
  const innerBg = isOut ? 'bg-emerald-700/50' : 'bg-neutral-50 dark:bg-neutral-700/50';

  return (
    <div>
      {/* Image */}
      {type === 'image' && (
        <div className="mb-1">
          {msg.mediaUrl ? (
            <img
              src={msg.mediaThumbnail || msg.mediaUrl}
              alt=""
              className="rounded-xl max-w-full max-h-52 object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onImageClick?.(msg.mediaUrl!)}
            />
          ) : mediaDownloadStatus === 'pending' || mediaDownloadStatus === 'downloading' ? (
            <div className="w-48 h-32 rounded-xl bg-neutral-100 dark:bg-neutral-700 flex flex-col items-center justify-center gap-1">
              <ImageIcon className="w-6 h-6 text-neutral-400 animate-pulse" />
              <span className="text-[10px] text-neutral-400">Descargando...</span>
            </div>
          ) : (
            <div className="w-48 h-24 rounded-xl bg-neutral-100 dark:bg-neutral-700 flex flex-col items-center justify-center gap-1">
              <ImageIcon className="w-5 h-5 text-neutral-400" />
              <span className="text-[10px] text-neutral-400">Imagen no disponible</span>
            </div>
          )}
          {(msg.body || mediaCaption) && <p className={cn('text-sm mt-1', textColor)}>{msg.body || mediaCaption}</p>}
        </div>
      )}

      {/* Sticker */}
      {type === 'sticker' && (
        <div className="mb-1">
          {msg.mediaUrl ? (
            <img src={msg.mediaUrl} alt="Sticker" className="w-28 h-28 object-contain" />
          ) : (
            <div className="w-28 h-28 rounded-xl bg-neutral-50 dark:bg-neutral-700/50 flex flex-col items-center justify-center">
              <span className="text-3xl">🏷</span>
              <span className="text-[10px] text-neutral-400 mt-1">Sticker</span>
            </div>
          )}
        </div>
      )}

      {/* Video */}
      {type === 'video' && (
        <div className="mb-1">
          {msg.mediaUrl ? (
            <video src={msg.mediaUrl} controls className="rounded-xl max-w-full max-h-52" poster={msg.mediaThumbnail || undefined} />
          ) : (
            <div className="w-48 h-32 rounded-xl bg-neutral-100 dark:bg-neutral-700 flex flex-col items-center justify-center gap-1">
              <FileText className="w-6 h-6 text-neutral-400" />
              <span className="text-[10px] text-neutral-400">{mediaDownloadStatus === 'failed' ? 'Video no disponible' : 'Descargando...'}</span>
            </div>
          )}
          {(msg.body || mediaCaption) && <p className={cn('text-sm mt-1', textColor)}>{msg.body || mediaCaption}</p>}
        </div>
      )}

      {/* Audio / Voice note */}
      {(type === 'audio' || type === 'voice_note') && (
        <div className="mb-1">
          {msg.mediaUrl ? (
            <audio src={msg.mediaUrl} controls className="max-w-[220px] h-10" />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-700/50">
              <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-600 flex items-center justify-center">
                <Paperclip className="w-4 h-4 text-neutral-400" />
              </div>
              <span className="text-[11px] text-neutral-500">
                {type === 'voice_note' ? 'Nota de voz' : 'Audio'}
                {metadata.duration ? ` (${Math.round(metadata.duration as number)}s)` : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Document */}
      {type === 'document' && (
        <div className="mb-1">
          <div className={cn('flex items-center gap-2.5 p-2.5 rounded-xl', innerBg)}>
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs font-medium truncate', textColor)}>{msg.mediaFilename || 'Documento'}</p>
              <p className={cn('text-[10px]', dimColor)}>
                {msg.raw && (msg.raw as any).media_file_size
                  ? `${((msg.raw as any).media_file_size / 1024).toFixed(0)} KB`
                  : msg.mediaMime || 'Archivo'}
              </p>
            </div>
            {msg.mediaUrl && (
              <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className={cn('p-1.5 rounded-lg transition-colors', isOut ? 'hover:bg-white/10' : 'hover:bg-neutral-200 dark:hover:bg-neutral-600')}>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          {(msg.body || mediaCaption) && <p className={cn('text-sm mt-1', textColor)}>{msg.body || mediaCaption}</p>}
        </div>
      )}

      {/* Location */}
      {type === 'location' && (
        <div className="mb-1">
          <div className={cn('p-2.5 rounded-xl', innerBg)}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-medium', textColor)}>{(metadata.name as string) || msg.locationLabel || 'Ubicacion'}</p>
                {metadata.address && <p className={cn('text-[10px] truncate', dimColor)}>{metadata.address as string}</p>}
              </div>
            </div>
            {(msg.locationLat || metadata.latitude) && (
              <a
                href={`https://maps.google.com/?q=${msg.locationLat || metadata.latitude},${msg.locationLng || metadata.longitude}`}
                target="_blank" rel="noopener noreferrer"
                className={cn('mt-2 block text-center text-[11px] font-medium py-1.5 rounded-md transition-colors', isOut ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-white/70 hover:bg-neutral-300')}
              >
                Abrir en Maps
              </a>
            )}
          </div>
        </div>
      )}

      {/* Contact card */}
      {type === 'contact' && (
        <div className="mb-1">
          <div className={cn('flex items-center gap-2.5 p-2.5 rounded-xl', innerBg)}>
            <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs font-medium', textColor)}>{(metadata.displayName as string) || msg.body || 'Contacto'}</p>
              {metadata.phone && <p className={cn('text-[10px]', dimColor)}>{metadata.phone as string}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Plain text */}
      {type === 'text' && msg.body && (
        <p className={cn('text-sm leading-relaxed whitespace-pre-wrap break-words', textColor)}>{msg.body}</p>
      )}

      {/* Fallback for unknown types */}
      {type !== 'text' && type !== 'image' && type !== 'sticker' && type !== 'video' && type !== 'audio' && type !== 'voice_note' && type !== 'document' && type !== 'location' && type !== 'contact' && type !== 'system' && msg.body && (
        <p className={cn('text-sm leading-relaxed whitespace-pre-wrap break-words', textColor)}>{msg.body}</p>
      )}

      {/* Footer: time + status + retry */}
      <div className={cn('flex items-center gap-1.5 mt-1', isOut ? 'justify-end' : 'justify-start')}>
        <span className={cn('text-[10px]', isOut ? 'text-white/60' : 'text-neutral-400 dark:text-white/30')}>
          {new Date(msg.sentAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
        </span>
        {isOut && <StatusIcon status={msg.status} outbound />}
        {isOut && msg.status === 'failed' && onRetry && (
          <button onClick={onRetry} className="text-[10px] font-medium text-red-300 hover:text-white bg-red-500/30 hover:bg-red-500/50 px-1.5 py-0.5 rounded transition-colors ml-1">
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function UnifiedConversationThread({ conversation, onBack, currentUserId, participantNames }: Props) {
  const { usuario } = useAuth();
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isAtBottomRef = useRef(true);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Panels / modals
  const [showMenu, setShowMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showPlantillas, setShowPlantillas] = useState(false);
  const [showForms, setShowForms] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [showAssistants, setShowAssistants] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tmplSearch, setTmplSearch] = useState('');
  const [tmplLoading, setTmplLoading] = useState(false);

  // Forms
  const [forms, setForms] = useState<QuoteForm[]>([]);
  const [formSearch, setFormSearch] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Ticket creation
  const [openTickets, setOpenTickets] = useState<OpenTicket[]>([]);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketInstructions, setTicketInstructions] = useState('');

  // Automatic/AI mode
  const [assistants, setAssistants] = useState<CcAssistant[]>([]);
  const [autoSession, setAutoSession] = useState<SessionState | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

  // WA Personal: sync-history state
  const [syncingHistory, setSyncingHistory] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; total: number } | null>(null);

  // WA Personal: media preview + file attachment + private templates
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [userWaTemplates, setUserWaTemplates] = useState<UserTemplate[]>([]);
  const [showWaTemplates, setShowWaTemplates] = useState(false);
  const [waTemplateSearch, setWaTemplateSearch] = useState('');
  const [waTemplateLoading, setWaTemplateLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const isMoviChannel = conversation.channel === 'wa_movi';
  const isWaPersonal = conversation.channel === 'wa_personal';
  const name = getConversationDisplayName(conversation, participantNames);

  // ── Load messages ───────────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    setLoading(true);
    const { channel, sourceId } = conversation;
    try {
      if (channel === 'wa_movi') {
        const isPhone = !sourceId.startsWith('agent:');
        let q = supabase
          .from('contact_center_messages')
          .select('id, direction, body, created_at, status, metadata, attachment_urls, sender_type, sender_user_id, contact_name, contact_phone, read_at')
          .eq('channel', 'whatsapp')
          .order('created_at', { ascending: true });

        if (isPhone) q = q.or(`contact_phone.eq.${sourceId},metadata->>chat_id.eq.${sourceId}`);
        else q = q.eq('agent_user_id', sourceId.replace('agent:', ''));

        const { data } = await q.limit(300);

        // Resolve sender names for outbound
        const senderIds = [...new Set((data || []).filter(m => m.direction === 'outbound' && m.sender_user_id).map(m => m.sender_user_id))];
        const senderMap: Record<string, string> = {};
        if (senderIds.length > 0) {
          const { data: users } = await supabase.from('usuarios').select('id, nombres, apellido_paterno').in('id', senderIds);
          for (const u of users || []) senderMap[u.id] = `${u.nombres} ${u.apellido_paterno}`.trim();
        }

        setMessages((data || []).map((m: any): UnifiedMessage => {
          const meta = (m.metadata as Record<string, unknown>) || {};
          const mediaUri = (meta.content_uri as string) || null;
          const msgType = (meta.message_type as string) || 'text';
          const atts = m.attachment_urls && Array.isArray(m.attachment_urls) ? m.attachment_urls : [];
          const firstAtt = atts[0];

          return {
            id: m.id,
            direction: m.direction === 'inbound' ? 'inbound' : 'outbound',
            messageType: msgType,
            body: m.body || null,
            mediaUrl: mediaUri || (firstAtt?.url) || null,
            mediaMime: null,
            mediaFilename: firstAtt?.name || null,
            mediaThumbnail: null,
            locationLat: null,
            locationLng: null,
            locationLabel: null,
            senderName: m.direction === 'inbound'
              ? (m.contact_name || (meta.contact_name as string) || m.contact_phone || 'Cliente')
              : (m.sender_type === 'system' ? 'Sistema' : senderMap[m.sender_user_id] || 'Asesor'),
            sentAt: m.created_at,
            status: m.status || 'sent',
            raw: m,
          };
        }));

        // Mark as read
        if (conversation.agentUserId) {
          try {
            await supabase.rpc('mark_contact_messages_read', {
              p_agent_user_id: conversation.agentUserId,
              p_user_id: currentUserId,
            });
          } catch {}
        }

      } else if (channel === 'wa_personal') {
        // Use the edge function so it falls back to the whatsapp-server
        // when the DB has no messages yet (first open / no history sync)
        const result = await callEdgeFn('whatsapp-session', {
          action: 'get-messages',
          conversationId: sourceId,
          limit: 100,
        });

        const data: any[] = result?.messages || [];

        setMessages(data.map((m: any): UnifiedMessage => ({
          id: m.id || m.wa_message_id || String(Math.random()),
          direction: m.direction || (m.fromMe ? 'outbound' : 'inbound'),
          messageType: m.message_type || m.type || 'text',
          body: m.content || m.body || m.media_caption || null,
          mediaUrl: m.media_url || m.mediaUrl || null,
          mediaMime: m.media_mime_type || m.mimetype || null,
          mediaFilename: m.media_filename || m.filename || null,
          mediaThumbnail: m.media_thumbnail_url || m.thumbnailUrl || null,
          locationLat: null,
          locationLng: null,
          locationLabel: null,
          senderName: null,
          sentAt: m.message_timestamp || m.created_at || new Date().toISOString(),
          status: m.status || 'sent',
          raw: m,
        })));

      } else if (channel === 'chat') {
        const { data } = await supabase
          .from('chat_mensajes')
          .select('id, remitente_id, mensaje, created_at')
          .eq('chat_id', sourceId)
          .eq('eliminado', false)
          .order('created_at', { ascending: true })
          .limit(300);

        setMessages((data || []).map((m: any): UnifiedMessage => ({
          id: m.id,
          direction: m.remitente_id === currentUserId ? 'outbound' : 'inbound',
          messageType: 'text',
          body: m.mensaje || null,
          mediaUrl: null, mediaMime: null, mediaFilename: null, mediaThumbnail: null,
          locationLat: null, locationLng: null, locationLabel: null,
          senderName: m.remitente_id !== currentUserId ? (participantNames[m.remitente_id] || null) : null,
          sentAt: m.created_at,
          status: 'sent',
          raw: m,
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [conversation.id, conversation.channel, conversation.sourceId, currentUserId, participantNames, conversation.agentUserId]);

  useEffect(() => { loadMessages(); setText(''); setSelectionMode(false); setSelectedIds(new Set()); }, [loadMessages]);

  // Scroll to bottom — instant on first load, smooth on new messages if already near bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    if (loading) return;
    // Use requestAnimationFrame so the DOM has fully painted before measuring
    requestAnimationFrame(() => {
      scrollToBottom(isAtBottomRef.current ? 'instant' : 'smooth');
      setShowScrollBtn(false);
    });
  }, [messages, loading, scrollToBottom]);

  // Track whether the user has scrolled away from the bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 80;
    isAtBottomRef.current = atBottom;
    setShowScrollBtn(!atBottom);
  }, []);

  // Realtime
  useEffect(() => {
    const { channel, sourceId } = conversation;
    if (channel === 'wa_personal') {
      const ch = supabase.channel(`wa_th_${sourceId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${sourceId}` }, loadMessages).subscribe();
      return () => { supabase.removeChannel(ch); };
    }
    if (channel === 'chat') {
      const ch = supabase.channel(`chat_th_${sourceId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes', filter: `chat_id=eq.${sourceId}` }, loadMessages).subscribe();
      return () => { supabase.removeChannel(ch); };
    }
    if (channel === 'wa_movi') {
      const ch = supabase.channel(`movi_th_${sourceId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_center_messages' }, loadMessages).subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [conversation.id, loadMessages]);

  // Close menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Load auto mode state for WA MOVI ───────────────────────────────────────
  useEffect(() => {
    if (!isMoviChannel || !conversation.agentUserId) return;
    callEdgeFn('contact-center-assistant-process', {
      action: 'get_session_state',
      agent_user_id: conversation.agentUserId,
    }).then(d => {
      if (d?.mode === 'automatic' && d?.active_session) {
        setAutoMode(true);
        setAutoSession(d.active_session);
      } else {
        setAutoMode(false);
        setAutoSession(null);
      }
    }).catch(() => {});
  }, [conversation.id, isMoviChannel, conversation.agentUserId]);

  // ── Send message ────────────────────────────────────────────────────────────
  const [sendError, setSendError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    const body = text.trim();
    const savedText = body;
    setText('');
    setSending(true);
    setSendError(null);
    try {
      const { channel, sourceId } = conversation;
      if (channel === 'wa_movi') {
        const nameAsPhone = conversation.contactName && /^\d{10,15}$/.test(conversation.contactName.replace(/\D/g, '')) ? conversation.contactName.replace(/\D/g, '') : null;
        const phone = conversation.contactPhone || (sourceId && !sourceId.startsWith('agent:') ? sourceId : null) || nameAsPhone;
        if (!phone) throw new Error('No se encontro el telefono del contacto');
        const result = await callEdgeFn('send-contact-whatsapp', {
          contactPhone: phone,
          message: body,
          agentUserId: conversation.agentUserId || currentUserId,
        });
        if (result?.error || result?.success === false) {
          throw new Error(result?.error || result?.message || 'Error al enviar por WA MOVI');
        }
      } else if (channel === 'wa_personal') {
        const { data: conv } = await supabase.from('whatsapp_conversations').select('remote_phone').eq('id', sourceId).maybeSingle();
        if (!conv?.remote_phone) throw new Error('No se encontro el telefono del contacto');
        const result = await callEdgeFn('whatsapp-session', { action: 'send-message', to: conv.remote_phone, message: body });
        if (result?.error) throw new Error(result.error);
      } else if (channel === 'chat') {
        await supabase.from('chat_mensajes').insert({ chat_id: sourceId, remitente_id: currentUserId, mensaje: body });
      }
      await loadMessages();
    } catch (err: any) {
      setText(savedText);
      setSendError(err.message || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
      textRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // ── Load templates ──────────────────────────────────────────────────────────
  const openPlantillas = async () => {
    setShowPlantillas(true);
    if (templates.length > 0) return;
    setTmplLoading(true);
    const { data } = await supabase.from('message_templates').select('id, name, category, content, channel, variables').eq('is_active', true).order('category');
    setTemplates((data || []).filter(t => t.channel === 'whatsapp' || t.channel === 'both'));
    setTmplLoading(false);
  };

  const applyTemplate = (t: Template) => {
    const agentName = usuario ? `${usuario.nombres} ${usuario.apellido_paterno}`.trim() : 'Asesor';
    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    let content = t.content
      .replace(/\{\{nombre_agente\}\}/g, agentName)
      .replace(/\{\{nombre_contacto\}\}/g, name)
      .replace(/\{\{fecha\}\}/g, today);
    setText(content);
    setShowPlantillas(false);
  };

  // ── Load forms ──────────────────────────────────────────────────────────────
  const openForms = async () => {
    setShowForms(true);
    if (forms.length > 0) return;
    setFormLoading(true);
    const { data } = await supabase.from('quote_form_templates').select('id, title, category, slug, form_type').eq('is_active', true).order('category');
    setForms(data || []);
    setFormLoading(false);
  };

  const sendFormLink = (form: QuoteForm) => {
    const base = import.meta.env.VITE_APP_URL || 'https://app.movi.digital';
    const url = `${base}/tramites/formularios/nuevo/${form.slug || form.form_type}`;
    setText(`Te comparto el formulario de cotizacion:\n*${form.title}*\n${url}`);
    setShowForms(false);
  };

  // ── Create ticket ───────────────────────────────────────────────────────────
  const openCreateTicket = () => {
    const selected = messages.filter(m => selectedIds.has(m.id));
    const ctx = selected.length > 0 ? selected.map(m => m.body).filter(Boolean).join('\n') : messages.slice(-3).map(m => m.body).filter(Boolean).join('\n');
    setTicketInstructions(ctx.slice(0, 500));
    setShowCreateTicket(true);
  };

  const createTicket = async () => {
    if (!ticketInstructions.trim() || creatingTicket) return;
    setCreatingTicket(true);
    try {
      const selectedMsgs = messages.filter(m => selectedIds.has(m.id));
      await callEdgeFn('create-task-from-contact-messages', {
        agent_user_id: conversation.agentUserId || currentUserId,
        contact_phone: conversation.contactPhone,
        contact_name: name,
        messages: (selectedMsgs.length > 0 ? selectedMsgs : messages.slice(-5)).map(m => ({
          id: m.id, body: m.body, direction: m.direction, created_at: m.sentAt,
        })),
        instrucciones: ticketInstructions,
        tipo_tramite: 'Atencion_General',
        prioridad: 'media',
      });
      setShowCreateTicket(false);
      setSelectionMode(false);
      setSelectedIds(new Set());
    } catch { /* ignore */ } finally {
      setCreatingTicket(false);
    }
  };

  // ── Add to existing ticket ──────────────────────────────────────────────────
  const openAddTicket = async () => {
    setShowAddTicket(true);
    setTicketLoading(true);
    const result = await callEdgeFn('get-agent-open-tickets', { agent_user_id: currentUserId }).catch(() => ({ tickets: [] }));
    setOpenTickets(result?.tickets || []);
    setTicketLoading(false);
  };

  const addToTicket = async (ticketId: string) => {
    const selected = messages.filter(m => selectedIds.has(m.id));
    await callEdgeFn('add-contact-messages-to-task', {
      ticket_id: ticketId,
      agent_user_id: currentUserId,
      messages: (selected.length > 0 ? selected : messages.slice(-3)).map(m => ({ id: m.id, body: m.body, direction: m.direction, created_at: m.sentAt })),
    }).catch(() => {});
    setShowAddTicket(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  // ── Assistants / Auto mode ──────────────────────────────────────────────────
  const openAssistants = async () => {
    setShowAssistants(true);
    setAutoLoading(true);
    const { data } = await supabase.from('contact_center_assistants').select('id, nombre, descripcion, source, is_active').eq('is_active', true).order('nombre');
    setAssistants((data as CcAssistant[]) || []);
    setAutoLoading(false);
  };

  const startAutoMode = async (assistantId: string) => {
    if (!conversation.agentUserId) return;
    setShowAssistants(false);
    setAutoLoading(true);
    const result = await callEdgeFn('contact-center-assistant-process', {
      action: 'start_session',
      agent_user_id: conversation.agentUserId,
      assistant_id: assistantId,
    }).catch(() => null);
    if (result?.session_id) {
      setAutoMode(true);
      setAutoSession({ status: 'active', current_stage: result.stage, assistant_name: result.assistant_name, captured_count: 0, total_fields: result.total_fields });
    }
    setAutoLoading(false);
  };

  const stopAutoMode = async () => {
    if (!conversation.agentUserId) return;
    await callEdgeFn('contact-center-assistant-process', { action: 'cancel_session', agent_user_id: conversation.agentUserId }).catch(() => {});
    setAutoMode(false);
    setAutoSession(null);
  };

  // ── WA Personal: file attachment ───────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const preview = file.type.startsWith('image/') ? (reader.result as string) : null;
      setPendingAttachment({ file, preview, base64, uploading: false, error: null });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const sendAttachment = async () => {
    if (!pendingAttachment || pendingAttachment.uploading) return;
    const { file, base64 } = pendingAttachment;
    setPendingAttachment(prev => prev ? { ...prev, uploading: true, error: null } : null);
    setSending(true);
    try {
      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('remote_phone')
        .eq('id', conversation.sourceId)
        .maybeSingle();

      if (!conv?.remote_phone) throw new Error('No se pudo obtener el numero de destino');

      const caption = text.trim() || undefined;
      const result = await callEdgeFn('whatsapp-session', {
        action: 'send-media',
        to: conv.remote_phone,
        mediaBase64: base64,
        mimeType: file.type,
        filename: file.name,
        caption,
        conversationId: conversation.sourceId,
      });

      if (result?.error) throw new Error(result.error);

      // Optimistic insert
      await supabase.from('whatsapp_messages').insert({
        conversation_id: conversation.sourceId,
        user_id: currentUserId,
        direction: 'outbound',
        message_type: file.type.startsWith('image/') ? 'image'
          : file.type.startsWith('video/') ? 'video'
          : file.type.startsWith('audio/') ? 'audio'
          : 'document',
        content: caption || null,
        media_filename: file.name,
        media_mime_type: file.type,
        status: 'pending',
      });

      setPendingAttachment(null);
      setText('');
      await loadMessages();
    } catch (err: any) {
      setPendingAttachment(prev => prev ? { ...prev, uploading: false, error: err.message || 'Error al enviar' } : null);
    } finally {
      setSending(false);
    }
  };

  // ── WA Personal: private templates ─────────────────────────────────────────
  const openWaTemplates = async () => {
    setShowWaTemplates(true);
    if (userWaTemplates.length > 0) return;
    setWaTemplateLoading(true);
    const { data } = await supabase
      .from('whatsapp_user_templates')
      .select('id, name, category, body, is_favorite')
      .eq('user_id', currentUserId)
      .order('is_favorite', { ascending: false })
      .order('name');
    setUserWaTemplates(data || []);
    setWaTemplateLoading(false);
  };

  const applyWaTemplate = (t: UserTemplate) => {
    const agentName = usuario ? `${usuario.nombres} ${usuario.apellido_paterno}`.trim() : 'Asesor';
    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    const content = t.body
      .replace(/\{\{nombre_agente\}\}/g, agentName)
      .replace(/\{\{nombre_contacto\}\}/g, name)
      .replace(/\{\{fecha\}\}/g, today);
    setText(content);
    setShowWaTemplates(false);
  };

  // ── WA Personal: sync history from server ────────────────────────────────
  const syncHistory = async () => {
    if (syncingHistory) return;
    setSyncingHistory(true);
    setSyncResult(null);
    try {
      const result = await callEdgeFn('whatsapp-session', { action: 'sync-history' });
      if (result?.success) {
        setSyncResult({ synced: result.synced || 0, total: result.total || 0 });
        await loadMessages();
      }
    } catch { /* ignore */ } finally {
      setSyncingHistory(false);
    }
  };

  const filteredTemplates = templates.filter(t => !tmplSearch || t.name.toLowerCase().includes(tmplSearch.toLowerCase()) || t.content.toLowerCase().includes(tmplSearch.toLowerCase()));
  const filteredForms = forms.filter(f => !formSearch || f.title.toLowerCase().includes(formSearch.toLowerCase()));
  const filteredTickets = openTickets.filter(t => !ticketSearch || t.folio.toLowerCase().includes(ticketSearch.toLowerCase()) || t.instrucciones?.toLowerCase().includes(ticketSearch.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 relative">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {selectionMode ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{selectedIds.size} seleccionados</span>
            <button onClick={openCreateTicket} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90">
              <Plus className="w-3 h-3" /> Crear tramite
            </button>
            <button onClick={openAddTicket} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-50">
              <ListTodo className="w-3 h-3" /> Agregar a tramite
            </button>
            <button onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }} className="ml-auto p-1.5 text-neutral-400 hover:text-neutral-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-neutral-800 dark:text-white truncate">{name}</p>
                <ChannelBadge channel={conversation.channel} size="sm" />
                {autoMode && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <Bot className="w-2.5 h-2.5" /> Auto activo
                  </span>
                )}
              </div>
              {conversation.contactPhone && (
                <p className="text-[11px] text-neutral-400">{formatMoviPhone(conversation.contactPhone)}</p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Selection mode */}
              <button onClick={() => setSelectionMode(true)} title="Seleccionar mensajes" className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400">
                <CheckSquare className="w-4 h-4" />
              </button>
              {/* Menu */}
              <div className="relative" ref={menuRef}>
                <button onClick={() => setShowMenu(v => !v)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400">
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-lg z-20 py-1 text-xs">
                    <button onClick={() => { setSelectionMode(true); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-left">
                      <CheckSquare className="w-3.5 h-3.5 text-neutral-400" /> Seleccionar mensajes
                    </button>
                    <button onClick={() => { openCreateTicket(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-left">
                      <Plus className="w-3.5 h-3.5 text-accent" /> Crear tramite
                    </button>
                    <button onClick={() => { openAddTicket(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-left">
                      <ListTodo className="w-3.5 h-3.5 text-neutral-400" /> Agregar a tramite
                    </button>
                    {isWaPersonal && (
                      <button onClick={() => { syncHistory(); setShowMenu(false); }} disabled={syncingHistory} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-left disabled:opacity-50">
                        <RefreshCw className={cn('w-3.5 h-3.5 text-neutral-400', syncingHistory && 'animate-spin')} /> Sincronizar historial
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Auto mode banner ─────────────────────────────────────── */}
      {autoMode && autoSession && (
        <div className="flex-shrink-0 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/15 border-b border-emerald-100 dark:border-emerald-800/30">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-600 flex-shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">{autoSession.assistant_name}</p>
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-800/40 text-emerald-600 dark:text-emerald-400 rounded-full font-medium">Auto activo</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 h-1 bg-emerald-100 dark:bg-emerald-800/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${autoSession.total_fields > 0 ? (autoSession.captured_count / autoSession.total_fields) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex-shrink-0 tabular-nums">
                  {autoSession.captured_count}/{autoSession.total_fields} campos
                </span>
              </div>
            </div>
            <button onClick={stopAutoMode} className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium flex-shrink-0 px-2 py-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
              Detener
            </button>
          </div>
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-0"
        onClick={() => { setShowEmoji(false); }}
      >
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-neutral-300 animate-spin" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 gap-3">
            {isWaPersonal && (conversation.raw as any)?.last_message_text ? (
              <>
                <WifiOff className="w-8 h-8 text-neutral-300" />
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Esta conversacion tiene actividad pero el historial aun no se ha sincronizado.</p>
                <p className="text-xs text-neutral-400 max-w-xs">
                  Los mensajes se sincronizan automaticamente al conectar WhatsApp. Puedes forzar la sincronizacion ahora.
                </p>
                {syncResult && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {syncResult.synced > 0 ? `${syncResult.synced} mensajes sincronizados` : 'Sin mensajes nuevos en el servidor'}
                  </p>
                )}
                <button
                  onClick={syncHistory}
                  disabled={syncingHistory}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 disabled:opacity-60 transition-colors"
                >
                  {syncingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {syncingHistory ? 'Sincronizando...' : 'Sincronizar historial'}
                </button>
              </>
            ) : (
              <p className="text-sm text-neutral-400">Sin mensajes todavia</p>
            )}
          </div>
        ) : messages.map((msg, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const showDate = !prev || new Date(msg.sentAt).toDateString() !== new Date(prev.sentAt).toDateString();
          const isOut = msg.direction === 'outbound';
          const isSystem = msg.messageType === 'system';
          const isSelected = selectedIds.has(msg.id);

          // Time gap separator: show when > 5 min gap between consecutive messages
          const prevTime = prev ? new Date(prev.sentAt).getTime() : null;
          const thisTime = new Date(msg.sentAt).getTime();
          const showTimeSep = !showDate && prevTime && (thisTime - prevTime > 5 * 60 * 1000);

          // Grouping: detect same sender in consecutive messages (ignore system)
          const prevNonSys = messages.slice(0, i).reverse().find(m => m.messageType !== 'system');
          const nextNonSys = messages.slice(i + 1).find(m => m.messageType !== 'system');
          const sameAsPrev = !showDate && !showTimeSep && prevNonSys && prevNonSys.direction === msg.direction && !isSystem;
          const sameAsNext = nextNonSys && nextNonSys.direction === msg.direction && !isSystem;

          // Determine corner rounding based on group position
          // Outbound: tails on right; inbound: tails on left
          const bubbleCorners = isOut
            ? cn(
                'rounded-2xl',
                sameAsPrev && 'rounded-tr-md',
                sameAsNext && 'rounded-br-md'
              )
            : cn(
                'rounded-2xl',
                sameAsPrev && 'rounded-tl-md',
                sameAsNext && 'rounded-bl-md'
              );

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 text-[11px] rounded-full">{msg.body}</span>
              </div>
            );
          }

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="px-3 py-1 bg-neutral-200/60 dark:bg-neutral-700/60 text-neutral-500 dark:text-neutral-400 text-[10px] rounded-full">
                    {new Date(msg.sentAt).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </div>
              )}
              {/* Time gap separator */}
              {showTimeSep && !showDate && (
                <div className="flex justify-center my-2">
                  <span className="text-[10px] text-neutral-300 dark:text-neutral-600">
                    {new Date(msg.sentAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              <div
                className={cn(
                  'flex group',
                  isOut ? 'justify-end' : 'justify-start',
                  selectionMode && 'cursor-pointer',
                  sameAsNext ? 'mb-0.5' : 'mb-1.5'
                )}
                onClick={selectionMode ? () => toggleSelect(msg.id) : undefined}
              >
                {selectionMode && (
                  <div className="flex items-end pb-1 mr-2">
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-accent" />
                      : <Square className="w-4 h-4 text-neutral-300" />}
                  </div>
                )}
                {/* Inbound avatar placeholder — only show on last in group */}
                {!isOut && (
                  <div className={cn('w-6 mr-1.5 flex items-end flex-shrink-0', sameAsNext ? 'invisible' : 'visible')}>
                    <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-500 dark:text-neutral-400">
                      {(msg.senderName || '?').charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className={cn('max-w-[72%]', isSelected && 'ring-2 ring-accent/40 rounded-2xl')}>
                  {/* Sender name — only on first message in group for inbound */}
                  {msg.senderName && !isOut && !sameAsPrev && (
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-1 mb-0.5">{msg.senderName}</p>
                  )}
                  <div className={cn(
                    'px-3 py-2 shadow-sm text-sm',
                    bubbleCorners,
                    isOut
                      ? 'bg-accent text-white'
                      : 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-100 dark:border-neutral-700'
                  )}>
                    <RichMessageBubble
                      msg={msg}
                      isOut={isOut}
                      onImageClick={(url) => setMediaPreview(url)}
                      onRetry={() => loadMessages()}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* ── Scroll to bottom button ───────────────────────────────── */}
      {showScrollBtn && (
        <button
          onClick={() => { scrollToBottom('smooth'); }}
          className="absolute bottom-[72px] right-4 z-10 w-9 h-9 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-md flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all"
          title="Ir al ultimo mensaje"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      {/* ── Composer ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-3 py-2.5 relative">
        {/* Hidden file input for wa_personal */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={handleFileSelect}
        />

        {/* Pending attachment preview */}
        {pendingAttachment && (
          <div className="mb-2 flex items-center gap-2 p-2 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
            {pendingAttachment.preview ? (
              <img src={pendingAttachment.preview} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                <File className="w-5 h-5 text-blue-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200 truncate">{pendingAttachment.file.name}</p>
              <p className="text-[10px] text-neutral-400">{(pendingAttachment.file.size / 1024).toFixed(0)} KB</p>
              {pendingAttachment.error && <p className="text-[10px] text-red-500">{pendingAttachment.error}</p>}
            </div>
            <button onClick={() => setPendingAttachment(null)} className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-1 mb-2">
          <button onClick={() => setShowEmoji(v => !v)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors" title="Emojis">
            <Smile className="w-4 h-4" />
          </button>
          {/* Plantillas: WA Personal uses private templates, others use shared */}
          {isWaPersonal ? (
            <button onClick={openWaTemplates} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors text-[11px] font-medium" title="Mis plantillas">
              <Star className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Plantilla</span>
            </button>
          ) : (
            <button onClick={openPlantillas} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors text-[11px] font-medium" title="Plantillas">
              <FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Plantilla</span>
            </button>
          )}
          <button onClick={openCreateTicket} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors text-[11px] font-medium" title="Crear tramite">
            <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Tramite</span>
          </button>
          {/* WA Personal: file attachment button */}
          {isWaPersonal && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors text-[11px] font-medium"
              title="Adjuntar archivo"
            >
              <Paperclip className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Archivo</span>
            </button>
          )}
        </div>

        {/* Emoji picker */}
        {showEmoji && (
          <div className="absolute bottom-full left-3 mb-1 w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl z-30 p-2">
            <div className="grid grid-cols-10 gap-0.5 max-h-28 overflow-y-auto">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => { setText(prev => prev + e); setShowEmoji(false); }} className="text-lg p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 leading-none">
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje... (Enter para enviar)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-800 dark:text-neutral-200 px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent/40 placeholder:text-neutral-400 max-h-24 overflow-y-auto"
            style={{ minHeight: '42px' }}
          />
          <button
            onClick={pendingAttachment ? sendAttachment : sendMessage}
            disabled={(!text.trim() && !pendingAttachment) || sending}
            className="p-2.5 bg-accent text-white rounded-xl hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {sendError && (
          <div className="flex items-center gap-2 mt-1.5 px-2.5 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
            <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
            <p className="text-[11px] text-red-600 dark:text-red-400 flex-1">{sendError}</p>
            <button onClick={() => setSendError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <p className="text-[10px] text-neutral-400 mt-1 text-center">
          {CHANNEL_LABELS[conversation.channel]}
          {text.length > 450 && <span className="ml-2 text-amber-500">{text.length}/550</span>}
        </p>
      </div>

      {/* ── Plantillas modal ─────────────────────────────────────── */}
      {showPlantillas && (
        <Modal title="Plantillas de mensaje" onClose={() => setShowPlantillas(false)}>
          <input value={tmplSearch} onChange={e => setTmplSearch(e.target.value)} placeholder="Buscar plantilla..." className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 mb-3 focus:outline-none focus:ring-1 focus:ring-accent/40" />
          {tmplLoading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-300" /></div>
            : filteredTemplates.length === 0 ? <p className="text-xs text-neutral-400 text-center py-6">Sin plantillas disponibles</p>
            : <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredTemplates.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t)} className="w-full text-left p-3 rounded-xl border border-neutral-100 dark:border-neutral-700 hover:border-accent/30 hover:bg-accent/5 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{t.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 rounded-full">{t.category}</span>
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{t.content}</p>
                  </button>
                ))}
              </div>
          }
        </Modal>
      )}

      {/* ── Formularios modal ────────────────────────────────────── */}
      {showForms && (
        <Modal title="Formularios de cotizacion" onClose={() => setShowForms(false)}>
          <input value={formSearch} onChange={e => setFormSearch(e.target.value)} placeholder="Buscar formulario..." className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 mb-3 focus:outline-none focus:ring-1 focus:ring-accent/40" />
          {formLoading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-300" /></div>
            : filteredForms.length === 0 ? <p className="text-xs text-neutral-400 text-center py-6">Sin formularios</p>
            : <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredForms.map(f => (
                  <button key={f.id} onClick={() => sendFormLink(f)} className="w-full text-left p-3 rounded-xl border border-neutral-100 dark:border-neutral-700 hover:border-accent/30 hover:bg-accent/5 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{f.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 rounded-full">{f.category}</span>
                    </div>
                  </button>
                ))}
              </div>
          }
        </Modal>
      )}

      {/* ── Crear tramite modal ──────────────────────────────────── */}
      {showCreateTicket && (
        <Modal title="Crear tramite" onClose={() => setShowCreateTicket(false)}>
          <p className="text-xs text-neutral-500 mb-2">Instrucciones para el tramite (resumen de la conversacion):</p>
          <textarea
            value={ticketInstructions}
            onChange={e => setTicketInstructions(e.target.value)}
            rows={5}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none mb-3"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowCreateTicket(false)} className="flex-1 px-4 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-600 hover:bg-neutral-50">Cancelar</button>
            <button onClick={createTicket} disabled={creatingTicket || !ticketInstructions.trim()} className="flex-1 px-4 py-2 text-sm bg-accent text-white rounded-xl hover:bg-accent/90 disabled:opacity-50">
              {creatingTicket ? 'Creando...' : 'Crear tramite'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Agregar a tramite modal ──────────────────────────────── */}
      {showAddTicket && (
        <Modal title="Agregar a tramite existente" onClose={() => setShowAddTicket(false)}>
          <input value={ticketSearch} onChange={e => setTicketSearch(e.target.value)} placeholder="Buscar tramite..." className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 mb-3 focus:outline-none focus:ring-1 focus:ring-accent/40" />
          {ticketLoading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-300" /></div>
            : filteredTickets.length === 0 ? <p className="text-xs text-neutral-400 text-center py-6">Sin tramites abiertos</p>
            : <div className="space-y-2 max-h-72 overflow-y-auto">
                {filteredTickets.map(t => (
                  <button key={t.id} onClick={() => addToTicket(t.id)} className="w-full text-left p-3 rounded-xl border border-neutral-100 dark:border-neutral-700 hover:border-accent/30 hover:bg-accent/5 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{t.folio}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 rounded-full">{t.estatus_nombre}</span>
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2">{t.instrucciones}</p>
                  </button>
                ))}
              </div>
          }
        </Modal>
      )}

      {/* ── WA Personal: Mis plantillas modal ───────────────────── */}
      {showWaTemplates && (
        <Modal title="Mis plantillas de WhatsApp" onClose={() => setShowWaTemplates(false)}>
          <input value={waTemplateSearch} onChange={e => setWaTemplateSearch(e.target.value)} placeholder="Buscar plantilla..." className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 mb-3 focus:outline-none focus:ring-1 focus:ring-accent/40" />
          {waTemplateLoading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-300" /></div>
            : userWaTemplates.filter(t => !waTemplateSearch || t.name.toLowerCase().includes(waTemplateSearch.toLowerCase()) || t.body.toLowerCase().includes(waTemplateSearch.toLowerCase())).length === 0
            ? (
              <div className="text-center py-6">
                <p className="text-xs text-neutral-400">Sin plantillas personales</p>
                <p className="text-[10px] text-neutral-300 mt-1">Crea plantillas en Mi WhatsApp</p>
              </div>
            )
            : <div className="space-y-2 max-h-80 overflow-y-auto">
                {userWaTemplates
                  .filter(t => !waTemplateSearch || t.name.toLowerCase().includes(waTemplateSearch.toLowerCase()) || t.body.toLowerCase().includes(waTemplateSearch.toLowerCase()))
                  .map(t => (
                  <button key={t.id} onClick={() => applyWaTemplate(t)} className="w-full text-left p-3 rounded-xl border border-neutral-100 dark:border-neutral-700 hover:border-accent/30 hover:bg-accent/5 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {t.is_favorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
                        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{t.name}</span>
                      </div>
                      {t.category && <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 rounded-full">{t.category}</span>}
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{t.body}</p>
                  </button>
                ))}
              </div>
          }
        </Modal>
      )}

      {/* ── Image preview overlay ────────────────────────────────── */}
      {mediaPreview && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setMediaPreview(null)}
        >
          <button
            onClick={() => setMediaPreview(null)}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={mediaPreview}
            alt=""
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Asistentes / Modo IA modal ───────────────────────────── */}
      {showAssistants && (
        <Modal title="Asistentes IA" onClose={() => setShowAssistants(false)}>
          <p className="text-xs text-neutral-500 mb-3">Selecciona un asistente para activar el modo automatico en esta conversacion.</p>
          {autoLoading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-300" /></div>
            : assistants.length === 0 ? <p className="text-xs text-neutral-400 text-center py-6">Sin asistentes configurados</p>
            : <div className="space-y-2 max-h-72 overflow-y-auto">
                {assistants.map(a => (
                  <button key={a.id} onClick={() => startAutoMode(a.id)} className="w-full text-left p-3 rounded-xl border border-neutral-100 dark:border-neutral-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{a.nombre}</p>
                        {a.descripcion && <p className="text-[11px] text-neutral-500 mt-0.5">{a.descripcion}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
          }
        </Modal>
      )}
    </div>
  );
}

// ── Reusable modal wrapper ────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md mx-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-sm font-bold text-neutral-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
