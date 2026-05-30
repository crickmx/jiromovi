import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, FileText, X, Trash2, Plus, History, RefreshCw, WifiOff } from 'lucide-react';
import { useAssistant } from '../contexts/AssistantContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { getSuggestionsForRoute } from '../lib/suggestionsService';
import { formatRelativeTime } from '../lib/assistantUtils';
import { parseStructuredResponse } from '../lib/responseParser';
import type { AssistantSuggestion } from '../lib/assistantTypes';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { ResponseMessage } from '../components/assistant/ResponseMessage';
import { ChavaAvatar } from '../components/chava/ChavaAvatar';
import { trackAssistantOpened, trackAssistantPromptSent, trackAssistantQuickPrompt, trackAssistantResponse } from '../lib/activityLogger';
import { cn } from '@/lib/utils';

export default function Chava() {
  const {
    messages,
    conversations,
    conversationId,
    sendMessage,
    loadConversation,
    deleteConversation,
    startNewConversation,
    openAssistant,
    isLoadingMessages,
    isSendingMessage,
  } = useAssistant();

  const { usuario } = useAuth();
  const location = useLocation();
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [hasError, setHasError] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    trackAssistantOpened();
    openAssistant();
    loadSuggestions();
  }, []);

  useEffect(() => {
    if (messages.length > 0) setShowWelcome(false);
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (conversationId) {
      setTimeout(() => scrollToBottom('auto'), 100);
    }
  }, [conversationId]);

  const loadSuggestions = async () => {
    const suggs = await getSuggestionsForRoute(location.pathname);
    setSuggestions(suggs);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  const handleSend = async () => {
    if ((!inputText.trim() && attachedFiles.length === 0) || isSendingMessage) return;

    const text = inputText.trim();
    const files = [...attachedFiles];

    setInputText('');
    setAttachedFiles([]);
    setHasError(false);
    setShowWelcome(false);

    trackAssistantPromptSent(text);
    try {
      await sendMessage(text, undefined, files);
      trackAssistantResponse();
    } catch {
      setHasError(true);
    }
  };

  const handleSuggestionClick = async (suggestion: AssistantSuggestion) => {
    if (isSendingMessage) return;
    setShowWelcome(false);
    trackAssistantQuickPrompt(suggestion.texto_pregunta);
    await sendMessage(suggestion.texto_pregunta);
    trackAssistantResponse();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    if (confirm('Eliminar esta conversacion?')) {
      await deleteConversation(convId);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (file.size > 500 * 1024 * 1024) {
        alert(`El archivo ${file.name} excede el tamano maximo de 500MB`);
        return false;
      }
      return true;
    });
    setAttachedFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleNewChat = async () => {
    setShowWelcome(true);
    setHasError(false);
    await startNewConversation();
  };

  const isEmpty = messages.length === 0;
  const userName = usuario?.nombre || 'Usuario';

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col -mt-2">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 dark:opacity-10">
        <div className="absolute top-20 right-10 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-cyan-200/30 to-blue-200/20 blur-3xl" />
        <div className="absolute bottom-20 left-10 w-[300px] h-[300px] rounded-full bg-gradient-to-tr from-blue-100/20 to-cyan-100/20 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between mb-4 pb-4 border-b border-neutral-100 dark:border-white/6">
        <div className="flex items-center gap-3.5">
          <ChavaAvatar size="lg" animate />
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
              Chava
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-neutral-500 dark:text-white/40">
                Tu asistente inteligente de MOVI
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "gap-1.5 rounded-xl border-neutral-200/60 dark:border-white/10",
              showHistory && "bg-accent/5 border-accent/30 text-accent"
            )}
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Historial</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewChat}
            className="gap-1.5 rounded-xl border-neutral-200/60 dark:border-white/10"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Nueva</span>
          </Button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="relative flex-1 flex gap-4 min-h-0">
        {/* History panel */}
        {showHistory && (
          <div className="w-72 flex-shrink-0 bg-white dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/8 rounded-2xl flex flex-col overflow-hidden shadow-sm animate-in slide-in-from-left-2 duration-200">
            <div className="p-4 border-b border-neutral-100 dark:border-white/6">
              <h3 className="font-semibold text-sm text-neutral-800 dark:text-white/80">Conversaciones</h3>
              <p className="text-xs text-neutral-400 dark:text-white/30 mt-0.5">{conversations.length} guardadas</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group p-3 rounded-xl cursor-pointer transition-all duration-200",
                      conv.id === conversationId
                        ? "bg-cyan-50/80 dark:bg-cyan-500/8 border border-cyan-200/50 dark:border-cyan-500/20"
                        : "hover:bg-neutral-50 dark:hover:bg-white/[0.04] border border-transparent"
                    )}
                    onClick={() => {
                      loadConversation(conv.id);
                      setShowHistory(false);
                      setShowWelcome(false);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          conv.id === conversationId ? "text-cyan-700 dark:text-cyan-300" : "text-neutral-700 dark:text-white/70"
                        )}>
                          {conv.titulo}
                        </p>
                        <p className="text-[11px] text-neutral-400 dark:text-white/25 mt-1">
                          {formatRelativeTime(conv.updated_at)}
                        </p>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-400 hover:text-red-500 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(conv.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <div className="text-center py-10">
                    <History className="h-8 w-8 text-neutral-200 dark:text-white/10 mx-auto mb-2" />
                    <p className="text-xs text-neutral-400 dark:text-white/30">Sin conversaciones</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-white/80 dark:bg-white/[0.02] border border-neutral-200/50 dark:border-white/6 rounded-2xl overflow-hidden min-w-0 backdrop-blur-sm shadow-sm">
          {/* Messages */}
          <ScrollArea className="flex-1 px-5 py-4">
            {/* Welcome state */}
            {isEmpty && !isLoadingMessages && showWelcome && (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 animate-in fade-in duration-500">
                <div className="relative mb-6">
                  <ChavaAvatar size="xl" animate />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                </div>

                <h2 className="text-lg font-bold text-neutral-800 dark:text-white/85 mb-1.5">
                  Hola{userName ? `, ${userName}` : ''}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-white/40 max-w-md leading-relaxed mb-8">
                  Soy Chava, tu asistente inteligente. Estoy aqui para ayudarte a trabajar mas rapido, analizar informacion y resolver dudas dentro de MOVI.
                </p>

                {suggestions.length > 0 && (
                  <div className="w-full max-w-lg">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/25 mb-3">
                      Prueba preguntarme
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {suggestions.slice(0, 6).map((suggestion) => (
                        <button
                          key={suggestion.id}
                          onClick={() => handleSuggestionClick(suggestion)}
                          disabled={isSendingMessage}
                          className="text-left p-3.5 rounded-xl border border-neutral-200/60 dark:border-white/8 hover:border-cyan-300/60 dark:hover:border-cyan-500/30 hover:bg-cyan-50/30 dark:hover:bg-cyan-500/5 transition-all duration-200 group"
                        >
                          <p className="text-[13px] font-medium text-neutral-600 dark:text-white/60 group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors leading-snug line-clamp-2">
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
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-neutral-50 dark:bg-white/[0.04] border border-neutral-200/50 dark:border-white/8">
                  <ChavaAvatar size="sm" />
                  <span className="text-sm text-neutral-500 dark:text-white/40">Cargando conversacion...</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((message, idx) => {
                const isUser = message.rol === 'user';
                const structuredResponse = message.respuesta_estructurada_json
                  ? parseStructuredResponse(message.respuesta_estructurada_json)
                  : null;

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex animate-in fade-in slide-in-from-bottom-2 duration-300",
                      isUser ? "justify-end" : "justify-start"
                    )}
                    style={{ animationDelay: `${Math.min(idx * 50, 200)}ms` }}
                  >
                    {!isUser && (
                      <div className="mr-2.5 mt-0.5 flex-shrink-0">
                        <ChavaAvatar size="sm" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
                        isUser
                          ? "bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-br-md"
                          : "bg-white dark:bg-white/[0.05] border border-neutral-100 dark:border-white/8 text-neutral-800 dark:text-white/80 rounded-bl-md"
                      )}
                    >
                      {isUser ? (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.contenido}</p>
                      ) : structuredResponse ? (
                        <ResponseMessage response={structuredResponse} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.contenido}</p>
                      )}
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
                  <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-white dark:bg-white/[0.05] border border-neutral-100 dark:border-white/8 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-cyan-500/70 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-cyan-500/70 rounded-full animate-bounce [animation-delay:0.15s]" />
                        <span className="w-2 h-2 bg-cyan-500/70 rounded-full animate-bounce [animation-delay:0.3s]" />
                      </div>
                      <span className="text-xs text-neutral-400 dark:text-white/30 font-medium">
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
                  <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-red-50 dark:bg-red-500/8 border border-red-200/60 dark:border-red-500/20">
                    <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                      Chava no pudo responder en este momento.
                    </p>
                    <button
                      onClick={() => setHasError(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/10 hover:bg-red-150 dark:hover:bg-red-500/15 transition-colors"
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
            <div className="px-5 py-2.5 border-t border-neutral-100/80 dark:border-white/5">
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                {suggestions.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="flex-shrink-0 px-3 py-1.5 text-[11px] font-medium rounded-full border border-neutral-200/60 dark:border-white/8 text-neutral-500 dark:text-white/40 hover:border-cyan-300/60 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-cyan-50/30 dark:hover:bg-cyan-500/5 transition-all whitespace-nowrap"
                  >
                    {suggestion.texto_pregunta}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="p-4 border-t border-neutral-100/80 dark:border-white/5 bg-neutral-50/30 dark:bg-white/[0.01]">
            {attachedFiles.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-white dark:bg-white/[0.05] rounded-lg border border-neutral-200/60 dark:border-white/8 shadow-sm"
                  >
                    <FileText className="h-3.5 w-3.5 text-cyan-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-neutral-600 dark:text-white/60 truncate max-w-[120px]">
                      {file.name}
                    </span>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
                    >
                      <X className="h-3 w-3 text-neutral-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSendingMessage}
                className="p-2.5 rounded-xl text-neutral-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-all disabled:opacity-40"
                title="Adjuntar archivo"
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
                  className="w-full resize-none rounded-xl border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3 text-sm text-neutral-800 dark:text-white/80 placeholder:text-neutral-400 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400/50 transition-all disabled:opacity-50 shadow-sm"
                  style={{ maxHeight: '120px', minHeight: '44px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={(!inputText.trim() && attachedFiles.length === 0) || isSendingMessage}
                className={cn(
                  "p-3 rounded-xl transition-all duration-200 shadow-sm",
                  (!inputText.trim() && attachedFiles.length === 0) || isSendingMessage
                    ? "bg-neutral-100 dark:bg-white/5 text-neutral-300 dark:text-white/15 cursor-not-allowed"
                    : "bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:shadow-md hover:shadow-cyan-500/20 active:scale-95"
                )}
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </div>
            <p className="text-[11px] text-neutral-400 dark:text-white/20 mt-2 pl-12">
              Enter para enviar · Shift+Enter para nueva linea
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
