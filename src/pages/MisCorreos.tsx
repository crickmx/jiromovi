import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, X, RefreshCw, Send, CircleAlert as AlertCircle, CircleCheck as CheckCircle, User, Clock, Inbox, Send as SendIcon, FileText, TriangleAlert as AlertTriangle, Trash2, Folder, Paperclip, Search, ListFilter as Filter, Settings, WifiOff, Eye, EyeOff, ChevronDown, Reply, Forward, Star, MoveHorizontal as MoreHorizontal, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';

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
  carpeta_id: string;
}

interface Carpeta {
  id: string;
  nombre: string;
  tipo_carpeta: string;
  total_mensajes: number;
  no_leidos: number;
  icono: string;
}

interface ComposeData {
  para: string;
  cc: string;
  bcc: string;
  asunto: string;
  cuerpo: string;
}

type FilterType = 'all' | 'unread' | 'attachments' | 'starred';

const iconMap: Record<string, any> = {
  inbox: Inbox,
  send: SendIcon,
  'file-text': FileText,
  'alert-triangle': AlertTriangle,
  'trash-2': Trash2,
  folder: Folder,
};

function sanitizeEmailPreview(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function EmailBodyFrame({ html, text }: { html: string; text: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const content = html || `<pre style="white-space:pre-wrap;font-family:sans-serif">${text || ''}</pre>`;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src https:">
      <style>
        body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.6; }
        img { max-width: 100%; height: auto; }
        a { color: #0069d9; }
        pre { white-space: pre-wrap; word-break: break-word; }
        table { max-width: 100%; }
      </style>
    </head><body>${content}</body></html>`);
    doc.close();

    const resize = () => {
      if (iframe.contentDocument?.body) {
        setHeight(iframe.contentDocument.body.scrollHeight + 32);
      }
    };
    setTimeout(resize, 100);
  }, [html, text]);

  return (
    <iframe
      ref={iframeRef}
      title="email-body"
      sandbox="allow-same-origin"
      style={{ height, border: 'none', width: '100%', display: 'block' }}
      className="bg-white dark:bg-white"
    />
  );
}

// ─── Connection Setup Screen ───────────────────────────────────────────────────
function ConnectEmailScreen({ onConnected }: { onConnected: () => void }) {
  const { usuario } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [imapServer, setImapServer] = useState('imap.ionos.mx');
  const [imapPort, setImapPort] = useState('993');
  const [smtpServer, setSmtpServer] = useState('smtp.ionos.mx');
  const [smtpPort, setSmtpPort] = useState('587');
  const [displayName, setDisplayName] = useState(usuario?.nombre_completo || '');

  const handleTest = async () => {
    if (!email || !password) {
      setTestResult({ type: 'error', text: 'Ingresa tu correo y contraseña' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-verify-connection`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ type: 'success', text: 'Conexion exitosa. Puedes guardar la configuracion.' });
      } else {
        setTestResult({ type: 'error', text: data.error || 'No se pudo conectar. Verifica tus credenciales.' });
      }
    } catch {
      setTestResult({ type: 'error', text: 'Error de red al probar conexion.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!email || !password) {
      setTestResult({ type: 'error', text: 'El correo y contrasena son obligatorios' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ email_cuenta: email, email_password: password })
        .eq('id', usuario!.id);

      if (error) throw error;

      await supabase.from('email_configuraciones').upsert({
        usuario_id: usuario!.id,
        email,
        servidor_entrada: imapServer,
        puerto_entrada: parseInt(imapPort),
        servidor_salida: smtpServer,
        puerto_salida: parseInt(smtpPort),
        nombre_remitente: displayName || email,
        activa: true,
        estado_conexion: 'sin_verificar',
      }, { onConflict: 'usuario_id' });

      onConnected();
    } catch (err: any) {
      setTestResult({ type: 'error', text: err.message || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-start justify-center min-h-[60vh] p-8 overflow-y-auto">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Conecta tu correo</h2>
          <p className="text-neutral-500 dark:text-white/50 text-sm">
            Configura tu cuenta de correo IONOS para enviar y recibir mensajes desde MOVI Digital.
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/60 dark:border-white/8 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1.5">Correo electronico *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-neutral-700/50 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1.5">Contrasena *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Contrasena de tu cuenta IONOS"
                className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-neutral-700/50 dark:text-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1.5">Nombre de remitente</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Tu nombre o empresa"
              className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-neutral-700/50 dark:text-white"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-medium"
          >
            <Settings className="w-4 h-4" />
            Configuracion avanzada
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-1 border-t border-neutral-100 dark:border-white/8">
              <p className="text-xs text-neutral-500 dark:text-white/40">Servidores IONOS predeterminados (no cambiar a menos que tu proveedor lo indique)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Servidor IMAP</label>
                  <input
                    value={imapServer}
                    onChange={e => setImapServer(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg text-xs dark:bg-neutral-700/50 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Puerto IMAP</label>
                  <input
                    value={imapPort}
                    onChange={e => setImapPort(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg text-xs dark:bg-neutral-700/50 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Servidor SMTP</label>
                  <input
                    value={smtpServer}
                    onChange={e => setSmtpServer(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg text-xs dark:bg-neutral-700/50 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Puerto SMTP</label>
                  <input
                    value={smtpPort}
                    onChange={e => setSmtpPort(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg text-xs dark:bg-neutral-700/50 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {testResult && (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm ${
              testResult.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {testResult.type === 'success'
                ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span>{testResult.text}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleTest}
              disabled={testing || !email || !password}
              className="flex-1 py-2.5 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-white/70 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-white/5 disabled:opacity-50 transition"
            >
              {testing ? 'Probando...' : 'Probar conexion'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !email || !password}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition"
            >
              {saving ? 'Guardando...' : 'Guardar y continuar'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-neutral-400 dark:text-white/30 mt-4">
          Tus credenciales se almacenan de forma segura y se usan solo para conectarse al servidor IONOS.
        </p>
      </div>
    </div>
  );
}

// ─── Compose Modal ─────────────────────────────────────────────────────────────
interface ComposeModalProps {
  initial?: Partial<ComposeData>;
  firmaUsuario: string;
  onClose: () => void;
  onSent: () => void;
}

function ComposeModal({ initial, firmaUsuario, onClose, onSent }: ComposeModalProps) {
  const [form, setForm] = useState<ComposeData>({
    para: initial?.para || '',
    cc: initial?.cc || '',
    bcc: initial?.bcc || '',
    asunto: initial?.asunto || '',
    cuerpo: initial?.cuerpo || '',
  });
  const [showCC, setShowCC] = useState(!!initial?.cc);
  const [showBCC, setShowBCC] = useState(false);
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
    });

  const handleSend = async () => {
    if (!form.para || !form.asunto || !form.cuerpo) {
      setError('Completa los campos requeridos: Para, Asunto y Mensaje');
      return;
    }
    setSending(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const cuerpoFinal = form.cuerpo + (firmaUsuario ? `<br><br>${firmaUsuario}` : '');

      const adjuntosBase64 = await Promise.all(
        adjuntos.map(async (f) => ({
          nombre: f.name,
          contenido: await fileToBase64(f),
          tipo: f.type || 'application/octet-stream',
        }))
      );

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-send-user-message`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            para: form.para.split(',').map(e => e.trim()).filter(Boolean),
            cc: showCC && form.cc ? form.cc.split(',').map(e => e.trim()).filter(Boolean) : [],
            bcc: showBCC && form.bcc ? form.bcc.split(',').map(e => e.trim()).filter(Boolean) : [],
            asunto: form.asunto,
            cuerpo_html: `<div style="font-family:sans-serif">${cuerpoFinal.replace(/\n/g, '<br>')}</div>`,
            cuerpo_texto: form.cuerpo,
            adjuntos: adjuntosBase64,
          }),
        }
      );
      const result = await res.json();
      if (res.ok && result.success) {
        onSent();
      } else {
        throw new Error(result.error || 'Error al enviar');
      }
    } catch (err: any) {
      setError(err.message || 'Error al enviar correo');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-white/10">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Nuevo correo</h2>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-white/70">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="space-y-0 border border-neutral-200 dark:border-white/10 rounded-lg overflow-hidden divide-y divide-neutral-200 dark:divide-white/10">
            <div className="flex items-center px-3">
              <span className="text-xs text-neutral-500 dark:text-white/40 w-10 flex-shrink-0">Para</span>
              <input
                type="text"
                value={form.para}
                onChange={e => setForm({ ...form, para: e.target.value })}
                placeholder="destinatario@ejemplo.com"
                className="flex-1 py-2.5 text-sm bg-transparent focus:outline-none dark:text-white placeholder-neutral-400"
              />
              <div className="flex gap-1">
                <button onClick={() => setShowCC(!showCC)} className={`px-2 py-1 text-xs rounded ${showCC ? 'bg-blue-100 text-blue-700' : 'text-neutral-400 hover:text-neutral-600'}`}>CC</button>
                <button onClick={() => setShowBCC(!showBCC)} className={`px-2 py-1 text-xs rounded ${showBCC ? 'bg-blue-100 text-blue-700' : 'text-neutral-400 hover:text-neutral-600'}`}>CCO</button>
              </div>
            </div>
            {showCC && (
              <div className="flex items-center px-3">
                <span className="text-xs text-neutral-500 dark:text-white/40 w-10 flex-shrink-0">CC</span>
                <input type="text" value={form.cc} onChange={e => setForm({ ...form, cc: e.target.value })} placeholder="cc@ejemplo.com" className="flex-1 py-2.5 text-sm bg-transparent focus:outline-none dark:text-white placeholder-neutral-400" />
              </div>
            )}
            {showBCC && (
              <div className="flex items-center px-3">
                <span className="text-xs text-neutral-500 dark:text-white/40 w-10 flex-shrink-0">CCO</span>
                <input type="text" value={form.bcc} onChange={e => setForm({ ...form, bcc: e.target.value })} placeholder="cco@ejemplo.com" className="flex-1 py-2.5 text-sm bg-transparent focus:outline-none dark:text-white placeholder-neutral-400" />
              </div>
            )}
            <div className="flex items-center px-3">
              <span className="text-xs text-neutral-500 dark:text-white/40 w-10 flex-shrink-0">Asunto</span>
              <input type="text" value={form.asunto} onChange={e => setForm({ ...form, asunto: e.target.value })} placeholder="Asunto del correo" className="flex-1 py-2.5 text-sm bg-transparent focus:outline-none dark:text-white placeholder-neutral-400" />
            </div>
          </div>

          <textarea
            value={form.cuerpo}
            onChange={e => setForm({ ...form, cuerpo: e.target.value })}
            placeholder="Escribe tu mensaje aqui..."
            rows={10}
            className="w-full px-3 py-3 border border-neutral-200 dark:border-white/10 rounded-lg text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white resize-none"
          />

          {firmaUsuario && (
            <div className="text-xs text-neutral-400 dark:text-white/30 border-t border-neutral-100 dark:border-white/8 pt-2">
              Firma incluida automaticamente
            </div>
          )}

          {adjuntos.length > 0 && (
            <div className="space-y-1.5">
              {adjuntos.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-neutral-50 dark:bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                    <span className="text-xs text-neutral-700 dark:text-white/70 truncate">{f.name}</span>
                    <span className="text-xs text-neutral-400">({(f.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button onClick={() => setAdjuntos(adjuntos.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-600 flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-neutral-200 dark:border-white/10 flex items-center justify-between">
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg cursor-pointer transition">
            <Paperclip className="w-4 h-4" />
            Adjuntar
            <input type="file" multiple onChange={e => { if (e.target.files) setAdjuntos([...adjuntos, ...Array.from(e.target.files)]); }} className="hidden" />
          </label>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-white/70 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 transition">
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50 transition font-medium"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function MisCorreos() {
  const { usuario } = useAuth();

  // connection state
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'not_configured' | 'error'>('checking');
  const [connectionError, setConnectionError] = useState('');

  // data
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [carpetaActiva, setCarpetaActiva] = useState<string>('inbox');
  const [emails, setEmails] = useState<Email[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  // ui state
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeInitial, setComposeInitial] = useState<Partial<ComposeData> | undefined>();
  const [firmaUsuario, setFirmaUsuario] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showSettings, setShowSettings] = useState(false);

  // ── Check if user has email configured ──────────────────────────────────────
  const checkConnection = useCallback(async () => {
    if (!usuario) return;
    setConnectionStatus('checking');
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('email_cuenta, email_password')
        .eq('id', usuario.id)
        .maybeSingle();

      if (!data?.email_cuenta || !data?.email_password) {
        setConnectionStatus('not_configured');
      } else {
        setConnectionStatus('connected');
      }
    } catch {
      setConnectionStatus('error');
      setConnectionError('No se pudo verificar la configuracion de correo.');
    }
  }, [usuario]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadCarpetas();
      loadFirma();
    }
  }, [connectionStatus, usuario]);

  useEffect(() => {
    if (connectionStatus === 'connected' && carpetaActiva) {
      loadEmails();
    }
  }, [carpetaActiva, connectionStatus]);

  const loadCarpetas = async () => {
    if (!usuario) return;
    const { data } = await supabase
      .from('carpetas_correo')
      .select('id, nombre, tipo_carpeta, total_mensajes, no_leidos, icono')
      .eq('usuario_id', usuario.id)
      .order('orden', { ascending: true });
    if (data) setCarpetas(data);
  };

  const loadFirma = async () => {
    if (!usuario) return;
    const { data } = await supabase
      .from('asignaciones_firma')
      .select('firmas_email(contenido_html)')
      .eq('usuario_id', usuario.id)
      .eq('activo', true)
      .maybeSingle();
    if (data?.firmas_email) {
      setFirmaUsuario((data.firmas_email as any).contenido_html);
    }
  };

  const loadEmails = async () => {
    if (!usuario) return;
    setLoadingEmails(true);
    const carpeta = carpetas.find(c => c.tipo_carpeta === carpetaActiva);
    if (!carpeta) { setLoadingEmails(false); return; }

    const { data } = await supabase
      .from('correos_usuario')
      .select('*')
      .eq('usuario_id', usuario.id)
      .eq('carpeta_id', carpeta.id)
      .order('fecha', { ascending: false })
      .limit(100);

    if (data) setEmails(data);
    setLoadingEmails(false);
  };

  const handleSync = async () => {
    if (!usuario) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      for (const folder of ['INBOX', 'SENT']) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sync-user-inbox`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ carpeta: folder, limite: 50 }),
          }
        );
        if (!res.ok) {
          const r = await res.json();
          if (r.error?.includes('no configuradas') || r.error?.includes('not configured')) {
            setConnectionStatus('not_configured');
            return;
          }
          throw new Error(r.error || 'Error al sincronizar');
        }
      }
      setSyncMessage({ type: 'success', text: 'Sincronizacion completada' });
      await loadCarpetas();
      await loadEmails();
    } catch (err: any) {
      setSyncMessage({ type: 'error', text: err.message || 'Error al sincronizar correos' });
    } finally {
      setSyncing(false);
    }
  };

  // Optimistic mark-as-read — no full reload
  const markAsRead = async (emailId: string) => {
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, leido: true } : e));
    setCarpetas(prev => prev.map(c => {
      if (c.tipo_carpeta === carpetaActiva && c.no_leidos > 0) {
        return { ...c, no_leidos: c.no_leidos - 1 };
      }
      return c;
    }));
    await supabase.from('correos_usuario').update({ leido: true }).eq('id', emailId);
  };

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
    if (!email.leido) markAsRead(email.id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const formatDateLong = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // Filtered + searched emails
  const filteredEmails = emails.filter(email => {
    const matchesSearch = !search || (
      email.asunto?.toLowerCase().includes(search.toLowerCase()) ||
      email.remitente_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      email.remitente_email?.toLowerCase().includes(search.toLowerCase()) ||
      sanitizeEmailPreview(email.cuerpo_html || email.cuerpo_texto || '').toLowerCase().includes(search.toLowerCase())
    );
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unread' && !email.leido) ||
      (filter === 'attachments' && email.tiene_adjuntos) ||
      (filter === 'starred' && email.marcado);
    return matchesSearch && matchesFilter;
  });

  const unreadCount = emails.filter(e => !e.leido).length;

  // ── Render states ────────────────────────────────────────────────────────────
  if (connectionStatus === 'checking') {
    return (
      <div className="bg-white dark:bg-neutral-800/50 rounded-2xl shadow-sm border border-neutral-200/60 dark:border-white/8 overflow-hidden">
        <div className="px-6 pt-6 pb-0">
          <PageHeader title="Mi Email" description="Sistema de correo completo" icon={Mail} />
        </div>
        <LoadingState text="Verificando conexion..." />
      </div>
    );
  }

  if (connectionStatus === 'not_configured' || showSettings) {
    return (
      <div className="bg-white dark:bg-neutral-800/50 rounded-2xl shadow-sm border border-neutral-200/60 dark:border-white/8 overflow-hidden">
        <div className="px-6 pt-6 pb-0">
          <PageHeader
            title="Mi Email"
            description="Sistema de correo completo"
            icon={Mail}
            actions={showSettings ? (
              <button onClick={() => setShowSettings(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition">
                <X className="w-4 h-4" /> Cancelar
              </button>
            ) : undefined}
          />
        </div>
        <ConnectEmailScreen onConnected={() => { setShowSettings(false); checkConnection(); }} />
      </div>
    );
  }

  if (connectionStatus === 'error') {
    return (
      <div className="bg-white dark:bg-neutral-800/50 rounded-2xl shadow-sm border border-neutral-200/60 dark:border-white/8 overflow-hidden">
        <div className="px-6 pt-6 pb-0">
          <PageHeader title="Mi Email" description="Sistema de correo completo" icon={Mail} />
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <WifiOff className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Error de conexion</p>
          <p className="text-sm text-neutral-500 dark:text-white/50 mb-6">{connectionError}</p>
          <Button onClick={checkConnection}>Reintentar</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-neutral-800/50 rounded-2xl shadow-sm border border-neutral-200/60 dark:border-white/8 overflow-hidden">
        <div className="px-6 pt-6 pb-0">
          <PageHeader
            title="Mi Email"
            description="Sistema de correo completo"
            icon={Mail}
            actions={
              <>
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition"
                  title="Configuracion de correo"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <Button onClick={handleSync} disabled={syncing} variant="outline">
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
                <Button onClick={() => { setComposeInitial(undefined); setShowCompose(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Redactar
                </Button>
              </>
            }
          />
        </div>

        {syncMessage && (
          <div className={`mx-6 mt-0 mb-4 px-4 py-3 rounded-lg flex items-center gap-2 text-sm ${
            syncMessage.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {syncMessage.type === 'success'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {syncMessage.text}
            <button onClick={() => setSyncMessage(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* 3-column layout */}
        <div className="flex" style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>

          {/* Column 1: Folders */}
          <div className="w-52 border-r border-neutral-200 dark:border-white/10 flex flex-col flex-shrink-0">
            <div className="p-3">
              <p className="text-xs font-semibold text-neutral-400 dark:text-white/30 uppercase px-2 mb-2">Carpetas</p>
              <div className="space-y-0.5">
                {carpetas.map(carpeta => {
                  const Icon = iconMap[carpeta.icono] || Folder;
                  const isActive = carpetaActiva === carpeta.tipo_carpeta;
                  return (
                    <button
                      key={carpeta.id}
                      onClick={() => { setCarpetaActiva(carpeta.tipo_carpeta); setSelectedEmail(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                          : 'text-neutral-700 dark:text-white/70 hover:bg-neutral-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{carpeta.nombre}</span>
                      </div>
                      {carpeta.no_leidos > 0 && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium leading-none">
                          {carpeta.no_leidos}
                        </span>
                      )}
                    </button>
                  );
                })}

                {carpetas.length === 0 && (
                  <div className="px-2 py-4 text-xs text-neutral-400 dark:text-white/30 text-center">
                    Sincroniza para ver carpetas
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Email list */}
          <div className={`flex flex-col border-r border-neutral-200 dark:border-white/10 ${selectedEmail ? 'w-80 flex-shrink-0' : 'flex-1'}`}>
            {/* Search + filter bar */}
            <div className="p-3 border-b border-neutral-100 dark:border-white/8 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar correos..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-1">
                {([
                  { key: 'all', label: 'Todos' },
                  { key: 'unread', label: 'No leidos' },
                  { key: 'attachments', label: 'Adjuntos' },
                  { key: 'starred', label: 'Marcados' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-2 py-1 text-xs rounded-md transition font-medium ${
                      filter === f.key
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'text-neutral-500 dark:text-white/40 hover:bg-neutral-100 dark:hover:bg-white/5'
                    }`}
                  >
                    {f.key === 'unread' && unreadCount > 0 ? `${f.label} (${unreadCount})` : f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loadingEmails ? (
                <LoadingState text="Cargando correos..." />
              ) : filteredEmails.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <Mail className="w-10 h-10 text-neutral-300 dark:text-white/20 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500 dark:text-white/40 mb-1">
                    {search ? 'No se encontraron resultados' : 'No hay correos en esta carpeta'}
                  </p>
                  {!search && carpetaActiva === 'inbox' && (
                    <button onClick={handleSync} className="mt-3 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">
                      Sincronizar ahora
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-white/8">
                  {filteredEmails.map(email => {
                    const isSelected = selectedEmail?.id === email.id;
                    const preview = sanitizeEmailPreview(email.cuerpo_html || email.cuerpo_texto || '');
                    return (
                      <button
                        key={email.id}
                        onClick={() => handleSelectEmail(email)}
                        className={`w-full text-left px-4 py-3.5 hover:bg-neutral-50 dark:hover:bg-white/3 transition group ${
                          isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {!email.leido && <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />}
                            <span className={`text-sm truncate ${!email.leido ? 'font-bold text-neutral-900 dark:text-white' : 'font-medium text-neutral-700 dark:text-white/80'}`}>
                              {email.remitente_nombre || email.remitente_email}
                            </span>
                          </div>
                          <span className="text-xs text-neutral-400 dark:text-white/30 flex-shrink-0">{formatDate(email.fecha)}</span>
                        </div>
                        <p className={`text-sm truncate mb-1 ${!email.leido ? 'font-semibold text-neutral-800 dark:text-white/90' : 'text-neutral-600 dark:text-white/70'}`}>
                          {email.asunto || '(Sin asunto)'}
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-white/40 line-clamp-1">
                          {preview.substring(0, 120)}
                        </p>
                        {email.tiene_adjuntos && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <Paperclip className="w-3 h-3 text-neutral-400" />
                            <span className="text-xs text-neutral-400">Adjuntos</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Reading pane */}
          {selectedEmail ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-neutral-100 dark:border-white/8 flex items-start justify-between gap-4 flex-shrink-0">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                    {selectedEmail.asunto || '(Sin asunto)'}
                  </h2>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight">
                          {selectedEmail.remitente_nombre || selectedEmail.remitente_email}
                        </p>
                        {selectedEmail.remitente_nombre && (
                          <p className="text-xs text-neutral-500 dark:text-white/50">{selectedEmail.remitente_email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-neutral-400 dark:text-white/40">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateLong(selectedEmail.fecha)}
                    </div>
                  </div>
                  {selectedEmail.destinatarios?.length > 0 && (
                    <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">
                      Para: {selectedEmail.destinatarios.join(', ')}
                    </p>
                  )}
                  {selectedEmail.cc && selectedEmail.cc.length > 0 && (
                    <p className="text-xs text-neutral-400 dark:text-white/40">
                      CC: {selectedEmail.cc.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      setComposeInitial({
                        para: selectedEmail.remitente_email,
                        asunto: `Re: ${selectedEmail.asunto || ''}`,
                        cuerpo: `\n\n--- Mensaje original ---\nDe: ${selectedEmail.remitente_nombre || selectedEmail.remitente_email}\nFecha: ${formatDateLong(selectedEmail.fecha)}\n\n${selectedEmail.cuerpo_texto || ''}`,
                      });
                      setShowCompose(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-700 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition"
                  >
                    <Reply className="w-4 h-4" /> Responder
                  </button>
                  <button
                    onClick={() => {
                      setComposeInitial({
                        para: '',
                        asunto: `Fwd: ${selectedEmail.asunto || ''}`,
                        cuerpo: `\n\n--- Mensaje reenviado ---\nDe: ${selectedEmail.remitente_nombre || selectedEmail.remitente_email}\nAsunto: ${selectedEmail.asunto || ''}\n\n${selectedEmail.cuerpo_texto || ''}`,
                      });
                      setShowCompose(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-700 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition"
                  >
                    <Forward className="w-4 h-4" /> Reenviar
                  </button>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                <div className="min-h-full">
                  <EmailBodyFrame
                    html={selectedEmail.cuerpo_html}
                    text={selectedEmail.cuerpo_texto}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Mail className="w-12 h-12 text-neutral-300 dark:text-white/20 mb-3" />
              <p className="text-sm text-neutral-400 dark:text-white/40">Selecciona un correo para leerlo</p>
            </div>
          )}
        </div>
      </div>

      {showCompose && (
        <ComposeModal
          initial={composeInitial}
          firmaUsuario={firmaUsuario}
          onClose={() => setShowCompose(false)}
          onSent={async () => {
            setShowCompose(false);
            setSyncMessage({ type: 'success', text: 'Correo enviado exitosamente' });
            await loadEmails();
          }}
        />
      )}
    </>
  );
}

export default MisCorreos;
