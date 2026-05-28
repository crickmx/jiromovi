const express = require('express');
const { SessionManager } = require('./sessionManager');
const { SupabaseSync } = require('./supabaseSync');

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3100;
const API_KEY = process.env.API_KEY || 'dev-key';

const sessionManager = new SessionManager();
const supabaseSync = new SupabaseSync();

// Auth middleware
function auth(req, res, next) {
  const key = req.headers['x-api-key'] || req.headers['apikey'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sessions: sessionManager.getActiveCount(),
    uptime: process.uptime(),
  });
});

// Get session status
app.get('/session/:userId/status', auth, (req, res) => {
  const { userId } = req.params;
  const session = sessionManager.getSession(userId);
  if (!session) {
    return res.json({ status: 'no_session', connected: false });
  }
  res.json({
    status: session.status,
    connected: session.status === 'connected',
    phone: session.phone || null,
    name: session.name || null,
    connectedAt: session.connectedAt || null,
  });
});

// Connect (generate QR)
app.post('/session/:userId/connect', auth, async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await sessionManager.connect(userId, supabaseSync);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current QR code
app.get('/session/:userId/qr', auth, (req, res) => {
  const { userId } = req.params;
  const session = sessionManager.getSession(userId);
  if (!session) {
    return res.json({ qr: null, status: 'no_session' });
  }
  res.json({
    qr: session.qrCode || null,
    qrBase64: session.qrBase64 || null,
    status: session.status,
    connected: session.status === 'connected',
  });
});

// Disconnect
app.post('/session/:userId/disconnect', auth, async (req, res) => {
  const { userId } = req.params;
  try {
    await sessionManager.disconnect(userId);
    await supabaseSync.updateSessionStatus(userId, 'disconnected');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send text message
app.post('/session/:userId/send-message', auth, async (req, res) => {
  const { userId } = req.params;
  const { to, message, quotedMessageId } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing "to" or "message"' });
  }

  try {
    const result = await sessionManager.sendMessage(userId, to, message, quotedMessageId);
    await supabaseSync.saveOutboundMessage(userId, to, message, result.key?.id);
    res.json({ success: true, messageId: result.key?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send media (file/image/audio)
app.post('/session/:userId/send-media', auth, async (req, res) => {
  const { userId } = req.params;
  const { to, mediaBase64, mimeType, filename, caption } = req.body;

  if (!to || !mediaBase64 || !mimeType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await sessionManager.sendMedia(userId, to, {
      base64: mediaBase64,
      mimeType,
      filename: filename || 'file',
      caption: caption || '',
    });
    await supabaseSync.saveOutboundMessage(userId, to, caption || `[${mimeType}]`, result.key?.id, {
      mediaType: mimeType.split('/')[0],
      filename,
    });
    res.json({ success: true, messageId: result.key?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get conversations list
app.get('/session/:userId/conversations', auth, (req, res) => {
  const { userId } = req.params;
  const session = sessionManager.getSession(userId);
  if (!session || session.status !== 'connected') {
    return res.json({ conversations: [] });
  }
  res.json({ conversations: session.conversations || [] });
});

// Get messages for a conversation
// :phone can be a phone number (individual) or a group JID (e.g. "1234567890-1234567890@g.us")
app.get('/session/:userId/messages/:phone', auth, (req, res) => {
  const { userId, phone } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const session = sessionManager.getSession(userId);
  if (!session || session.status !== 'connected') {
    return res.json({ messages: [] });
  }
  const messages = sessionManager.getMessagesFromStore(session, phone, limit);
  res.json({ messages });
});

// Manual history sync — re-syncs in-memory messages to Supabase
// Useful after reconnect when messages.set / messaging-history.set already fired
app.post('/session/:userId/sync-history', auth, async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await sessionManager.triggerHistorySync(userId, supabaseSync);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get memory store stats (for diagnostics)
app.get('/session/:userId/store-stats', auth, (req, res) => {
  const { userId } = req.params;
  const session = sessionManager.getSession(userId);
  if (!session) {
    return res.json({ error: 'No session' });
  }
  const store = session.messageStore || {};
  const stats = Object.entries(store).map(([key, msgs]) => ({
    key,
    count: msgs.length,
    oldest: msgs[0]?.timestamp ? new Date(msgs[0].timestamp).toISOString() : null,
    newest: msgs[msgs.length - 1]?.timestamp ? new Date(msgs[msgs.length - 1].timestamp).toISOString() : null,
  }));
  res.json({
    conversations: stats.length,
    totalMessages: stats.reduce((sum, s) => sum + s.count, 0),
    details: stats,
  });
});

// List all active sessions (admin)
app.get('/admin/sessions', auth, (req, res) => {
  const sessions = sessionManager.getAllSessions();
  res.json({ sessions });
});

app.listen(PORT, () => {
  console.log(`MOVI WhatsApp Server running on port ${PORT}`);
  console.log(`Sessions directory: ./sessions`);
});
