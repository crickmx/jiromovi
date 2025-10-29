import { useState, useEffect, useRef } from 'react';
import { Info, Send, Paperclip, X, FileText, Image as ImageIcon, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChatMessagesProps {
  chat: any;
  getChatName: (chat: any) => string;
  onShowInfo: () => void;
}

export function ChatMessages({ chat, getChatName, onShowInfo }: ChatMessagesProps) {
  const { usuario } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chat) {
      console.log('[ChatMessages] Cargando chat:', chat.id);
      loadMessages();

      // Suscribirse a nuevos mensajes
      console.log('[ChatMessages] Configurando suscripción realtime...');
      const subscription = supabase
        .channel(`chat-${chat.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_mensajes',
          filter: `chat_id=eq.${chat.id}`
        }, (payload) => {
          console.log('[ChatMessages] Nuevo mensaje recibido:', payload.new);
          setMessages(prev => [...prev, payload.new]);
          setTimeout(scrollToBottom, 100);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_mensajes',
          filter: `chat_id=eq.${chat.id}`
        }, (payload) => {
          console.log('[ChatMessages] Mensaje actualizado:', payload.new);
          setMessages(prev => prev.map(msg => msg.id === payload.new.id ? payload.new : msg));
        })
        .subscribe((status) => {
          console.log('[ChatMessages] Estado de suscripción:', status);
        });

      return () => {
        console.log('[ChatMessages] Desuscribiendo del chat:', chat.id);
        subscription.unsubscribe();
      };
    }
  }, [chat]);

  const loadMessages = async () => {
    setLoading(true);
    console.log('[ChatMessages] Cargando mensajes del chat:', chat.id);

    const { data, error } = await supabase
      .from('chat_mensajes')
      .select(`
        *,
        usuarios:remitente_id (
          id,
          nombre,
          apellidos,
          imagen_perfil_url
        )
      `)
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[ChatMessages] Error cargando mensajes:', error);
    } else {
      console.log('[ChatMessages] Mensajes cargados:', data?.length || 0);
      setMessages(data || []);
      setTimeout(scrollToBottom, 100);
    }
    setLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${chat.id}/${usuario?.id}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);

    return {
      url: publicUrl,
      path: fileName
    };
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !selectedFile) || !usuario) {
      console.log('[ChatMessages] No se puede enviar: mensaje vacío o sin usuario');
      return;
    }

    try {
      setUploadingFile(true);

      let fileData = null;
      let tipo = 'texto';

      if (selectedFile) {
        console.log('[ChatMessages] Subiendo archivo...', selectedFile.name);
        const { url, path } = await uploadFile(selectedFile);

        fileData = {
          archivo_url: path,
          archivo_nombre: selectedFile.name,
          archivo_tipo: selectedFile.type,
          archivo_tamano: selectedFile.size
        };

        if (selectedFile.type.startsWith('image/')) tipo = 'imagen';
        else if (selectedFile.type.startsWith('video/')) tipo = 'video';
        else if (selectedFile.type.startsWith('audio/')) tipo = 'audio';
        else tipo = 'archivo';
      }

      console.log('[ChatMessages] Enviando mensaje...', {
        chat_id: chat.id,
        remitente_id: usuario.id,
        mensaje: newMessage.trim() || selectedFile?.name || '',
        tipo,
        ...fileData
      });

      const { data, error } = await supabase
        .from('chat_mensajes')
        .insert({
          chat_id: chat.id,
          remitente_id: usuario.id,
          mensaje: newMessage.trim() || selectedFile?.name || '',
          tipo,
          ...fileData
        })
        .select();

      if (error) {
        console.error('[ChatMessages] Error enviando mensaje:', error);
        alert(`Error al enviar mensaje: ${error.message}`);
      } else {
        console.log('[ChatMessages] Mensaje enviado exitosamente:', data);
        setNewMessage('');
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error: any) {
      console.error('[ChatMessages] Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setUploadingFile(false);
    }
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .download(filePath);

    if (error) {
      console.error('Error descargando archivo:', error);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">{getChatName(chat)}</h2>
          <p className="text-sm text-neutral-600">
            {chat.miembros?.length || 0} participantes
          </p>
        </div>
        <button
          onClick={onShowInfo}
          className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <Info className="w-5 h-5 text-neutral-600" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50">
        {loading ? (
          <div className="text-center text-neutral-600">Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-neutral-500 py-12">
            <p>No hay mensajes aún</p>
            <p className="text-sm mt-2">Sé el primero en escribir</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.remitente_id === usuario?.id;
            const sender = message.usuarios;

            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-lg ${isMine ? 'order-2' : 'order-1'}`}>
                  {!isMine && sender && (
                    <p className="text-xs text-neutral-600 mb-1 px-3">
                      {sender.nombre} {sender.apellidos}
                    </p>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      isMine
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-neutral-900 border border-neutral-200'
                    }`}
                  >
                    {message.eliminado ? (
                      <p className="italic text-sm opacity-70">
                        Este mensaje fue eliminado
                      </p>
                    ) : (
                      <>
                        {message.tipo === 'imagen' && message.archivo_url ? (
                          <div className="space-y-2">
                            <img
                              src={supabase.storage.from('chat-attachments').getPublicUrl(message.archivo_url).data.publicUrl}
                              alt={message.archivo_nombre}
                              className="max-w-xs rounded-lg cursor-pointer"
                              onClick={() => window.open(supabase.storage.from('chat-attachments').getPublicUrl(message.archivo_url).data.publicUrl, '_blank')}
                            />
                            {message.mensaje && message.mensaje !== message.archivo_nombre && (
                              <p className="whitespace-pre-wrap break-words">{message.mensaje}</p>
                            )}
                          </div>
                        ) : message.archivo_url ? (
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${isMine ? 'bg-blue-700' : 'bg-neutral-100'}`}>
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{message.archivo_nombre}</p>
                              <p className="text-xs opacity-70">
                                {(message.archivo_tamano / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <button
                              onClick={() => downloadFile(message.archivo_url, message.archivo_nombre)}
                              className={`p-1 rounded hover:bg-opacity-20 hover:bg-neutral-900 transition-colors`}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{message.mensaje}</p>
                        )}
                        {message.editado && (
                          <p className="text-xs opacity-70 mt-1">(editado)</p>
                        )}
                      </>
                    )}
                  </div>
                  <p
                    className={`text-xs text-neutral-500 mt-1 px-3 ${
                      isMine ? 'text-right' : 'text-left'
                    }`}
                  >
                    {format(new Date(message.created_at), 'HH:mm', { locale: es })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-neutral-200 p-4">
        {selectedFile && (
          <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {selectedFile.type.startsWith('image/') ? (
                <ImageIcon className="w-5 h-5 text-blue-600" />
              ) : (
                <FileText className="w-5 h-5 text-blue-600" />
              )}
              <div>
                <p className="text-sm font-medium text-neutral-900">{selectedFile.name}</p>
                <p className="text-xs text-neutral-600">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="p-1 hover:bg-blue-100 rounded transition-colors"
            >
              <X className="w-4 h-4 text-neutral-600" />
            </button>
          </div>
        )}
        <div className="flex items-end space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,video/*,audio/*"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            title="Adjuntar archivo"
            disabled={uploadingFile}
          >
            <Paperclip className="w-5 h-5 text-neutral-600" />
          </button>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={uploadingFile}
          />
          <button
            onClick={handleSend}
            disabled={(!newMessage.trim() && !selectedFile) || uploadingFile}
            className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadingFile ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
