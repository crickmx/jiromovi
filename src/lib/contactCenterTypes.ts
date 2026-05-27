// Unified Contact Center types

export type CCChannel = 'wa_movi' | 'wa_personal' | 'chat' | 'seguwallet' | 'web_form';
export type CCStatus = 'open' | 'pending' | 'closed' | 'archived';
export type CCDirection = 'inbound' | 'outbound';
export type CCMessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'system' | 'unknown';

export const CHANNEL_LABELS: Record<CCChannel, string> = {
  wa_movi:    'WA MOVI',
  wa_personal:'WA Personal',
  chat:       'Chat',
  seguwallet: 'Seguwallet',
  web_form:   'Formulario Web',
};

export const CHANNEL_COLORS: Record<CCChannel, { bg: string; text: string; dot: string }> = {
  wa_movi:    { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  wa_personal:{ bg: 'bg-teal-100 dark:bg-teal-900/30',    text: 'text-teal-700 dark:text-teal-300',    dot: 'bg-teal-500' },
  chat:       { bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-300',    dot: 'bg-blue-500' },
  seguwallet: { bg: 'bg-sky-100 dark:bg-sky-900/30',      text: 'text-sky-700 dark:text-sky-300',      dot: 'bg-sky-500' },
  web_form:   { bg: 'bg-violet-100 dark:bg-violet-900/30',text: 'text-violet-700 dark:text-violet-300',dot: 'bg-violet-500' },
};

export interface CCConversation {
  id: string;
  owner_user_id: string | null;
  office_id: string | null;
  assigned_agent_id: string | null;
  channel: CCChannel;
  external_conversation_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: CCStatus;
  is_group: boolean;
  group_name: string | null;
  crm_contact_id: string | null;
  tramite_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CCMessage {
  id: string;
  conversation_id: string;
  channel: CCChannel;
  external_message_id: string | null;
  direction: CCDirection;
  message_type: CCMessageType;
  body: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_thumbnail_url: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null;
  sender_name: string | null;
  sender_user_id: string | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  status: string;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

export function formatConversationName(conv: CCConversation): string {
  if (conv.is_group && conv.group_name) return conv.group_name;
  if (conv.contact_name) return conv.contact_name;
  if (conv.contact_phone) return formatPhone(conv.contact_phone);
  return 'Sin nombre';
}

export function formatPhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 12 && clean.startsWith('52')) {
    return `+52 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  return phone;
}

export function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) {
    return d.toLocaleDateString('es-MX', { weekday: 'short' });
  }
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
}
