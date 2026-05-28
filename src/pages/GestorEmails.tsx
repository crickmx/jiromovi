import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getRenderedSignature, stripExistingSignature } from '../lib/emailSignatureUtils';
import {
  Mail, Send, FileText, Trash2, AlertCircle, Inbox, Search, RefreshCw,
  Paperclip, ChevronLeft, ChevronRight, Settings, Plus, Archive,
  MailOpen, Eye, EyeOff, FolderOpen, X, ArrowLeft, Reply, ReplyAll,
  Forward, Download, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────

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

// ── Constants ───────────────────────────────────────────────────────

const FOLDER_META: Record<string, { label: string; icon: typeof Inbox }> = {
  'INBOX': { label: 'Entrada', icon: Inbox },
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

// ── API Helper ──────────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
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
}

function formatFullDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch { return dateStr; }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase() || '?';
}

// ── Main Component ──────────────────────────────────────────────────

export function GestorEmails() {
  const { usuario } = useAuth();

  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  const [configEmail, setConfigEmail] = useState('');
  const [showSetup, setShowSetup] = useState(false);

  const [folders, setFolders] = useState<ImapFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState('INBOX');

  const [messages, setMessages] = useState<EmailHeader[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(30);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [selectedMessage, setSelectedMessage] = useState<EmailFull | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);

  const [showCompose, setShowCompose] = useState(false);
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'replyAll' | 'forward'>('new');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmailHeader[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  // Mobile: show reading pane full screen
  const [mobileShowReading, setMobileShowReading] = useState(false);

  useEffect(() => { checkConfig(); }, [usuario]);

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
      setMobileShowReading(true);
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
      if (selectedMessage?.uid === uid) {
        setSelectedMessage(null);
        setMobileShowReading(false);
      }
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

  // ── Setup / Loading screens ────────────────────────────────────────
  if (showSetup || hasConfig === false) {
    return <SetupScreen onSuccess={() => { setShowSetup(false); checkConfig(); }} />;
  }

  if (initialLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center animate-pulse">
            <Mail className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Conectando...</p>
        </div>
      </div>
    );
  }

  // ── 3-Column Layout ────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-900 overflow-hidden">
      {/* Top Bar */}
      <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <Mail className="w-5 h-5 text-accent flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-neutral-800 dark:text-white truncate">Mi E-Mail</h1>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate hidden sm:inline">{configEmail}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar..."
            className="w-48 lg:w-56 pl-8 pr-8 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-accent/50 transition"
          />
          {(searchResults || searching) && (
            <button
              onClick={() => { setSearchResults(null); setSearchQuery(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={loadingMessages}
          className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition disabled:opacity-40"
          title="Actualizar"
        >
          <RefreshCw className={cn('w-4 h-4', loadingMessages && 'animate-spin')} />
        </button>

        <button
          onClick={() => setShowSetup(true)}
          className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition"
          title="Configuracion"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={() => { setShowCompose(true); setComposeMode('new'); }}
          className="flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-lg hover:bg-accent/90 transition font-medium text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Redactar</span>
        </button>
      </header>

      {/* Error bar */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/30 px-4 py-1.5 flex items-center gap-2 flex-shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-300 flex-1 truncate">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Main 3-column area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Column 1: Folders */}
        <aside className="w-48 lg:w-52 bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 overflow-y-auto flex-shrink-0 hidden md:flex flex-col">
          <nav className="p-2 space-y-0.5 flex-1">
            {folders.map((f) => {
              const Icon = getFolderIcon(f.path);
              const isActive = currentFolder === f.path && !searchResults;
              return (
                <button
                  key={f.path}
                  onClick={() => {
                    setSelectedMessage(null);
                    setSearchResults(null);
                    setPage(1);
                    loadMessages(f.path, 1);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all',
                    isActive
                      ? 'bg-accent/10 text-accent font-semibold'
                      : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{getFolderLabel(f.path)}</span>
                  </div>
                  {f.unseen > 0 && (
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0',
                      isActive ? 'bg-accent text-white' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                    )}>
                      {f.unseen}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Column 2: Message List */}
        <div className={cn(
          'w-full md:w-80 lg:w-96 flex flex-col border-r border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 flex-shrink-0',
          mobileShowReading && 'hidden md:flex'
        )}>
          {/* List header */}
          <div className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-xs font-bold text-neutral-800 dark:text-white">
                {searchResults ? `"${searchQuery}"` : getFolderLabel(currentFolder)}
              </h2>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                {searchResults
                  ? `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''}`
                  : `${totalMessages} mensaje${totalMessages !== 1 ? 's' : ''}`
                }
              </p>
            </div>
            {!searchResults && totalPages > 1 && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => { const p = Math.max(1, page - 1); setPage(p); loadMessages(currentFolder, p); }}
                  disabled={page <= 1}
                  className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded disabled:opacity-30 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 min-w-[36px] text-center tabular-nums">
                  {page}/{totalPages}
                </span>
                <button
                  onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); loadMessages(currentFolder, p); }}
                  disabled={page >= totalPages}
                  className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded disabled:opacity-30 transition"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Message rows */}
          <div className="flex-1 overflow-y-auto">
            {loadingMessages ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-700 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-neutral-100 dark:bg-neutral-700 rounded w-3/4" />
                      <div className="h-2.5 bg-neutral-100 dark:bg-neutral-700 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center mb-2">
                  <Mail className="w-5 h-5 text-neutral-300 dark:text-neutral-500" />
                </div>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {searchResults ? 'Sin resultados' : 'Carpeta vacia'}
                </p>
              </div>
            ) : (
              <div className="py-1">
                {displayMessages.map((msg) => {
                  const isActive = selectedMessage?.uid === msg.uid;
                  return (
                    <button
                      key={msg.uid}
                      onClick={() => openMessage(msg.uid)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-all group',
                        isActive
                          ? 'bg-accent/8 dark:bg-accent/15'
                          : !msg.seen
                          ? 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/30'
                      )}
                    >
                      {/* Avatar */}
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                        isActive ? 'bg-accent/20 text-accent' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                      )}>
                        {getInitials(msg.from || msg.fromEmail)}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Row 1: Sender + Date */}
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={cn(
                            'text-xs truncate',
                            !msg.seen ? 'font-bold text-neutral-900 dark:text-white' : 'font-medium text-neutral-600 dark:text-neutral-300'
                          )}>
                            {msg.from || msg.fromEmail}
                          </span>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 flex-shrink-0 tabular-nums">
                            {formatDate(msg.date)}
                          </span>
                        </div>
                        {/* Row 2: Subject */}
                        <div className="flex items-center gap-1.5">
                          {!msg.seen && <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                          <span className={cn(
                            'text-[11px] truncate',
                            !msg.seen ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-500 dark:text-neutral-400'
                          )}>
                            {msg.subject || '(Sin asunto)'}
                          </span>
                          {msg.hasAttachments && <Paperclip className="w-3 h-3 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Reading Pane */}
        <div className={cn(
          'flex-1 flex flex-col bg-white dark:bg-neutral-900 overflow-hidden',
          !mobileShowReading && !selectedMessage && 'hidden md:flex',
          mobileShowReading && 'flex'
        )}>
          {selectedMessage ? (
            <ReadingPane
              message={selectedMessage}
              loading={loadingMessage}
              onBack={() => { setSelectedMessage(null); setMobileShowReading(false); }}
              onMarkRead={(read) => handleMarkRead(selectedMessage.uid, read)}
              onDelete={() => handleDelete(selectedMessage.uid)}
              onReply={() => { setComposeMode('reply'); setShowCompose(true); }}
              onReplyAll={() => { setComposeMode('replyAll'); setShowCompose(true); }}
              onForward={() => { setComposeMode('forward'); setShowCompose(true); }}
              currentFolder={currentFolder}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-7 h-7 text-neutral-300 dark:text-neutral-600" />
                </div>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Selecciona un mensaje</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">para ver su contenido</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          mode={composeMode}
          replyTo={selectedMessage}
          onClose={() => setShowCompose(false)}
          onSent={() => { setShowCompose(false); handleRefresh(); }}
          usuarioId={usuario?.id}
          configEmail={configEmail}
        />
      )}
    </div>
  );
}

// ── Reading Pane ────────────────────────────────────────────────────

function ReadingPane({
  message, loading, onBack, onMarkRead, onDelete, onReply, onReplyAll, onForward, currentFolder,
}: {
  message: EmailFull;
  loading: boolean;
  onBack: () => void;
  onMarkRead: (read: boolean) => void;
  onDelete: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  currentFolder: string;
}) {
  const [showFullHeaders, setShowFullHeaders] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current && message.bodyHtml) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; color: #333; margin: 20px; word-break: break-word; }
          img { max-width: 100%; height: auto; }
          a { color: #0066cc; }
          table { max-width: 100% !important; }
          @media (prefers-color-scheme: dark) { body { color: #e0e0e0; background: #1a1a1a; } a { color: #66b3ff; } }
        </style></head><body>${message.bodyHtml}</body></html>`);
        doc.close();
        // Auto-resize iframe
        setTimeout(() => {
          if (iframeRef.current?.contentDocument?.body) {
            iframeRef.current.style.height = `${iframeRef.current.contentDocument.body.scrollHeight + 40}px`;
          }
        }, 200);
      }
    }
  }, [message.bodyHtml]);

  const handleDownloadAttachment = async (att: { filename: string; partId: string }) => {
    try {
      const data = await callWebmail('download-attachment', {
        uid: message.uid,
        folder: currentFolder,
        partId: att.partId,
      });
      if (data.content) {
        const binaryStr = atob(data.content);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: data.contentType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = att.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center animate-pulse">
            <Mail className="w-4 h-4 text-accent" />
          </div>
          <p className="text-xs text-neutral-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Reading pane header */}
      <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center gap-2 flex-shrink-0 bg-neutral-50/50 dark:bg-neutral-800/30">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition md:hidden"
        >
          <ArrowLeft className="w-4 h-4 text-neutral-500" />
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-neutral-800 dark:text-white truncate">
            {message.subject || '(Sin asunto)'}
          </h2>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => onMarkRead(!message.seen)} className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition" title={message.seen ? 'Marcar no leido' : 'Marcar leido'}>
            {message.seen ? <EyeOff className="w-4 h-4 text-neutral-400" /> : <Eye className="w-4 h-4 text-neutral-400" />}
          </button>
          <button onClick={onDelete} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition" title="Eliminar">
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* Message content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 lg:p-6">
          {/* Sender info */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent flex-shrink-0">
              {getInitials(message.from)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-800 dark:text-white truncate">{message.from}</p>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">{message.fromEmail}</p>
                </div>
                <span className="text-[11px] text-neutral-400 dark:text-neutral-500 flex-shrink-0 whitespace-nowrap">
                  {formatFullDate(message.date)}
                </span>
              </div>

              {/* Recipients */}
              <button
                onClick={() => setShowFullHeaders(!showFullHeaders)}
                className="flex items-center gap-1 mt-1 text-[11px] text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition"
              >
                <span>Para: {message.to.slice(0, 2).join(', ')}{message.to.length > 2 ? ` +${message.to.length - 2}` : ''}</span>
                {showFullHeaders ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showFullHeaders && (
                <div className="mt-1.5 pl-0 space-y-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                  <p><span className="font-medium">Para:</span> {message.to.join(', ')}</p>
                  {message.cc.length > 0 && <p><span className="font-medium">CC:</span> {message.cc.join(', ')}</p>}
                  {message.bcc.length > 0 && <p><span className="font-medium">CCO:</span> {message.bcc.join(', ')}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          {message.attachments.length > 0 && (
            <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-700/50">
              <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Paperclip className="w-3 h-3" />
                {message.attachments.length} adjunto{message.attachments.length !== 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {message.attachments.map((att, i) => (
                  <button
                    key={i}
                    onClick={() => handleDownloadAttachment(att)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-[11px] text-neutral-700 dark:text-neutral-200 hover:border-accent/50 hover:bg-accent/5 transition group"
                  >
                    <FileText className="w-3 h-3 text-neutral-400 group-hover:text-accent" />
                    <span className="truncate max-w-[120px]">{att.filename}</span>
                    <span className="text-neutral-300 dark:text-neutral-500">({formatSize(att.size)})</span>
                    <Download className="w-3 h-3 text-neutral-300 group-hover:text-accent" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Email body */}
          <div className="rounded-xl border border-neutral-100 dark:border-neutral-700/50 overflow-hidden bg-white dark:bg-neutral-800">
            {message.bodyHtml ? (
              <iframe
                ref={iframeRef}
                className="w-full min-h-[300px] border-0"
                sandbox="allow-same-origin"
                title="Contenido del correo"
              />
            ) : message.bodyText ? (
              <pre className="p-4 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300 font-sans leading-relaxed">
                {message.bodyText}
              </pre>
            ) : (
              <div className="p-6 text-center text-neutral-400 dark:text-neutral-500">
                <MailOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Este mensaje no tiene contenido visible.</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={onReply} className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition text-xs font-medium">
              <Reply className="w-3.5 h-3.5" /> Responder
            </button>
            <button onClick={onReplyAll} className="flex items-center gap-1.5 px-3.5 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition text-xs font-medium">
              <ReplyAll className="w-3.5 h-3.5" /> Responder a todos
            </button>
            <button onClick={onForward} className="flex items-center gap-1.5 px-3.5 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition text-xs font-medium">
              <Forward className="w-3.5 h-3.5" /> Reenviar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Setup Screen ────────────────────────────────────────────────────

function SetupScreen({ onSuccess }: { onSuccess: () => void }) {
  const { usuario } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  const handleVerify = async () => {
    if (!email || !password) { setError('Ingresa correo y contrasena'); return; }
    setVerifying(true);
    setError('');
    try {
      await supabase
        .from('email_configuraciones')
        .upsert({
          usuario_id: usuario!.id,
          email,
          password,
          activa: true,
        }, { onConflict: 'usuario_id' });

      const result = await callWebmail('verify-connection');
      if (result.success) {
        setVerified(true);
      } else {
        throw new Error(result.error || 'Credenciales incorrectas');
      }
    } catch (err: any) {
      setError(err.message);
      await supabase.from('email_configuraciones').delete().eq('usuario_id', usuario!.id);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-lg max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Configura tu correo</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            Ingresa tus credenciales IONOS
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
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Tu cuenta {email} esta lista</p>
            <button
              onClick={onSuccess}
              className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition"
            >
              Ir a mi correo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Correo electronico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 text-neutral-900 dark:text-white text-sm"
                placeholder="nombre@jiro.mx"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Contrasena</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 text-neutral-900 dark:text-white text-sm"
                placeholder="Tu contrasena de IONOS"
              />
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-lg p-3 text-[11px] text-neutral-500 dark:text-neutral-400 space-y-0.5">
              <p className="font-medium">Servidores preconfigurados:</p>
              <p>IMAP: imap.ionos.mx:993 (SSL/TLS)</p>
              <p>SMTP: smtp.ionos.mx:465 (SSL/TLS)</p>
            </div>
            <button
              onClick={handleVerify}
              disabled={verifying || !email || !password}
              className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition disabled:opacity-50"
            >
              {verifying ? 'Verificando...' : 'Verificar y conectar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Compose Modal ───────────────────────────────────────────────────

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB per file
const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20 MB total

interface AttachmentFile {
  file: File;
  base64: string;
}

function ComposeModal({ mode, replyTo, onClose, onSent, usuarioId, configEmail: senderEmail }: {
  mode: 'new' | 'reply' | 'replyAll' | 'forward';
  replyTo: EmailFull | null;
  onClose: () => void;
  onSent: () => void;
  usuarioId?: string;
  configEmail?: string;
}) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [signatureHtml, setSignatureHtml] = useState('');
  const [signatureLoading, setSignatureLoading] = useState(true);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [attachError, setAttachError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!replyTo) return;
    if (mode === 'reply') {
      setTo(replyTo.fromEmail);
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
    } else if (mode === 'replyAll') {
      setTo(replyTo.fromEmail);
      const others = [...replyTo.to, ...replyTo.cc]
        .filter(Boolean)
        .filter(e => e !== senderEmail && !e.includes(senderEmail || '__none__'));
      if (others.length > 0) {
        setCc(others.join(', '));
        setShowCc(true);
      }
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
    } else if (mode === 'forward') {
      setSubject(replyTo.subject.startsWith('Fwd:') ? replyTo.subject : `Fwd: ${replyTo.subject}`);
      const quoted = replyTo.bodyText || (replyTo.bodyHtml ? replyTo.bodyHtml.replace(/<[^>]*>/g, '') : '');
      setBodyHtml(`\n\n---------- Mensaje reenviado ----------\nDe: ${replyTo.from} <${replyTo.fromEmail}>\nFecha: ${replyTo.date}\nAsunto: ${replyTo.subject}\n\n${quoted}`);
    }
  }, [mode, replyTo, senderEmail]);

  // Load signature
  useEffect(() => {
    if (!usuarioId) { setSignatureLoading(false); return; }
    setSignatureLoading(true);
    getRenderedSignature(usuarioId).then(sig => {
      if (sig) setSignatureHtml(sig);
      setSignatureLoading(false);
    }).catch(() => setSignatureLoading(false));
  }, [usuarioId]);

  const totalAttachmentSize = attachments.reduce((sum, a) => sum + a.file.size, 0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAttachError('');

    const newAttachments: AttachmentFile[] = [];
    let newTotalSize = totalAttachmentSize;

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        setAttachError(`"${file.name}" excede el limite de ${formatSize(MAX_FILE_SIZE)} por archivo.`);
        continue;
      }
      newTotalSize += file.size;
      if (newTotalSize > MAX_TOTAL_SIZE) {
        setAttachError(`El total de adjuntos excede ${formatSize(MAX_TOTAL_SIZE)}.`);
        break;
      }
      const base64 = await fileToBase64(file);
      newAttachments.push({ file, base64 });
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setAttachError('');
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      setError('Destinatario y asunto son requeridos');
      return;
    }
    setSending(true);
    setError('');
    try {
      let finalBody = bodyHtml || '';

      // Append signature if available
      if (signatureHtml) {
        finalBody = stripExistingSignature(finalBody);
        finalBody = `${finalBody}\n<br/>\n${signatureHtml}`;
      }

      const htmlContent = finalBody.includes('<') ? finalBody : `<p>${finalBody.replace(/\n/g, '<br/>')}</p>`;

      const payload: Record<string, unknown> = {
        to: to.split(',').map(s => s.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map(s => s.trim()).filter(Boolean) : [],
        bcc: bcc ? bcc.split(',').map(s => s.trim()).filter(Boolean) : [],
        subject,
        bodyHtml: htmlContent,
        bodyText: finalBody.replace(/<[^>]*>/g, ''),
      };

      // Add threading headers for replies
      if ((mode === 'reply' || mode === 'replyAll') && replyTo?.messageId) {
        payload.inReplyTo = replyTo.messageId;
        payload.references = replyTo.messageId;
      }

      // Add attachments
      if (attachments.length > 0) {
        payload.attachments = attachments.map(a => ({
          filename: a.file.name,
          contentType: a.file.type || 'application/octet-stream',
          content: a.base64,
        }));
      }

      await callWebmail('send-message', payload);
      onSent();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl sm:mx-4 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-4 sm:animate-in sm:fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700">
          <h2 className="text-sm font-bold text-neutral-800 dark:text-white">
            {mode === 'new' ? 'Nuevo correo' : mode === 'forward' ? 'Reenviar' : 'Responder'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition">
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {error && (
            <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* To */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-10 flex-shrink-0">Para</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/50 text-xs text-neutral-800 dark:text-white"
              placeholder="email@ejemplo.com"
            />
            <div className="flex gap-1 flex-shrink-0">
              {!showCc && <button onClick={() => setShowCc(true)} className="text-[10px] font-medium text-accent hover:text-accent/80 px-1.5 py-0.5 rounded">CC</button>}
              {!showBcc && <button onClick={() => setShowBcc(true)} className="text-[10px] font-medium text-accent hover:text-accent/80 px-1.5 py-0.5 rounded">CCO</button>}
            </div>
          </div>

          {/* CC */}
          {showCc && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-10 flex-shrink-0">CC</label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="flex-1 px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/50 text-xs text-neutral-800 dark:text-white"
                placeholder="cc@ejemplo.com"
              />
            </div>
          )}

          {/* BCC */}
          {showBcc && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-10 flex-shrink-0">CCO</label>
              <input
                type="text"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                className="flex-1 px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/50 text-xs text-neutral-800 dark:text-white"
                placeholder="cco@ejemplo.com"
              />
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-10 flex-shrink-0">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/50 text-xs text-neutral-800 dark:text-white"
              placeholder="Asunto del correo"
            />
          </div>

          {/* Body */}
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={10}
            className="w-full px-3 py-3 border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/50 text-xs text-neutral-800 dark:text-white resize-none leading-relaxed"
            placeholder="Escribe tu mensaje..."
          />

          {/* Attachments section */}
          {attachments.length > 0 && (
            <div className="p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="w-3 h-3" />
                  {attachments.length} adjunto{attachments.length !== 1 ? 's' : ''} ({formatSize(totalAttachmentSize)})
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((att, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-[11px] text-neutral-700 dark:text-neutral-200 group"
                  >
                    <FileText className="w-3 h-3 text-neutral-400" />
                    <span className="truncate max-w-[120px]">{att.file.name}</span>
                    <span className="text-neutral-300 dark:text-neutral-500">({formatSize(att.file.size)})</span>
                    <button
                      onClick={() => removeAttachment(i)}
                      className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition"
                      title="Quitar"
                    >
                      <X className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {attachError && (
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {attachError}
            </div>
          )}

          {/* Signature preview */}
          {signatureLoading ? (
            <div className="border-t border-dashed border-neutral-200 dark:border-neutral-700 pt-2">
              <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
            </div>
          ) : signatureHtml ? (
            <div className="border-t border-dashed border-neutral-200 dark:border-neutral-700 pt-2">
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-1">Firma</p>
              <div
                className="text-[11px] text-neutral-600 dark:text-neutral-400 overflow-hidden max-h-24"
                dangerouslySetInnerHTML={{ __html: signatureHtml }}
              />
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-neutral-100 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition text-xs font-medium border border-neutral-200 dark:border-neutral-700"
              title="Adjuntar archivo"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Adjuntar</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition text-xs font-medium disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (data:type;base64,)
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
