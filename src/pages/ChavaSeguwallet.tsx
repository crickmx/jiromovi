import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, Send, RotateCcw, Phone, Mail, MessageCircle, Globe, X, ChevronDown, FileText, CreditCard, Shield, TriangleAlert as AlertTriangle, BookOpen, User } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Ver mis pólizas', icon: <FileText className="w-3.5 h-3.5" />, prompt: '¿Qué pólizas tengo activas?' },
  { label: 'Pagos pendientes', icon: <CreditCard className="w-3.5 h-3.5" />, prompt: '¿Tengo pagos o recibos pendientes?' },
  { label: 'Próximo vencimiento', icon: <Shield className="w-3.5 h-3.5" />, prompt: '¿Cuándo vence mi próxima póliza?' },
  { label: 'Reportar siniestro', icon: <AlertTriangle className="w-3.5 h-3.5" />, prompt: '¿Cómo reporto un siniestro?' },
  { label: 'Mis coberturas', icon: <BookOpen className="w-3.5 h-3.5" />, prompt: '¿Qué cubre mi seguro?' },
  { label: 'Contactar agente', icon: <User className="w-3.5 h-3.5" />, prompt: '¿Cómo puedo contactar a mi agente?' },
];

export default function ChavaSeguwallet() {
  const { customer, agent, office } = useAuth();
  const location = useLocation();
  const polizaCtx = location.state as {
    polizaId?: string; polizaNumero?: string; aseguradora?: string;
    ramo?: string; vigenciaFin?: string; status?: string;
    modulo?: string; totalPendiente?: number; totalRecibos?: number;
  } | null;

  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showAgent, setShowAgent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const accentColor = office?.accent_color || '#0F4C81';
  const agentName = agent ? `${agent.nombre} ${agent.apellidos}` : office?.nombre || 'tu agente';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!customer) return;
    initConversation();
  }, [customer]);

  async function initConversation() {
    const titulo = polizaCtx?.polizaNumero
      ? `Póliza ${polizaCtx.polizaNumero} - ${polizaCtx.aseguradora}`
      : polizaCtx?.modulo === 'cobranza' ? 'Consulta de cobranza'
      : 'Consulta general';

    const { data } = await supabase
      .from('seguwallet_chava_conversations')
      .insert({
        customer_id: customer!.id,
        titulo,
        modulo: polizaCtx?.modulo || (polizaCtx?.polizaId ? 'poliza' : 'general'),
        context_poliza: polizaCtx?.polizaNumero || null,
        context_extra: polizaCtx || null,
      })
      .select('id')
      .maybeSingle();

    if (data) {
      setConversacionId(data.id);
      // Build welcome message
      const welcome = buildWelcome();
      const welcomeMsg: Message = {
        id: 'welcome',
        role: 'assistant',
        content: welcome,
        created_at: new Date().toISOString(),
      };
      setMessages([welcomeMsg]);
      // Save welcome msg to DB
      await supabase.from('seguwallet_chava_messages').insert({
        conversacion_id: data.id,
        rol: 'assistant',
        contenido: welcome,
      });
    }
  }

  function buildWelcome(): string {
    const firstName = customer?.full_name?.split(' ')[0] || 'hola';
    if (polizaCtx?.polizaNumero) {
      return `Hola ${firstName}, soy Chava. Estoy revisando tu póliza de **${polizaCtx.ramo || 'seguro'}** con **${polizaCtx.aseguradora}** (${polizaCtx.polizaNumero}). ¿Qué quieres saber sobre ella?`;
    }
    if (polizaCtx?.modulo === 'cobranza') {
      return `Hola ${firstName}, soy Chava. Veo que tienes **${polizaCtx.totalRecibos} recibo${(polizaCtx.totalRecibos || 0) !== 1 ? 's' : ''}** pendientes por un total aproximado. ¿Quieres que te explique los detalles de tus pagos?`;
    }
    if (polizaCtx?.modulo === 'documentos') {
      return `Hola ${firstName}, soy Chava. Estoy aquí para ayudarte a entender tus documentos de seguros. ¿Tienes alguna duda sobre tus pólizas, condiciones generales o trámites?`;
    }
    return `Hola ${firstName}, soy **Chava**, tu asistente digital de seguros. Estoy aquí para ayudarte con tus pólizas, pagos, coberturas y cualquier duda sobre tus seguros. ¿En qué puedo ayudarte hoy?`;
  }

  async function sendMessage(text?: string) {
    const userInput = (text || input).trim();
    if (!userInput || sending || !conversacionId || !customer) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: userInput,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    // Save user message
    await supabase.from('seguwallet_chava_messages').insert({
      conversacion_id: conversacionId,
      rol: 'user',
      contenido: userInput,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seguwallet-chava`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            pregunta: userInput,
            conversacion_id: conversacionId,
            customer_id: customer.id,
            poliza_contexto: polizaCtx?.polizaNumero || null,
            context_extra: polizaCtx || null,
          }),
        }
      );

      const json = await res.json();
      const respuesta = json.respuesta || json.error || 'Lo siento, no pude procesar tu pregunta en este momento. Por favor intenta de nuevo.';

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: respuesta,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Save assistant message
      await supabase.from('seguwallet_chava_messages').insert({
        conversacion_id: conversacionId,
        rol: 'assistant',
        contenido: respuesta,
        tokens_usados: json.tokens || null,
      });

      // Audit log
      await supabase.from('seguwallet_chava_audit').insert({
        customer_id: customer.id,
        conversacion_id: conversacionId,
        pregunta: userInput,
        respuesta,
        poliza_contexto: polizaCtx?.polizaNumero || null,
        modelo: json.modelo || 'gpt-4o-mini',
        tokens_entrada: json.tokens_entrada || null,
        tokens_salida: json.tokens_salida || null,
        tiempo_respuesta_ms: json.tiempo_ms || null,
        modo_usado: json.modo || 'hybrid',
      });

    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Hubo un problema al conectar con Chava. Por favor verifica tu conexión e intenta de nuevo.',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function resetConversation() {
    setMessages([]);
    setConversacionId(null);
    initConversation();
  }

  function renderContent(text: string) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-7rem)] max-h-[800px]">
        {/* Chava header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-800">Chava</p>
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              En línea · Asistente digital de seguros
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAgent(s => !s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              Mi agente
              <ChevronDown className={`w-3 h-3 transition-transform ${showAgent ? 'rotate-180' : ''}`} />
            </button>
            <button onClick={resetConversation}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Nueva conversación">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Agent panel */}
        {showAgent && (agent || office) && (
          <div className="my-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            {agent?.imagen_perfil_url ? (
              <img src={agent.imagen_perfil_url} alt={agentName} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-slate-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 text-sm">{agentName}</p>
              {office?.nombre && <p className="text-xs text-slate-500">{office.nombre}</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                {(agent?.celular_laboral || office?.telefono) && (
                  <a href={`tel:${agent?.celular_laboral || office?.telefono}`}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                    <Phone className="w-3 h-3" />Llamar
                  </a>
                )}
                {(agent?.celular_laboral || office?.whatsapp) && (
                  <a href={`https://wa.me/${(agent?.celular_laboral || office?.whatsapp || '').replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                    <MessageCircle className="w-3 h-3" />WhatsApp
                  </a>
                )}
                {(agent?.email_laboral || office?.email) && (
                  <a href={`mailto:${agent?.email_laboral || office?.email}`}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
                    <Mail className="w-3 h-3" />Email
                  </a>
                )}
                {(agent?.url_web_jiro || office?.sitio_web) && (
                  <a href={agent?.url_web_jiro || office?.sitio_web || '#'} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
                    <Globe className="w-3 h-3" />Web
                  </a>
                )}
              </div>
            </div>
            <button onClick={() => setShowAgent(false)} className="text-slate-300 hover:text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}>
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-md'
                  : 'bg-white border border-slate-100 text-slate-800 rounded-tl-md shadow-sm'
              }`}>
                <span dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }} />
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mr-2"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-sm text-slate-400">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-slate-300 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-xs">Chava está pensando...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions */}
        {messages.length <= 1 && !sending && (
          <div className="pb-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-end gap-2 bg-white rounded-2xl border border-slate-200 px-4 py-3 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..."
              rows={1}
              className="flex-1 text-sm text-slate-800 placeholder-slate-400 resize-none outline-none bg-transparent leading-relaxed max-h-24"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all flex-shrink-0 disabled:opacity-40 hover:opacity-90 active:scale-95"
              style={{ background: input.trim() ? `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` : '#CBD5E1' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-center text-slate-300 mt-2">
            Chava proporciona orientación general. Para decisiones importantes, consulta con tu agente.
          </p>
        </div>
      </div>
    </Layout>
  );
}
