import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, MapPin, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { DIAS_SEMANA_LABELS, validarHorario, getEstadoReservaBadgeClass, getEstadoReservaLabel, type DisponibilidadSemanal } from '../lib/espacioJiroUtils';

type Oficina = Database['public']['Tables']['oficinas']['Row'];
type Area = Database['public']['Tables']['areas']['Row'] & {
  oficinas?: Pick<Oficina, 'nombre'> | null;
};
type Reserva = Database['public']['Tables']['reservas_espacio']['Row'] & {
  areas?: Pick<Area, 'nombre'> | null;
  usuarios?: { nombre: string; apellidos: string; celular_personal: string; email_laboral: string } | null;
  oficinas?: Pick<Oficina, 'nombre'> | null;
};

export function EspacioJiro() {
  const { usuario: currentUser } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    notas: '',
  });

  const isAdmin = currentUser?.rol === 'Administrador';
  const isGerente = currentUser?.rol === 'Gerente';
  const isEmpleadoOrAgente = currentUser?.rol === 'Empleado' || currentUser?.rol === 'Agente';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadAreas(), loadReservas()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAreas = async () => {
    const { data, error } = await supabase
      .from('areas')
      .select('*, oficinas!inner(nombre, es_espacio_jiro, activa)')
      .eq('activo', true)
      .eq('oficinas.es_espacio_jiro', true)
      .eq('oficinas.activa', true)
      .order('nombre');

    if (error) {
      console.error('Error loading areas:', error);
      return;
    }

    setAreas(data || []);
  };

  const loadReservas = async () => {
    let query = supabase
      .from('reservas_espacio')
      .select('*, areas(nombre), usuarios!reservas_espacio_usuario_fkey(nombre, apellidos, celular_personal, email_laboral), oficinas(nombre)')
      .order('created_at', { ascending: false });

    if (isEmpleadoOrAgente) {
      query = query.eq('usuario_id', currentUser?.id || '');
    } else if (isGerente) {
      query = query.eq('oficina_id', currentUser?.oficina_id || '');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading reservas:', error);
      return;
    }

    setReservas(data || []);
  };

  const openReservaModal = (area: Area) => {
    setSelectedArea(area);
    setFormData({ fecha: '', hora_inicio: '', hora_fin: '', notas: '' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedArea || !formData.fecha || !formData.hora_inicio || !formData.hora_fin) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    if (formData.hora_inicio >= formData.hora_fin) {
      alert('La hora de inicio debe ser menor que la hora de fin');
      return;
    }

    const disponibilidad = selectedArea.disponibilidad_semanal as unknown as DisponibilidadSemanal;
    const validacion = validarHorario(
      formData.hora_inicio,
      formData.hora_fin,
      formData.fecha,
      disponibilidad
    );

    if (!validacion.valido) {
      alert(validacion.mensaje);
      return;
    }

    const { data: conflictos } = await supabase
      .from('reservas_espacio')
      .select('*')
      .eq('area_id', selectedArea.id)
      .eq('fecha', formData.fecha)
      .in('estado', ['pendiente', 'aprobada']);

    if (conflictos && conflictos.length > 0) {
      const hayConflicto = conflictos.some((r) => {
        return formData.hora_inicio < r.hora_fin && formData.hora_fin > r.hora_inicio;
      });

      if (hayConflicto) {
        alert('Ya existe una reserva en ese horario');
        return;
      }
    }

    const { data: bloqueos } = await supabase
      .from('bloqueos_gerente')
      .select('*')
      .eq('area_id', selectedArea.id)
      .eq('fecha', formData.fecha);

    if (bloqueos && bloqueos.length > 0) {
      const hayBloqueo = bloqueos.some((b) => {
        return formData.hora_inicio < b.hora_fin && formData.hora_fin > b.hora_inicio;
      });

      if (hayBloqueo) {
        alert('Ese horario está bloqueado por el gerente');
        return;
      }
    }

    try {
      const { data: nuevaReserva, error } = await supabase
        .from('reservas_espacio')
        .insert({
          area_id: selectedArea.id,
          oficina_id: selectedArea.oficina_id,
          usuario_id: currentUser?.id,
          fecha: formData.fecha,
          hora_inicio: formData.hora_inicio,
          hora_fin: formData.hora_fin,
          estado: 'pendiente',
          notas: formData.notas,
          creado_por: currentUser?.id,
        })
        .select()
        .single();

      if (error) throw error;

      if (nuevaReserva) {
        const reservaCompleta: Reserva = {
          ...nuevaReserva,
          areas: { nombre: selectedArea.nombre },
          usuarios: {
            nombre: currentUser?.nombre || '',
            apellidos: currentUser?.apellidos || '',
            celular_personal: currentUser?.celular_personal || '',
            email_laboral: currentUser?.email_laboral || '',
          },
          oficinas: { nombre: selectedArea.oficinas?.nombre || '' },
        };
        setReservas([reservaCompleta, ...reservas]);
      }

      setShowModal(false);
      setSelectedArea(null);
      setFormData({ fecha: '', hora_inicio: '', hora_fin: '', notas: '' });
      alert('Solicitud de reserva enviada correctamente. Espera la aprobación del gerente.');
    } catch (error: any) {
      console.error('Error creating reservation:', error);
      alert('Error al crear la reserva: ' + error.message);
    }
  };

  const handleAprobar = async (reservaId: string) => {
    setProcessingId(reservaId);
    try {
      const { error } = await supabase
        .from('reservas_espacio')
        .update({ estado: 'aprobada', updated_at: new Date().toISOString() })
        .eq('id', reservaId);

      if (error) throw error;

      setReservas(reservas.map(r => r.id === reservaId ? { ...r, estado: 'aprobada' } : r));
      alert('Reserva aprobada correctamente');
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al aprobar: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRechazar = async (reservaId: string) => {
    const comentario = prompt('Motivo del rechazo (opcional):');
    if (comentario === null) return;

    setProcessingId(reservaId);
    try {
      const { error } = await supabase
        .from('reservas_espacio')
        .update({
          estado: 'rechazada',
          comentarios_gerente: comentario,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservaId);

      if (error) throw error;

      setReservas(reservas.map(r =>
        r.id === reservaId
          ? { ...r, estado: 'rechazada', comentarios_gerente: comentario }
          : r
      ));
      alert('Reserva rechazada');
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al rechazar: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const reservasPendientes = reservas.filter((r) => r.estado === 'pendiente');
  const misReservas = reservas.filter((r) => r.usuario_id === currentUser?.id);

  const filteredAreas = areas.filter((area) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      area.nombre.toLowerCase().includes(searchLower) ||
      area.detalles?.toLowerCase().includes(searchLower) ||
      area.oficinas?.nombre.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Espacio JIRO</h1>
        <p className="text-blue-100">
          {isEmpleadoOrAgente && 'Reserva espacios de trabajo en nuestras oficinas'}
          {isGerente && 'Gestiona reservas y bloqueos de espacios'}
          {isAdmin && 'Administra áreas y supervisa todas las reservas'}
        </p>
      </div>

      {isGerente && reservasPendientes.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            Reservas Pendientes ({reservasPendientes.length})
          </h2>
          <div className="space-y-4">
            {reservasPendientes.map((reserva) => (
              <div key={reserva.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {reserva.usuarios?.nombre} {reserva.usuarios?.apellidos}
                    </h3>
                    <p className="text-sm text-slate-600">{reserva.usuarios?.email_laboral}</p>
                    <p className="text-sm text-slate-600">{reserva.usuarios?.celular_personal}</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      <div className="flex items-center">
                        <Building2 className="w-4 h-4 mr-2" />
                        {reserva.areas?.nombre}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        {new Date(reserva.fecha + 'T00:00:00').toLocaleDateString('es-MX', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        {reserva.hora_inicio} - {reserva.hora_fin}
                      </div>
                    </div>
                    {reserva.notas && (
                      <div className="mt-2 p-2 bg-slate-50 rounded text-sm text-slate-700">
                        <strong>Notas:</strong> {reserva.notas}
                      </div>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoReservaBadgeClass(reserva.estado)}`}>
                    {getEstadoReservaLabel(reserva.estado)}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAprobar(reserva.id)}
                    disabled={processingId === reserva.id}
                    className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>Aprobar</span>
                  </button>
                  <button
                    onClick={() => handleRechazar(reserva.id)}
                    disabled={processingId === reserva.id}
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">Áreas Disponibles</h2>
          <input
            type="text"
            placeholder="Buscar área u oficina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>

        {filteredAreas.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 text-slate-400" />
            <p>No hay áreas disponibles</p>
            {isAdmin && (
              <p className="text-sm mt-2">
                Configura oficinas como Espacio JIRO y agrega áreas desde el módulo de Oficinas
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAreas.map((area) => {
              const disponibilidad = area.disponibilidad_semanal as unknown as DisponibilidadSemanal;
              const diasDisponibles = Object.keys(disponibilidad).filter(
                (dia) => disponibilidad[dia as keyof DisponibilidadSemanal].length > 0
              );

              return (
                <div
                  key={area.id}
                  className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="mb-3">
                    <h3 className="font-bold text-slate-900 mb-1">{area.nombre}</h3>
                    <div className="flex items-center text-sm text-slate-600 mb-2">
                      <MapPin className="w-4 h-4 mr-1" />
                      {area.oficinas?.nombre}
                    </div>
                    {area.detalles && (
                      <p className="text-sm text-slate-600 mb-2">{area.detalles}</p>
                    )}
                  </div>

                  <div className="mb-3 p-2 bg-slate-50 rounded text-xs text-slate-700">
                    <div className="flex items-start mb-1">
                      <Info className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Disponibilidad:</strong>
                        <div className="mt-1 space-y-0.5">
                          {diasDisponibles.length === 0 ? (
                            <p className="text-slate-500 italic">No hay horarios configurados</p>
                          ) : (
                            diasDisponibles.map((dia) => {
                              const franjas = disponibilidad[dia as keyof DisponibilidadSemanal];
                              return (
                                <div key={dia}>
                                  <strong className="mr-1">{DIAS_SEMANA_LABELS[dia]}:</strong>
                                  {franjas.map((f, i) => (
                                    <span key={i} className="mr-1">
                                      {f.inicio}-{f.fin}
                                      {i < franjas.length - 1 ? ',' : ''}
                                    </span>
                                  ))}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {(isEmpleadoOrAgente || isGerente || isAdmin) && (
                    <button
                      onClick={() => openReservaModal(area)}
                      disabled={diasDisponibles.length === 0}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reservar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">
          {isEmpleadoOrAgente ? 'Mis Reservas' : 'Historial de Reservas'}
        </h2>
        {(isEmpleadoOrAgente ? misReservas : reservas).length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 text-slate-400" />
            <p>No hay reservas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  {!isEmpleadoOrAgente && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Usuario
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Área
                  </th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Oficina
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Horario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Comentarios
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(isEmpleadoOrAgente ? misReservas : reservas).map((reserva) => (
                  <tr key={reserva.id} className="hover:bg-slate-50">
                    {!isEmpleadoOrAgente && (
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-slate-900">
                          {reserva.usuarios?.nombre} {reserva.usuarios?.apellidos}
                        </div>
                        <div className="text-slate-600">{reserva.usuarios?.email_laboral}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-slate-900">{reserva.areas?.nombre}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {reserva.oficinas?.nombre || '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {new Date(reserva.fecha + 'T00:00:00').toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {reserva.hora_inicio} - {reserva.hora_fin}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getEstadoReservaBadgeClass(reserva.estado)}`}>
                        {getEstadoReservaLabel(reserva.estado)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {reserva.comentarios_gerente || reserva.notas || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && selectedArea && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">Reservar: {selectedArea.nombre}</h2>
              <p className="text-sm text-slate-600">{selectedArea.oficinas?.nombre}</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fecha <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Hora de Inicio <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.hora_inicio}
                    onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Hora de Fin <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.hora_fin}
                    onChange={(e) => setFormData({ ...formData, hora_fin: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Agrega cualquier información adicional..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedArea(null);
                    setFormData({ fecha: '', hora_inicio: '', hora_fin: '', notas: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Reservar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
