import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Info, X, MessageSquare, QrCode, Zap, Wifi, WifiOff, CircleAlert as AlertCircle, RefreshCw, Settings, Plus, Star, Send, Copy, Trash2, Tag, CreditCard as Edit3, Phone, ExternalLink, User, FileText, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { type CCChannel, type CCStatus } from '@/lib/contactCenterTypes';
import {
  type UnifiedConversation,
  mergeConversations,
  buildContactNameMap,
  normalizeMexicanPhone,
} from '@/lib/unifiedContactCenter';
import { UnifiedConversationList } from '@/components/contactCenter/UnifiedConversationList';
import { UnifiedConversationThread } from '@/components/contactCenter/UnifiedConversationThread';

type SubTab = 'conversations' | 'connection' | 'templates';

interface WhatsAppSession {
  id: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'qr_pending';
  phone_number: string | null;
  connected_at: string | null;
  error_message: string | null;
}

interface UserTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
  is_favorite: boolean;
  sort_order: number;
}

export default function CentroContactoUnificado() {
  const { usuario } = useAuth();

  // ── Subtab state ─────────────────────────────────────────────────
  const [subTab, setSubTab] = useState<SubTab>('conversations');

  // ── Conversations state ──────────────────────────────────────────
  const [conversations, setConversations] = useState<UnifiedConversation[]>([]);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<UnifiedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState<CCChannel | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<CCStatus | 'all'>('open');
  const [search, setSearch] = useState('');
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

  // ── Connection state ─────────────────────────────────────────────
  const [waSession, setWaSession] = useState<WhatsAppSession | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [syncingHistory, setSyncingHistory] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Templates state ──────────────────────────────────────────────
  const [templates, setTemplates] = useState<UserTemplate[]>([]);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const userId = usuario?.id;

  // ── Edge function helper ─────────────────────────────────────────
  const callEdgeFunction = useCallback(async (action: string, extra?: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-session`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) return data ?? { error: `HTTP ${resp.status}` };
      return data;
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Error de red' };
    }
  }, []);

  // ── Load conversations (WA only, no chat) ────────────────────────
  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Get the configured MOVI channel UUID for filtering
      const { data: waConfig } = await supabase
        .from('whatsapp_configuracion')
        .select('channel_id_uuid')
        .eq('activo', true)
        .maybeSingle();
      const moviChannelId = waConfig?.channel_id_uuid || null;

      // 1. WA MOVI: contact_center_messages
      let moviQuery = supabase
        .from('contact_center_messages')
        .select('id, agent_user_id, contact_phone, contact_name, direction, body, channel, created_at, status, read_at, metadata')
        .eq('channel', 'whatsapp')
        .order('created_at', { ascending: false });

      // Filter by MOVI channel: include messages from the configured channel or legacy messages (null channel_id)
      if (moviChannelId) {
        moviQuery = moviQuery.or(`metadata->>channel_id.eq.${moviChannelId},metadata->>channel_id.is.null`);
      }

      if (!isAdmin && usuario?.oficina_id) {
        const { data: officeUsers } = await supabase
          .from('usuarios')
          .select('id')
          .eq('oficina_id', usuario.oficina_id);
        const ids = (officeUsers || []).map(u => u.id);
        if (ids.length > 0) moviQuery = moviQuery.in('agent_user_id', ids);
      } else if (!isAdmin) {
        moviQuery = moviQuery.eq('agent_user_id', userId);
      }

      const { data: moviMsgs } = await moviQuery.limit(500);

      // Resolve CRM contact names for WA MOVI phones (normalized comparison)
      const moviPhones = [...new Set((moviMsgs || []).map((m: any) => m.contact_phone).filter(Boolean))];
      let crmContacts: any[] = [];
      if (moviPhones.length > 0) {
        // Query CRM with both original phones AND normalized 10-digit versions
        const normalizedPhones = [...new Set(moviPhones.map(normalizeMexicanPhone).filter((p: string) => p.length >= 10))];
        const allPhoneVariants = [...new Set([...moviPhones, ...normalizedPhones])];
        const { data } = await supabase
          .from('crm_contactos')
          .select('telefono, nombre, apellido')
          .in('telefono', allPhoneVariants);
        crmContacts = data || [];
      }
      // Query usuarios by celular_laboral to resolve internal user names
      const normalizedMoviPhones = [...new Set(moviPhones.map(normalizeMexicanPhone).filter((p: string) => p.length >= 10))];
      let usuariosByPhone: any[] = [];
      if (normalizedMoviPhones.length > 0) {
        const { data: usrData } = await supabase
          .from('usuarios')
          .select('celular_laboral, nombre, apellidos')
          .not('celular_laboral', 'is', null);
        usuariosByPhone = usrData || [];
      }

      // Build normalized name map (CRM > usuarios > WhatsApp pushName from messages)
      const normalizedNameMap = buildContactNameMap(crmContacts, moviMsgs || [], usuariosByPhone);
      // Convert to format expected by mergeConversations (keyed by both original and normalized phone)
      const moviContactNames: Record<string, string> = { ...normalizedNameMap };
      for (const phone of moviPhones) {
        const norm = normalizeMexicanPhone(phone);
        if (normalizedNameMap[norm] && !moviContactNames[phone]) {
          moviContactNames[phone] = normalizedNameMap[norm];
        }
      }

      // 2. WA Personal: whatsapp_conversations
      const { data: waConvs } = await supabase
        .from('whatsapp_conversations')
        .select('id, user_id, remote_phone, remote_name, remote_avatar_url, last_message_text, last_message_at, unread_count, is_group, group_name, is_archived')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(200);

      const merged = mergeConversations({
        moviMsgs: moviMsgs || [],
        waConvs: waConvs || [],
        myChats: [],
        chatLastMsgs: {},
        chatUnread: {},
        userId,
        moviContactNames,
      });

      setConversations(merged);
    } finally {
      setLoading(false);
    }
  }, [userId, isAdmin, isGerente, usuario?.oficina_id]);

  // ── Load WA Personal session status ──────────────────────────────
  const loadConnectionStatus = useCallback(async () => {
    const result = await callEdgeFunction('get-status');
    if (result) {
      setWaSession(result.session || null);
      setProviderConfigured(result.server_configured ?? result.provider_configured ?? false);
      setProviderMessage(result.message || null);
      if (result.session?.status === 'connected' || result.session?.status === 'disconnected') {
        setQrCode(null);
      }
    }
  }, [callEdgeFunction]);

  // ── Load templates ───────────────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('whatsapp_user_templates')
      .select('*')
      .eq('user_id', userId)
      .order('is_favorite', { ascending: false })
      .order('sort_order');
    setTemplates(data || []);
  }, [userId]);

  // ── Initial load ─────────────────────────────────────────────────
  useEffect(() => {
    loadAll();
    loadConnectionStatus();
    loadTemplates();
  }, [loadAll, loadConnectionStatus, loadTemplates]);

  // ── Realtime subscriptions ───────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const ch1 = supabase
      .channel('wa_unified_movi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_center_messages' }, () => loadAll())
      .subscribe();

    const ch2 = supabase
      .channel('wa_unified_personal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, () => loadAll())
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [userId, loadAll]);

  // ── Cleanup polling on unmount ───────────────────────────────────
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Connection handlers ──────────────────────────────────────────
  const handleConnect = async () => {
    setPolling(true);
    // Immediately set session to qr_pending so the QR area renders
    setWaSession(prev => prev ? { ...prev, status: 'qr_pending' } : { id: '', status: 'qr_pending', phone_number: null, connected_at: null, error_message: null });

    const result = await callEdgeFunction('connect');
    if (result?.qr_code) setQrCode(result.qr_code);
    if (result?.error && !result.success) {
      setProviderConfigured(result.server_configured ?? false);
      setProviderMessage(result.error);
      setPolling(false);
      setWaSession(prev => prev ? { ...prev, status: 'disconnected' } : null);
      return;
    }

    // Poll for QR updates and connection status
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const qrResult = await callEdgeFunction('get-qr');
      if (qrResult) {
        if (qrResult.connected) {
          setQrCode(null);
          setPolling(false);
          if (pollRef.current) clearInterval(pollRef.current);
          const status = await callEdgeFunction('get-status');
          if (status?.session) setWaSession(status.session);
          loadAll();
        } else if (qrResult.qr_code) {
          setQrCode(qrResult.qr_code);
        }
      }
    }, 5000);
  };

  const handleDisconnect = async () => {
    await callEdgeFunction('disconnect');
    setWaSession(prev => prev ? { ...prev, status: 'disconnected' } : null);
    setQrCode(null);
    setPolling(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const handleSyncHistory = async () => {
    setSyncingHistory(true);
    setSyncResult(null);
    const result = await callEdgeFunction('sync-history');
    setSyncingHistory(false);
    if (result?.error) {
      setSyncResult(`Error: ${result.error}`);
    } else {
      setSyncResult(`Sincronizado: ${result?.synced || 0} conversaciones actualizadas`);
      loadAll();
    }
  };

  const handleSelectConversation = (conv: UnifiedConversation) => {
    setSelected(conv);
    setShowContactPanel(false);
    setMobileView('thread');
  };

  // ── WA MOVI status (always active) ──────────────────────────────
  const waMoviActive = true;
  const waPersonalConnected = waSession?.status === 'connected';

  return (
    <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-neutral-800 dark:text-white">WhatsApp</h1>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              MOVI
            </span>
            <span className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
              waPersonalConnected
                ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500'
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', waPersonalConnected ? 'bg-teal-500' : 'bg-neutral-300 dark:bg-neutral-600')} />
              Personal {waPersonalConnected ? '' : '(sin conectar)'}
            </span>
          </div>
        </div>

        {/* Subtab navigation */}
        <div className="flex items-center gap-1">
          {([
            { key: 'conversations' as SubTab, icon: MessageSquare, label: 'Conversaciones' },
            { key: 'connection' as SubTab, icon: QrCode, label: 'Conexión' },
            { key: 'templates' as SubTab, icon: Zap, label: 'Plantillas' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                subTab === tab.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Subtab content */}
      <div className="flex-1 overflow-hidden">
        {subTab === 'conversations' && (
          <ConversationsView
            conversations={conversations}
            participantNames={participantNames}
            selected={selected}
            loading={loading}
            filterChannel={filterChannel}
            filterStatus={filterStatus}
            search={search}
            showContactPanel={showContactPanel}
            mobileView={mobileView}
            userId={userId!}
            waPersonalConnected={waPersonalConnected}
            onSelect={handleSelectConversation}
            onSearchChange={setSearch}
            onFilterChange={setFilterChannel}
            onStatusChange={setFilterStatus}
            onToggleContactPanel={() => setShowContactPanel(v => !v)}
            onBack={() => setMobileView('list')}
          />
        )}
        {subTab === 'connection' && (
          <ConnectionView
            waSession={waSession}
            qrCode={qrCode}
            providerConfigured={providerConfigured}
            providerMessage={providerMessage}
            polling={polling}
            waMoviActive={waMoviActive}
            syncingHistory={syncingHistory}
            syncResult={syncResult}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onRefresh={loadConnectionStatus}
            onSyncHistory={handleSyncHistory}
          />
        )}
        {subTab === 'templates' && (
          <TemplatesView
            templates={templates}
            userId={userId || ''}
            onRefresh={loadTemplates}
          />
        )}
      </div>
    </div>
  );
}

// ── Contact Info Panel ─────────────────────────────────────────────────────

function ContactInfoPanel({ conversation }: { conversation: UnifiedConversation }) {
  const [tickets, setTickets] = useState<Array<{ id: string; folio: string; instrucciones: string; estatus_nombre: string; tipo_tramite: string }>>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);

  const phone = conversation.contactPhone;
  const name = conversation.contactName;
  const channel = conversation.channel;
  const CHANNEL_LABELS: Record<string, string> = { wa_movi: 'WA MOVI', wa_personal: 'WA Personal', chat: 'Chat Interno' };
  const CHANNEL_COLORS: Record<string, string> = { wa_movi: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', wa_personal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400', chat: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' };

  // Load related tickets on mount
  useEffect(() => {
    if (!phone || ticketsLoaded) return;
    setTicketsLoading(true);
    setTicketsLoaded(true);
    supabase
      .from('tickets')
      .select('id, folio, instrucciones, tipo_tramite')
      .or(`contacto_telefono.eq.${phone},contacto_nombre.ilike.%${name || ''}%`)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setTickets((data || []).map((t: any) => ({
          id: t.id,
          folio: t.folio || '—',
          instrucciones: t.instrucciones || '',
          estatus_nombre: t.estatus_nombre || t.estatus || '',
          tipo_tramite: t.tipo_tramite || '',
        })));
      })
      .catch(() => {})
      .finally(() => setTicketsLoading(false));
  }, [phone, name, ticketsLoaded]);

  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w.charAt(0))
    .join('')
    .toUpperCase();

  const whatsappUrl = phone
    ? `https://wa.me/${phone.replace(/\D/g, '')}`
    : null;

  return (
    <div className="w-64 h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700 overflow-y-auto flex flex-col">
      {/* Header: avatar + name */}
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-base font-bold text-emerald-700 dark:text-emerald-400 mx-auto mb-2">
          {initials}
        </div>
        {name && (
          <p className="text-sm font-semibold text-neutral-800 dark:text-white leading-snug">{name}</p>
        )}
        {phone && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 font-mono">{phone}</p>
        )}
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mt-2', CHANNEL_COLORS[channel] || CHANNEL_COLORS.wa_movi)}>
          {CHANNEL_LABELS[channel] || channel}
        </span>
      </div>

      {/* Quick actions */}
      <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 flex gap-2">
        {phone && (
          <a
            href={`tel:${phone.replace(/\D/g, '')}`}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors text-center"
            title="Llamar"
          >
            <Phone className="w-4 h-4" />
            <span className="text-[10px]">Llamar</span>
          </a>
        )}
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-neutral-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors text-center"
            title="Abrir en WhatsApp"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="text-[10px]">WhatsApp</span>
          </a>
        )}
      </div>

      {/* Contact data */}
      <div className="p-3 space-y-4 flex-1">

        {/* Contact info */}
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <User className="w-3 h-3" /> Contacto
          </p>
          <div className="space-y-1.5">
            {name && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-neutral-400 w-12 flex-shrink-0 pt-0.5">Nombre</span>
                <span className="text-xs text-neutral-700 dark:text-neutral-200 leading-snug">{name}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-neutral-400 w-12 flex-shrink-0 pt-0.5">Telefono</span>
                <span className="text-xs text-neutral-700 dark:text-neutral-200 font-mono">{phone}</span>
              </div>
            )}
            {conversation.agentUserId && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-neutral-400 w-12 flex-shrink-0 pt-0.5">Canal</span>
                <span className="text-xs text-neutral-700 dark:text-neutral-200">{CHANNEL_LABELS[channel]}</span>
              </div>
            )}
          </div>
        </div>

        {/* Related tickets */}
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <ClipboardList className="w-3 h-3" /> Tramites relacionados
          </p>
          {ticketsLoading ? (
            <div className="space-y-1.5">
              {[1, 2].map(i => (
                <div key={i} className="h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 py-1">Sin tramites encontrados</p>
          ) : (
            <div className="space-y-1.5">
              {tickets.map(t => (
                <div key={t.id} className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">{t.folio}</span>
                    {t.estatus_nombre && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 flex-shrink-0">{t.estatus_nombre}</span>
                    )}
                  </div>
                  {t.instrucciones && (
                    <p className="text-[10px] text-neutral-500 line-clamp-2 leading-snug">{t.instrucciones}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversation metadata */}
        <div>
          <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <FileText className="w-3 h-3" /> Conversacion
          </p>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-[10px] text-neutral-400 w-16 flex-shrink-0 pt-0.5">Estado</span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                conversation.status === 'open'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
              )}>
                {conversation.status === 'open' ? 'Abierta' : 'Archivada'}
              </span>
            </div>
            {conversation.unreadCount > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-neutral-400 w-16 flex-shrink-0 pt-0.5">No leidos</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{conversation.unreadCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Conversations Sub-view ─────────────────────────────────────────────────

function ConversationsView({
  conversations, participantNames, selected, loading,
  filterChannel, filterStatus, search, showContactPanel,
  mobileView, userId, waPersonalConnected,
  onSelect, onSearchChange, onFilterChange, onStatusChange,
  onToggleContactPanel, onBack,
}: {
  conversations: UnifiedConversation[];
  participantNames: Record<string, string>;
  selected: UnifiedConversation | null;
  loading: boolean;
  filterChannel: CCChannel | 'all';
  filterStatus: CCStatus | 'all';
  search: string;
  showContactPanel: boolean;
  mobileView: 'list' | 'thread';
  userId: string;
  waPersonalConnected: boolean;
  onSelect: (conv: UnifiedConversation) => void;
  onSearchChange: (v: string) => void;
  onFilterChange: (v: CCChannel | 'all') => void;
  onStatusChange: (v: CCStatus | 'all') => void;
  onToggleContactPanel: () => void;
  onBack: () => void;
}) {
  return (
    <div className="h-full flex">
      {/* Conversation list */}
      <div className={cn(
        'flex-shrink-0 flex flex-col border-r border-neutral-200 dark:border-neutral-700',
        'w-full sm:w-80 lg:w-[320px]',
        mobileView === 'thread' ? 'hidden sm:flex' : 'flex'
      )}>
        <UnifiedConversationList
          conversations={conversations}
          selectedId={selected?.id || null}
          onSelect={onSelect}
          search={search}
          onSearchChange={onSearchChange}
          filterChannel={filterChannel}
          onFilterChange={onFilterChange}
          filterStatus={filterStatus}
          onStatusChange={onStatusChange}
          loading={loading}
          participantNames={participantNames}
        />
      </div>

      {/* Thread + Contact panel */}
      <div className={cn(
        'flex-1 flex overflow-hidden',
        mobileView === 'list' ? 'hidden sm:flex' : 'flex'
      )}>
        {selected ? (
          <>
            <div className="flex-1 overflow-hidden">
              <UnifiedConversationThread
                conversation={selected}
                onBack={onBack}
                currentUserId={userId}
                participantNames={participantNames}
              />
            </div>

            <div className={cn(
              'transition-all duration-200 overflow-hidden flex-shrink-0',
              showContactPanel ? 'w-64' : 'w-0'
            )}>
              {showContactPanel && (
                <ContactInfoPanel conversation={selected} />
              )}
            </div>

            <div className="hidden lg:flex flex-col items-center justify-start pt-4 px-1 bg-white dark:bg-neutral-900 border-l border-neutral-100 dark:border-neutral-800">
              <button
                onClick={onToggleContactPanel}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  showContactPanel
                    ? 'bg-accent/10 text-accent'
                    : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600'
                )}
                title={showContactPanel ? 'Ocultar info' : 'Ver info del contacto'}
              >
                {showContactPanel ? <X className="w-4 h-4" /> : <Info className="w-4 h-4" />}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-neutral-300 dark:text-neutral-600" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
              Selecciona una conversacion
            </h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-xs">
              Elige una conversacion del panel izquierdo para ver el historial y responder.
            </p>
            {!waPersonalConnected && (
              <p className="text-[10px] text-teal-500 dark:text-teal-400 mt-4 max-w-xs">
                Conecta tu WA Personal en la pestaña "Conexión" para ver tambien esas conversaciones aqui.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Connection Sub-view ────────────────────────────────────────────────────

function ConnectionView({
  waSession, qrCode, providerConfigured, providerMessage,
  polling, waMoviActive, syncingHistory, syncResult,
  onConnect, onDisconnect, onRefresh, onSyncHistory,
}: {
  waSession: WhatsAppSession | null;
  qrCode: string | null;
  providerConfigured: boolean;
  providerMessage: string | null;
  polling: boolean;
  waMoviActive: boolean;
  syncingHistory: boolean;
  syncResult: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onSyncHistory: () => void;
}) {
  const isConnected = waSession?.status === 'connected';
  const isQrPending = waSession?.status === 'qr_pending';
  const isConnecting = waSession?.status === 'connecting';
  const isError = waSession?.status === 'error';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto p-6 space-y-6">
        {/* WA MOVI status (always active) */}
        <div className="rounded-2xl border bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-800/30 flex items-center justify-center">
              <Wifi className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-200">WA MOVI</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Siempre activo. Los mensajes de clientes llegan automaticamente a tu bandeja.
              </p>
            </div>
            <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-800/40 rounded-full text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Activo
            </span>
          </div>
        </div>

        {/* WA Personal status */}
        {!providerConfigured && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Servidor de WA Personal no configurado</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{providerMessage || 'Se requiere configurar el servidor de WhatsApp. Contacta al administrador del sistema.'}</p>
              </div>
            </div>
          </div>
        )}

        <div className={cn('rounded-2xl border p-6', isConnected ? 'bg-teal-50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800/40' : isError ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700')}>
          <div className="flex items-center gap-4 mb-4">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', isConnected ? 'bg-teal-100 dark:bg-teal-800/30' : isError ? 'bg-red-100 dark:bg-red-800/30' : 'bg-neutral-100 dark:bg-white/5')}>
              {isConnected ? <Wifi className="w-7 h-7 text-teal-600" /> : isError ? <AlertCircle className="w-7 h-7 text-red-600" /> : <WifiOff className="w-7 h-7 text-neutral-400" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                {isConnected ? 'WA Personal Conectado' : isQrPending ? 'Esperando escaneo QR' : isConnecting ? 'Conectando...' : isError ? 'Error de conexion' : 'WA Personal Desconectado'}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {isConnected && waSession?.phone_number ? `Numero: ${waSession.phone_number}` : isConnected ? 'Sesion activa' : isError && waSession?.error_message ? waSession.error_message : 'Conecta tu WhatsApp personal para sincronizar tus conversaciones'}
              </p>
            </div>
          </div>

          {isConnected && waSession?.connected_at && (
            <div className="text-xs text-teal-600 dark:text-teal-400 mb-4">
              Conectado desde: {new Date(waSession.connected_at).toLocaleString('es-MX')}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {!isConnected && (
              <button onClick={onConnect} disabled={!providerConfigured}
                className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-neutral-300 disabled:dark:bg-neutral-700 text-white disabled:text-neutral-500 rounded-xl text-sm font-medium transition-colors">
                <QrCode className="w-4 h-4" />
                {isQrPending || isConnecting ? 'Reintentar' : 'Conectar WhatsApp'}
              </button>
            )}
            {isConnected && (
              <button onClick={onDisconnect} className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors">
                <WifiOff className="w-4 h-4" /> Desconectar
              </button>
            )}
            {isConnected && (
              <button onClick={onSyncHistory} disabled={syncingHistory}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors">
                <RefreshCw className={cn('w-4 h-4', syncingHistory && 'animate-spin')} />
                {syncingHistory ? 'Sincronizando...' : 'Sincronizar historial'}
              </button>
            )}
            <button onClick={onRefresh} className="p-3 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors" title="Actualizar estado">
              <RefreshCw className={cn('w-4 h-4 text-neutral-500', polling && 'animate-spin')} />
            </button>
          </div>

          {syncResult && (
            <div className={cn('mt-3 text-xs px-3 py-2 rounded-lg', syncResult.includes('Error') || syncResult.includes('error') ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300')}>
              {syncResult}
            </div>
          )}
        </div>

        {/* QR Code display */}
        {(isQrPending || isConnecting) && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-8 text-center">
            <div className="w-64 h-64 mx-auto bg-white rounded-2xl flex items-center justify-center mb-4 border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {qrCode ? (
                <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center p-4">
                  {polling ? (
                    <>
                      <div className="w-10 h-10 border-[3px] border-teal-500/20 border-t-teal-500 rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Generando codigo QR...</p>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-16 h-16 text-neutral-200 dark:text-neutral-700 mx-auto mb-2" />
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">Presiona "Conectar WhatsApp" para generar el codigo QR</p>
                    </>
                  )}
                </div>
              )}
            </div>
            {qrCode && (
              <div className="mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  <span className="text-xs font-medium text-teal-700 dark:text-teal-300">Esperando escaneo...</span>
                </div>
              </div>
            )}
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-white mb-2">Escanea el codigo QR</h3>
            <ol className="text-left text-xs text-neutral-500 dark:text-neutral-400 space-y-1.5 max-w-xs mx-auto">
              <li>1. Abre WhatsApp en tu celular</li>
              <li>2. Toca Menu o Configuracion</li>
              <li>3. Selecciona "Dispositivos vinculados"</li>
              <li>4. Toca "Vincular un dispositivo"</li>
              <li>5. Apunta la camara hacia el codigo QR</li>
            </ol>
          </div>
        )}

        {/* Info section */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-5 border border-neutral-200/50 dark:border-neutral-700/50">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-white mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4 text-neutral-400" /> Informacion importante
          </h3>
          <ul className="text-xs text-neutral-500 dark:text-neutral-400 space-y-2">
            <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" /> WA MOVI siempre esta activo y recibe mensajes de clientes de forma independiente.</li>
            <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" /> WA Personal requiere vincular tu celular para sincronizar tus conversaciones personales.</li>
            <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" /> Si cierras sesion desde tu celular, la conexion de WA Personal se desconectara automaticamente.</li>
            <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-neutral-300 mt-1.5 flex-shrink-0" /> Ambos canales se combinan en una sola bandeja en "Conversaciones".</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Templates Sub-view ─────────────────────────────────────────────────────

function TemplatesView({ templates, userId, onRefresh }: {
  templates: UserTemplate[];
  userId: string;
  onRefresh: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');

  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category).filter(Boolean));
    return Array.from(cats);
  }, [templates]);

  const filtered = useMemo(() => {
    if (!filterCategory) return templates;
    return templates.filter(t => t.category === filterCategory);
  }, [templates, filterCategory]);

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) return;
    if (editingId) {
      await supabase.from('whatsapp_user_templates').update({ name: name.trim(), category: category.trim(), body: body.trim(), updated_at: new Date().toISOString() }).eq('id', editingId);
    } else {
      await supabase.from('whatsapp_user_templates').insert({ user_id: userId, name: name.trim(), category: category.trim(), body: body.trim() });
    }
    setName(''); setCategory(''); setBody(''); setEditingId(null);
    onRefresh();
  };

  const handleEdit = (tpl: UserTemplate) => {
    setEditingId(tpl.id); setName(tpl.name); setCategory(tpl.category); setBody(tpl.body);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta plantilla?')) return;
    await supabase.from('whatsapp_user_templates').delete().eq('id', id);
    onRefresh();
  };

  const handleDuplicate = async (tpl: UserTemplate) => {
    await supabase.from('whatsapp_user_templates').insert({ user_id: userId, name: `${tpl.name} (copia)`, category: tpl.category, body: tpl.body });
    onRefresh();
  };

  const handleToggleFavorite = async (tpl: UserTemplate) => {
    await supabase.from('whatsapp_user_templates').update({ is_favorite: !tpl.is_favorite }).eq('id', tpl.id);
    onRefresh();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Create/Edit form */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            {editingId ? <Edit3 className="w-4 h-4 text-amber-500" /> : <Plus className="w-4 h-4 text-emerald-600" />}
            {editingId ? 'Editar plantilla' : 'Nueva plantilla'}
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre"
                className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/60" />
              <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="Categoria (opcional)"
                className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/60" />
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              placeholder="Hola {{nombre_cliente}}, te saluda {{nombre_usuario}} de {{nombre_oficina}}..."
              rows={4} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/60 resize-none" />
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={!name.trim() || !body.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-200 disabled:dark:bg-neutral-700 text-white disabled:text-neutral-400 rounded-xl text-sm font-medium transition-colors">
                {editingId ? 'Actualizar' : 'Guardar'}
              </button>
              {editingId && <button onClick={() => { setEditingId(null); setName(''); setCategory(''); setBody(''); }} className="px-4 py-2.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl">Cancelar</button>}
            </div>
          </div>
        </div>

        {/* Filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setFilterCategory('')} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', !filterCategory ? 'bg-emerald-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700')}>Todas</button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', filterCategory === cat ? 'bg-emerald-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700')}>{cat}</button>
            ))}
          </div>
        )}

        {/* Templates list */}
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-3">Mis plantillas ({filtered.length})</h3>
          {filtered.length === 0 ? (
            <div className="text-center py-10 bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50">
              <Zap className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No tienes plantillas aun</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Crea una plantilla para enviar mensajes rapidos en WhatsApp</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(tpl => (
                <div key={tpl.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {tpl.is_favorite && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        <h4 className="text-sm font-semibold text-neutral-800 dark:text-white">{tpl.name}</h4>
                        {tpl.category && <span className="text-[9px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded">{tpl.category}</span>}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">{tpl.body}</p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleToggleFavorite(tpl)} className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" title="Favorito"><Star className={cn('w-3.5 h-3.5', tpl.is_favorite ? 'text-amber-500 fill-amber-500' : 'text-neutral-300')} /></button>
                      <button onClick={() => handleDuplicate(tpl)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg" title="Duplicar"><Copy className="w-3.5 h-3.5 text-neutral-400" /></button>
                      <button onClick={() => handleEdit(tpl)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Editar"><Edit3 className="w-3.5 h-3.5 text-blue-500" /></button>
                      <button onClick={() => handleDelete(tpl.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Eliminar"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Variables reference */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-5 border border-neutral-200/50 dark:border-neutral-700/50">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-white mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-neutral-400" /> Variables disponibles</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { var: '{{nombre_cliente}}', desc: 'Nombre del contacto' },
              { var: '{{nombre_usuario}}', desc: 'Tu nombre' },
              { var: '{{nombre_agente}}', desc: 'Nombre agente' },
              { var: '{{telefono_usuario}}', desc: 'Tu telefono' },
              { var: '{{email_usuario}}', desc: 'Tu email' },
              { var: '{{tipo_seguro}}', desc: 'Tipo de seguro' },
              { var: '{{fecha_vencimiento}}', desc: 'Fecha vencimiento' },
              { var: '{{liga_seguwallet}}', desc: 'Liga Seguwallet' },
              { var: '{{liga_formulario}}', desc: 'Liga formulario' },
              { var: '{{nombre_oficina}}', desc: 'Nombre oficina' },
              { var: '{{telefono_oficina}}', desc: 'Telefono oficina' },
              { var: '{{email_oficina}}', desc: 'Email oficina' },
            ].map(v => (
              <div key={v.var} className="text-xs">
                <code className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">{v.var}</code>
                <span className="text-neutral-400 dark:text-neutral-500 ml-1.5">{v.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
