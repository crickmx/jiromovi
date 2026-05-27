import { useMemo } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type CCChannel, type CCStatus } from '@/lib/contactCenterTypes';
import {
  type UnifiedConversation,
  getConversationDisplayName,
  CHANNEL_LABELS, CHANNEL_COLORS, formatTime,
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

const CHANNELS: (CCChannel | 'all')[] = ['all', 'wa_movi', 'wa_personal', 'chat'];
const STATUS_OPTIONS: { value: CCStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Abiertas' },
  { value: 'archived', label: 'Archivadas' },
];

function ConvAvatar({ name, avatarUrl, channel, unread }: { name: string; avatarUrl?: string | null; channel: CCChannel; unread: number }) {
  const colors = CHANNEL_COLORS[channel];
  return (
    <div className="relative flex-shrink-0">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-11 h-11 rounded-full object-cover" />
      ) : (
        <div className={cn('w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold', colors.bg, colors.text)}>
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </div>
  );
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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-neutral-800 dark:text-white text-sm">
            Conversaciones
            {totalUnread > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full">
                {totalUnread}
              </span>
            )}
          </h2>
        </div>
        {/* Search */}
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar nombre, telefono, mensaje..."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
        </div>
        {/* Channel tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {CHANNELS.map(ch => (
            <button
              key={ch}
              onClick={() => onFilterChange(ch)}
              className={cn(
                'px-2 py-1 text-[10px] font-medium rounded-md whitespace-nowrap transition-all flex-shrink-0',
                filterChannel === ch
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              {ch === 'all' ? 'Todos' : CHANNEL_LABELS[ch]}
            </button>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 px-4 py-2 border-b border-neutral-100 dark:border-neutral-800">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={cn(
              'px-2 py-0.5 text-[10px] font-medium rounded transition-all',
              filterStatus === opt.value
                ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-11 h-11 rounded-full bg-neutral-100 dark:bg-neutral-800 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-3/4" />
                  <div className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <MessageSquare className="w-10 h-10 text-neutral-200 dark:text-neutral-700 mb-2" />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              {search || filterChannel !== 'all' ? 'Sin resultados' : 'Sin conversaciones todavia'}
            </p>
            {!search && filterChannel === 'all' && (
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                Conecta WA MOVI o WA Personal para ver conversaciones
              </p>
            )}
          </div>
        ) : (
          filtered.map(conv => {
            const name = getConversationDisplayName(conv, participantNames);
            const isSelected = conv.id === selectedId;
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-neutral-50 dark:border-neutral-800/50',
                  isSelected
                    ? 'bg-accent/8 dark:bg-accent/10 border-l-2 border-l-accent'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50 border-l-2 border-l-transparent'
                )}
              >
                <ConvAvatar name={name} avatarUrl={conv.avatarUrl} channel={conv.channel} unread={conv.unreadCount} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={cn('text-xs font-medium truncate', conv.unreadCount > 0 ? 'text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-200')}>
                      {name}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 flex-shrink-0">
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ChannelBadge channel={conv.channel} size="sm" showLabel={false} />
                    <span className={cn('text-[11px] truncate leading-tight', conv.unreadCount > 0 ? 'text-neutral-700 dark:text-neutral-300 font-medium' : 'text-neutral-400 dark:text-neutral-500')}>
                      {conv.lastMessage || 'Sin mensajes'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
