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

  async getSessionId(userId) {
    const { data } = await this.supabase
      .from('whatsapp_sessions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.id || null;
  }

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

      const sessionId = await this.getSessionId(userId);
      if (!sessionId) return null;

      const { data: newConv } = await this.supabase
        .from('whatsapp_conversations')
        .insert({
          user_id: userId,
          session_id: sessionId,
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

  // Group conversations use the full JID (e.g. "1234567890-1234567890@g.us") as remote_phone
  async getOrCreateGroupConversation(userId, groupJid, groupName = null) {
    if (!this.enabled) return null;

    try {
      let { data: conv } = await this.supabase
        .from('whatsapp_conversations')
        .select('id, session_id')
        .eq('user_id', userId)
        .eq('remote_phone', groupJid)
        .maybeSingle();

      if (conv) return conv;

      const sessionId = await this.getSessionId(userId);
      if (!sessionId) return null;

      const insertData = {
        user_id: userId,
        session_id: sessionId,
        remote_phone: groupJid,
        remote_name: groupName || groupJid,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      };

      // Add is_group / group_name if columns exist (safe — no-op if missing)
      insertData.is_group = true;
      insertData.group_name = groupName || groupJid;

      const { data: newConv } = await this.supabase
        .from('whatsapp_conversations')
        .insert(insertData)
        .select('id, session_id')
        .single();

      return newConv;
    } catch (err) {
      if (err.code === '23505') {
        const { data: conv } = await this.supabase
          .from('whatsapp_conversations')
          .select('id, session_id')
          .eq('user_id', userId)
          .eq('remote_phone', groupJid)
          .maybeSingle();
        return conv;
      }
      // If is_group / group_name columns don't exist yet, retry without them
      if (err.code === '42703') {
        try {
          const sessionId = await this.getSessionId(userId);
          if (!sessionId) return null;
          const { data: newConv } = await this.supabase
            .from('whatsapp_conversations')
            .insert({
              user_id: userId,
              session_id: sessionId,
              remote_phone: groupJid,
              remote_name: groupName || groupJid,
              last_message_at: new Date().toISOString(),
              unread_count: 0,
            })
            .select('id, session_id')
            .single();
          return newConv;
        } catch {}
      }
      console.error(`[Sync] Error getting/creating group conversation ${groupJid}:`, err.message);
      return null;
    }
  }

  async getOrCreateConversationForJid(userId, jid, displayName = null) {
    if (!jid) return null;
    if (jid.includes('@g.us')) {
      return this.getOrCreateGroupConversation(userId, jid, displayName);
    }
    const phone = jid.split('@')[0];
    return this.getOrCreateConversation(userId, phone, displayName);
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

  async updateGroupConversationName(userId, groupJid, name) {
    if (!this.enabled || !name) return;
    try {
      const updateData = { remote_name: name };
      // Attempt to also set group_name if column exists
      try {
        await this.supabase
          .from('whatsapp_conversations')
          .update({ ...updateData, group_name: name })
          .eq('user_id', userId)
          .eq('remote_phone', groupJid);
      } catch {
        await this.supabase
          .from('whatsapp_conversations')
          .update(updateData)
          .eq('user_id', userId)
          .eq('remote_phone', groupJid);
      }
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

      // Add sender_jid for group messages if column exists
      if (msgData.senderJid) {
        record.sender_jid = msgData.senderJid;
        record.sender_name = msgData.senderName || null;
      }

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
          // If sender_jid column doesn't exist, retry without it
          if (error.code === '42703' && msgData.senderJid) {
            delete record.sender_jid;
            delete record.sender_name;
            const { data: d2 } = await this.supabase
              .from('whatsapp_messages')
              .upsert(record, { onConflict: 'user_id,wa_message_id', ignoreDuplicates: true })
              .select('id')
              .maybeSingle();
            return d2;
          }
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
    let skipped = 0;
    let groups = 0;

    await this.logAudit(userId, 'sync_history_started', { total_messages: messages.length });
    console.log(`[${userId}] [History] Processing ${messages.length} messages from history batch`);

    for (const msg of messages) {
      try {
        if (!msg.message && !msg.messageStubType) { skipped++; continue; }

        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') { skipped++; continue; }

        const isGroup = remoteJid.includes('@g.us');
        const isFromMe = msg.key?.fromMe || false;

        // For groups: use full JID as key; for individuals: use phone number
        const phone = isGroup ? remoteJid : remoteJid.split('@')[0];
        const pushName = msg.pushName || (isGroup ? null : phone);

        // Determine sender JID for group messages
        const senderJid = isGroup
          ? (isFromMe ? null : (msg.key?.participant || msg.participant || null))
          : null;

        let conv;
        if (isGroup) {
          // We'll update group name later from group metadata if available
          conv = await this.getOrCreateGroupConversation(userId, remoteJid, null);
          groups++;
        } else {
          conv = await this.getOrCreateConversation(userId, phone, isFromMe ? null : pushName);
        }
        if (!conv) { skipped++; continue; }

        const content = this.extractMessageContent(msg);
        if (!content) { skipped++; continue; }

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
          senderJid: senderJid || undefined,
          senderName: pushName || undefined,
        });
        synced++;

        // Download media for recent messages (last 7 days)
        if (content.hasMedia && sock && (Date.now() - msgTimestamp < 7 * 86400000)) {
          this.downloadAndStoreMedia(userId, conv.id, msg, content, sock).catch(() => {});
        }
      } catch (err) {
        skipped++;
        if (err.code !== '23505') {
          console.error(`[Sync] History msg error:`, err.message);
        }
      }
    }

    await this.logAudit(userId, 'sync_history_completed', {
      synced_count: synced,
      skipped_count: skipped,
      group_messages: groups,
      total_attempted: messages.length,
    });

    console.log(`[${userId}] [History] Synced ${synced}/${messages.length} messages (${groups} group, ${skipped} skipped)`);
    return synced;
  }

  // ─── Real-time Message Sync ───────────────────────────────────

  async saveInboundMessage(userId, jidOrPhone, pushName, content, waMessageId, msgTimestamp = null, senderJid = null) {
    if (!this.enabled) return;

    try {
      let conv;
      if (jidOrPhone && jidOrPhone.includes('@g.us')) {
        conv = await this.getOrCreateGroupConversation(userId, jidOrPhone, null);
      } else {
        const phone = (jidOrPhone || '').replace(/\D/g, '') || jidOrPhone;
        conv = await this.getOrCreateConversation(userId, phone, pushName);
      }
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
        senderJid: senderJid || undefined,
        senderName: pushName || undefined,
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
      let conv;
      // to can be a phone, JID, or group JID
      if (to && to.includes('@g.us')) {
        conv = await this.getOrCreateGroupConversation(userId, to, null);
      } else {
        let phone = to.replace(/\D/g, '');
        if (phone.length === 10) phone = `52${phone}`;
        conv = await this.getOrCreateConversation(userId, phone);
      }
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
      const sessionId = await this.getSessionId(userId);
      if (!sessionId) return;

      let synced = 0;
      let groupsSynced = 0;

      for (const chat of chats) {
        if (!chat.id || chat.id === 'status@broadcast') continue;

        const isGroup = chat.id.includes('@g.us');
        // Use full JID as remote_phone for groups, phone number for individuals
        const remotePhone = isGroup ? chat.id : chat.id.split('@')[0];
        const name = chat.name || chat.notify || null;
        const lastMsgAt = chat.conversationTimestamp
          ? new Date(chat.conversationTimestamp * 1000).toISOString()
          : new Date().toISOString();

        const upsertData = {
          user_id: userId,
          session_id: sessionId,
          remote_phone: remotePhone,
          remote_name: name,
          last_message_at: lastMsgAt,
          unread_count: chat.unreadCount || 0,
        };

        // Add group fields if available — safe to include, DB will ignore unknown columns gracefully
        // (column errors caught below)
        if (isGroup) {
          try {
            await this.supabase
              .from('whatsapp_conversations')
              .upsert({
                ...upsertData,
                is_group: true,
                group_name: name,
              }, { onConflict: 'user_id,remote_phone' });
          } catch {
            await this.supabase
              .from('whatsapp_conversations')
              .upsert(upsertData, { onConflict: 'user_id,remote_phone' });
          }
          groupsSynced++;
        } else {
          await this.supabase
            .from('whatsapp_conversations')
            .upsert(upsertData, { onConflict: 'user_id,remote_phone' });
        }
        synced++;
      }

      console.log(`[${userId}] [Chats] Synced ${synced} chats (${groupsSynced} groups) to Supabase`);
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

      const isGroup = contact.id.includes('@g.us');
      if (isGroup) {
        // Update group conversation name if we have it
        const groupName = contact.name || contact.notify || contact.verifiedName;
        if (groupName) {
          await this.updateGroupConversationName(userId, contact.id, groupName);
        }
        continue;
      }

      const phone = contact.id.split('@')[0];
      const name = contact.notify || contact.name || contact.verifiedName;
      if (name) await this.updateConversationName(userId, phone, name);

      await this.upsertContact(userId, phone, contact);
      synced++;
    }
    console.log(`[${userId}] [Contacts] Synced ${synced} contacts`);
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

      if (contactData.name) record.saved_name = contactData.name;
      if (contactData.notify) record.notify_name = contactData.notify;
      if (contactData.verifiedName) record.verified_name = contactData.verifiedName;
      if (contactData.pushName) record.push_name = contactData.pushName;
      if (contactData.shortName) record.short_name = contactData.shortName;
      if (contactData.imgUrl) record.profile_pic_url = contactData.imgUrl;

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

    // Unwrap ephemeral / view-once wrappers
    const inner = m.ephemeralMessage?.message
      || m.viewOnceMessage?.message
      || m.viewOnceMessageV2?.message
      || m.viewOnceMessageV2Extension?.message
      || m;

    if (inner.conversation) return { text: inner.conversation, mediaType: 'text', hasMedia: false };
    if (inner.extendedTextMessage?.text) {
      return {
        text: inner.extendedTextMessage.text,
        mediaType: 'text',
        hasMedia: false,
        metadata: inner.extendedTextMessage.contextInfo ? {
          quotedMessageId: inner.extendedTextMessage.contextInfo.stanzaId,
        } : null,
      };
    }
    if (inner.imageMessage) {
      return {
        text: inner.imageMessage.caption || null,
        caption: inner.imageMessage.caption || null,
        mediaType: 'image',
        mimeType: inner.imageMessage.mimetype || 'image/jpeg',
        hasMedia: true,
        metadata: { width: inner.imageMessage.width, height: inner.imageMessage.height },
      };
    }
    if (inner.videoMessage) {
      return {
        text: inner.videoMessage.caption || null,
        caption: inner.videoMessage.caption || null,
        mediaType: inner.videoMessage.gifPlayback ? 'gif' : 'video',
        mimeType: inner.videoMessage.mimetype || 'video/mp4',
        hasMedia: true,
        metadata: { duration: inner.videoMessage.seconds, gif: !!inner.videoMessage.gifPlayback },
      };
    }
    if (inner.audioMessage) {
      return {
        text: null,
        mediaType: inner.audioMessage.ptt ? 'voice_note' : 'audio',
        mimeType: inner.audioMessage.mimetype || 'audio/ogg',
        hasMedia: true,
        metadata: { duration: inner.audioMessage.seconds, ptt: inner.audioMessage.ptt },
      };
    }
    if (inner.documentMessage) {
      return {
        text: inner.documentMessage.caption || null,
        caption: inner.documentMessage.caption || null,
        mediaType: 'document',
        mimeType: inner.documentMessage.mimetype || 'application/octet-stream',
        filename: inner.documentMessage.fileName,
        hasMedia: true,
        metadata: { pageCount: inner.documentMessage.pageCount, fileSize: inner.documentMessage.fileLength },
      };
    }
    if (inner.stickerMessage) {
      return {
        text: null,
        mediaType: 'sticker',
        mimeType: inner.stickerMessage.mimetype || 'image/webp',
        hasMedia: true,
        metadata: { animated: inner.stickerMessage.isAnimated },
      };
    }
    if (inner.contactMessage || inner.contactsArrayMessage) {
      const contact = inner.contactMessage || inner.contactsArrayMessage?.contacts?.[0];
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
    if (inner.locationMessage || inner.liveLocationMessage) {
      const loc = inner.locationMessage || inner.liveLocationMessage;
      return {
        text: loc.name || loc.address || null,
        mediaType: 'location',
        hasMedia: false,
        metadata: { latitude: loc.degreesLatitude, longitude: loc.degreesLongitude, name: loc.name, address: loc.address },
      };
    }
    if (inner.reactionMessage) {
      return {
        text: inner.reactionMessage.text || '❤️',
        mediaType: 'reaction',
        hasMedia: false,
        metadata: { reactionText: inner.reactionMessage.text, reactionKey: inner.reactionMessage.key?.id },
      };
    }
    if (inner.pollCreationMessage) {
      return {
        text: inner.pollCreationMessage.name || 'Encuesta',
        mediaType: 'poll',
        hasMedia: false,
        metadata: { question: inner.pollCreationMessage.name, options: inner.pollCreationMessage.options },
      };
    }

    // Message stub types (e.g. "XX added to group", etc.) — return minimal text
    if (msg.messageStubType) {
      return { text: `[${msg.messageStubType}]`, mediaType: 'system', hasMedia: false };
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
