import { useState, useEffect, useCallback } from 'react';
import { Info, X, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { type CCChannel, type CCStatus } from '@/lib/contactCenterTypes';
import {
  type UnifiedConversation,
  mergeConversations,
} from '@/lib/unifiedContactCenter';
import { UnifiedConversationList } from '@/components/contactCenter/UnifiedConversationList';
import { UnifiedConversationThread } from '@/components/contactCenter/UnifiedConversationThread';

export default function CentroContactoUnificado() {
  const { usuario } = useAuth();

  const [conversations, setConversations] = useState<UnifiedConversation[]>([]);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<UnifiedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState<CCChannel | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<CCStatus | 'all'>('open');
  const [search, setSearch] = useState('');
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const userId = usuario?.id;

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // ── 1. WA MOVI: contact_center_messages ──────────────────────
      let moviQuery = supabase
        .from('contact_center_messages')
        .select('id, agent_user_id, contact_phone, contact_name, direction, body, channel, created_at, status, read_at')
        .eq('channel', 'whatsapp')
        .order('created_at', { ascending: false });

      if (!isAdmin && !isGerente) {
        moviQuery = moviQuery.eq('agent_user_id', userId);
      } else if (isGerente && usuario?.oficina_id) {
        const { data: officeUsers } = await supabase
          .from('usuarios')
          .select('id')
          .eq('oficina_id', usuario.oficina_id);
        const ids = (officeUsers || []).map(u => u.id);
        if (ids.length > 0) moviQuery = moviQuery.in('agent_user_id', ids);
      }

      const { data: moviMsgs } = await moviQuery.limit(500);

      // Resolve CRM contact names for WA MOVI phones
      const moviContactNames: Record<string, string> = {};
      const moviPhones = [...new Set((moviMsgs || []).map((m: any) => m.contact_phone).filter(Boolean))];
      if (moviPhones.length > 0) {
        // Try crm_contactos table for name lookup by phone
        const { data: crmContacts } = await supabase
          .from('crm_contactos')
          .select('telefono, nombre, apellido')
          .in('telefono', moviPhones);
        for (const c of crmContacts || []) {
          if (c.telefono) {
            moviContactNames[c.telefono] = [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || c.telefono;
          }
        }
        // Also check contact_center_messages contact_name field itself (latest non-null per phone)
        for (const m of moviMsgs || []) {
          if (m.contact_phone && m.contact_name && !moviContactNames[m.contact_phone]) {
            moviContactNames[m.contact_phone] = m.contact_name;
          }
        }
      }

      // ── 2. WA Personal: whatsapp_conversations ───────────────────
      const { data: waConvs } = await supabase
        .from('whatsapp_conversations')
        .select('id, user_id, remote_phone, remote_name, remote_avatar_url, last_message_text, last_message_at, unread_count, is_group, group_name, is_archived')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(200);

      // ── 3. Chat: chats where current user is member ──────────────
      const { data: myChats } = await supabase
        .from('chat_miembros')
        .select('chat_id, ultimo_leido_at, chats(id, tipo, nombre, ultimo_mensaje_at, participantes_directos)')
        .eq('usuario_id', userId)
        .eq('eliminado', false);

      const chatIds = (myChats || []).map(m => m.chat_id);
      const chatLastMsgs: Record<string, { mensaje: string; created_at: string; remitente_id: string }> = {};
      const chatUnread: Record<string, number> = {};

      if (chatIds.length > 0) {
        const { data: lastMsgsData } = await supabase
          .from('chat_mensajes')
          .select('chat_id, mensaje, created_at, remitente_id')
          .in('chat_id', chatIds)
          .eq('eliminado', false)
          .order('created_at', { ascending: false });

        for (const m of lastMsgsData || []) {
          if (!chatLastMsgs[m.chat_id]) chatLastMsgs[m.chat_id] = m;
        }

        // Unread per chat
        for (const m of myChats || []) {
          const lastRead = m.ultimo_leido_at;
          const q = supabase
            .from('chat_mensajes')
            .select('id', { count: 'exact', head: true })
            .eq('chat_id', m.chat_id)
            .neq('remitente_id', userId)
            .eq('eliminado', false);
          const { count } = lastRead ? await q.gt('created_at', lastRead) : await q;
          chatUnread[m.chat_id] = count || 0;
        }

        // Resolve direct chat participant names
        const allParticipantIds = new Set<string>();
        for (const m of myChats || []) {
          const chat = (m as any).chats;
          if (chat?.tipo === 'direct' && Array.isArray(chat.participantes_directos)) {
            for (const pid of chat.participantes_directos) {
              if (pid !== userId) allParticipantIds.add(pid);
            }
          }
        }

        if (allParticipantIds.size > 0) {
          const { data: pUsers } = await supabase
            .from('usuarios')
            .select('id, nombres, apellido_paterno')
            .in('id', Array.from(allParticipantIds));
          setParticipantNames(
            Object.fromEntries((pUsers || []).map(u => [u.id, `${u.nombres} ${u.apellido_paterno}`.trim()]))
          );
        }
      }

      const merged = mergeConversations({
        moviMsgs: moviMsgs || [],
        waConvs: waConvs || [],
        myChats: myChats || [],
        chatLastMsgs,
        chatUnread,
        userId,
        moviContactNames,
      });

      setConversations(merged);
    } finally {
      setLoading(false);
    }
  }, [userId, isAdmin, isGerente, usuario?.oficina_id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime: subscribe to all three source tables
  useEffect(() => {
    if (!userId) return;

    const ch1 = supabase
      .channel('omni_movi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_center_messages' }, () => loadAll())
      .subscribe();

    const ch2 = supabase
      .channel('omni_wa')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, () => loadAll())
      .subscribe();

    const ch3 = supabase
      .channel('omni_chat_msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes' }, () => loadAll())
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
    };
  }, [userId, loadAll]);

  const handleSelectConversation = (conv: UnifiedConversation) => {
    setSelected(conv);
    setShowContactPanel(false);
    setMobileView('thread');
  };

  return (
    <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-neutral-800 dark:text-white">Centro de Contacto Omnicanal</h1>
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            En vivo
          </span>
        </div>
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 tabular-nums">
          {conversations.length} conversaciones
        </span>
      </div>

      {/* Main layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Conversation list */}
        <div className={cn(
          'flex-shrink-0 flex flex-col border-r border-neutral-200 dark:border-neutral-700',
          'w-full sm:w-80 lg:w-[320px]',
          mobileView === 'thread' ? 'hidden sm:flex' : 'flex'
        )}>
          <UnifiedConversationList
            conversations={conversations}
            selectedId={selected?.id || null}
            onSelect={handleSelectConversation}
            search={search}
            onSearchChange={setSearch}
            filterChannel={filterChannel}
            onFilterChange={setFilterChannel}
            filterStatus={filterStatus}
            onStatusChange={setFilterStatus}
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
                  onBack={() => setMobileView('list')}
                  currentUserId={userId!}
                  participantNames={participantNames}
                />
              </div>

              <div className={cn(
                'transition-all duration-200 overflow-hidden flex-shrink-0',
                showContactPanel ? 'w-64' : 'w-0'
              )}>
                {showContactPanel && (
                  <div className="w-64 h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700 p-4 overflow-y-auto">
                    <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Informacion</p>
                    {selected.contactName && (
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 mb-1">{selected.contactName}</p>
                    )}
                    {selected.contactPhone && (
                      <p className="text-xs text-neutral-500 mb-3">{selected.contactPhone}</p>
                    )}
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Canal</p>
                    <p className="text-xs text-neutral-700 dark:text-neutral-200">
                      {selected.channel === 'wa_movi' ? 'WA MOVI' : selected.channel === 'wa_personal' ? 'WA Personal' : 'Chat Interno'}
                    </p>
                  </div>
                )}
              </div>

              <div className="hidden lg:flex flex-col items-center justify-start pt-4 px-1 bg-white dark:bg-neutral-900 border-l border-neutral-100 dark:border-neutral-800">
                <button
                  onClick={() => setShowContactPanel(v => !v)}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
