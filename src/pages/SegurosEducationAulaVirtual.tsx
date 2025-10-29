import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, Plus, Users, Video, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Session {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  hora: string;
  oficinas_asignadas: string[];
  esta_activa: boolean;
  enlace_aula: string | null;
  enlace_invitado: string | null;
  grabar: boolean;
}

export function SegurosEducationAulaVirtual() {
  const { usuario } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('seguros_sessions')
        .select('*')
        .order('fecha', { ascending: true })
        .order('hora', { ascending: true });

      if (error) throw error;

      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const active = data?.filter((s) => s.esta_activa) || [];
      const upcoming = data?.filter((s) => {
        const sessionDate = new Date(s.fecha);
        return sessionDate >= now && !s.esta_activa;
      }) || [];

      setSessions(data || []);
      setActiveSessions(active);
      setUpcomingSessions(upcoming);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = (session: Session) => {
    if (!session.esta_activa) {
      alert('Esta sesión aún no está activa. Por favor, espera hasta la hora programada.');
      return;
    }

    // In a full implementation, this would open the video conferencing interface
    alert(
      `Unirse a: ${session.titulo}\n\n` +
      `NOTA: La funcionalidad completa de Aula Virtual requiere:\n` +
      `- Integración con WebRTC\n` +
      `- Servidor de señalización\n` +
      `- Grabación de video en tiempo real\n` +
      `- Gestión de participantes\n\n` +
      `Por ahora, esta es una vista previa de la interfaz.`
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-600">Cargando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-800 flex items-center gap-2">
              <Video className="w-6 h-6 text-emerald-600" />
              Aula Virtual
            </h1>
            <p className="text-neutral-600 mt-1">Capacitaciones en vivo</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear Sesión
            </button>
          )}
        </div>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <h2 className="text-xl font-bold">Transmisiones en Vivo</h2>
            </div>
            <div className="space-y-4">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{session.titulo}</h3>
                      <p className="text-emerald-50 text-sm mb-3">{session.descripcion}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          En vivo ahora
                        </span>
                        {session.grabar && (
                          <span className="flex items-center gap-1 bg-red-500 px-2 py-1 rounded">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            Grabando
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinSession(session)}
                      className="px-6 py-3 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors font-semibold"
                    >
                      Ingresar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Active Sessions Message */}
        {activeSessions.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">
                  No hay transmisiones activas
                </h3>
                <p className="text-amber-800 text-sm">
                  No hay capacitaciones en vivo en este momento. Por favor, regresa cuando una
                  capacitación esté en curso o revisa las próximas sesiones programadas abajo.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Sessions */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Próximas Sesiones Programadas
            </h2>
          </div>
          <div className="p-6">
            {upcomingSessions.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-500">No hay sesiones programadas</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-start gap-4 p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                  >
                    <div className="w-16 h-16 bg-primary-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-2xl font-bold text-primary-700">
                        {format(new Date(session.fecha), 'dd', { locale: es })}
                      </span>
                      <span className="text-xs text-primary-600 uppercase">
                        {format(new Date(session.fecha), 'MMM', { locale: es })}
                      </span>
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold text-neutral-800 mb-1">{session.titulo}</h3>
                      <p className="text-sm text-neutral-600 mb-2">{session.descripcion}</p>
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(session.fecha), 'EEEE, dd MMMM yyyy', { locale: es })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.hora}
                        </span>
                        {session.grabar && (
                          <span className="flex items-center gap-1 text-red-600">
                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                            Se grabará
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleJoinSession(session)}
                      className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-white transition-colors text-sm font-medium"
                    >
                      Ver Detalles
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Session Modal (Placeholder) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-xl font-bold text-neutral-800">Crear Nueva Sesión</h2>
            </div>
            <div className="p-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> La funcionalidad completa de Aula Virtual requiere:
                </p>
                <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc">
                  <li>Integración con servidor WebRTC para video en tiempo real</li>
                  <li>Sistema de grabación de sesiones</li>
                  <li>Gestión de participantes y permisos</li>
                  <li>Generación de enlaces únicos para invitados</li>
                  <li>Conversión automática de grabaciones a formato On Demand</li>
                </ul>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  onClick={() => {
                    alert('Funcionalidad de creación de sesiones pendiente de implementación completa.');
                    setShowCreateModal(false);
                  }}
                >
                  Crear Sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
