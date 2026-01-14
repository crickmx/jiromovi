import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Users, CheckCircle, Cake } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CalendarioEvento {
  id: string;
  fecha: string;
  tipo: 'evento' | 'tarea' | 'cumpleanos';
  titulo: string;
  descripcion?: string;
  hora?: string;
  ubicacion?: string;
  contacto?: string;
  completada?: boolean;
  deep_link?: string;
}

interface DetalleEventoProps {
  evento: CalendarioEvento | null;
  onClose: () => void;
  onNavigate?: (url: string) => void;
}

function DetalleEvento({ evento, onClose, onNavigate }: DetalleEventoProps) {
  if (!evento) return null;

  const handleActionClick = () => {
    if (evento.deep_link && onNavigate) {
      onNavigate(evento.deep_link);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              {evento.tipo === 'evento' ? (
                <div className="bg-primary-100 p-2 rounded-lg">
                  <CalendarIcon className="h-5 w-5 text-primary-600" />
                </div>
              ) : evento.tipo === 'cumpleanos' ? (
                <div className="bg-pink-100 p-2 rounded-lg">
                  <Cake className="h-5 w-5 text-pink-600" />
                </div>
              ) : (
                <div className="bg-orange-100 p-2 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-orange-600" />
                </div>
              )}
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                {evento.tipo === 'evento' ? 'Seguros Education' : evento.tipo === 'cumpleanos' ? 'Cumpleaños / Aniversario' : 'Tarea CRM'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-gray-900">{evento.titulo}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-3 text-gray-600">
            <CalendarIcon className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">
              {new Date(evento.fecha).toLocaleDateString('es-MX', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>

          {evento.hora && (
            <div className="flex items-center space-x-3 text-gray-600">
              <Clock className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{evento.hora}</span>
            </div>
          )}

          {evento.ubicacion && (
            <div className="flex items-center space-x-3 text-gray-600">
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{evento.ubicacion}</span>
            </div>
          )}

          {evento.contacto && (
            <div className="flex items-center space-x-3 text-gray-600">
              <Users className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{evento.contacto}</span>
            </div>
          )}

          {evento.descripcion && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-700">{evento.descripcion}</p>
            </div>
          )}

          {evento.tipo === 'tarea' && evento.completada !== undefined && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <CheckCircle className={`h-5 w-5 ${evento.completada ? 'text-green-600' : 'text-gray-400'}`} />
                <span className={`text-sm font-medium ${evento.completada ? 'text-green-600' : 'text-gray-600'}`}>
                  {evento.completada ? 'Completada' : 'Pendiente'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-2">
          {evento.deep_link && (
            <button
              onClick={handleActionClick}
              className="w-full bg-pink-600 text-white py-2 rounded-lg hover:bg-pink-700 transition flex items-center justify-center gap-2"
            >
              <Cake className="h-4 w-4" />
              Ver Contacto en Mi CRM
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarioEventos() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventos, setEventos] = useState<CalendarioEvento[]>([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<CalendarioEvento | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarEventos();
  }, [currentDate, usuario]);

  const cargarEventos = async () => {
    if (!usuario) return;

    try {
      setLoading(true);
      const primerDia = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const ultimoDia = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const eventosEducation = await cargarEventosEducation(primerDia, ultimoDia);
      const tareasCRM = await cargarTareasCRM(primerDia, ultimoDia);
      const cumpleanos = await cargarCumpleanos(primerDia, ultimoDia);

      setEventos([...eventosEducation, ...tareasCRM, ...cumpleanos]);
    } catch (error) {
      console.error('Error al cargar eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarEventosEducation = async (inicio: Date, fin: Date): Promise<CalendarioEvento[]> => {
    const { data } = await supabase
      .from('aula_eventos')
      .select('*')
      .gte('fecha', inicio.toISOString().split('T')[0])
      .lte('fecha', fin.toISOString().split('T')[0])
      .order('fecha', { ascending: true });

    return (data || []).map(evento => ({
      id: evento.id,
      fecha: evento.fecha,
      tipo: 'evento' as const,
      titulo: evento.titulo,
      descripcion: evento.descripcion,
      hora: evento.hora || undefined,
      ubicacion: undefined,
    }));
  };

  const cargarTareasCRM = async (inicio: Date, fin: Date): Promise<CalendarioEvento[]> => {
    const { data } = await supabase
      .from('crm_tareas')
      .select('*, crm_contactos(nombre_completo)')
      .gte('fecha_vencimiento', inicio.toISOString().split('T')[0])
      .lte('fecha_vencimiento', fin.toISOString().split('T')[0])
      .order('fecha_vencimiento', { ascending: true });

    return (data || []).map(tarea => ({
      id: tarea.id,
      fecha: tarea.fecha_vencimiento,
      tipo: 'tarea' as const,
      titulo: tarea.tipo_actividad,
      descripcion: tarea.descripcion,
      contacto: (tarea.crm_contactos as any)?.nombre_completo,
      completada: tarea.completada,
    }));
  };

  const cargarCumpleanos = async (inicio: Date, fin: Date): Promise<CalendarioEvento[]> => {
    if (!usuario) return [];

    const { data } = await supabase
      .from('crm_contactos')
      .select('id, nombre_completo, fecha_nacimiento')
      .eq('creado_por', usuario.id)
      .not('fecha_nacimiento', 'is', null)
      .order('fecha_nacimiento');

    if (!data) return [];

    const anoActual = inicio.getFullYear();
    const eventos: CalendarioEvento[] = [];

    for (const contacto of data) {
      const fechaNacimiento = new Date(contacto.fecha_nacimiento! + 'T00:00:00');

      const cumpleanosEsteAno = new Date(
        anoActual,
        fechaNacimiento.getMonth(),
        fechaNacimiento.getDate()
      );

      if (cumpleanosEsteAno >= inicio && cumpleanosEsteAno <= fin) {
        const edadActual = anoActual - fechaNacimiento.getFullYear();
        eventos.push({
          id: contacto.id,
          fecha: cumpleanosEsteAno.toISOString().split('T')[0],
          tipo: 'cumpleanos' as const,
          titulo: `🎂 ${contacto.nombre_completo}`,
          descripcion: `Cumpleaños #${edadActual}`,
          deep_link: `/mi-crm/contactos/${contacto.id}`,
        });
      }
    }

    return eventos;
  };

  const getDiasDelMes = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);
    const diasPrevios = primerDia.getDay();

    const dias = [];

    for (let i = 0; i < diasPrevios; i++) {
      const fecha = new Date(year, month, -diasPrevios + i + 1);
      dias.push({ fecha, esDelMes: false });
    }

    for (let i = 1; i <= ultimoDia.getDate(); i++) {
      dias.push({ fecha: new Date(year, month, i), esDelMes: true });
    }

    const diasRestantes = 42 - dias.length;
    for (let i = 1; i <= diasRestantes; i++) {
      dias.push({ fecha: new Date(year, month + 1, i), esDelMes: false });
    }

    return dias;
  };

  const getEventosDelDia = (fecha: Date) => {
    return eventos.filter(evento => {
      const fechaEvento = new Date(evento.fecha);
      return (
        fechaEvento.getDate() === fecha.getDate() &&
        fechaEvento.getMonth() === fecha.getMonth() &&
        fechaEvento.getFullYear() === fecha.getFullYear()
      );
    });
  };

  const mesAnterior = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const mesSiguiente = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const hoy = new Date();
  const esHoy = (fecha: Date) => {
    return (
      fecha.getDate() === hoy.getDate() &&
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getFullYear() === hoy.getFullYear()
    );
  };

  const dias = getDiasDelMes();

  return (
    <>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={mesAnterior}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
              title="Mes anterior"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <button
              onClick={mesSiguiente}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
              title="Mes siguiente"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((dia) => (
                <div key={dia} className="text-center text-xs font-semibold text-gray-600 py-1">
                  {dia}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {dias.map((dia, index) => {
                const eventosDelDia = getEventosDelDia(dia.fecha);
                const tieneEventos = eventosDelDia.length > 0;
                const eventosEducation = eventosDelDia.filter(e => e.tipo === 'evento');
                const tareasCRM = eventosDelDia.filter(e => e.tipo === 'tarea');

                const cumpleanos = eventosDelDia.filter(e => e.tipo === 'cumpleanos');

                return (
                  <div
                    key={index}
                    className={`min-h-[60px] p-1.5 border rounded-lg transition ${
                      dia.esDelMes
                        ? esHoy(dia.fecha)
                          ? 'bg-primary-50 border-primary-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                        : 'bg-gray-50 border-gray-100'
                    } ${tieneEventos && dia.esDelMes ? 'cursor-pointer' : ''}`}
                  >
                    <div className={`text-xs font-medium mb-1 ${
                      dia.esDelMes
                        ? esHoy(dia.fecha)
                          ? 'text-primary-600'
                          : 'text-gray-900'
                        : 'text-gray-400'
                    }`}>
                      {dia.fecha.getDate()}
                    </div>

                    {dia.esDelMes && tieneEventos && (
                      <div className="space-y-0.5">
                        {cumpleanos.length > 0 && (
                          <button
                            onClick={() => setEventoSeleccionado(cumpleanos[0])}
                            className="w-full text-left"
                          >
                            <div className="bg-pink-100 text-pink-700 text-[10px] px-1.5 py-0.5 rounded truncate hover:bg-pink-200 transition">
                              {cumpleanos.length === 1 ? (
                                cumpleanos[0].titulo.substring(0, 15) + (cumpleanos[0].titulo.length > 15 ? '...' : '')
                              ) : (
                                `${cumpleanos.length} cumpleaños`
                              )}
                            </div>
                          </button>
                        )}

                        {eventosEducation.length > 0 && (
                          <button
                            onClick={() => setEventoSeleccionado(eventosEducation[0])}
                            className="w-full text-left"
                          >
                            <div className="bg-primary-100 text-primary-700 text-[10px] px-1.5 py-0.5 rounded truncate hover:bg-primary-200 transition">
                              {eventosEducation.length === 1 ? (
                                eventosEducation[0].titulo.substring(0, 15) + (eventosEducation[0].titulo.length > 15 ? '...' : '')
                              ) : (
                                `${eventosEducation.length} eventos`
                              )}
                            </div>
                          </button>
                        )}

                        {tareasCRM.length > 0 && (
                          <button
                            onClick={() => setEventoSeleccionado(tareasCRM[0])}
                            className="w-full text-left"
                          >
                            <div className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded truncate hover:bg-orange-200 transition">
                              {tareasCRM.length === 1 ? (
                                tareasCRM[0].titulo.substring(0, 15) + (tareasCRM[0].titulo.length > 15 ? '...' : '')
                              ) : (
                                `${tareasCRM.length} tareas`
                              )}
                            </div>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-center space-x-4 text-xs flex-wrap gap-2">
              <div className="flex items-center space-x-1.5">
                <div className="w-2.5 h-2.5 bg-pink-500 rounded"></div>
                <span className="text-gray-600">Cumpleaños / Aniversario</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-2.5 h-2.5 bg-primary-500 rounded"></div>
                <span className="text-gray-600">Seguros Education</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-2.5 h-2.5 bg-orange-500 rounded"></div>
                <span className="text-gray-600">Tareas CRM</span>
              </div>
            </div>
          </>
        )}
      </div>

      <DetalleEvento
        evento={eventoSeleccionado}
        onClose={() => setEventoSeleccionado(null)}
        onNavigate={navigate}
      />
    </>
  );
}
