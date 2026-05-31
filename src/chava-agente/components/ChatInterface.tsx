import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useChavaAgente } from '../lib/ChavaAgenteContext';
import type { ChatMessage, ChavaConversation } from '../lib/types';
import FuentesPanel from './FuentesPanel';
import { Send, Loader as Loader2, Bot, User, Copy, Check, RefreshCw } from 'lucide-react';

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
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 min-h-[300px]">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/20">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">
              {chavaUser ? `Hola, ${chavaUser.nombre_completo.split(' ')[0]}` : '¿En qué te puedo ayudar?'}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed mb-6">
              Soy Chava Agente, tu experto en seguros. Pregúntame lo que necesites.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  className="text-left px-3.5 py-3 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50 text-xs text-slate-600 hover:text-slate-800 transition-all leading-snug"
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
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-800' : 'bg-gradient-to-br from-cyan-500 to-cyan-700'}`}>
                {msg.role === 'user'
                  ? <User className="w-4 h-4 text-white" />
                  : <Bot className="w-4 h-4 text-white" />
                }
              </div>

              {/* Bubble */}
              <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`group relative px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-slate-800 text-white rounded-tr-sm ml-auto'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                }`}>
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
                      className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 rounded-lg p-1 shadow-sm"
                    >
                      {copiedId === msg.id
                        ? <Check className="w-3 h-3 text-emerald-500" />
                        : <Copy className="w-3 h-3 text-slate-400" />
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
                  <p className="text-[10px] text-slate-400 mt-1.5 px-1 leading-relaxed max-w-prose">
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
      <div className="border-t border-slate-200 bg-white p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20 transition-all">
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
              className="flex-1 resize-none text-sm text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent leading-relaxed"
              style={{ maxHeight: '160px', minHeight: '24px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending}
              className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                input.trim() && !sending
                  ? 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-sm shadow-cyan-500/30'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            Chava Agente puede cometer errores. Verifica la información importante con fuentes oficiales.
          </p>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
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
