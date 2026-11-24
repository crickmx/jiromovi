import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

// Filtro de varias opciones a la vez, con "Sólo" para quedarse con una.
// Vivía dentro de `pages/Tramites.tsx`; se sacó aquí para que el Directorio use
// el mismo —si se copiaba, los dos filtros se iban separando con cada ajuste.
export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);

  const only = (val: string) => { onChange([val]); setOpen(false); };

  const buttonLabel =
    selected.length === 0 ? label
    : selected.length === 1 ? (options.find(o => o.value === selected[0])?.label ?? `1 ${label}`)
    : `${label} (${selected.length})`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all whitespace-nowrap ${
          selected.length > 0
            ? 'bg-accent/10 text-accent-ink border-accent/30'
            : 'bg-white dark:bg-white/5 text-neutral-600 dark:text-white/60 border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/8'
        }`}
      >
        {buttonLabel}
        <ChevronDown className={`w-3 h-3 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] bg-surface-card dark:bg-neutral-800 rounded-xl border border-soft dark:border-white/10 shadow-xl overflow-hidden">
          {selected.length > 0 && (
            <button
              onClick={() => { onChange([]); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-500 dark:text-white/55 hover:bg-neutral-50 dark:hover:bg-white/5 border-b border-neutral-100 dark:border-white/8 transition-colors"
            >
              <X className="w-3 h-3" />
              Limpiar selección
            </button>
          )}
          <div className="max-h-56 overflow-y-auto">
            {options.map(opt => {
              const isSel = selected.includes(opt.value);
              return (
                <div key={opt.value} className="flex items-center justify-between px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-white/5 group">
                  <button onClick={() => toggle(opt.value)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                    <span className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                      isSel ? 'bg-accent border-accent' : 'border-neutral-300 dark:border-white/20'
                    }`}>
                      {isSel && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span className="text-xs text-neutral-700 dark:text-white/80 truncate">{opt.label}</span>
                  </button>
                  <button
                    onClick={() => only(opt.value)}
                    className="opacity-0 group-hover:opacity-100 text-[11px] font-semibold text-accent-ink px-1.5 py-0.5 rounded transition-all ml-2 shrink-0 hover:bg-accent/10"
                  >
                    Sólo
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
