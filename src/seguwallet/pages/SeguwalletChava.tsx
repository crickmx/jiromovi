import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Sparkles, FileText, Shield, CreditCard, Phone, X, ChevronDown, ChevronUp, CircleAlert as AlertCircle, User, RefreshCw, MessageCircle, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand } from '../lib/AgentBrandContext';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: SourceInfo[];
  confidence?: 'alta' | 'media' | 'baja';
}

interface SourceInfo {
  tipo: string;
  descripcion: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Shield;
  prompt: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'polizas',
    label: 'Mis pólizas',
    icon: FileText,
    prompt: '¿Cuáles son mis pólizas activas y cuándo vencen?',
    color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100',
  },
  {
    id: 'coberturas',
    label: 'Mis coberturas',
    icon: Shield,
    prompt: '¿Qué coberturas tengo contratadas en mis seguros?',
    color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100',
  },
  {
    id: 'pagos',
    label: 'Estado de pagos',
    icon: CreditCard,
    prompt: '¿Tengo pagos pendientes o próximos a vencer?',
    color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100',
  },
  {
    id: 'agente',
    label: 'Contactar agente',
    icon: Phone,
    prompt: '¿Cómo puedo contactar a mi agente de seguros?',
    color: 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-100',
  },
  {
    id: 'siniestro',
    label: 'Reportar siniestro',
    icon: AlertCircle,
    prompt: '¿Cómo reporto un siniestro y cuáles son los pasos a seguir?',
    color: 'bg-red-50 text-red-700 hover:bg-red-100 border-red-100',
  },
  {
    id: 'renovar',
    label: 'Renovar póliza',
    icon: RefreshCw,
    prompt: '¿Cuáles de mis pólizas están próximas a vencer y cómo las renuevo?',
    color: 'bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-100',
  },
];

// ── AI Disclaimer component ──────────────────────────────────────────────────
function AIDisclaimer() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-amber-50/60 border border-amber-100 rounded-xl px-4 py-2.5 text-xs text-amber-800">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
        <div className="flex-1 min-w-0">
          <p className="leading-relaxed">
            Chava utiliza Inteligencia Artificial para generar respuestas. La información puede contener
            errores — verifica datos importantes con tu agente.
          </p>
          {expanded && (
            <div className="mt-2 space-y-1.5 text-amber-700/80">
              <p>• Las respuestas sobre pólizas se basan en la información registrada en tu cuenta.</p>
              <p>• Para dudas legales o sobre siniestros, consulta directamente con tu agente.</p>
              <p>• Los montos y fechas son informativos; el documento oficial de tu póliza prevalece.</p>
            </div>
          )}
          <button onClick={() => setExpanded(!expanded)}
            className="mt-1 text-amber-600 font-medium hover:text-amber-700 flex items-center gap-1">
            {expanded ? 'Menos información' : 'Más información'}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Source tag ────────────────────────────────────────────────────────────────
function ConfidenceBadge({ level }: { level: 'alta' | 'media' | 'baja' }) {
  const config = {
    alta: { color: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Alta confianza' },
    media: { color: 'text-amber-600', dot: 'bg-amber-500', label: 'Confianza media' },
    baja: { color: 'text-red-500', dot: 'bg-red-500', label: 'Confianza baja' },
  }[level];

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────
function MessageBubble({ message, agentName }: { message: ChatMessage; agentName: string }) {
  const isUser = message.role === 'user';
  const [showSources, setShowSources] = useState(false);

  // Render markdown-like formatting
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
      }
      if (line.startsWith('• ') || line.startsWith('- ')) {
        return <p key={i} className="pl-2">{line}</p>;
      }
      if (line.trim() === '') return <div key={i} className="h-2" />;
      return <p key={i}>{line}</p>;
    });
  };

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
          <User className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      <div className={cn('max-w-[80%] space-y-1', isUser ? 'items-end flex flex-col' : 'items-start flex flex-col')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm shadow-sm'
            : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm shadow-sm'
        )}>
          <div className="space-y-1">{renderContent(message.content)}</div>
        </div>

        {/* Footer for assistant messages */}
        {!isUser && (
          <div className="flex items-center gap-3 px-1">
            <span className="text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {message.confidence && <ConfidenceBadge level={message.confidence} />}
            {(message.sources || []).length > 0 && (
              <button onClick={() => setShowSources(!showSources)}
                className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 font-medium">
                <FileText className="w-3 h-3" />
                {(message.sources || []).length} fuente{(message.sources || []).length > 1 ? 's' : ''}
                {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        )}

        {/* Sources panel */}
        {!isUser && showSources && (message.sources || []).length > 0 && (
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-xs space-y-1.5 w-full max-w-sm">
            <p className="font-semibold text-gray-600 mb-2">Fuentes utilizadas</p>
            {(message.sources || []).map((src, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-gray-700">{src.tipo}: </span>
                  <span className="text-gray-500">{src.descripcion}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white rounded-2xl rounded-tl-sm border border-gray-100 px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center">
          <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SeguwalletChava() {
  const { customer } = useSeguwallet();
  const { brand } = useAgentBrand();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasGreeted = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Auto-greet on mount
  useEffect(() => {
    if (!hasGreeted.current && customer) {
      hasGreeted.current = true;
      const firstName = customer.full_name?.split(' ')[0] || 'cliente';
      const greeting: ChatMessage = {
        id: 'greeting',
        role: 'assistant',
        content: `Hola ${firstName}, soy Chava, tu asistente de seguros de ${brand.agentName || 'tu agente'}.\n\nPuedo ayudarte con información sobre tus pólizas, coberturas, pagos, renovaciones y más. ¿En qué te puedo ayudar hoy?`,
        timestamp: new Date(),
        confidence: 'alta',
        sources: [
          { tipo: 'Perfil', descripcion: 'Datos de tu cuenta Seguwallet' },
          { tipo: 'Agente', descripcion: `Información de ${brand.agentName || 'tu agente'}` },
        ],
      };
      setMessages([greeting]);
    }
  }, [customer, brand.agentName]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isTyping) return;
    setInput('');
    setError(null);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sin sesión activa');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seguwallet-chava`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pregunta: msg,
          conversacion_id: conversationId || `sw-${Date.now()}`,
          customer_id: customer?.id,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }

      const data = await response.json();

      // Build sources list from the response fuentes
      const sources: SourceInfo[] = (data.fuentes || []).slice(0, 4).map((f: any) => ({
        tipo: f.tipo || 'Fuente',
        descripcion: f.descripcion || f.documento || 'Información',
      }));
      if (sources.length === 0) sources.push({ tipo: 'IA General', descripcion: 'Conocimiento de Chava IA' });

      const confidence: 'alta' | 'media' | 'baja' = data.confianza_general || 'media';

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.respuesta || 'Sin respuesta',
        timestamp: new Date(),
        sources,
        confidence,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message || 'Error al procesar tu mensaje');
      console.error('Chava Seguwallet error:', err);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, conversationId, customer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showWelcome = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-sm flex-shrink-0">
          <Sparkles className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 text-base leading-none">Chava IA</h1>
          <p className="text-xs text-gray-500 mt-0.5">Tu asistente de seguros inteligente</p>
        </div>
        {brand.agentName && brand.agentName !== 'Tu Agente' && (
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400">Agente</p>
            <p className="text-xs font-semibold text-gray-700 truncate max-w-[120px]">{brand.agentName}</p>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {showWelcome && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Chava IA</h2>
            <p className="text-sm text-gray-500 max-w-xs">
              Tu asistente inteligente de seguros. Pregúntame sobre tus pólizas, coberturas, pagos o cualquier duda.
            </p>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} agentName={brand.agentName || 'Chava'} />
        ))}

        {isTyping && <TypingIndicator />}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">No pude procesar tu mensaje</p>
              <p className="text-xs text-red-500 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto flex-shrink-0">
              <X className="w-4 h-4 text-red-400 hover:text-red-600" />
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick action chips */}
      {messages.length <= 1 && !isTyping && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-400 font-medium mb-2 flex items-center gap-1.5">
            <Zap className="w-3 h-3" />Acciones rápidas
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => sendMessage(action.prompt)}
                  disabled={isTyping}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    action.color,
                    isTyping && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Disclaimer */}
      <div className="px-4 pb-2">
        <AIDisclaimer />
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 safe-area-bottom">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-3 py-2 focus-within:border-gray-300 focus-within:bg-white transition-all">
          <MessageCircle className="w-4 h-4 text-gray-400 mb-1 flex-shrink-0" />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            rows={1}
            disabled={isTyping}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none max-h-28 leading-relaxed"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isTyping}
            className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
              input.trim() && !isTyping
                ? 'bg-slate-800 text-white shadow-sm hover:bg-slate-900'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-center text-xs text-gray-300 mt-2">
          Powered by Chava IA — MOVI Digital
        </p>
      </div>
    </div>
  );
}
