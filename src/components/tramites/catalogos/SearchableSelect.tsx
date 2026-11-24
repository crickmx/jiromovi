import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

interface Option { label: string; value: string }

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '');
}

export function SearchableSelect({ value, onChange, options, placeholder = 'Seleccionar...', disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);
  const filtered = search.trim()
    ? options.filter(o => normalize(o.label).includes(normalize(search)))
    : options;

  // El panel se renderiza en un portal a document.body -- si viviera dentro del
  // flujo normal, el overflow-y-auto del body del modal (BaseModal) lo recorta
  // apenas el campo queda cerca del borde visible, aunque tenga z-index alto.
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const panelHeight = Math.min(260, viewportHeight - 32);
    const abreHaciaArriba = rect.bottom + panelHeight > viewportHeight - 16 && rect.top > panelHeight;

    setPanelStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight: panelHeight,
      top: abreHaciaArriba ? undefined : rect.bottom + 4,
      bottom: abreHaciaArriba ? viewportHeight - rect.top + 4 : undefined,
      zIndex: 99999,
    });
  }, []);

  useEffect(() => {
    if (open) {
      calculatePosition();
      setTimeout(() => inputRef.current?.focus(), 0);
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);
      return () => {
        window.removeEventListener('scroll', calculatePosition, true);
        window.removeEventListener('resize', calculatePosition);
      };
    }
    setSearch('');
  }, [open, calculatePosition]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (disabled) {
    return (
      <div className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm bg-neutral-50 text-neutral-500">
        {selected?.label || <span className="text-neutral-500">{placeholder}</span>}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm text-left flex items-center justify-between bg-surface-card focus:outline-none focus:ring-2 focus:ring-accent/40 hover:border-neutral-400 transition-colors"
      >
        <span className={selected ? 'text-neutral-900 truncate' : 'text-neutral-500'}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-neutral-500 shrink-0 ml-2 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className="bg-surface-card border border-soft rounded-xl shadow-lg overflow-hidden flex flex-col"
        >
          <div className="p-2 border-b border-neutral-100 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-neutral-50 ${!value ? 'text-blue-600 font-medium' : 'text-neutral-400'}`}
            >
              {placeholder}
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-neutral-500">Sin resultados</p>
            ) : filtered.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-blue-50 ${opt.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-neutral-700'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
