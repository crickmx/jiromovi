import { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Paperclip, FileText, X, Trash2, Plus, History, RefreshCw } from 'lucide-react';
import { useAssistant } from '../contexts/AssistantContext';
import { useLocation } from 'react-router-dom';
import { getSuggestionsForRoute } from '../lib/suggestionsService';
import { formatRelativeTime } from '../lib/assistantUtils';
import { parseStructuredResponse } from '../lib/responseParser';
import type { AssistantSuggestion } from '../lib/assistantTypes';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { ResponseMessage } from '../components/assistant/ResponseMessage';
import { trackAssistantOpened, trackAssistantPromptSent, trackAssistantQuickPrompt, trackAssistantResponse } from '../lib/activityLogger';
import { cn } from '@/lib/utils';

export default function Chava() {
  const {
    messages,
    conversations,
    conversationId,
    currentModule,
    sendMessage,
    loadConversation,
    deleteConversation,
    startNewConversation,
    openAssistant,
    isLoadingMessages,
    isSendingMessage,
  } = useAssistant();

  const location = useLocation();
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [hasError, setHasError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    trackAssistantOpened();
    openAssistant();
    loadSuggestions();
  }, []);

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

  const isEmpty = messages.length === 0;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            Chava
          </h1>
          <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
            Tu asistente inteligente para trabajar mas rapido dentro de MOVI Digital.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-1.5"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Historial</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => startNewConversation()}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva</span>
          </Button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* History panel */}
        {showHistory && (
          <div className="w-72 flex-shrink-0 bg-white dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/8 rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-neutral-100 dark:border-white/6">
              <h3 className="font-semibold text-sm text-neutral-800 dark:text-white/80">Conversaciones</h3>
              <p className="text-xs text-neutral-400 dark:text-white/30 mt-0.5">{conversations.length} conversaciones</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group p-3 rounded-xl cursor-pointer transition-all duration-200",
                      conv.id === conversationId
                        ? "bg-accent/8 dark:bg-accent/12 border border-accent/20"
                        : "hover:bg-neutral-50 dark:hover:bg-white/[0.04] border border-transparent"
                    )}
                    onClick={() => {
                      loadConversation(conv.id);
                      setShowHistory(false);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          conv.id === conversationId ? "text-accent" : "text-neutral-700 dark:text-white/70"
                        )}>
                          {conv.titulo}
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-white/30 mt-1">
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
                  <div className="text-center py-8">
                    <History className="h-8 w-8 text-neutral-200 dark:text-white/10 mx-auto mb-2" />
                    <p className="text-sm text-neutral-400 dark:text-white/30">Sin conversaciones</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/8 rounded-2xl overflow-hidden min-w-0">
          {/* Messages */}
          <ScrollArea className="flex-1 p-5">
            {isEmpty && !isLoadingMessages && (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <div className="w-20 h-20 rounded-3xl bg-accent/8 dark:bg-accent/15 flex items-center justify-center mb-5">
                  <Sparkles className="h-10 w-10 text-accent/70" />
                </div>
                <h3 className="text-lg font-bold text-neutral-800 dark:text-white/80 mb-2">
                  Hola, soy Chava
                </h3>
                <p className="text-sm text-neutral-500 dark:text-white/40 max-w-md mb-8">
                  Tu copiloto dentro de MOVI Digital. Preguntame sobre produccion, comisiones, tramites, contactos o cualquier cosa del sistema.
                </p>

                {suggestions.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full">
                    {suggestions.slice(0, 6).map((suggestion) => (
                      <button
                        key={suggestion.id}
                        onClick={() => handleSuggestionClick(suggestion)}
                        disabled={isSendingMessage}
                        className="text-left p-3.5 rounded-xl border border-neutral-200/60 dark:border-white/8 hover:border-accent/40 hover:bg-accent/4 dark:hover:bg-accent/8 transition-all duration-200 group"
                      >
                        <p className="text-sm font-medium text-neutral-700 dark:text-white/70 group-hover:text-accent transition-colors line-clamp-2">
                          {suggestion.texto_pregunta}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isLoadingMessages && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent"></div>
                  <span className="text-sm text-neutral-500 dark:text-white/40">Cargando conversacion...</span>
                </div>
              </div>
            )}

            <div className="space-y-5">
              {messages.map((message) => {
                const isUser = message.rol === 'user';
                const structuredResponse = message.respuesta_estructurada_json
                  ? parseStructuredResponse(message.respuesta_estructurada_json)
                  : null;

                return (
                  <div
                    key={message.id}
                    className={cn("flex", isUser ? "justify-end" : "justify-start")}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                        <Sparkles className="h-4 w-4 text-accent" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-3",
                        isUser
                          ? "bg-accent text-white"
                          : "bg-neutral-50 dark:bg-white/[0.04] border border-neutral-100 dark:border-white/6 text-neutral-800 dark:text-white/80"
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

              {isSendingMessage && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center mr-3 flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-accent" />
                  </div>
                  <div className="rounded-2xl px-4 py-3 bg-neutral-50 dark:bg-white/[0.04] border border-neutral-100 dark:border-white/6">
                    <div className="flex gap-1.5 py-1">
                      <span className="w-2 h-2 bg-accent/50 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-accent/50 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                      <span className="w-2 h-2 bg-accent/50 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                    </div>
                  </div>
                </div>
              )}

              {hasError && !isSendingMessage && (
                <div className="flex justify-center">
                  <button
                    onClick={() => { setHasError(false); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/15 transition-all"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Hubo un error. Intenta de nuevo.
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Suggestions bar (only when empty and not loading) */}
          {suggestions.length > 0 && !isEmpty && !isSendingMessage && (
            <div className="px-5 py-3 border-t border-neutral-100 dark:border-white/6 bg-neutral-50/50 dark:bg-white/[0.02]">
              <div className="flex flex-wrap gap-1.5">
                {suggestions.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border border-neutral-200/60 dark:border-white/10 text-neutral-600 dark:text-white/50 hover:border-accent/40 hover:text-accent hover:bg-accent/4 dark:hover:bg-accent/8 transition-all"
                  >
                    {suggestion.texto_pregunta}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="p-4 border-t border-neutral-100 dark:border-white/6">
            {attachedFiles.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 pl-3 pr-1 py-1.5 bg-neutral-50 dark:bg-white/[0.04] rounded-lg border border-neutral-200/60 dark:border-white/8"
                  >
                    <FileText className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-neutral-600 dark:text-white/60 truncate max-w-[150px]">
                      {file.name}
                    </span>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
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
                className="p-2.5 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/8 transition-all disabled:opacity-40"
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
                  placeholder="Escribe tu pregunta..."
                  disabled={isSendingMessage}
                  rows={1}
                  className="w-full resize-none rounded-xl border border-neutral-200/60 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.03] px-4 py-3 text-sm text-neutral-800 dark:text-white/80 placeholder:text-neutral-400 dark:placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all disabled:opacity-50"
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
                className="p-2.5 rounded-xl bg-accent text-white hover:bg-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-5 w-5" />
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
