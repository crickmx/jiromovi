import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { User, Mail } from 'lucide-react';

interface Contacto {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string;
  empresa: string | null;
}

interface ContactoAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function ContactoAutocomplete({
  value,
  onChange,
  placeholder = 'Escribe un email o busca contacto...',
  className = '',
}: ContactoAutocompleteProps) {
  const { usuario } = useAuth();
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredContactos, setFilteredContactos] = useState<Contacto[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (usuario) {
      loadContactos();
    }
  }, [usuario]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    filterContactos();
  }, [value, contactos]);

  const loadContactos = async () => {
    if (!usuario) return;

    try {
      const { data, error } = await supabase
        .from('contactos')
        .select('id, nombre, apellido, email, empresa')
        .eq('usuario_id', usuario.id)
        .order('ultima_interaccion', { ascending: false, nullsFirst: false })
        .limit(100);

      if (error) throw error;

      setContactos(data || []);
    } catch (error) {
      console.error('Error cargando contactos:', error);
    }
  };

  const filterContactos = () => {
    const currentInput = getCurrentInput();

    if (!currentInput || currentInput.length < 2) {
      setFilteredContactos([]);
      setShowSuggestions(false);
      return;
    }

    const query = currentInput.toLowerCase();
    const filtered = contactos.filter(
      c =>
        c.email.toLowerCase().includes(query) ||
        c.nombre?.toLowerCase().includes(query) ||
        c.apellido?.toLowerCase().includes(query) ||
        c.empresa?.toLowerCase().includes(query)
    );

    setFilteredContactos(filtered.slice(0, 10));
    setShowSuggestions(filtered.length > 0);
    setHighlightedIndex(0);
  };

  const getCurrentInput = () => {
    const parts = value.split(',');
    return parts[parts.length - 1].trim();
  };

  const handleSelectContacto = (contacto: Contacto) => {
    const parts = value.split(',');
    parts[parts.length - 1] = ` ${contacto.email}`;
    const newValue = parts.join(',');
    onChange(newValue);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredContactos.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % filteredContactos.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + filteredContactos.length) % filteredContactos.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredContactos[highlightedIndex]) {
          handleSelectContacto(filteredContactos[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const getContactoDisplay = (contacto: Contacto) => {
    const nombre = contacto.nombre && contacto.apellido
      ? `${contacto.nombre} ${contacto.apellido}`
      : contacto.nombre || contacto.apellido || 'Sin nombre';
    return nombre;
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (filteredContactos.length > 0) {
            setShowSuggestions(true);
          }
        }}
        placeholder={placeholder}
        className={className}
      />

      {showSuggestions && filteredContactos.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredContactos.map((contacto, index) => (
            <div
              key={contacto.id}
              onClick={() => handleSelectContacto(contacto)}
              className={`px-4 py-3 cursor-pointer flex items-center space-x-3 ${
                index === highlightedIndex
                  ? 'bg-primary-50 border-l-4 border-l-blue-600'
                  : 'hover:bg-slate-50'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 truncate">
                  {getContactoDisplay(contacto)}
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <Mail className="w-3 h-3 mr-1" />
                  <span className="truncate">{contacto.email}</span>
                </div>
                {contacto.empresa && (
                  <div className="text-xs text-slate-500 truncate">
                    {contacto.empresa}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
