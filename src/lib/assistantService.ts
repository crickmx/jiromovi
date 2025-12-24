import { supabase } from './supabase';
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantEvent,
  SendMessageRequest,
  SendMessageResponse,
  GetEventsResponse,
  MarkEventsReadRequest,
} from './assistantTypes';
import { parseStructuredResponse } from './responseParser';

export async function getActiveConversation(
  usuarioId: string,
  modulo: string
): Promise<AssistantConversation | null> {
  const { data, error } = await supabase
    .from('conversaciones_chatgpt')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('modulo_origen', modulo)
    .eq('es_asistente', true)
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error getting active conversation:', error);
    return null;
  }

  return data;
}

export async function createConversation(
  usuarioId: string,
  modulo: string,
  titulo?: string
): Promise<AssistantConversation | null> {
  const { data, error } = await supabase
    .from('conversaciones_chatgpt')
    .insert({
      usuario_id: usuarioId,
      titulo: titulo || `Conversación en ${modulo}`,
      es_asistente: true,
      modulo_origen: modulo,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    return null;
  }

  return data;
}

export async function getOrCreateConversation(
  usuarioId: string,
  modulo: string,
  titulo?: string
): Promise<AssistantConversation | null> {
  const existing = await getActiveConversation(usuarioId, modulo);
  if (existing) return existing;

  return await createConversation(usuarioId, modulo, titulo);
}

export async function getUserConversations(
  usuarioId: string,
  limit: number = 20
): Promise<AssistantConversation[]> {
  const { data, error } = await supabase
    .from('conversaciones_chatgpt')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('es_asistente', true)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error getting conversations:', error);
    return [];
  }

  return data || [];
}

export async function getConversationMessages(
  conversacionId: string,
  limit: number = 50
): Promise<AssistantMessage[]> {
  const { data, error } = await supabase
    .from('mensajes_chatgpt')
    .select('*')
    .eq('conversacion_id', conversacionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error getting messages:', error);
    return [];
  }

  return data || [];
}

export async function sendMessage(
  request: SendMessageRequest
): Promise<SendMessageResponse | null> {
  try {
    const { conversacion_id, mensaje, modulo, ruta, parametros } = request;

    const userMessage = await createUserMessage(conversacion_id, mensaje);
    if (!userMessage) {
      throw new Error('Failed to create user message');
    }

    await updateConversationTimestamp(conversacion_id);

    const response = await supabase.functions.invoke('assistant-send-message', {
      body: {
        conversacion_id,
        mensaje,
        modulo,
        ruta,
        parametros: parametros || {},
      },
    });

    if (response.error) {
      throw response.error;
    }

    const { data } = response;

    if (data.respuesta_estructurada) {
      const parsed = parseStructuredResponse(data.respuesta_estructurada);
      return {
        ...data,
        respuesta_estructurada: parsed,
      };
    }

    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
}

async function createUserMessage(
  conversacionId: string,
  contenido: string
): Promise<AssistantMessage | null> {
  const { data, error } = await supabase
    .from('mensajes_chatgpt')
    .insert({
      conversacion_id: conversacionId,
      rol: 'user',
      contenido,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user message:', error);
    return null;
  }

  return data;
}

async function updateConversationTimestamp(conversacionId: string): Promise<void> {
  await supabase
    .from('conversaciones_chatgpt')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversacionId);
}

export async function deleteConversation(conversacionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('conversaciones_chatgpt')
    .delete()
    .eq('id', conversacionId);

  if (error) {
    console.error('Error deleting conversation:', error);
    return false;
  }

  return true;
}

export async function updateConversationTitle(
  conversacionId: string,
  titulo: string
): Promise<boolean> {
  const { error } = await supabase
    .from('conversaciones_chatgpt')
    .update({ titulo })
    .eq('id', conversacionId);

  if (error) {
    console.error('Error updating conversation title:', error);
    return false;
  }

  return true;
}

export async function getUnreadEvents(usuarioId: string): Promise<GetEventsResponse> {
  const { data, error } = await supabase
    .from('assistant_events')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('leido', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting unread events:', error);
    return { events: [], unread_count: 0 };
  }

  return {
    events: data || [],
    unread_count: (data || []).length,
  };
}

export async function markEventsAsRead(
  usuarioId: string,
  eventIds: string[]
): Promise<boolean> {
  const { error } = await supabase
    .from('assistant_events')
    .update({ leido: true })
    .eq('usuario_id', usuarioId)
    .in('id', eventIds);

  if (error) {
    console.error('Error marking events as read:', error);
    return false;
  }

  return true;
}

export async function getAllEvents(usuarioId: string): Promise<AssistantEvent[]> {
  const { data, error } = await supabase
    .from('assistant_events')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error getting all events:', error);
    return [];
  }

  return data || [];
}

export async function createEvent(
  usuarioId: string,
  tipoEvento: string,
  titulo: string,
  descripcion: string | null,
  datosJson: any,
  prioridad: 'alta' | 'media' | 'baja' = 'media'
): Promise<AssistantEvent | null> {
  const { data, error } = await supabase
    .from('assistant_events')
    .insert({
      usuario_id: usuarioId,
      tipo_evento: tipoEvento,
      titulo,
      descripcion,
      datos_json: datosJson,
      prioridad,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating event:', error);
    return null;
  }

  return data;
}

export async function logActionClick(
  usuarioId: string,
  actionId: string | null,
  intentCodigo: string | null,
  tipoAccion: string,
  destino: string | null
): Promise<void> {
  try {
    await supabase.from('assistant_action_clicks').insert({
      usuario_id: usuarioId,
      action_id: actionId,
      intent_codigo: intentCodigo,
      tipo_accion: tipoAccion,
      destino,
    });
  } catch (error) {
    console.error('Error logging action click:', error);
  }
}
