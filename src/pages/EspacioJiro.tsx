import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui/page-header';
import { Section } from '../components/ui/section';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Building2, MapPin, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Info, Search } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { DIAS_SEMANA, DIAS_SEMANA_LABELS, validarHorario, getEstadoReservaBadgeClass, getEstadoReservaLabel, type DisponibilidadSemanal } from '../lib/espacioJiroUtils';
import { cn } from '@/lib/utils';

type Oficina = Database['public']['Tables']['oficinas']['Row'];
type Area = Database['public']['Tables']['areas']['Row'] & {
  oficinas?: Pick<Oficina, 'nombre' | 'domicilio'> | null;
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
      .select('*, oficinas!inner(nombre, domicilio, es_espacio_jiro, activa)')
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
      .select('*, areas(nombre), usuarios!usuario_id(nombre, apellidos, celular_personal, email_laboral), oficinas(nombre)')
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
      <Layout hideHeader>
        <div className="space-y-4">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-64 w-full" />
        </div>
      </Layout>
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
    <Layout hideHeader>
      <PageHeader
        title="Espacio JIRO"
        description={
          isEmpleadoOrAgente
            ? 'Reserva espacios de trabajo en nuestras oficinas'
            : isGerente
            ? 'Gestiona reservas y bloqueos de espacios'
            : 'Administra áreas y supervisa todas las reservas'
        }
        icon={Building2}
      />

      <div className="mt-6 space-y-6">
          {isGerente && reservasPendientes.length > 0 && (
            <Section variant="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-neutral-900">
                  Reservas Pendientes
                </h2>
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                  {reservasPendientes.length}
                </span>
              </div>
              <div className="space-y-4">
                {reservasPendientes.map((reserva) => (
                  <div key={reserva.id} className="bg-neutral-50 rounded-lg border border-neutral-200 p-4 hover:shadow-ios transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-neutral-900 text-sm sm:text-base mb-1">
                          {reserva.usuarios?.nombre} {reserva.usuarios?.apellidos}
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-600 truncate">{reserva.usuarios?.email_laboral}</p>
                        <p className="text-xs sm:text-sm text-neutral-600">{reserva.usuarios?.celular_personal}</p>
                        <div className="mt-3 space-y-2 text-xs sm:text-sm text-neutral-700">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                            <span className="break-words">{reserva.areas?.nombre}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Calendar className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" />
                            <span className="break-words">
                              {new Date(reserva.fecha + 'T00:00:00').toLocaleDateString('es-MX', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                            <span>{reserva.hora_inicio} - {reserva.hora_fin}</span>
                          </div>
                        </div>
                        {reserva.notas && (
                          <div className="mt-3 p-2 bg-white rounded text-xs sm:text-sm text-neutral-700 break-words border border-neutral-200">
                            <strong className="text-neutral-900">Notas:</strong> {reserva.notas}
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
                        getEstadoReservaBadgeClass(reserva.estado)
                      )}>
                        {getEstadoReservaLabel(reserva.estado)}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={() => handleAprobar(reserva.id)}
                        disabled={processingId === reserva.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 btn-touch"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Aprobar
                      </Button>
                      <Button
                        onClick={() => handleRechazar(reserva.id)}
                        disabled={processingId === reserva.id}
                        variant="destructive"
                        className="flex-1 btn-touch"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Rechazar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section variant="card">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-neutral-900">Áreas Disponibles</h2>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input
                  type="text"
                  placeholder="Buscar área u oficina..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {filteredAreas.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  No hay áreas disponibles
                </h3>
                {isAdmin && (
                  <p className="text-sm text-neutral-600 max-w-md mx-auto">
                    Configura oficinas como Espacio JIRO y agrega áreas desde el módulo de Oficinas
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAreas.map((area) => {
                  const disponibilidad = area.disponibilidad_semanal as unknown as DisponibilidadSemanal;
                  const diasDisponibles = DIAS_SEMANA.filter(
                    (dia) => disponibilidad[dia as keyof DisponibilidadSemanal].length > 0
                  );

                  return (
                    <div
                      key={area.id}
                      className="bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-ios hover:border-primary-300 transition-all overflow-hidden group"
                    >
                      <div className="mb-4 min-w-0">
                        <div className="flex items-center text-sm font-semibold text-accent mb-2 min-w-0">
                          <Building2 className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span className="flex-1 min-w-0 break-words">{area.oficinas?.nombre}</span>
                        </div>
                        <h3 className="font-bold text-neutral-900 text-lg mb-2 break-words group-hover:text-accent transition-colors">
                          {area.nombre}
                        </h3>
                        {area.detalles && (
                          <p className="text-sm text-neutral-600 mb-2 break-words leading-relaxed">{area.detalles}</p>
                        )}
                        {area.oficinas?.domicilio && (
                          <div className="flex items-start text-sm text-neutral-600 mb-2 min-w-0">
                            <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-neutral-400" />
                            <span className="flex-1 min-w-0 break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                              {area.oficinas.domicilio}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mb-4 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                        <div className="flex items-start">
                          <Info className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-neutral-500" />
                          <div className="flex-1 min-w-0">
                            <strong className="text-sm text-neutral-900">Disponibilidad:</strong>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700">
                              {diasDisponibles.length === 0 ? (
                                <p className="text-neutral-500 italic">No hay horarios configurados</p>
                              ) : (
                                diasDisponibles.map((dia) => {
                                  const franjas = disponibilidad[dia as keyof DisponibilidadSemanal];
                                  return (
                                    <div key={dia} className="break-words">
                                      <strong className="mr-1 text-neutral-900">{DIAS_SEMANA_LABELS[dia]}:</strong>
                                      {franjas.map((f, i) => (
                                        <span key={i} className="mr-1 whitespace-nowrap">
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
                        <Button
                          onClick={() => openReservaModal(area)}
                          disabled={diasDisponibles.length === 0}
                          className="w-full btn-touch"
                        >
                          Reservar Espacio
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section variant="card">
            <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 mb-4">
              {isEmpleadoOrAgente ? 'Mis Reservas' : 'Historial de Reservas'}
            </h2>
            {(isEmpleadoOrAgente ? misReservas : reservas).length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  No hay reservas
                </h3>
                <p className="text-sm text-neutral-600">
                  {isEmpleadoOrAgente ? 'Tus reservas aparecerán aquí' : 'Aún no hay reservas registradas'}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50">
                      <tr>
                        {!isEmpleadoOrAgente && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                            Usuario
                          </th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                          Área
                        </th>
                        {isAdmin && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                            Oficina
                          </th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                          Horario
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                          Comentarios
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {(isEmpleadoOrAgente ? misReservas : reservas).map((reserva) => (
                        <tr key={reserva.id} className="hover:bg-neutral-50 transition-colors">
                          {!isEmpleadoOrAgente && (
                            <td className="px-4 py-3 text-sm">
                              <div className="font-medium text-neutral-900">
                                {reserva.usuarios?.nombre} {reserva.usuarios?.apellidos}
                              </div>
                              <div className="text-neutral-600 text-xs">{reserva.usuarios?.email_laboral}</div>
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm text-neutral-900">{reserva.areas?.nombre}</td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-sm text-neutral-900">
                              {reserva.oficinas?.nombre || '-'}
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm text-neutral-900">
                            {new Date(reserva.fecha + 'T00:00:00').toLocaleDateString('es-MX')}
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-900">
                            {reserva.hora_inicio} - {reserva.hora_fin}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-xs font-semibold",
                              getEstadoReservaBadgeClass(reserva.estado)
                            )}>
                              {getEstadoReservaLabel(reserva.estado)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-600">
                            {reserva.comentarios_gerente || reserva.notas || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-3">
                  {(isEmpleadoOrAgente ? misReservas : reservas).map((reserva) => (
                    <div key={reserva.id} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                      {!isEmpleadoOrAgente && (
                        <div className="mb-3 pb-3 border-b border-neutral-200">
                          <div className="font-semibold text-neutral-900 text-sm">
                            {reserva.usuarios?.nombre} {reserva.usuarios?.apellidos}
                          </div>
                          <div className="text-xs text-neutral-600 truncate">{reserva.usuarios?.email_laboral}</div>
                        </div>
                      )}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-neutral-600 font-medium">Área:</span>
                          <span className="text-neutral-900 text-right break-words flex-1">{reserva.areas?.nombre}</span>
                        </div>
                        {isAdmin && (
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-neutral-600 font-medium">Oficina:</span>
                            <span className="text-neutral-900 text-right break-words flex-1">{reserva.oficinas?.nombre || '-'}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-neutral-600 font-medium">Fecha:</span>
                          <span className="text-neutral-900">{new Date(reserva.fecha + 'T00:00:00').toLocaleDateString('es-MX')}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-neutral-600 font-medium">Horario:</span>
                          <span className="text-neutral-900">{reserva.hora_inicio} - {reserva.hora_fin}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-neutral-600 font-medium">Estado:</span>
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-semibold",
                            getEstadoReservaBadgeClass(reserva.estado)
                          )}>
                            {getEstadoReservaLabel(reserva.estado)}
                          </span>
                        </div>
                        {(reserva.comentarios_gerente || reserva.notas) && (
                          <div className="pt-2 border-t border-neutral-200">
                            <span className="text-neutral-600 font-medium block mb-1">Comentarios:</span>
                            <p className="text-neutral-900 text-xs break-words">{reserva.comentarios_gerente || reserva.notas}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Section>

        </div>

        {showModal && selectedArea && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-8 flex flex-col max-h-[90vh]">
              <div className="flex-shrink-0 px-6 py-4 border-b border-neutral-200">
                <h2 className="text-xl font-bold text-neutral-900 break-words">Reservar: {selectedArea.nombre}</h2>
                <p className="text-sm text-neutral-600 break-words mt-1">{selectedArea.oficinas?.nombre}</p>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <form id="reserva-form" onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="fecha">
                      Fecha <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="fecha"
                      type="date"
                      value={formData.fecha}
                      onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hora-inicio">
                        Hora de Inicio <span className="text-red-600">*</span>
                      </Label>
                      <Input
                        id="hora-inicio"
                        type="time"
                        value={formData.hora_inicio}
                        onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hora-fin">
                        Hora de Fin <span className="text-red-600">*</span>
                      </Label>
                      <Input
                        id="hora-fin"
                        type="time"
                        value={formData.hora_fin}
                        onChange={(e) => setFormData({ ...formData, hora_fin: e.target.value })}
                        required
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notas">Notas (opcional)</Label>
                    <textarea
                      id="notas"
                      value={formData.notas}
                      onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                      rows={3}
                      className="w-full mt-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                      placeholder="Agrega cualquier información adicional..."
                    />
                  </div>
                </form>
              </div>
              <div className="flex-shrink-0 border-t border-neutral-200 px-6 py-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowModal(false);
                      setSelectedArea(null);
                      setFormData({ fecha: '', hora_inicio: '', hora_fin: '', notas: '' });
                    }}
                    className="flex-1 btn-touch"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    form="reserva-form"
                    className="flex-1 btn-touch"
                  >
                    Confirmar Reserva
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
    </Layout>
  );
}
