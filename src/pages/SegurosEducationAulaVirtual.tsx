import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Calendar, Clock, Plus, Users, Video, AlertCircle,
  Play, Pause, Link as LinkIcon, Copy, CheckCircle,
  Trash2, Settings, BarChart3, Download, FileVideo, ArrowLeft, Upload
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BaseModal } from '../components/BaseModal';
import { PublicarOnDemandModal, PublicarOnDemandData } from '../components/PublicarOnDemandModal';
import {
  obtenerSesiones,
  obtenerGrabaciones,
  crearSesion,
  iniciarSesion,
  finalizarSesion,
  unirseASesion,
  convertirGrabacionAOnDemand,
  generarEnlaceInvitado,
  generarEnlaceSala,
  copiarAlPortapapeles,
  type AulaSession,
  type AulaGrabacion
} from '../lib/aulaVirtualUtils';
import { analyticsTracker } from '../lib/analyticsTracker';

export function SegurosEducationAulaVirtual() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<AulaSession[]>([]);
  const [grabaciones, setGrabaciones] = useState<AulaGrabacion[]>([]);
  const [activeSessions, setActiveSessions] = useState<AulaSession[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<AulaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGrabacionesModal, setShowGrabacionesModal] = useState(false);
  const [showPublicarModal, setShowPublicarModal] = useState(false);
  const [grabacionAPublicar, setGrabacionAPublicar] = useState<AulaGrabacion | null>(null);
  const [selectedSession, setSelectedSession] = useState<AulaSession | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminPermissions();
    fetchData();
  }, [usuario]);

  const checkAdminPermissions = async () => {
    if (!usuario) {
      setIsAdmin(false);
      return;
    }

    if (usuario.rol === 'Administrador') {
      setIsAdmin(true);
      return;
    }

    if (usuario.rol === 'Gerente') {
      try {
        const { data, error } = await supabase.rpc('tiene_permiso_admin_en_modulo', {
          p_usuario_id: usuario.id,
          p_modulo_codigo: 'seguros_education'
        });

        if (!error && data) {
          setIsAdmin(true);
          return;
        }
      } catch (error) {
        console.error('Error verificando permisos:', error);
      }
    }

    setIsAdmin(false);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Iniciando fetchData...');

      const [sesionesData, grabacionesData] = await Promise.all([
        obtenerSesiones(),
        obtenerGrabaciones()
      ]);

      console.log('📊 Total sesiones obtenidas:', sesionesData?.length || 0);
      console.log('📋 Sesiones completas:', sesionesData);

      if (!sesionesData || sesionesData.length === 0) {
        console.warn('⚠️ No se obtuvieron sesiones de la base de datos');
        setSessions([]);
        setActiveSessions([]);
        setUpcomingSessions([]);
        setGrabaciones(grabacionesData || []);
        return;
      }

      const now = new Date();
      console.log('🕐 Hora actual:', now.toISOString());

      const active = sesionesData.filter(s => {
        const isActive = s.esta_activa === true;
        if (isActive) console.log('🔴 Sesión ACTIVA:', s.titulo);
        return isActive;
      });

      const upcoming = sesionesData.filter(s => {
        if (!s.fecha_inicio || !s.estado) {
          console.log(`⚠️ Sesión "${s.titulo}" sin fecha_inicio o estado`);
          return false;
        }

        const sessionDate = new Date(s.fecha_inicio);
        const sessionTime = sessionDate.getTime();
        const nowTime = now.getTime();

        const isFuture = sessionTime > nowTime;
        const isNotActive = s.esta_activa === false;
        const isProgrammed = s.estado === 'programada';
        const isUpcoming = isFuture && isNotActive && isProgrammed;

        console.log(`
📅 Sesión: "${s.titulo}"
   - Fecha sesión: ${sessionDate.toISOString()} (${sessionTime})
   - Fecha actual: ${now.toISOString()} (${nowTime})
   - Diferencia ms: ${sessionTime - nowTime}
   - Es futura: ${isFuture}
   - Esta activa: ${s.esta_activa}
   - No activa: ${isNotActive}
   - Estado: ${s.estado}
   - Es programada: ${isProgrammed}
   - ✅ ES PRÓXIMA: ${isUpcoming}
        `);

        return isUpcoming;
      });

      console.log('🔴 Total sesiones ACTIVAS:', active.length, active);
      console.log('📅 Total sesiones PRÓXIMAS:', upcoming.length, upcoming);

      setSessions(sesionesData);
      setActiveSessions(active);
      setUpcomingSessions(upcoming);
      setGrabaciones(grabacionesData || []);

      console.log('✅ Estado actualizado correctamente');
    } catch (error) {
      console.error('❌ Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearSesion = async (formData: any) => {
    try {
      const nuevaSesion = await crearSesion(formData);
      console.log('Sesión creada exitosamente:', nuevaSesion);
      await fetchData();
      setShowCreateModal(false);
      alert('Sesión creada exitosamente. Aparecerá en "Próximas Sesiones".');
    } catch (error: any) {
      console.error('Error al crear sesión:', error);
      alert(error.message || 'Error al crear la sesión');
      throw error;
    }
  };

  const handleIniciarSesion = async (sessionId: string) => {
    if (!confirm('¿Estás seguro de iniciar esta sesión? Todos los participantes podrán ingresar.')) {
      return;
    }

    try {
      await iniciarSesion(sessionId);
      await fetchData();
    } catch (error: any) {
      alert(error.message || 'Error al iniciar la sesión');
    }
  };

  const handleFinalizarSesion = async (sessionId: string) => {
    if (!confirm('¿Finalizar esta sesión? Se desconectará a todos los participantes.')) {
      return;
    }

    try {
      await finalizarSesion(sessionId);
      await fetchData();
    } catch (error: any) {
      alert(error.message || 'Error al finalizar la sesión');
    }
  };

  const handleUnirseASesion = async (sessionId: string) => {
    try {
      // Track class join click
      analyticsTracker.trackClassJoinClick(sessionId);

      const result = await unirseASesion(sessionId);

      // Track class join success
      analyticsTracker.trackClassJoinSuccess(sessionId);

      window.location.href = `/aula-virtual/sala/${result.session.room_id}`;
    } catch (error: any) {
      alert(error.message || 'Error al unirse a la sesión');
    }
  };

  const handleCopiarEnlace = async (session: AulaSession, tipo: 'sala' | 'invitado') => {
    try {
      const enlace = tipo === 'sala'
        ? generarEnlaceSala(session)
        : generarEnlaceInvitado(session);

      await copiarAlPortapapeles(enlace);
      setCopiedLink(`${session.id}-${tipo}`);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      alert('Error al copiar enlace');
    }
  };

  const handleConvertirAOnDemand = (grabacion: AulaGrabacion) => {
    setGrabacionAPublicar(grabacion);
    setShowPublicarModal(true);
  };

  const handlePublicarOnDemand = async (data: PublicarOnDemandData) => {
    if (!grabacionAPublicar) return;

    try {
      await convertirGrabacionAOnDemand(grabacionAPublicar.id, {
        titulo: data.titulo,
        descripcion: data.descripcion,
        categoriaId: data.categoria_id,
        duracionMinutos: data.duracion_minutos,
        activa: data.activa,
        oficinaIds: data.oficina_ids,
        publicar: data.activa
      });

      await fetchData();
      setShowPublicarModal(false);
      setGrabacionAPublicar(null);
      alert('Grabación publicada exitosamente en On Demand');
    } catch (error: any) {
      throw new Error(error.message || 'Error al publicar la grabación');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-600">Cargando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/seguros-education')}
              className="p-2 text-slate-600 hover:text-accent hover:bg-slate-100 rounded-lg transition-colors"
              title="Volver a Seguros Education"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Video className="w-6 h-6 text-accent" />
                Aula Virtual
              </h1>
              <p className="text-slate-600 mt-1">Capacitaciones en vivo con WebRTC</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowGrabacionesModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all text-sm font-medium"
            >
              <FileVideo className="w-4 h-4" />
              Grabaciones ({grabaciones.length})
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Nueva Sesión
              </button>
            )}
          </div>
        </div>

        {activeSessions.length > 0 && (
          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <h2 className="text-xl font-bold">Transmisiones EN VIVO</h2>
            </div>
            <div className="space-y-4">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white/20 backdrop-blur-sm rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{session.titulo}</h3>
                      <p className="text-red-50 text-sm mb-3">{session.descripcion}</p>
                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          En vivo ahora
                        </span>
                        {session.grabar_sesion && (
                          <span className="flex items-center gap-1 bg-white/30 px-2 py-1 rounded">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            Grabando
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {format(new Date(session.iniciada_at!), 'HH:mm', { locale: es })}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleCopiarEnlace(session, 'sala')}
                            className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
                            title="Copiar enlace de sala"
                          >
                            {copiedLink === `${session.id}-sala` ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              <LinkIcon className="w-5 h-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleFinalizarSesion(session.id)}
                            className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
                            title="Finalizar sesión"
                          >
                            <Pause className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleUnirseASesion(session.id)}
                        className="px-6 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-all font-semibold"
                      >
                        Ingresar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSessions.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">
                  No hay transmisiones activas
                </h3>
                <p className="text-amber-800 text-sm">
                  No hay capacitaciones en vivo en este momento. Revisa las próximas sesiones programadas.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent" />
              Próximas Sesiones
            </h2>
          </div>
          <div className="p-4">
            {upcomingSessions.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No hay sesiones programadas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all"
                  >
                    <div className="w-16 h-16 bg-primary-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-accent">
                        {format(new Date(session.fecha_inicio), 'MMM', { locale: es }).toUpperCase()}
                      </span>
                      <span className="text-2xl font-bold text-primary-700">
                        {format(new Date(session.fecha_inicio), 'd')}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 mb-1">{session.titulo}</h3>
                      <p className="text-slate-600 text-sm mb-2">{session.descripcion}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {format(new Date(session.fecha_inicio), 'HH:mm', { locale: es })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          Máx. {session.max_participantes}
                        </span>
                        {session.grabar_sesion && (
                          <span className="flex items-center gap-1 text-red-600">
                            <Video className="w-4 h-4" />
                            Se grabará
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopiarEnlace(session, 'invitado')}
                          className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-all text-sm"
                          title="Copiar enlace para invitados"
                        >
                          {copiedLink === `${session.id}-invitado` ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleIniciarSesion(session.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium flex items-center gap-1"
                        >
                          <Play className="w-4 h-4" />
                          Iniciar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CrearSesionModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCrearSesion}
        />
      )}

      {showGrabacionesModal && (
        <GrabacionesModal
          grabaciones={grabaciones}
          onClose={() => setShowGrabacionesModal(false)}
          onConvertir={handleConvertirAOnDemand}
          isAdmin={isAdmin}
        />
      )}

      {showPublicarModal && grabacionAPublicar && (
        <PublicarOnDemandModal
          isOpen={showPublicarModal}
          onClose={() => {
            setShowPublicarModal(false);
            setGrabacionAPublicar(null);
          }}
          onPublicar={handlePublicarOnDemand}
          grabacionTitulo={grabacionAPublicar.sesion?.titulo || 'Grabación de sesión'}
        />
      )}
    </Layout>
  );
}

function CrearSesionModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (data: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getDefaultDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const fecha = now.toISOString().split('T')[0];
    const hora = now.toTimeString().slice(0, 5);
    return { fecha, hora };
  };

  const defaultDateTime = getDefaultDateTime();

  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    fecha_inicio: defaultDateTime.fecha,
    hora_inicio: defaultDateTime.hora,
    duracion_minutos: 60,
    grabar_sesion: true,
    max_participantes: 30
  });

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!formData.titulo.trim()) {
      setError('El título es requerido');
      return;
    }

    if (!formData.fecha_inicio || !formData.hora_inicio) {
      setError('La fecha y hora son requeridas');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fecha_inicio = new Date(`${formData.fecha_inicio}T${formData.hora_inicio}`).toISOString();
      const fecha_fin = new Date(fecha_inicio);
      fecha_fin.setMinutes(fecha_fin.getMinutes() + formData.duracion_minutos);

      await onSuccess({
        titulo: formData.titulo.trim(),
        descripcion: formData.descripcion.trim() || null,
        fecha_inicio,
        fecha_fin: fecha_fin.toISOString(),
        duracion_minutos: formData.duracion_minutos,
        grabar_sesion: formData.grabar_sesion,
        max_participantes: formData.max_participantes
      });
    } catch (err: any) {
      console.error('Error en formulario:', err);
      setError(err.message || 'Error al crear la sesión');
      setLoading(false);
    }
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="submit"
        form="crear-sesion-form"
        disabled={loading}
        className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-all disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear Sesión'}
      </button>
    </>
  );

  return (
    <BaseModal isOpen={true} onClose={onClose} title="Nueva Sesión en Vivo" footer={footer} maxWidth="2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3" id="crear-sesion-form">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Título *</label>
          <input
            type="text"
            value={formData.titulo}
            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            required
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej: Introducción a Seguros de Vida"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Descripción</label>
          <textarea
            value={formData.descripcion}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Descripción de la sesión"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Fecha *</label>
            <input
              type="date"
              value={formData.fecha_inicio}
              onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Hora *</label>
            <input
              type="time"
              value={formData.hora_inicio}
              onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Duración (minutos)</label>
            <input
              type="number"
              value={formData.duracion_minutos}
              onChange={(e) => setFormData({ ...formData, duracion_minutos: parseInt(e.target.value) })}
              min="15"
              max="480"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Máx. Participantes</label>
            <input
              type="number"
              value={formData.max_participantes}
              onChange={(e) => setFormData({ ...formData, max_participantes: parseInt(e.target.value) })}
              min="2"
              max="100"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="grabar"
            checked={formData.grabar_sesion}
            onChange={(e) => setFormData({ ...formData, grabar_sesion: e.target.checked })}
            className="w-4 h-4 text-accent border-slate-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="grabar" className="text-sm text-slate-700">
            Grabar sesión automáticamente
          </label>
        </div>
      </form>
    </BaseModal>
  );
}

function GrabacionesModal({
  grabaciones,
  onClose,
  onConvertir,
  isAdmin
}: {
  grabaciones: AulaGrabacion[];
  onClose: () => void;
  onConvertir: (grabacion: AulaGrabacion) => void;
  isAdmin: boolean;
}) {
  return (
    <BaseModal isOpen={true} onClose={onClose} title="Grabaciones de Sesiones" maxWidth="3xl">
      <div className="space-y-3">
        {grabaciones.length === 0 ? (
          <div className="text-center py-12">
            <FileVideo className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No hay grabaciones disponibles</p>
          </div>
        ) : (
          grabaciones.map((grabacion) => (
            <div key={grabacion.id} className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-1">
                    {grabacion.sesion?.titulo || 'Grabación de sesión'}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {grabacion.duracion_segundos ? `${Math.floor(grabacion.duracion_segundos / 60)} min` : 'N/A'}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileVideo className="w-3 h-3" />
                      {grabacion.formato_procesado.toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      grabacion.estado_procesamiento === 'completado' ? 'bg-green-100 text-green-700' :
                      grabacion.estado_procesamiento === 'procesando' ? 'bg-primary-100 text-primary-700' :
                      grabacion.estado_procesamiento === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {grabacion.estado_procesamiento}
                    </span>
                    {grabacion.publicado_ondemand && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        Publicado On Demand
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    ID: {grabacion.id.substring(0, 8)}...
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {grabacion.archivo_procesado_url ? (
                    <a
                      href={grabacion.archivo_procesado_url}
                      download
                      className="flex items-center gap-2 px-4 py-2 bg-accent text-white hover:bg-accent-hover rounded-lg text-sm font-medium transition-all"
                      title="Descargar grabación"
                    >
                      <Download className="w-4 h-4" />
                      Descargar
                    </a>
                  ) : (
                    <div className="px-4 py-2 bg-slate-100 text-slate-400 rounded-lg text-sm font-medium cursor-not-allowed">
                      Sin archivo
                    </div>
                  )}
                  {isAdmin && grabacion.estado_procesamiento === 'completado' && !grabacion.publicado_ondemand && (
                    <button
                      onClick={() => onConvertir(grabacion)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-medium transition-all"
                      title="Publicar en On Demand"
                    >
                      <Upload className="w-4 h-4" />
                      Publicar On Demand
                    </button>
                  )}
                  {!isAdmin && (
                    <div className="text-xs text-slate-400 text-center">
                      Requiere permisos de administrador
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </BaseModal>
  );
}
