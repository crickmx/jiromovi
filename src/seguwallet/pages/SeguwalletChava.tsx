import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, FileText, Shield, CreditCard, Phone, X, ChevronDown, ChevronUp, CircleAlert as AlertCircle, RefreshCw, Zap, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand } from '../lib/AgentBrandContext';
import { cn } from '@/lib/utils';
import { ChavaAvatar } from '../../components/chava/ChavaAvatar';

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
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'polizas',   label: 'Mis pólizas',      icon: FileText,    prompt: '¿Cuáles son mis pólizas activas y cuándo vencen?' },
  { id: 'coberturas',label: 'Mis coberturas',    icon: Shield,      prompt: '¿Qué coberturas tengo contratadas en mis seguros?' },
  { id: 'pagos',     label: 'Estado de pagos',   icon: CreditCard,  prompt: '¿Tengo pagos pendientes o próximos a vencer?' },
  { id: 'agente',    label: 'Contactar agente',  icon: Phone,       prompt: '¿Cómo puedo contactar a mi agente de seguros?' },
  { id: 'siniestro', label: 'Reportar siniestro',icon: AlertCircle, prompt: '¿Cómo reporto un siniestro y cuáles son los pasos a seguir?' },
  { id: 'renovar',   label: 'Renovar póliza',    icon: RefreshCw,   prompt: '¿Cuáles de mis pólizas están próximas a vencer y cómo las renuevo?' },
];

// ── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ level }: { level: 'alta' | 'media' | 'baja' }) {
  const c = {
    alta:  { color: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Alta confianza' },
    media: { color: 'text-amber-400',   dot: 'bg-amber-400',   label: 'Confianza media' },
    baja:  { color: 'text-red-400',     dot: 'bg-red-400',     label: 'Confianza baja' },
  }[level];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-1.5">
        {lines.map((line, i) => {
          if (line.trim() === '') return <div key={i} className="h-1" />;
          const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          if (line.trimStart().startsWith('•') || line.trimStart().startsWith('-')) {
            return (
              <div key={i} className="flex gap-2 leading-relaxed">
                <span className="opacity-40 flex-shrink-0 mt-0.5">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatted.replace(/^[\s•\-]+/, '') }} />
              </div>
            );
          }
          return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} className="leading-relaxed" />;
        })}
      </div>
    );
  };

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      {isUser ? (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(13,110,253,0.3)', border: '1px solid rgba(13,110,253,0.4)' }}>
          <span className="text-xs font-bold text-white">T</span>
        </div>
      ) : (
        <ChavaAvatar size="sm" className="flex-shrink-0 mt-0.5" />
      )}

      <div className={cn('max-w-[82%] group flex flex-col', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn('relative rounded-2xl px-4 py-3 text-sm leading-relaxed', isUser ? 'rounded-tr-sm text-white' : 'rounded-tl-sm')}
          style={isUser
            ? { background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' }
            : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }
          }
        >
          {renderContent(message.content)}

          {/* Copy btn for assistant */}
          {!isUser && (
            <button
              onClick={copy}
              className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />}
            </button>
          )}
        </div>

        {/* Footer */}
        {!isUser && (
          <div className="flex items-center gap-3 px-1 mt-1.5">
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {message.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {message.confidence && <ConfidenceBadge level={message.confidence} />}
            {(message.sources || []).length > 0 && (
              <button onClick={() => setShowSources(!showSources)} className="text-[10px] font-medium flex items-center gap-1 transition-colors" style={{ color: 'rgba(0,229,255,0.7)' }}>
                <FileText className="w-3 h-3" />
                {(message.sources || []).length} fuente{(message.sources || []).length > 1 ? 's' : ''}
                {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        )}

        {/* Sources panel */}
        {!isUser && showSources && (message.sources || []).length > 0 && (
          <div className="mt-1 rounded-xl p-3 text-xs space-y-1.5 w-full" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Fuentes utilizadas</p>
            {(message.sources || []).map((src, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'rgba(0,229,255,0.5)' }} />
                <div>
                  <span className="font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{src.tipo}: </span>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>{src.descripcion}</span>
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
      <ChavaAvatar size="sm" animate className="flex-shrink-0 mt-0.5" />
      <div className="rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex gap-1 items-center">
          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'rgba(0,229,255,0.7)', animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'rgba(0,229,255,0.7)', animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'rgba(0,229,255,0.7)', animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── AI Disclaimer ─────────────────────────────────────────────────────────────
function AIDisclaimer() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
      <div className="flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-400" />
        <div className="flex-1 min-w-0">
          <p className="leading-relaxed text-amber-200/80">
            Chava utiliza IA para generar respuestas. La informacion puede contener errores — verifica datos importantes con tu agente.
          </p>
          {expanded && (
            <div className="mt-2 space-y-1.5 text-amber-200/60">
              <p>• Las respuestas sobre polizas se basan en la informacion registrada en tu cuenta.</p>
              <p>• Para dudas legales o sobre siniestros, consulta directamente con tu agente.</p>
              <p>• Los montos y fechas son informativos; el documento oficial de tu poliza prevalece.</p>
            </div>
          )}
          <button onClick={() => setExpanded(!expanded)} className="mt-1 text-amber-400/70 font-medium hover:text-amber-400 flex items-center gap-1 transition-colors">
            {expanded ? 'Menos informacion' : 'Mas informacion'}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!hasGreeted.current && customer) {
      hasGreeted.current = true;
      const firstName = customer.full_name?.split(' ')[0] || 'cliente';
      const greeting: ChatMessage = {
        id: 'greeting',
        role: 'assistant',
        content: `Hola ${firstName}, soy Chava, tu asistente de seguros de ${brand.agentName || 'tu agente'}.\n\nPuedo ayudarte con informacion sobre tus polizas, coberturas, pagos, renovaciones y mas. ¿En que te puedo ayudar hoy?`,
        timestamp: new Date(),
        confidence: 'alta',
        sources: [
          { tipo: 'Perfil', descripcion: 'Datos de tu cuenta Seguwallet' },
          { tipo: 'Agente', descripcion: `Informacion de ${brand.agentName || 'tu agente'}` },
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

    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sin sesion activa');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seguwallet-chava`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: msg, conversacion_id: conversationId || `sw-${Date.now()}`, customer_id: customer?.id }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }

      const data = await response.json();
      const sources: SourceInfo[] = (data.fuentes || []).slice(0, 4).map((f: any) => ({
        tipo: f.tipo || 'Fuente',
        descripcion: f.descripcion || f.documento || 'Informacion',
      }));
      if (sources.length === 0) sources.push({ tipo: 'IA General', descripcion: 'Conocimiento de Chava IA' });

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.respuesta || 'Sin respuesta',
        timestamp: new Date(),
        sources,
        confidence: data.confianza_general || 'media',
      }]);
    } catch (err: any) {
      setError(err.message || 'Error al procesar tu mensaje');
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, conversationId, customer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 112) + 'px';
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'linear-gradient(160deg, #060f25 0%, #0A183D 60%, #071020 100%)' }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-10 right-1/3 w-[300px] h-[200px]" style={{ background: 'radial-gradient(ellipse, rgba(13,110,253,0.1) 0%, transparent 70%)' }} />
      </div>

      {/* Header */}
      <div className="relative flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <ChavaAvatar size="sm" animate />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <img src="/logo_color.svg" alt="Chava AI" className="h-4 w-auto object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
              agentedeseguros.ai
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Tu asistente de seguros inteligente</p>
          </div>
        </div>
        {brand.agentName && brand.agentName !== 'Tu Agente' && (
          <div className="text-right hidden sm:block flex-shrink-0">
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Agente</p>
            <p className="text-xs font-semibold truncate max-w-[120px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{brand.agentName}</p>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 chava-sw-scroll">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ChavaAvatar size="xl" animate />
            <h2 className="text-lg font-bold mt-5 mb-1 text-white/90">Chava IA</h2>
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Tu asistente inteligente de seguros. Preguntame sobre tus polizas, coberturas, pagos o cualquier duda.
            </p>
          </div>
        )}

        {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
        {isTyping && <TypingIndicator />}

        {error && (
          <div className="rounded-xl p-3 flex items-start gap-2 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="font-medium text-red-300">No pude procesar tu mensaje</p>
              <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto flex-shrink-0">
              <X className="w-4 h-4 text-red-400/60 hover:text-red-400 transition-colors" />
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick action chips */}
      {messages.length <= 1 && !isTyping && (
        <div className="px-4 pb-3 flex-shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <Zap className="w-3 h-3" />Acciones rapidas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => sendMessage(action.prompt)}
                  disabled={isTyping}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-40"
                  style={{ border: '1px solid rgba(0,229,255,0.15)', color: 'rgba(255,255,255,0.55)', background: 'rgba(0,229,255,0.04)' }}
                  onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(0,229,255,0.35)'; el.style.color = '#00E5FF'; el.style.background = 'rgba(0,229,255,0.08)'; }}
                  onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(0,229,255,0.15)'; el.style.color = 'rgba(255,255,255,0.55)'; el.style.background = 'rgba(0,229,255,0.04)'; }}
                >
                  <Icon className="w-3 h-3" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-4 pb-2 flex-shrink-0">
        <AIDisclaimer />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div
          className="flex items-end gap-2 rounded-2xl px-4 py-3 transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            rows={1}
            disabled={isTyping}
            className="flex-1 resize-none text-sm focus:outline-none bg-transparent leading-relaxed disabled:opacity-50"
            style={{ maxHeight: '112px', minHeight: '24px', color: 'rgba(255,255,255,0.88)', caretColor: '#00E5FF' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isTyping}
            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={input.trim() && !isTyping
              ? { background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)', color: 'white' }
              : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)', cursor: 'not-allowed' }
            }
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-center mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Powered by Chava IA — agentedeseguros.ai
        </p>
      </div>

      <style>{`
        .chava-sw-scroll::-webkit-scrollbar { width: 4px; }
        .chava-sw-scroll::-webkit-scrollbar-track { background: transparent; }
        .chava-sw-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .chava-sw-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,229,255,0.2); }
        .chava-sw-scroll textarea::placeholder { color: rgba(255,255,255,0.25) !important; }
      `}</style>
    </div>
  );
}
