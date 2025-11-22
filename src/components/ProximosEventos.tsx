import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, User } from 'lucide-react';

interface AulaEvento {
  id: string;
  titulo: string;
  descripcion: string;
  ponente: string;
  fecha: string;
  hora: string;
  link_sesion: string;
  visible_para_todos: boolean;
}

export function ProximosEventos() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [eventos, setEventos] = useState<AulaEvento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProximosEventos();
  }, [usuario]);

  const loadProximosEventos = async () => {
    if (!usuario) return;

    try {
      setLoading(true);
      const hoy = new Date().toISOString().split('T')[0];

      // Obtener eventos visibles para todos o con permisos específicos
      const { data: eventosData, error } = await supabase
        .from('aula_eventos')
        .select('*')
        .gte('fecha', hoy)
        .order('fecha', { ascending: true })
        .order('hora', { ascending: true })
        .limit(3);

      if (error) throw error;

      if (eventosData) {
        // Filtrar eventos según permisos
        const eventosConPermiso = await Promise.all(
          eventosData.map(async (evento) => {
            // Si es visible para todos, incluirlo
            if (evento.visible_para_todos) {
              return evento;
            }

            // Verificar si el usuario tiene permiso específico
            const { data: permisos } = await supabase
              .from('aula_eventos_permisos')
              .select('*')
              .eq('evento_id', evento.id)
              .or(
                `usuario_id.eq.${usuario.id},rol.eq.${usuario.rol},oficina_id.eq.${usuario.oficina_id}`
              )
              .limit(1);

            return permisos && permisos.length > 0 ? evento : null;
          })
        );

        setEventos(eventosConPermiso.filter((e) => e !== null) as AulaEvento[]);
      }
    } catch (error) {
      console.error('Error cargando próximos eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fecha: string) => {
    try {
      const date = new Date(fecha + 'T00:00:00');
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const dia = date.getDate();
      const mes = meses[date.getMonth()];
      return `${dia} de ${mes}`;
    } catch {
      return fecha;
    }
  };

  const formatearHora = (hora: string) => {
    try {
      const [hours, minutes] = hora.split(':');
      return `${hours}:${minutes}`;
    } catch {
      return hora;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 rounded-ios bg-ios-blue/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-ios-blue stroke-[1.5]" />
          </div>
          <h2 className="text-[20px] font-semibold text-ios-gray-900">Próximos Eventos</h2>
        </div>
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-[3px] border-ios-blue border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 overflow-hidden">
      <div className="bg-ios-gray-50 px-6 py-5 border-b border-ios-gray-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-ios bg-ios-blue/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-ios-blue stroke-[1.5]" />
            </div>
            <h2 className="text-[20px] font-semibold text-ios-gray-900">Próximos Eventos</h2>
          </div>
          <button
            onClick={() => navigate('/seguros-education/aula-digital')}
            className="text-ios-blue text-[15px] font-medium hover:text-ios-blue-dark transition-colors"
          >
            Ver todos →
          </button>
        </div>
        <p className="text-ios-gray-600 text-[13px] mt-2">Seguros Education</p>
      </div>

      <div className="p-5">
        {eventos.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-8 h-8 text-ios-gray-400 stroke-[1.5]" />
            </div>
            <p className="text-ios-gray-500 text-[15px]">No hay eventos programados</p>
            <p className="text-ios-gray-400 text-[13px] mt-1">Los próximos eventos aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-2">
            {eventos.map((evento) => (
              <div
                key={evento.id}
                onClick={() => navigate('/seguros-education/aula-digital')}
                className="p-4 bg-ios-gray-50 rounded-ios-lg hover:bg-ios-gray-100 active:scale-[0.99] transition-all duration-200 cursor-pointer"
              >
                <h3 className="font-semibold text-ios-gray-900 text-[15px] mb-2">
                  {evento.titulo}
                </h3>
                <div className="flex flex-wrap gap-3 text-[13px] text-ios-gray-600">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 stroke-[1.5]" />
                    <span>{formatearFecha(evento.fecha)}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 stroke-[1.5]" />
                    <span>{formatearHora(evento.hora)}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <User className="w-4 h-4 stroke-[1.5]" />
                    <span>{evento.ponente}</span>
                  </div>
                </div>
                {evento.descripcion && (
                  <p className="text-ios-gray-600 text-[13px] mt-2 line-clamp-2">
                    {evento.descripcion}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
