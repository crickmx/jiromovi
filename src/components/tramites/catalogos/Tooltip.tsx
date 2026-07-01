interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

export function Tooltip({ text, children, position = 'top' }: TooltipProps) {
  const isTop = position === 'top';
  return (
    <div className="relative group inline-flex items-center justify-center">
      {children}
      <div className={`
        absolute ${isTop ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} left-1/2 -translate-x-1/2
        px-2 py-1 bg-neutral-800 text-white text-[11px] rounded whitespace-nowrap
        opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30 shadow-lg
      `}>
        {text}
        <div className={`
          absolute ${isTop ? 'top-full border-t-neutral-800' : 'bottom-full border-b-neutral-800'}
          left-1/2 -translate-x-1/2 border-4 border-transparent
        `} />
      </div>
    </div>
  );
}
