import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Power, MessageCircle, AlertCircle } from 'lucide-react';

interface TipoNotificacion {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  es_personalizada: boolean;
  enviar_por_correo: boolean;
  enviar_por_whatsapp: boolean;
}

interface TiposNotificacionesProps {
  onUpdate: () => void;
}

export function TiposNotificaciones({ onUpdate }: TiposNotificacionesProps) {
  const [tipos, setTipos] = useState<TipoNotificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchTipos();
  }, []);

  const fetchTipos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('correo_tipos_notificacion')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTipos(data || []);
    } catch (error) {
      console.error('Error al cargar tipos:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActivo = async (id: string, activo: boolean) => {
    try {
      setMessage(null);
      const { error } = await supabase
        .from('correo_tipos_notificacion')
        .update({ activo: !activo })
        .eq('id', id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `Notificación ${!activo ? 'activada' : 'desactivada'} exitosamente`
      });

      fetchTipos();
      onUpdate();
    } catch (error: any) {
      console.error('Error al actualizar:', error);
      setMessage({ type: 'error', text: 'Error al actualizar el estado' });
    }
  };

  const toggleCanal = async (id: string, campo: 'enviar_por_correo' | 'enviar_por_whatsapp', valorActual: boolean) => {
    try {
      setMessage(null);
      const { error } = await supabase
        .from('correo_tipos_notificacion')
        .update({ [campo]: !valorActual })
        .eq('id', id);

      if (error) throw error;

      fetchTipos();
      onUpdate();
    } catch (error: any) {
      console.error('Error al actualizar canal:', error);
      setMessage({ type: 'error', text: 'Error al actualizar el canal' });
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-neutral-600">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-accent-50 text-accent-800 border border-accent-200'
        }`}>
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <div className="space-y-3">
        {tipos.map((tipo) => (
          <div
            key={tipo.id}
            className="bg-white rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors"
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4 flex-1">
                <Mail className={`w-5 h-5 ${tipo.activo ? 'text-primary-600' : 'text-neutral-400'}`} />
                <div className="flex-1">
                  <h3 className="font-semibold text-neutral-800">{tipo.nombre}</h3>
                  {tipo.descripcion && (
                    <p className="text-sm text-neutral-600 mt-1">{tipo.descripcion}</p>
                  )}
                  <span className="inline-block mt-2 px-2 py-1 text-xs rounded bg-neutral-200 text-neutral-700">
                    {tipo.codigo}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleActivo(tipo.id, tipo.activo)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    tipo.activo
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  {tipo.activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            </div>

            {/* Canales de Envío */}
            <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3">
              <h4 className="text-sm font-semibold text-neutral-700 mb-3">Canales de Envío:</h4>
              <div className="flex flex-wrap gap-4">
                {/* Correo */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tipo.enviar_por_correo}
                    onChange={() => toggleCanal(tipo.id, 'enviar_por_correo', tipo.enviar_por_correo)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                  />
                  <Mail className="w-4 h-4 text-primary-600" />
                  <span className="text-sm text-neutral-700">Correo</span>
                </label>

                {/* WhatsApp */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tipo.enviar_por_whatsapp}
                    onChange={() => toggleCanal(tipo.id, 'enviar_por_whatsapp', tipo.enviar_por_whatsapp)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
                  />
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-neutral-700">WhatsApp</span>
                </label>

                {/* Indicador Ambos */}
                {tipo.enviar_por_correo && tipo.enviar_por_whatsapp && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    📧 + 💬 Ambos canales
                  </span>
                )}
              </div>

              {!tipo.enviar_por_correo && !tipo.enviar_por_whatsapp && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Selecciona al menos un canal de envío
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {tipos.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No hay tipos de notificaciones configurados</p>
        </div>
      )}
    </div>
  );
}
