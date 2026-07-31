import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, ContactRound, Check } from 'lucide-react';
import type { EmailContact } from './useEmailContacts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(e: string): boolean {
  return EMAIL_RE.test(e.trim());
}

/**
 * Campo de destinatarios con "chips" removibles, autocompletado de contactos
 * mientras escribes, y un botón de agenda que abre el buscador completo de
 * contactos (corporativos + guardados) para agregarlos con un clic.
 */
export function RecipientsInput({
  label,
  value,
  onChange,
  contacts,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string[];
  onChange: (emails: string[]) => void;
  contacts: EmailContact[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [input, setInput] = useState('');
  const [openSug, setOpenSug] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const byEmail = useMemo(() => {
    const m = new Map<string, EmailContact>();
    for (const c of contacts) m.set(c.email.toLowerCase(), c);
    return m;
  }, [contacts]);

  const nameFor = (email: string) => byEmail.get(email.toLowerCase())?.name;

  const addEmail = (raw: string) => {
    const email = raw.trim().replace(/[,;]+$/, '').trim();
    if (!email) return;
    if (!isValidEmail(email)) return; // ignora inválidos en silencio
    if (value.some((v) => v.toLowerCase() === email.toLowerCase())) {
      setInput('');
      return;
    }
    onChange([...value, email]);
    setInput('');
    setOpenSug(false);
    setHighlight(0);
  };

  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const toggleContact = (c: EmailContact) => {
    const exists = value.some((v) => v.toLowerCase() === c.email.toLowerCase());
    if (exists) onChange(value.filter((v) => v.toLowerCase() !== c.email.toLowerCase()));
    else onChange([...value, c.email]);
  };

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    const added = new Set(value.map((v) => v.toLowerCase()));
    return contacts
      .filter((c) => !added.has(c.email.toLowerCase()))
      .filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .slice(0, 6);
  }, [input, contacts, value]);

  const pickerList = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const base = q
      ? contacts.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      : contacts;
    return base.slice(0, 100);
  }, [pickerQuery, contacts]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenSug(false);
        setOpenPicker(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === 'Tab') {
      if (openSug && suggestions[highlight]) {
        e.preventDefault();
        addEmail(suggestions[highlight].email);
        return;
      }
      if (input.trim()) {
        e.preventDefault();
        addEmail(input);
      }
    } else if (e.key === 'Backspace' && !input && value.length) {
      removeAt(value.length - 1);
    } else if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setOpenSug(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Escape') {
      setOpenSug(false);
      setOpenPicker(false);
    }
  };

  return (
    <div className="flex items-start gap-2" ref={wrapRef}>
      <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-10 flex-shrink-0 pt-2.5">{label}</label>
      <div className="relative flex-1 min-w-0">
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex flex-wrap items-center gap-1 px-2 py-1.5 border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-lg focus-within:ring-1 focus-within:ring-accent/50 min-h-[36px] cursor-text"
        >
          {value.map((email, i) => {
            const nm = nameFor(email);
            return (
              <span
                key={`${email}-${i}`}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-accent/10 text-accent rounded-full text-[11px] max-w-full"
                title={email}
              >
                <span className="truncate max-w-[160px]">{nm || email}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeAt(i); }}
                  className="p-0.5 hover:bg-accent/20 rounded-full transition"
                  title="Quitar"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })}
          <input
            ref={inputRef}
            type="text"
            autoFocus={autoFocus}
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpenSug(true); setHighlight(0); }}
            onKeyDown={onKeyDown}
            onFocus={() => setOpenSug(true)}
            onBlur={() => { if (input.trim()) addEmail(input); }}
            className="flex-1 min-w-[80px] bg-transparent outline-none text-xs text-neutral-800 dark:text-white py-0.5"
            placeholder={value.length === 0 ? (placeholder || 'email@ejemplo.com') : ''}
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpenPicker((v) => !v); setPickerQuery(''); }}
            className="p-1 text-neutral-400 hover:text-accent hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition flex-shrink-0"
            title="Elegir de contactos"
          >
            <ContactRound className="w-4 h-4" />
          </button>
        </div>

        {/* Autocompletar mientras escribes */}
        {openSug && suggestions.length > 0 && (
          <div className="absolute z-[60] left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addEmail(c.email); }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition ${
                  i === highlight ? 'bg-accent/10' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-neutral-800 dark:text-white truncate">{c.name}</p>
                  <p className="text-[10px] text-neutral-400 truncate">{c.email}{c.sub ? ` · ${c.sub}` : ''}</p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${c.source === 'corporativo' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-300'}`}>
                  {c.source === 'corporativo' ? 'JIRO' : 'Contacto'}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Selector completo de contactos */}
        {openPicker && (
          <div className="absolute z-[60] left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 border-b border-neutral-100 dark:border-neutral-700">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                <Search className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Buscar contacto…"
                  className="flex-1 bg-transparent outline-none text-xs text-neutral-800 dark:text-white"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {pickerList.length === 0 ? (
                <p className="px-3 py-4 text-center text-[11px] text-neutral-400">Sin contactos</p>
              ) : (
                pickerList.map((c) => {
                  const added = value.some((v) => v.toLowerCase() === c.email.toLowerCase());
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleContact(c)}
                      className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-neutral-800 dark:text-white truncate">{c.name}</p>
                        <p className="text-[10px] text-neutral-400 truncate">{c.email}{c.sub ? ` · ${c.sub}` : ''}</p>
                      </div>
                      <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition ${added ? 'bg-accent text-white' : 'border border-neutral-300 dark:border-neutral-600'}`}>
                        {added && <Check className="w-3 h-3" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
