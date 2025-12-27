import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link,
  Heading1,
  Heading2,
  Quote,
  Code,
  Eye,
  FileText
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribe el contenido aquí...',
  minHeight = '300px'
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (editorRef.current && !isFocused) {
      editorRef.current.innerHTML = value;
    }
  }, [value, isFocused]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertLink = () => {
    const url = prompt('Ingresa la URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const formatBlock = (tag: string) => {
    execCommand('formatBlock', `<${tag}>`);
  };

  const toolbarButtons = [
    {
      icon: Heading1,
      label: 'Título Grande',
      action: () => formatBlock('h1'),
      tooltip: 'Título 1'
    },
    {
      icon: Heading2,
      label: 'Título Mediano',
      action: () => formatBlock('h2'),
      tooltip: 'Título 2'
    },
    {
      icon: Bold,
      label: 'Negrita',
      action: () => execCommand('bold'),
      tooltip: 'Negrita (Ctrl+B)'
    },
    {
      icon: Italic,
      label: 'Cursiva',
      action: () => execCommand('italic'),
      tooltip: 'Cursiva (Ctrl+I)'
    },
    {
      icon: List,
      label: 'Lista',
      action: () => execCommand('insertUnorderedList'),
      tooltip: 'Lista con viñetas'
    },
    {
      icon: ListOrdered,
      label: 'Lista Numerada',
      action: () => execCommand('insertOrderedList'),
      tooltip: 'Lista numerada'
    },
    {
      icon: Quote,
      label: 'Cita',
      action: () => formatBlock('blockquote'),
      tooltip: 'Cita'
    },
    {
      icon: Link,
      label: 'Enlace',
      action: insertLink,
      tooltip: 'Insertar enlace'
    },
  ];

  return (
    <div className="space-y-2">
      {/* Barra de herramientas */}
      <div className="flex items-center justify-between gap-2 p-2 bg-neutral-50 border border-neutral-300 rounded-lg flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {toolbarButtons.map((btn, index) => (
            <button
              key={index}
              type="button"
              onClick={btn.action}
              title={btn.tooltip}
              className="p-2 hover:bg-white active:bg-neutral-100 rounded transition-colors group"
            >
              <btn.icon className="w-4 h-4 text-neutral-600 group-hover:text-neutral-900" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
              showPreview
                ? 'bg-primary-100 text-primary-700'
                : 'hover:bg-white text-neutral-600'
            }`}
            title="Vista previa"
          >
            {showPreview ? (
              <>
                <FileText className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">Editor</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">Vista Previa</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor o Vista Previa */}
      {showPreview ? (
        <div
          className="prose max-w-none p-4 border border-neutral-300 rounded-lg bg-white min-h-[300px]"
          dangerouslySetInnerHTML={{ __html: value }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-base bg-white overflow-y-auto prose max-w-none"
          style={{ minHeight }}
          data-placeholder={placeholder}
        />
      )}

      {/* CSS para el placeholder */}
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          display: block;
        }

        [contenteditable] {
          outline: none;
        }

        [contenteditable] h1 {
          font-size: 2em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        [contenteditable] h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        [contenteditable] h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        [contenteditable] p {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        [contenteditable] ul, [contenteditable] ol {
          padding-left: 2em;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        [contenteditable] li {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
        }

        [contenteditable] blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          margin-left: 0;
          margin-right: 0;
          font-style: italic;
          color: #6b7280;
        }

        [contenteditable] a {
          color: #3b82f6;
          text-decoration: underline;
        }

        [contenteditable] a:hover {
          color: #2563eb;
        }

        [contenteditable] strong {
          font-weight: bold;
        }

        [contenteditable] em {
          font-style: italic;
        }

        .prose {
          font-size: 1rem;
          line-height: 1.75;
        }

        .prose h1 {
          font-size: 2em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.2;
        }

        .prose h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.3;
        }

        .prose p {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        .prose ul, .prose ol {
          padding-left: 2em;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        .prose blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          margin: 1em 0;
          font-style: italic;
          color: #6b7280;
        }

        .prose a {
          color: #3b82f6;
          text-decoration: underline;
        }
      `}</style>

      <p className="text-xs text-neutral-500">
        Usa la barra de herramientas para dar formato al texto. Puedes alternar entre el editor y la vista previa.
      </p>
    </div>
  );
}
