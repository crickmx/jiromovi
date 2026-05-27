import { Download, MapPin, FileText, Play, Volume2, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type CCMessage } from '@/lib/contactCenterTypes';

interface MessageBubbleProps {
  message: CCMessage;
  senderName?: string;
  showSender?: boolean;
}

function MediaContent({ message }: { message: CCMessage }) {
  const { message_type, media_url, media_filename, media_mime_type, body, location_lat, location_lng, location_label } = message;

  if (message_type === 'image') {
    return (
      <div className="space-y-1">
        {media_url ? (
          <a href={media_url} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={message.media_thumbnail_url || media_url}
              alt={media_filename || 'Imagen'}
              className="max-w-[240px] rounded-lg object-cover border border-black/10"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </a>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-lg">
            <ImageIcon className="w-4 h-4 opacity-60" />
            <span className="text-xs opacity-70">[Imagen no disponible]</span>
          </div>
        )}
        {body && <p className="text-sm leading-relaxed mt-1">{body}</p>}
      </div>
    );
  }

  if (message_type === 'sticker') {
    return media_url ? (
      <img src={media_url} alt="Sticker" className="w-20 h-20 object-contain" />
    ) : (
      <span className="text-xs opacity-60">[Sticker]</span>
    );
  }

  if (message_type === 'audio') {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Volume2 className="w-4 h-4 opacity-70 flex-shrink-0" />
        {media_url ? (
          <audio controls className="max-w-[200px] h-8">
            <source src={media_url} type={media_mime_type || 'audio/ogg'} />
          </audio>
        ) : (
          <span className="text-xs opacity-60">Audio no disponible</span>
        )}
      </div>
    );
  }

  if (message_type === 'video') {
    return (
      <div className="space-y-1">
        {media_url ? (
          <video controls className="max-w-[240px] rounded-lg" poster={message.media_thumbnail_url || undefined}>
            <source src={media_url} type={media_mime_type || 'video/mp4'} />
          </video>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-lg">
            <Play className="w-4 h-4 opacity-60" />
            <span className="text-xs opacity-70">[Video no disponible]</span>
          </div>
        )}
        {body && <p className="text-sm leading-relaxed">{body}</p>}
      </div>
    );
  }

  if (message_type === 'document') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-lg max-w-[240px]">
        <FileText className="w-5 h-5 opacity-70 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{media_filename || 'Documento'}</p>
          {media_mime_type && <p className="text-[10px] opacity-60">{media_mime_type}</p>}
        </div>
        {media_url && (
          <a href={media_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <Download className="w-4 h-4 opacity-70 hover:opacity-100" />
          </a>
        )}
      </div>
    );
  }

  if (message_type === 'location') {
    const lat = location_lat;
    const lng = location_lng;
    const mapsUrl = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null;
    return (
      <a
        href={mapsUrl || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-lg hover:bg-black/15 transition-colors"
      >
        <MapPin className="w-4 h-4 opacity-70 flex-shrink-0" />
        <span className="text-xs">{location_label || (lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Ver ubicacion')}</span>
      </a>
    );
  }

  if (message_type === 'system') {
    return <p className="text-xs opacity-70 italic">{body || '[Mensaje del sistema]'}</p>;
  }

  // text / unknown
  return body ? <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{body}</p> : null;
}

export function MessageBubble({ message, senderName, showSender = false }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const isSystem = message.message_type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[11px] rounded-full">
          {message.body}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex mb-1.5 group', isOutbound ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[75%] space-y-0.5', isOutbound ? 'items-end' : 'items-start')}>
        {showSender && senderName && !isOutbound && (
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-1 mb-0.5">{senderName}</p>
        )}
        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm shadow-sm',
            isOutbound
              ? 'bg-accent text-white rounded-tr-sm'
              : 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-100 dark:border-neutral-700 rounded-tl-sm'
          )}
        >
          <MediaContent message={message} />
        </div>
        <p className={cn('text-[10px] text-neutral-400 dark:text-neutral-500 px-1', isOutbound ? 'text-right' : 'text-left')}>
          {new Date(message.sent_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
          {isOutbound && message.status === 'read' && ' ✓✓'}
          {isOutbound && message.status === 'delivered' && ' ✓✓'}
          {isOutbound && message.status === 'sent' && ' ✓'}
        </p>
      </div>
    </div>
  );
}
