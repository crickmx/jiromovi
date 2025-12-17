import { useState, useRef, useEffect, memo } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

interface User {
  id: string;
  nombre_completo: string;
  email_laboral: string;
}

interface SearchableUserSelectProps {
  users: User[];
  value: string | null;
  onChange: (userId: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
}

export const SearchableUserSelect = memo(function SearchableUserSelect({
  users,
  value,
  onChange,
  disabled = false,
  loading = false,
  placeholder = 'Buscar usuario...'
}: SearchableUserSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedUser = users.find(u => u.id === value);

  const filteredUsers = users.filter(u =>
    u.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
    (u.email_laboral && u.email_laboral.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (userId: string) => {
    onChange(userId);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  const handleToggle = () => {
    if (!disabled && !loading) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || loading}
        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed bg-white text-left flex items-center justify-between gap-2"
      >
        <span className="flex-1 truncate">
          {loading ? (
            'Cargando usuarios...'
          ) : selectedUser ? (
            <span>
              {selectedUser.nombre_completo}
              {selectedUser.email_laboral && (
                <span className="text-neutral-500 ml-1">
                  ({selectedUser.email_laboral})
                </span>
              )}
            </span>
          ) : (
            <span className="text-neutral-400">-- Sin asignar --</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {selectedUser && !disabled && !loading && (
            <X
              className="w-4 h-4 text-neutral-400 hover:text-neutral-600"
              onClick={handleClear}
            />
          )}
          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-neutral-300 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-neutral-200">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-neutral-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center text-neutral-500">
                No se encontraron usuarios
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSelect('')}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 transition-colors border-b border-neutral-100"
                >
                  <span className="text-neutral-400">-- Sin asignar --</span>
                </button>
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelect(user.id)}
                    className={`w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 transition-colors ${
                      user.id === value ? 'bg-purple-50 text-purple-700' : ''
                    }`}
                  >
                    <div className="font-medium">{user.nombre_completo}</div>
                    {user.email_laboral && (
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {user.email_laboral}
                      </div>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
