import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { AgendaCalendar, AgendaEventType, AgendaLocation, AvailabilityRule } from '../lib/agendaTypes';
import { Container } from '../components/ui/container';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DEFAULT_RULES = [1, 2, 3, 4, 5].map(weekday => ({ weekday, start_time: '09:00', end_time: '18:00' }));

export default function Agenda() {
  const { usuario } = useAuth();
  const [calendars, setCalendars] = useState<AgendaCalendar[]>([]);
  const [eventTypes, setEventTypes] = useState<AgendaEventType[]>([]);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selected = calendars.find(item => item.id === selectedCalendar);
  const selectedEvents = useMemo(
    () => eventTypes.filter(item => item.calendar_id === selectedCalendar),
    [eventTypes, selectedCalendar]
  );
  const selectedRules = useMemo(
    () => rules.filter(item => item.calendar_id === selectedCalendar),
    [rules, selectedCalendar]
  );

  useEffect(() => {
    if (usuario?.id) void loadAgenda();
  }, [usuario?.id]);

  async function loadAgenda() {
    setLoading(true);
    const { data: calendarData, error } = await supabase
      .from('agenda_calendars')
      .select('*')
      .eq('user_id', usuario!.id)
      .order('created_at');
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    const ids = (calendarData || []).map(item => item.id);
    const [{ data: eventData }, { data: ruleData }] = ids.length
      ? await Promise.all([
          supabase.from('agenda_event_types').select('*').in('calendar_id', ids).order('created_at'),
          supabase.from('agenda_availability_rules').select('*').in('calendar_id', ids).order('weekday')
        ])
      : [{ data: [] }, { data: [] }];
    setCalendars(calendarData || []);
    setEventTypes((eventData || []) as AgendaEventType[]);
    setRules((ruleData || []) as AvailabilityRule[]);
    setSelectedCalendar(current => current || calendarData?.[0]?.id || '');
    setLoading(false);
  }

  async function createCalendar() {
    if (!usuario?.id) return;
    setSaving(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City';
    const { data, error } = await supabase
      .from('agenda_calendars')
      .insert({ user_id: usuario.id, name: 'Mi calendario', color: '#2563eb', timezone })
      .select()
      .single();
    if (!error && data) {
      await supabase.from('agenda_availability_rules').insert(
        DEFAULT_RULES.map(rule => ({ ...rule, calendar_id: data.id }))
      );
      setSelectedCalendar(data.id);
      await loadAgenda();
    } else {
      setMessage(error?.message || 'No se pudo crear el calendario');
    }
    setSaving(false);
  }

  async function saveCalendar() {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from('agenda_calendars')
      .update({ name: selected.name, brand: selected.brand, color: selected.color, timezone: selected.timezone })
      .eq('id', selected.id);
    setMessage(error ? error.message : 'Calendario guardado');
    setSaving(false);
  }

  async function addEventType() {
    if (!selectedCalendar) return;
    const { error } = await supabase.from('agenda_event_types').insert({
      calendar_id: selectedCalendar,
      name: 'Asesoría',
      description: 'Agenda una cita conmigo',
      duration_minutes: 30,
      allowed_locations: ['jitsi'],
      location_details: {}
    });
    if (error) setMessage(error.message);
    else await loadAgenda();
  }

  async function updateEventType(item: AgendaEventType) {
    setSaving(true);
    const { error } = await supabase.from('agenda_event_types').update({
      name: item.name,
      description: item.description,
      duration_minutes: item.duration_minutes,
      buffer_before_minutes: item.buffer_before_minutes,
      buffer_after_minutes: item.buffer_after_minutes,
      min_notice_minutes: item.min_notice_minutes,
      daily_limit: item.daily_limit,
      allowed_locations: item.allowed_locations,
      location_details: item.location_details,
      is_active: item.is_active
    }).eq('id', item.id);
    setMessage(error ? error.message : 'Tipo de cita guardado');
    setSaving(false);
  }

  async function deleteEventType(id: string) {
    if (!window.confirm('¿Eliminar este tipo de cita?')) return;
    await supabase.from('agenda_event_types').delete().eq('id', id);
    await loadAgenda();
  }

  async function updateRule(rule: AvailabilityRule) {
    setRules(current => current.map(item => item.id === rule.id ? rule : item));
    if (rule.id) {
      await supabase.from('agenda_availability_rules')
        .update({ start_time: rule.start_time, end_time: rule.end_time, is_active: rule.is_active })
        .eq('id', rule.id);
    }
  }

  function patchCalendar(patch: Partial<AgendaCalendar>) {
    setCalendars(current => current.map(item => item.id === selectedCalendar ? { ...item, ...patch } : item));
  }

  function patchEvent(id: string, patch: Partial<AgendaEventType>) {
    setEventTypes(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  function toggleLocation(item: AgendaEventType, location: AgendaLocation) {
    const next = item.allowed_locations.includes(location)
      ? item.allowed_locations.filter(value => value !== location)
      : [...item.allowed_locations, location];
    patchEvent(item.id, { allowed_locations: next.length ? next : ['jitsi'] });
  }

  if (loading) return <Container><div className="py-16 text-center">Cargando agenda…</div></Container>;

  return (
    <Container className="max-w-6xl">
      <PageHeader title="Agenda" description="Configura tus calendarios y comparte tu página de reservas" />
      {message && <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="p-4 self-start">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Calendarios</h2>
            <Button size="sm" onClick={createCalendar} disabled={saving}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-2">
            {calendars.map(item => (
              <button key={item.id} onClick={() => setSelectedCalendar(item.id)}
                className={`w-full rounded-lg border p-3 text-left text-sm ${item.id === selectedCalendar ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                {item.name}
              </button>
            ))}
            {!calendars.length && <p className="py-4 text-sm text-slate-500">Crea tu primer calendario.</p>}
          </div>
        </Card>

        {selected && <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2"><CalendarDays className="h-5 w-5" /><h2 className="font-semibold">Configuración</h2></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Nombre</Label><Input value={selected.name} onChange={e => patchCalendar({ name: e.target.value })} /></div>
              <div><Label>Marca o propósito</Label><Input value={selected.brand || ''} onChange={e => patchCalendar({ brand: e.target.value })} placeholder="Mekate, Agente Total…" /></div>
              <div><Label>Zona horaria</Label><Input value={selected.timezone} onChange={e => patchCalendar({ timezone: e.target.value })} /></div>
              <div><Label>Color</Label><Input type="color" value={selected.color} onChange={e => patchCalendar({ color: e.target.value })} /></div>
            </div>
            <Button className="mt-4" onClick={saveCalendar} disabled={saving}>Guardar calendario</Button>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Clock className="h-5 w-5" /><h2 className="font-semibold">Disponibilidad semanal</h2></div>
            </div>
            <div className="space-y-2">
              {selectedRules.map(rule => (
                <div key={rule.id} className="grid grid-cols-[120px_1fr_1fr] items-center gap-3">
                  <span className="text-sm">{DAYS[rule.weekday]}</span>
                  <Input type="time" value={rule.start_time.slice(0, 5)} onChange={e => void updateRule({ ...rule, start_time: e.target.value })} />
                  <Input type="time" value={rule.end_time.slice(0, 5)} onChange={e => void updateRule({ ...rule, end_time: e.target.value })} />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Tipos de cita</h2>
              <Button onClick={addEventType}><Plus className="mr-2 h-4 w-4" />Nuevo tipo</Button>
            </div>
            <div className="space-y-5">
              {selectedEvents.map(item => {
                const publicUrl = `${window.location.origin}/agenda/${item.id}`;
                return <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div><Label>Nombre</Label><Input value={item.name} onChange={e => patchEvent(item.id, { name: e.target.value })} /></div>
                    <div><Label>Duración (minutos)</Label><Input type="number" min={10} step={5} value={item.duration_minutes} onChange={e => patchEvent(item.id, { duration_minutes: Number(e.target.value) })} /></div>
                    <div className="md:col-span-2"><Label>Descripción</Label><Input value={item.description || ''} onChange={e => patchEvent(item.id, { description: e.target.value })} /></div>
                    <div><Label>Anticipación mínima (min)</Label><Input type="number" min={0} value={item.min_notice_minutes} onChange={e => patchEvent(item.id, { min_notice_minutes: Number(e.target.value) })} /></div>
                    <div><Label>Límite diario (vacío = sin límite)</Label><Input type="number" min={1} value={item.daily_limit || ''} onChange={e => patchEvent(item.id, { daily_limit: e.target.value ? Number(e.target.value) : null })} /></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    {([['jitsi', 'Videollamada Jitsi'], ['phone', 'Teléfono'], ['in_person', 'Presencial']] as [AgendaLocation, string][]).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2"><input type="checkbox" checked={item.allowed_locations.includes(value)} onChange={() => toggleLocation(item, value)} />{label}</label>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => updateEventType(item)} disabled={saving}>Guardar</Button>
                    <Button variant="outline" onClick={() => navigator.clipboard.writeText(publicUrl)}><Copy className="mr-2 h-4 w-4" />Copiar enlace</Button>
                    <Button variant="outline" onClick={() => window.open(publicUrl, '_blank')}><ExternalLink className="mr-2 h-4 w-4" />Abrir</Button>
                    <Button variant="outline" onClick={() => deleteEventType(item.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  </div>
                </div>;
              })}
              {!selectedEvents.length && <p className="py-6 text-center text-sm text-slate-500">Agrega un tipo de cita para obtener un enlace público.</p>}
            </div>
          </Card>
        </div>}
      </div>
    </Container>
  );
}
