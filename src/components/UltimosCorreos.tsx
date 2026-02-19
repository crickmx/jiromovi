import { useState, useEffect } from 'react';
import { Mail, Eye, X, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Email {
  id: string;
  asunto: string;
  cuerpo_html: string;
  fecha_envio: string;
  estado: string;
  tipo_envio: string;
}

export function UltimosCorreos() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  useEffect(() => {
    loadEmails();
  }, [usuario]);

  const loadEmails = async () => {
    if (!usuario) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('historial_correos')
      .select('id, asunto, cuerpo_html, fecha_envio, estado, tipo_envio')
      .eq('destinatario_id', usuario.id)
      .eq('estado', 'enviado')
      .order('fecha_envio', { ascending: false })
      .limit(5);

    if (!error && data) {
      setEmails(data);
    }
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Hoy';
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return `Hace ${diffDays} días`;
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Mail className="w-6 h-6 text-accent" />
          <h2 className="text-xl font-bold text-slate-900">Últimos Mensajes</h2>
        </div>
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Mail className="w-6 h-6 text-accent" />
            <h2 className="text-xl font-bold text-slate-900">Últimos Mensajes</h2>
          </div>
          {emails.length > 0 && (
            <button
              onClick={() => navigate('/mis-correos')}
              className="text-sm text-accent hover:text-primary-700 font-medium"
            >
              Ver más
            </button>
          )}
        </div>

        {emails.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No hay mensajes recibidos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {emails.map((email) => (
              <div
                key={email.id}
                className="flex items-start space-x-3 p-3 rounded-lg hover:bg-slate-50 transition cursor-pointer border border-slate-100"
                onClick={() => setSelectedEmail(email)}
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-accent" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {email.asunto}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEmail(email);
                      }}
                      className="flex-shrink-0 text-accent hover:text-primary-700 ml-2"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center space-x-2 mt-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(email.fecha_envio)}</span>
                    <span>•</span>
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded">
                      {email.tipo_envio === 'manual' ? 'Manual' : 'Automático'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">Detalle del Mensaje</h2>
              <button
                onClick={() => setSelectedEmail(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Asunto</p>
                    <p className="text-lg font-semibold text-slate-900">{selectedEmail.asunto}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-slate-600">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatDate(selectedEmail.fecha_envio)}</span>
                  </div>
                  <span>•</span>
                  <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                    {selectedEmail.tipo_envio === 'manual' ? 'Envío Manual' : 'Envío Automático'}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.cuerpo_html }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
