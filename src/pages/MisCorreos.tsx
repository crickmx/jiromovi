import { useState, useEffect } from 'react';
import {
  Mail, X, RefreshCw, Send, AlertCircle, CheckCircle, User, Clock,
  Inbox, Send as SendIcon, FileText, AlertTriangle, Trash2, Folder,
  Plus, Paperclip, Eye, EyeOff, ChevronDown, ChevronUp, Bold, Italic,
  Underline, Link as LinkIcon, Image as ImageIcon
} from 'lucide-react';
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
  destinatarios: string[];
  cc?: string[];
  bcc?: string[];
  leido: boolean;
  marcado: boolean;
  respondido: boolean;
  tiene_adjuntos: boolean;
}

interface Carpeta {
  id: string;
  nombre: string;
  tipo_carpeta: string;
  total_mensajes: number;
  no_leidos: number;
  icono: string;
}

export function MisCorreos() {
  const { usuario } = useAuth();
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [carpetaActiva, setCarpetaActiva] = useState<string>('inbox');
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showCC, setShowCC] = useState(false);
  const [showBCC, setShowBCC] = useState(false);
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const [firmaUsuario, setFirmaUsuario] = useState<string>('');

  const [composeData, setComposeData] = useState({
    para: '',
    cc: '',
    bcc: '',
    asunto: '',
    cuerpo: ''
  });

  const iconMap: { [key: string]: any } = {
    'inbox': Inbox,
    'send': SendIcon,
    'file-text': FileText,
    'alert-triangle': AlertTriangle,
    'trash-2': Trash2,
    'folder': Folder
  };

  useEffect(() => {
    loadCarpetas();
    loadFirma();
  }, [usuario]);

  useEffect(() => {
    if (carpetaActiva) {
      loadEmails();
    }
  }, [carpetaActiva, usuario]);

  const loadCarpetas = async () => {
    if (!usuario) return;

    const { data, error } = await supabase
      .from('carpetas_correo')
      .select('id, nombre, tipo_carpeta, total_mensajes, no_leidos, icono')
      .eq('usuario_id', usuario.id)
      .order('orden', { ascending: true });

    if (!error && data) {
      setCarpetas(data);
    }
  };

  const loadFirma = async () => {
    if (!usuario) return;

    const { data } = await supabase
      .from('asignaciones_firma')
      .select('firmas_email(contenido_html)')
      .eq('usuario_id', usuario.id)
      .eq('activo', true)
      .maybeSingle();

    if (data && data.firmas_email) {
      setFirmaUsuario((data.firmas_email as any).contenido_html);
    }
  };

  const loadEmails = async () => {
    if (!usuario) return;

    setLoading(true);

    const carpeta = carpetas.find(c => c.tipo_carpeta === carpetaActiva);
    if (!carpeta) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('correos_usuario')
      .select('*')
      .eq('usuario_id', usuario.id)
      .eq('carpeta_id', carpeta.id)
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

      const carpetasSync = ['INBOX', 'SENT'];

      for (const carpeta of carpetasSync) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sync-user-inbox`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ carpeta, limite: 50 })
          }
        );

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Error al sincronizar');
        }
      }

      setSyncMessage({
        type: 'success',
        text: 'Sincronización completada exitosamente'
      });

      await loadCarpetas();
      await loadEmails();
    } catch (err: any) {
      console.error('Error sincronizando:', err);
      setSyncMessage({ type: 'error', text: err.message || 'Error al sincronizar correos' });
    } finally {
      setSyncing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setAdjuntos([...adjuntos, ...files]);
    }
  };

  const removeAdjunto = (index: number) => {
    setAdjuntos(adjuntos.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleSendEmail = async () => {
    if (!composeData.para || !composeData.asunto || !composeData.cuerpo) {
      setSyncMessage({ type: 'error', text: 'Completa los campos requeridos (Para, Asunto, Mensaje)' });
      return;
    }

    setSending(true);
    setSyncMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const cuerpoConFirma = composeData.cuerpo + (firmaUsuario ? `<br><br>${firmaUsuario}` : '');

      const adjuntosBase64 = await Promise.all(
        adjuntos.map(async (file) => ({
          nombre: file.name,
          contenido: await fileToBase64(file),
          tipo: file.type || 'application/octet-stream'
        }))
      );

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-send-user-message`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            para: composeData.para.split(',').map(e => e.trim()).filter(e => e),
            cc: showCC && composeData.cc ? composeData.cc.split(',').map(e => e.trim()).filter(e => e) : [],
            bcc: showBCC && composeData.bcc ? composeData.bcc.split(',').map(e => e.trim()).filter(e => e) : [],
            asunto: composeData.asunto,
            cuerpo_html: `<div style="font-family: sans-serif;">${cuerpoConFirma.replace(/\n/g, '<br>')}</div>`,
            cuerpo_texto: composeData.cuerpo,
            adjuntos: adjuntosBase64
          })
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setSyncMessage({ type: 'success', text: 'Correo enviado exitosamente' });
        setShowCompose(false);
        setComposeData({ para: '', cc: '', bcc: '', asunto: '', cuerpo: '' });
        setAdjuntos([]);
        setShowCC(false);
        setShowBCC(false);
        await loadEmails();
      } else {
        throw new Error(result.error || 'Error al enviar');
      }
    } catch (err: any) {
      console.error('Error enviando:', err);
      setSyncMessage({ type: 'error', text: err.message || 'Error al enviar correo' });
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
    await loadCarpetas();
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

  if (loading && carpetas.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
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
                <p className="text-primary-100 mt-1">Sistema de correo completo</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-primary-50 text-primary-600 rounded-lg font-medium transition disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>
              <button
                onClick={() => setShowCompose(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-primary-50 text-primary-600 rounded-lg font-medium transition"
              >
                <Send className="w-5 h-5" />
                <span>Nuevo Correo</span>
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

        <div className="flex">
          <div className="w-64 border-r border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3 px-2">Carpetas</h3>
            <div className="space-y-1">
              {carpetas.map((carpeta) => {
                const IconComponent = iconMap[carpeta.icono] || Folder;
                return (
                  <button
                    key={carpeta.id}
                    onClick={() => setCarpetaActiva(carpeta.tipo_carpeta)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition ${
                      carpetaActiva === carpeta.tipo_carpeta
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <IconComponent className="w-4 h-4" />
                      <span>{carpeta.nombre}</span>
                    </div>
                    {carpeta.no_leidos > 0 && (
                      <span className="px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full">
                        {carpeta.no_leidos}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 p-8">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-lg mb-4">
                  No hay correos en esta carpeta
                </p>
                {carpetaActiva === 'inbox' && (
                  <button
                    onClick={handleSync}
                    className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition"
                  >
                    Sincronizar ahora
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => { setSelectedEmail(email); markAsRead(email.id); }}
                    className={`p-4 hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition ${
                      !email.leido ? 'bg-primary-50 border-primary-200' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2 flex-1">
                        {!email.leido && (
                          <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0"></div>
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
                    <div className="mt-2 flex items-center space-x-2">
                      {email.tiene_adjuntos && (
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded flex items-center space-x-1">
                          <Paperclip className="w-3 h-3" />
                          <span>Adjuntos</span>
                        </span>
                      )}
                      {email.cc && email.cc.length > 0 && (
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded">
                          CC: {email.cc.length}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
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
                {selectedEmail.destinatarios && selectedEmail.destinatarios.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Para</p>
                    <p className="text-sm text-slate-700">{selectedEmail.destinatarios.join(', ')}</p>
                  </div>
                )}
                {selectedEmail.cc && selectedEmail.cc.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">CC</p>
                    <p className="text-sm text-slate-700">{selectedEmail.cc.join(', ')}</p>
                  </div>
                )}
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
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
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
                  Para * (separar con comas)
                </label>
                <input
                  type="text"
                  value={composeData.para}
                  onChange={(e) => setComposeData({ ...composeData, para: e.target.value })}
                  placeholder="destinatario@ejemplo.com, otro@ejemplo.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowCC(!showCC)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  {showCC ? 'Ocultar CC' : 'Agregar CC'}
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => setShowBCC(!showBCC)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  {showBCC ? 'Ocultar CCO' : 'Agregar CCO'}
                </button>
              </div>

              {showCC && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">CC</label>
                  <input
                    type="text"
                    value={composeData.cc}
                    onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
                    placeholder="cc@ejemplo.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {showBCC && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">CCO (BCC)</label>
                  <input
                    type="text"
                    value={composeData.bcc}
                    onChange={(e) => setComposeData({ ...composeData, bcc: e.target.value })}
                    placeholder="cco@ejemplo.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Asunto *</label>
                <input
                  type="text"
                  value={composeData.asunto}
                  onChange={(e) => setComposeData({ ...composeData, asunto: e.target.value })}
                  placeholder="Asunto del correo"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mensaje *</label>
                <textarea
                  value={composeData.cuerpo}
                  onChange={(e) => setComposeData({ ...composeData, cuerpo: e.target.value })}
                  placeholder="Escribe tu mensaje aquí..."
                  rows={12}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {firmaUsuario && (
                  <p className="text-xs text-slate-500 mt-1">
                    Se incluirá automáticamente tu firma al final del correo
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Adjuntos</label>
                <div className="flex items-start space-x-3">
                  <label className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                    <Paperclip className="w-5 h-5 text-slate-600" />
                    <span className="text-sm text-slate-700">Agregar archivo</span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  {adjuntos.length > 0 && (
                    <div className="flex-1 space-y-2">
                      {adjuntos.map((file, index) => (
                        <div key={index} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Paperclip className="w-4 h-4 text-slate-500" />
                            <span className="text-sm text-slate-700">{file.name}</span>
                            <span className="text-xs text-slate-500">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            onClick={() => removeAdjunto(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 rounded-b-2xl flex justify-between items-center">
              <div className="text-sm text-slate-600">
                {adjuntos.length > 0 && (
                  <span>{adjuntos.length} archivo(s) adjunto(s)</span>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCompose(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="flex items-center space-x-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                  <span>{sending ? 'Enviando...' : 'Enviar Correo'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
