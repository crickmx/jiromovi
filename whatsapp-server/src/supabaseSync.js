const { createClient } = require('@supabase/supabase-js');
const mime = require('mime-types');

class SupabaseSync {
  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && key) {
      this.supabase = createClient(url, key);
      this.enabled = true;
      this.supabaseUrl = url;
      console.log('Supabase sync enabled');
    } else {
      this.supabase = null;
      this.enabled = false;
      this.supabaseUrl = null;
      console.log('Supabase sync disabled (missing env vars)');
    }
  }

  // ─── Session Management ───────────────────────────────────────

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

  // ─── Conversation Management ──────────────────────────────────

  async getOrCreateConversation(userId, phone, name = null) {
    if (!this.enabled) return null;

    try {
      let { data: conv } = await this.supabase
        .from('whatsapp_conversations')
        .select('id, session_id')
        .eq('user_id', userId)
        .eq('remote_phone', phone)
        .maybeSingle();

      if (conv) return conv;

      const { data: session } = await this.supabase
        .from('whatsapp_sessions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!session) return null;

      const { data: newConv } = await this.supabase
        .from('whatsapp_conversations')
        .insert({
          user_id: userId,
          session_id: session.id,
          remote_phone: phone,
          remote_name: name,
          last_message_at: new Date().toISOString(),
        })
        .select('id, session_id')
        .single();

      return newConv;
    } catch (err) {
      if (err.code === '23505') {
        const { data: conv } = await this.supabase
          .from('whatsapp_conversations')
          .select('id, session_id')
          .eq('user_id', userId)
          .eq('remote_phone', phone)
          .maybeSingle();
        return conv;
      }
      console.error(`[Sync] Error getting/creating conversation:`, err.message);
      return null;
    }
  }

  async updateConversationLastMessage(conversationId, text, timestamp, incrementUnread = false) {
    if (!this.enabled) return;

    try {
      await this.supabase
        .from('whatsapp_conversations')
        .update({
          last_message_text: text ? text.substring(0, 200) : null,
          last_message_at: timestamp || new Date().toISOString(),
        })
        .eq('id', conversationId);

      if (incrementUnread) {
        await this.supabase.rpc('increment_unread_count', { conv_id: conversationId }).catch(() => {
          this.supabase.from('whatsapp_conversations').update({ unread_count: 1 }).eq('id', conversationId);
        });
      }
    } catch (err) {
      console.error(`[Sync] Error updating conversation:`, err.message);
    }
  }

  async updateConversationName(userId, phone, name) {
    if (!this.enabled || !name) return;
    try {
      await this.supabase
        .from('whatsapp_conversations')
        .update({ remote_name: name })
        .eq('user_id', userId)
        .eq('remote_phone', phone);
    } catch {}
  }

  // ─── Message Persistence (Upsert) ────────────────────────────

  async upsertMessage(userId, conversationId, msgData) {
    if (!this.enabled || !conversationId) return null;

    try {
      const record = {
        conversation_id: conversationId,
        user_id: userId,
        direction: msgData.direction || 'inbound',
        message_type: msgData.messageType || 'text',
        content: msgData.content || null,
        media_url: msgData.mediaUrl || null,
        media_mime_type: msgData.mediaMimeType || null,
        media_filename: msgData.mediaFilename || null,
        media_storage_path: msgData.mediaStoragePath || null,
        media_file_size: msgData.mediaFileSize || null,
        media_thumbnail_url: msgData.mediaThumbnailUrl || null,
        media_caption: msgData.mediaCaption || null,
        media_download_status: msgData.mediaDownloadStatus || 'none',
        wa_message_id: msgData.waMessageId,
        status: msgData.status || 'delivered',
        message_timestamp: msgData.timestamp ? new Date(msgData.timestamp).toISOString() : null,
        metadata: msgData.metadata || null,
      };

      if (msgData.waMessageId) {
        const { data, error } = await this.supabase
          .from('whatsapp_messages')
          .upsert(record, {
            onConflict: 'user_id,wa_message_id',
            ignoreDuplicates: true,
          })
          .select('id')
          .maybeSingle();

        if (error && error.code !== '23505') {
          console.error(`[Sync] Upsert error:`, error.message);
        }
        return data;
      } else {
        const { data } = await this.supabase
          .from('whatsapp_messages')
          .insert(record)
          .select('id')
          .maybeSingle();
        return data;
      }
    } catch (err) {
      if (err.code !== '23505') {
        console.error(`[Sync] Error upserting message:`, err.message);
      }
      return null;
    }
  }

  // ─── Bulk History Sync ────────────────────────────────────────

  async syncHistoryBatch(userId, messages, sock) {
    if (!this.enabled || !messages || messages.length === 0) return 0;

    let synced = 0;

    await this.logAudit(userId, 'sync_history_started', {
      total_messages: messages.length,
    });

    for (const msg of messages) {
      try {
        if (!msg.message && !msg.messageStubType) continue;

        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') continue;
        if (remoteJid.includes('@g.us')) continue;

        const phone = remoteJid.split('@')[0];
        const isFromMe = msg.key?.fromMe || false;
        const pushName = msg.pushName || phone;

        const conv = await this.getOrCreateConversation(userId, phone, isFromMe ? null : pushName);
        if (!conv) continue;

        const content = this.extractMessageContent(msg);
        if (!content) continue;

        const msgTimestamp = msg.messageTimestamp
          ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Number(msg.messageTimestamp) * 1000)
          : Date.now();

        await this.upsertMessage(userId, conv.id, {
          direction: isFromMe ? 'outbound' : 'inbound',
          messageType: content.mediaType || 'text',
          content: content.text,
          mediaCaption: content.caption || null,
          mediaMimeType: content.mimeType || null,
          mediaFilename: content.filename || null,
          mediaDownloadStatus: content.hasMedia ? 'pending' : 'none',
          waMessageId: msg.key?.id,
          status: isFromMe ? 'sent' : 'delivered',
          timestamp: msgTimestamp,
          metadata: content.metadata || null,
        });
        synced++;

        // Download media for recent messages (last 24h)
        if (content.hasMedia && sock && (Date.now() - msgTimestamp < 86400000)) {
          this.downloadAndStoreMedia(userId, conv.id, msg, content, sock).catch(() => {});
        }
      } catch {}
    }

    await this.logAudit(userId, 'sync_history_completed', {
      synced_count: synced,
      total_attempted: messages.length,
    });

    console.log(`[${userId}] Synced ${synced}/${messages.length} messages to Supabase`);
    return synced;
  }

  // ─── Real-time Message Sync ───────────────────────────────────

  async saveInboundMessage(userId, phone, pushName, content, waMessageId, msgTimestamp = null) {
    if (!this.enabled) return;

    try {
      const conv = await this.getOrCreateConversation(userId, phone, pushName);
      if (!conv) return;

      const ts = msgTimestamp || Date.now();

      await this.upsertMessage(userId, conv.id, {
        direction: 'inbound',
        messageType: content.mediaType || 'text',
        content: content.text,
        mediaCaption: content.caption || null,
        mediaMimeType: content.mimeType || null,
        mediaFilename: content.filename || null,
        mediaDownloadStatus: content.hasMedia ? 'pending' : 'none',
        waMessageId,
        status: 'delivered',
        timestamp: ts,
        metadata: content.metadata || null,
      });

      await this.updateConversationLastMessage(
        conv.id,
        content.text || `[${content.mediaType}]`,
        new Date(ts).toISOString(),
        true
      );
    } catch (err) {
      console.error(`[Sync] Error saving inbound message:`, err.message);
    }
  }

  async saveOutboundMessage(userId, to, text, waMessageId, media = null) {
    if (!this.enabled) return;

    try {
      let phone = to.replace(/\D/g, '');
      if (phone.length === 10) phone = `52${phone}`;

      const conv = await this.getOrCreateConversation(userId, phone);
      if (!conv) return;

      await this.upsertMessage(userId, conv.id, {
        direction: 'outbound',
        messageType: media?.mediaType || 'text',
        content: text,
        mediaMimeType: media?.mimeType || null,
        mediaFilename: media?.filename || null,
        mediaDownloadStatus: 'none',
        waMessageId,
        status: 'sent',
        timestamp: Date.now(),
      });

      await this.updateConversationLastMessage(conv.id, text, new Date().toISOString(), false);
    } catch (err) {
      console.error(`[Sync] Error saving outbound message:`, err.message);
    }
  }

  // ─── Message Status Updates ───────────────────────────────────

  async updateMessageStatus(userId, waMessageId, status) {
    if (!this.enabled || !waMessageId) return;

    try {
      const statusMap = { server_ack: 'sent', delivery_ack: 'delivered', read: 'read', played: 'read' };
      const mappedStatus = statusMap[status] || status;
      if (!['sent', 'delivered', 'read', 'failed'].includes(mappedStatus)) return;

      await this.supabase
        .from('whatsapp_messages')
        .update({ status: mappedStatus })
        .eq('user_id', userId)
        .eq('wa_message_id', waMessageId);
    } catch {}
  }

  // ─── Chats Sync ──────────────────────────────────────────────

  async syncChats(userId, chats) {
    if (!this.enabled || !chats || chats.length === 0) return;

    try {
      const { data: session } = await this.supabase
        .from('whatsapp_sessions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!session) return;

      let synced = 0;
      for (const chat of chats) {
        if (!chat.id || chat.id === 'status@broadcast') continue;
        if (chat.id.includes('@g.us')) continue;

        const phone = chat.id.split('@')[0];
        const name = chat.name || chat.notify || null;
        const lastMsgAt = chat.conversationTimestamp
          ? new Date(chat.conversationTimestamp * 1000).toISOString()
          : new Date().toISOString();

        const { error } = await this.supabase
          .from('whatsapp_conversations')
          .upsert({
            user_id: userId,
            session_id: session.id,
            remote_phone: phone,
            remote_name: name,
            last_message_at: lastMsgAt,
            unread_count: chat.unreadCount || 0,
          }, { onConflict: 'user_id,remote_phone' });

        if (!error) synced++;
      }

      console.log(`[${userId}] Synced ${synced} chats to Supabase`);
    } catch (err) {
      console.error(`[Sync] Error syncing chats:`, err.message);
    }
  }

  // ─── Contacts Sync ───────────────────────────────────────────

  async syncContacts(userId, contacts) {
    if (!this.enabled || !contacts || contacts.length === 0) return;

    let synced = 0;
    for (const contact of contacts) {
      if (!contact.id || contact.id === 'status@broadcast') continue;
      if (contact.id.includes('@g.us')) continue;

      const phone = contact.id.split('@')[0];
      const name = contact.notify || contact.name || contact.verifiedName;
      if (name) await this.updateConversationName(userId, phone, name);

      // Persist to whatsapp_contacts table for name resolution
      await this.upsertContact(userId, phone, contact);
      synced++;
    }
    console.log(`[${userId}] Synced ${synced} contacts to whatsapp_contacts`);
  }

  async upsertContact(userId, phone, contactData) {
    if (!this.enabled) return;

    try {
      const record = {
        user_id: userId,
        phone,
        jid: contactData.id || `${phone}@s.whatsapp.net`,
        is_business: !!contactData.isBusiness,
      };

      // Only set non-empty values to avoid overwriting good data with null
      if (contactData.name) record.saved_name = contactData.name;
      if (contactData.notify) record.notify_name = contactData.notify;
      if (contactData.verifiedName) record.verified_name = contactData.verifiedName;
      if (contactData.pushName) record.push_name = contactData.pushName;
      if (contactData.shortName) record.short_name = contactData.shortName;
      if (contactData.imgUrl) record.profile_pic_url = contactData.imgUrl;

      // Store raw data for debugging
      const { id, lid, ...safeData } = contactData;
      record.raw_contact_data = safeData;

      await this.supabase
        .from('whatsapp_contacts')
        .upsert(record, { onConflict: 'user_id,phone' });
    } catch (err) {
      if (err.code !== '23505') {
        console.error(`[Sync] Error upserting contact ${phone}:`, err.message);
      }
    }
  }

  async updateContactPushName(userId, phone, pushName) {
    if (!this.enabled || !pushName) return;

    try {
      // Upsert: only update push_name, don't overwrite better names
      await this.supabase
        .from('whatsapp_contacts')
        .upsert({
          user_id: userId,
          phone,
          push_name: pushName,
        }, { onConflict: 'user_id,phone' });
    } catch {}
  }

  // ─── Media Download & Storage ─────────────────────────────────

  async downloadAndStoreMedia(userId, conversationId, msg, content, sock) {
    if (!this.enabled || !sock || !content.hasMedia) return;

    const waMessageId = msg.key?.id;
    if (!waMessageId) return;

    try {
      await this.supabase
        .from('whatsapp_messages')
        .update({ media_download_status: 'downloading' })
        .eq('user_id', userId)
        .eq('wa_message_id', waMessageId);

      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      const buffer = await downloadMediaMessage(msg, 'buffer', {});

      if (!buffer || buffer.length === 0) {
        await this.supabase
          .from('whatsapp_messages')
          .update({ media_download_status: 'failed' })
          .eq('user_id', userId)
          .eq('wa_message_id', waMessageId);
        return;
      }

      const ext = mime.extension(content.mimeType) || 'bin';
      const filename = content.filename || `${content.mediaType}_${Date.now()}.${ext}`;
      const storagePath = `${userId}/${conversationId}/${waMessageId}_${filename}`;

      const { error: uploadError } = await this.supabase.storage
        .from('whatsapp-media')
        .upload(storagePath, buffer, {
          contentType: content.mimeType || 'application/octet-stream',
          upsert: true,
        });

      if (uploadError) {
        console.error(`[Sync] Upload error:`, uploadError.message);
        await this.supabase
          .from('whatsapp_messages')
          .update({ media_download_status: 'failed' })
          .eq('user_id', userId)
          .eq('wa_message_id', waMessageId);
        return;
      }

      const { data: signedData } = await this.supabase.storage
        .from('whatsapp-media')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

      await this.supabase
        .from('whatsapp_messages')
        .update({
          media_url: signedData?.signedUrl || null,
          media_storage_path: storagePath,
          media_file_size: buffer.length,
          media_download_status: 'downloaded',
          media_mime_type: content.mimeType,
        })
        .eq('user_id', userId)
        .eq('wa_message_id', waMessageId);

    } catch (err) {
      console.error(`[Sync] Media download error:`, err.message);
      await this.supabase
        .from('whatsapp_messages')
        .update({ media_download_status: 'failed' })
        .eq('user_id', userId)
        .eq('wa_message_id', waMessageId);
    }
  }

  // ─── Content Extraction ───────────────────────────────────────

  extractMessageContent(msg) {
    const m = msg.message;
    if (!m) return null;

    if (m.conversation) return { text: m.conversation, mediaType: 'text', hasMedia: false };
    if (m.extendedTextMessage?.text) return { text: m.extendedTextMessage.text, mediaType: 'text', hasMedia: false };
    if (m.imageMessage) {
      return {
        text: m.imageMessage.caption || null,
        caption: m.imageMessage.caption || null,
        mediaType: 'image',
        mimeType: m.imageMessage.mimetype || 'image/jpeg',
        hasMedia: true,
        metadata: { width: m.imageMessage.width, height: m.imageMessage.height },
      };
    }
    if (m.videoMessage) {
      return {
        text: m.videoMessage.caption || null,
        caption: m.videoMessage.caption || null,
        mediaType: 'video',
        mimeType: m.videoMessage.mimetype || 'video/mp4',
        hasMedia: true,
        metadata: { duration: m.videoMessage.seconds },
      };
    }
    if (m.audioMessage) {
      return {
        text: null,
        mediaType: m.audioMessage.ptt ? 'voice_note' : 'audio',
        mimeType: m.audioMessage.mimetype || 'audio/ogg',
        hasMedia: true,
        metadata: { duration: m.audioMessage.seconds, ptt: m.audioMessage.ptt },
      };
    }
    if (m.documentMessage) {
      return {
        text: m.documentMessage.caption || null,
        caption: m.documentMessage.caption || null,
        mediaType: 'document',
        mimeType: m.documentMessage.mimetype || 'application/octet-stream',
        filename: m.documentMessage.fileName,
        hasMedia: true,
        metadata: { pageCount: m.documentMessage.pageCount, fileSize: m.documentMessage.fileLength },
      };
    }
    if (m.stickerMessage) {
      return {
        text: null,
        mediaType: 'sticker',
        mimeType: m.stickerMessage.mimetype || 'image/webp',
        hasMedia: true,
        metadata: { animated: m.stickerMessage.isAnimated },
      };
    }
    if (m.contactMessage || m.contactsArrayMessage) {
      const contact = m.contactMessage || m.contactsArrayMessage?.contacts?.[0];
      const displayName = contact?.displayName || 'Contacto';
      const vcard = contact?.vcard || '';
      const phoneMatch = vcard.match(/TEL[^:]*:([^\n]+)/i);
      return {
        text: displayName,
        mediaType: 'contact',
        hasMedia: false,
        metadata: { displayName, phone: phoneMatch ? phoneMatch[1].trim() : null, vcard },
      };
    }
    if (m.locationMessage || m.liveLocationMessage) {
      const loc = m.locationMessage || m.liveLocationMessage;
      return {
        text: loc.name || loc.address || null,
        mediaType: 'location',
        hasMedia: false,
        metadata: { latitude: loc.degreesLatitude, longitude: loc.degreesLongitude, name: loc.name, address: loc.address },
      };
    }

    return { text: null, mediaType: 'unknown', hasMedia: false };
  }

  // ─── Audit Logging ────────────────────────────────────────────

  async logAudit(userId, action, details = {}) {
    if (!this.enabled) return;
    try {
      await this.supabase.from('whatsapp_audit_log').insert({ user_id: userId, action, details });
    } catch {}
  }
}

module.exports = { SupabaseSync };
