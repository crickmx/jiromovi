import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, CheckCircle2, Clock, MapPin, Video } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { AgendaLocation, AgendaSlot, PublicEventType } from '../lib/agendaTypes';

export default function AgendaPublica() {
  const { eventTypeId } = useParams<{ eventTypeId: string }>();
  const [eventType, setEventType] = useState<PublicEventType | null>(null);
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<AgendaSlot[]>([]);
  const [slot, setSlot] = useState<AgendaSlot | null>(null);
  const [location, setLocation] = useState<AgendaLocation>('jitsi');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{ meeting_url?: string; booking_id: string } | null>(null);

  useEffect(() => {
    void loadEvent();
  }, [eventTypeId]);

  useEffect(() => {
    if (eventType) void loadSlots();
  }, [eventType, date]);

  async function loadEvent() {
    const { data, error: rpcError } = await supabase.rpc('get_public_agenda_event_type', { p_event_type_id: eventTypeId });
    const record = Array.isArray(data) ? data[0] : data;
    if (rpcError || !record) setError('Este enlace de agenda no está disponible.');
    else {
      setEventType(record as PublicEventType);
      setLocation((record.allowed_locations?.[0] || 'jitsi') as AgendaLocation);
    }
    setLoading(false);
  }

  async function loadSlots() {
    setSlot(null);
    const { data, error: rpcError } = await supabase.rpc('get_agenda_available_slots', {
      p_event_type_id: eventTypeId,
      p_date: date
    });
    if (rpcError) setError(rpcError.message);
    else setSlots((data || []) as AgendaSlot[]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot) return setError('Selecciona un horario.');
    setSubmitting(true);
    setError('');
    const values = new FormData(event.currentTarget);
    const { data, error: rpcError } = await supabase.rpc('create_public_agenda_booking', {
      p_event_type_id: eventTypeId,
      p_start_at: slot.start_at,
      p_guest_name: values.get('name'),
      p_guest_email: values.get('email'),
      p_guest_phone: values.get('phone') || null,
      p_location_type: location
    });
    if (rpcError) {
      setError(rpcError.message);
      await loadSlots();
    } else {
      const result = Array.isArray(data) ? data[0] : data;
      setConfirmation(result);
    }
    setSubmitting(false);
  }

  const formatTime = (value: string) => new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit', minute: '2-digit', timeZone: eventType?.timezone
  }).format(new Date(value));

  if (loading) return <div className="min-h-screen grid place-items-center bg-slate-50">Cargando agenda…</div>;
  if (!eventType) return <div className="min-h-screen grid place-items-center bg-slate-50 p-6 text-center">{error}</div>;
  if (confirmation) return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-5">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-xl">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-bold">¡Cita confirmada!</h1>
        <p className="mt-2 text-slate-600">Recibirás los detalles en tu correo.</p>
        {confirmation.meeting_url && <a className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-5 py-3 font-medium text-white" href={confirmation.meeting_url} target="_blank" rel="noreferrer"><Video className="mr-2 h-5 w-5" />Entrar a videollamada</a>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <main className="mx-auto grid max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-[320px_1fr]">
        <aside className="bg-slate-900 p-7 text-white">
          <p className="text-sm text-slate-300">{eventType.organizer_name}</p>
          <h1 className="mt-2 text-2xl font-bold">{eventType.name}</h1>
          <p className="mt-3 text-slate-300">{eventType.description}</p>
          <div className="mt-6 space-y-3 text-sm">
            <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{eventType.duration_minutes} minutos</p>
            <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{eventType.timezone}</p>
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />Elige la modalidad</p>
          </div>
        </aside>
        <section className="p-7">
          <label className="text-sm font-medium">Fecha</label>
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={e => setDate(e.target.value)} />
          <h2 className="mt-5 font-semibold">Horarios disponibles</h2>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {slots.map(item => <button key={item.start_at} onClick={() => setSlot(item)} className={`rounded-lg border px-2 py-2 text-sm ${slot?.start_at === item.start_at ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>{formatTime(item.start_at)}</button>)}
          </div>
          {!slots.length && <p className="mt-3 text-sm text-slate-500">No hay horarios disponibles este día.</p>}
          {slot && <form onSubmit={submit} className="mt-6 space-y-3">
            <input required name="name" placeholder="Nombre completo" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            <input required type="email" name="email" placeholder="Correo electrónico" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            <input name="phone" placeholder="Teléfono (opcional)" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            <div className="flex flex-wrap gap-3">
              {eventType.allowed_locations.map(value => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" checked={location === value} onChange={() => setLocation(value)} />{value === 'jitsi' ? 'Videollamada' : value === 'phone' ? 'Teléfono' : 'Presencial'}</label>)}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={submitting} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{submitting ? 'Confirmando…' : 'Confirmar cita'}</button>
          </form>}
        </section>
      </main>
    </div>
  );
}
