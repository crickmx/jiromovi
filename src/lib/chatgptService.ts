import { supabase } from './supabase';

export interface ChatGPTMessage {
  id: string;
  conversacion_id: string;
  rol: 'user' | 'assistant' | 'system';
  contenido: string;
  tokens_usados: number;
  created_at: string;
}

export interface ChatGPTConversation {
  id: string;
  usuario_id: string;
  titulo: string;
  created_at: string;
  updated_at: string;
}

export interface SendMessageResponse {
  success: boolean;
  conversacion_id: string;
  mensaje: string;
  tokens_usados: number;
  error?: string;
}

export const chatgptService = {
  async sendMessage(
    mensaje: string,
    conversacionId?: string,
    model: string = 'gpt-4o-mini'
  ): Promise<SendMessageResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/chatgpt-query`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mensaje,
          conversacion_id: conversacionId,
          model,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al comunicarse con ChatGPT');
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Error sending message to ChatGPT:', error);
      throw error;
    }
  },

  async getConversations(): Promise<ChatGPTConversation[]> {
    try {
      const { data, error } = await supabase
        .from('conversaciones_chatgpt')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading conversations:', error);
      throw error;
    }
  },

  async getMessages(conversacionId: string): Promise<ChatGPTMessage[]> {
    try {
      const { data, error } = await supabase
        .from('mensajes_chatgpt')
        .select('*')
        .eq('conversacion_id', conversacionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading messages:', error);
      throw error;
    }
  },

  async deleteConversation(conversacionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversaciones_chatgpt')
        .delete()
        .eq('id', conversacionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  },

  async updateConversationTitle(conversacionId: string, titulo: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversaciones_chatgpt')
        .update({ titulo })
        .eq('id', conversacionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating conversation title:', error);
      throw error;
    }
  },
};
