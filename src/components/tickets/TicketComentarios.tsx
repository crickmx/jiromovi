import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Send, Upload, X, FileText } from 'lucide-react';

interface Comentario {
  id: string;
  mensaje: string;
  fecha_hora: string;
  usuario: {
    id: string;
    nombre_completo: string;
    rol: string;
  } | null;
}

interface TicketComentariosProps {
  ticketId: string;
}

export function TicketComentarios({ ticketId }: TicketComentariosProps) {
  const { usuario } = useAuth();
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadComentarios();

    const subscription = supabase
      .channel(`ticket_comentarios_${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_comentarios',
          filter: `ticket_id=eq.${ticketId}`
        },
        async (payload) => {
          const { data } = await supabase
            .from('ticket_comentarios')
            .select('*, usuario:usuario_id(id, nombre_completo, rol)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setComentarios(prev => {
              const exists = prev.some(c => c.id === data.id);
              if (exists) return prev;

              const hasTempComment = prev.some(c => c.id.startsWith('temp-') && c.usuario?.id === data.usuario?.id);
              if (hasTempComment && data.usuario?.id === usuario?.id) {
                return prev;
              }

              return [...prev, data as Comentario];
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [comentarios]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadComentarios = async () => {
    const { data } = await supabase
      .from('ticket_comentarios')
      .select('*, usuario:usuario_id(id, nombre_completo, rol)')
      .eq('ticket_id', ticketId)
      .order('fecha_hora', { ascending: true });

    if (data) {
      setComentarios(data as Comentario[]);
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setArchivo(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!mensaje.trim() && !archivo) || !usuario) return;

    setSending(true);

    const tempId = `temp-${Date.now()}`;
    let mensajeTexto = mensaje.trim();

    try {
      if (archivo) {
        const fileExt = archivo.name.split('.').pop();
        const fileName = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('ticket-archivos')
          .upload(fileName, archivo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('ticket-archivos')
          .getPublicUrl(fileName);

        const { error: archivoError } = await supabase
          .from('ticket_archivos')
          .insert({
            ticket_id: ticketId,
            usuario_id: usuario.id,
            nombre: archivo.name,
            url: publicUrl,
            tipo: archivo.type,
            tamano: archivo.size
          });

        if (archivoError) throw archivoError;

        if (!mensajeTexto) {
          mensajeTexto = `📎 Archivo adjunto: ${archivo.name}`;
        } else {
          mensajeTexto += `\n\n📎 Archivo adjunto: ${archivo.name}`;
        }
      }

      const optimisticComment: Comentario = {
        id: tempId,
        mensaje: mensajeTexto,
        fecha_hora: new Date().toISOString(),
        usuario: {
          id: usuario.id,
          nombre_completo: usuario.nombre_completo,
          rol: usuario.rol
        }
      };

      setComentarios(prev => [...prev, optimisticComment]);
      setMensaje('');
      setArchivo(null);

      const { data, error } = await supabase
        .from('ticket_comentarios')
        .insert({
          ticket_id: ticketId,
          usuario_id: usuario.id,
          mensaje: mensajeTexto
        })
        .select('*, usuario:usuario_id(id, nombre_completo, rol)')
        .single();

      if (error) throw error;

      setComentarios(prev =>
        prev.map(c => c.id === tempId ? data as Comentario : c)
      );

    } catch (err: any) {
      console.error('Error sending message:', err);
      alert('Error al enviar el mensaje');
      setComentarios(prev => prev.filter(c => c.id !== tempId));
      setMensaje(mensajeTexto);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {comentarios.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <p>No hay comentarios aún</p>
            <p className="text-sm mt-2">Sé el primero en comentar</p>
          </div>
        ) : (
          comentarios.map((comentario) => {
            const isOwn = comentario.usuario?.id === usuario?.id;
            return (
              <div
                key={comentario.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                  <div className="flex items-center space-x-2 mb-1">
                    {!isOwn && (
                      <>
                        <span className="text-sm font-semibold text-neutral-900">
                          {comentario.usuario?.nombre_completo}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                          {comentario.usuario?.rol}
                        </span>
                      </>
                    )}
                    <span className="text-xs text-neutral-500">
                      {new Date(comentario.fecha_hora).toLocaleString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div
                    className={`px-4 py-3 rounded-2xl whitespace-pre-wrap ${
                      isOwn
                        ? 'bg-primary-600 text-white'
                        : 'bg-neutral-100 text-neutral-900'
                    }`}
                  >
                    {comentario.mensaje}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-neutral-200 pt-4">
        {archivo && (
          <div className="mb-3 flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-900">{archivo.name}</span>
              <span className="text-xs text-neutral-500">
                ({(archivo.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setArchivo(null)}
              className="text-red-600 hover:text-red-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escribe un comentario..."
              rows={3}
              className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSubmit(e);
                }
              }}
            />
          </div>
          <div className="flex flex-col space-y-2">
            <label
              htmlFor="file-upload-comment"
              className="p-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl cursor-pointer transition-all"
              title="Adjuntar archivo"
            >
              <Upload className="w-5 h-5" />
              <input
                id="file-upload-comment"
                type="file"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <button
              type="submit"
              disabled={sending || (!mensaje.trim() && !archivo)}
              className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Enviar (Ctrl+Enter)"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          Presiona Ctrl+Enter para enviar
        </p>
      </form>
    </div>
  );
}
