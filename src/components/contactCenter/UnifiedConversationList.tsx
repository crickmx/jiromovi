import { useMemo } from 'react';
import { Search, MessageSquare, X, Archive, Inbox, MailWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type CCChannel } from '@/lib/contactCenterTypes';
import {
  type UnifiedConversation,
  getConversationDisplayName,
  CHANNEL_COLORS, formatTime,
} from '@/lib/unifiedContactCenter';
import {
  type Buzon, type EstadoLista, BUZONES,
  filtrarConversaciones, contadores, noLeidosPorBuzon,
} from '@/lib/buzonWhatsApp';
import { ChannelBadge } from './ChannelBadge';

interface Props {
  conversations: UnifiedConversation[];
  selectedId: string | null;
  onSelect: (conv: UnifiedConversation) => void;
  search: string;
  onSearchChange: (v: string) => void;
  buzon: Buzon;
  onBuzonChange: (v: Buzon) => void;
  estado: EstadoLista;
  onEstadoChange: (v: EstadoLista) => void;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  participantNames: Record<string, string>;
}

function ConvAvatar({ name, avatarUrl, channel }: { name: string; avatarUrl?: string | null; channel: CCChannel }) {
  const colors = CHANNEL_COLORS[channel];
  const initials = name.split(' ').slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase() || '?';
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div aria-hidden className={cn('w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', colors.bg, colors.text)}>
      {initials}
    </div>
  );
}

function LastMessagePreview({ conv }: { conv: UnifiedConversation }) {
  const text = conv.lastMessage;
  if (!text) return <span className="italic text-neutral-400 dark:text-neutral-500">Sin mensajes</span>;
  if (text.startsWith('[image]')) return <span>Imagen</span>;
  if (text.startsWith('[audio]')) return <span>Audio</span>;
  if (text.startsWith('[video]')) return <span>Video</span>;
  if (text.startsWith('[document]') || text.startsWith('[file]')) return <span>Documento</span>;
  if (text.startsWith('[location]')) return <span>Ubicación</span>;
  if (text.startsWith('[sticker]')) return <span>Sticker</span>;
  return <span className="truncate">{text}</span>;
}

const ESTADOS: { value: EstadoLista; label: string }[] = [
  { value: 'open', label: 'Todas' },
  { value: 'unread', label: 'No leídas' },
  { value: 'archived', label: 'Archivo' },
];

export function UnifiedConversationList({
  conversations, selectedId, onSelect,
  search, onSearchChange,
  buzon, onBuzonChange,
  estado, onEstadoChange,
  loading, error, onRetry, participantNames,
}: Props) {
  const nombre = (c: UnifiedConversation) => getConversationDisplayName(c, participantNames);

  const filtered = useMemo(
    () => filtrarConversaciones(conversations, { buzon, estado, busqueda: search, nombre }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations, buzon, estado, search, participantNames],
  );
  const cuenta = useMemo(() => contadores(conversations, buzon), [conversations, buzon]);
  const porBuzon = useMemo(() => noLeidosPorBuzon(conversations), [conversations]);

  const cuentaEstado: Record<EstadoLista, number> = {
    open: cuenta.abiertas,
    unread: cuenta.conNoLeidos,
    archived: cuenta.archivadas,
  };

  const vacio = (() => {
    if (search.trim()) return { titulo: 'Sin resultados', texto: `No hay conversaciones que coincidan con “${search.trim()}”.` };
    if (estado === 'archived' && buzon === 'wa_movi') return { titulo: 'Sin archivo', texto: 'Las conversaciones de WA MOVI no se archivan.' };
    if (estado === 'archived') return { titulo: 'Archivo vacío', texto: 'Aquí verás las conversaciones archivadas de tu WA personal.' };
    if (estado === 'unread') return { titulo: 'Todo al día', texto: 'No tienes mensajes sin leer en este buzón.' };
    if (buzon === 'wa_personal') return { titulo: 'Sin conversaciones', texto: 'Conecta tu WA personal en la pestaña “Conexión” para verlas aquí.' };
    if (buzon === 'wa_movi') return { titulo: 'Sin conversaciones', texto: 'Los mensajes de la línea WA MOVI aparecerán aquí.' };
    return { titulo: 'Sin conversaciones', texto: 'Los mensajes de WA MOVI y de tu WA personal aparecerán aquí.' };
  })();

  return (
    <div className="flex flex-col h-full bg-surface-card">
      {/* Encabezado + búsqueda */}
      <div className="px-3 pt-3 pb-2.5 space-y-2.5 border-b border-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-neutral-900 dark:text-white text-body">Conversaciones</h2>
          {cuenta.mensajesNoLeidos > 0 && (
            <span
              className="px-2 py-0.5 bg-accent text-accent-foreground text-micro font-bold rounded-full min-w-[22px] text-center"
              aria-label={`${cuenta.mensajesNoLeidos} mensajes sin leer`}
            >
              {cuenta.mensajesNoLeidos > 99 ? '99+' : cuenta.mensajesNoLeidos}
            </span>
          )}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar nombre, teléfono o mensaje"
            aria-label="Buscar conversaciones"
            className="w-full h-10 pl-9 pr-9 text-body-sm rounded-[var(--radius-sm)] bg-surface-muted text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-transparent focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Buzón: Todos / WA MOVI / WA personal */}
        <div role="radiogroup" aria-label="Filtrar por buzón" className="grid grid-cols-3 gap-1 p-1 rounded-[var(--radius-sm)] bg-surface-muted">
          {BUZONES.map(b => {
            const activo = buzon === b.value;
            const pendientes = porBuzon[b.value];
            return (
              <button
                key={b.value}
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={b.label}
                title={b.label}
                onClick={() => onBuzonChange(b.value)}
                className={cn(
                  'relative min-h-[36px] px-1.5 flex items-center justify-center gap-1.5 rounded-[var(--radius-xs)] text-caption font-semibold transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  activo
                    ? 'bg-surface-card text-accent-ink shadow-e1'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100',
                )}
              >
                {b.value !== 'all' && (
                  <span aria-hidden className={cn('w-2 h-2 rounded-full flex-shrink-0', CHANNEL_COLORS[b.value].dot)} />
                )}
                <span className="truncate">{b.corto}</span>
                {pendientes > 0 && !activo && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0">
                    <span className="sr-only">, {pendientes} con mensajes sin leer</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Estado: Todas / No leídas / Archivo */}
      <div role="tablist" aria-label="Estado de la conversación" className="flex border-b border-soft px-1">
        {ESTADOS.map(e => {
          const activo = estado === e.value;
          const n = cuentaEstado[e.value];
          return (
            <button
              key={e.value}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => onEstadoChange(e.value)}
              className={cn(
                'flex-1 min-h-[44px] flex items-center justify-center gap-1.5 text-caption font-semibold transition-colors border-b-2 -mb-px',
                'focus-visible:outline-none focus-visible:bg-accent-softer',
                activo
                  ? 'border-accent text-accent-ink'
                  : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200',
              )}
            >
              {e.label}
              {n > 0 && (
                <span className={cn(
                  'text-micro font-bold px-1.5 rounded-full tabular-nums',
                  activo ? 'bg-accent-soft text-accent-ink' : 'bg-surface-muted text-neutral-500 dark:text-neutral-400',
                )}>
                  {n > 999 ? '999+' : n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {error ? (
          <div role="alert" className="flex flex-col items-center justify-center text-center px-6 py-10">
            <div className="w-11 h-11 rounded-[var(--radius-md)] bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-3">
              <MailWarning className="w-5 h-5 text-red-600 dark:text-red-400" aria-hidden />
            </div>
            <p className="text-body-sm font-semibold text-neutral-800 dark:text-neutral-100 mb-1">No se pudieron cargar las conversaciones</p>
            <p className="text-caption text-neutral-500 dark:text-neutral-400 mb-4 break-words max-w-full">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="min-h-[40px] px-4 rounded-[var(--radius-sm)] bg-accent text-accent-foreground text-caption font-semibold hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Reintentar
              </button>
            )}
          </div>
        ) : loading ? (
          <div aria-busy="true" aria-label="Cargando conversaciones">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-surface-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 bg-surface-muted rounded-full w-2/3" />
                  <div className="h-2 bg-surface-muted rounded-full w-1/2" />
                </div>
                <div className="h-2 w-8 bg-surface-muted rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-6 py-12">
            <div className="w-12 h-12 rounded-[var(--radius-md)] bg-surface-muted flex items-center justify-center mb-3">
              {estado === 'archived'
                ? <Archive className="w-5 h-5 text-neutral-400" aria-hidden />
                : estado === 'unread'
                  ? <Inbox className="w-5 h-5 text-neutral-400" aria-hidden />
                  : <MessageSquare className="w-5 h-5 text-neutral-400" aria-hidden />}
            </div>
            <p className="text-body-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-1">{vacio.titulo}</p>
            <p className="text-caption text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-[240px]">{vacio.texto}</p>
          </div>
        ) : (
          <ul aria-label="Conversaciones">
            {filtered.map(conv => {
              const name = nombre(conv);
              const isSelected = conv.id === selectedId;
              const hasUnread = conv.unreadCount > 0;

              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conv)}
                    aria-current={isSelected ? 'true' : undefined}
                    aria-label={`${name}${hasUnread ? `, ${conv.unreadCount} sin leer` : ''}`}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors duration-fast border-l-[3px]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                      CHANNEL_COLORS[conv.channel].border,
                      isSelected
                        ? 'bg-accent-soft dark:bg-accent/15'
                        : 'hover:bg-surface-muted',
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <ConvAvatar name={name} avatarUrl={conv.avatarUrl} channel={conv.channel} />
                      {hasUnread && (
                        <span aria-hidden className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-accent text-accent-foreground text-[10.5px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-surface-card">
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <span className={cn(
                          'text-body-sm truncate',
                          hasUnread ? 'font-bold text-neutral-900 dark:text-white' : 'font-medium text-neutral-700 dark:text-neutral-200',
                        )}>
                          {name}
                        </span>
                        <span className={cn(
                          'text-micro flex-shrink-0 tabular-nums',
                          hasUnread ? 'text-accent-ink font-semibold' : 'text-neutral-500 dark:text-neutral-400',
                        )}>
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {buzon === 'all' && <ChannelBadge channel={conv.channel} size="sm" showLabel={false} className="flex-shrink-0" />}
                        <span className={cn(
                          'text-caption truncate min-w-0',
                          hasUnread ? 'text-neutral-700 dark:text-neutral-200 font-medium' : 'text-neutral-500 dark:text-neutral-400',
                        )}>
                          <LastMessagePreview conv={conv} />
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
