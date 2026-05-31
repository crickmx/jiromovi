import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useChavaAgente } from '../lib/ChavaAgenteContext';
import type { ChavaConversation } from '../lib/types';
import { Plus, Search, Trash2, MessageSquare, X, ChevronLeft } from 'lucide-react';

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose?: () => void;
}

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

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white w-72">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {onClose && (
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700/50 lg:hidden">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <p className="text-sm font-semibold text-white">Conversaciones</p>
          </div>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversación..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-slate-500 hover:text-slate-300" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 px-4">
            <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500">
              {search ? 'Sin resultados' : 'Sin conversaciones aún'}
            </p>
          </div>
        ) : (
          Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider px-4 py-2 mt-1">{label}</p>
              {items.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 group hover:bg-slate-800/60 transition-colors ${activeId === conv.id ? 'bg-slate-800 border-r-2 border-cyan-400' : ''}`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 group-hover:text-slate-400" />
                  <span className="flex-1 text-xs text-slate-300 truncate leading-snug">{conv.titulo || 'Nueva conversación'}</span>
                  <span className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => deleteConversation(conv.id, e)}
                      className="p-0.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
}
