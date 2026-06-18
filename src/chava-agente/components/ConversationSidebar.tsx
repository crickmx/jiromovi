import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useChavaAgente } from '../lib/ChavaAgenteContext';
import type { ChavaConversation } from '../lib/types';
import { Plus, Search, Trash2, MessageSquare, X, ChevronLeft, Smartphone, Globe } from 'lucide-react';

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose?: () => void;
}

const PLATFORM_BADGE: Record<string, { label: string; color: string }> = {
  movi:        { label: 'MOVI',        color: '#60a5fa' },
  seguwallet:  { label: 'SeGuwallet',  color: '#34d399' },
  chava_agente:{ label: 'Chava',       color: 'rgba(0,229,255,0.7)' },
};

export default function ConversationSidebar({ activeId, onSelect, onNew, onClose }: Props) {
  const { chavaUser } = useChavaAgente();
  const [conversations, setConversations] = useState<ChavaConversation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (chavaUser) loadConversations();
  }, [chavaUser]);

  async function loadConversations() {
    if (!chavaUser) return;
    setLoading(true);
    const { data } = await supabase
      .from('chava_agente_conversations')
      .select('*')
      .eq('chava_user_id', chavaUser.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(60);
    setConversations((data || []) as ChavaConversation[]);
    setLoading(false);
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta conversación?')) return;
    await supabase
      .from('chava_agente_conversations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) onNew();
  }

  const filtered = conversations.filter(c =>
    c.titulo.toLowerCase().includes(search.toLowerCase())
  );

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days} días`;
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  // Group by date
  const groups: Record<string, ChavaConversation[]> = {};
  for (const c of filtered) {
    const label = formatDate(c.updated_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  }

  // Check if user has multi-platform conversations
  const platforms = new Set(conversations.map(c => c.source_platform || 'chava_agente'));
  const isMultiPlatform = platforms.size > 1;

  return (
    <div className="flex flex-col h-full w-72" style={{ background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Header */}
      <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg transition-colors lg:hidden"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>Conversaciones</p>
          </div>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
            style={{ color: '#00E5FF', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.14)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.08)')}
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva
          </button>
        </div>

        {/* Multi-platform notice */}
        {isMultiPlatform && (
          <div className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg mb-2.5" style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.12)', color: 'rgba(0,229,255,0.7)' }}>
            <Globe className="w-3 h-3 flex-shrink-0" />
            Historial unificado de todas tus plataformas
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversación..."
            className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.8)',
              caretColor: '#00E5FF',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2 ca-sidebar-scroll">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#00E5FF' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 px-4">
            <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.1)' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {search ? 'Sin resultados' : 'Sin conversaciones aún'}
            </p>
          </div>
        ) : (
          Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <p className="text-[10px] font-medium uppercase tracking-wider px-4 py-2 mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {label}
              </p>
              {items.map(conv => {
                const isActive = activeId === conv.id;
                const platform = conv.source_platform || 'chava_agente';
                const badge = PLATFORM_BADGE[platform];
                const showBadge = isMultiPlatform && platform !== 'chava_agente';

                return (
                  <button
                    key={conv.id}
                    onClick={() => onSelect(conv.id)}
                    className="w-full text-left px-4 py-2.5 flex items-start gap-2.5 group transition-colors relative"
                    style={isActive
                      ? { background: 'rgba(0,229,255,0.08)', borderRight: '2px solid #00E5FF' }
                      : {}
                    }
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = ''; }}
                  >
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: isActive ? '#00E5FF' : 'rgba(255,255,255,0.25)' }} />
                    <div className="flex-1 min-w-0">
                      <span className="block text-xs truncate leading-snug" style={{ color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)' }}>
                        {conv.titulo || 'Nueva conversación'}
                      </span>
                      {showBadge && (
                        <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: badge.color, background: `${badge.color}15`, border: `1px solid ${badge.color}25` }}>
                          <Smartphone className="w-2 h-2" />
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <span className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => deleteConversation(conv.id, e)}
                        className="p-0.5 rounded transition-colors"
                        style={{ color: 'rgba(255,255,255,0.3)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <style>{`
        .ca-sidebar-scroll::-webkit-scrollbar { width: 4px; }
        .ca-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .ca-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .ca-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,229,255,0.2); }
        .ca-sidebar-scroll input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  );
}
