import { type CCChannel, CHANNEL_LABELS, CHANNEL_COLORS } from '@/lib/contactCenterTypes';
import { MessageCircle, Smartphone, MessageSquare, CreditCard, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const CHANNEL_ICONS: Record<CCChannel, React.FC<{ className?: string }>> = {
  wa_movi:    Smartphone,
  wa_personal:Smartphone,
  chat:       MessageSquare,
  seguwallet: CreditCard,
  web_form:   Globe,
};

interface ChannelBadgeProps {
  channel: CCChannel;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function ChannelBadge({ channel, size = 'sm', showLabel = true, className }: ChannelBadgeProps) {
  const colors = CHANNEL_COLORS[channel];
  const Icon = CHANNEL_ICONS[channel] || MessageCircle;
  const label = CHANNEL_LABELS[channel] || channel;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-medium',
      size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
      colors.bg, colors.text,
      className
    )}>
      <Icon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}
