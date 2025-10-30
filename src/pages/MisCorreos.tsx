import { useState, useEffect } from 'react';
import { Mail, Eye, X, Clock, RefreshCw, Send, AlertCircle, CheckCircle, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Email {
  id: string;
  asunto: string;
  cuerpo_html: string;
  cuerpo_texto: string;
  fecha: string;
  remitente_nombre: string;
  remitente_email: string;
  leido: boolean;
  marcado: boolean;
  respondido: boolean;
}

export function MisCorreos() {
  const { usuario } = useAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({ para: '', asunto: '', cuerpo: '' });

  useEffect(() => {
    loadEmails();
  }, [usuario]);

  const loadEmails = async () => {
    if (!usuario) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('correos_usuario')
      .select('id, asunto, cuerpo_html, cuerpo_texto, fecha, remitente_nombre, remitente_email, leido, marcado, respondido')
      .eq('usuario_id', usuario.id)
      .order('fecha', { ascending: false })
      .limit(100);

    if (!error && data) {
      setEmails(data);
    }
    setLoading(false);
  };

  const handleSync = async () => {
    if (!usuario) return;

    setSyncing(true);
    setSyncMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sync-user-inbox`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ carpeta: 'INBOX', limite: 50 })
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setSyncMessage({
          type: 'success',
          text: `✅ Sincronizados ${result.mensajes} correos. Total: ${result.totalMessages}, No leídos: ${result.noLeidos}`
        });
        await loadEmails();
      } else {
        throw new Error(result.error || 'Error al sincronizar');
      }
    } catch (err: any) {
      console.error('Error sincronizando:', err);
      setSyncMessage({ type: 'error', text: `❌ ${err.message || 'Error al sincronizar correos'}` });
    } finally {
      setSyncing(false);
    }
  };

  const handleSendEmail = async () => {
    if (!composeData.para || !composeData.asunto || !composeData.cuerpo) {
      setSyncMessage({ type: 'error', text: 'Completa todos los campos' });
      return;
    }

    setSending(true);
    setSyncMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-send-user-message`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            para: composeData.para.split(',').map(e => e.trim()),
            asunto: composeData.asunto,
            cuerpo_html: `<div style="font-family: sans-serif;">${composeData.cuerpo.replace(/\n/g, '<br>')}</div>`,
            cuerpo_texto: composeData.cuerpo
          })
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setSyncMessage({ type: 'success', text: '✅ Correo enviado exitosamente' });
        setShowCompose(false);
        setComposeData({ para: '', asunto: '', cuerpo: '' });
      } else {
        throw new Error(result.error || 'Error al enviar');
      }
    } catch (err: any) {
      console.error('Error enviando:', err);
      setSyncMessage({ type: 'error', text: `❌ ${err.message || 'Error al enviar correo'}` });
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (emailId: string) => {
    await supabase
      .from('correos_usuario')
      .update({ leido: true })
      .eq('id', emailId);
    await loadEmails();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Mail className="w-8 h-8 text-white" />
              <div>
                <h1 className="text-2xl font-bold text-white">Mi Email</h1>
                <p className="text-blue-100 mt-1">
                  Bandeja de entrada ({emails.length} correos)
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-blue-50 text-blue-600 rounded-lg font-medium transition disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>
              <button
                onClick={() => setShowCompose(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-blue-50 text-blue-600 rounded-lg font-medium transition"
              >
                <Send className="w-5 h-5" />
                <span>Nuevo</span>
              </button>
            </div>
          </div>
        </div>

        {syncMessage && (
          <div
            className={`mx-8 mt-6 px-4 py-3 rounded-lg flex items-center space-x-2 ${
              syncMessage.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {syncMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="text-sm">{syncMessage.text}</span>
          </div>
        )}

        <div className="p-8">
          {emails.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-lg mb-4">
                No hay correos sincronizados
              </p>
              <button
                onClick={handleSync}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                Sincronizar ahora
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => { setSelectedEmail(email); markAsRead(email.id); }}
                  className={`p-4 hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition ${
                    !email.leido ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2 flex-1">
                      {!email.leido && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                      )}
                      <h3 className={`${!email.leido ? 'font-bold' : 'font-semibold'} text-slate-900 flex-1`}>
                        {email.asunto || '(Sin asunto)'}
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0 ml-4">
                      {formatDate(email.fecha)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    <span className="font-medium">{email.remitente_nombre || email.remitente_email}</span>
                  </p>
                  <div
                    className="text-sm text-slate-600 line-clamp-2"
                    dangerouslySetInnerHTML={{
                      __html: (email.cuerpo_html || email.cuerpo_texto || '').substring(0, 200),
                    }}
                  />
                  {(email.marcado || email.respondido) && (
                    <div className="mt-2 flex items-center space-x-2">
                      {email.marcado && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                          ⭐ Marcado
                        </span>
                      )}
                      {email.respondido && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          ↩️ Respondido
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">Detalle del Correo</h2>
              <button
                onClick={() => setSelectedEmail(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 space-y-3 pb-6 border-b border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Asunto</p>
                  <p className="text-xl font-bold text-slate-900">{selectedEmail.asunto || '(Sin asunto)'}</p>
                </div>
                <div className="flex items-start space-x-6">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-500 mb-1">De</p>
                    <p className="text-slate-900">
                      <span className="font-semibold">{selectedEmail.remitente_nombre}</span>
                      <br />
                      <span className="text-sm text-slate-600">{selectedEmail.remitente_email}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Fecha</p>
                    <p className="text-sm text-slate-600">
                      <Clock className="w-4 h-4 inline mr-1" />
                      {formatDate(selectedEmail.fecha)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="prose max-w-none">
                <div
                  dangerouslySetInnerHTML={{ __html: selectedEmail.cuerpo_html || `<pre>${selectedEmail.cuerpo_texto}</pre>` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Nuevo Correo</h2>
              <button
                onClick={() => setShowCompose(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Para (separar con comas)
                </label>
                <input
                  type="text"
                  value={composeData.para}
                  onChange={(e) => setComposeData({ ...composeData, para: e.target.value })}
                  placeholder="destinatario@ejemplo.com, otro@ejemplo.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Asunto
                </label>
                <input
                  type="text"
                  value={composeData.asunto}
                  onChange={(e) => setComposeData({ ...composeData, asunto: e.target.value })}
                  placeholder="Asunto del correo"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Mensaje
                </label>
                <textarea
                  value={composeData.cuerpo}
                  onChange={(e) => setComposeData({ ...composeData, cuerpo: e.target.value })}
                  placeholder="Escribe tu mensaje aquí..."
                  rows={10}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 rounded-b-2xl flex justify-end space-x-3">
              <button
                onClick={() => setShowCompose(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                <span>{sending ? 'Enviando...' : 'Enviar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
