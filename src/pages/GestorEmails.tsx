import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Mail, Send, FileText, Trash2, AlertCircle, Inbox, Search, RefreshCw,
  Star, Paperclip, ChevronLeft, ChevronRight, Settings, Plus, Archive,
  MailOpen, Eye, EyeOff, FolderOpen, X, ArrowLeft
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';

interface ImapFolder {
  name: string;
  path: string;
  flags: string[];
  total: number;
  unseen: number;
}

interface EmailHeader {
  uid: number;
  messageId: string;
  from: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  subject: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  size: number;
}

interface EmailFull {
  uid: number;
  messageId: string;
  from: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  bodyHtml: string | null;
  bodyText: string | null;
  attachments: { filename: string; contentType: string; size: number; partId: string }[];
}

const FOLDER_META: Record<string, { label: string; icon: typeof Inbox }> = {
  'INBOX': { label: 'Bandeja de entrada', icon: Inbox },
  'Sent': { label: 'Enviados', icon: Send },
  'Drafts': { label: 'Borradores', icon: FileText },
  'Trash': { label: 'Papelera', icon: Trash2 },
  'Spam': { label: 'Spam', icon: AlertCircle },
  'Archive': { label: 'Archivo', icon: Archive },
  'Junk': { label: 'Spam', icon: AlertCircle },
};

function getFolderLabel(path: string): string {
  return FOLDER_META[path]?.label || path;
}

function getFolderIcon(path: string) {
  return FOLDER_META[path]?.icon || FolderOpen;
}

async function callWebmail(action: string, params: Record<string, unknown> = {}): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesion activa');

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ionos-webmail`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...params }),
    }
  );

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || data.message || 'Error del servidor');
  return data;
}

export function GestorEmails() {
  const { usuario } = useAuth();

  // Config state
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  const [configEmail, setConfigEmail] = useState('');
  const [showSetup, setShowSetup] = useState(false);

  // Folder state
  const [folders, setFolders] = useState<ImapFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState('INBOX');

  // Message list state
  const [messages, setMessages] = useState<EmailHeader[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Selected message state
  const [selectedMessage, setSelectedMessage] = useState<EmailFull | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);

  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'replyAll' | 'forward'>('new');

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmailHeader[] | null>(null);
  const [searching, setSearching] = useState(false);

  // General
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  // Check config on mount
  useEffect(() => {
    checkConfig();
  }, [usuario]);

  const checkConfig = async () => {
    if (!usuario) return;
    const { data } = await supabase
      .from('email_configuraciones')
      .select('email')
      .eq('usuario_id', usuario.id)
      .eq('activa', true)
      .maybeSingle();

    if (data) {
      setHasConfig(true);
      setConfigEmail(data.email);
      loadFolders();
    } else {
      setHasConfig(false);
      setShowSetup(true);
      setInitialLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const data = await callWebmail('list-folders');
      setFolders(data);
      setInitialLoading(false);
      loadMessages('INBOX', 1);
    } catch (err: any) {
      setError(err.message);
      setInitialLoading(false);
    }
  };

  const loadMessages = useCallback(async (folder?: string, p?: number) => {
    const f = folder || currentFolder;
    const pg = p || page;
    setLoadingMessages(true);
    setError('');
    setSearchResults(null);
    try {
      const data = await callWebmail('list-messages', { folder: f, page: pg, perPage });
      setMessages(data.messages || []);
      setTotalMessages(data.total || 0);
      if (folder) setCurrentFolder(f);
      if (p) setPage(pg);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingMessages(false);
    }
  }, [currentFolder, page, perPage]);

  const openMessage = async (uid: number) => {
    setLoadingMessage(true);
    setError('');
    try {
      const data = await callWebmail('get-message', { uid, folder: currentFolder });
      setSelectedMessage(data);
      // Mark as read locally
      setMessages(prev => prev.map(m => m.uid === uid ? { ...m, seen: true } : m));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingMessage(false);
    }
  };

  const handleMarkRead = async (uid: number, read: boolean) => {
    try {
      await callWebmail('mark-read', { uid, folder: currentFolder, read });
      setMessages(prev => prev.map(m => m.uid === uid ? { ...m, seen: read } : m));
      if (selectedMessage?.uid === uid) setSelectedMessage({ ...selectedMessage, seen: read });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (uid: number) => {
    try {
      await callWebmail('delete-message', { uid, folder: currentFolder });
      setMessages(prev => prev.filter(m => m.uid !== uid));
      if (selectedMessage?.uid === uid) setSelectedMessage(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError('');
    try {
      const data = await callWebmail('search', { query: searchQuery, folder: currentFolder, maxResults: 50 });
      setSearchResults(data.messages || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleRefresh = () => {
    loadFolders();
    loadMessages(currentFolder, page);
  };

  const totalPages = Math.ceil(totalMessages / perPage);
  const displayMessages = searchResults ?? messages;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      }
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    } catch { return dateStr; }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Setup screen ─────────────────────────────────────────────
  if (showSetup || hasConfig === false) {
    return <SetupScreen onSuccess={() => { setShowSetup(false); checkConfig(); }} onClose={() => setShowSetup(false)} />;
  }

  if (initialLoading) {
    return <LoadingState text="Conectando con el servidor de correo..." className="min-h-screen" />;
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-white/10 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Mail className="w-7 h-7 text-accent" />
          <div>
            <h1 className="text-xl font-display font-bold text-accent">Mi E-Mail</h1>
            <p className="text-xs text-neutral-500 dark:text-white/50">{configEmail}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative hidden md:block">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar correos..."
              className="w-64 pl-9 pr-3 py-2 text-sm bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {searchResults && (
              <button
                onClick={() => { setSearchResults(null); setSearchQuery(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={loadingMessages}
            className="p-2 text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`w-5 h-5 ${loadingMessages ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowSetup(true)}
            className="p-2 text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-all"
            title="Configuracion"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            onClick={() => { setShowCompose(true); setComposeMode('new'); }}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-all font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Redactar</span>
          </button>
        </div>
      </header>

      {/* Error bar */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/30 px-4 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Folders sidebar */}
        <aside className="w-56 bg-white dark:bg-neutral-800/50 border-r border-neutral-200 dark:border-white/10 overflow-y-auto flex-shrink-0 hidden md:block">
          <nav className="p-3 space-y-0.5">
            {folders.map((f) => {
              const Icon = getFolderIcon(f.path);
              const isActive = currentFolder === f.path && !searchResults;
              return (
                <button
                  key={f.path}
                  onClick={() => { setSelectedMessage(null); setSearchResults(null); setPage(1); loadMessages(f.path, 1); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-accent/10 text-accent font-semibold'
                      : 'text-neutral-700 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span className="truncate">{getFolderLabel(f.path)}</span>
                  </div>
                  {f.unseen > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      isActive ? 'bg-accent text-white' : 'bg-neutral-200 dark:bg-white/10 text-neutral-600 dark:text-white/60'
                    }`}>
                      {f.unseen}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Message list OR Reading pane */}
        {selectedMessage ? (
          // Reading pane
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-white/10 flex items-center gap-3 bg-white dark:bg-neutral-800/50 flex-shrink-0">
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-all"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-white/60" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-neutral-900 dark:text-white truncate">
                  {selectedMessage.subject || '(Sin asunto)'}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleMarkRead(selectedMessage.uid, !selectedMessage.seen)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-all"
                  title={selectedMessage.seen ? 'Marcar como no leido' : 'Marcar como leido'}
                >
                  {selectedMessage.seen ? <EyeOff className="w-4 h-4 text-neutral-500" /> : <Eye className="w-4 h-4 text-neutral-500" />}
                </button>
                <button
                  onClick={() => handleDelete(selectedMessage.uid)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingMessage ? (
                <LoadingState text="Cargando mensaje..." className="h-full" />
              ) : (
                <div className="max-w-4xl mx-auto p-6">
                  {/* Message metadata */}
                  <div className="mb-6 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-white">{selectedMessage.from}</p>
                        <p className="text-sm text-neutral-500 dark:text-white/50">&lt;{selectedMessage.fromEmail}&gt;</p>
                      </div>
                      <p className="text-sm text-neutral-500 dark:text-white/50 flex-shrink-0">
                        {new Date(selectedMessage.date).toLocaleString('es-MX', {
                          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {selectedMessage.to.length > 0 && (
                      <p className="text-sm text-neutral-600 dark:text-white/60">
                        <span className="font-medium">Para:</span> {selectedMessage.to.join(', ')}
                      </p>
                    )}
                    {selectedMessage.cc.length > 0 && (
                      <p className="text-sm text-neutral-600 dark:text-white/60">
                        <span className="font-medium">CC:</span> {selectedMessage.cc.join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Attachments */}
                  {selectedMessage.attachments.length > 0 && (
                    <div className="mb-4 p-3 bg-neutral-50 dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10">
                      <p className="text-xs font-medium text-neutral-500 dark:text-white/50 mb-2 flex items-center gap-1">
                        <Paperclip className="w-3.5 h-3.5" />
                        {selectedMessage.attachments.length} adjunto{selectedMessage.attachments.length !== 1 ? 's' : ''}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedMessage.attachments.map((att, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-md text-xs text-neutral-700 dark:text-white/70">
                            <FileText className="w-3.5 h-3.5" />
                            {att.filename}
                            <span className="text-neutral-400">({formatSize(att.size)})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Body */}
                  <div className="border border-neutral-200 dark:border-white/10 rounded-lg overflow-hidden bg-white dark:bg-neutral-800/50">
                    {selectedMessage.bodyHtml ? (
                      <iframe
                        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;line-height:1.6;color:#333;margin:16px;word-break:break-word}img{max-width:100%}a{color:#0066cc}</style></head><body>${selectedMessage.bodyHtml}</body></html>`}
                        className="w-full min-h-[400px] border-0"
                        sandbox="allow-same-origin"
                        title="Contenido del correo"
                      />
                    ) : (
                      <pre className="p-4 whitespace-pre-wrap text-sm text-neutral-700 dark:text-white/70 font-sans">
                        {selectedMessage.bodyText}
                      </pre>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => { setComposeMode('reply'); setShowCompose(true); }}
                      className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all text-sm font-medium"
                    >
                      Responder
                    </button>
                    <button
                      onClick={() => { setComposeMode('replyAll'); setShowCompose(true); }}
                      className="px-4 py-2 border border-neutral-300 dark:border-white/15 text-neutral-700 dark:text-white/70 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 transition-all text-sm"
                    >
                      Responder a todos
                    </button>
                    <button
                      onClick={() => { setComposeMode('forward'); setShowCompose(true); }}
                      className="px-4 py-2 border border-neutral-300 dark:border-white/15 text-neutral-700 dark:text-white/70 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 transition-all text-sm"
                    >
                      Reenviar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Message list
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* List header */}
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-white dark:bg-neutral-800/50 flex-shrink-0">
              <div>
                <h2 className="font-semibold text-neutral-900 dark:text-white">
                  {searchResults ? `Resultados: "${searchQuery}"` : getFolderLabel(currentFolder)}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-white/50">
                  {searchResults
                    ? `${searchResults.length} encontrados`
                    : `${totalMessages} mensaje${totalMessages !== 1 ? 's' : ''}`
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); loadMessages(currentFolder, 1); }}
                  className="text-xs px-2 py-1.5 border border-neutral-200 dark:border-white/10 rounded-md bg-white dark:bg-neutral-800 text-neutral-700 dark:text-white/70"
                >
                  <option value={25}>25 por pagina</option>
                  <option value={50}>50 por pagina</option>
                  <option value={100}>100 por pagina</option>
                </select>
                {!searchResults && totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setPage(p => Math.max(1, p - 1)); loadMessages(currentFolder, Math.max(1, page - 1)); }}
                      disabled={page <= 1}
                      className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-neutral-500 dark:text-white/50 min-w-[60px] text-center">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => { setPage(p => Math.min(totalPages, p + 1)); loadMessages(currentFolder, Math.min(totalPages, page + 1)); }}
                      disabled={page >= totalPages}
                      className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded disabled:opacity-30 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              {loadingMessages ? (
                <LoadingState text="Cargando mensajes..." className="h-full" />
              ) : displayMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Mail className="w-12 h-12 text-neutral-300 dark:text-white/20 mx-auto mb-3" />
                    <p className="text-neutral-500 dark:text-white/50 text-sm">
                      {searchResults ? 'Sin resultados' : 'No hay mensajes en esta carpeta'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-white/5">
                  {displayMessages.map((msg) => (
                    <div
                      key={msg.uid}
                      onClick={() => openMessage(msg.uid)}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all group ${
                        !msg.seen
                          ? 'bg-accent/5 dark:bg-accent/10 hover:bg-accent/10 dark:hover:bg-accent/15'
                          : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {/* Unread indicator */}
                      <div className="w-2 flex-shrink-0">
                        {!msg.seen && <div className="w-2 h-2 rounded-full bg-accent" />}
                      </div>

                      {/* Sender */}
                      <div className="w-44 flex-shrink-0 truncate">
                        <span className={`text-sm ${!msg.seen ? 'font-semibold text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-white/70'}`}>
                          {msg.from || msg.fromEmail}
                        </span>
                      </div>

                      {/* Subject + preview */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className={`text-sm truncate ${!msg.seen ? 'font-semibold text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-white/70'}`}>
                          {msg.subject || '(Sin asunto)'}
                        </span>
                        {msg.hasAttachments && <Paperclip className="w-3.5 h-3.5 text-neutral-400 dark:text-white/40 flex-shrink-0" />}
                      </div>

                      {/* Date */}
                      <span className="text-xs text-neutral-500 dark:text-white/50 flex-shrink-0 w-16 text-right">
                        {formatDate(msg.date)}
                      </span>

                      {/* Actions on hover */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkRead(msg.uid, !msg.seen); }}
                          className="p-1.5 hover:bg-neutral-200 dark:hover:bg-white/10 rounded transition-all"
                          title={msg.seen ? 'Marcar no leido' : 'Marcar leido'}
                        >
                          {msg.seen ? <MailOpen className="w-3.5 h-3.5 text-neutral-500" /> : <Eye className="w-3.5 h-3.5 text-neutral-500" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(msg.uid); }}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          mode={composeMode}
          replyTo={selectedMessage}
          onClose={() => setShowCompose(false)}
          onSent={() => { setShowCompose(false); handleRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Setup Screen ─────────────────────────────────────────────────

function SetupScreen({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const { usuario } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  const handleVerify = async () => {
    if (!email || !password) { setError('Ingresa correo y contrasena'); return; }
    setVerifying(true);
    setError('');
    try {
      // Save config first
      await supabase
        .from('email_configuraciones')
        .upsert({
          usuario_id: usuario!.id,
          email,
          password,
          activa: true,
        }, { onConflict: 'usuario_id' });

      // Test connection
      const result = await callWebmail('verify-connection');
      if (result.success) {
        setVerified(true);
      } else {
        throw new Error(result.error || 'Credenciales incorrectas');
      }
    } catch (err: any) {
      setError(err.message);
      // Remove bad config
      await supabase.from('email_configuraciones').delete().eq('usuario_id', usuario!.id);
    } finally {
      setVerifying(false);
    }
  };

  const handleContinue = () => {
    onSuccess();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-lg max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-display font-bold text-neutral-900 dark:text-white">Configura tu correo IONOS</h1>
          <p className="text-sm text-neutral-500 dark:text-white/50 mt-2">
            Ingresa tus credenciales para acceder a tu buzon de correo
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}

        {verified ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="font-semibold text-neutral-900 dark:text-white">Conexion exitosa</p>
            <p className="text-sm text-neutral-500 dark:text-white/50">Tu cuenta {email} esta lista para usar</p>
            <button
              onClick={handleContinue}
              className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent-hover transition-all"
            >
              Ir a mi correo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1.5">Correo electronico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 text-neutral-900 dark:text-white"
                placeholder="nombre@jiro.mx"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1.5">Contrasena</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 text-neutral-900 dark:text-white"
                placeholder="Tu contrasena de IONOS"
              />
            </div>
            <div className="bg-neutral-50 dark:bg-white/5 rounded-lg p-3 text-xs text-neutral-500 dark:text-white/50 space-y-1">
              <p>Servidores preconfigurados:</p>
              <p>IMAP: imap.ionos.mx:993 (SSL/TLS)</p>
              <p>SMTP: smtp.ionos.mx:465 (SSL/TLS)</p>
            </div>
            <button
              onClick={handleVerify}
              disabled={verifying || !email || !password}
              className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent-hover transition-all disabled:opacity-50"
            >
              {verifying ? 'Verificando conexion...' : 'Verificar y conectar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Compose Modal ────────────────────────────────────────────────

function ComposeModal({ mode, replyTo, onClose, onSent }: {
  mode: 'new' | 'reply' | 'replyAll' | 'forward';
  replyTo: EmailFull | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showCc, setShowCc] = useState(false);

  useEffect(() => {
    if (!replyTo) return;
    if (mode === 'reply') {
      setTo(replyTo.fromEmail);
      setSubject(`Re: ${replyTo.subject}`);
    } else if (mode === 'replyAll') {
      setTo(replyTo.fromEmail);
      setCc([...replyTo.to, ...replyTo.cc].filter(Boolean).join(', '));
      setShowCc(true);
      setSubject(`Re: ${replyTo.subject}`);
    } else if (mode === 'forward') {
      setSubject(`Fwd: ${replyTo.subject}`);
      setBodyHtml(`\n\n---------- Mensaje reenviado ----------\nDe: ${replyTo.from} <${replyTo.fromEmail}>\nFecha: ${replyTo.date}\nAsunto: ${replyTo.subject}\n\n${replyTo.bodyText || ''}`);
    }
  }, [mode, replyTo]);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      setError('Destinatario y asunto son requeridos');
      return;
    }
    setSending(true);
    setError('');
    try {
      await callWebmail('send-message', {
        to: to.split(',').map(s => s.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map(s => s.trim()).filter(Boolean) : [],
        bcc: [],
        subject,
        bodyHtml: bodyHtml || `<p>${subject}</p>`,
        bodyText: bodyHtml.replace(/<[^>]*>/g, '') || subject,
      });
      onSent();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
            {mode === 'new' ? 'Nuevo correo' : mode === 'forward' ? 'Reenviar' : 'Responder'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-all">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-600 dark:text-white/60 w-12">Para:</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 px-3 py-2 border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm text-neutral-900 dark:text-white"
              placeholder="email@ejemplo.com"
            />
            {!showCc && (
              <button onClick={() => setShowCc(true)} className="text-xs text-accent hover:text-accent-hover">CC</button>
            )}
          </div>

          {showCc && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-neutral-600 dark:text-white/60 w-12">CC:</label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="flex-1 px-3 py-2 border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm text-neutral-900 dark:text-white"
                placeholder="cc@ejemplo.com"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-600 dark:text-white/60 w-12">Asunto:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 px-3 py-2 border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm text-neutral-900 dark:text-white"
              placeholder="Asunto del correo"
            />
          </div>

          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={14}
            className="w-full px-4 py-3 border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm text-neutral-900 dark:text-white resize-none"
            placeholder="Escribe tu mensaje..."
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-200 dark:border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-700 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-all text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all text-sm font-medium disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
