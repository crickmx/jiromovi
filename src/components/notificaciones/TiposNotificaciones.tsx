import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Power, MessageCircle, AlertCircle, Edit } from 'lucide-react';
import { EditarPlantillaModal } from './EditarPlantillaModal';

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
  const [editingTipo, setEditingTipo] = useState<{ id: string, nombre: string } | null>(null);

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

      console.log('=== TIPOS CARGADOS ===');
      console.log('Total:', data?.length);
      if (data && data.length > 0) {
        console.log('Ejemplo:', {
          nombre: data[0].nombre,
          correo: data[0].enviar_por_correo,
          whatsapp: data[0].enviar_por_whatsapp
        });
      }

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

      const nuevoValor = !valorActual;

      console.log('=== TOGGLE CANAL ===');
      console.log('ID:', id);
      console.log('Campo:', campo);
      console.log('Valor actual:', valorActual);
      console.log('Nuevo valor:', nuevoValor);

      const { error } = await supabase
        .from('correo_tipos_notificacion')
        .update({ [campo]: nuevoValor })
        .eq('id', id);

      if (error) {
        console.error('Error de Supabase:', error);
        throw error;
      }

      console.log('Actualización exitosa en BD');

      const canalNombre = campo === 'enviar_por_correo' ? 'Correo' : 'WhatsApp';
      setMessage({
        type: 'success',
        text: `Canal ${canalNombre} ${nuevoValor ? 'activado' : 'desactivado'} exitosamente`
      });

      await fetchTipos();
      onUpdate();

      console.log('=== FIN TOGGLE ===');
    } catch (error: any) {
      console.error('Error al actualizar canal:', error);
      setMessage({ type: 'error', text: 'Error al actualizar el canal: ' + error.message });
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
        {tipos.map((tipo) => {
          console.log(`Render ${tipo.nombre}:`, {
            correo: tipo.enviar_por_correo,
            whatsapp: tipo.enviar_por_whatsapp
          });

          return (
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
                  onClick={() => setEditingTipo({ id: tipo.id, nombre: tipo.nombre })}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                  title="Editar plantilla"
                >
                  <Edit className="w-4 h-4" />
                  Editar Plantilla
                </button>
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
              <h4 className="text-sm font-semibold text-neutral-700 mb-3">Canales de Envío</h4>
              <div className="flex flex-wrap gap-3">
                {/* Correo */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCanal(tipo.id, 'enviar_por_correo', tipo.enviar_por_correo);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                    tipo.enviar_por_correo
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-300 bg-white hover:border-neutral-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tipo.enviar_por_correo}
                    onChange={(e) => {
                      e.stopPropagation();
                    }}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500 pointer-events-none"
                  />
                  <Mail className={`w-4 h-4 ${tipo.enviar_por_correo ? 'text-primary-600' : 'text-neutral-500'}`} />
                  <span className={`text-sm font-medium ${tipo.enviar_por_correo ? 'text-primary-700' : 'text-neutral-600'}`}>
                    Correo Electrónico
                  </span>
                </div>

                {/* WhatsApp */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCanal(tipo.id, 'enviar_por_whatsapp', tipo.enviar_por_whatsapp);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                    tipo.enviar_por_whatsapp
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-neutral-300 bg-white hover:border-neutral-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tipo.enviar_por_whatsapp}
                    onChange={(e) => {
                      e.stopPropagation();
                    }}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500 pointer-events-none"
                  />
                  <MessageCircle className={`w-4 h-4 ${tipo.enviar_por_whatsapp ? 'text-emerald-600' : 'text-neutral-500'}`} />
                  <span className={`text-sm font-medium ${tipo.enviar_por_whatsapp ? 'text-emerald-700' : 'text-neutral-600'}`}>
                    WhatsApp
                  </span>
                </div>
              </div>

              {/* Indicador de estado */}
              <div className="mt-3 flex items-center gap-2">
                {tipo.enviar_por_correo && tipo.enviar_por_whatsapp && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                    Envío por ambos canales
                  </span>
                )}
                {tipo.enviar_por_correo && !tipo.enviar_por_whatsapp && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 border border-primary-200">
                    Solo por correo
                  </span>
                )}
                {!tipo.enviar_por_correo && tipo.enviar_por_whatsapp && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Solo por WhatsApp
                  </span>
                )}
                {!tipo.enviar_por_correo && !tipo.enviar_por_whatsapp && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                    <AlertCircle className="w-3 h-3" />
                    Sin canal seleccionado
                  </span>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {tipos.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No hay tipos de notificaciones configurados</p>
        </div>
      )}

      {/* Modal de Edición */}
      {editingTipo && (
        <EditarPlantillaModal
          tipoId={editingTipo.id}
          tipoNombre={editingTipo.nombre}
          onClose={() => setEditingTipo(null)}
          onSave={() => {
            fetchTipos();
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
