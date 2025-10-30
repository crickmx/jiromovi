import { useState, useEffect, useRef } from 'react';
import { Info, Send, Paperclip, Download, FileText, Image as ImageIcon, Video, Music } from 'lucide-react';
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
  const [uploading, setUploading] = useState(false);
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

  const handleSend = async () => {
    if (!newMessage.trim() || !usuario) {
      console.log('[ChatMessages] No se puede enviar: mensaje vacío o sin usuario');
      return;
    }

    console.log('[ChatMessages] Enviando mensaje...', {
      chat_id: chat.id,
      remitente_id: usuario.id,
      mensaje: newMessage.trim()
    });

    const { data, error } = await supabase
      .from('chat_mensajes')
      .insert({
        chat_id: chat.id,
        remitente_id: usuario.id,
        mensaje: newMessage.trim(),
        tipo: 'texto'
      })
      .select();

    if (error) {
      console.error('[ChatMessages] Error enviando mensaje:', error);
      alert(`Error al enviar mensaje: ${error.message}`);
    } else {
      console.log('[ChatMessages] Mensaje enviado exitosamente:', data);

      // Actualizar timestamp del chat
      await supabase
        .from('chats')
        .update({ ultimo_mensaje_at: new Date().toISOString() })
        .eq('id', chat.id);

      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (selectedFile) {
        handleSendWithFile();
      } else {
        handleSend();
      }
    }
  };

  const handleDownloadFile = async (fileUrl: string, fileName: string) => {
    try {
      console.log('[ChatMessages] Descargando archivo:', fileName);

      // Si es una URL de Supabase Storage
      if (fileUrl.includes('supabase')) {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Para URLs externas, abrir en nueva pestaña
        window.open(fileUrl, '_blank');
      }
    } catch (error) {
      console.error('[ChatMessages] Error descargando archivo:', error);
      alert('Error al descargar el archivo');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    if (fileType.startsWith('video/')) return <Video className="w-5 h-5" />;
    if (fileType.startsWith('audio/')) return <Music className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('[ChatMessages] Archivo seleccionado:', file.name, file.type, file.size);

      // Validar tamaño (10MB)
      if (file.size > 10485760) {
        alert('El archivo es demasiado grande. Máximo 10MB permitido.');
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File): Promise<{ url: string; path: string } | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${usuario!.id}/${fileName}`;

      console.log('[ChatMessages] Subiendo archivo:', filePath);

      const { error: uploadError, data } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);

      if (uploadError) {
        console.error('[ChatMessages] Error subiendo archivo:', uploadError);
        console.error('[ChatMessages] Detalles del error:', {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          error: uploadError
        });

        if (uploadError.message?.includes('policy') || uploadError.statusCode === '403') {
          throw new Error('No tienes permisos para subir archivos. Verifica la configuración de políticas RLS en Storage.');
        }

        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

      console.log('[ChatMessages] Archivo subido exitosamente:', publicUrl);

      return { url: publicUrl, path: filePath };
    } catch (error) {
      console.error('[ChatMessages] Error en uploadFile:', error);
      return null;
    }
  };

  const getMessageType = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'imagen';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'archivo';
  };

  const handleSendWithFile = async () => {
    if ((!newMessage.trim() && !selectedFile) || !usuario) {
      console.log('[ChatMessages] No hay mensaje ni archivo para enviar');
      return;
    }

    setUploading(true);

    try {
      let fileData = null;

      // Subir archivo si existe
      if (selectedFile) {
        console.log('[ChatMessages] Subiendo archivo adjunto...');
        const uploadResult = await uploadFile(selectedFile);

        if (!uploadResult) {
          throw new Error('Error al subir el archivo');
        }

        fileData = {
          archivo_url: uploadResult.url,
          archivo_nombre: selectedFile.name,
          archivo_tipo: selectedFile.type,
          archivo_tamano: selectedFile.size,
          tipo: getMessageType(selectedFile.type)
        };
      }

      // Insertar mensaje
      const messageData: any = {
        chat_id: chat.id,
        remitente_id: usuario.id,
        mensaje: newMessage.trim() || (selectedFile ? `Archivo: ${selectedFile.name}` : ''),
        tipo: fileData ? fileData.tipo : 'texto'
      };

      if (fileData) {
        messageData.archivo_url = fileData.archivo_url;
        messageData.archivo_nombre = fileData.archivo_nombre;
        messageData.archivo_tipo = fileData.archivo_tipo;
        messageData.archivo_tamano = fileData.archivo_tamano;
      }

      console.log('[ChatMessages] Enviando mensaje con datos:', messageData);

      const { error } = await supabase
        .from('chat_mensajes')
        .insert(messageData);

      if (error) {
        console.error('[ChatMessages] Error enviando mensaje:', error);
        throw error;
      }

      // Actualizar timestamp del chat
      await supabase
        .from('chats')
        .update({ ultimo_mensaje_at: new Date().toISOString() })
        .eq('id', chat.id);

      console.log('[ChatMessages] Mensaje enviado exitosamente');
      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('[ChatMessages] Error:', error);
      alert(`Error al enviar mensaje: ${error.message || 'Error desconocido'}`);
    } finally {
      setUploading(false);
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
                        {message.mensaje && (
                          <p className="whitespace-pre-wrap break-words">{message.mensaje}</p>
                        )}

                        {/* Archivo adjunto */}
                        {message.archivo_url && (
                          <div className={`mt-2 ${message.mensaje ? 'pt-2 border-t' : ''} ${
                            isMine ? 'border-blue-400' : 'border-neutral-200'
                          }`}>
                            {message.tipo === 'imagen' && message.archivo_tipo?.startsWith('image/') ? (
                              <div className="space-y-2">
                                <img
                                  src={message.archivo_url}
                                  alt={message.archivo_nombre}
                                  className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(message.archivo_url, '_blank')}
                                />
                                <button
                                  onClick={() => handleDownloadFile(message.archivo_url, message.archivo_nombre)}
                                  className={`flex items-center space-x-2 text-sm ${
                                    isMine ? 'text-blue-100 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'
                                  }`}
                                >
                                  <Download className="w-4 h-4" />
                                  <span>{message.archivo_nombre}</span>
                                  {message.archivo_tamano && (
                                    <span className="text-xs opacity-70">
                                      ({formatFileSize(message.archivo_tamano)})
                                    </span>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleDownloadFile(message.archivo_url, message.archivo_nombre)}
                                className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                                  isMine
                                    ? 'bg-blue-500 hover:bg-blue-400'
                                    : 'bg-neutral-100 hover:bg-neutral-200'
                                }`}
                              >
                                <div className={isMine ? 'text-white' : 'text-neutral-700'}>
                                  {getFileIcon(message.archivo_tipo || '')}
                                </div>
                                <div className="flex-1 text-left">
                                  <p className="text-sm font-medium">{message.archivo_nombre}</p>
                                  {message.archivo_tamano && (
                                    <p className="text-xs opacity-70">
                                      {formatFileSize(message.archivo_tamano)}
                                    </p>
                                  )}
                                </div>
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                          </div>
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
        {/* Archivo seleccionado */}
        {selectedFile && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-blue-600">
                {getFileIcon(selectedFile.type)}
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">{selectedFile.name}</p>
                <p className="text-xs text-neutral-600">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={handleRemoveFile}
              className="p-1 hover:bg-blue-100 rounded transition-colors"
              title="Remover archivo"
            >
              <span className="text-blue-600 text-xl leading-none">&times;</span>
            </button>
          </div>
        )}

        <div className="flex items-end space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
            title="Adjuntar archivo"
          >
            <Paperclip className="w-5 h-5 text-neutral-600" />
          </button>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe un mensaje..."
            rows={1}
            disabled={uploading}
            className="flex-1 px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
          />
          <button
            onClick={selectedFile ? handleSendWithFile : handleSend}
            disabled={(!newMessage.trim() && !selectedFile) || uploading}
            className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
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
