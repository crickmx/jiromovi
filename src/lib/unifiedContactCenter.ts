import { type CCChannel, type CCStatus, CHANNEL_LABELS, CHANNEL_COLORS, formatTime } from './contactCenterTypes';

export type { CCChannel, CCStatus };

// ── Unified conversation shape (source-agnostic) ─────────────────────────────

export interface UnifiedConversation {
  // Composite ID: "{channel}:{sourceId}"
  id: string;
  channel: CCChannel;
  sourceId: string; // original ID in the source table

  contactName: string | null;
  contactPhone: string | null;
  avatarUrl: string | null;

  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;

  status: CCStatus;
  isGroup: boolean;
  groupName: string | null;

  // For chat: other participant user IDs
  participantIds?: string[];
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
}

// ── Merge helper ─────────────────────────────────────────────────────────────

interface MergeInput {
  moviMsgs: any[];
  waConvs: any[];
  myChats: any[];
  chatLastMsgs: Record<string, { mensaje: string; created_at: string; remitente_id: string }>;
  chatUnread: Record<string, number>;
  userId: string;
}

export function mergeConversations({
  moviMsgs,
  waConvs,
  myChats,
  chatLastMsgs,
  chatUnread,
  userId,
}: MergeInput): UnifiedConversation[] {
  const result: UnifiedConversation[] = [];

  // ── WA MOVI: group contact_center_messages by contact ────────────────────
  const moviGroups: Record<string, any[]> = {};
  for (const msg of moviMsgs) {
    const key = msg.contact_phone || msg.agent_user_id || msg.id;
    if (!moviGroups[key]) moviGroups[key] = [];
    moviGroups[key].push(msg);
  }

  for (const [key, msgs] of Object.entries(moviGroups)) {
    // Sort descending
    msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = msgs[0];
    const unread = msgs.filter(m => m.direction === 'inbound' && !m.read_at).length;

    result.push({
      id: `wa_movi:${key}`,
      channel: 'wa_movi',
      sourceId: key,
      contactName: latest.contact_name || null,
      contactPhone: latest.contact_phone || null,
      avatarUrl: null,
      lastMessage: latest.body || null,
      lastMessageAt: latest.created_at || null,
      unreadCount: unread,
      status: 'open',
      isGroup: false,
      groupName: null,
    });
  }

  // ── WA Personal: whatsapp_conversations ─────────────────────────────────
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
      contactName: isGroup ? chat.nombre : null, // resolved later with participantNames
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

  // Sort all by lastMessageAt descending
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
  if (conv.contactPhone) return conv.contactPhone;
  return 'Sin nombre';
}

export { CHANNEL_LABELS, CHANNEL_COLORS, formatTime };
