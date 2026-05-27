import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Users, Smartphone, MessageSquare, Globe, Info, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  type CCConversation, type CCChannel, type CCStatus,
} from '@/lib/contactCenterTypes';
import { ConversationList } from '@/components/contactCenter/ConversationList';
import { ConversationThread } from '@/components/contactCenter/ConversationThread';
import { ContactPanel } from '@/components/contactCenter/ContactPanel';

type PanelView = 'list' | 'thread' | 'contact';

export default function CentroContactoUnificado() {
  const { usuario } = useAuth();

  const [conversations, setConversations] = useState<CCConversation[]>([]);
  const [selected, setSelected] = useState<CCConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [filterChannel, setFilterChannel] = useState<CCChannel | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<CCStatus | 'all'>('open');
  const [search, setSearch] = useState('');
  const [showContactPanel, setShowContactPanel] = useState(false);
  // Mobile: 'list' | 'thread'
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';

  const loadConversations = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    try {
      let query = supabase
        .from('cc_conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      // Scope for non-admins
      if (!isAdmin && !isGerente) {
        query = query.eq('owner_user_id', usuario.id);
      } else if (isGerente && usuario.oficina_id) {
        query = query.eq('office_id', usuario.oficina_id);
      }

      const { data, error } = await query;
      if (!error) setConversations((data as CCConversation[]) || []);
    } finally {
      setLoading(false);
    }
  }, [usuario, isAdmin, isGerente]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Realtime updates to conversation list
  useEffect(() => {
    if (!usuario) return;
    const channel = supabase
      .channel('cc_conversations_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cc_conversations',
      }, () => {
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [usuario, loadConversations]);

  const syncChannels = async () => {
    if (!usuario || syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.rpc('sync_all_channels_for_user', {
        p_user_id: usuario.id,
      });
      if (error) throw error;
      const result = data as { wa_movi?: { upserted: number }; wa_personal?: { upserted: number }; chat?: { upserted: number } };
      const total = (result?.wa_movi?.upserted || 0) + (result?.wa_personal?.upserted || 0) + (result?.chat?.upserted || 0);
      setSyncResult(`Sincronizacion completada: ${total} mensajes nuevos`);
      await loadConversations();
    } catch {
      setSyncResult('Error al sincronizar. Intenta de nuevo.');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  const handleSelectConversation = (conv: CCConversation) => {
    setSelected(conv);
    setShowContactPanel(false);
    setMobileView('thread');
    // Mark as read (reset unread)
    if (conv.unread_count > 0) {
      supabase.from('cc_conversations').update({ unread_count: 0 }).eq('id', conv.id);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    }
  };

  const handleStatusChange = (id: string, status: CCStatus) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : prev);
  };

  const hasNoChannels = !loading && conversations.length === 0;

  return (
    <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-neutral-800 dark:text-white">Centro de Contacto Omnicanal</h1>
          <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded-full text-[10px] font-medium">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            En vivo
          </span>
        </div>
        <div className="flex items-center gap-2">
          {syncResult && (
            <span className={cn('text-xs px-2 py-1 rounded-lg flex-shrink-0 max-w-[200px] truncate', syncResult.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700')}>
              {syncResult}
            </span>
          )}
          <button
            onClick={syncChannels}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
            <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Conversation list — hidden on mobile when thread open */}
        <div className={cn(
          'flex-shrink-0 flex flex-col border-r border-neutral-200 dark:border-neutral-700',
          'w-full sm:w-80 lg:w-[320px]',
          mobileView === 'thread' ? 'hidden sm:flex' : 'flex'
        )}>
          {hasNoChannels ? (
            <EmptyChannels onSync={syncChannels} />
          ) : (
            <ConversationList
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
            />
          )}
        </div>

        {/* Thread + Contact panel */}
        <div className={cn(
          'flex-1 flex overflow-hidden',
          mobileView === 'list' ? 'hidden sm:flex' : 'flex'
        )}>
          {selected ? (
            <>
              {/* Thread */}
              <div className="flex-1 overflow-hidden">
                <ConversationThread
                  conversation={selected}
                  onBack={() => setMobileView('list')}
                  onStatusChange={handleStatusChange}
                />
              </div>

              {/* Contact panel toggle */}
              <div className={cn(
                'transition-all duration-200 overflow-hidden flex-shrink-0',
                showContactPanel ? 'w-72' : 'w-0'
              )}>
                {showContactPanel && (
                  <ContactPanel
                    conversation={selected}
                    onStatusChange={handleStatusChange}
                  />
                )}
              </div>

              {/* Contact panel toggle button */}
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
            <EmptyThread />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyThread() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <MessageSquare className="w-8 h-8 text-neutral-300 dark:text-neutral-600" />
      </div>
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
        Selecciona una conversacion
      </h3>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-xs">
        Elige una conversacion del panel izquierdo para ver el historial de mensajes y responder.
      </p>
    </div>
  );
}

function EmptyChannels({ onSync }: { onSync: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-neutral-300 dark:text-neutral-600" />
      </div>
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
        Sin conversaciones
      </h3>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-xs mb-6">
        Sincroniza tus canales para importar conversaciones de WA MOVI, WA Personal y Chat.
      </p>
      <div className="space-y-2 w-full max-w-xs">
        <button
          onClick={onSync}
          className="w-full flex items-center gap-2 justify-center px-4 py-2.5 bg-accent text-white text-xs font-medium rounded-xl hover:bg-accent/90 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sincronizar canales
        </button>
        <a
          href="/centro-contacto"
          className="w-full flex items-center gap-2 justify-center px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs font-medium rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5" />
          Configurar WA Personal
        </a>
        <a
          href="/centro-contacto"
          className="w-full flex items-center gap-2 justify-center px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs font-medium rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          Configurar WA MOVI
        </a>
      </div>
    </div>
  );
}
