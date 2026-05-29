import { type CCChannel, type CCStatus, CHANNEL_LABELS, CHANNEL_COLORS, formatTime } from './contactCenterTypes';

export type { CCChannel, CCStatus };

// ── Unified conversation shape ────────────────────────────────────────────────

export interface UnifiedConversation {
  id: string;             // "{channel}:{sourceId}"
  channel: CCChannel;
  sourceId: string;       // original ID in source table

  contactName: string | null;
  contactPhone: string | null;
  avatarUrl: string | null;

  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;

  status: CCStatus;
  isGroup: boolean;
  groupName: string | null;

  // chat-only
  participantIds?: string[];
  // wa_movi: agent user id
  agentUserId?: string | null;
}

// ── Unified message shape ────────────────────────────────────────────────────

export interface UnifiedMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  messageType: string;
  body: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaFilename: string | null;
  mediaThumbnail: string | null;
  locationLat: number | null;
  locationLng: number | null;
  locationLabel: string | null;
  senderName: string | null;
  sentAt: string;
  status: string;
  linkedTaskId?: string | null;
  // original raw record (for actions)
  raw?: Record<string, unknown>;
}

// ── Merge helper ─────────────────────────────────────────────────────────────

interface MergeInput {
  moviMsgs: any[];
  waConvs: any[];
  myChats: any[];
  chatLastMsgs: Record<string, { mensaje: string; created_at: string; remitente_id: string }>;
  chatUnread: Record<string, number>;
  userId: string;
  moviContactNames?: Record<string, string>;
}

export function mergeConversations({
  moviMsgs,
  waConvs,
  myChats,
  chatLastMsgs,
  chatUnread,
  userId,
  moviContactNames = {},
}: MergeInput): UnifiedConversation[] {
  const result: UnifiedConversation[] = [];

  // ── WA MOVI: group by contact_phone (or agent_user_id if no phone) ────────
  const moviGroups: Record<string, any[]> = {};
  for (const msg of moviMsgs) {
    // If contact_phone is missing but contact_name looks like a phone number, use it as phone
    const effectivePhone = msg.contact_phone || (msg.contact_name && /^\d{10,15}$/.test(msg.contact_name.replace(/\D/g, '')) ? msg.contact_name.replace(/\D/g, '') : null);
    const key = effectivePhone || `agent:${msg.agent_user_id}`;
    if (!moviGroups[key]) moviGroups[key] = [];
    moviGroups[key].push(msg);
  }

  for (const [key, msgs] of Object.entries(moviGroups)) {
    msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = msgs[0];
    const unread = msgs.filter(m => m.direction === 'inbound' && !m.read_at).length;

    const phone = latest.contact_phone || (latest.contact_name && /^\d{10,15}$/.test(latest.contact_name.replace(/\D/g, '')) ? latest.contact_name.replace(/\D/g, '') : null);
    // Resolve name: normalized map lookup (CRM > pushName) > exact match > message fields
    const normalizedKey = phone ? normalizeMexicanPhone(phone) : '';
    const resolvedName =
      (phone && moviContactNames[phone]) ||
      (normalizedKey && moviContactNames[normalizedKey]) ||
      latest.contact_name ||
      (latest.metadata as any)?.contact_name ||
      (latest.metadata as any)?.pushName ||
      null;

    result.push({
      id: `wa_movi:${key}`,
      channel: 'wa_movi',
      sourceId: key,
      contactName: resolvedName,
      contactPhone: phone,
      avatarUrl: null,
      lastMessage: latest.body || null,
      lastMessageAt: latest.created_at || null,
      unreadCount: unread,
      status: 'open',
      isGroup: false,
      groupName: null,
      agentUserId: latest.agent_user_id || null,
    });
  }

  // ── WA Personal ─────────────────────────────────────────────────────────
  for (const conv of waConvs) {
    result.push({
      id: `wa_personal:${conv.id}`,
      channel: 'wa_personal',
      sourceId: conv.id,
      contactName: conv.remote_name || null,
      contactPhone: conv.remote_phone || null,
      avatarUrl: conv.remote_avatar_url || null,
      lastMessage: conv.last_message_text || null,
      lastMessageAt: conv.last_message_at || null,
      unreadCount: conv.unread_count || 0,
      status: conv.is_archived ? 'archived' : 'open',
      isGroup: conv.is_group || false,
      groupName: conv.group_name || null,
    });
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  for (const member of myChats) {
    const chat = (member as any).chats;
    if (!chat) continue;

    const lastMsg = chatLastMsgs[member.chat_id];
    const isGroup = chat.tipo === 'group';
    const participantIds: string[] = isGroup
      ? []
      : (chat.participantes_directos || []).filter((id: string) => id !== userId);

    result.push({
      id: `chat:${chat.id}`,
      channel: 'chat',
      sourceId: chat.id,
      contactName: isGroup ? chat.nombre : null,
      contactPhone: null,
      avatarUrl: null,
      lastMessage: lastMsg?.mensaje || null,
      lastMessageAt: lastMsg?.created_at || chat.ultimo_mensaje_at || null,
      unreadCount: chatUnread[chat.id] || 0,
      status: 'open',
      isGroup,
      groupName: isGroup ? chat.nombre : null,
      participantIds,
    });
  }

  result.sort((a, b) => {
    if (!a.lastMessageAt && !b.lastMessageAt) return 0;
    if (!a.lastMessageAt) return 1;
    if (!b.lastMessageAt) return -1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  return result;
}

// ── Display helpers ──────────────────────────────────────────────────────────

export function getConversationDisplayName(
  conv: UnifiedConversation,
  participantNames: Record<string, string>
): string {
  if (conv.isGroup && conv.groupName) return conv.groupName;
  if (conv.channel === 'chat' && conv.participantIds?.length) {
    const name = participantNames[conv.participantIds[0]];
    if (name) return name;
  }
  if (conv.contactName) return conv.contactName;
  if (conv.contactPhone) return formatMoviPhone(conv.contactPhone);
  return 'Sin nombre';
}

export function formatMoviPhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 12 && clean.startsWith('52')) {
    return `+52 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  if (clean.length === 10) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
  }
  return phone;
}

/**
 * Extracts the last 10 digits from a Mexican phone number regardless of format.
 * Handles: "5512345678", "+52 55 1234 5678", "521XXXXXXXXXX", "52XXXXXXXXXX", etc.
 */
export function normalizeMexicanPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('52')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('521')) return digits.slice(3);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/**
 * Builds a name lookup map from CRM contacts and message metadata using normalized phones.
 */
export function buildContactNameMap(
  crmContacts: { telefono?: string | null; nombre?: string | null; apellido?: string | null }[],
  messages: { contact_phone?: string | null; contact_name?: string | null; metadata?: any }[],
): Record<string, string> {
  const nameMap: Record<string, string> = {};

  // CRM contacts take highest priority
  for (const c of crmContacts) {
    if (!c.telefono) continue;
    const norm = normalizeMexicanPhone(c.telefono);
    if (norm.length >= 10) {
      const fullName = [c.nombre, c.apellido].filter(Boolean).join(' ').trim();
      if (fullName) nameMap[norm] = fullName;
    }
  }

  // Then message-level contact_name (from Wazzup webhook pushName)
  for (const m of messages) {
    if (!m.contact_phone) continue;
    const norm = normalizeMexicanPhone(m.contact_phone);
    if (norm.length >= 10 && !nameMap[norm]) {
      const name = m.contact_name || (m.metadata as any)?.contact_name || (m.metadata as any)?.pushName;
      if (name) nameMap[norm] = name;
    }
  }

  return nameMap;
}

/**
 * Resolves the original phone -> name using a normalized map.
 */
export function resolveNameByPhone(
  originalPhone: string,
  normalizedNameMap: Record<string, string>,
): string | null {
  if (!originalPhone) return null;
  const norm = normalizeMexicanPhone(originalPhone);
  return normalizedNameMap[norm] || null;
}

export { CHANNEL_LABELS, CHANNEL_COLORS, formatTime };
