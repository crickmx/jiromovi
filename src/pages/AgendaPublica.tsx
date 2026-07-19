import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, MapPin, Video } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getPublicWebPageBySlug } from '../lib/webPagesUtils';
import type { PublicWebPageData } from '../lib/webPagesTypes';
import type { AgendaLocation, AgendaSlot, PublicEventType } from '../lib/agendaTypes';

interface PublicCalendarBlock {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
}

export default function AgendaPublica() {
  const { slug, eventTypeId } = useParams<{ slug?: string; eventTypeId?: string }>();
  const [page, setPage] = useState<PublicWebPageData | null>(null);
  const [blocks, setBlocks] = useState<PublicCalendarBlock[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(eventTypeId || '');
  const [eventType, setEventType] = useState<PublicEventType | null>(null);
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<AgendaSlot[]>([]);
  const [slot, setSlot] = useState<AgendaSlot | null>(null);
  const [location, setLocation] = useState<AgendaLocation>('jitsi');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{ meeting_url?: string; booking_id: string } | null>(null);

  const primaryColor = page?.config?.primary_color || '#1e40af';
  const secondaryColor = page?.config?.secondary_color || '#059669';
  const publicHome = slug ? `/${slug}` : '/';

  useEffect(() => {
    void loadPage();
  }, [slug, eventTypeId]);

  useEffect(() => {
    if (selectedEventId) void loadEvent(selectedEventId);
  }, [selectedEventId]);

  useEffect(() => {
    if (eventType) void loadSlots();
  }, [eventType, date]);

  async function loadPage() {
    setLoading(true);
    setError('');

    if (slug) {
      const [pageData, blocksResult] = await Promise.all([
        getPublicWebPageBySlug(slug),
        supabase.rpc('get_public_website_calendar_blocks', { p_slug: slug })
      ]);
      const visibleBlocks = (blocksResult.data || []) as PublicCalendarBlock[];
      if (!pageData?.user || pageData.config?.is_published === false) {
        setError('Esta página de agenda no está disponible.');
      } else if (blocksResult.error) {
        setError('No fue posible cargar la agenda.');
      } else {
        setPage(pageData);
        setBlocks(visibleBlocks);
        setSelectedEventId(current =>
          current && visibleBlocks.some(block => block.id === current)
            ? current
            : visibleBlocks[0]?.id || ''
        );
      }
      setLoading(false);
      return;
    }

    if (eventTypeId) {
      setSelectedEventId(eventTypeId);
      await loadEvent(eventTypeId);
      setLoading(false);
      return;
    }

    setError('Esta página de agenda no está disponible.');
    setLoading(false);
  }

  async function loadEvent(id: string) {
    setError('');
    setSlot(null);
    setConfirmation(null);
    const { data, error: rpcError } = await supabase.rpc('get_public_agenda_event_type', { p_event_type_id: id });
    const record = Array.isArray(data) ? data[0] : data;
    if (rpcError || !record) {
      setEventType(null);
      setError('Este tipo de cita no está disponible.');
    } else {
      setEventType(record as PublicEventType);
      setLocation((record.allowed_locations?.[0] || 'jitsi') as AgendaLocation);
    }
  }

  async function loadSlots() {
    setSlot(null);
    const { data, error: rpcError } = await supabase.rpc('get_agenda_available_slots', {
      p_event_type_id: selectedEventId,
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
      p_event_type_id: selectedEventId,
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

  if (loading) return <div className="min-h-screen grid place-items-center bg-gray-50">Cargando agenda…</div>;
  if (!eventType) return (
    <div className="min-h-screen grid place-items-center bg-gray-50 p-6 text-center">
      <div>
        {page?.user?.logo_url && <img src={page.user.logo_url} alt="" className="mx-auto mb-6 h-16 max-w-48 object-contain" />}
        <p className="text-gray-600">{error || (blocks.length ? 'Cargando horarios…' : 'El asesor aún no ha publicado calendarios.')}</p>
        {slug && <Link to={publicHome} className="mt-5 inline-flex items-center gap-2 font-semibold" style={{ color: primaryColor }}><ArrowLeft className="h-4 w-4" />Volver a la página</Link>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link to={publicHome} className="flex min-w-0 items-center gap-3">
            {(page?.user.logo_url || page?.user.office?.logo_url) && (
              <img src={page.user.logo_url || page.user.office?.logo_url || ''} alt="" className="h-11 max-w-40 object-contain" />
            )}
            <div className="min-w-0">
              <p className="truncate font-bold text-gray-900">{page?.user.name || eventType.organizer_name}</p>
              <p className="truncate text-xs text-gray-500">{page?.user.office?.name || 'Asesor Personal de Seguros'}</p>
            </div>
          </Link>
          {slug && <Link to={publicHome} className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: primaryColor }}><ArrowLeft className="h-4 w-4" />Mi página</Link>}
        </div>
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }} />
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 text-center">
          <CalendarDays className="mx-auto mb-3 h-10 w-10" style={{ color: primaryColor }} />
          <h1 className="text-3xl font-extrabold text-gray-900">Agenda una cita</h1>
          <p className="mt-2 text-gray-500">Elige el tipo de cita, la fecha y el horario que prefieras.</p>
        </div>

        {blocks.length > 1 && (
          <div className="mb-6 flex flex-wrap justify-center gap-2">
            {blocks.map(block => (
              <button
                key={block.id}
                onClick={() => setSelectedEventId(block.id)}
                className="rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
                style={selectedEventId === block.id
                  ? { backgroundColor: primaryColor, borderColor: primaryColor, color: '#fff' }
                  : { borderColor: `${primaryColor}40`, color: primaryColor }}
              >
                {block.name}
              </button>
            ))}
          </div>
        )}

        {confirmation ? (
          <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-xl">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h2 className="mt-4 text-2xl font-bold">¡Cita confirmada!</h2>
            <p className="mt-2 text-gray-600">Recibirás los detalles en tu correo.</p>
            {confirmation.meeting_url && <a className="mt-6 inline-flex items-center rounded-lg px-5 py-3 font-medium text-white" style={{ backgroundColor: primaryColor }} href={confirmation.meeting_url} target="_blank" rel="noreferrer"><Video className="mr-2 h-5 w-5" />Entrar a videollamada</a>}
          </div>
        ) : (
          <div className="mx-auto grid max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-[320px_1fr]">
            <aside className="p-7 text-white" style={{ background: `linear-gradient(145deg, ${primaryColor}, ${secondaryColor})` }}>
              <p className="text-sm text-white/75">{eventType.organizer_name}</p>
              <h2 className="mt-2 text-2xl font-bold">{eventType.name}</h2>
              <p className="mt-3 text-white/80">{eventType.description}</p>
              <div className="mt-6 space-y-3 text-sm">
                <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{eventType.duration_minutes} minutos</p>
                <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{eventType.timezone}</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />Elige la modalidad</p>
              </div>
            </aside>
            <section className="p-7">
              <label className="text-sm font-medium">Fecha</label>
              <input className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={e => setDate(e.target.value)} />
              <h3 className="mt-5 font-semibold">Horarios disponibles</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {slots.map(item => <button key={item.start_at} onClick={() => setSlot(item)} className="rounded-lg border px-2 py-2 text-sm text-white" style={slot?.start_at === item.start_at ? { borderColor: primaryColor, backgroundColor: primaryColor } : { borderColor: '#d1d5db', color: '#374151', backgroundColor: '#fff' }}>{formatTime(item.start_at)}</button>)}
              </div>
              {!slots.length && <p className="mt-3 text-sm text-gray-500">No hay horarios disponibles este día.</p>}
              {slot && <form onSubmit={submit} className="mt-6 space-y-3">
                <input required name="name" placeholder="Nombre completo" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                <input required type="email" name="email" placeholder="Correo electrónico" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                <input name="phone" placeholder="Teléfono (opcional)" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                <div className="flex flex-wrap gap-3">
                  {eventType.allowed_locations.map(value => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" checked={location === value} onChange={() => setLocation(value)} />{value === 'jitsi' ? 'Videollamada' : value === 'phone' ? 'Teléfono' : 'Presencial'}</label>)}
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button disabled={submitting} className="w-full rounded-lg px-4 py-3 font-semibold text-white disabled:opacity-50" style={{ backgroundColor: primaryColor }}>{submitting ? 'Confirmando…' : 'Confirmar cita'}</button>
              </form>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
