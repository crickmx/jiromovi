import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Trash2, Plus, Send } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadSuggestions();
    }
  }, [isOpen, location.pathname]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSuggestions = async () => {
    const suggs = await getSuggestionsForRoute(location.pathname);
    setSuggestions(suggs);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!inputText.trim() || isSendingMessage) return;
    const text = inputText.trim();
    setInputText('');
    await sendMessage(text);
  };

  const handleSuggestionClick = async (suggestion: AssistantSuggestion) => {
    if (isSendingMessage) return;
    await sendMessage(suggestion.texto_pregunta);
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

  if (!isOpen) return null;

  const moduleName = getModuleDisplayName(currentModule);
  const isEmpty = messages.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
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
            <Button
              variant="outline"
              size="sm"
              onClick={startNewConversation}
              disabled={isEmpty}
            >
              <Plus className="h-4 w-4" />
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
                        conv.id === conversationId ? 'bg-blue-50' : ''
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                            ? 'bg-blue-600 text-white [&_*]:text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {!isUser && message.modo_usado && (
                          <div className="mb-2 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                message.modo_usado === 'chatgpt'
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {message.modo_usado === 'chatgpt' ? '🤖 Conocimiento General' : '📊 Datos del Sistema'}
                            </span>
                            {message.router_confidence !== undefined && (
                              <span className="text-xs text-gray-500">
                                {message.router_confidence}% confianza
                              </span>
                            )}
                          </div>
                        )}

                        {isUser ? (
                          <p className="text-sm whitespace-pre-wrap text-white">{message.contenido}</p>
                        ) : structuredResponse ? (
                          <ResponseMessage response={structuredResponse} />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.contenido}</p>
                        )}

                        {!isUser && message.web_sources && message.web_sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs font-medium text-gray-600 mb-2">🌐 Fuentes consultadas:</p>
                            <div className="space-y-2">
                              {message.web_sources.map((source, idx) => (
                                <a
                                  key={idx}
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-xs p-2 bg-white rounded border border-gray-200 hover:border-blue-300 transition-colors"
                                >
                                  <div className="font-medium text-blue-600 hover:text-blue-800 mb-1">
                                    {source.title}
                                  </div>
                                  <div className="text-gray-500 line-clamp-2">{source.snippet}</div>
                                </a>
                              ))}
                            </div>
                          </div>
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
              <div className="flex gap-2">
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta..."
                  disabled={isSendingMessage}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputText.trim() || isSendingMessage}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Presiona Enter para enviar, Shift+Enter para nueva línea
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
