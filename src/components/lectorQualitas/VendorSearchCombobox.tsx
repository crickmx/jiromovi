import { useState, useRef, useEffect } from 'react';
import { Search, X, User, Building, ChevronDown } from 'lucide-react';
import type { SicasVendorOption } from '../../lib/lectorQualitasTypes';

interface VendorSearchComboboxProps {
  vendors: SicasVendorOption[];
  selectedVendor?: SicasVendorOption | null;
  onSelect: (vendor: SicasVendorOption | null) => void;
  placeholder?: string;
  compact?: boolean;
}

export default function VendorSearchCombobox({
  vendors,
  selectedVendor,
  onSelect,
  placeholder = 'Buscar vendedor...',
  compact = false,
}: VendorSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizeStr = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const filtered = search.trim()
    ? vendors.filter((v) => {
        const q = normalizeStr(search);
        return (
          normalizeStr(v.nombre).includes(q) ||
          (v.clave && normalizeStr(v.clave).includes(q)) ||
          (v.gerenciaName && normalizeStr(v.gerenciaName).includes(q)) ||
          (v.despachoName && normalizeStr(v.despachoName).includes(q)) ||
          v.idSicas.includes(q)
        );
      })
    : vendors;

  const displayed = filtered.slice(0, 50);

  const handleSelect = (vendor: SicasVendorOption) => {
    onSelect(vendor);
    setSearch('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setSearch('');
  };

  if (selectedVendor && !isOpen) {
    return (
      <div
        ref={containerRef}
        className="group relative flex items-center gap-1.5 cursor-pointer"
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        <div className={`flex-1 min-w-0 ${compact ? 'max-w-[200px]' : ''}`}>
          <p className="text-xs font-semibold text-neutral-800 dark:text-white truncate leading-tight">
            {selectedVendor.nombre}
          </p>
          <p className="text-[10px] text-neutral-500 dark:text-white/50 truncate leading-tight">
            {[selectedVendor.clave, selectedVendor.despachoName, selectedVendor.gerenciaName].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          onClick={handleClear}
          className="flex-shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-neutral-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`
          flex items-center gap-1.5 border rounded-lg transition-colors
          ${isOpen ? 'border-accent ring-1 ring-accent/20' : 'border-neutral-200 dark:border-white/15 hover:border-neutral-300 dark:hover:border-white/25'}
          ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'}
        `}
        onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}
      >
        <Search className="w-3 h-3 text-neutral-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`flex-1 min-w-0 bg-transparent text-xs text-neutral-800 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-white/40 outline-none ${compact ? 'w-[120px]' : 'w-[160px]'}`}
        />
        <ChevronDown className={`w-3 h-3 text-neutral-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 max-h-60 overflow-y-auto bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/15 rounded-xl shadow-xl">
          {displayed.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-neutral-500 dark:text-white/50">
              {search ? 'Sin resultados para esta busqueda' : 'No hay vendedores disponibles'}
            </div>
          ) : (
            <>
              {filtered.length > 50 && (
                <div className="px-3 py-1.5 border-b border-neutral-100 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
                  <p className="text-[10px] text-neutral-500 dark:text-white/50">
                    Mostrando 50 de {filtered.length} resultados. Refina tu busqueda.
                  </p>
                </div>
              )}
              {displayed.map((vendor) => (
                <button
                  key={vendor.id}
                  onClick={() => handleSelect(vendor)}
                  className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-left border-b border-neutral-50 dark:border-white/5 last:border-0"
                >
                  <div className="flex-shrink-0 mt-0.5 p-1 bg-accent/10 rounded-md">
                    <User className="w-3 h-3 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-neutral-800 dark:text-white truncate">
                      {vendor.nombre}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {vendor.clave && (
                        <span className="inline-flex items-center px-1.5 py-0 bg-neutral-100 dark:bg-white/10 rounded text-[10px] font-mono text-neutral-600 dark:text-white/60">
                          {vendor.clave}
                        </span>
                      )}
                      {vendor.idSicas && (
                        <span className="text-[10px] text-neutral-400 dark:text-white/40">
                          ID:{vendor.idSicas}
                        </span>
                      )}
                      {vendor.tipoVend && (
                        <span className="text-[10px] text-neutral-400 dark:text-white/40">
                          {vendor.tipoVend}
                        </span>
                      )}
                    </div>
                    {(vendor.despachoName || vendor.gerenciaName) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Building className="w-2.5 h-2.5 text-neutral-400" />
                        <span className="text-[10px] text-neutral-500 dark:text-white/50 truncate">
                          {[vendor.despachoName, vendor.gerenciaName].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
