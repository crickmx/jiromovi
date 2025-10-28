import { useState } from 'react';
import { X, Send, Clock, Paperclip, Trash2, Bold, Italic, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface RedactarCorreoProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  configuracion: any;
}

export function RedactarCorreo({ isOpen, onClose, onSuccess, configuracion }: RedactarCorreoProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [destinatarios, setDestinatarios] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [showCC, setShowCC] = useState(false);
  const [showBCC, setShowBCC] = useState(false);

  const [programado, setProgramado] = useState(false);
  const [fechaProgramada, setFechaProgramada] = useState('');

  const handleEnviar = async (esProgramado = false) => {
    if (!destinatarios || !asunto) {
      setError('Destinatarios y asunto son requeridos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-send-message`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            configuracionId: configuracion.id,
            destinatarios: destinatarios.split(',').map(d => d.trim()),
            cc: cc ? cc.split(',').map(d => d.trim()) : [],
            bcc: bcc ? bcc.split(',').map(d => d.trim()) : [],
            asunto,
            cuerpoHtml: cuerpo,
            programado: esProgramado,
            fechaProgramada: esProgramado ? fechaProgramada : null
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error enviando:', err);
      setError(err.message || 'Error al enviar el correo');
    } finally {
      setLoading(false);
    }
  };

  const aplicarFormato = (formato: string) => {
    const textarea = document.getElementById('cuerpo-email') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = cuerpo.substring(start, end);

    let formattedText = selectedText;
    switch (formato) {
      case 'bold':
        formattedText = `<strong>${selectedText}</strong>`;
        break;
      case 'italic':
        formattedText = `<em>${selectedText}</em>`;
        break;
      case 'link':
        const url = prompt('URL:');
        if (url) formattedText = `<a href="${url}">${selectedText}</a>`;
        break;
    }

    setCuerpo(
      cuerpo.substring(0, start) + formattedText + cuerpo.substring(end)
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-strong max-w-4xl w-full mx-4 my-8">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <h2 className="text-2xl font-display font-bold text-neutral-900">
            Redactar correo
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 p-2 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <div className="flex items-center space-x-2 mb-2">
              <label className="text-sm font-semibold text-neutral-700 w-16">Para:</label>
              <input
                type="text"
                value={destinatarios}
                onChange={(e) => setDestinatarios(e.target.value)}
                className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="correo@example.com, otro@example.com"
              />
              <button
                onClick={() => setShowCC(!showCC)}
                className="text-sm text-primary-600 hover:text-primary-700 px-3 py-1"
              >
                CC
              </button>
              <button
                onClick={() => setShowBCC(!showBCC)}
                className="text-sm text-primary-600 hover:text-primary-700 px-3 py-1"
              >
                CCO
              </button>
            </div>
          </div>

          {showCC && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-semibold text-neutral-700 w-16">CC:</label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="cc@example.com"
              />
            </div>
          )}

          {showBCC && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-semibold text-neutral-700 w-16">CCO:</label>
              <input
                type="text"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="bcc@example.com"
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <label className="text-sm font-semibold text-neutral-700 w-16">Asunto:</label>
            <input
              type="text"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Asunto del correo"
            />
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200">
              <button
                onClick={() => aplicarFormato('bold')}
                className="p-2 hover:bg-neutral-200 rounded transition-all"
                title="Negrita"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onClick={() => aplicarFormato('italic')}
                className="p-2 hover:bg-neutral-200 rounded transition-all"
                title="Cursiva"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                onClick={() => aplicarFormato('link')}
                className="p-2 hover:bg-neutral-200 rounded transition-all"
                title="Enlace"
              >
                <LinkIcon className="w-4 h-4" />
              </button>
              <div className="flex-1"></div>
              <button className="p-2 hover:bg-neutral-200 rounded transition-all" title="Adjuntar archivo">
                <Paperclip className="w-4 h-4" />
              </button>
            </div>

            <textarea
              id="cuerpo-email"
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Escribe tu mensaje aquí..."
            />
          </div>

          {programado && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Fecha y hora de envío
              </label>
              <input
                type="datetime-local"
                value={fechaProgramada}
                onChange={(e) => setFechaProgramada(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-6 py-4 flex justify-between rounded-b-3xl">
          <button
            onClick={() => setProgramado(!programado)}
            className="flex items-center space-x-2 px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-all"
          >
            <Clock className="w-5 h-5" />
            <span>{programado ? 'Envío inmediato' : 'Programar envío'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-neutral-700 hover:bg-neutral-200 rounded-xl font-semibold transition-all"
            >
              Cancelar
            </button>

            <button
              onClick={() => handleEnviar(programado)}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all font-semibold disabled:opacity-50"
            >
              {programado ? <Clock className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              <span>{loading ? 'Enviando...' : programado ? 'Programar' : 'Enviar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
