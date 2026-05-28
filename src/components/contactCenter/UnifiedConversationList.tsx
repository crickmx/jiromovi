import { useMemo } from 'react';
import { Search, MessageSquare, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type CCChannel, type CCStatus } from '@/lib/contactCenterTypes';
import {
  type UnifiedConversation,
  getConversationDisplayName,
  CHANNEL_LABELS, CHANNEL_COLORS, formatTime, formatMoviPhone,
} from '@/lib/unifiedContactCenter';
import { ChannelBadge } from './ChannelBadge';

interface Props {
  conversations: UnifiedConversation[];
  selectedId: string | null;
  onSelect: (conv: UnifiedConversation) => void;
  search: string;
  onSearchChange: (v: string) => void;
  filterChannel: CCChannel | 'all';
  onFilterChange: (v: CCChannel | 'all') => void;
  filterStatus: CCStatus | 'all';
  onStatusChange: (v: CCStatus | 'all') => void;
  loading: boolean;
  participantNames: Record<string, string>;
}

const CHANNELS: (CCChannel | 'all')[] = ['all', 'wa_movi', 'wa_personal'];
const STATUS_OPTIONS: { value: CCStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Abiertas' },
  { value: 'archived', label: 'Archivadas' },
];

function ConvAvatar({
  name, avatarUrl, channel, unread,
}: {
  name: string;
  avatarUrl?: string | null;
  channel: CCChannel;
  unread: number;
}) {
  const colors = CHANNEL_COLORS[channel];
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w.charAt(0))
    .join('')
    .toUpperCase() || '?';

  return (
    <div className="relative flex-shrink-0">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-neutral-800" />
      ) : (
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ring-2 ring-white dark:ring-neutral-800',
          colors.bg, colors.text
        )}>
          {initials}
        </div>
      )}
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-sm">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </div>
  );
}

function LastMessagePreview({ conv }: { conv: UnifiedConversation }) {
  const text = conv.lastMessage;
  if (!text) return <span className="italic text-neutral-300 dark:text-neutral-600">Sin mensajes</span>;

  // Detect media-type messages
  if (text.startsWith('[image]') || text.includes('imagen')) return <span className="flex items-center gap-1"><span>📷</span> Imagen</span>;
  if (text.startsWith('[audio]')) return <span className="flex items-center gap-1"><span>🎤</span> Audio</span>;
  if (text.startsWith('[video]')) return <span className="flex items-center gap-1"><span>🎬</span> Video</span>;
  if (text.startsWith('[document]') || text.startsWith('[file]')) return <span className="flex items-center gap-1"><span>📄</span> Documento</span>;
  if (text.startsWith('[location]')) return <span className="flex items-center gap-1"><span>📍</span> Ubicacion</span>;
  if (text.startsWith('[sticker]')) return <span className="flex items-center gap-1"><span>😄</span> Sticker</span>;

  return <span className="truncate">{text}</span>;
}

export function UnifiedConversationList({
  conversations, selectedId, onSelect,
  search, onSearchChange,
  filterChannel, onFilterChange,
  filterStatus, onStatusChange,
  loading, participantNames,
}: Props) {
  const filtered = useMemo(() => {
    let list = conversations;
    if (filterChannel !== 'all') list = list.filter(c => c.channel === filterChannel);
    if (filterStatus !== 'all') list = list.filter(c => c.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        const name = getConversationDisplayName(c, participantNames).toLowerCase();
        return (
          name.includes(q) ||
          c.contactPhone?.toLowerCase().includes(q) ||
          c.lastMessage?.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [conversations, filterChannel, filterStatus, search, participantNames]);

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  // Channel counts
  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = { all: conversations.length };
    for (const c of conversations) {
      counts[c.channel] = (counts[c.channel] || 0) + 1;
    }
    return counts;
  }, [conversations]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-neutral-800 dark:text-white text-sm">
              Conversaciones
            </h2>
            {totalUnread > 0 && (
              <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[20px] text-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 tabular-nums">
            {filtered.length}{filtered.length !== conversations.length ? `/${conversations.length}` : ''}
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Nombre, telefono, mensaje..."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/60 transition"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <span className="text-sm leading-none">×</span>
            </button>
          )}
        </div>

        {/* Channel tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {CHANNELS.map(ch => {
            const count = channelCounts[ch] || 0;
            return (
              <button
                key={ch}
                onClick={() => onFilterChange(ch)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-lg whitespace-nowrap transition-all flex-shrink-0',
                  filterChannel === ch
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200'
                )}
              >
                {ch === 'all' ? 'Todos' : CHANNEL_LABELS[ch]}
                {count > 0 && (
                  <span className={cn(
                    'text-[9px] font-bold px-1 rounded-full',
                    filterChannel === ch ? 'bg-white/25 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={cn(
              'px-2.5 py-1 text-[10px] font-medium rounded-md transition-all',
              filterStatus === opt.value
                ? 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-sm border border-neutral-200 dark:border-neutral-700'
                : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col p-3 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-2/3" />
                  <div className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full w-1/2" />
                </div>
                <div className="h-2 w-8 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-neutral-300 dark:text-neutral-600" />
            </div>
            <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
              {search || filterChannel !== 'all' ? 'Sin resultados' : 'Sin conversaciones'}
            </p>
            {!search && filterChannel === 'all' && (
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-relaxed">
                Las conversaciones de WA MOVI y WA Personal apareceran aqui
              </p>
            )}
          </div>
        ) : (
          <div className="py-1">
            {filtered.map(conv => {
              const name = getConversationDisplayName(conv, participantNames);
              const isSelected = conv.id === selectedId;
              const hasUnread = conv.unreadCount > 0;

              // Subtitle: prefer phone number for WA channels, use secondary info
              const subtitle = conv.contactPhone
                ? formatMoviPhone(conv.contactPhone)
                : conv.channel === 'chat' && conv.participantIds?.length
                ? null
                : null;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl text-left transition-all group',
                    'w-[calc(100%-8px)]',
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                  )}
                >
                  <ConvAvatar
                    name={name}
                    avatarUrl={conv.avatarUrl}
                    channel={conv.channel}
                    unread={conv.unreadCount}
                  />

                  <div className="flex-1 min-w-0">
                    {/* Row 1: Name + time */}
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={cn(
                        'text-xs font-semibold truncate leading-tight',
                        hasUnread
                          ? 'text-neutral-900 dark:text-white'
                          : isSelected
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-neutral-700 dark:text-neutral-200'
                      )}>
                        {name}
                      </span>
                      <span className={cn(
                        'text-[10px] flex-shrink-0 tabular-nums',
                        hasUnread ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-neutral-400 dark:text-neutral-500'
                      )}>
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>

                    {/* Row 2: Phone subtitle (if different from name) */}
                    {subtitle && name !== subtitle && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <Phone className="w-2.5 h-2.5 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate font-mono tracking-tight">
                          {subtitle}
                        </span>
                      </div>
                    )}

                    {/* Row 3: Channel badge + last message */}
                    <div className="flex items-center gap-1.5">
                      <ChannelBadge channel={conv.channel} size="sm" showLabel={false} />
                      <span className={cn(
                        'text-[11px] truncate leading-tight',
                        hasUnread
                          ? 'text-neutral-700 dark:text-neutral-200 font-medium'
                          : 'text-neutral-400 dark:text-neutral-500'
                      )}>
                        <LastMessagePreview conv={conv} />
                      </span>
                    </div>
                  </div>

                  {/* Unread dot (alternative indicator) */}
                  {hasUnread && (
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
