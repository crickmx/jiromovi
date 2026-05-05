import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Trash2, Send, Paperclip, FileText, X as XIcon } from 'lucide-react';
import { useAssistant } from '../contexts/AssistantContext';
import { useLocation } from 'react-router-dom';
import { getSuggestionsForRoute } from '../lib/suggestionsService';
import { getModuleDisplayName, formatRelativeTime } from '../lib/assistantUtils';
import { parseStructuredResponse } from '../lib/responseParser';
import type { AssistantSuggestion } from '../lib/assistantTypes';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { ResponseMessage } from './assistant/ResponseMessage';
import { trackAssistantOpened, trackAssistantPromptSent, trackAssistantQuickPrompt, trackAssistantResponse } from '../lib/activityLogger';

export function AssistantModal() {
  const {
    isOpen,
    closeAssistant,
    messages,
    conversations,
    conversationId,
    currentModule,
    sendMessage,
    loadConversation,
    deleteConversation,
    startNewConversation,
    isLoadingMessages,
    isSendingMessage,
  } = useAssistant();

  const location = useLocation();
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      trackAssistantOpened();
      loadSuggestions();
      if (messages.length > 0) {
        setTimeout(() => {
          scrollToBottom('auto');
        }, 100);
      }
    }
  }, [isOpen, location.pathname]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Scroll al final cuando cambia la conversación
  useEffect(() => {
    if (conversationId) {
      // Esperar a que los mensajes se rendericen
      setTimeout(() => {
        scrollToBottom('auto');
      }, 100);
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

    trackAssistantPromptSent(text);
    await sendMessage(text, undefined, files);
    trackAssistantResponse();
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
    if (confirm('¿Eliminar esta conversación?')) {
      await deleteConversation(convId);
      if (convId === conversationId) {
        setShowHistory(false);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`El archivo ${file.name} excede el tamaño máximo de 500MB`);
        return false;
      }
      return true;
    });
    setAttachedFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  const moduleName = getModuleDisplayName(currentModule);
  const isEmpty = messages.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Mi Asistente
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              Historial
            </Button>
            <Button variant="ghost" size="sm" onClick={closeAssistant}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {showHistory && (
            <div className="w-64 border-r flex flex-col">
              <div className="p-3 border-b">
                <h3 className="font-semibold text-sm">Conversaciones</h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`p-2 rounded cursor-pointer hover:bg-gray-100 ${
                        conv.id === conversationId ? 'bg-primary-50' : ''
                      }`}
                      onClick={() => {
                        loadConversation(conv.id);
                        setShowHistory(false);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {conv.titulo}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatRelativeTime(conv.updated_at)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(conv.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {conversations.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No hay conversaciones
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              {isEmpty && !isLoadingMessages && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <Sparkles className="h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Te puedo ayudar con...
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Selecciona una sugerencia o escribe tu pregunta
                  </p>
                </div>
              )}

              {isLoadingMessages && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                </div>
              )}

              <div className="space-y-4">
                {messages.map((message) => {
                  const isUser = message.rol === 'user';
                  const structuredResponse = message.respuesta_estructurada_json
                    ? parseStructuredResponse(message.respuesta_estructurada_json)
                    : null;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          isUser
                            ? 'bg-accent text-white [&_*]:text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {isUser ? (
                          <p className="text-sm whitespace-pre-wrap text-white">{message.contenido}</p>
                        ) : structuredResponse ? (
                          <ResponseMessage response={structuredResponse} />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.contenido}</p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isSendingMessage && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg p-3 bg-gray-100">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {suggestions.length > 0 && isEmpty && (
              <div className="p-4 border-t bg-gray-50">
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick(suggestion)}
                      disabled={isSendingMessage}
                      className="text-xs"
                    >
                      {suggestion.texto_pregunta}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 border-t">
              {attachedFiles.length > 0 && (
                <div className="mb-3 space-y-2">
                  {attachedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200"
                    >
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="p-1 hover:bg-gray-200 rounded"
                        type="button"
                      >
                        <XIcon className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleAttachClick}
                  disabled={isSendingMessage}
                  title="Adjuntar documento"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta o adjunta documentos..."
                  disabled={isSendingMessage}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={(!inputText.trim() && attachedFiles.length === 0) || isSendingMessage}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Presiona Enter para enviar, Shift+Enter para nueva línea. Máx 500MB por archivo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
