import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useChavaAgente } from '../lib/ChavaAgenteContext';
import type { ChatMessage } from '../lib/types';
import FuentesPanel from './FuentesPanel';
import { ChavaAvatar } from '../../components/chava/ChavaAvatar';
import { Send, Loader as Loader2, User, Copy, Check } from 'lucide-react';

const WELCOME_MESSAGE = `Hola, soy Chava Agente, tu experto en seguros impulsado por inteligencia artificial y respaldado por Grupo JIRO, con más de 50 años de experiencia en el sector asegurador mexicano.

Puedo ayudarte con:
• **Coberturas y productos** — vida, GMM, autos, daños, fianzas, empresariales
• **Conceptos técnicos** — deducibles, coaseguros, sumas aseguradas, exclusiones
• **Siniestros** — orientación sobre procesos y documentación
• **Marco regulatorio** — CNSF, LISF, requisitos para agentes
• **Argumentos de venta** — cómo presentar y comparar seguros

¿En qué te puedo orientar hoy?`;

const QUICK_PROMPTS = [
  '¿Qué cubre un seguro de Gastos Médicos Mayores?',
  '¿Cuál es la diferencia entre deducible y coaseguro?',
  '¿Cómo reportar un siniestro de auto?',
  '¿Qué seguros necesita una pequeña empresa?',
];

interface Props {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  onAuthRequired: (msg: string) => void;
}

export default function ChatInterface({ conversationId, onConversationCreated, onAuthRequired }: Props) {
  const { chavaUser } = useChavaAgente();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [convId, setConvId] = useState<string | null>(conversationId);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setConvId(conversationId);
    if (conversationId) loadHistory(conversationId);
    else setMessages([]);
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadHistory(id: string) {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('chava_agente_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(60);
    setMessages((data || []).map(m => ({
      id: m.id,
      role: m.rol as 'user' | 'assistant',
      content: m.contenido,
      fuentes: m.fuentes || undefined,
      confianza_general: m.confianza || undefined,
      created_at: m.created_at,
    })));
    setLoadingHistory(false);
  }

  async function ensureConversation(firstMessage: string): Promise<string> {
    if (convId) return convId;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session || !chavaUser) throw new Error('not-authenticated');

    const { data: conv, error } = await supabase
      .from('chava_agente_conversations')
      .insert({
        chava_user_id: chavaUser.id,
        titulo: firstMessage.substring(0, 60),
        total_mensajes: 0,
      })
      .select('id')
      .single();
    if (error) throw error;
    setConvId(conv.id);
    onConversationCreated(conv.id);
    return conv.id;
  }

  async function sendMessage(text?: string) {
    const msg = (text || input).trim();
    if (!msg || sending) return;

    if (!chavaUser) {
      onAuthRequired(msg);
      return;
    }

    setInput('');
    setSending(true);

    const tempUserMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: msg,
      created_at: new Date().toISOString(),
    };
    const tempAssistantMsg: ChatMessage = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      loading: true,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg, tempAssistantMsg]);

    try {
      const cid = await ensureConversation(msg);

      // Save user message
      const { data: savedUser } = await supabase
        .from('chava_agente_messages')
        .insert({ conversation_id: cid, rol: 'user', contenido: msg })
        .select('id')
        .single();

      if (savedUser) {
        setMessages(prev => prev.map(m => m.id === tempUserMsg.id ? { ...m, id: savedUser.id } : m));
      }

      // Call AI
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chava-agente-chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pregunta: msg,
            conversation_id: cid,
            chava_user_id: chavaUser.id,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Error del servidor');

      // Save assistant message
      const { data: savedAssistant } = await supabase
        .from('chava_agente_messages')
        .insert({
          conversation_id: cid,
          rol: 'assistant',
          contenido: json.respuesta,
          fuentes: json.fuentes || null,
          confianza: json.confianza_general || null,
          tokens_entrada: json.tokens_entrada || null,
          tokens_salida: json.tokens_salida || null,
          modelo: json.modelo || null,
          tiempo_ms: json.tiempo_ms || null,
        })
        .select('id')
        .single();

      // Update conversation message count + timestamp
      await supabase.from('chava_agente_conversations')
        .update({ total_mensajes: (messages.length + 2) / 2, updated_at: new Date().toISOString() })
        .eq('id', cid);

      setMessages(prev => prev.map(m =>
        m.id === tempAssistantMsg.id
          ? {
              ...m,
              id: savedAssistant?.id || m.id,
              content: json.respuesta,
              fuentes: json.fuentes,
              confianza_general: json.confianza_general,
              loading: false,
            }
          : m
      ));
    } catch (err: any) {
      const errMsg = err.message === 'not-authenticated'
        ? 'Sesión expirada. Por favor recarga la página.'
        : 'Hubo un problema al procesar tu consulta. Por favor intenta de nuevo.';

      setMessages(prev => prev.map(m =>
        m.id === tempAssistantMsg.id
          ? { ...m, content: errMsg, loading: false }
          : m
      ));
    } finally {
      setSending(false);
    }
  }

  function copyMessage(id: string, content: string) {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar">
        {loadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#00E5FF' }} />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 min-h-[300px]">
            <div className="mb-5">
              <ChavaAvatar size="xl" animate />
            </div>
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {chavaUser ? `Hola, ${chavaUser.nombre_completo.split(' ')[0]}` : '¿En qué te puedo ayudar?'}
            </h3>
            <p className="text-sm max-w-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Soy Chava Agente, tu experto en seguros. Pregúntame lo que necesites.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  className="text-left px-3.5 py-3 rounded-xl text-xs transition-all leading-snug"
                  style={{ border: '1px solid rgba(0,229,255,0.15)', color: 'rgba(255,255,255,0.6)', background: 'rgba(0,229,255,0.04)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.35)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              {msg.role === 'user' ? (
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <User className="w-4 h-4 text-white opacity-70" />
                </div>
              ) : (
                <ChavaAvatar size="sm" className="flex-shrink-0" />
              )}

              {/* Bubble */}
              <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`group relative px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'rounded-tr-sm ml-auto text-white'
                    : 'rounded-tl-sm shadow-sm'
                }`} style={msg.role === 'user'
                  ? { background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' }
                  : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }
                }>
                  {msg.loading ? (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Pensando...</span>
                    </div>
                  ) : (
                    <MessageContent content={msg.content} />
                  )}

                  {/* Copy button */}
                  {!msg.loading && msg.role === 'assistant' && (
                    <button
                      onClick={() => copyMessage(msg.id, msg.content)}
                      className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1 shadow-sm"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                    >
                      {copiedId === msg.id
                        ? <Check className="w-3 h-3 text-emerald-400" />
                        : <Copy className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
                      }
                    </button>
                  )}
                </div>

                {/* Sources */}
                {!msg.loading && msg.role === 'assistant' && msg.fuentes && msg.fuentes.length > 0 && (
                  <div className="w-full mt-1">
                    <FuentesPanel fuentes={msg.fuentes} confianza_general={msg.confianza_general} />
                  </div>
                )}

                {/* Disclaimer */}
                {!msg.loading && msg.role === 'assistant' && (
                  <p className="text-[10px] mt-1.5 px-1 leading-relaxed max-w-prose" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Información orientativa. Verifica con tu agente o aseguradora antes de tomar decisiones.
                  </p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 rounded-2xl px-4 py-3 transition-all" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            onFocus={() => {}} /* ring via focus-within on parent */
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Haz una pregunta sobre seguros..."
              rows={1}
              className="flex-1 resize-none text-sm focus:outline-none bg-transparent leading-relaxed"
              style={{ maxHeight: '160px', minHeight: '24px', color: 'rgba(255,255,255,0.85)', caretColor: '#00E5FF' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending}
              className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={input.trim() && !sending
                ? { background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)', color: 'white' }
                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)', cursor: 'not-allowed' }
              }
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-center mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Chava Agente puede cometer errores. Verifica la información importante con fuentes oficiales.
          </p>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,229,255,0.2); }
        .custom-scrollbar textarea::placeholder { color: rgba(255,255,255,0.3) !important; }
      `}</style>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  // Parse basic markdown: bold, lists, line breaks
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.trim() === '') return <div key={i} className="h-1" />;
        // Bold
        const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Bullet
        if (line.trimStart().startsWith('•') || line.trimStart().startsWith('-') || line.trimStart().match(/^\d+\./)) {
          return (
            <div key={i} className="flex gap-2 leading-relaxed">
              <span className="text-slate-400 flex-shrink-0 mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{ __html: formatted.replace(/^[\s•\-\d\.]+/, '') }} />
            </div>
          );
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} className="leading-relaxed" />;
      })}
    </div>
  );
}
