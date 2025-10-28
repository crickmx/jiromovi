import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, MapPin, Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { getDiaSemana, validarHorario, getEstadoReservaBadgeClass, getEstadoReservaLabel, type DisponibilidadSemanal } from '../lib/espacioJiroUtils';

type Oficina = Database['public']['Tables']['oficinas']['Row'];
type Area = Database['public']['Tables']['areas']['Row'];
type Reserva = Database['public']['Tables']['reservas_espacio']['Row'] & {
  areas?: Pick<Area, 'nombre'> | null;
  usuarios?: { nombre: string; apellidos: string; celular_personal: string; email_laboral: string } | null;
  oficinas?: Pick<Oficina, 'nombre'> | null;
};

export function EspacioJiro() {
  const { usuario: currentUser } = useAuth();
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [selectedOficina, setSelectedOficina] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
      await Promise.all([loadOficinas(), loadReservas()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOficinas = async () => {
    const { data, error } = await supabase
      .from('oficinas')
      .select('*')
      .eq('es_espacio_jiro', true)
      .eq('activa', true)
      .order('nombre');

    if (error) {
      console.error('Error loading oficinas:', error);
      return;
    }

    setOficinas(data || []);
  };

  const loadAreas = async (oficinaId: string) => {
    const { data, error } = await supabase
      .from('areas')
      .select('*')
      .eq('oficina_id', oficinaId)
      .eq('activo', true)
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
      .select('*, areas(nombre), usuarios(nombre, apellidos, celular_personal, email_laboral), oficinas(nombre)')
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

  const handleOficinaChange = (oficinaId: string) => {
    setSelectedOficina(oficinaId);
    setSelectedArea('');
    if (oficinaId) {
      loadAreas(oficinaId);
    } else {
      setAreas([]);
    }
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

    const area = areas.find((a) => a.id === selectedArea);
    if (!area) {
      alert('Área no encontrada');
      return;
    }

    const disponibilidad = area.disponibilidad_semanal as unknown as DisponibilidadSemanal;
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
      .eq('area_id', selectedArea)
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
      .eq('area_id', selectedArea)
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
      const { error } = await supabase.from('reservas_espacio').insert({
        area_id: selectedArea,
        oficina_id: selectedOficina,
        usuario_id: currentUser?.id,
        fecha: formData.fecha,
        hora_inicio: formData.hora_inicio,
        hora_fin: formData.hora_fin,
        estado: 'pendiente',
        notas: formData.notas,
        creado_por: currentUser?.id,
      });

      if (error) throw error;

      setShowModal(false);
      setFormData({ fecha: '', hora_inicio: '', hora_fin: '', notas: '' });
      setSelectedOficina('');
      setSelectedArea('');
      setAreas([]);
      loadReservas();
      alert('Solicitud de reserva enviada correctamente');
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

      loadReservas();
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

      loadReservas();
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

      {isEmpleadoOrAgente && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Reservar Espacio</h2>
          <button
            onClick={() => setShowModal(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition flex items-center justify-center space-x-2"
          >
            <Calendar className="w-5 h-5" />
            <span>Nueva Reserva</span>
          </button>
        </div>
      )}

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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">Nueva Reserva de Espacio</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Oficina <span className="text-red-600">*</span>
                </label>
                <select
                  value={selectedOficina}
                  onChange={(e) => handleOficinaChange(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecciona una oficina</option>
                  {oficinas.map((oficina) => (
                    <option key={oficina.id} value={oficina.id}>
                      {oficina.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {selectedOficina && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Área <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecciona un área</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                    setFormData({ fecha: '', hora_inicio: '', hora_fin: '', notas: '' });
                    setSelectedOficina('');
                    setSelectedArea('');
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
