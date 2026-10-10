import express from 'express';
import { default as makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3200;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'sk-or-v1-hermes-core';
const PRIMARY_MODEL = process.env.HERMES_MODEL || 'google/gemini-2.5-flash';
const SESSIONS_DIR = path.join(__dirname, 'sessions');

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

const logger = pino({ level: 'warn' });
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Whitelist of authorized phone numbers for Christofer Cruz-Chousal Jiménez
const AUTHORIZED_NUMBERS = new Set([
  '5215520206922',
  '525520206922',
  '5520206922',
  '5215599909991',
  '525599909991',
  '5599909991'
]);

// Memory & Conversation state per user JID
const conversationHistory = new Map();
const botOutboundMessageIds = new Set();

let sessionStatus = 'disconnected';
let currentQr = null;
let currentQrBase64 = null;
let connectedPhone = null;
let sock = null;

const HERMES_SYSTEM_PROMPT = `Eres Hermes, el agente de inteligencia artificial de ingeniería, operaciones y dirección de Christofer Cruz-Chousal Jiménez (Director Digital de Grupo JIRO y creador de MOVI Digital / Agente Total).

Directrices de Identidad y Personalidad (Tono AURA):
- Tono: Profesional, cercano, confiable, empático y orientado a resultados de alta calidad.
- Responde en español por defecto con claridad y concisión ejecutiva.
- Tienes autonomía total sobre arquitectura de software, servidores Plesk, Supabase, bases de datos y monitoreo.
- Estás interactuando directamente a través de WhatsApp. Mantén las respuestas legibles en móvil con formato limpio (negritas con asteriscos, viñetas cortas, saltos de línea claros y emojis funcionales).`;

// ─── Baileys Connection Handler ─────────────────────────────
async function startWhatsApp() {
  try {
    sessionStatus = 'connecting';
    const sessionPath = path.join(SESSIONS_DIR, 'hermes-core');
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: true,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        sessionStatus = 'qr_pending';
        currentQr = qr;
        try {
          currentQrBase64 = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
        } catch (e) {
          console.error('[Hermes QR Error]:', e);
        }
        console.log('[Hermes WhatsApp] Nuevo código QR generado para escaneo.');
      }

      if (connection === 'open') {
        sessionStatus = 'connected';
        currentQr = null;
        currentQrBase64 = null;
        const me = sock.user;
        if (me) {
          connectedPhone = me.id.split(':')[0].split('@')[0];
        }
        console.log(`[Hermes WhatsApp] Conectado exitosamente con el número: ${connectedPhone}`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[Hermes WhatsApp] Conexión cerrada. Status: ${statusCode}, Reintentando: ${shouldReconnect}`);

        if (shouldReconnect) {
          sessionStatus = 'reconnecting';
          setTimeout(startWhatsApp, 3000);
        } else {
          sessionStatus = 'disconnected';
          currentQr = null;
          currentQrBase64 = null;
          try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
          } catch {}
          console.log('[Hermes WhatsApp] Sesión cerrada permanentemente.');
        }
      }
    });

    // ─── Message Listener ───────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      for (const msg of messages) {
        if (!msg.message || msg.messageStubType) continue;

        const msgId = msg.key.id;
        if (botOutboundMessageIds.has(msgId)) continue; // Ignore bot's own replies

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast') continue;

        const isGroup = remoteJid.includes('@g.us');
        const isFromMe = msg.key.fromMe || false;
        const cleanNumber = remoteJid.split('@')[0].replace(/\D/g, '');

        // Whitelist validation
        const isWhitelisted = AUTHORIZED_NUMBERS.has(cleanNumber) || isFromMe;
        if (!isWhitelisted && !isGroup) {
          console.log(`[Hermes WhatsApp] Mensaje ignorado de número no autorizado: ${cleanNumber}`);
          continue;
        }

        // Extract message text
        const text = msg.message?.conversation ||
                     msg.message?.extendedTextMessage?.text ||
                     msg.message?.imageMessage?.caption ||
                     '';

        if (!text || text.trim() === '') continue;

        console.log(`[Hermes WhatsApp] Mensaje recibido de ${cleanNumber} (fromMe=${isFromMe}): "${text}"`);

        // Handle with Hermes AI
        await handleHermesChat(remoteJid, text, msg);
      }
    });

  } catch (err) {
    console.error('[Hermes WhatsApp Start Error]:', err);
    sessionStatus = 'error';
    setTimeout(startWhatsApp, 5000);
  }
}

// ─── AI Response Dispatcher ─────────────────────────────────
async function handleHermesChat(remoteJid, userText, originalMsg) {
  try {
    // Send WhatsApp typing indicator
    if (sock) {
      await sock.sendPresenceUpdate('composing', remoteJid);
    }

    if (!conversationHistory.has(remoteJid)) {
      conversationHistory.set(remoteJid, []);
    }
    const history = conversationHistory.get(remoteJid);
    history.push({ role: 'user', content: userText });

    // Keep last 10 messages for context
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }

    // Call OpenRouter or fallback
    let aiReply = '';
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://hermes.mainserver.movi.digital',
          'X-Title': 'Hermes Agent Gateway'
        },
        body: JSON.stringify({
          model: PRIMARY_MODEL,
          messages: [
            { role: 'system', content: HERMES_SYSTEM_PROMPT },
            ...history
          ],
          temperature: 0.7,
          max_tokens: 1500
        })
      });

      if (response.ok) {
        const data = await response.json();
        aiReply = data.choices?.[0]?.message?.content || 'Hermes: He recibido tu mensaje pero no se pudo generar respuesta.';
      } else {
        const errBody = await response.text();
        console.error('[OpenRouter API Error]:', response.status, errBody);
        aiReply = `🤖 *Hermes:* Recibí tu mensaje: "${userText}". Estoy en línea en hermes.mainserver.movi.digital.`;
      }
    } catch (e) {
      console.error('[AI Query Error]:', e.message);
      aiReply = `🤖 *Hermes:* En línea y conectado. (Nota: ${e.message})`;
    }

    history.push({ role: 'assistant', content: aiReply });

    // Send WhatsApp Reply
    if (sock) {
      const sent = await sock.sendMessage(remoteJid, { text: aiReply }, {
        quoted: originalMsg
      });

      if (sent?.key?.id) {
        botOutboundMessageIds.add(sent.key.id);
        // Clean cache after 10 min
        setTimeout(() => botOutboundMessageIds.delete(sent.key.id), 600000);
      }
      await sock.sendPresenceUpdate('available', remoteJid);
    }
  } catch (err) {
    console.error('[Hermes Chat Error]:', err);
  }
}

// ─── API Routes ─────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    status: sessionStatus,
    connected: sessionStatus === 'connected',
    phone: connectedPhone,
    hasQr: !!currentQrBase64,
    authorizedNumbers: Array.from(AUTHORIZED_NUMBERS),
    model: PRIMARY_MODEL,
    uptime: process.uptime()
  });
});

app.get('/api/qr', (req, res) => {
  res.json({
    status: sessionStatus,
    connected: sessionStatus === 'connected',
    qr: currentQr,
    qrBase64: currentQrBase64,
    phone: connectedPhone
  });
});

app.post('/api/restart-session', async (req, res) => {
  try {
    if (sock) {
      try { sock.end(); } catch {}
    }
    const sessionPath = path.join(SESSIONS_DIR, 'hermes-core');
    fs.rmSync(sessionPath, { recursive: true, force: true });
    sessionStatus = 'connecting';
    currentQr = null;
    currentQrBase64 = null;
    setTimeout(startWhatsApp, 1000);
    res.json({ success: true, message: 'Sesión reiniciada. Generando nuevo QR...' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// OpenAI-compatible Chat Completions API endpoint (for CLI, VS Code, Roo Code, etc.)
app.post('/v1/chat/completions', async (req, res) => {
  const { messages, model = PRIMARY_MODEL, stream = false } = req.body;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: HERMES_SYSTEM_PROMPT },
          ...(messages || [])
        ],
        stream
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🤖 Hermes Agent & WhatsApp Gateway en puerto ${PORT}`);
  console.log(`🌐 Panel Visual QR: http://localhost:${PORT}`);
  console.log(`⚡ API Programadores: http://localhost:${PORT}/v1/chat/completions`);
  console.log(`=======================================================`);
  startWhatsApp();
});
