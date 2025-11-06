import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerSesionesProgramadas, type SesionConRegistro } from '../lib/educationSesionesUtils';
import { Video, Calendar, Clock, ArrowRight, GraduationCap, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function ProximasCapacitaciones() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SesionConRegistro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUpcomingSessions();
  }, []);

  const loadUpcomingSessions = async () => {
    setLoading(true);
    try {
      const data = await obtenerSesionesProgramadas({ estatus: 'programada' });
      const now = new Date();

      const upcoming = data
        .filter(s => {
          const sessionDate = new Date(`${s.fecha}T${s.hora}`);
          return sessionDate > now;
        })
        .sort((a, b) => {
          const dateA = new Date(`${a.fecha}T${a.hora}`);
          const dateB = new Date(`${b.fecha}T${b.hora}`);
          return dateA.getTime() - dateB.getTime();
        })
        .slice(0, 5);

      setSessions(upcoming);
    } catch (error) {
      console.error('Error loading upcoming sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <GraduationCap className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Próximas Capacitaciones</h2>
            <p className="text-sm text-slate-600">No hay capacitaciones programadas</p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-slate-500 mb-4">No hay capacitaciones próximas</p>
          <button
            onClick={() => navigate('/seguros-education/aula-virtual')}
            className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
          >
            Ver Aula Digital →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <GraduationCap className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Próximas Capacitaciones</h2>
            <p className="text-sm text-slate-600">
              {sessions.length} {sessions.length === 1 ? 'sesión programada' : 'sesiones programadas'}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/seguros-education/aula-virtual')}
          className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
        >
          Ver todas →
        </button>
      </div>

      <div className="space-y-3">
        {sessions.map((session) => {
          const sessionDate = new Date(`${session.fecha}T${session.hora}`);
          const dateStr = format(sessionDate, "d 'de' MMMM", { locale: es });
          const timeStr = session.hora.slice(0, 5);

          return (
            <div
              key={session.id}
              className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-1">
                    {session.titulo}
                  </h3>
                  <p className="text-xs text-emerald-600 font-medium mb-2">
                    {session.compania}
                  </p>
                  {session.descripcion && (
                    <p className="text-sm text-slate-600 mb-2 line-clamp-1">
                      {session.descripcion}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 text-sm text-slate-600">
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {dateStr}
                    </span>
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {timeStr}
                    </span>
                  </div>
                  {session.ponente && (
                    <p className="text-xs text-slate-500 mt-1">
                      Ponente: {session.ponente}
                    </p>
                  )}
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Programada
                </span>
              </div>

              <button
                onClick={() => navigate('/seguros-education/aula-virtual')}
                className="w-full flex items-center justify-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium"
              >
                <span>Ver Detalles</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {sessions.length >= 5 && (
        <button
          onClick={() => navigate('/seguros-education/aula-virtual')}
          className="w-full mt-4 text-center text-sm text-emerald-600 hover:text-emerald-700 font-medium py-2 hover:bg-emerald-50 rounded-lg transition"
        >
          Ver más capacitaciones
        </button>
      )}
    </div>
  );
}
