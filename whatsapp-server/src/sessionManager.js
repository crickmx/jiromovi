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
      messageStore: {},
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
          console.log(`[${userId}] Reconnecting...`);
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
      // Store in memory for quick access
      for (const chat of chats) {
        if (!chat.id || chat.id === 'status@broadcast') continue;
        if (chat.id.includes('@g.us')) continue;
        const phone = chat.id.split('@')[0];
        const name = chat.name || chat.notify || phone;
        const lastMsg = chat.conversationTimestamp
          ? new Date(chat.conversationTimestamp * 1000).toISOString()
          : new Date().toISOString();

        const idx = sessionData.conversations.findIndex(c => c.phone === phone);
        if (idx < 0) {
          sessionData.conversations.push({
            phone, name, lastMessage: '', lastMessageAt: lastMsg,
            unreadCount: chat.unreadCount || 0,
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
        if (!update.id || update.id.includes('@g.us')) continue;
        const phone = update.id.split('@')[0];
        const idx = sessionData.conversations.findIndex(c => c.phone === phone);
        if (idx >= 0) {
          if (update.unreadCount !== undefined) sessionData.conversations[idx].unreadCount = update.unreadCount;
        }
      }
    });

    // ─── Contacts Sync ──────────────────────────────────────────
    sock.ev.on('contacts.set', ({ contacts }) => {
      for (const contact of contacts) {
        if (!contact.id || contact.id === 'status@broadcast') continue;
        const phone = contact.id.split('@')[0];
        const name = contact.notify || contact.name || contact.verifiedName;
        if (!name) continue;
        const idx = sessionData.conversations.findIndex(c => c.phone === phone);
        if (idx >= 0) sessionData.conversations[idx].name = name;
      }
      supabaseSync.syncContacts(userId, contacts);
    });

    sock.ev.on('contacts.update', (updates) => {
      for (const contact of updates) {
        if (!contact.id) continue;
        const phone = contact.id.split('@')[0];
        const name = contact.notify || contact.name || contact.verifiedName;
        if (!name) continue;
        const idx = sessionData.conversations.findIndex(c => c.phone === phone);
        if (idx >= 0) sessionData.conversations[idx].name = name;
        supabaseSync.updateConversationName(userId, phone, name);
      }
    });

    // ─── Messages (real-time new + history append) ──────────────
    sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
      for (const msg of msgs) {
        if (!msg.message) continue;

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') continue;
        if (remoteJid.includes('@g.us')) continue;

        const phone = remoteJid.split('@')[0];
        const isFromMe = msg.key.fromMe || false;
        const pushName = msg.pushName || phone;

        const content = supabaseSync.extractMessageContent(msg);
        if (!content) continue;

        const msgTimestamp = msg.messageTimestamp
          ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp))
          : Math.floor(Date.now() / 1000);

        // Store in memory
        if (!sessionData.messageStore[phone]) sessionData.messageStore[phone] = [];
        const existsInStore = sessionData.messageStore[phone].some(m => m.id === msg.key.id);
        if (!existsInStore) {
          sessionData.messageStore[phone].push({
            id: msg.key.id,
            from: isFromMe ? 'me' : phone,
            fromName: isFromMe ? 'me' : pushName,
            content: content.text,
            mediaType: content.mediaType,
            timestamp: msgTimestamp * 1000,
            direction: isFromMe ? 'outbound' : 'inbound',
          });
          sessionData.messageStore[phone].sort((a, b) => a.timestamp - b.timestamp);
          if (sessionData.messageStore[phone].length > 500) {
            sessionData.messageStore[phone] = sessionData.messageStore[phone].slice(-500);
          }
        }

        // Update conversation list
        this.updateConversationList(sessionData, phone, isFromMe ? null : pushName, content.text || `[${content.mediaType}]`, isFromMe);

        // Persist ALL messages to Supabase (both notify and history/append)
        if (isFromMe) {
          await supabaseSync.saveOutboundMessage(userId, phone, content.text || `[${content.mediaType}]`, msg.key.id, {
            mediaType: content.mediaType !== 'text' ? content.mediaType : null,
            mimeType: content.mimeType,
            filename: content.filename,
          });
        } else {
          await supabaseSync.saveInboundMessage(userId, phone, pushName, content, msg.key.id, msgTimestamp * 1000);
        }

        // Download media for new messages
        if (content.hasMedia && type === 'notify') {
          const conv = await supabaseSync.getOrCreateConversation(userId, phone, pushName);
          if (conv) {
            supabaseSync.downloadAndStoreMedia(userId, conv.id, msg, content, sock).catch(() => {});
          }
        }
      }
    });

    // ─── Historical Messages Batch ──────────────────────────────
    sock.ev.on('messaging-history.set', ({ messages: msgs }) => {
      console.log(`[${userId}] Received ${msgs.length} historical messages`);

      // Store in memory for quick access
      for (const msg of msgs) {
        if (!msg.message) continue;
        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') continue;
        if (remoteJid.includes('@g.us')) continue;

        const phone = remoteJid.split('@')[0];
        const isFromMe = msg.key?.fromMe || false;
        const content = supabaseSync.extractMessageContent(msg);
        if (!content) continue;

        const msgTimestamp = msg.messageTimestamp
          ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp))
          : Math.floor(Date.now() / 1000);

        if (!sessionData.messageStore[phone]) sessionData.messageStore[phone] = [];
        const exists = sessionData.messageStore[phone].some(m => m.id === msg.key.id);
        if (!exists) {
          sessionData.messageStore[phone].push({
            id: msg.key.id,
            from: isFromMe ? 'me' : phone,
            fromName: isFromMe ? 'me' : (msg.pushName || phone),
            content: content.text,
            mediaType: content.mediaType,
            timestamp: msgTimestamp * 1000,
            direction: isFromMe ? 'outbound' : 'inbound',
          });
        }
      }

      // Sort all and trim
      for (const phone of Object.keys(sessionData.messageStore)) {
        sessionData.messageStore[phone].sort((a, b) => a.timestamp - b.timestamp);
        if (sessionData.messageStore[phone].length > 500) {
          sessionData.messageStore[phone] = sessionData.messageStore[phone].slice(-500);
        }
      }

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

    const phone = to.replace(/\D/g, '');
    if (!session.messageStore[phone]) session.messageStore[phone] = [];
    session.messageStore[phone].push({
      id: result.key.id,
      from: 'me',
      content: text,
      timestamp: Date.now(),
      direction: 'outbound',
      status: 'sent',
    });

    this.updateConversationList(session, phone, null, text, true);
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

  updateConversationList(sessionData, phone, name, lastMessage, fromMe = false) {
    const idx = sessionData.conversations.findIndex(c => c.phone === phone);
    const conv = {
      phone,
      name: name || (idx >= 0 ? sessionData.conversations[idx].name : phone),
      lastMessage: lastMessage || '',
      lastMessageAt: new Date().toISOString(),
      unreadCount: fromMe ? 0 : (idx >= 0 ? (sessionData.conversations[idx].unreadCount || 0) + 1 : 1),
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

  formatJid(phone) {
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 10) clean = `52${clean}`;
    if (!clean.includes('@')) clean = `${clean}@s.whatsapp.net`;
    return clean;
  }
}

module.exports = { SessionManager };
