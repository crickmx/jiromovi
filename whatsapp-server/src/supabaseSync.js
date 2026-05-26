const { createClient } = require('@supabase/supabase-js');

class SupabaseSync {
  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && key) {
      this.supabase = createClient(url, key);
      this.enabled = true;
      console.log('Supabase sync enabled');
    } else {
      this.supabase = null;
      this.enabled = false;
      console.log('Supabase sync disabled (missing env vars)');
    }
  }

  async updateSessionStatus(userId, status, extra = {}) {
    if (!this.enabled) return;

    try {
      const { data: existing } = await this.supabase
        .from('whatsapp_sessions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      const updateData = {
        status,
        ...(status === 'connected' ? {
          connected_at: extra.connectedAt || new Date().toISOString(),
          phone_number: extra.phone || null,
          error_message: null,
        } : {}),
        ...(status === 'disconnected' ? {
          disconnected_at: new Date().toISOString(),
        } : {}),
        last_activity_at: new Date().toISOString(),
      };

      if (existing) {
        await this.supabase.from('whatsapp_sessions').update(updateData).eq('id', existing.id);
      } else {
        await this.supabase.from('whatsapp_sessions').insert({
          user_id: userId,
          ...updateData,
        });
      }
    } catch (err) {
      console.error(`[Sync] Error updating session status for ${userId}:`, err.message);
    }
  }

  async saveInboundMessage(userId, phone, pushName, content, waMessageId) {
    if (!this.enabled) return;

    try {
      // Find or create conversation
      let { data: conv } = await this.supabase
        .from('whatsapp_conversations')
        .select('id, session_id')
        .eq('user_id', userId)
        .eq('remote_phone', phone)
        .maybeSingle();

      if (!conv) {
        const { data: session } = await this.supabase
          .from('whatsapp_sessions')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!session) return;

        const { data: newConv } = await this.supabase
          .from('whatsapp_conversations')
          .insert({
            user_id: userId,
            session_id: session.id,
            remote_phone: phone,
            remote_name: pushName,
            last_message_text: content.text,
            last_message_at: new Date().toISOString(),
            unread_count: 1,
          })
          .select('id, session_id')
          .single();
        conv = newConv;
      } else {
        await this.supabase.from('whatsapp_conversations').update({
          remote_name: pushName,
          last_message_text: content.text,
          last_message_at: new Date().toISOString(),
          unread_count: this.supabase.rpc ? undefined : 1,
        }).eq('id', conv.id);

        // Increment unread
        await this.supabase.rpc('increment_unread_count', { conv_id: conv.id }).catch(() => {
          // Fallback: just set to 1 if RPC doesn't exist
          this.supabase.from('whatsapp_conversations').update({ unread_count: 1 }).eq('id', conv.id);
        });
      }

      if (!conv) return;

      // Save message
      await this.supabase.from('whatsapp_messages').insert({
        conversation_id: conv.id,
        user_id: userId,
        direction: 'inbound',
        message_type: content.mediaType || 'text',
        content: content.text,
        wa_message_id: waMessageId,
        status: 'delivered',
      });
    } catch (err) {
      console.error(`[Sync] Error saving inbound message:`, err.message);
    }
  }

  async saveOutboundMessage(userId, to, text, waMessageId, media = null) {
    if (!this.enabled) return;

    try {
      let phone = to.replace(/\D/g, '');
      if (phone.length === 10) phone = `52${phone}`;

      let { data: conv } = await this.supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('remote_phone', phone)
        .maybeSingle();

      if (!conv) {
        const { data: session } = await this.supabase
          .from('whatsapp_sessions')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!session) return;

        const { data: newConv } = await this.supabase
          .from('whatsapp_conversations')
          .insert({
            user_id: userId,
            session_id: session.id,
            remote_phone: phone,
            last_message_text: text,
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        conv = newConv;
      } else {
        await this.supabase.from('whatsapp_conversations').update({
          last_message_text: text,
          last_message_at: new Date().toISOString(),
        }).eq('id', conv.id);
      }

      if (!conv) return;

      await this.supabase.from('whatsapp_messages').insert({
        conversation_id: conv.id,
        user_id: userId,
        direction: 'outbound',
        message_type: media?.mediaType || 'text',
        content: text,
        wa_message_id: waMessageId,
        status: 'sent',
      });
    } catch (err) {
      console.error(`[Sync] Error saving outbound message:`, err.message);
    }
  }
}

module.exports = { SupabaseSync };
