import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link, Image, Eraser } from 'lucide-react';

/**
 * Editor de texto enriquecido casero (sin dependencias) sobre contentEditable.
 * Produce HTML directo en `value`, que el backend de correo (ionos-webmail) ya
 * acepta como `bodyHtml`. Soporta negrita/cursiva/subrayado, listas, enlaces,
 * imágenes inline (base64) y quitar formato.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  maxImageBytes = 2 * 1024 * 1024,
  onError,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  maxImageBytes?: number;
  onError?: (msg: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef<string>('');
  const [isEmpty, setIsEmpty] = useState(true);

  // Sincroniza HTML externo (reply/forward/borrador) sin pisar lo que el
  // usuario escribe: solo reescribe el DOM cuando el valor entra desde afuera.
  useEffect(() => {
    if (ref.current && value !== lastEmitted.current) {
      ref.current.innerHTML = value || '';
      lastEmitted.current = value || '';
      setIsEmpty(isHtmlEmpty(ref.current.innerHTML));
    }
  }, [value]);

  const emit = () => {
    const html = ref.current?.innerHTML ?? '';
    lastEmitted.current = html;
    setIsEmpty(isHtmlEmpty(html));
    onChange(html);
  };

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const addLink = () => {
    const url = window.prompt('URL del enlace:', 'https://');
    if (!url) return;
    exec('createLink', url);
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (imgInputRef.current) imgInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError?.('Solo se pueden insertar imágenes.');
      return;
    }
    if (file.size > maxImageBytes) {
      onError?.(`La imagen supera ${(maxImageBytes / 1024 / 1024).toFixed(0)} MB.`);
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    exec('insertImage', dataUrl);
  };

  const btn = 'p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition';

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden bg-neutral-50 dark:bg-neutral-900 movi-rte-wrap">
      <style>{`
        .movi-rte { min-height: 180px; }
        .movi-rte:focus { outline: none; }
        .movi-rte img { max-width: 100%; height: auto; border-radius: 4px; }
        .movi-rte ul { list-style: disc; padding-left: 1.5rem; margin: 0.25rem 0; }
        .movi-rte ol { list-style: decimal; padding-left: 1.5rem; margin: 0.25rem 0; }
        .movi-rte a { color: #2563eb; text-decoration: underline; }
        .movi-rte:empty::before,
        .movi-rte-empty::before { content: attr(data-ph); color: #9ca3af; pointer-events: none; }
      `}</style>

      {/* Barra de formato */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 flex-wrap">
        <button type="button" className={btn} title="Negrita" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}>
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button type="button" className={btn} title="Cursiva" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}>
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button type="button" className={btn} title="Subrayado" onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}>
          <Underline className="w-3.5 h-3.5" />
        </button>
        <span className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mx-1" />
        <button type="button" className={btn} title="Lista con viñetas" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}>
          <List className="w-3.5 h-3.5" />
        </button>
        <button type="button" className={btn} title="Lista numerada" onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }}>
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <span className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mx-1" />
        <button type="button" className={btn} title="Insertar enlace" onMouseDown={(e) => { e.preventDefault(); addLink(); }}>
          <Link className="w-3.5 h-3.5" />
        </button>
        <button type="button" className={btn} title="Insertar imagen" onMouseDown={(e) => { e.preventDefault(); imgInputRef.current?.click(); }}>
          <Image className="w-3.5 h-3.5" />
        </button>
        <span className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mx-1" />
        <button type="button" className={btn} title="Quitar formato" onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); exec('unlink'); }}>
          <Eraser className="w-3.5 h-3.5" />
        </button>
        <input ref={imgInputRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
      </div>

      {/* Área editable */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-ph={placeholder || 'Escribe tu mensaje…'}
        className={`movi-rte ${isEmpty ? 'movi-rte-empty' : ''} px-3 py-3 text-xs text-neutral-800 dark:text-white leading-relaxed overflow-y-auto max-h-[40vh]`}
      />
    </div>
  );
}

function isHtmlEmpty(html: string): boolean {
  const stripped = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<div>\s*<\/div>/gi, '')
    .replace(/&nbsp;/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
  return stripped.length === 0 && !/<img/i.test(html);
}
