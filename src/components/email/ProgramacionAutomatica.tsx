import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Clock, Save, Play } from 'lucide-react';

interface Plantilla {
  id: string;
  nombre: string;
  tipo: string;
  asunto: string;
  activo: boolean;
  envio_automatico: boolean;
  hora_envio: string;
}

export function ProgramacionAutomatica() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadPlantillas();
  }, []);

  const loadPlantillas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('plantillas_correo')
      .select('*')
      .in('tipo', ['cumpleanos', 'aniversario'])
      .order('tipo');

    if (error) {
      console.error('Error loading templates:', error);
    } else {
      setPlantillas(data || []);
    }
    setLoading(false);
  };

  const handleToggleAutomatico = async (id: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('plantillas_correo')
        .update({
          envio_automatico: !currentValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setPlantillas(
        plantillas.map((p) =>
          p.id === id ? { ...p, envio_automatico: !currentValue } : p
        )
      );

      setMessage({
        type: 'success',
        text: `Envío automático ${!currentValue ? 'activado' : 'desactivado'}`,
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleUpdateHora = async (id: string, hora: string) => {
    try {
      const { error } = await supabase
        .from('plantillas_correo')
        .update({
          hora_envio: hora,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setPlantillas(
        plantillas.map((p) => (p.id === id ? { ...p, hora_envio: hora } : p))
      );

      setMessage({ type: 'success', text: 'Hora de envío actualizada' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleTestSchedule = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-scheduled-emails`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al ejecutar verificación');
      }

      setMessage({
        type: 'success',
        text: `Verificación completada: ${result.resultados.cumpleanos} cumpleaños, ${result.resultados.aniversarios} aniversarios, ${result.resultados.errores} errores`,
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setTesting(false);
    }
  };

  const tipoLabels: Record<string, string> = {
    cumpleanos: 'Cumpleaños',
    aniversario: 'Aniversario laboral',
  };

  const tipoDescriptions: Record<string, string> = {
    cumpleanos: 'Se envía automáticamente en la fecha de cumpleaños del usuario (fecha_nacimiento)',
    aniversario: 'Se envía automáticamente en el aniversario laboral del usuario (fecha_ingreso)',
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <Calendar className="w-5 h-5 text-primary-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-primary-900 mb-2">Funcionamiento automático</h3>
            <p className="text-sm text-primary-800 mb-2">
              El sistema verifica diariamente si hay usuarios con cumpleaños o aniversarios laborales y envía
              automáticamente los correos configurados.
            </p>
            <p className="text-sm text-primary-800">
              <strong>Importante:</strong> Los correos solo se envían una vez por año a cada usuario. Si deseas
              probar la funcionalidad sin esperar a las fechas reales, usa el botón de prueba manual.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex justify-end">
        <button
          onClick={handleTestSchedule}
          disabled={testing}
          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50"
        >
          <Play className="w-5 h-5" />
          <span>{testing ? 'Ejecutando...' : 'Ejecutar verificación ahora'}</span>
        </button>
      </div>

      <div className="space-y-6">
        {plantillas.map((plantilla) => (
          <div
            key={plantilla.id}
            className={`border rounded-lg p-6 ${
              plantilla.envio_automatico
                ? 'border-green-300 bg-green-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-slate-900">{plantilla.nombre}</h3>
                  <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded">
                    {tipoLabels[plantilla.tipo]}
                  </span>
                  {plantilla.envio_automatico && (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                      Activo
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mb-3">{tipoDescriptions[plantilla.tipo]}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center space-x-3 p-4 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={plantilla.envio_automatico}
                    onChange={() => handleToggleAutomatico(plantilla.id, plantilla.envio_automatico)}
                    className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                  />
                  <div>
                    <p className="font-medium text-slate-900">Envío automático</p>
                    <p className="text-xs text-slate-500">Activar/desactivar envíos automáticos</p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Hora de envío
                </label>
                <div className="flex space-x-2">
                  <input
                    type="time"
                    value={plantilla.hora_envio}
                    onChange={(e) => handleUpdateHora(plantilla.id, e.target.value)}
                    disabled={!plantilla.envio_automatico}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Los correos se enviarán a esta hora (hora del servidor)
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-100 rounded-lg">
              <p className="text-sm text-slate-600">
                <strong>Asunto actual:</strong> {plantilla.asunto}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-lg">
        <h3 className="font-semibold text-slate-900 mb-3">Configuración del servidor</h3>
        <p className="text-sm text-slate-600 mb-4">
          Para que los correos se envíen automáticamente, necesitas configurar un cron job o tarea programada
          que llame a la función <code className="px-2 py-1 bg-slate-200 rounded">check-scheduled-emails</code>{' '}
          diariamente.
        </p>
        <div className="bg-slate-800 text-slate-100 p-4 rounded-lg font-mono text-sm">
          <p>URL de la función:</p>
          <p className="text-primary-300 break-all">
            {import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-scheduled-emails
          </p>
          <p className="mt-3">Ejemplo de cron (ejecutar diariamente a las 8:00 AM):</p>
          <p className="text-green-300">0 8 * * * curl -X POST [URL]</p>
        </div>
      </div>
    </div>
  );
}
