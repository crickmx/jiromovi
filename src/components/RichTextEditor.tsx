import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  Palette,
  Undo,
  Redo,
  Eye,
  FileText,
  Strikethrough
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

  const insertHorizontalLine = () => {
    execCommand('insertHorizontalRule');
  };

  const changeTextColor = () => {
    const color = prompt('Ingresa el color (hex ej: #FF0000 o nombre ej: red):');
    if (color) {
      execCommand('foreColor', color);
    }
  };

  const toolbarButtonGroups = [
    // Grupo 1: Títulos
    {
      name: 'Títulos',
      buttons: [
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
          icon: Heading3,
          label: 'Título Pequeño',
          action: () => formatBlock('h3'),
          tooltip: 'Título 3'
        },
      ]
    },
    // Grupo 2: Formato de texto
    {
      name: 'Formato',
      buttons: [
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
          icon: Underline,
          label: 'Subrayado',
          action: () => execCommand('underline'),
          tooltip: 'Subrayado (Ctrl+U)'
        },
        {
          icon: Strikethrough,
          label: 'Tachado',
          action: () => execCommand('strikethrough'),
          tooltip: 'Tachado'
        },
      ]
    },
    // Grupo 3: Alineación
    {
      name: 'Alineación',
      buttons: [
        {
          icon: AlignLeft,
          label: 'Alinear Izquierda',
          action: () => execCommand('justifyLeft'),
          tooltip: 'Alinear a la izquierda'
        },
        {
          icon: AlignCenter,
          label: 'Centrar',
          action: () => execCommand('justifyCenter'),
          tooltip: 'Centrar'
        },
        {
          icon: AlignRight,
          label: 'Alinear Derecha',
          action: () => execCommand('justifyRight'),
          tooltip: 'Alinear a la derecha'
        },
        {
          icon: AlignJustify,
          label: 'Justificar',
          action: () => execCommand('justifyFull'),
          tooltip: 'Justificar'
        },
      ]
    },
    // Grupo 4: Listas
    {
      name: 'Listas',
      buttons: [
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
      ]
    },
    // Grupo 5: Extras
    {
      name: 'Extras',
      buttons: [
        {
          icon: Link,
          label: 'Enlace',
          action: insertLink,
          tooltip: 'Insertar enlace'
        },
        {
          icon: Quote,
          label: 'Cita',
          action: () => formatBlock('blockquote'),
          tooltip: 'Cita'
        },
        {
          icon: Minus,
          label: 'Línea Horizontal',
          action: insertHorizontalLine,
          tooltip: 'Insertar línea horizontal'
        },
        {
          icon: Palette,
          label: 'Color',
          action: changeTextColor,
          tooltip: 'Color de texto'
        },
      ]
    },
    // Grupo 6: Deshacer/Rehacer
    {
      name: 'Acciones',
      buttons: [
        {
          icon: Undo,
          label: 'Deshacer',
          action: () => execCommand('undo'),
          tooltip: 'Deshacer (Ctrl+Z)'
        },
        {
          icon: Redo,
          label: 'Rehacer',
          action: () => execCommand('redo'),
          tooltip: 'Rehacer (Ctrl+Y)'
        },
      ]
    },
  ];

  return (
    <div className="space-y-2">
      {/* Barra de herramientas */}
      <div className="bg-neutral-50 border border-neutral-300 rounded-lg">
        <div className="flex items-center justify-between gap-2 p-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {toolbarButtonGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="flex items-center">
                <div className="flex items-center gap-0.5">
                  {group.buttons.map((btn, btnIndex) => (
                    <button
                      key={btnIndex}
                      type="button"
                      onClick={btn.action}
                      title={btn.tooltip}
                      className="p-2 hover:bg-white active:bg-neutral-100 rounded transition-colors group"
                    >
                      <btn.icon className="w-4 h-4 text-neutral-600 group-hover:text-neutral-900" />
                    </button>
                  ))}
                </div>
                {groupIndex < toolbarButtonGroups.length - 1 && (
                  <div className="w-px h-6 bg-neutral-300 mx-1" />
                )}
              </div>
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

      {/* CSS para el placeholder y estilos del editor */}
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
          line-height: 1.2;
        }

        [contenteditable] h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.3;
        }

        [contenteditable] h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.4;
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
          margin-top: 1em;
          margin-bottom: 1em;
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

        [contenteditable] strong, [contenteditable] b {
          font-weight: bold;
        }

        [contenteditable] em, [contenteditable] i {
          font-style: italic;
        }

        [contenteditable] u {
          text-decoration: underline;
        }

        [contenteditable] strike, [contenteditable] s {
          text-decoration: line-through;
        }

        [contenteditable] hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 1.5em 0;
        }

        [contenteditable] [style*="text-align: left"] {
          text-align: left;
        }

        [contenteditable] [style*="text-align: center"] {
          text-align: center;
        }

        [contenteditable] [style*="text-align: right"] {
          text-align: right;
        }

        [contenteditable] [style*="text-align: justify"] {
          text-align: justify;
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

        .prose h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.4;
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

        .prose li {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
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

        .prose strong, .prose b {
          font-weight: bold;
        }

        .prose em, .prose i {
          font-style: italic;
        }

        .prose u {
          text-decoration: underline;
        }

        .prose strike, .prose s {
          text-decoration: line-through;
        }

        .prose hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 1.5em 0;
        }
      `}</style>

      <p className="text-xs text-neutral-500">
        Usa la barra de herramientas para dar formato: títulos, negrita, cursiva, subrayado, alineación (izquierda, centro, derecha, justificado), listas, enlaces, y más. Alterna entre el editor y la vista previa.
      </p>
    </div>
  );
}
