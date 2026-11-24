const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const SESSIONS_DIR = path.join(process.cwd(), 'sessions');

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

const logger = pino({ level: 'warn' });

class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  getSession(userId) {
    return this.sessions.get(userId) || null;
  }

  getActiveCount() {
    let count = 0;
    for (const s of this.sessions.values()) {
      if (s.status === 'connected') count++;
    }
    return count;
  }

  getAllSessions() {
    const result = [];
    for (const [userId, s] of this.sessions.entries()) {
      result.push({
        userId,
        status: s.status,
        phone: s.phone,
        name: s.name,
        connectedAt: s.connectedAt,
      });
    }
    return result;
  }

  // Returns messages from memory store — key can be phone number OR full JID
  getMessagesFromStore(session, key, limit = 50) {
    if (!session) return [];
    // Try exact key first (could be JID like "1234@g.us"), then phone digits
    const direct = session.messageStore?.[key];
    if (direct) return direct.slice(-limit);
    // Try phone digits only (strip "@s.whatsapp.net")
    const phone = key.split('@')[0];
    return (session.messageStore?.[phone] || []).slice(-limit);
  }

  async connect(userId, supabaseSync) {
    const existing = this.sessions.get(userId);
    if (existing?.status === 'connected' && existing.sock) {
      return { status: 'already_connected', connected: true };
    }

    if (existing?.sock) {
      try { existing.sock.end(); } catch {}
    }

    const sessionDir = path.join(SESSIONS_DIR, userId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sessionData = {
      status: 'connecting',
      qrCode: null,
      qrBase64: null,
      phone: null,
      name: null,
      sock: null,
      connectedAt: null,
      conversations: [],
      messageStore: {},     // keyed by phone (individual) or full JID (group)
      groupMetadata: {},    // keyed by group JID
    };
    this.sessions.set(userId, sessionData);

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      syncFullHistory: true,
    });

    sessionData.sock = sock;

    // ─── Connection Updates ─────────────────────────────────────
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        sessionData.status = 'qr_pending';
        sessionData.qrCode = qr;
        try {
          sessionData.qrBase64 = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        } catch {}
        await supabaseSync.updateSessionStatus(userId, 'qr_pending');
        console.log(`[${userId}] QR code generated`);
      }

      if (connection === 'open') {
        sessionData.status = 'connected';
        sessionData.qrCode = null;
        sessionData.qrBase64 = null;
        sessionData.connectedAt = new Date().toISOString();

        const me = sock.user;
        if (me) {
          sessionData.phone = me.id.split(':')[0].split('@')[0];
          sessionData.name = me.name || null;
        }

        await supabaseSync.updateSessionStatus(userId, 'connected', {
          phone: sessionData.phone,
          connectedAt: sessionData.connectedAt,
        });

        console.log(`[${userId}] WhatsApp connected: ${sessionData.phone}`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log(`[${userId}] Reconnecting... (code ${statusCode})`);
          await supabaseSync.logAudit(userId, 'reconnect', { reason: statusCode });
          setTimeout(() => this.connect(userId, supabaseSync), 3000);
        } else {
          sessionData.status = 'disconnected';
          sessionData.qrCode = null;
          sessionData.qrBase64 = null;
          sessionData.sock = null;
          try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
          await supabaseSync.updateSessionStatus(userId, 'disconnected');
          console.log(`[${userId}] Logged out`);
        }
      }
    });

    // ─── Credentials ────────────────────────────────────────────
    sock.ev.on('creds.update', saveCreds);

    // ─── Chats Sync (initial chat list) ─────────────────────────
    sock.ev.on('chats.set', ({ chats }) => {
      console.log(`[${userId}] chats.set: ${chats.length} chats received`);

      for (const chat of chats) {
        if (!chat.id || chat.id === 'status@broadcast') continue;

        const isGroup = chat.id.includes('@g.us');
        const key = isGroup ? chat.id : chat.id.split('@')[0];
        const name = chat.name || chat.notify || key;
        const lastMsg = chat.conversationTimestamp
          ? new Date(chat.conversationTimestamp * 1000).toISOString()
          : new Date().toISOString();

        const idx = sessionData.conversations.findIndex(c => c.phone === key);
        if (idx < 0) {
          sessionData.conversations.push({
            phone: key,
            name,
            lastMessage: '',
            lastMessageAt: lastMsg,
            unreadCount: chat.unreadCount || 0,
            isGroup,
          });
        }
      }

      sessionData.conversations.sort((a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      // Persist to Supabase
      supabaseSync.syncChats(userId, chats);
    });

    sock.ev.on('chats.update', (updates) => {
      for (const update of updates) {
        if (!update.id) continue;
        const isGroup = update.id.includes('@g.us');
        const key = isGroup ? update.id : update.id.split('@')[0];
        const idx = sessionData.conversations.findIndex(c => c.phone === key);
        if (idx >= 0) {
          if (update.unreadCount !== undefined) sessionData.conversations[idx].unreadCount = update.unreadCount;
          if (update.name) sessionData.conversations[idx].name = update.name;
        }
      }
    });

    // ─── Contacts Sync ──────────────────────────────────────────
    sock.ev.on('contacts.set', ({ contacts }) => {
      console.log(`[${userId}] contacts.set: ${contacts.length} contacts received`);

      for (const contact of contacts) {
        if (!contact.id || contact.id === 'status@broadcast') continue;
        const isGroup = contact.id.includes('@g.us');
        const key = isGroup ? contact.id : contact.id.split('@')[0];
        const name = contact.notify || contact.name || contact.verifiedName;
        if (!name) continue;
        const idx = sessionData.conversations.findIndex(c => c.phone === key);
        if (idx >= 0) sessionData.conversations[idx].name = name;
      }
      supabaseSync.syncContacts(userId, contacts);
    });

    sock.ev.on('contacts.update', (updates) => {
      for (const contact of updates) {
        if (!contact.id) continue;
        const isGroup = contact.id.includes('@g.us');
        const key = isGroup ? contact.id : contact.id.split('@')[0];
        const name = contact.notify || contact.name || contact.verifiedName;
        if (!name) continue;
        const idx = sessionData.conversations.findIndex(c => c.phone === key);
        if (idx >= 0) sessionData.conversations[idx].name = name;

        if (isGroup) {
          supabaseSync.updateGroupConversationName(userId, contact.id, name);
        } else {
          supabaseSync.updateConversationName(userId, key, name);
          supabaseSync.upsertContact(userId, key, contact).catch(() => {});
        }
      }
    });

    // ─── Group Metadata ──────────────────────────────────────────
    sock.ev.on('groups.update', (updates) => {
      for (const update of updates) {
        if (!update.id) continue;
        const groupJid = update.id;
        if (update.subject) {
          sessionData.groupMetadata[groupJid] = {
            ...(sessionData.groupMetadata[groupJid] || {}),
            subject: update.subject,
          };
          const idx = sessionData.conversations.findIndex(c => c.phone === groupJid);
          if (idx >= 0) sessionData.conversations[idx].name = update.subject;
          supabaseSync.updateGroupConversationName(userId, groupJid, update.subject);
        }
      }
    });

    sock.ev.on('group-participants.update', ({ id: groupJid, participants, action }) => {
      console.log(`[${userId}] group-participants.update: ${action} in ${groupJid}`);
      // Update participant list in memory if we track it
      if (!sessionData.groupMetadata[groupJid]) {
        sessionData.groupMetadata[groupJid] = {};
      }
    });

    // ─── messages.set (full initial message set from WhatsApp) ───
    sock.ev.on('messages.set', async ({ messages: msgs, isLatest }) => {
      console.log(`[${userId}] messages.set: ${msgs.length} messages received (isLatest=${isLatest})`);

      let stored = 0;
      for (const msg of msgs) {
        if (!msg.message && !msg.messageStubType) continue;

        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') continue;

        const isGroup = remoteJid.includes('@g.us');
        const key = isGroup ? remoteJid : remoteJid.split('@')[0];
        const isFromMe = msg.key?.fromMe || false;
        const pushName = msg.pushName || (isGroup ? null : key);
        const content = supabaseSync.extractMessageContent(msg);
        if (!content) continue;

        const msgTimestamp = msg.messageTimestamp
          ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp))
          : Math.floor(Date.now() / 1000);

        if (!sessionData.messageStore[key]) sessionData.messageStore[key] = [];
        const existsInStore = sessionData.messageStore[key].some(m => m.id === msg.key.id);
        if (!existsInStore) {
          const senderJid = isGroup && !isFromMe
            ? (msg.key?.participant || msg.participant || null)
            : null;
          const senderName = isGroup && !isFromMe
            ? (pushName || senderJid?.split('@')[0] || null)
            : null;

          sessionData.messageStore[key].push({
            id: msg.key.id,
            from: isFromMe ? 'me' : (isGroup ? (senderJid || key) : key),
            fromName: isFromMe ? 'me' : (senderName || pushName || key),
            content: content.text,
            mediaType: content.mediaType,
            timestamp: msgTimestamp * 1000,
            direction: isFromMe ? 'outbound' : 'inbound',
            isGroup,
            senderJid: senderJid || undefined,
          });
          stored++;
        }
      }

      // Sort and trim
      for (const key of Object.keys(sessionData.messageStore)) {
        sessionData.messageStore[key].sort((a, b) => a.timestamp - b.timestamp);
        if (sessionData.messageStore[key].length > 500) {
          sessionData.messageStore[key] = sessionData.messageStore[key].slice(-500);
        }
      }

      console.log(`[${userId}] messages.set: stored ${stored} in memory`);

      // Persist to Supabase
      supabaseSync.syncHistoryBatch(userId, msgs, sock).catch(err => {
        console.error(`[${userId}] messages.set sync error:`, err.message);
      });
    });

    // ─── Messages (real-time new + history append) ──────────────
    sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
      for (const msg of msgs) {
        if (!msg.message && !msg.messageStubType) continue;

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') continue;

        const isGroup = remoteJid.includes('@g.us');
        // Store key: full JID for groups, phone number for individuals
        const key = isGroup ? remoteJid : remoteJid.split('@')[0];
        const isFromMe = msg.key.fromMe || false;
        const pushName = msg.pushName || (isGroup ? null : key);

        // For groups: participant field tells us who sent in the group
        const senderJid = isGroup && !isFromMe
          ? (msg.key?.participant || msg.participant || null)
          : null;
        const senderName = isGroup && !isFromMe
          ? (pushName || senderJid?.split('@')[0] || null)
          : null;

        const content = supabaseSync.extractMessageContent(msg);
        if (!content) continue;

        const msgTimestamp = msg.messageTimestamp
          ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp))
          : Math.floor(Date.now() / 1000);

        // Store in memory
        if (!sessionData.messageStore[key]) sessionData.messageStore[key] = [];
        const existsInStore = sessionData.messageStore[key].some(m => m.id === msg.key.id);
        if (!existsInStore) {
          sessionData.messageStore[key].push({
            id: msg.key.id,
            from: isFromMe ? 'me' : (isGroup ? (senderJid || key) : key),
            fromName: isFromMe ? 'me' : (senderName || pushName || key),
            content: content.text,
            mediaType: content.mediaType,
            timestamp: msgTimestamp * 1000,
            direction: isFromMe ? 'outbound' : 'inbound',
            isGroup,
            senderJid: senderJid || undefined,
          });
          sessionData.messageStore[key].sort((a, b) => a.timestamp - b.timestamp);
          if (sessionData.messageStore[key].length > 500) {
            sessionData.messageStore[key] = sessionData.messageStore[key].slice(-500);
          }
        }

        // Update conversation list
        this.updateConversationList(sessionData, key, isFromMe ? null : (senderName || pushName), content.text || `[${content.mediaType}]`, isFromMe, isGroup);

        // Update contact pushName
        if (!isFromMe && pushName && pushName !== key && !isGroup) {
          supabaseSync.updateContactPushName(userId, key, pushName).catch(() => {});
        }

        // Persist ALL messages to Supabase (not just type===notify)
        if (isFromMe) {
          await supabaseSync.saveOutboundMessage(userId, isGroup ? remoteJid : key, content.text || `[${content.mediaType}]`, msg.key.id, {
            mediaType: content.mediaType !== 'text' ? content.mediaType : null,
            mimeType: content.mimeType,
            filename: content.filename,
          });
        } else {
          await supabaseSync.saveInboundMessage(
            userId,
            isGroup ? remoteJid : key,
            senderName || pushName,
            content,
            msg.key.id,
            msgTimestamp * 1000,
            senderJid
          );
        }

        // Download media for new messages only
        if (content.hasMedia && type === 'notify') {
          const convKey = isGroup ? remoteJid : key;
          const conv = isGroup
            ? await supabaseSync.getOrCreateGroupConversation(userId, remoteJid, null)
            : await supabaseSync.getOrCreateConversation(userId, key, pushName);
          if (conv) {
            supabaseSync.downloadAndStoreMedia(userId, conv.id, msg, content, sock).catch(() => {});
          }
        }
      }
    });

    // ─── Historical Messages Batch ──────────────────────────────
    sock.ev.on('messaging-history.set', ({ messages: msgs, isLatest, progress, syncType }) => {
      const label = syncType ? `syncType=${syncType}` : '';
      const prog = progress !== undefined ? ` progress=${progress}%` : '';
      console.log(`[${userId}] messaging-history.set: ${msgs.length} messages received (isLatest=${isLatest}${prog} ${label})`);

      // Store all in memory
      let stored = 0;
      for (const msg of msgs) {
        if (!msg.message && !msg.messageStubType) continue;
        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') continue;

        const isGroup = remoteJid.includes('@g.us');
        const key = isGroup ? remoteJid : remoteJid.split('@')[0];
        const isFromMe = msg.key?.fromMe || false;
        const content = supabaseSync.extractMessageContent(msg);
        if (!content) continue;

        const msgTimestamp = msg.messageTimestamp
          ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp))
          : Math.floor(Date.now() / 1000);

        const senderJid = isGroup && !isFromMe
          ? (msg.key?.participant || msg.participant || null)
          : null;
        const pushName = msg.pushName || (isGroup ? senderJid?.split('@')[0] : key) || key;

        if (!sessionData.messageStore[key]) sessionData.messageStore[key] = [];
        const exists = sessionData.messageStore[key].some(m => m.id === msg.key.id);
        if (!exists) {
          sessionData.messageStore[key].push({
            id: msg.key.id,
            from: isFromMe ? 'me' : (senderJid || key),
            fromName: isFromMe ? 'me' : pushName,
            content: content.text,
            mediaType: content.mediaType,
            timestamp: msgTimestamp * 1000,
            direction: isFromMe ? 'outbound' : 'inbound',
            isGroup,
            senderJid: senderJid || undefined,
          });
          stored++;
        }
      }

      // Sort all and trim
      for (const key of Object.keys(sessionData.messageStore)) {
        sessionData.messageStore[key].sort((a, b) => a.timestamp - b.timestamp);
        if (sessionData.messageStore[key].length > 500) {
          sessionData.messageStore[key] = sessionData.messageStore[key].slice(-500);
        }
      }

      console.log(`[${userId}] messaging-history.set: stored ${stored}/${msgs.length} new in memory`);

      // Persist to Supabase in background
      supabaseSync.syncHistoryBatch(userId, msgs, sock).catch(err => {
        console.error(`[${userId}] History sync error:`, err.message);
      });
    });

    // ─── Message Status Updates ─────────────────────────────────
    sock.ev.on('messages.update', (updates) => {
      for (const { key, update } of updates) {
        if (!key?.id || !update?.status) continue;
        const statusNames = { 2: 'sent', 3: 'delivered', 4: 'read' };
        const status = statusNames[update.status];
        if (status) {
          supabaseSync.updateMessageStatus(userId, key.id, status);
        }
      }
    });

    // ─── Message Reaction Updates ────────────────────────────────
    sock.ev.on('messages.reaction', (reactions) => {
      // Log only, no need to persist reactions for now
      for (const { key, reaction } of reactions) {
        if (reaction?.text) {
          console.log(`[${userId}] Reaction ${reaction.text} on message ${key?.id}`);
        }
      }
    });

    // Wait for first QR or connection
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (sessionData.qrBase64 || sessionData.status === 'connected') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
      setTimeout(() => { clearInterval(checkInterval); resolve(); }, 15000);
    });

    return {
      status: sessionData.status,
      qr: sessionData.qrCode,
      qrBase64: sessionData.qrBase64,
      connected: sessionData.status === 'connected',
    };
  }

  async disconnect(userId) {
    const session = this.sessions.get(userId);
    if (!session) return;

    if (session.sock) {
      try { await session.sock.logout(); } catch {}
      try { session.sock.end(); } catch {}
    }

    session.status = 'disconnected';
    session.sock = null;
    session.qrCode = null;
    session.qrBase64 = null;

    const sessionDir = path.join(SESSIONS_DIR, userId);
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
  }

  async sendMessage(userId, to, text, quotedId) {
    const session = this.sessions.get(userId);
    if (!session || session.status !== 'connected' || !session.sock) {
      throw new Error('Session not connected');
    }

    const jid = this.formatJid(to);
    const options = {};
    if (quotedId) {
      options.quoted = { key: { id: quotedId, remoteJid: jid } };
    }

    const result = await session.sock.sendMessage(jid, { text }, options);

    const isGroup = jid.includes('@g.us');
    const key = isGroup ? jid : jid.split('@')[0].replace(/\D/g, '');

    if (!session.messageStore[key]) session.messageStore[key] = [];
    session.messageStore[key].push({
      id: result.key.id,
      from: 'me',
      content: text,
      timestamp: Date.now(),
      direction: 'outbound',
      status: 'sent',
    });

    this.updateConversationList(session, key, null, text, true, isGroup);
    return result;
  }

  async sendMedia(userId, to, { base64, mimeType, filename, caption }) {
    const session = this.sessions.get(userId);
    if (!session || session.status !== 'connected' || !session.sock) {
      throw new Error('Session not connected');
    }

    const jid = this.formatJid(to);
    const buffer = Buffer.from(base64, 'base64');

    let msgContent;
    const type = mimeType.split('/')[0];

    if (type === 'image') {
      msgContent = { image: buffer, caption, mimetype: mimeType };
    } else if (type === 'video') {
      msgContent = { video: buffer, caption, mimetype: mimeType };
    } else if (type === 'audio') {
      msgContent = { audio: buffer, mimetype: mimeType, ptt: mimeType.includes('ogg') };
    } else {
      msgContent = { document: buffer, mimetype: mimeType, fileName: filename, caption };
    }

    return session.sock.sendMessage(jid, msgContent);
  }

  // Manual history sync trigger — re-fires syncHistoryBatch from what we have in memory
  async triggerHistorySync(userId, supabaseSync) {
    const session = this.sessions.get(userId);
    if (!session) throw new Error('No session found');
    if (session.status !== 'connected') throw new Error('Session not connected');

    const allMessages = [];
    for (const msgs of Object.values(session.messageStore)) {
      for (const m of msgs) {
        // Convert memory format back to minimal message format for syncHistoryBatch
        allMessages.push({
          key: { id: m.id, fromMe: m.direction === 'outbound', remoteJid: m.isGroup ? m.from : `${m.from}@s.whatsapp.net` },
          message: { conversation: m.content || '' },
          messageTimestamp: Math.floor(m.timestamp / 1000),
          pushName: m.fromName,
        });
      }
    }

    console.log(`[${userId}] Manual history sync: ${allMessages.length} messages from memory`);
    const synced = await supabaseSync.syncHistoryBatch(userId, allMessages, session.sock);
    return { synced, total: allMessages.length };
  }

  updateConversationList(sessionData, key, name, lastMessage, fromMe = false, isGroup = false) {
    const idx = sessionData.conversations.findIndex(c => c.phone === key);
    const conv = {
      phone: key,
      name: name || (idx >= 0 ? sessionData.conversations[idx].name : key),
      lastMessage: lastMessage || '',
      lastMessageAt: new Date().toISOString(),
      unreadCount: fromMe ? 0 : (idx >= 0 ? (sessionData.conversations[idx].unreadCount || 0) + 1 : 1),
      isGroup,
    };

    if (idx >= 0) {
      sessionData.conversations[idx] = { ...sessionData.conversations[idx], ...conv };
    } else {
      sessionData.conversations.unshift(conv);
    }

    sessionData.conversations.sort((a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }

  formatJid(to) {
    // Already a full JID
    if (to.includes('@')) return to;
    let clean = to.replace(/\D/g, '');
    if (clean.length === 10) clean = `52${clean}`;
    return `${clean}@s.whatsapp.net`;
  }
}

module.exports = { SessionManager };
