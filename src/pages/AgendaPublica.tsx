import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import {
  Loader as Loader2, Video, Phone, MapPin, Clock, ArrowLeft, Copy,
  CircleCheck as CheckCircle2, ExternalLink,
} from 'lucide-react';
import { calcularSlotsDisponibles, crearReservaPublica, getPublicEventType } from '../lib/agendaUtils';
import { AGENDA_MODALIDAD_LABELS, type AgendaCrearReservaResult, type AgendaModalidad, type AgendaPublicEventType } from '../lib/agendaTypes';

const GUEST_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

type Paso = 'modalidad' | 'horario' | 'formulario' | 'confirmacion';

export default function AgendaPublica() {
  const { webSlug, tipoSlug } = useParams<{ webSlug: string; tipoSlug: string }>();
  const [data, setData] = useState<AgendaPublicEventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [paso, setPaso] = useState<Paso>('modalidad');
  const [modalidad, setModalidad] = useState<AgendaModalidad | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | undefined>(undefined);
  const [horaSeleccionada, setHoraSeleccionada] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [reserva, setReserva] = useState<AgendaCrearReservaResult | null>(null);

  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.add('public-page');
    cargar();
    return () => { root?.classList.remove('public-page'); };
  }, [webSlug, tipoSlug]);

  async function cargar() {
    if (!webSlug || !tipoSlug) { setNotFound(true); setLoading(false); return; }
    try {
      const result = await getPublicEventType(webSlug, tipoSlug);
      if (!result) { setNotFound(true); }
      else {
        setData(result);
        if (result.tipo_cita.modalidades.length === 1) {
          setModalidad(result.tipo_cita.modalidades[0]);
          setPaso('horario');
        }
      }
    } catch (e) {
      console.error(e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  const slotsPorDia = useMemo(() => (data ? calcularSlotsDisponibles(data) : []), [data]);

  // Reagrupa los slots (UTC) por fecha en la zona horaria del invitado, para que el
  // calendario que ve el invitado coincida con "su" día, no con el del organizador.
  const slotsPorDiaInvitado = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const dia of slotsPorDia) {
      for (const iso of dia.slots) {
        const fechaLocal = new Date(iso).toLocaleDateString('en-CA', { timeZone: GUEST_TZ }); // yyyy-MM-dd
        map.set(fechaLocal, [...(map.get(fechaLocal) || []), iso]);
      }
    }
    for (const arr of map.values()) arr.sort();
    return map;
  }, [slotsPorDia]);

  const diasDisponibles = useMemo(() => Array.from(slotsPorDiaInvitado.keys()).map(f => new Date(`${f}T00:00:00`)), [slotsPorDiaInvitado]);

  const horasDelDiaSeleccionado = useMemo(() => {
    if (!fechaSeleccionada) return [];
    const key = fechaSeleccionada.toLocaleDateString('en-CA');
    return slotsPorDiaInvitado.get(key) || [];
  }, [fechaSeleccionada, slotsPorDiaInvitado]);

  async function handleReservar(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !modalidad || !horaSeleccionada) return;
    setEnviando(true);
    setError('');
    try {
      const result = await crearReservaPublica({
        tipo_cita_id: data.tipo_cita.id,
        start_at: horaSeleccionada,
        invitado_nombre: nombre,
        invitado_email: email,
        modalidad,
        invitado_telefono: telefono || null,
        invitado_notas: notas || null,
        zona_horaria_invitado: GUEST_TZ,
      });
      setReserva(result);
      setPaso('confirmacion');
    } catch (err: any) {
      setError(err.message || 'No se pudo completar la reserva. Intenta con otro horario.');
    } finally {
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Página no encontrada</h1>
          <p className="text-gray-500">Esta liga de reservas no existe o ya no está disponible.</p>
        </div>
      </div>
    );
  }

  const { tipo_cita, organizador } = data;
  const modalidadesDisponibles = tipo_cita.modalidades.filter(m => m !== 'google_meet');

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-gray-100">
          <p className="text-sm text-gray-500">{organizador.nombre_completo}</p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">{tipo_cita.nombre}</h1>
          {tipo_cita.descripcion && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{tipo_cita.descripcion}</p>}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-2">
            <Clock className="w-4 h-4" /> {tipo_cita.duracion_minutos} minutos
          </div>
        </div>

        <div className="p-6">
          {paso === 'modalidad' && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-800 mb-3">¿Cómo prefieres tu cita?</p>
              {modalidadesDisponibles.map(m => (
                <button
                  key={m}
                  onClick={() => { setModalidad(m); setPaso('horario'); }}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                >
                  {m === 'jitsi' && <Video className="w-5 h-5 text-blue-600" />}
                  {m === 'presencial' && <MapPin className="w-5 h-5 text-blue-600" />}
                  {m === 'telefono' && <Phone className="w-5 h-5 text-blue-600" />}
                  <span className="font-medium text-gray-800">{AGENDA_MODALIDAD_LABELS[m]}</span>
                </button>
              ))}
            </div>
          )}

          {paso === 'horario' && (
            <div>
              {tipo_cita.modalidades.length > 1 && (
                <button onClick={() => setPaso('modalidad')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
                  <ArrowLeft className="w-3.5 h-3.5" /> Cambiar modalidad
                </button>
              )}
              {diasDisponibles.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">No hay horarios disponibles por ahora. Intenta más tarde.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <DayPicker
                      mode="single"
                      selected={fechaSeleccionada}
                      onSelect={d => { setFechaSeleccionada(d); setHoraSeleccionada(null); }}
                      disabled={date => !diasDisponibles.some(d => d.toDateString() === date.toDateString())}
                      fromDate={new Date()}
                    />
                    <p className="text-xs text-gray-400 mt-1 px-1">Zona horaria: {GUEST_TZ}</p>
                  </div>
                  <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                    {!fechaSeleccionada && <p className="text-sm text-gray-400 py-4 text-center">Elige un día</p>}
                    {fechaSeleccionada && horasDelDiaSeleccionado.length === 0 && (
                      <p className="text-sm text-gray-400 py-4 text-center">Sin horarios ese día</p>
                    )}
                    {horasDelDiaSeleccionado.map(iso => (
                      <button
                        key={iso}
                        onClick={() => { setHoraSeleccionada(iso); setPaso('formulario'); }}
                        className="w-full py-2 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-sm font-medium text-gray-700 transition-colors"
                      >
                        {new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: GUEST_TZ })}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {paso === 'formulario' && horaSeleccionada && (
            <form onSubmit={handleReservar} className="space-y-4">
              <button type="button" onClick={() => setPaso('horario')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-3.5 h-3.5" /> Elegir otro horario
              </button>
              <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-800 font-medium">
                {new Date(horaSeleccionada).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short', timeZone: GUEST_TZ })}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">Nombre completo *</label>
                <input required value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">Correo electrónico *</label>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">Teléfono</label>
                <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">Notas (opcional)</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm min-h-[80px] focus:outline-none focus:border-blue-400" />
              </div>
              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}
              <button type="submit" disabled={enviando} className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {enviando ? 'Confirmando...' : 'Confirmar cita'}
              </button>
            </form>
          )}

          {paso === 'confirmacion' && reserva && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">¡Cita confirmada!</h2>
              <p className="text-sm text-gray-600 mb-4">
                {new Date(reserva.start_at).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short', timeZone: GUEST_TZ })}
              </p>

              {reserva.modalidad === 'jitsi' && reserva.meeting_url && (
                <div className="space-y-2 mb-2">
                  <a href={reserva.meeting_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                    <Video className="w-4 h-4" /> Unirse a la videollamada
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(reserva.meeting_url!)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mx-auto"
                  >
                    <Copy className="w-3 h-3" /> Copiar enlace
                  </button>
                </div>
              )}
              {reserva.modalidad === 'presencial' && reserva.ubicacion_detalle && (
                <p className="text-sm text-gray-700 inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {reserva.ubicacion_detalle}</p>
              )}
              {reserva.modalidad === 'telefono' && reserva.ubicacion_detalle && (
                <p className="text-sm text-gray-700 inline-flex items-center gap-1.5"><Phone className="w-4 h-4" /> {reserva.ubicacion_detalle}</p>
              )}

              <p className="text-xs text-gray-400 mt-6">Recibirás la confirmación en {email}.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
