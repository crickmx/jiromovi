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
    // If already connected, return status
    const existing = this.sessions.get(userId);
    if (existing?.status === 'connected' && existing.sock) {
      return { status: 'already_connected', connected: true };
    }

    // Clean up old socket if exists
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

    // Handle connection updates
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

        // Extract phone number and name
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
          setTimeout(() => this.connect(userId, supabaseSync), 3000);
        } else {
          sessionData.status = 'disconnected';
          sessionData.qrCode = null;
          sessionData.qrBase64 = null;
          sessionData.sock = null;
          // Clean auth state on logout
          try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          } catch {}
          await supabaseSync.updateSessionStatus(userId, 'disconnected');
          console.log(`[${userId}] Logged out`);
        }
      }
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

    // Handle initial chat list sync from WhatsApp
    sock.ev.on('chats.set', ({ chats }) => {
      for (const chat of chats) {
        if (!chat.id || chat.id === 'status@broadcast') continue;
        if (chat.id.includes('@g.us')) continue; // Skip groups for now
        const phone = chat.id.split('@')[0];
        const name = chat.name || chat.notify || phone;
        const lastMsg = chat.conversationTimestamp
          ? new Date(chat.conversationTimestamp * 1000).toISOString()
          : new Date().toISOString();

        const idx = sessionData.conversations.findIndex(c => c.phone === phone);
        if (idx < 0) {
          sessionData.conversations.push({
            phone,
            name,
            lastMessage: '',
            lastMessageAt: lastMsg,
            unreadCount: chat.unreadCount || 0,
          });
        }
      }
      // Sort by last message
      sessionData.conversations.sort((a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
      console.log(`[${userId}] Synced ${chats.length} chats from WhatsApp`);
    });

    // Handle contacts for name resolution
    sock.ev.on('contacts.set', ({ contacts }) => {
      for (const contact of contacts) {
        if (!contact.id || contact.id === 'status@broadcast') continue;
        const phone = contact.id.split('@')[0];
        const name = contact.notify || contact.name || contact.verifiedName;
        if (!name) continue;
        const idx = sessionData.conversations.findIndex(c => c.phone === phone);
        if (idx >= 0) {
          sessionData.conversations[idx].name = name;
        }
      }
    });

    // Handle incoming messages (both new and historical)
    sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
      for (const msg of msgs) {
        if (!msg.message) continue;

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') continue;
        if (remoteJid.includes('@g.us')) continue; // Skip groups for now

        const phone = remoteJid.split('@')[0];
        const pushName = msg.pushName || phone;
        const isFromMe = msg.key.fromMe || false;

        // Extract message content
        const content = this.extractMessageContent(msg);
        if (!content) continue;

        const msgTimestamp = msg.messageTimestamp
          ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp))
          : Math.floor(Date.now() / 1000);

        // Store in memory
        if (!sessionData.messageStore[phone]) {
          sessionData.messageStore[phone] = [];
        }

        // Avoid duplicates
        const existsInStore = sessionData.messageStore[phone].some(m => m.id === msg.key.id);
        if (!existsInStore) {
          sessionData.messageStore[phone].push({
            id: msg.key.id,
            from: isFromMe ? 'me' : phone,
            fromName: isFromMe ? 'me' : pushName,
            content: content.text,
            mediaType: content.mediaType,
            mediaUrl: content.mediaUrl,
            timestamp: msgTimestamp * 1000,
            direction: isFromMe ? 'outbound' : 'inbound',
          });

          // Sort by timestamp
          sessionData.messageStore[phone].sort((a, b) => a.timestamp - b.timestamp);

          // Keep max 500 messages per conversation in memory
          if (sessionData.messageStore[phone].length > 500) {
            sessionData.messageStore[phone] = sessionData.messageStore[phone].slice(-500);
          }
        }

        // Update conversations list
        this.updateConversationList(sessionData, phone, isFromMe ? null : pushName, content.text, isFromMe);

        // Only sync NEW messages to Supabase (not historical)
        if (type === 'notify' && !isFromMe) {
          await supabaseSync.saveInboundMessage(userId, phone, pushName, content, msg.key.id);
        }
      }
    });

    // Handle historical messages batch
    sock.ev.on('messaging-history.set', ({ messages: msgs }) => {
      for (const msg of msgs) {
        if (!msg.message) continue;

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') continue;
        if (remoteJid.includes('@g.us')) continue;

        const phone = remoteJid.split('@')[0];
        const isFromMe = msg.key.fromMe || false;
        const content = this.extractMessageContent(msg);
        if (!content) continue;

        const msgTimestamp = msg.messageTimestamp
          ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp))
          : Math.floor(Date.now() / 1000);

        if (!sessionData.messageStore[phone]) {
          sessionData.messageStore[phone] = [];
        }

        const existsInStore = sessionData.messageStore[phone].some(m => m.id === msg.key.id);
        if (!existsInStore) {
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

      // Sort all conversation messages
      for (const phone of Object.keys(sessionData.messageStore)) {
        sessionData.messageStore[phone].sort((a, b) => a.timestamp - b.timestamp);
        if (sessionData.messageStore[phone].length > 500) {
          sessionData.messageStore[phone] = sessionData.messageStore[phone].slice(-500);
        }
      }
      console.log(`[${userId}] Loaded historical messages for ${Object.keys(sessionData.messageStore).length} conversations`);
    });

    // Wait for first QR or connection
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (sessionData.qrBase64 || sessionData.status === 'connected') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
      // Timeout after 15s
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

    // Clean auth files
    const sessionDir = path.join(SESSIONS_DIR, userId);
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {}
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

    // Store in memory
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

  extractMessageContent(msg) {
    const m = msg.message;
    if (!m) return null;

    if (m.conversation) return { text: m.conversation, mediaType: null };
    if (m.extendedTextMessage?.text) return { text: m.extendedTextMessage.text, mediaType: null };
    if (m.imageMessage) return { text: m.imageMessage.caption || '[Imagen]', mediaType: 'image' };
    if (m.videoMessage) return { text: m.videoMessage.caption || '[Video]', mediaType: 'video' };
    if (m.audioMessage) return { text: '[Audio]', mediaType: 'audio' };
    if (m.documentMessage) return { text: m.documentMessage.fileName || '[Documento]', mediaType: 'document' };
    if (m.stickerMessage) return { text: '[Sticker]', mediaType: 'sticker' };
    if (m.contactMessage) return { text: `[Contacto: ${m.contactMessage.displayName}]`, mediaType: 'contact' };
    if (m.locationMessage) return { text: '[Ubicacion]', mediaType: 'location' };

    return { text: '[Mensaje no soportado]', mediaType: null };
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

    // Sort by last message
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
