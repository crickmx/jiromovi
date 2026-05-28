import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '@/lib/utils';
import { Smartphone, QrCode, Wifi, WifiOff, Search, Send, Paperclip, MoreVertical, ArrowLeft, MessageSquare, Clock, CheckCheck, Check, AlertCircle, Plus, FileText, User, Tag, Settings, Zap, RefreshCw, X, Smile, FileUp, Star, Copy, ClipboardList, Trash2, CreditCard as Edit3, Image as ImageIcon, File, ExternalLink, CheckSquare, Square, ChevronDown, Bot } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────

interface WhatsAppSession {
  id: string;
  user_id: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'qr_pending';
  phone_number: string | null;
  device_name: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  last_activity_at: string | null;
  error_message: string | null;
}

interface Conversation {
  id: string;
  remote_phone: string;
  remote_name: string | null;
  remote_avatar_url: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_group: boolean;
  group_name: string | null;
  crm_contact_id: string | null;
  tramite_id: string | null;
  tags: string[];
  is_archived: boolean;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_filename: string | null;
  media_mime_type: string | null;
  media_file_size: number | null;
  media_caption: string | null;
  media_download_status: string | null;
  media_storage_path: string | null;
  media_thumbnail_url: string | null;
  status: string;
  is_internal_note: boolean;
  created_at: string;
  message_timestamp: string | null;
  metadata: Record<string, unknown> | null;
}

interface UserTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
  is_favorite: boolean;
  sort_order: number;
}

interface FormTemplate {
  id: string;
  form_title: string;
  form_type: string;
  slug: string;
  public_url: string;
  status: string;
}

interface PendingAttachment {
  file: File;
  preview: string | null;
  uploading: boolean;
  error: string | null;
}

interface CcAssistant {
  id: string;
  nombre: string;
  descripcion: string;
  source: string;
  is_active: boolean;
}

type ActiveView = 'inbox' | 'connection' | 'templates';

// ── Emoji data (compact, most used) ────────────────────────────────

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  { name: 'Frecuentes', emojis: ['👍','👋','🙏','😊','😂','❤️','🔥','✅','👏','💪','🎉','😍','🤝','💯','⭐','📋','📎','📞','💬','✨'] },
  { name: 'Caras', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬'] },
  { name: 'Gestos', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','🦾','🫶'] },
  { name: 'Objetos', emojis: ['📱','💻','📄','📋','📎','📌','📍','🔗','📞','📧','💰','💵','🏠','🚗','✈️','🏥','🔒','🔑','📊','📈','🎯','🗓️','⏰','💼','🎁','🏆','🛡️','⚖️','📝','🖊️'] },
  { name: 'Simbolos', emojis: ['✅','❌','⭕','❗','❓','💡','⚠️','🚫','✨','💫','⭐','🌟','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥','💯','🔥','💥','💢','💦','💨','🕊️','☮️'] },
];

// ── Main Component ────────────────────────────────────────────────

export default function MiWhatsApp() {
  const { usuario } = useAuth();
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // New feature states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [showFormularios, setShowFormularios] = useState(false);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showCreateTramite, setShowCreateTramite] = useState(false);
  const [contextMenuMsg, setContextMenuMsg] = useState<{ id: string; x: number; y: number } | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: string } | null>(null);

  // AI/Assistant state
  const [showAssistants, setShowAssistants] = useState(false);
  const [assistants, setAssistants] = useState<CcAssistant[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

  const [contactNames, setContactNames] = useState<Record<string, { display_name: string; profile_pic_url: string | null; is_business: boolean }>>({});
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const callEdgeFunction = async (action: string, extra?: Record<string, unknown>) => {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession?.access_token) return null;
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-session`;
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authSession.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!resp.ok) return null;
    return resp.json();
  };

  useEffect(() => {
    if (usuario) loadSessionAndConversations();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [usuario]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.emoji-picker-container')) setShowEmojiPicker(false);
      if (!target.closest('.templates-dropdown-container')) setShowTemplatesDropdown(false);
      if (!target.closest('.formularios-container')) setShowFormularios(false);
      if (!target.closest('.assistants-container')) setShowAssistants(false);
      if (!target.closest('.context-menu-container')) setContextMenuMsg(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const resolveContactName = useCallback((conv: Conversation): string => {
    const phone = conv.remote_phone;
    const contact = contactNames[phone];
    if (contact?.display_name && contact.display_name !== phone) return contact.display_name;
    if (conv.remote_name && conv.remote_name !== phone) return conv.remote_name;
    // Format phone for display
    if (phone.length === 12 && phone.startsWith('52')) {
      return `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
    }
    return phone;
  }, [contactNames]);

  const loadSessionAndConversations = async () => {
    if (!usuario) return;
    setLoading(true);

    const [statusResult, { data: tplData }, { data: formData }] = await Promise.all([
      callEdgeFunction('get-status'),
      supabase.from('whatsapp_user_templates').select('*').eq('user_id', usuario.id).order('is_favorite', { ascending: false }).order('sort_order'),
      supabase.from('shared_quote_form_links').select('id, form_title, form_type, slug, public_url, status').eq('agent_id', usuario.id).eq('status', 'active').order('form_title'),
    ]);

    if (statusResult) {
      setSession(statusResult.session);
      setProviderConfigured(statusResult.server_configured ?? statusResult.provider_configured ?? false);
      if (statusResult.session?.status === 'connected' || statusResult.session?.status === 'disconnected') {
        setQrCode(null);
      }
    }

    const [convsResult, contactsResult] = await Promise.all([
      callEdgeFunction('get-conversations'),
      callEdgeFunction('get-contacts'),
    ]);
    setConversations(convsResult?.conversations || []);
    if (contactsResult?.contacts) setContactNames(contactsResult.contacts);
    setTemplates(tplData || []);
    setFormTemplates(formData || []);
    setLoading(false);
  };

  const loadMessages = useCallback(async (conversationId: string, before?: string) => {
    const result = await callEdgeFunction('get-messages', { conversationId, limit: 50, before });
    if (!result) return;

    if (before) {
      // Prepend older messages
      setMessages(prev => [...(result.messages || []), ...prev]);
    } else {
      setMessages(result.messages || []);
    }
    setHasMoreMessages(result.hasMore || false);
  }, []);

  const handleLoadMore = async () => {
    if (!selectedConversation || loadingMore || !hasMoreMessages) return;
    setLoadingMore(true);
    const oldestMsg = messages[0];
    const before = oldestMsg?.message_timestamp || oldestMsg?.created_at;
    if (before) await loadMessages(selectedConversation.id, before);
    setLoadingMore(false);
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setShowMobileChat(true);
    setSelectionMode(false);
    setSelectedMessages(new Set());
    loadMessages(conv.id);
    if (conv.unread_count > 0) {
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || !usuario || sendingMessage) return;

    // Check session is connected
    if (session?.status !== 'connected') {
      setSendError('Tu WhatsApp no esta conectado. Escanea el QR para enviar mensajes.');
      return;
    }

    const text = messageInput.trim();
    setMessageInput('');
    setSendError(null);
    setShowEmojiPicker(false);
    setShowTemplatesDropdown(false);
    setSendingMessage(true);

    const tempId = crypto.randomUUID();
    const newMsg: Message = {
      id: tempId,
      direction: 'outbound',
      message_type: 'text',
      content: text,
      media_url: null,
      media_filename: null,
      media_mime_type: null,
      media_file_size: null,
      media_caption: null,
      media_download_status: null,
      media_storage_path: null,
      media_thumbnail_url: null,
      status: 'pending',
      is_internal_note: false,
      created_at: new Date().toISOString(),
      message_timestamp: new Date().toISOString(),
      metadata: null,
    };
    setMessages(prev => [...prev, newMsg]);

    const result = await callEdgeFunction('send-message', {
      to: selectedConversation.remote_phone,
      message: text,
      conversationId: selectedConversation.id,
    });

    setSendingMessage(false);

    if (result?.success) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      setConversations(prev => prev.map(c =>
        c.id === selectedConversation.id ? { ...c, last_message_text: text, last_message_at: new Date().toISOString() } : c
      ));
    } else {
      const errorMsg = result?.error || 'Error al enviar mensaje';
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed', metadata: { error: errorMsg, retryText: text } } : m));
      setSendError(errorMsg);
      // If disconnected, update session state
      if (result?.disconnected) {
        setSession(prev => prev ? { ...prev, status: 'disconnected' } : prev);
      }
    }
  };

  const handleRetryMessage = async (msg: Message) => {
    if (!selectedConversation || !usuario || sendingMessage) return;
    const retryText = (msg.metadata?.retryText as string) || msg.content || '';
    if (!retryText) return;

    if (session?.status !== 'connected') {
      setSendError('Tu WhatsApp no esta conectado. Escanea el QR para enviar mensajes.');
      return;
    }

    setSendError(null);
    setSendingMessage(true);

    // Update failed message to pending
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'pending' } : m));

    const result = await callEdgeFunction('send-message', {
      to: selectedConversation.remote_phone,
      message: retryText,
      conversationId: selectedConversation.id,
    });

    setSendingMessage(false);

    if (result?.success) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sent' } : m));
      setConversations(prev => prev.map(c =>
        c.id === selectedConversation.id ? { ...c, last_message_text: retryText, last_message_at: new Date().toISOString() } : c
      ));
    } else {
      const errorMsg = result?.error || 'Error al reenviar mensaje';
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'failed', metadata: { error: errorMsg, retryText } } : m));
      setSendError(errorMsg);
      if (result?.disconnected) {
        setSession(prev => prev ? { ...prev, status: 'disconnected' } : prev);
      }
    }
  };

  const handleSendAttachment = async () => {
    if (!pendingAttachment || !selectedConversation || !usuario) return;
    const { file } = pendingAttachment;
    setPendingAttachment(prev => prev ? { ...prev, uploading: true } : null);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const newMsg: Message = {
        id: crypto.randomUUID(),
        direction: 'outbound',
        message_type: file.type.startsWith('image/') ? 'image' : 'document',
        content: `[${file.name}]`,
        media_url: pendingAttachment.preview,
        media_filename: file.name,
        status: 'pending',
        is_internal_note: false,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newMsg]);
      setPendingAttachment(null);

      const result = await callEdgeFunction('send-media', {
        to: selectedConversation.remote_phone,
        mediaBase64: base64,
        mimeType: file.type,
        filename: file.name,
        caption: messageInput.trim() || undefined,
      });

      if (result?.success) {
        setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: 'sent' } : m));
        // Log attachment
        await supabase.from('whatsapp_message_attachments').insert({
          conversation_id: selectedConversation.id,
          user_id: usuario.id,
          file_url: pendingAttachment.preview || '',
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        });
      } else {
        setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: 'failed' } : m));
      }
    } catch {
      setPendingAttachment(prev => prev ? { ...prev, uploading: false, error: 'Error al enviar' } : null);
    }
    setMessageInput('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 16 * 1024 * 1024; // 16MB
    if (file.size > maxSize) {
      alert('El archivo excede el limite de 16MB');
      return;
    }

    let preview: string | null = null;
    if (file.type.startsWith('image/')) {
      preview = URL.createObjectURL(file);
    }

    setPendingAttachment({ file, preview, uploading: false, error: null });
    setShowAttachPanel(false);
    if (e.target) e.target.value = '';
  };

  const handleInsertEmoji = (emoji: string) => {
    setMessageInput(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleUseTemplate = (template: UserTemplate) => {
    let text = template.body;
    // Replace known variables with user data
    if (usuario) {
      text = text.replace(/\{\{nombre_usuario\}\}/g, usuario.nombre_completo || `${usuario.nombres} ${usuario.apellido_paterno}`.trim());
      text = text.replace(/\{\{telefono_usuario\}\}/g, usuario.celular || '');
      text = text.replace(/\{\{email_usuario\}\}/g, usuario.email || '');
      text = text.replace(/\{\{nombre_oficina\}\}/g, '');
    }
    if (selectedConversation) {
      text = text.replace(/\{\{nombre_cliente\}\}/g, selectedConversation.remote_name || selectedConversation.remote_phone);
    }
    setMessageInput(text);
    setShowTemplatesDropdown(false);
    textareaRef.current?.focus();
  };

  const handleSendFormLink = async (form: FormTemplate) => {
    if (!selectedConversation || !usuario) return;
    const formUrl = form.public_url;
    const clientName = resolveContactName(selectedConversation);
    const text = `Hola ${clientName}, te comparto el formulario para avanzar con tu cotizacion:\n${formUrl}`;
    setMessageInput(text);
    setShowFormularios(false);
    textareaRef.current?.focus();

    await supabase.from('whatsapp_form_sends_log').insert({
      user_id: usuario.id,
      conversation_id: selectedConversation.id,
      contact_phone: selectedConversation.remote_phone,
      form_template_id: form.id,
      form_url: formUrl,
      crm_contact_id: selectedConversation.crm_contact_id,
    }).catch(() => {});
  };

  const openAssistants = async () => {
    setShowAssistants(true);
    setShowEmojiPicker(false);
    setShowTemplatesDropdown(false);
    setShowFormularios(false);
    setAutoLoading(true);
    const { data } = await supabase.from('contact_center_assistants').select('id, nombre, descripcion, source, is_active').eq('is_active', true).order('nombre');
    setAssistants((data as CcAssistant[]) || []);
    setAutoLoading(false);
  };

  const startAutoMode = async (assistantId: string) => {
    setShowAssistants(false);
    setAutoLoading(true);
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession?.access_token) { setAutoLoading(false); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-center-assistant-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSession.access_token}`, 'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'start_session', agent_user_id: usuario?.id, assistant_id: assistantId }),
      });
      const result = await res.json();
      if (result?.session_id) setAutoMode(true);
    } catch { /* ignore */ }
    setAutoLoading(false);
  };

  const stopAutoMode = async () => {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession?.access_token) { setAutoMode(false); return; }
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-center-assistant-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSession.access_token}`, 'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'cancel_session', agent_user_id: usuario?.id }),
    }).catch(() => {});
    setAutoMode(false);
  };

  const handleDirectCreateTramite = () => {
    const lastMsgs = messages.slice(-3);
    const description = lastMsgs.map(m => `[${m.direction === 'outbound' ? 'Yo' : selectedConversation?.remote_name || selectedConversation?.remote_phone || ''}] ${m.content || ''}`.trim()).join('\n');
    setSelectedMessages(new Set(lastMsgs.map(m => m.id)));
    setShowCreateTramite(true);
  };

  const handleToggleSelection = (msgId: string) => {
    setSelectedMessages(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleCreateTramiteFromMessages = async (formData: { tipo: string; ramo: string; prioridad: string; comentarios: string }) => {
    if (!selectedConversation || !usuario || selectedMessages.size === 0) return;

    const selectedMsgs = messages.filter(m => selectedMessages.has(m.id));
    const description = selectedMsgs.map(m => `[${m.direction === 'outbound' ? 'Yo' : selectedConversation.remote_name || selectedConversation.remote_phone}] ${m.content || ''}`.trim()).join('\n');

    // Check if messages already used
    const { data: existingLinks } = await supabase
      .from('whatsapp_message_tramite_links')
      .select('id')
      .eq('conversation_id', selectedConversation.id)
      .overlaps('message_ids', Array.from(selectedMessages));

    if (existingLinks && existingLinks.length > 0) {
      if (!confirm('Algunos de estos mensajes ya fueron usados para crear un tramite. Deseas continuar?')) return;
    }

    // Create ticket
    const { data: ticket, error } = await supabase.from('tickets').insert({
      titulo: `WhatsApp - ${selectedConversation.remote_name || selectedConversation.remote_phone}`,
      descripcion: `${description}\n\n${formData.comentarios}`.trim(),
      tipo: formData.tipo || 'soporte',
      prioridad: formData.prioridad || 'Media',
      estatus: 'Abierto',
      creado_por: usuario.id,
      oficina_id: usuario.oficina_id,
    }).select('id').single();

    if (error || !ticket) {
      alert('Error al crear el tramite');
      return;
    }

    // Link messages to tramite
    await supabase.from('whatsapp_message_tramite_links').insert({
      user_id: usuario.id,
      conversation_id: selectedConversation.id,
      message_ids: Array.from(selectedMessages),
      tramite_id: ticket.id,
      crm_contact_id: selectedConversation.crm_contact_id,
    });

    setShowCreateTramite(false);
    setSelectionMode(false);
    setSelectedMessages(new Set());
    alert('Tramite creado exitosamente');
  };

  const startQrPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPolling(true);
    pollRef.current = setInterval(async () => {
      const result = await callEdgeFunction('get-qr');
      if (result) {
        if (result.connected) {
          setQrCode(null);
          setPolling(false);
          if (pollRef.current) clearInterval(pollRef.current);
          loadSessionAndConversations();
        } else if (result.qr_code) {
          setQrCode(result.qr_code);
        }
      }
    }, 5000);
  };

  const handleConnect = async () => {
    if (!usuario) return;
    const result = await callEdgeFunction('connect');
    if (result) {
      if (result.error && !result.success) {
        setProviderMessage(result.error);
        setProviderConfigured(result.server_configured ?? false);
        return;
      }
      setProviderMessage(result.message || null);
      if (result.qr_code) setQrCode(result.qr_code);
      if (result.server_configured || result.success) startQrPolling();
      const status = await callEdgeFunction('get-status');
      if (status?.session) setSession(status.session);
    }
  };

  const handleDisconnect = async () => {
    if (!usuario) return;
    if (pollRef.current) clearInterval(pollRef.current);
    setPolling(false);
    setQrCode(null);
    await callEdgeFunction('disconnect');
    loadSessionAndConversations();
  };

  const [diagResult, setDiagResult] = useState<Record<string, unknown> | null>(null);

  const handleDiagnose = async () => {
    setDiagResult(null);
    const result = await callEdgeFunction('diagnose');
    if (result?.diagnostics) {
      setDiagResult(result.diagnostics);
    } else {
      setDiagResult({ error: 'No se pudo obtener diagnostico', raw: result });
    }
  };

  const [syncingHistory, setSyncingHistory] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSyncHistory = async () => {
    setSyncingHistory(true);
    setSyncResult(null);
    try {
      const result = await callEdgeFunction('sync-history');
      if (result?.success) {
        setSyncResult(`Historial sincronizado: ${result.synced || 0} mensajes`);
        await loadSessionAndConversations();
      } else {
        setSyncResult(result?.error || 'Error al sincronizar');
      }
    } finally {
      setSyncingHistory(false);
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return !c.is_archived;
    const q = searchQuery.toLowerCase();
    return (c.remote_name?.toLowerCase().includes(q) || c.remote_phone.includes(q) || c.last_message_text?.toLowerCase().includes(q)) && !c.is_archived;
  });

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return d.toLocaleDateString('es-MX', { weekday: 'short' });
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read': return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
      case 'delivered': return <CheckCheck className="w-3.5 h-3.5 text-neutral-400" />;
      case 'sent': return <Check className="w-3.5 h-3.5 text-neutral-400" />;
      case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default: return <Clock className="w-3.5 h-3.5 text-neutral-300" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="w-8 h-8 border-[3px] border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const isConnected = session?.status === 'connected';

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {/* Top bar */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', isConnected ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-neutral-100 dark:bg-white/5')}>
            <Smartphone className={cn('w-4.5 h-4.5', isConnected ? 'text-emerald-600' : 'text-neutral-400')} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-neutral-900 dark:text-white">Mi WhatsApp</h1>
            <div className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', isConnected ? 'bg-emerald-500' : session?.status === 'connecting' || session?.status === 'qr_pending' ? 'bg-amber-500 animate-pulse' : 'bg-neutral-300')} />
              <span className="text-[11px] text-neutral-500 dark:text-white/40">
                {isConnected ? `Conectado${session.phone_number ? ` - ${session.phone_number}` : ''}` :
                 session?.status === 'qr_pending' ? 'Esperando escaneo...' :
                 session?.status === 'connecting' ? 'Conectando...' :
                 session?.status === 'error' ? 'Error de conexion' : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {[
            { key: 'inbox' as ActiveView, icon: MessageSquare, label: 'Conversaciones' },
            { key: 'connection' as ActiveView, icon: QrCode, label: 'Conexion' },
            { key: 'templates' as ActiveView, icon: Zap, label: 'Plantillas' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveView(tab.key)}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                activeView === tab.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-500 dark:text-white/40 hover:bg-neutral-100 dark:hover:bg-white/5')}>
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'connection' && (
          <div className="h-full overflow-y-auto">
            <ConnectionPanel session={session} qrCode={qrCode} providerConfigured={providerConfigured} providerMessage={providerMessage} polling={polling} onConnect={handleConnect} onDisconnect={handleDisconnect} onRefresh={loadSessionAndConversations} onDiagnose={handleDiagnose} onSyncHistory={handleSyncHistory} syncingHistory={syncingHistory} syncResult={syncResult} />
            {diagResult && (
              <div className="max-w-lg mx-auto px-6 pb-6">
                <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-blue-800 dark:text-blue-200">Resultado del Diagnostico</h4>
                    <button onClick={() => setDiagResult(null)} className="text-blue-400 hover:text-blue-600"><X className="w-4 h-4" /></button>
                  </div>
                  <pre className="text-[10px] leading-relaxed text-blue-900 dark:text-blue-100 font-mono whitespace-pre-wrap break-all max-h-80 overflow-y-auto">{JSON.stringify(diagResult, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}
        {activeView === 'templates' && (
          <TemplatesPanel templates={templates} userId={usuario?.id || ''} onRefresh={loadSessionAndConversations} onUseTemplate={(body) => { setMessageInput(body); setActiveView('inbox'); }} />
        )}
        {activeView === 'inbox' && (
          <div className="h-full flex">
            {/* Conversation list */}
            <div className={cn('w-full md:w-[340px] lg:w-[380px] border-r border-neutral-200 dark:border-neutral-700 flex flex-col bg-white dark:bg-neutral-900', showMobileChat ? 'hidden md:flex' : 'flex')}>
              <div className="p-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar conversaciones..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200/60 dark:border-white/10 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-emerald-400/40 transition-all" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {!isConnected && (
                  <div className="p-6 text-center">
                    <div className="w-14 h-14 bg-neutral-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3"><WifiOff className="w-6 h-6 text-neutral-300 dark:text-white/20" /></div>
                    <p className="text-sm font-medium text-neutral-600 dark:text-white/60 mb-1">WhatsApp no conectado</p>
                    <p className="text-xs text-neutral-400 dark:text-white/30 mb-4">Conecta tu WhatsApp para ver tus conversaciones</p>
                    <button onClick={() => setActiveView('connection')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors">Conectar ahora</button>
                  </div>
                )}
                {isConnected && filteredConversations.length === 0 && (
                  <div className="p-6 text-center">
                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3"><MessageSquare className="w-6 h-6 text-emerald-400" /></div>
                    <p className="text-sm font-medium text-neutral-600 dark:text-white/60 mb-1">{searchQuery ? 'Sin resultados' : 'Sin conversaciones'}</p>
                    <p className="text-xs text-neutral-400 dark:text-white/30">{searchQuery ? 'Intenta con otro termino' : 'Las conversaciones apareceran aqui cuando recibas mensajes'}</p>
                  </div>
                )}
                {isConnected && filteredConversations.map(conv => (
                  <button key={conv.id} onClick={() => handleSelectConversation(conv)}
                    className={cn('w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors border-b border-neutral-100/60 dark:border-white/[0.04]', selectedConversation?.id === conv.id && 'bg-emerald-50/50 dark:bg-emerald-900/10')}>
                    <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      {(contactNames[conv.remote_phone]?.profile_pic_url || conv.remote_avatar_url) ? <img src={contactNames[conv.remote_phone]?.profile_pic_url || conv.remote_avatar_url || ''} alt="" className="w-full h-full rounded-full object-cover" /> : <User className="w-5 h-5 text-emerald-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{resolveContactName(conv)}</span>
                        <span className="text-[10px] text-neutral-400 dark:text-white/30 flex-shrink-0">{formatTime(conv.last_message_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-neutral-500 dark:text-white/40 truncate">{conv.last_message_text || 'Sin mensajes'}</span>
                        {conv.unread_count > 0 && <span className="flex-shrink-0 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">{conv.unread_count > 9 ? '9+' : conv.unread_count}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat area */}
            <div className={cn('flex-1 flex flex-col bg-neutral-50 dark:bg-neutral-950', !showMobileChat ? 'hidden md:flex' : 'flex')}>
              {!selectedConversation ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl flex items-center justify-center mx-auto mb-4"><MessageSquare className="w-9 h-9 text-emerald-300" /></div>
                    <p className="text-base font-semibold text-neutral-600 dark:text-white/50">Selecciona una conversacion</p>
                    <p className="text-sm text-neutral-400 dark:text-white/30 mt-1">Elige un chat del panel izquierdo para comenzar</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => { setShowMobileChat(false); setSelectedConversation(null); setSelectionMode(false); setSelectedMessages(new Set()); }} className="md:hidden p-1.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg">
                      <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-white/60" />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      {(contactNames[selectedConversation.remote_phone]?.profile_pic_url || selectedConversation.remote_avatar_url) ? <img src={contactNames[selectedConversation.remote_phone]?.profile_pic_url || selectedConversation.remote_avatar_url || ''} alt="" className="w-full h-full rounded-full object-cover" /> : <User className="w-5 h-5 text-emerald-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{resolveContactName(selectedConversation)}</h3>
                      <p className="text-[11px] text-neutral-400 dark:text-white/30 flex items-center gap-1">
                        <span>+{selectedConversation.remote_phone.slice(0, 2)} {selectedConversation.remote_phone.slice(2)}</span>
                        {contactNames[selectedConversation.remote_phone]?.is_business && <span className="text-[8px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded font-medium">Empresa</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {selectedConversation.crm_contact_id && <span className="text-[9px] px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">CRM</span>}
                      {selectedConversation.tramite_id && <span className="text-[9px] px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full font-medium">Tramite</span>}
                      {selectionMode && selectedMessages.size > 0 && (
                        <button onClick={() => setShowCreateTramite(true)} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-medium hover:bg-emerald-700 transition-colors">
                          <ClipboardList className="w-3.5 h-3.5" />
                          Crear tramite ({selectedMessages.size})
                        </button>
                      )}
                      <button onClick={() => { setSelectionMode(!selectionMode); setSelectedMessages(new Set()); }}
                        className={cn('p-2 rounded-lg transition-colors', selectionMode ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-500')}>
                        <CheckSquare className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Disconnected warning */}
                  {session?.status !== 'connected' && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/40 px-4 py-2.5 flex items-center gap-2.5">
                      <WifiOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300 flex-1">WhatsApp desconectado. No puedes enviar mensajes hasta reconectar.</p>
                      <button onClick={() => setActiveView('connection')} className="text-xs font-medium text-amber-700 dark:text-amber-200 hover:underline flex-shrink-0">
                        Conectar
                      </button>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 relative">
                    {/* Load more button */}
                    {hasMoreMessages && (
                      <div className="text-center py-2">
                        <button onClick={handleLoadMore} disabled={loadingMore}
                          className="text-xs px-4 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-white/60 rounded-full transition-colors disabled:opacity-50">
                          {loadingMore ? 'Cargando...' : 'Cargar mensajes anteriores'}
                        </button>
                      </div>
                    )}
                    {messages.length === 0 && <div className="text-center py-10"><p className="text-sm text-neutral-400 dark:text-white/30">No hay mensajes en esta conversacion</p></div>}
                    {messages.map(msg => (
                      <div key={msg.id} className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}
                        onContextMenu={(e) => { if (!selectionMode) { e.preventDefault(); setContextMenuMsg({ id: msg.id, x: e.clientX, y: e.clientY }); } }}>
                        {selectionMode && (
                          <button onClick={() => handleToggleSelection(msg.id)} className="mr-2 flex-shrink-0 self-center">
                            {selectedMessages.has(msg.id) ? <CheckSquare className="w-5 h-5 text-emerald-600" /> : <Square className="w-5 h-5 text-neutral-300" />}
                          </button>
                        )}
                        <div className={cn(
                          'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm cursor-default',
                          msg.is_internal_note ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/30' :
                          msg.direction === 'outbound' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700',
                          selectionMode && selectedMessages.has(msg.id) && 'ring-2 ring-emerald-400'
                        )} onClick={() => { if (selectionMode) handleToggleSelection(msg.id); }}>
                          {msg.is_internal_note && <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block mb-1">Nota interna</span>}

                          {/* ── Media Rendering ── */}
                          {msg.message_type === 'image' && (
                            <div className="mb-1.5">
                              {msg.media_url ? (
                                <img src={msg.media_url} alt="" className="rounded-lg max-w-full max-h-52 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={(e) => { e.stopPropagation(); setMediaPreview({ url: msg.media_url!, type: 'image' }); }} />
                              ) : msg.media_download_status === 'pending' || msg.media_download_status === 'downloading' ? (
                                <div className="w-48 h-32 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex flex-col items-center justify-center gap-1">
                                  <ImageIcon className="w-6 h-6 text-neutral-400 animate-pulse" />
                                  <span className="text-[10px] text-neutral-400">Descargando imagen...</span>
                                </div>
                              ) : msg.media_download_status === 'failed' ? (
                                <div className="w-48 h-24 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex flex-col items-center justify-center gap-1">
                                  <ImageIcon className="w-5 h-5 text-neutral-400" />
                                  <span className="text-[10px] text-neutral-400">Imagen no disponible</span>
                                </div>
                              ) : null}
                              {msg.media_caption && <p className={cn('text-sm mt-1', msg.direction === 'outbound' ? 'text-white' : 'text-neutral-800 dark:text-white/80')}>{msg.media_caption}</p>}
                            </div>
                          )}

                          {msg.message_type === 'sticker' && (
                            <div className="mb-1">
                              {msg.media_url ? (
                                <img src={msg.media_url} alt="Sticker" className="w-28 h-28 object-contain" />
                              ) : (
                                <div className="w-28 h-28 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 flex flex-col items-center justify-center">
                                  <span className="text-3xl">🏷</span>
                                  <span className="text-[10px] text-neutral-400 mt-1">Sticker</span>
                                </div>
                              )}
                            </div>
                          )}

                          {msg.message_type === 'video' && (
                            <div className="mb-1.5">
                              {msg.media_url ? (
                                <video src={msg.media_url} controls className="rounded-lg max-w-full max-h-52" />
                              ) : (
                                <div className="w-48 h-32 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex flex-col items-center justify-center gap-1">
                                  <FileText className="w-6 h-6 text-neutral-400" />
                                  <span className="text-[10px] text-neutral-400">{msg.media_download_status === 'failed' ? 'Video no disponible' : 'Descargando video...'}</span>
                                </div>
                              )}
                              {msg.media_caption && <p className={cn('text-sm mt-1', msg.direction === 'outbound' ? 'text-white' : 'text-neutral-800 dark:text-white/80')}>{msg.media_caption}</p>}
                            </div>
                          )}

                          {(msg.message_type === 'audio' || msg.message_type === 'voice_note') && (
                            <div className="mb-1.5">
                              {msg.media_url ? (
                                <audio src={msg.media_url} controls className="max-w-[220px] h-10" />
                              ) : (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-700/50">
                                  <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-600 flex items-center justify-center">
                                    <Paperclip className="w-4 h-4 text-neutral-400" />
                                  </div>
                                  <span className="text-[11px] text-neutral-500">{msg.message_type === 'voice_note' ? 'Nota de voz' : 'Audio'}{msg.metadata?.duration ? ` (${Math.round(msg.metadata.duration as number)}s)` : ''}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {msg.message_type === 'document' && (
                            <div className="mb-1.5">
                              <div className={cn('flex items-center gap-2.5 p-2.5 rounded-lg', msg.direction === 'outbound' ? 'bg-emerald-700/50' : 'bg-neutral-50 dark:bg-neutral-700/50')}>
                                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn('text-xs font-medium truncate', msg.direction === 'outbound' ? 'text-white' : 'text-neutral-800 dark:text-white/80')}>{msg.media_filename || 'Documento'}</p>
                                  <p className={cn('text-[10px]', msg.direction === 'outbound' ? 'text-white/60' : 'text-neutral-400')}>
                                    {msg.media_file_size ? `${(msg.media_file_size / 1024).toFixed(0)} KB` : msg.media_mime_type || 'Archivo'}
                                  </p>
                                </div>
                                {msg.media_url && (
                                  <a href={msg.media_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                    className={cn('p-1.5 rounded-lg transition-colors', msg.direction === 'outbound' ? 'hover:bg-white/10' : 'hover:bg-neutral-200 dark:hover:bg-neutral-600')}>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                              {msg.media_caption && <p className={cn('text-sm mt-1', msg.direction === 'outbound' ? 'text-white' : 'text-neutral-800 dark:text-white/80')}>{msg.media_caption}</p>}
                            </div>
                          )}

                          {msg.message_type === 'location' && (
                            <div className="mb-1.5">
                              <div className={cn('p-2.5 rounded-lg', msg.direction === 'outbound' ? 'bg-emerald-700/50' : 'bg-neutral-50 dark:bg-neutral-700/50')}>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm">📍</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn('text-xs font-medium', msg.direction === 'outbound' ? 'text-white' : 'text-neutral-800 dark:text-white/80')}>
                                      {(msg.metadata?.name as string) || 'Ubicacion'}
                                    </p>
                                    {msg.metadata?.address && <p className={cn('text-[10px] truncate', msg.direction === 'outbound' ? 'text-white/60' : 'text-neutral-400')}>{msg.metadata.address as string}</p>}
                                  </div>
                                </div>
                                {msg.metadata?.latitude && (
                                  <a href={`https://maps.google.com/?q=${msg.metadata.latitude},${msg.metadata.longitude}`}
                                    target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                    className={cn('mt-2 block text-center text-[11px] font-medium py-1.5 rounded-md transition-colors', msg.direction === 'outbound' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-white/80 hover:bg-neutral-300')}>
                                    Abrir en Maps
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {msg.message_type === 'contact' && (
                            <div className="mb-1.5">
                              <div className={cn('flex items-center gap-2.5 p-2.5 rounded-lg', msg.direction === 'outbound' ? 'bg-emerald-700/50' : 'bg-neutral-50 dark:bg-neutral-700/50')}>
                                <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                                  <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn('text-xs font-medium', msg.direction === 'outbound' ? 'text-white' : 'text-neutral-800 dark:text-white/80')}>{(msg.metadata?.displayName as string) || msg.content || 'Contacto'}</p>
                                  {msg.metadata?.phone && <p className={cn('text-[10px]', msg.direction === 'outbound' ? 'text-white/60' : 'text-neutral-400')}>{msg.metadata.phone as string}</p>}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Text content (only for text messages or captions not already shown) */}
                          {msg.message_type === 'text' && msg.content && (
                            <p className={cn('text-sm leading-relaxed whitespace-pre-wrap break-words', msg.direction === 'outbound' && !msg.is_internal_note ? 'text-white' : 'text-neutral-800 dark:text-white/80')}>
                              {msg.content}
                            </p>
                          )}

                          {msg.message_type === 'unknown' && msg.content && (
                            <p className={cn('text-sm italic', msg.direction === 'outbound' ? 'text-white/70' : 'text-neutral-500')}>
                              [Mensaje no soportado]
                            </p>
                          )}

                          {/* Timestamp & status */}
                          <div className={cn('flex items-center gap-1.5 mt-1', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                            <span className={cn('text-[10px]', msg.direction === 'outbound' && !msg.is_internal_note ? 'text-white/60' : 'text-neutral-400 dark:text-white/30')}>
                              {new Date(msg.message_timestamp || msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.direction === 'outbound' && !msg.is_internal_note && getStatusIcon(msg.status)}
                            {msg.direction === 'outbound' && msg.status === 'failed' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRetryMessage(msg); }}
                                className="ml-1 text-[10px] font-medium text-red-300 hover:text-white bg-red-500/30 hover:bg-red-500/50 px-1.5 py-0.5 rounded transition-colors"
                                title="Reintentar envio"
                              >
                                Reintentar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />

                    {/* Context menu */}
                    {contextMenuMsg && (
                      <div className="context-menu-container fixed z-50 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl py-1 min-w-[160px]"
                        style={{ left: contextMenuMsg.x, top: contextMenuMsg.y }}>
                        <button onClick={() => { navigator.clipboard.writeText(messages.find(m => m.id === contextMenuMsg.id)?.content || ''); setContextMenuMsg(null); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-white/70"><Copy className="w-3.5 h-3.5" /> Copiar</button>
                        <button onClick={() => { setSelectionMode(true); setSelectedMessages(new Set([contextMenuMsg.id])); setContextMenuMsg(null); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-white/70"><CheckSquare className="w-3.5 h-3.5" /> Seleccionar</button>
                        <button onClick={() => { setSelectionMode(true); setSelectedMessages(new Set([contextMenuMsg.id])); setShowCreateTramite(true); setContextMenuMsg(null); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-white/70"><ClipboardList className="w-3.5 h-3.5" /> Crear tramite</button>
                      </div>
                    )}
                  </div>

                  {/* Pending attachment preview */}
                  {pendingAttachment && (
                    <div className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-4 py-3">
                      <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                        {pendingAttachment.preview ? (
                          <img src={pendingAttachment.preview} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0"><File className="w-6 h-6 text-neutral-400" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-800 dark:text-white truncate">{pendingAttachment.file.name}</p>
                          <p className="text-xs text-neutral-400 mt-0.5">{formatFileSize(pendingAttachment.file.size)} - {pendingAttachment.file.type.split('/')[1]?.toUpperCase()}</p>
                          {pendingAttachment.error && <p className="text-xs text-red-500 mt-0.5">{pendingAttachment.error}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => setPendingAttachment(null)} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg"><X className="w-4 h-4 text-neutral-500" /></button>
                          <button onClick={handleSendAttachment} disabled={pendingAttachment.uploading}
                            className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl">
                            {pendingAttachment.uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Send error banner */}
                  {sendError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800/40 px-4 py-2 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-600 dark:text-red-400 flex-1">{sendError}</p>
                      <button onClick={() => setSendError(null)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors">
                        <X className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  )}

                  {/* Message input bar */}
                  <div className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 p-3 flex-shrink-0">
                    <div className="flex items-end gap-1.5">
                      {/* Emoji button */}
                      <div className="relative emoji-picker-container flex-shrink-0">
                        <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowTemplatesDropdown(false); setShowFormularios(false); }}
                          className={cn('p-2.5 rounded-xl transition-colors', showEmojiPicker ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-400')} title="Emojis">
                          <Smile className="w-5 h-5" />
                        </button>
                        {showEmojiPicker && <EmojiPicker onSelect={handleInsertEmoji} />}
                      </div>

                      {/* Attach button */}
                      <div className="relative flex-shrink-0">
                        <button onClick={() => fileInputRef.current?.click()}
                          className="p-2.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors text-neutral-400" title="Adjuntar archivo">
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect}
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" />
                      </div>

                      {/* Templates button */}
                      <div className="relative templates-dropdown-container flex-shrink-0">
                        <button onClick={() => { setShowTemplatesDropdown(!showTemplatesDropdown); setShowEmojiPicker(false); setShowFormularios(false); }}
                          className={cn('p-2.5 rounded-xl transition-colors', showTemplatesDropdown ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-400')} title="Plantillas">
                          <Zap className="w-5 h-5" />
                        </button>
                        {showTemplatesDropdown && templates.length > 0 && (
                          <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50">
                            <div className="p-2 border-b border-neutral-100 dark:border-neutral-700">
                              <p className="text-[10px] font-bold text-neutral-500 dark:text-white/40 uppercase tracking-wider px-2">Mis Plantillas</p>
                            </div>
                            {templates.map(tpl => (
                              <button key={tpl.id} onClick={() => handleUseTemplate(tpl)}
                                className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors border-b border-neutral-50 dark:border-neutral-700/50 last:border-0">
                                <div className="flex items-center gap-1.5">
                                  {tpl.is_favorite && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                  <span className="text-xs font-medium text-neutral-700 dark:text-white/70">{tpl.name}</span>
                                  {tpl.category && <span className="text-[9px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-white/40 rounded">{tpl.category}</span>}
                                </div>
                                <p className="text-[11px] text-neutral-400 dark:text-white/30 truncate mt-0.5">{tpl.body}</p>
                              </button>
                            ))}
                          </div>
                        )}
                        {showTemplatesDropdown && templates.length === 0 && (
                          <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl p-4 z-50 text-center">
                            <p className="text-xs text-neutral-500 dark:text-white/40">No tienes plantillas</p>
                            <button onClick={() => { setActiveView('templates'); setShowTemplatesDropdown(false); }} className="text-xs text-emerald-600 font-medium mt-1">Crear plantilla</button>
                          </div>
                        )}
                      </div>

                      {/* Formularios button */}
                      <div className="relative formularios-container flex-shrink-0 hidden sm:block">
                        <button onClick={() => { setShowFormularios(!showFormularios); setShowEmojiPicker(false); setShowTemplatesDropdown(false); }}
                          className={cn('p-2.5 rounded-xl transition-colors', showFormularios ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-400')} title="Formularios">
                          <ExternalLink className="w-5 h-5" />
                        </button>
                        {showFormularios && (
                          <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl max-h-72 overflow-y-auto z-50">
                            <div className="p-3 border-b border-neutral-100 dark:border-neutral-700">
                              <p className="text-xs font-bold text-neutral-800 dark:text-white">Enviar formulario de cotizacion</p>
                              <p className="text-[10px] text-neutral-400 mt-0.5">Selecciona un formulario para enviar el link</p>
                            </div>
                            {formTemplates.length === 0 ? (
                              <div className="p-4 text-center"><p className="text-xs text-neutral-400">No hay formularios disponibles</p></div>
                            ) : (
                              formTemplates.map(form => (
                                <button key={form.id} onClick={() => handleSendFormLink(form)}
                                  className="w-full text-left px-3 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors border-b border-neutral-50 dark:border-neutral-700/50 last:border-0">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-neutral-700 dark:text-white/70 truncate">{form.form_title}</p>
                                      <p className="text-[10px] text-neutral-400 truncate mt-0.5">{form.form_type.replace(/_/g, ' ')}</p>
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bot/IA button */}
                      <div className="flex-shrink-0 hidden sm:block">
                        {autoMode ? (
                          <button onClick={stopAutoMode}
                            className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 animate-pulse" title="IA activa - detener">
                            <Bot className="w-5 h-5" />
                          </button>
                        ) : (
                          <button onClick={openAssistants} disabled={autoLoading}
                            className="p-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-400 transition-colors" title="Asistentes IA">
                            {autoLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
                          </button>
                        )}
                      </div>

                      {/* Crear tramite button */}
                      <div className="flex-shrink-0 hidden sm:block">
                        <button onClick={handleDirectCreateTramite}
                          className="p-2.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors text-neutral-400" title="Crear tramite">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Text input */}
                      <div className="flex-1">
                        <textarea
                          ref={textareaRef}
                          value={messageInput}
                          onChange={e => setMessageInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                          placeholder={autoMode ? 'IA activa - escribe para intervenir...' : 'Escribe un mensaje...'}
                          rows={1}
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-white/5 border text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-emerald-400/40 resize-none transition-all',
                            autoMode ? 'border-emerald-300/60 dark:border-emerald-600/30' : 'border-neutral-200/60 dark:border-white/10'
                          )}
                        />
                      </div>

                      {/* Send button */}
                      <button onClick={handleSendMessage} disabled={!messageInput.trim() || sendingMessage}
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-200 disabled:dark:bg-white/5 text-white disabled:text-neutral-400 rounded-xl transition-colors flex-shrink-0">
                        {sendingMessage ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Tramite Modal */}
      {showCreateTramite && (
        <CreateTramiteModal
          selectedCount={selectedMessages.size}
          conversationName={selectedConversation?.remote_name || selectedConversation?.remote_phone || ''}
          onClose={() => setShowCreateTramite(false)}
          onSubmit={handleCreateTramiteFromMessages}
        />
      )}

      {/* Assistants Modal */}
      {showAssistants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAssistants(false)}>
          <div className="w-full max-w-md mx-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-sm font-bold text-neutral-800 dark:text-white">Asistentes IA</h3>
              <button onClick={() => setShowAssistants(false)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs text-neutral-500 mb-3">Selecciona un asistente para activar el modo automatico.</p>
              {autoLoading ? <div className="flex justify-center py-6"><RefreshCw className="w-5 h-5 animate-spin text-neutral-300" /></div>
                : assistants.length === 0 ? <p className="text-xs text-neutral-400 text-center py-6">Sin asistentes configurados</p>
                : <div className="space-y-2 max-h-72 overflow-y-auto">
                    {assistants.map(a => (
                      <button key={a.id} onClick={() => startAutoMode(a.id)} className="w-full text-left p-3 rounded-xl border border-neutral-100 dark:border-neutral-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all">
                        <div className="flex items-center gap-2">
                          <Bot className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{a.nombre}</p>
                            {a.descripcion && <p className="text-[11px] text-neutral-500 mt-0.5">{a.descripcion}</p>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Emoji Picker ──────────────────────────────────────────────────

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl z-50 overflow-hidden">
      <div className="p-2 border-b border-neutral-100 dark:border-neutral-700">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar emoji..."
          className="w-full px-3 py-1.5 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-700 border border-neutral-200/60 dark:border-neutral-600 placeholder:text-neutral-400 focus:outline-none" />
      </div>
      <div className="flex border-b border-neutral-100 dark:border-neutral-700 px-1">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button key={cat.name} onClick={() => setActiveCategory(i)}
            className={cn('flex-1 py-1.5 text-[10px] font-medium truncate transition-colors', activeCategory === i ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-neutral-400 hover:text-neutral-600')}>
            {cat.name}
          </button>
        ))}
      </div>
      <div className="p-2 h-44 overflow-y-auto">
        <div className="grid grid-cols-8 gap-0.5">
          {(search
            ? EMOJI_CATEGORIES.flatMap(c => c.emojis)
            : EMOJI_CATEGORIES[activeCategory].emojis
          ).map((emoji, i) => (
            <button key={`${emoji}-${i}`} onClick={() => onSelect(emoji)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-lg transition-colors">
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Create Tramite Modal ──────────────────────────────────────────

function CreateTramiteModal({ selectedCount, conversationName, onClose, onSubmit }: {
  selectedCount: number;
  conversationName: string;
  onClose: () => void;
  onSubmit: (data: { tipo: string; ramo: string; prioridad: string; comentarios: string }) => void;
}) {
  const [tipo, setTipo] = useState('soporte');
  const [ramo, setRamo] = useState('');
  const [prioridad, setPrioridad] = useState('Media');
  const [comentarios, setComentarios] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-neutral-200 dark:border-neutral-700 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h3 className="text-sm font-bold text-neutral-800 dark:text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-600" />
              Crear tramite desde mensajes
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">{selectedCount} mensaje(s) de {conversationName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-white/70 block mb-1.5">Tipo de tramite</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-1 focus:ring-accent/40">
              <option value="soporte">Soporte</option>
              <option value="cotizacion">Cotizacion</option>
              <option value="emision">Emision</option>
              <option value="siniestro">Siniestro</option>
              <option value="cobranza">Cobranza</option>
              <option value="renovacion">Renovacion</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-white/70 block mb-1.5">Ramo (opcional)</label>
            <input type="text" value={ramo} onChange={e => setRamo(e.target.value)} placeholder="Ej: Autos, GMM, Vida..."
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-accent/40" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-white/70 block mb-1.5">Prioridad</label>
            <select value={prioridad} onChange={e => setPrioridad(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-1 focus:ring-accent/40">
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-white/70 block mb-1.5">Comentarios adicionales</label>
            <textarea value={comentarios} onChange={e => setComentarios(e.target.value)} placeholder="Agrega contexto o instrucciones..."
              rows={3} className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-neutral-100 dark:border-neutral-800 flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-colors">Cancelar</button>
          <button onClick={() => onSubmit({ tipo, ramo, prioridad, comentarios })}
            className="flex-1 px-4 py-2 text-sm bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium">Crear tramite</button>
        </div>
      </div>
    </div>
  );
}

// ── Connection Panel ──────────────────────────────────────────────

function ConnectionPanel({ session, qrCode, providerConfigured, providerMessage, polling, onConnect, onDisconnect, onRefresh, onDiagnose, onSyncHistory, syncingHistory, syncResult }: {
  session: WhatsAppSession | null;
  qrCode: string | null;
  providerConfigured: boolean;
  providerMessage: string | null;
  polling: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onDiagnose: () => void;
  onSyncHistory: () => void;
  syncingHistory: boolean;
  syncResult: string | null;
}) {
  const isConnected = session?.status === 'connected';
  const isQrPending = session?.status === 'qr_pending';
  const isConnecting = session?.status === 'connecting';
  const isError = session?.status === 'error';

  return (
    <div>
      <div className="max-w-lg mx-auto p-6 space-y-6">
        {!providerConfigured && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Servidor de WhatsApp no configurado</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{providerMessage || 'Se requiere desplegar el servidor de WhatsApp (whatsapp-server) y configurar WHATSAPP_SERVER_URL y WHATSAPP_SERVER_API_KEY. Contacta al administrador del sistema.'}</p>
              </div>
            </div>
          </div>
        )}

        <div className={cn('rounded-2xl border p-6', isConnected ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40' : isError ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700')}>
          <div className="flex items-center gap-4 mb-4">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', isConnected ? 'bg-emerald-100 dark:bg-emerald-800/30' : isError ? 'bg-red-100 dark:bg-red-800/30' : 'bg-neutral-100 dark:bg-white/5')}>
              {isConnected ? <Wifi className="w-7 h-7 text-emerald-600" /> : isError ? <AlertCircle className="w-7 h-7 text-red-600" /> : <WifiOff className="w-7 h-7 text-neutral-400" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                {isConnected ? 'WhatsApp Conectado' : isQrPending ? 'Esperando escaneo QR' : isConnecting ? 'Conectando...' : isError ? 'Error de conexion' : 'WhatsApp Desconectado'}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-white/40">
                {isConnected && session?.phone_number ? `Numero: ${session.phone_number}` : isConnected ? 'Sesion activa' : isError && session?.error_message ? session.error_message : 'Conecta tu WhatsApp personal para usar la bandeja'}
              </p>
            </div>
          </div>
          {isConnected && session?.connected_at && <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-4">Conectado desde: {new Date(session.connected_at).toLocaleString('es-MX')}</div>}
          <div className="flex flex-wrap items-center gap-3">
            {!isConnected && (
              <button onClick={onConnect} disabled={!providerConfigured}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 disabled:dark:bg-neutral-700 text-white disabled:text-neutral-500 rounded-xl text-sm font-medium transition-colors">
                <QrCode className="w-4 h-4" />{isQrPending || isConnecting ? 'Reintentar' : 'Conectar WhatsApp'}
              </button>
            )}
            {isConnected && (
              <button onClick={onDisconnect} className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"><WifiOff className="w-4 h-4" /> Desconectar</button>
            )}
            {isConnected && (
              <button onClick={onSyncHistory} disabled={syncingHistory}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors"
                title="Sincronizar historial de mensajes desde el servidor">
                <RefreshCw className={cn('w-4 h-4', syncingHistory && 'animate-spin')} />
                {syncingHistory ? 'Sincronizando...' : 'Sincronizar historial'}
              </button>
            )}
            <button onClick={onRefresh} className="p-3 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors" title="Actualizar estado"><RefreshCw className={cn('w-4 h-4 text-neutral-500', polling && 'animate-spin')} /></button>
            <button onClick={onDiagnose} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-white/40 dark:hover:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors" title="Diagnosticar conexion"><AlertCircle className="w-3.5 h-3.5" /> Diagnosticar</button>
          </div>
          {syncResult && (
            <div className={cn('mt-3 text-xs px-3 py-2 rounded-lg', syncResult.includes('Error') || syncResult.includes('error') ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300')}>
              {syncResult}
            </div>
          )}
        </div>

        {(isQrPending || isConnecting) && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-8 text-center">
            <div className="w-64 h-64 mx-auto bg-white rounded-2xl flex items-center justify-center mb-4 border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {qrCode ? (
                <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center p-4">
                  {polling ? (
                    <><div className="w-10 h-10 border-[3px] border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" /><p className="text-xs text-neutral-500 dark:text-white/40">Generando codigo QR...</p></>
                  ) : (
                    <><QrCode className="w-16 h-16 text-neutral-200 dark:text-white/10 mx-auto mb-2" /><p className="text-xs text-neutral-400 dark:text-white/30">Presiona "Conectar WhatsApp" para generar el codigo QR</p></>
                  )}
                </div>
              )}
            </div>
            {qrCode && (
              <div className="mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Esperando escaneo...</span>
                </div>
              </div>
            )}
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-white mb-2">Escanea el codigo QR</h3>
            <ol className="text-left text-xs text-neutral-500 dark:text-white/40 space-y-1.5 max-w-xs mx-auto">
              <li>1. Abre WhatsApp en tu celular</li>
              <li>2. Toca Menu o Configuracion</li>
              <li>3. Selecciona "Dispositivos vinculados"</li>
              <li>4. Toca "Vincular un dispositivo"</li>
              <li>5. Apunta la camara hacia el codigo QR</li>
            </ol>
          </div>
        )}

        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-5 border border-neutral-200/50 dark:border-neutral-700/50">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-white mb-3 flex items-center gap-2"><Settings className="w-4 h-4 text-neutral-400" /> Informacion importante</h3>
          <ul className="text-xs text-neutral-500 dark:text-white/40 space-y-2">
            <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" /> Tu sesion de WhatsApp es personal y privada. Nadie mas puede ver tus conversaciones.</li>
            <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" /> Si cierras sesion desde tu celular, la conexion en MOVI se desconectara automaticamente.</li>
            <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" /> Los mensajes se sincronizan en tiempo real mientras la sesion este activa.</li>
            <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" /> Puedes vincular conversaciones con tu CRM y tramites para seguimiento integrado.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Templates Panel (Full CRUD) ───────────────────────────────────

function TemplatesPanel({ templates, userId, onRefresh, onUseTemplate }: {
  templates: UserTemplate[];
  userId: string;
  onRefresh: () => void;
  onUseTemplate: (body: string) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');

  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category).filter(Boolean));
    return Array.from(cats);
  }, [templates]);

  const filtered = useMemo(() => {
    if (!filterCategory) return templates;
    return templates.filter(t => t.category === filterCategory);
  }, [templates, filterCategory]);

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) return;
    if (editingId) {
      await supabase.from('whatsapp_user_templates').update({ name: name.trim(), category: category.trim(), body: body.trim(), updated_at: new Date().toISOString() }).eq('id', editingId);
    } else {
      await supabase.from('whatsapp_user_templates').insert({ user_id: userId, name: name.trim(), category: category.trim(), body: body.trim() });
    }
    setName(''); setCategory(''); setBody(''); setEditingId(null);
    onRefresh();
  };

  const handleEdit = (tpl: UserTemplate) => {
    setEditingId(tpl.id); setName(tpl.name); setCategory(tpl.category); setBody(tpl.body);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta plantilla?')) return;
    await supabase.from('whatsapp_user_templates').delete().eq('id', id);
    onRefresh();
  };

  const handleDuplicate = async (tpl: UserTemplate) => {
    await supabase.from('whatsapp_user_templates').insert({ user_id: userId, name: `${tpl.name} (copia)`, category: tpl.category, body: tpl.body });
    onRefresh();
  };

  const handleToggleFavorite = async (tpl: UserTemplate) => {
    await supabase.from('whatsapp_user_templates').update({ is_favorite: !tpl.is_favorite }).eq('id', tpl.id);
    onRefresh();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Create/Edit form */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            {editingId ? <Edit3 className="w-4 h-4 text-amber-500" /> : <Plus className="w-4 h-4 text-emerald-600" />}
            {editingId ? 'Editar plantilla' : 'Nueva plantilla'}
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre"
                className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-accent/40" />
              <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="Categoria (opcional)"
                className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-accent/40" />
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              placeholder="Hola {{nombre_cliente}}, te saluda {{nombre_usuario}} de {{nombre_oficina}}..."
              rows={4} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none" />
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={!name.trim() || !body.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-200 disabled:dark:bg-white/5 text-white disabled:text-neutral-400 rounded-xl text-sm font-medium transition-colors">
                {editingId ? 'Actualizar' : 'Guardar'}
              </button>
              {editingId && <button onClick={() => { setEditingId(null); setName(''); setCategory(''); setBody(''); }} className="px-4 py-2.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl">Cancelar</button>}
            </div>
          </div>
        </div>

        {/* Filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setFilterCategory('')} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', !filterCategory ? 'bg-emerald-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-white/60 hover:bg-neutral-200')}>Todas</button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', filterCategory === cat ? 'bg-emerald-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-white/60 hover:bg-neutral-200')}>{cat}</button>
            ))}
          </div>
        )}

        {/* Templates list */}
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-3">Mis plantillas ({filtered.length})</h3>
          {filtered.length === 0 ? (
            <div className="text-center py-10 bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50">
              <Zap className="w-8 h-8 text-neutral-300 dark:text-white/20 mx-auto mb-2" />
              <p className="text-sm text-neutral-500 dark:text-white/40">No tienes plantillas aun</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(tpl => (
                <div key={tpl.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {tpl.is_favorite && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        <h4 className="text-sm font-semibold text-neutral-800 dark:text-white">{tpl.name}</h4>
                        {tpl.category && <span className="text-[9px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-white/40 rounded">{tpl.category}</span>}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-white/40 mt-1 line-clamp-2">{tpl.body}</p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleToggleFavorite(tpl)} className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" title="Favorito"><Star className={cn('w-3.5 h-3.5', tpl.is_favorite ? 'text-amber-500 fill-amber-500' : 'text-neutral-300')} /></button>
                      <button onClick={() => onUseTemplate(tpl.body)} className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" title="Usar"><Send className="w-3.5 h-3.5 text-emerald-600" /></button>
                      <button onClick={() => handleDuplicate(tpl)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg" title="Duplicar"><Copy className="w-3.5 h-3.5 text-neutral-400" /></button>
                      <button onClick={() => handleEdit(tpl)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Editar"><Edit3 className="w-3.5 h-3.5 text-blue-500" /></button>
                      <button onClick={() => handleDelete(tpl.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Eliminar"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Variables reference */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-5 border border-neutral-200/50 dark:border-neutral-700/50">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-white mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-neutral-400" /> Variables disponibles</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { var: '{{nombre_cliente}}', desc: 'Nombre del contacto' },
              { var: '{{nombre_usuario}}', desc: 'Tu nombre' },
              { var: '{{nombre_agente}}', desc: 'Nombre agente' },
              { var: '{{telefono_usuario}}', desc: 'Tu telefono' },
              { var: '{{email_usuario}}', desc: 'Tu email' },
              { var: '{{tipo_seguro}}', desc: 'Tipo de seguro' },
              { var: '{{fecha_vencimiento}}', desc: 'Fecha vencimiento' },
              { var: '{{liga_seguwallet}}', desc: 'Liga Seguwallet' },
              { var: '{{liga_formulario}}', desc: 'Liga formulario' },
              { var: '{{nombre_oficina}}', desc: 'Nombre oficina' },
              { var: '{{telefono_oficina}}', desc: 'Telefono oficina' },
              { var: '{{email_oficina}}', desc: 'Email oficina' },
            ].map(v => (
              <div key={v.var} className="text-xs">
                <code className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">{v.var}</code>
                <span className="text-neutral-400 dark:text-white/30 ml-1.5">{v.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
