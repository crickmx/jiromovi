import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantEvent,
  ModuleName,
  IntentCode,
  StructuredResponse,
} from '../lib/assistantTypes';
import {
  getOrCreateConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage as sendMessageService,
  deleteConversation as deleteConversationService,
  getUnreadEvents,
  markEventsAsRead as markEventsAsReadService,
} from '../lib/assistantService';
import { detectModuleFromRoute, extractRouteParams } from '../lib/assistantUtils';

interface AssistantContextType {
  isOpen: boolean;
  conversationId: string | null;
  conversations: AssistantConversation[];
  messages: AssistantMessage[];
  currentModule: ModuleName;
  unreadEventsCount: number;
  events: AssistantEvent[];
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  openAssistant: (module?: ModuleName) => Promise<void>;
  closeAssistant: () => void;
  sendMessage: (text: string, explicitIntent?: IntentCode) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  startNewConversation: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  markEventsAsRead: (eventIds: string[]) => Promise<void>;
  refreshConversations: () => Promise<void>;
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [currentModule, setCurrentModule] = useState<ModuleName>('general');
  const [unreadEventsCount, setUnreadEventsCount] = useState(0);
  const [events, setEvents] = useState<AssistantEvent[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  useEffect(() => {
    const module = detectModuleFromRoute(location.pathname);
    setCurrentModule(module);
  }, [location.pathname]);

  useEffect(() => {
    if (user?.id) {
      refreshEvents();
      const interval = setInterval(refreshEvents, 60000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadConversationsList();
    }
  }, [user?.id]);

  const loadConversationsList = useCallback(async () => {
    if (!user?.id) return;
    const convs = await getUserConversations(user.id);
    setConversations(convs);
  }, [user?.id]);

  const refreshConversations = useCallback(async () => {
    await loadConversationsList();
  }, [loadConversationsList]);

  const refreshEvents = useCallback(async () => {
    if (!user?.id) return;
    const { events: unreadEvents, unread_count } = await getUnreadEvents(user.id);
    setEvents(unreadEvents);
    setUnreadEventsCount(unread_count);
  }, [user?.id]);

  const markEventsAsRead = useCallback(
    async (eventIds: string[]) => {
      if (!user?.id) return;
      const success = await markEventsAsReadService(user.id, eventIds);
      if (success) {
        await refreshEvents();
      }
    },
    [user?.id, refreshEvents]
  );

  const openAssistant = useCallback(
    async (module?: ModuleName) => {
      if (!user?.id) return;

      const targetModule = module || currentModule;
      const conversation = await getOrCreateConversation(user.id, targetModule);

      if (conversation) {
        setConversationId(conversation.id);
        await loadMessages(conversation.id);
      }

      setIsOpen(true);
    },
    [user?.id, currentModule]
  );

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    setIsLoadingMessages(true);
    try {
      const msgs = await getConversationMessages(convId);
      setMessages(msgs);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const loadConversation = useCallback(
    async (convId: string) => {
      setConversationId(convId);
      await loadMessages(convId);
    },
    [loadMessages]
  );

  const sendMessage = useCallback(
    async (text: string, explicitIntent?: IntentCode) => {
      if (!user?.id) return;

      let activeConversationId = conversationId;
      setIsSendingMessage(true);

      try {
        if (!activeConversationId) {
          const conversation = await getOrCreateConversation(user.id, currentModule);
          if (!conversation) {
            throw new Error('No se pudo crear la conversación');
          }
          activeConversationId = conversation.id;
          setConversationId(activeConversationId);
        }

        const params = extractRouteParams(location.pathname);

        const response = await sendMessageService({
          conversacion_id: activeConversationId,
          mensaje: text,
          modulo: currentModule,
          ruta: location.pathname,
          parametros: params,
        });

        if (response) {
          await loadMessages(activeConversationId);
          await loadConversationsList();
        } else {
          throw new Error('No se recibió respuesta del asistente');
        }
      } catch (error: any) {
        console.error('Error sending message:', error);

        // Extract meaningful error message
        let errorMessage = 'Lo siento, ocurrió un error al procesar tu mensaje.';

        if (error.message) {
          // Use the actual error message from the backend
          if (error.message.includes('sesión ha expirado')) {
            errorMessage = 'Tu sesión ha expirado. Por favor cierra sesión y vuelve a iniciar sesión.';
          } else if (error.message.includes('No autenticado')) {
            errorMessage = 'No estás autenticado. Por favor inicia sesión nuevamente.';
          } else if (error.message.includes('contexto del usuario')) {
            errorMessage = 'No se pudo acceder a tu perfil. Por favor contacta al administrador.';
          } else if (error.message.includes('permiso')) {
            errorMessage = 'No tienes permisos para realizar esta acción.';
          } else {
            errorMessage = `Error: ${error.message}`;
          }
        }

        console.error('Showing error to user:', errorMessage);

        if (activeConversationId) {
          setMessages((prev) => [
            ...prev,
            {
              id: `temp-error-${Date.now()}`,
              conversacion_id: activeConversationId,
              rol: 'assistant',
              contenido: errorMessage,
              respuesta_estructurada_json: null,
              tiene_acciones: false,
              created_at: new Date().toISOString(),
            },
          ]);
        }
      } finally {
        setIsSendingMessage(false);
      }
    },
    [user?.id, conversationId, currentModule, location.pathname, loadMessages, loadConversationsList]
  );

  const deleteConversation = useCallback(
    async (convId: string) => {
      const success = await deleteConversationService(convId);
      if (success) {
        if (convId === conversationId) {
          setConversationId(null);
          setMessages([]);
        }
        await loadConversationsList();
      }
    },
    [conversationId, loadConversationsList]
  );

  const startNewConversation = useCallback(async () => {
    if (!user?.id) return;

    setConversationId(null);
    setMessages([]);

    await openAssistant(currentModule);
  }, [user?.id, currentModule, openAssistant]);

  const value: AssistantContextType = {
    isOpen,
    conversationId,
    conversations,
    messages,
    currentModule,
    unreadEventsCount,
    events,
    isLoadingMessages,
    isSendingMessage,
    openAssistant,
    closeAssistant,
    sendMessage,
    loadConversation,
    deleteConversation,
    startNewConversation,
    refreshEvents,
    markEventsAsRead,
    refreshConversations,
  };

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (context === undefined) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}

export function useAssistantEvents() {
  const context = useContext(AssistantContext);
  if (context === undefined) {
    throw new Error('useAssistantEvents must be used within an AssistantProvider');
  }
  return {
    events: context.events,
    unreadCount: context.unreadEventsCount,
    refreshEvents: context.refreshEvents,
    markAsRead: context.markEventsAsRead,
  };
}
