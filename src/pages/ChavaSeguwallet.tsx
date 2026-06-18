import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Send, RotateCcw, Phone, Mail, MessageCircle, Globe, X,
  ChevronDown, FileText, CreditCard, Shield, TriangleAlert as AlertTriangle,
  BookOpen, User, Database, Server, Brain, ChevronUp, ExternalLink, Info,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Fuente {
  tipo: 'seguwallet' | 'sicas' | 'movi' | 'conocimiento' | 'internet' | 'ia';
  descripcion: string;
  modulo?: string;
  documento?: string;
  url?: string;
  fecha_actualizacion?: string;
  confianza: 'alta' | 'media' | 'baja';
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  fuentes?: Fuente[];
  confianza_general?: 'alta' | 'media' | 'baja';
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

const FUENTE_CONFIG: Record<Fuente['tipo'], {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
}> = {
  seguwallet: {
    label: 'Seguwallet',
    icon: <Shield className="w-3 h-3" />,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  sicas: {
    label: 'SICAS',
    icon: <Database className="w-3 h-3" />,
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-100',
  },
  movi: {
    label: 'MOVI',
    icon: <Server className="w-3 h-3" />,
    color: 'text-neutral-700 dark:text-white/70',
    bg: 'bg-neutral-100 dark:bg-white/8',
    border: 'border-neutral-200 dark:border-white/10',
  },
  conocimiento: {
    label: 'Base de conocimiento',
    icon: <BookOpen className="w-3 h-3" />,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  internet: {
    label: 'Internet',
    icon: <Globe className="w-3 h-3" />,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  ia: {
    label: 'Inferencia IA',
    icon: <Brain className="w-3 h-3" />,
    color: 'text-neutral-500 dark:text-white/50',
    bg: 'bg-neutral-50 dark:bg-white/4',
    border: 'border-neutral-100 dark:border-white/8',
  },
};

const CONFIANZA_CONFIG = {
  alta:  { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Alta confianza' },
  media: { dot: 'bg-amber-400',   text: 'text-amber-700',   label: 'Confianza media' },
  baja:  { dot: 'bg-red-400',     text: 'text-red-600',     label: 'Baja confianza' },
};

function FuenteChip({ fuente }: { fuente: Fuente }) {
  const cfg = FUENTE_CONFIG[fuente.tipo];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function FuentesPanel({ fuentes, confianza }: { fuentes: Fuente[]; confianza?: 'alta' | 'media' | 'baja' }) {
  const [open, setOpen] = useState(false);
  const conf = confianza ? CONFIANZA_CONFIG[confianza] : null;

  return (
    <div className="mt-2">
      {/* Source chips row */}
      <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
        {fuentes.map((f, i) => <FuenteChip key={i} fuente={f} />)}
        {conf && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${conf.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
            {conf.label}
          </span>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1 text-xs text-neutral-400 dark:text-white/30 hover:text-neutral-600 dark:hover:text-white/60 transition-colors ml-auto"
        >
          <Info className="w-3 h-3" />
          {open ? 'Ocultar fuentes' : 'Ver fuentes'}
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="rounded-xl border border-neutral-100 dark:border-white/8 bg-neutral-50 dark:bg-white/3 divide-y divide-neutral-100 dark:divide-white/5 overflow-hidden text-xs">
          {fuentes.map((f, i) => {
            const cfg = FUENTE_CONFIG[f.tipo];
            const fConf = CONFIANZA_CONFIG[f.confianza];
            return (
              <div key={i} className="px-3 py-2 flex items-start gap-2">
                <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
                    {f.modulo && (
                      <span className="text-neutral-400 dark:text-white/30">· {f.modulo}</span>
                    )}
                    <span className={`inline-flex items-center gap-0.5 ${fConf.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${fConf.dot}`} />
                      {fConf.label}
                    </span>
                  </div>
                  <p className="text-neutral-500 dark:text-white/50 mt-0.5 leading-snug">{f.descripcion}</p>
                  {f.documento && (
                    <p className="text-neutral-400 dark:text-white/30 mt-0.5">Documento: {f.documento}</p>
                  )}
                  {f.fecha_actualizacion && (
                    <p className="text-neutral-400 dark:text-white/30 mt-0.5">
                      Actualizado: {new Date(f.fecha_actualizacion).toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                  {f.url && (
                    <a href={f.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline mt-0.5">
                      <ExternalLink className="w-2.5 h-2.5" />
                      Ver fuente
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          <div className="px-3 py-2 text-neutral-400 dark:text-white/30 bg-white dark:bg-neutral-800/60">
            Chava usa exclusivamente información real de tus cuentas vinculadas. La IA complementa con conocimiento general de seguros cuando corresponde.
          </div>
        </div>
      )}
    </div>
  );
}

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
      const welcome = buildWelcome();
      const welcomeMsg: Message = {
        id: 'welcome',
        role: 'assistant',
        content: welcome,
        created_at: new Date().toISOString(),
      };
      setMessages([welcomeMsg]);
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
      return `Hola ${firstName}, soy Chava. Veo que tienes **${polizaCtx.totalRecibos} recibo${(polizaCtx.totalRecibos || 0) !== 1 ? 's' : ''}** pendientes. ¿Quieres que te explique los detalles de tus pagos?`;
    }
    if (polizaCtx?.modulo === 'documentos') {
      return `Hola ${firstName}, soy Chava. Estoy aquí para ayudarte a entender tus documentos de seguros. ¿Tienes alguna duda sobre tus pólizas, condiciones generales o trámites?`;
    }
    return `Hola ${firstName}, soy **Chava**, tu asistente digital de seguros. Estoy aquí para ayudarte con tus pólizas, pagos, coberturas y cualquier duda. ¿En qué puedo ayudarte hoy?`;
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
      const respuesta = json.respuesta || json.error || 'Lo siento, no pude procesar tu pregunta. Por favor intenta de nuevo.';

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: respuesta,
        created_at: new Date().toISOString(),
        fuentes: json.fuentes || [],
        confianza_general: json.confianza_general,
      };
      setMessages(prev => [...prev, assistantMsg]);

      await supabase.from('seguwallet_chava_messages').insert({
        conversacion_id: conversacionId,
        rol: 'assistant',
        contenido: respuesta,
        tokens_usados: json.tokens || null,
      });

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
        fuentes_rag: json.fuentes ? JSON.stringify(json.fuentes) : null,
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
    <>
      <div className="flex flex-col h-[calc(100vh-7rem)] max-h-[800px]">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-white/8">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #0D6EFD 0%, #0A183D 100%)' }}>
              {/* Mini elephant icon */}
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                <ellipse cx="5" cy="11" rx="3.5" ry="5" fill="#1a3a6e" />
                <ellipse cx="19" cy="11" rx="3.5" ry="5" fill="#1a3a6e" />
                <ellipse cx="12" cy="11" rx="7.5" ry="7" fill="#1a3a6e" />
                <circle cx="9.5" cy="9.5" r="1.6" fill="#00E5FF" />
                <circle cx="14.5" cy="9.5" r="1.6" fill="#00E5FF" />
                <circle cx="9.5" cy="9.5" r="0.7" fill="#002233" />
                <circle cx="14.5" cy="9.5" r="0.7" fill="#002233" />
                <circle cx="10" cy="9" r="0.45" fill="white" opacity="0.9" />
                <circle cx="15" cy="9" r="0.45" fill="white" opacity="0.9" />
                <path d="M10.5 13.5 Q12 15 13.5 13.5" stroke="#00E5FF" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.7" />
              </svg>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-neutral-800 dark:text-white">Chava</p>
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              En línea · Asistente digital de seguros
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAgent(s => !s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 text-xs text-neutral-600 dark:text-white/60 hover:bg-neutral-50 dark:hover:bg-white/4 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              Mi agente
              <ChevronDown className={`w-3 h-3 transition-transform ${showAgent ? 'rotate-180' : ''}`} />
            </button>
            <button onClick={resetConversation}
              className="p-1.5 rounded-xl text-neutral-400 dark:text-white/30 hover:text-neutral-600 dark:hover:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/8 transition-colors"
              title="Nueva conversación">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Agent panel */}
        {showAgent && (agent || office) && (
          <div className="my-3 p-4 rounded-2xl bg-neutral-50 dark:bg-white/4 border border-neutral-100 dark:border-white/8 flex items-start gap-3">
            {agent?.imagen_perfil_url ? (
              <img src={agent.imagen_perfil_url} alt={agentName} crossOrigin="anonymous" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-neutral-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-neutral-400 dark:text-white/30" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-neutral-800 dark:text-white text-sm">{agentName}</p>
              {office?.nombre && <p className="text-xs text-neutral-500 dark:text-white/50">{office.nombre}</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                {(agent?.celular_laboral || office?.telefono) && (
                  <a href={`tel:${agent?.celular_laboral || office?.telefono}`}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                    <Phone className="w-3 h-3" />Llamar
                  </a>
                )}
                {(agent?.celular_laboral || office?.whatsapp) && (
                  <a href={`https://wa.me/${(agent?.celular_laboral || office?.whatsapp || '').replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
                    <MessageCircle className="w-3 h-3" />WhatsApp
                  </a>
                )}
                {(agent?.email_laboral || office?.email) && (
                  <a href={`mailto:${agent?.email_laboral || office?.email}`}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-white/8 text-neutral-700 dark:text-white/60 hover:bg-neutral-200 dark:hover:bg-white/12 transition-colors">
                    <Mail className="w-3 h-3" />Email
                  </a>
                )}
                {(agent?.url_web_jiro || office?.sitio_web) && (
                  <a href={agent?.url_web_jiro || office?.sitio_web || '#'} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-white/8 text-neutral-700 dark:text-white/60 hover:bg-neutral-200 dark:hover:bg-white/12 transition-colors">
                    <Globe className="w-3 h-3" />Web
                  </a>
                )}
              </div>
            </div>
            <button onClick={() => setShowAgent(false)} className="text-neutral-300 dark:text-white/20 hover:text-neutral-500 dark:hover:text-white/50">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 shadow-sm overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #0D6EFD 0%, #0A183D 100%)' }}>
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                    <ellipse cx="4.5" cy="11" rx="3" ry="4.5" fill="#1a3a6e" />
                    <ellipse cx="19.5" cy="11" rx="3" ry="4.5" fill="#1a3a6e" />
                    <ellipse cx="12" cy="11" rx="7.5" ry="7" fill="#1a3a6e" />
                    <circle cx="9.5" cy="9.5" r="1.6" fill="#00E5FF" />
                    <circle cx="14.5" cy="9.5" r="1.6" fill="#00E5FF" />
                    <circle cx="9.5" cy="9.5" r="0.7" fill="#002233" />
                    <circle cx="14.5" cy="9.5" r="0.7" fill="#002233" />
                  </svg>
                </div>
              )}
              <div className={`max-w-[80%] ${msg.role === 'user' ? '' : 'flex-1'}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'text-white rounded-tr-md'
                    : 'bg-white dark:bg-neutral-800/60 border border-neutral-100 dark:border-white/8 text-neutral-800 dark:text-white rounded-tl-md shadow-sm'
                }`} style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' } : {}}>
                  <span dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }} />
                </div>
                {/* Citations panel — only for assistant messages with sources */}
                {msg.role === 'assistant' && msg.fuentes && msg.fuentes.length > 0 && (
                  <div className="mt-1 px-1">
                    <FuentesPanel fuentes={msg.fuentes} confianza={msg.confianza_general} />
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mr-2 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0D6EFD 0%, #0A183D 100%)' }}>
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                  <ellipse cx="4.5" cy="11" rx="3" ry="4.5" fill="#1a3a6e" />
                  <ellipse cx="19.5" cy="11" rx="3" ry="4.5" fill="#1a3a6e" />
                  <ellipse cx="12" cy="11" rx="7.5" ry="7" fill="#1a3a6e" />
                  <circle cx="9.5" cy="9.5" r="1.6" fill="#00E5FF" />
                  <circle cx="14.5" cy="9.5" r="1.6" fill="#00E5FF" />
                  <circle cx="9.5" cy="9.5" r="0.7" fill="#002233" />
                  <circle cx="14.5" cy="9.5" r="0.7" fill="#002233" />
                </svg>
              </div>
              <div className="bg-white dark:bg-neutral-800/60 border border-neutral-100 dark:border-white/8 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-sm text-neutral-400 dark:text-white/30">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-white/20 animate-bounce"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 text-xs text-neutral-600 dark:text-white/60 bg-white dark:bg-neutral-800/60 hover:bg-neutral-50 dark:hover:bg-white/4 hover:border-neutral-300 dark:hover:border-white/15 transition-all"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="pt-3 border-t border-neutral-100 dark:border-white/8">
          <div className="flex items-end gap-2 bg-white dark:bg-neutral-800/60 rounded-2xl border border-neutral-200 dark:border-white/10 px-4 py-3 focus-within:border-blue-300 dark:focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-500/10 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..."
              rows={1}
              className="flex-1 text-sm text-neutral-800 dark:text-white placeholder-neutral-400 dark:placeholder-white/30 resize-none outline-none bg-transparent leading-relaxed max-h-24"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all flex-shrink-0 disabled:opacity-40 hover:opacity-90 active:scale-95"
              style={{ background: input.trim() ? 'linear-gradient(135deg, #0D6EFD, #00c8e0)' : 'rgb(212 212 212)' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-center text-neutral-300 dark:text-white/20 mt-2">
            Chava indica siempre las fuentes de la información. Para decisiones importantes, consulta con tu agente.
          </p>
        </div>
      </div>
    </>
  );
}
