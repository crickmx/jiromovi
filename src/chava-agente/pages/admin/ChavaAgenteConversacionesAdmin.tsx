import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { ChavaConversation } from '../../lib/types';
import { ChavaBrandLogo } from '../../../components/chava/ChavaBrandLogo';
import { ChavaAvatar } from '../../../components/chava/ChavaAvatar';
import { MessageSquare, Search, Trash2, Eye } from 'lucide-react';

interface ConvWithUser extends ChavaConversation {
  chava_agente_users: { nombre_completo: string; email: string; tipo_usuario: string } | null;
}

export default function ChavaAgenteConversacionesAdmin() {
  const [conversations, setConversations] = useState<ConvWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ConvWithUser | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => { loadConversations(); }, []);

  async function loadConversations() {
    setLoading(true);
    const { data } = await supabase
      .from('chava_agente_conversations')
      .select('*, chava_agente_users(nombre_completo, email, tipo_usuario)')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(200);
    setConversations((data || []) as ConvWithUser[]);
    setLoading(false);
  }

  async function viewConversation(conv: ConvWithUser) {
    setSelected(conv);
    setLoadingMessages(true);
    const { data } = await supabase
      .from('chava_agente_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoadingMessages(false);
  }

  async function deleteConversation(id: string) {
    if (!confirm('¿Eliminar esta conversación permanentemente?')) return;
    await supabase.from('chava_agente_conversations').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase();
    return !search || c.titulo.toLowerCase().includes(q) || c.chava_agente_users?.email.toLowerCase().includes(q) || c.chava_agente_users?.nombre_completo.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ChavaBrandLogo size="sm" theme="light" showDomain={false} />
          <div className="w-px h-6 bg-slate-200" />
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-slate-500" />
            Conversaciones
          </h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">Revisa y modera las conversaciones de la plataforma.</p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* List */}
        <div className="w-80 flex flex-col gap-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-cyan-400" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 bg-white rounded-xl border border-slate-200 p-1">
            {loading ? (
              <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">Sin resultados</p>
            ) : filtered.map(conv => (
              <button
                key={conv.id}
                onClick={() => viewConversation(conv)}
                className={`w-full text-left px-3 py-2.5 rounded-lg group hover:bg-slate-50 transition-colors ${selected?.id === conv.id ? 'bg-cyan-50 border border-cyan-200' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{conv.titulo || 'Sin título'}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{conv.chava_agente_users?.nombre_completo}</p>
                    <p className="text-[10px] text-slate-400">{conv.total_mensajes} msgs · {new Date(conv.updated_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }} className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:bg-red-50">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-center px-8">
              <div>
                <Eye className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Selecciona una conversación para ver los mensajes</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{selected.titulo}</p>
                  <p className="text-xs text-slate-500">{selected.chava_agente_users?.nombre_completo} · {selected.chava_agente_users?.email}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" /></div>
                ) : messages.map(m => (
                  <div key={m.id} className={`flex gap-2 ${m.rol === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className="flex-shrink-0">
                      {m.rol === 'assistant'
                        ? <ChavaAvatar size="sm" />
                        : <div className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-700"><span className="text-[10px] text-white font-bold">U</span></div>
                      }
                    </div>
                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${m.rol === 'user' ? 'text-white' : 'bg-slate-100 text-slate-800'}`} style={m.rol === 'user' ? { background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' } : {}}>
                      {m.contenido}
                      {m.tiempo_ms && <p className="text-[10px] opacity-50 mt-1">{m.tiempo_ms}ms</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
