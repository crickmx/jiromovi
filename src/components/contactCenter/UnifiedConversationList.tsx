import { useMemo } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type CCChannel, type CCStatus } from '@/lib/contactCenterTypes';
import {
  type UnifiedConversation,
  getConversationDisplayName,
  CHANNEL_COLORS, formatTime,
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

function ConvAvatar({ name, avatarUrl, channel }: { name: string; avatarUrl?: string | null; channel: CCChannel }) {
  const colors = CHANNEL_COLORS[channel];
  const initials = name.split(' ').slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase() || '?';
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', colors.bg, colors.text)}>
      {initials}
    </div>
  );
}

function LastMessagePreview({ conv }: { conv: UnifiedConversation }) {
  const text = conv.lastMessage;
  if (!text) return <span className="italic text-neutral-300 dark:text-neutral-600">Sin mensajes</span>;
  if (text.startsWith('[image]')) return <span>Imagen</span>;
  if (text.startsWith('[audio]')) return <span>Audio</span>;
  if (text.startsWith('[video]')) return <span>Video</span>;
  if (text.startsWith('[document]') || text.startsWith('[file]')) return <span>Documento</span>;
  if (text.startsWith('[location]')) return <span>Ubicacion</span>;
  if (text.startsWith('[sticker]')) return <span>Sticker</span>;
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
  const unreadConvCount = conversations.filter(c => c.unreadCount > 0).length;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900">
      {/* Header + search */}
      <div className="px-3 pt-3 pb-2 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-semibold text-neutral-800 dark:text-white text-[13px]">
            Conversaciones
          </h2>
          {totalUnread > 0 && (
            <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[20px] text-center">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/60 border-0 transition"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-sm leading-none"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Quick filter tabs */}
      <div className="flex border-b border-neutral-100 dark:border-neutral-800">
        <button
          onClick={() => { onFilterChange('all'); onStatusChange('open'); }}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors border-b-2',
            filterStatus === 'open' && filterChannel === 'all'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
          )}
        >
          Todos
          {conversations.length > 0 && (
            <span className="text-[9px] font-bold px-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
              {conversations.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { onFilterChange('all'); onStatusChange('all'); }}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors border-b-2',
            filterStatus === 'all' && filterChannel === 'all'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
          )}
        >
          No leidos
          {unreadConvCount > 0 && (
            <span className="text-[9px] font-bold px-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              {unreadConvCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { onFilterChange('all'); onStatusChange('archived'); }}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors border-b-2',
            filterStatus === 'archived'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
          )}
        >
          Archivo
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-0">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full w-2/3" />
                  <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full w-1/2" />
                </div>
                <div className="h-2 w-7 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-6">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
            </div>
            <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
              {search || filterChannel !== 'all' ? 'Sin resultados' : 'Sin conversaciones'}
            </p>
            {!search && filterChannel === 'all' && filterStatus === 'open' && (
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-relaxed">
                Los mensajes de WA MOVI y WA Personal apareceran aqui
              </p>
            )}
          </div>
        ) : (
          <div>
            {filtered.map(conv => {
              const name = getConversationDisplayName(conv, participantNames);
              const isSelected = conv.id === selectedId;
              const hasUnread = conv.unreadCount > 0;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all border-b border-neutral-50 dark:border-neutral-800/50',
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                  )}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <ConvAvatar name={name} avatarUrl={conv.avatarUrl} channel={conv.channel} />
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-sm">
                        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={cn(
                        'text-[13px] truncate leading-tight',
                        hasUnread
                          ? 'font-semibold text-neutral-900 dark:text-white'
                          : 'font-medium text-neutral-700 dark:text-neutral-200'
                      )}>
                        {name}
                      </span>
                      <span className={cn(
                        'text-[10px] flex-shrink-0 tabular-nums',
                        hasUnread
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'text-neutral-400 dark:text-neutral-500'
                      )}>
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <ChannelBadge channel={conv.channel} size="sm" showLabel={false} />
                      <span className={cn(
                        'text-[11px] truncate',
                        hasUnread
                          ? 'text-neutral-600 dark:text-neutral-300 font-medium'
                          : 'text-neutral-400 dark:text-neutral-500'
                      )}>
                        <LastMessagePreview conv={conv} />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
