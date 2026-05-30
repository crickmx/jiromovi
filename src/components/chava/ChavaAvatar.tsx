import { cn } from '@/lib/utils';

interface ChavaAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
}

const sizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

export function ChavaAvatar({ size = 'md', animate = false, className }: ChavaAvatarProps) {
  return (
    <div className={cn("relative flex-shrink-0", className)}>
      {animate && (
        <div className="absolute inset-0 rounded-2xl bg-cyan-400/20 animate-ping" style={{ animationDuration: '2s' }} />
      )}
      <div className={cn(
        "relative rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg",
        sizes[size],
        animate && "shadow-cyan-500/25"
      )}>
        <svg viewBox="0 0 40 40" fill="none" className={cn(
          size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-6 h-6' : size === 'lg' ? 'w-8 h-8' : 'w-12 h-12'
        )}>
          {/* Elephant face - stylized tech elephant */}
          <circle cx="20" cy="18" r="12" fill="white" opacity="0.95" />
          {/* Ears */}
          <ellipse cx="10" cy="15" rx="5" ry="7" fill="white" opacity="0.85" />
          <ellipse cx="30" cy="15" rx="5" ry="7" fill="white" opacity="0.85" />
          {/* Inner ears */}
          <ellipse cx="10" cy="15" rx="3" ry="4.5" fill="#06b6d4" opacity="0.3" />
          <ellipse cx="30" cy="15" rx="3" ry="4.5" fill="#06b6d4" opacity="0.3" />
          {/* Eyes */}
          <circle cx="16" cy="16" r="2.5" fill="#1e293b" />
          <circle cx="24" cy="16" r="2.5" fill="#1e293b" />
          {/* Eye sparkles */}
          <circle cx="17" cy="15" r="0.8" fill="white" />
          <circle cx="25" cy="15" r="0.8" fill="white" />
          {/* Trunk */}
          <path d="M18 21 Q20 24 22 21 Q21 26 20 28 Q19 26 18 21Z" fill="#94a3b8" opacity="0.6" />
          {/* Tech circuit accent */}
          <circle cx="20" cy="32" r="2" fill="#06b6d4" opacity="0.8" />
          <line x1="20" y1="30" x2="20" y2="28" stroke="#06b6d4" strokeWidth="0.5" opacity="0.5" />
          <line x1="18" y1="32" x2="15" y2="32" stroke="#06b6d4" strokeWidth="0.5" opacity="0.4" />
          <line x1="22" y1="32" x2="25" y2="32" stroke="#06b6d4" strokeWidth="0.5" opacity="0.4" />
        </svg>
      </div>
    </div>
  );
}
