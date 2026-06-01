import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, FileText, X, Trash2, Plus, History, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Copy, Check } from 'lucide-react';
import { useAssistant } from '../contexts/AssistantContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { getSuggestionsForRoute } from '../lib/suggestionsService';
import { formatRelativeTime } from '../lib/assistantUtils';
import { parseStructuredResponse, normalizeChavaResponse } from '../lib/responseParser';
import { sendChavaMessage } from '../lib/assistantService';
import type { AssistantSuggestion, AssistantMessage, RAGSource } from '../lib/assistantTypes';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { ResponseMessage } from '../components/assistant/ResponseMessage';
import { ChavaAvatar } from '../components/chava/ChavaAvatar';
import { trackAssistantOpened, trackAssistantPromptSent, trackAssistantQuickPrompt, trackAssistantResponse } from '../lib/activityLogger';
import { cn } from '@/lib/utils';
import type { WebSource } from '../lib/assistantTypes';

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.85) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Alta confianza
    </span>
  );
  if (confidence >= 0.70) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Confianza media
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />Confianza baja
    </span>
  );
}

function SourcesPanel({ sources, confidence, ragSources }: { sources: WebSource[]; confidence?: number; ragSources?: RAGSource[] }) {
  const [open, setOpen] = useState(false);
  const hasRag = ragSources && ragSources.length > 0;
  const hasWeb = sources.length > 0;
  const totalSources = (ragSources?.length || 0) + sources.length;
  if (!hasRag && !hasWeb && confidence === undefined) return null;
  return (
    <div className="mt-2 pt-2 border-t border-white/8">
      <div className="flex items-center justify-between gap-2">
        {confidence !== undefined && <ConfidenceBadge confidence={confidence} />}
        {totalSources > 0 && (
          <button
            onClick={() => setOpen(!open)}
            className="ml-auto flex items-center gap-1 text-[10px] text-white/30 hover:text-cyan-400 transition-colors font-medium"
          >
            {open ? 'Ocultar fuentes' : `Ver fuentes (${totalSources})`}
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>
      {open && (hasRag || hasWeb) && (
        <div className="mt-2 space-y-1.5">
          {hasRag && ragSources!.map((src, i) => (
            <div
              key={`rag-${i}`}
              className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/8"
            >
              <FileText className="w-3 h-3 text-cyan-400/60 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-white/60 truncate">{src.documento_titulo}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {src.carpeta && <span className="text-[10px] text-white/25">{src.carpeta}</span>}
                  <span className="text-[10px] text-cyan-400/50">{Math.round(src.similitud * 100)}% relevancia</span>
                </div>
              </div>
            </div>
          ))}
          {hasWeb && sources.map((src, i) => (
            <a
              key={`web-${i}`}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/8 hover:border-cyan-500/30 transition-colors group"
            >
              <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-cyan-400 mt-0.5 flex-shrink-0 transition-colors" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-white/60 group-hover:text-cyan-300 transition-colors truncate">{src.title}</p>
                {src.snippet && (
                  <p className="text-[10px] text-white/25 mt-0.5 line-clamp-2 leading-relaxed">{src.snippet}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Chava() {
  const {
    messages: contextMessages,
    conversations,
    conversationId,
    loadConversation,
    deleteConversation,
    startNewConversation,
    openAssistant,
    isLoadingMessages,
  } = useAssistant();

  const { usuario } = useAuth();
  const location = useLocation();
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [hasError, setHasError] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [localMessages, setLocalMessages] = useState<AssistantMessage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = localMessages.length > 0 ? localMessages : contextMessages;

  useEffect(() => {
    trackAssistantOpened();
    loadSuggestions();
  }, []);

  useEffect(() => {
    if (usuario?.id) openAssistant();
  }, [usuario?.id]);

  useEffect(() => {
    if (contextMessages.length > 0) {
      setLocalMessages(contextMessages);
      setShowWelcome(false);
    }
  }, [contextMessages]);

  useEffect(() => {
    if (messages.length > 0) setShowWelcome(false);
  }, [messages]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (conversationId) setTimeout(() => scrollToBottom('auto'), 100);
  }, [conversationId]);

  const loadSuggestions = async () => {
    const suggs = await getSuggestionsForRoute(location.pathname);
    setSuggestions(suggs);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  const doSend = async (overrideText?: string) => {
    const text = overrideText || inputText.trim();
    const files = overrideText ? [] : [...attachedFiles];
    if ((!text && files.length === 0) || isSendingMessage) return;

    if (!overrideText) { setInputText(''); setAttachedFiles([]); }
    setHasError(false);
    setShowWelcome(false);
    setIsSendingMessage(true);
    trackAssistantPromptSent(text);

    const tempUserId = `temp-user-${Date.now()}`;
    const messageText = files.length > 0 ? `${text}\n\n[${files.map(f => f.name).join(', ')}]` : text;

    const optimisticUserMessage: AssistantMessage = {
      id: tempUserId,
      conversacion_id: conversationId || '',
      rol: 'user',
      contenido: messageText,
      respuesta_estructurada_json: null,
      tiene_acciones: false,
      created_at: new Date().toISOString(),
    };
    setLocalMessages(prev => [...prev, optimisticUserMessage]);

    try {
      let uploadedFilePaths: string[] = [];
      if (files.length > 0) {
        const { supabase } = await import('../lib/supabase');
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${usuario?.id}/${fileName}`;
          const { error: uploadError } = await supabase.storage.from('assistant-files').upload(filePath, file);
          if (uploadError) throw new Error(`Error al subir archivo: ${file.name}`);
          uploadedFilePaths.push(filePath);
        }
      }

      const response = await sendChavaMessage({
        conversacion_id: conversationId || '',
        mensaje: text,
        modulo: 'chava',
        ruta: location.pathname,
        parametros: {},
        file_paths: uploadedFilePaths,
      });

      if (response) {
        setLocalMessages(prev => {
          const withoutTemp = prev.filter(m => m.id !== tempUserId);
          return [
            ...withoutTemp,
            { id: `msg-user-${Date.now()}`, conversacion_id: conversationId || '', rol: 'user', contenido: messageText, respuesta_estructurada_json: null, tiene_acciones: false, created_at: new Date().toISOString() },
            { id: response.mensaje_id || `msg-assistant-${Date.now()}`, conversacion_id: conversationId || '', rol: 'assistant', contenido: response.respuesta || '', respuesta_estructurada_json: response.respuesta_estructurada || null, tiene_acciones: false, modo_usado: response.modo_usado, rag_fuentes: response.fuentes, created_at: new Date().toISOString() },
          ];
        });
        trackAssistantResponse();
      } else {
        throw new Error('Sin respuesta de Chava');
      }
    } catch (error: any) {
      console.error('Error sending chava message:', error);
      setHasError(true);
      setLocalMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempUserId);
        return [...withoutTemp, { id: `temp-error-${Date.now()}`, conversacion_id: conversationId || '', rol: 'assistant', contenido: error.message || 'Error al procesar tu mensaje.', respuesta_estructurada_json: null, tiene_acciones: false, created_at: new Date().toISOString() }];
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSuggestionClick = async (suggestion: AssistantSuggestion) => {
    if (isSendingMessage) return;
    setShowWelcome(false);
    trackAssistantQuickPrompt(suggestion.texto_pregunta);
    await doSend(suggestion.texto_pregunta);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  };

  const handleDeleteConversation = async (convId: string) => {
    if (confirm('¿Eliminar esta conversacion?')) await deleteConversation(convId);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (file.size > 500 * 1024 * 1024) { alert(`El archivo ${file.name} excede el tamaño maximo de 500MB`); return false; }
      return true;
    });
    setAttachedFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNewChat = async () => {
    setShowWelcome(true);
    setHasError(false);
    setLocalMessages([]);
    await startNewConversation();
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isEmpty = messages.length === 0;
  const userName = usuario?.nombre || 'Usuario';

  return (
    <div
      className="h-[calc(100vh-8rem)] flex flex-col -mt-2 rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #060f25 0%, #0A183D 60%, #071020 100%)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        <div className="absolute -top-20 right-1/4 w-[400px] h-[300px]" style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(13,110,253,0.12) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-20 left-1/4 w-[300px] h-[300px]" style={{ background: 'radial-gradient(ellipse at 40% 100%, rgba(0,229,255,0.07) 0%, transparent 70%)' }} />
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-3.5">
          <ChavaAvatar size="md" animate />
          <div>
            <div className="flex items-center gap-2">
              <img src="/logo_color.svg" alt="Chava AI" className="h-5 w-auto object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                agentedeseguros.ai
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Tu asistente inteligente de MOVI
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              'gap-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/8',
              showHistory && 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
            )}
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Historial</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="gap-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/8"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Nueva</span>
          </Button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="relative flex-1 flex gap-0 min-h-0 overflow-hidden">
        {/* History panel */}
        {showHistory && (
          <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden border-r animate-in slide-in-from-left-2 duration-200" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <h3 className="font-semibold text-sm text-white/80">Conversaciones</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{conversations.length} guardadas</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className="group p-3 rounded-xl cursor-pointer transition-all duration-200"
                    style={conv.id === conversationId
                      ? { background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }
                      : { border: '1px solid transparent' }
                    }
                    onMouseEnter={e => { if (conv.id !== conversationId) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (conv.id !== conversationId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    onClick={() => {
                      setLocalMessages([]);
                      loadConversation(conv.id);
                      setShowHistory(false);
                      setShowWelcome(false);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: conv.id === conversationId ? '#00E5FF' : 'rgba(255,255,255,0.7)' }}>
                          {conv.titulo}
                        </p>
                        <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          {formatRelativeTime(conv.updated_at)}
                        </p>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-all"
                        onClick={e => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <div className="text-center py-10">
                    <History className="h-8 w-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.1)' }} />
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Sin conversaciones</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ScrollArea className="flex-1 px-5 py-4">
            {/* Welcome state */}
            {isEmpty && !isLoadingMessages && showWelcome && (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 animate-in fade-in duration-500">
                <div className="relative mb-6">
                  <ChavaAvatar size="xl" animate />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 flex items-center justify-center" style={{ borderColor: '#0A183D' }}>
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                </div>
                <h2 className="text-lg font-bold text-white/90 mb-1.5">
                  Hola{userName ? `, ${userName}` : ''}
                </h2>
                <p className="text-sm max-w-md leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Soy Chava, tu asistente inteligente. Estoy aqui para ayudarte a trabajar mas rapido, analizar informacion y resolver dudas dentro de MOVI.
                </p>

                {suggestions.length > 0 && (
                  <div className="w-full max-w-lg">
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      Prueba preguntarme
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {suggestions.slice(0, 6).map((suggestion) => (
                        <button
                          key={suggestion.id}
                          onClick={() => handleSuggestionClick(suggestion)}
                          disabled={isSendingMessage}
                          className="text-left p-3.5 rounded-xl transition-all duration-200"
                          style={{ border: '1px solid rgba(0,229,255,0.12)', background: 'rgba(0,229,255,0.03)', color: 'rgba(255,255,255,0.55)' }}
                          onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(0,229,255,0.3)'; el.style.color = 'rgba(255,255,255,0.85)'; el.style.background = 'rgba(0,229,255,0.07)'; }}
                          onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(0,229,255,0.12)'; el.style.color = 'rgba(255,255,255,0.55)'; el.style.background = 'rgba(0,229,255,0.03)'; }}
                        >
                          <p className="text-[13px] font-medium leading-snug line-clamp-2">
                            {suggestion.texto_pregunta}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isLoadingMessages && (
              <div className="flex items-center justify-center py-12 animate-in fade-in duration-300">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <ChavaAvatar size="sm" />
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Cargando conversacion...</span>
                </div>
              </div>
            )}

            <div className="space-y-5">
              {messages.map((message, idx) => {
                const isUser = message.rol === 'user';

                return (
                  <div
                    key={message.id}
                    className={cn('flex animate-in fade-in slide-in-from-bottom-2 duration-300', isUser ? 'justify-end' : 'justify-start')}
                    style={{ animationDelay: `${Math.min(idx * 50, 200)}ms` }}
                  >
                    {!isUser && (
                      <div className="mr-2.5 mt-0.5 flex-shrink-0">
                        <ChavaAvatar size="sm" />
                      </div>
                    )}
                    <div className={cn('max-w-[78%] group relative')}>
                      {isUser ? (
                        <div
                          className="rounded-2xl rounded-br-md px-4 py-3 text-sm leading-relaxed"
                          style={{ background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' }}
                        >
                          <p className="whitespace-pre-wrap font-medium text-white">{message.contenido}</p>
                        </div>
                      ) : (() => {
                        // Normalize before rendering — blocks internal prompts and raw JSON
                        const normalized = normalizeChavaResponse(
                          message.contenido,
                          message.respuesta_estructurada_json
                        );

                        if (!normalized.safe) {
                          return (
                            <div
                              className="rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed"
                              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: 'rgba(253,230,138,0.9)' }}
                            >
                              <p className="whitespace-pre-wrap">{normalized.error}</p>
                            </div>
                          );
                        }

                        const structuredResponse = normalized.structured
                          ? parseStructuredResponse(normalized.structured)
                          : null;

                        return (
                          <div
                            className="rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed"
                            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.88)' }}
                          >
                            {structuredResponse ? (
                              <>
                                <ResponseMessage response={structuredResponse} />
                                <SourcesPanel sources={message.web_sources ?? []} confidence={message.router_confidence} ragSources={message.rag_fuentes} />
                              </>
                            ) : (
                              <>
                                <p className="whitespace-pre-wrap">{normalized.text}</p>
                                <SourcesPanel sources={message.web_sources ?? []} confidence={message.router_confidence} ragSources={message.rag_fuentes} />
                              </>
                            )}

                            {/* Copy button */}
                            <button
                              onClick={() => copyMessage(message.id, normalized.text)}
                              className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1 shadow-sm"
                              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                            >
                              {copiedId === message.id
                                ? <Check className="w-3 h-3 text-emerald-400" />
                                : <Copy className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
                              }
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}

              {/* Thinking state */}
              {isSendingMessage && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="mr-2.5 mt-0.5 flex-shrink-0">
                    <ChavaAvatar size="sm" animate />
                  </div>
                  <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-cyan-400/70 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-cyan-400/70 rounded-full animate-bounce [animation-delay:0.15s]" />
                        <span className="w-2 h-2 bg-cyan-400/70 rounded-full animate-bounce [animation-delay:0.3s]" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Chava esta pensando...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error state */}
              {hasError && !isSendingMessage && (
                <div className="flex justify-start animate-in fade-in duration-300">
                  <div className="mr-2.5 mt-0.5 flex-shrink-0">
                    <ChavaAvatar size="sm" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p className="text-sm text-red-300 mb-2">Chava no pudo responder en este momento.</p>
                    <button
                      onClick={() => setHasError(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 transition-colors"
                      style={{ background: 'rgba(239,68,68,0.1)' }}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Intentar nuevamente
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Quick suggestions when conversation has started */}
          {suggestions.length > 0 && !isEmpty && !isSendingMessage && (
            <div className="px-5 py-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                {suggestions.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="flex-shrink-0 px-3 py-1.5 text-[11px] font-medium rounded-full transition-all whitespace-nowrap"
                    style={{ border: '1px solid rgba(0,229,255,0.15)', color: 'rgba(255,255,255,0.45)', background: 'transparent' }}
                    onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(0,229,255,0.35)'; el.style.color = '#00E5FF'; el.style.background = 'rgba(0,229,255,0.06)'; }}
                    onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(0,229,255,0.15)'; el.style.color = 'rgba(255,255,255,0.45)'; el.style.background = 'transparent'; }}
                  >
                    {suggestion.texto_pregunta}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            {attachedFiles.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#00E5FF' }} />
                    <span className="text-xs font-medium truncate max-w-[120px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{file.name}</span>
                    <button onClick={() => handleRemoveFile(index)} className="p-0.5 rounded hover:bg-white/10 transition-colors">
                      <X className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.csv,.png,.jpg,.jpeg" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSendingMessage}
                className="p-2.5 rounded-xl transition-all disabled:opacity-40"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#00E5FF'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,229,255,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Preguntale a Chava sobre seguros, clientes, produccion, tramites o MOVI..."
                  disabled={isSendingMessage}
                  rows={1}
                  className="w-full resize-none rounded-xl px-4 py-3 text-sm focus:outline-none transition-all disabled:opacity-50"
                  style={{
                    maxHeight: '120px', minHeight: '44px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.88)',
                    caretColor: '#00E5FF',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
              </div>
              <button
                onClick={() => doSend()}
                disabled={(!inputText.trim() && attachedFiles.length === 0) || isSendingMessage}
                className="p-3 rounded-xl transition-all duration-200"
                style={(!inputText.trim() && attachedFiles.length === 0) || isSendingMessage
                  ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)', cursor: 'not-allowed' }
                  : { background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)', color: 'white' }
                }
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </div>
            <p className="text-[10px] text-center mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Chava puede cometer errores. Verifica la informacion importante antes de tomar decisiones.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        textarea::placeholder { color: rgba(255,255,255,0.25) !important; }
      `}</style>
    </div>
  );

  function handleRemoveFile(index: number) {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }
}
