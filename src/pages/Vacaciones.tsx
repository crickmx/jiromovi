import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Palmtree } from 'lucide-react';
import { calcularDiasLaborables, formatearFecha, getEstadoBadgeClass, getEstadoLabel } from '../lib/vacacionesUtils';
import type { Database } from '../lib/database.types';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';

type SolicitudVacaciones = Database['public']['Tables']['solicitudes_vacaciones']['Row'] & {
  empleado?: { nombre_completo: string; email_laboral: string; oficina_id: string } | null;
};

export function Vacaciones() {
  const { usuario: currentUser } = useAuth();
  const [diasDisponibles, setDiasDisponibles] = useState(0);
  const [solicitudes, setSolicitudes] = useState<SolicitudVacaciones[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fecha_inicio: '',
    fecha_fin: '',
  });

  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const diasSolicitados = formData.fecha_inicio && formData.fecha_fin
    ? calcularDiasLaborables(formData.fecha_inicio, formData.fecha_fin)
    : 0;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [diasRes, solicitudesRes] = await Promise.all([
        supabase
          .from('usuarios')
          .select('dias_vacaciones_disponibles')
          .eq('id', currentUser?.id || '')
          .single(),
        loadSolicitudes(),
      ]);

      if (diasRes.data) {
        setDiasDisponibles(diasRes.data.dias_vacaciones_disponibles || 0);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSolicitudes = async () => {
    let query = supabase
      .from('solicitudes_vacaciones')
      .select('*, empleado:usuarios!usuario_id(nombre_completo, email_laboral, oficina_id)')
      .order('created_at', { ascending: false });

    if (currentUser?.rol === 'Empleado' || currentUser?.rol === 'Agente') {
      query = query.eq('usuario_id', currentUser.id);
    } else if (currentUser?.rol === 'Gerente' && currentUser.oficina_id) {
      // Para gerentes: cargar solicitudes de usuarios de su oficina
      const { data: usuariosOficina } = await supabase
        .from('usuarios')
        .select('id')
        .eq('oficina_id', currentUser.oficina_id);

      if (usuariosOficina && usuariosOficina.length > 0) {
        const usuarioIds = usuariosOficina.map(u => u.id);
        query = query.in('usuario_id', usuarioIds);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading solicitudes:', error);
      return [];
    }

    setSolicitudes(data || []);
    return data || [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (diasSolicitados > diasDisponibles) {
      alert('No tienes suficientes días de vacaciones disponibles');
      return;
    }

    if (diasSolicitados <= 0) {
      alert('Debes seleccionar al menos un día laborable');
      return;
    }

    try {
      const { error } = await supabase.from('solicitudes_vacaciones').insert({
        usuario_id: currentUser?.id,
        fecha_inicio: formData.fecha_inicio,
        fecha_fin: formData.fecha_fin,
        dias_solicitados: diasSolicitados,
        estado: 'pendiente',
      });

      if (error) throw error;

      setShowModal(false);
      setFormData({ fecha_inicio: '', fecha_fin: '' });
      loadData();
      alert('Solicitud de vacaciones enviada correctamente');
    } catch (error: any) {
      console.error('Error creating request:', error);
      alert('Error al crear la solicitud: ' + error.message);
    }
  };

  const handlePreaprobar = async (solicitudId: string) => {
    const comentario = comentarios[solicitudId] || '';
    setProcessingId(solicitudId);

    try {
      const { error } = await supabase
        .from('solicitudes_vacaciones')
        .update({
          estado: 'preaprobado',
          gerente_id: currentUser?.id,
          comentarios_gerente: comentario,
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitudId);

      if (error) throw error;

      loadData();
      alert('Solicitud preaprobada correctamente');
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al preaprobar: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRechazarGerente = async (solicitudId: string) => {
    const comentario = comentarios[solicitudId] || '';
    if (!confirm('¿Estás seguro de rechazar esta solicitud?')) return;

    setProcessingId(solicitudId);

    try {
      const { error } = await supabase
        .from('solicitudes_vacaciones')
        .update({
          estado: 'rechazado',
          gerente_id: currentUser?.id,
          comentarios_gerente: comentario,
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitudId);

      if (error) throw error;

      loadData();
      alert('Solicitud rechazada');
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al rechazar: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleAprobar = async (solicitudId: string, empleadoId: string, diasSolicitados: number) => {
    const comentario = comentarios[solicitudId] || '';
    setProcessingId(solicitudId);

    try {
      const { data: empleadoData } = await supabase
        .from('usuarios')
        .select('dias_vacaciones_disponibles')
        .eq('id', empleadoId)
        .single();

      if (!empleadoData) throw new Error('Empleado no encontrado');

      const nuevoDias = (empleadoData.dias_vacaciones_disponibles || 0) - diasSolicitados;

      const [updateSolicitud, updateUsuario] = await Promise.all([
        supabase
          .from('solicitudes_vacaciones')
          .update({
            estado: 'aprobado',
            administrador_id: currentUser?.id,
            comentarios_administrador: comentario,
            updated_at: new Date().toISOString(),
          })
          .eq('id', solicitudId),
        supabase
          .from('usuarios')
          .update({
            dias_vacaciones_disponibles: nuevoDias,
            updated_at: new Date().toISOString(),
          })
          .eq('id', empleadoId),
      ]);

      if (updateSolicitud.error) throw updateSolicitud.error;
      if (updateUsuario.error) throw updateUsuario.error;

      loadData();
      alert('Solicitud aprobada correctamente');
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al aprobar: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRechazarAdmin = async (solicitudId: string) => {
    const comentario = comentarios[solicitudId] || '';
    if (!confirm('¿Estás seguro de rechazar esta solicitud?')) return;

    setProcessingId(solicitudId);

    try {
      const { error } = await supabase
        .from('solicitudes_vacaciones')
        .update({
          estado: 'rechazado',
          administrador_id: currentUser?.id,
          comentarios_administrador: comentario,
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitudId);

      if (error) throw error;

      loadData();
      alert('Solicitud rechazada');
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al rechazar: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <LoadingState text="Cargando vacaciones..." />;
  }

  const isEmpleado = currentUser?.rol === 'Empleado' || currentUser?.rol === 'Agente';
  const isGerente = currentUser?.rol === 'Gerente';
  const isAdmin = currentUser?.rol === 'Administrador';

  const solicitudesPendientes = solicitudes.filter(s => s.estado === 'pendiente' && s.usuario_id !== currentUser?.id);
  const solicitudesPreaprobadas = solicitudes.filter(s => s.estado === 'preaprobado');
  const misSolicitudes = isGerente ? solicitudes.filter(s => s.usuario_id === currentUser?.id) : solicitudes;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gestion de Vacaciones"
        description={
          isEmpleado ? 'Solicita y gestiona tus dias de vacaciones'
          : isGerente ? 'Solicita tus vacaciones y gestiona las solicitudes de tu oficina'
          : 'Autoriza solicitudes de vacaciones preaprobadas'
        }
        icon={Palmtree}
      />

      {(isEmpleado || isGerente) && (
        <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Mis Dias Disponibles</h2>
              <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5">Dias de vacaciones que puedes solicitar</p>
            </div>
            <div className="bg-accent/10 text-accent px-5 py-3 rounded-xl text-center">
              <div className="text-3xl font-bold">{diasDisponibles}</div>
              <div className="text-xs font-medium opacity-70">dias</div>
            </div>
          </div>
          <Button onClick={() => setShowModal(true)} className="w-full">
            Solicitar Vacaciones
          </Button>
        </div>
      )}

      {isGerente && solicitudesPendientes.length > 0 && (
        <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-5">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-white mb-4">
            Solicitudes Pendientes ({solicitudesPendientes.length})
          </h2>
          <div className="space-y-4">
            {solicitudesPendientes.map((solicitud) => (
              <div key={solicitud.id} className="border border-neutral-200 dark:border-white/10 rounded-xl p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-neutral-900 dark:text-white">
                      {solicitud.empleado?.nombre_completo}
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-white/60">{solicitud.empleado?.email_laboral}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-neutral-700 dark:text-white/70">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatearFecha(solicitud.fecha_inicio)} - {formatearFecha(solicitud.fecha_fin)}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {solicitud.dias_solicitados} días
                      </span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadgeClass(solicitud.estado)}`}>
                    {getEstadoLabel(solicitud.estado)}
                  </span>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Comentarios (opcional)
                  </label>
                  <textarea
                    value={comentarios[solicitud.id] || ''}
                    onChange={(e) => setComentarios({ ...comentarios, [solicitud.id]: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
                    placeholder="Agrega tus comentarios..."
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePreaprobar(solicitud.id)}
                    disabled={processingId === solicitud.id}
                    className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>Preaprobar</span>
                  </button>
                  <button
                    onClick={() => handleRechazarGerente(solicitud.id)}
                    disabled={processingId === solicitud.id}
                    className="flex-1 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" />
                    <span>Rechazar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-5">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-white mb-4">
            Solicitudes Preaprobadas ({solicitudesPreaprobadas.length})
          </h2>
          {solicitudesPreaprobadas.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 dark:text-white/40">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-neutral-300 dark:text-white/20" />
              <p>No hay solicitudes preaprobadas pendientes de autorización</p>
            </div>
          ) : (
            <div className="space-y-4">
              {solicitudesPreaprobadas.map((solicitud) => (
              <div key={solicitud.id} className="border border-neutral-200 dark:border-white/10 rounded-xl p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-neutral-900 dark:text-white">
                      {solicitud.empleado?.nombre_completo}
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-white/60">{solicitud.empleado?.email_laboral}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-neutral-700 dark:text-white/70">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatearFecha(solicitud.fecha_inicio)} - {formatearFecha(solicitud.fecha_fin)}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {solicitud.dias_solicitados} días
                      </span>
                    </div>
                    {solicitud.comentarios_gerente && (
                      <div className="mt-2 p-2 bg-neutral-50 dark:bg-white/5 rounded text-sm text-neutral-700 dark:text-white/70">
                        <strong>Comentarios del Gerente:</strong> {solicitud.comentarios_gerente}
                      </div>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadgeClass(solicitud.estado)}`}>
                    {getEstadoLabel(solicitud.estado)}
                  </span>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Comentarios (opcional)
                  </label>
                  <textarea
                    value={comentarios[solicitud.id] || ''}
                    onChange={(e) => setComentarios({ ...comentarios, [solicitud.id]: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
                    placeholder="Agrega tus comentarios..."
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAprobar(solicitud.id, solicitud.usuario_id, solicitud.dias_solicitados)}
                    disabled={processingId === solicitud.id}
                    className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>Autorizar</span>
                  </button>
                  <button
                    onClick={() => handleRechazarAdmin(solicitud.id)}
                    disabled={processingId === solicitud.id}
                    className="flex-1 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" />
                    <span>Rechazar</span>
                  </button>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      )}

      {isGerente && (
        <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-5">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-white mb-4">Mis Solicitudes de Vacaciones</h2>
          {misSolicitudes.filter(s => s.usuario_id === currentUser?.id).length === 0 ? (
            <div className="text-center py-8 text-neutral-500 dark:text-white/40">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-neutral-300 dark:text-white/20" />
              <p>No has solicitado vacaciones aún</p>
            </div>
          ) : (
            <div className="space-y-3">
              {misSolicitudes.filter(s => s.usuario_id === currentUser?.id).map((solicitud) => (
                <div key={solicitud.id} className="border border-neutral-200 dark:border-white/10 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-4 text-sm text-neutral-700 dark:text-white/70">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatearFecha(solicitud.fecha_inicio)} - {formatearFecha(solicitud.fecha_fin)}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {solicitud.dias_solicitados} días
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadgeClass(solicitud.estado)}`}>
                      {getEstadoLabel(solicitud.estado)}
                    </span>
                  </div>
                  {(solicitud.comentarios_gerente || solicitud.comentarios_administrador) && (
                    <div className="mt-2 text-sm text-neutral-600 dark:text-white/60">
                      {solicitud.comentarios_gerente && (
                        <div className="mb-1">
                          <strong>Comentarios del Gerente:</strong> {solicitud.comentarios_gerente}
                        </div>
                      )}
                      {solicitud.comentarios_administrador && (
                        <div>
                          <strong>Comentarios del Administrador:</strong> {solicitud.comentarios_administrador}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-5">
        <h2 className="text-sm font-bold text-neutral-900 dark:text-white mb-4">
          {isGerente ? 'Solicitudes de la Oficina' : 'Historial de Solicitudes'}
        </h2>
        {(isGerente ? solicitudes.filter(s => s.usuario_id !== currentUser?.id) : solicitudes).length === 0 ? (
          <div className="text-center py-8 text-neutral-500 dark:text-white/40">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-neutral-300 dark:text-white/20" />
            <p>No hay solicitudes de vacaciones</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-white/5">
                <tr>
                  {!isEmpleado && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/40 uppercase">
                      Empleado
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/40 uppercase">
                    Periodo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/40 uppercase">
                    Días
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/40 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/40 uppercase">
                    Comentarios
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                {(isGerente ? solicitudes.filter(s => s.usuario_id !== currentUser?.id) : solicitudes).map((solicitud) => (
                  <tr key={solicitud.id} className="hover:bg-neutral-50 dark:bg-white/5">
                    {!isEmpleado && (
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-slate-900">
                          {solicitud.empleado?.nombre_completo}
                        </div>
                        <div className="text-slate-600">{solicitud.empleado?.email_laboral}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-slate-900">
                      <div>{formatearFecha(solicitud.fecha_inicio)}</div>
                      <div className="text-slate-600">{formatearFecha(solicitud.fecha_fin)}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {solicitud.dias_solicitados}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getEstadoBadgeClass(solicitud.estado)}`}>
                        {getEstadoLabel(solicitud.estado)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 dark:text-white/60">
                      {solicitud.comentarios_gerente && (
                        <div className="mb-1">
                          <strong>Gerente:</strong> {solicitud.comentarios_gerente}
                        </div>
                      )}
                      {solicitud.comentarios_administrador && (
                        <div>
                          <strong>Admin:</strong> {solicitud.comentarios_administrador}
                        </div>
                      )}
                      {!solicitud.comentarios_gerente && !solicitud.comentarios_administrador && '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full my-8 flex flex-col max-h-[85vh]">
            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Solicitar Vacaciones</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <form id="vacaciones-form" onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fecha de Inicio
                </label>
                <input
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fecha Final
                </label>
                <input
                  type="date"
                  value={formData.fecha_fin}
                  onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                  required
                  min={formData.fecha_inicio}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {diasSolicitados > 0 && (
                <div className="mb-4 p-4 bg-primary-50 border border-primary-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-primary-900">
                      Días laborables solicitados:
                    </span>
                    <span className="text-2xl font-bold text-primary-700">
                      {diasSolicitados}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-primary-700">
                    Días disponibles: {diasDisponibles}
                  </div>
                  {diasSolicitados > diasDisponibles && (
                    <div className="mt-2 text-xs text-red-700 font-medium">
                      No tienes suficientes días disponibles
                    </div>
                  )}
                </div>
              )}
              </form>
            </div>
            <div className="flex-shrink-0 border-t border-slate-200 px-6 py-4">
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ fecha_inicio: '', fecha_fin: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-neutral-50 dark:bg-white/5 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="vacaciones-form"
                  disabled={diasSolicitados > diasDisponibles || diasSolicitados <= 0}
                  className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Solicitar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
