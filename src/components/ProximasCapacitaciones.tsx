import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Sesion {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  duracion_minutos: number;
  instructor?: { id: string; nombre_completo: string } | null;
  esta_activa: boolean;
  estado: 'programada' | 'en_vivo' | 'finalizada' | 'cancelada';
}

export function ProximasCapacitaciones() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSesiones();
  }, [usuario]);

  const fetchSesiones = async () => {
    if (!usuario) return;

    try {
      const { data, error } = await supabase
        .from('aula_virtual_sesiones')
        .select(`
          id,
          titulo,
          descripcion,
          fecha_inicio,
          duracion_minutos,
          esta_activa,
          estado,
          instructor:usuarios!aula_virtual_sesiones_instructor_id_fkey(id, nombre_completo)
        `)
        .eq('estado', 'programada')
        .gte('fecha_inicio', new Date().toISOString())
        .order('fecha_inicio', { ascending: true })
        .limit(5);

      if (error) throw error;

      setSesiones(data || []);
    } catch (error) {
      console.error('Error fetching sesiones:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-ios-2xl shadow-ios-lg border border-ios-gray-200/50 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-ios-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-20 bg-ios-gray-100 rounded-ios-lg"></div>
            <div className="h-20 bg-ios-gray-100 rounded-ios-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-ios-2xl shadow-ios-lg border border-ios-gray-200/50 overflow-hidden">
      <div className="bg-ios-gray-50 px-6 py-4 border-b border-ios-gray-200/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-bold text-ios-gray-900">Próximas Capacitaciones</h2>
            <p className="text-[13px] text-ios-gray-600 mt-0.5">Sesiones programadas del Aula Virtual</p>
          </div>
          <Calendar className="w-5 h-5 text-ios-blue" />
        </div>
      </div>

      <div className="p-6">
        {sesiones.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-ios-gray-400 mx-auto mb-3" />
            <p className="text-[15px] text-ios-gray-600">No hay capacitaciones programadas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sesiones.map((sesion) => {
              const fechaSesion = new Date(sesion.fecha_inicio);
              const fechaStr = format(fechaSesion, "dd 'de' MMMM", { locale: es });
              const horaStr = format(fechaSesion, 'HH:mm', { locale: es });

              return (
                <div
                  key={sesion.id}
                  onClick={() => navigate('/seguros-education/aula-virtual')}
                  className="p-4 bg-ios-gray-50 rounded-ios-lg border border-ios-gray-200/50 hover:bg-ios-gray-100 hover:border-ios-blue/30 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <h3 className="font-semibold text-ios-gray-900 text-[15px] mb-2 line-clamp-1">
                    {sesion.titulo}
                  </h3>

                  {sesion.descripcion && (
                    <p className="text-[13px] text-ios-gray-600 mb-3 line-clamp-2">
                      {sesion.descripcion}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[13px] text-ios-gray-600">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {fechaStr}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {horaStr} ({sesion.duracion_minutos} min)
                    </span>
                    {sesion.instructor && (
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {sesion.instructor.nombre_completo}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => navigate('/seguros-education/aula-virtual')}
          className="w-full mt-4 px-4 py-2.5 bg-ios-blue text-white rounded-ios-lg hover:bg-ios-blue-dark transition-colors text-[15px] font-medium active:scale-[0.98]"
        >
          Ver Todas las Sesiones
        </button>
      </div>
    </div>
  );
}
