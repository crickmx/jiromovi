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
    const { conversacion_id, mensaje, modulo, ruta, parametros, file_paths } = request;

    // Verify session before calling function
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('No active session:', sessionError);
      throw new Error('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
    }

    console.log('Session active, calling edge function...');
    if (file_paths && file_paths.length > 0) {
      console.log('Sending with attached files:', file_paths.length);
    }

    // Use fetch directly to capture full error response body
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const url = `${supabaseUrl}/functions/v1/assistant-send-message`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        conversacion_id,
        mensaje,
        modulo,
        ruta,
        parametros: parametros || {},
        file_paths: file_paths || [],
      }),
    });

    // Always try to read the response body
    const text = await res.text();
    let json: any = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch (parseError) {
      console.error('Could not parse response as JSON:', text);
    }

    // Handle non-OK responses with detailed error info
    if (!res.ok) {
      console.error('❌ Edge function failed:', res.status);
      console.error('Response body:', json ?? text);

      // Extract detailed error message
      const errorMessage = json?.error || json?.message || text || `HTTP ${res.status}`;
      const errorDetails = json?.details || json?.hint || '';

      console.error('Error message:', errorMessage);
      console.error('Error details:', errorDetails);

      throw new Error(`${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`);
    }

    // Check if backend returned an error in a 200 response
    if (json && json.error) {
      console.error('Backend returned error:', json.error);
      console.error('Error details:', json.details);
      throw new Error(json.error);
    }

    if (!json) {
      console.error('No data received from edge function');
      throw new Error('No se recibió respuesta del asistente');
    }

    console.log('✅ Assistant response received successfully');

    if (json.respuesta_estructurada) {
      const parsed = parseStructuredResponse(json.respuesta_estructurada);
      return {
        ...json,
        respuesta_estructurada: parsed,
      };
    }

    return json;
  } catch (error: any) {
    console.error('Error sending message:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
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

export async function sendChavaMessage(
  request: SendMessageRequest
): Promise<SendMessageResponse | null> {
  try {
    const { conversacion_id, mensaje, modulo, ruta, parametros, file_paths } = request;

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Tu sesion ha expirado. Por favor inicia sesion nuevamente.');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const url = `${supabaseUrl}/functions/v1/chava-query`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        conversacion_id,
        mensaje,
        modulo: modulo || 'chava',
        ruta: ruta || '/chava',
        parametros: parametros || {},
        file_paths: file_paths || [],
      }),
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // ignore parse error
    }

    if (!res.ok) {
      const errorMessage = json?.error || json?.message || text || `HTTP ${res.status}`;
      throw new Error(errorMessage);
    }

    if (json && json.error) {
      throw new Error(json.error);
    }

    if (!json) {
      throw new Error('No se recibio respuesta del asistente');
    }

    return json;
  } catch (error: any) {
    console.error('Error sending chava message:', error);
    throw error;
  }
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
