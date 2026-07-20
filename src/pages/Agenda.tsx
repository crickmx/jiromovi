import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, Plus, Trash2, Copy, ExternalLink, CircleCheck as CheckCircle2,
  CircleAlert as AlertCircle, Video, Phone, MapPin, X, Loader as Loader2,
} from 'lucide-react';
import { Container } from '../components/ui/container';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import {
  actualizarCalendario, actualizarTipoCita, cancelarReserva, crearCalendario, crearExcepcion,
  crearRegla, crearTipoCita, eliminarCalendario, eliminarExcepcion, eliminarRegla, eliminarTipoCita,
  listCalendarios, listExcepciones, listReglas, listReservas, listTiposCita, slugify, tipoCitaSlugDisponible,
} from '../lib/agendaUtils';
import {
  AGENDA_MODALIDAD_LABELS, WEEKDAY_LABELS, ZONAS_HORARIAS_MX,
  type AgendaCalendario, type AgendaExcepcionDisponibilidad, type AgendaModalidad,
  type AgendaReglaDisponibilidad, type AgendaReserva, type AgendaTipoCita,
} from '../lib/agendaTypes';

const MODALIDADES_DISPONIBLES: AgendaModalidad[] = ['jitsi', 'presencial', 'telefono'];

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  return { toast, show };
}

export default function Agenda() {
  const { usuario } = useAuth();
  const { toast, show } = useToast();
  const [loading, setLoading] = useState(true);
  const [calendarios, setCalendarios] = useState<AgendaCalendario[]>([]);
  const [calendarioActivoId, setCalendarioActivoId] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [creandoCalendario, setCreandoCalendario] = useState(false);

  useEffect(() => { if (usuario?.id) cargarCalendarios(); }, [usuario?.id]);

  async function cargarCalendarios() {
    if (!usuario?.id) return;
    setLoading(true);
    try {
      const data = await listCalendarios(usuario.id);
      setCalendarios(data);
      if (data.length > 0 && !calendarioActivoId) setCalendarioActivoId(data[0].id);
    } catch (e) {
      console.error(e);
      show('Error al cargar calendarios', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCrearCalendario() {
    if (!usuario?.id || !nuevoNombre.trim()) return;
    setCreandoCalendario(true);
    try {
      const nuevo = await crearCalendario({
        user_id: usuario.id,
        nombre: nuevoNombre.trim(),
        marca: null,
        color: '#2563eb',
        zona_horaria: 'America/Mexico_City',
      });
      setCalendarios(prev => [...prev, nuevo]);
      setCalendarioActivoId(nuevo.id);
      setNuevoNombre('');
      show('Calendario creado');
    } catch (e: any) {
      show(e.message || 'Error al crear calendario', 'error');
    } finally {
      setCreandoCalendario(false);
    }
  }

  async function handleEliminarCalendario(id: string) {
    if (!confirm('¿Eliminar este calendario? Se borrarán sus tipos de cita, disponibilidad y reservas.')) return;
    try {
      await eliminarCalendario(id);
      setCalendarios(prev => prev.filter(c => c.id !== id));
      if (calendarioActivoId === id) setCalendarioActivoId(null);
      show('Calendario eliminado');
    } catch (e: any) {
      show(e.message || 'Error al eliminar', 'error');
    }
  }

  const calendarioActivo = calendarios.find(c => c.id === calendarioActivoId) || null;

  if (loading) {
    return (
      <Container>
        <PageHeader title="Agenda" description="Configura tus calendarios de reservas" />
        <div className="text-center py-12 text-neutral-500">Cargando...</div>
      </Container>
    );
  }

  return (
    <Container className="max-w-6xl">
      <PageHeader
        title="Agenda"
        description="Configura tus calendarios, tipos de cita y disponibilidad para recibir reservas"
        icon={CalendarClock}
      />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      <div className="grid lg:grid-cols-[260px_1fr] gap-5 mt-5">
        {/* Lista de calendarios */}
        <Card className="p-4 h-fit">
          <h2 className="text-sm font-semibold mb-3 text-neutral-700 dark:text-white/80">Tus calendarios</h2>
          <div className="space-y-1.5 mb-3">
            {calendarios.map(cal => (
              <button
                key={cal.id}
                onClick={() => setCalendarioActivoId(cal.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                  calendarioActivoId === cal.id
                    ? 'bg-accent/10 text-accent'
                    : 'text-neutral-600 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/8'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
                <span className="truncate flex-1">{cal.nombre}</span>
              </button>
            ))}
            {calendarios.length === 0 && (
              <p className="text-xs text-neutral-400 py-2">Aún no tienes calendarios.</p>
            )}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              placeholder="Nombre del calendario"
              className="text-sm h-9"
              onKeyDown={e => e.key === 'Enter' && handleCrearCalendario()}
            />
            <Button size="icon-sm" onClick={handleCrearCalendario} disabled={creandoCalendario || !nuevoNombre.trim()}>
              {creandoCalendario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </Card>

        {/* Panel del calendario activo */}
        {calendarioActivo ? (
          <CalendarioPanel
            calendario={calendarioActivo}
            usuarioId={usuario!.id}
            webSlug={(usuario as any)?.web_slug || null}
            onUpdate={updates => setCalendarios(prev => prev.map(c => c.id === calendarioActivo.id ? { ...c, ...updates } : c))}
            onDelete={() => handleEliminarCalendario(calendarioActivo.id)}
            showToast={show}
          />
        ) : (
          <Card className="p-8 text-center text-neutral-500 text-sm">
            Crea un calendario para empezar a configurar tus tipos de cita y disponibilidad.
          </Card>
        )}
      </div>
    </Container>
  );
}

// ═══════════════════════════════════════════════════════════════
// Panel de un calendario: tabs Tipos de cita / Disponibilidad / Reservas / Compartir
// ═══════════════════════════════════════════════════════════════

function CalendarioPanel({
  calendario, usuarioId, webSlug, onUpdate, onDelete, showToast,
}: {
  calendario: AgendaCalendario;
  usuarioId: string;
  webSlug: string | null;
  onUpdate: (updates: Partial<AgendaCalendario>) => void;
  onDelete: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [tipos, setTipos] = useState<AgendaTipoCita[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(true);

  useEffect(() => { cargarTipos(); }, [calendario.id]);

  async function cargarTipos() {
    setLoadingTipos(true);
    try {
      setTipos(await listTiposCita(calendario.id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTipos(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <Input
              value={calendario.nombre}
              onChange={e => onUpdate({ nombre: e.target.value })}
              onBlur={e => actualizarCalendario(calendario.id, { nombre: e.target.value })}
              className="text-base font-semibold h-9 max-w-xs"
            />
            <input
              type="color"
              value={calendario.color}
              onChange={e => { onUpdate({ color: e.target.value }); actualizarCalendario(calendario.id, { color: e.target.value }); }}
              className="w-9 h-9 rounded-lg border border-neutral-200 cursor-pointer"
              title="Color del calendario"
            />
            <select
              value={calendario.zona_horaria}
              onChange={e => { onUpdate({ zona_horaria: e.target.value }); actualizarCalendario(calendario.id, { zona_horaria: e.target.value }); }}
              className="h-9 px-3 rounded-xl border border-neutral-200 dark:border-white/15 bg-white dark:bg-white/6 text-sm"
            >
              {ZONAS_HORARIAS_MX.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
          </div>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" /> Eliminar calendario
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <Tabs defaultValue="tipos">
          <TabsList>
            <TabsTrigger value="tipos">Tipos de cita</TabsTrigger>
            <TabsTrigger value="disponibilidad">Disponibilidad</TabsTrigger>
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
            <TabsTrigger value="compartir">Compartir</TabsTrigger>
          </TabsList>

          <TabsContent value="tipos">
            {loadingTipos ? (
              <div className="text-center py-8 text-neutral-500 text-sm">Cargando...</div>
            ) : (
              <TiposCitaTab
                calendarioId={calendario.id}
                usuarioId={usuarioId}
                tipos={tipos}
                onChange={cargarTipos}
                showToast={showToast}
              />
            )}
          </TabsContent>

          <TabsContent value="disponibilidad">
            <DisponibilidadTab calendarioId={calendario.id} showToast={showToast} />
          </TabsContent>

          <TabsContent value="reservas">
            <ReservasTab calendarioId={calendario.id} usuarioId={usuarioId} showToast={showToast} />
          </TabsContent>

          <TabsContent value="compartir">
            <CompartirTab tipos={tipos} webSlug={webSlug} showToast={showToast} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

// ── Tipos de cita ──────────────────────────────────────────────────

function TiposCitaTab({
  calendarioId, usuarioId, tipos, onChange, showToast,
}: {
  calendarioId: string; usuarioId: string; tipos: AgendaTipoCita[]; onChange: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [editando, setEditando] = useState<AgendaTipoCita | 'nuevo' | null>(null);

  async function handleEliminar(id: string) {
    if (!confirm('¿Eliminar este tipo de cita?')) return;
    try {
      await eliminarTipoCita(id);
      onChange();
      showToast('Tipo de cita eliminado');
    } catch (e: any) {
      showToast(e.message || 'Error al eliminar', 'error');
    }
  }

  if (editando) {
    return (
      <TipoCitaForm
        calendarioId={calendarioId}
        usuarioId={usuarioId}
        tipo={editando === 'nuevo' ? null : editando}
        onCancel={() => setEditando(null)}
        onSaved={() => { setEditando(null); onChange(); }}
        showToast={showToast}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setEditando('nuevo')}><Plus className="w-3.5 h-3.5" /> Nuevo tipo de cita</Button>
      </div>
      <div className="space-y-2">
        {tipos.map(tipo => (
          <div key={tipo.id} className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-white/10">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{tipo.nombre}</span>
                <span className="text-xs text-neutral-400">{tipo.duracion_minutos} min</span>
                {!tipo.activo && <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-white/10 text-neutral-500">Inactivo</span>}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {tipo.modalidades.map(m => (
                  <span key={m} className="text-[11px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/8 text-neutral-500 dark:text-white/60">
                    {AGENDA_MODALIDAD_LABELS[m]}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setEditando(tipo)}>Editar</Button>
              <Button variant="ghost" size="icon-sm" onClick={() => handleEliminar(tipo.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
            </div>
          </div>
        ))}
        {tipos.length === 0 && <p className="text-sm text-neutral-400 py-4 text-center">Aún no tienes tipos de cita en este calendario.</p>}
      </div>
    </div>
  );
}

function TipoCitaForm({
  calendarioId, usuarioId, tipo, onCancel, onSaved, showToast,
}: {
  calendarioId: string; usuarioId: string; tipo: AgendaTipoCita | null; onCancel: () => void; onSaved: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [nombre, setNombre] = useState(tipo?.nombre || '');
  const [slug, setSlug] = useState(tipo?.slug || '');
  const [slugTocado, setSlugTocado] = useState(!!tipo);
  const [descripcion, setDescripcion] = useState(tipo?.descripcion || '');
  const [duracion, setDuracion] = useState(tipo?.duracion_minutos ?? 30);
  const [bufferAntes, setBufferAntes] = useState(tipo?.buffer_antes_minutos ?? 0);
  const [bufferDespues, setBufferDespues] = useState(tipo?.buffer_despues_minutos ?? 0);
  const [anticipacion, setAnticipacion] = useState(tipo?.anticipacion_minima_minutos ?? 60);
  const [limitePorDia, setLimitePorDia] = useState<string>(tipo?.limite_reservas_por_dia?.toString() || '');
  const [modalidades, setModalidades] = useState<AgendaModalidad[]>(tipo?.modalidades || ['jitsi']);
  const [direccion, setDireccion] = useState(tipo?.direccion || '');
  const [telefono, setTelefono] = useState(tipo?.telefono_organizador || '');
  const [activo, setActivo] = useState(tipo?.activo ?? true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!slugTocado) setSlug(slugify(nombre));
  }, [nombre, slugTocado]);

  function toggleModalidad(m: AgendaModalidad) {
    setModalidades(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }

  async function handleGuardar() {
    if (!nombre.trim() || !slug.trim() || modalidades.length === 0) {
      showToast('Nombre, liga y al menos una modalidad son requeridos', 'error');
      return;
    }
    setGuardando(true);
    try {
      const slugLimpio = slugify(slug);
      const disponible = await tipoCitaSlugDisponible(usuarioId, slugLimpio, tipo?.id);
      if (!disponible) {
        showToast('Ya tienes otro tipo de cita con esa liga, elige otra', 'error');
        setGuardando(false);
        return;
      }

      const payload = {
        nombre: nombre.trim(),
        slug: slugLimpio,
        descripcion: descripcion.trim() || null,
        duracion_minutos: duracion,
        buffer_antes_minutos: bufferAntes,
        buffer_despues_minutos: bufferDespues,
        anticipacion_minima_minutos: anticipacion,
        limite_reservas_por_dia: limitePorDia ? parseInt(limitePorDia, 10) : null,
        modalidades,
        direccion: modalidades.includes('presencial') ? direccion.trim() || null : null,
        telefono_organizador: modalidades.includes('telefono') ? telefono.trim() || null : null,
        activo,
      };

      if (tipo) {
        await actualizarTipoCita(tipo.id, payload);
      } else {
        await crearTipoCita({ calendario_id: calendarioId, user_id: usuarioId, color: null, ...payload });
      }
      showToast('Tipo de cita guardado');
      onSaved();
    } catch (e: any) {
      showToast(e.message || 'Error al guardar', 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Nombre</Label>
          <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Llamada de descubrimiento" />
        </div>
        <div>
          <Label>Liga pública (slug)</Label>
          <Input value={slug} onChange={e => { setSlug(e.target.value); setSlugTocado(true); }} placeholder="llamada-descubrimiento" />
        </div>
      </div>

      <div>
        <Label>Descripción</Label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          className="w-full px-3.5 py-2 border border-neutral-200 dark:border-white/15 dark:bg-white/6 rounded-xl text-sm min-h-[70px] focus:outline-none focus:ring-2 focus:ring-accent/30"
          placeholder="De qué trata esta cita, qué debe traer el invitado, etc."
        />
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <div>
          <Label>Duración (min)</Label>
          <Input type="number" min={5} step={5} value={duracion} onChange={e => setDuracion(parseInt(e.target.value, 10) || 5)} />
        </div>
        <div>
          <Label>Buffer antes (min)</Label>
          <Input type="number" min={0} step={5} value={bufferAntes} onChange={e => setBufferAntes(parseInt(e.target.value, 10) || 0)} />
        </div>
        <div>
          <Label>Buffer después (min)</Label>
          <Input type="number" min={0} step={5} value={bufferDespues} onChange={e => setBufferDespues(parseInt(e.target.value, 10) || 0)} />
        </div>
        <div>
          <Label>Anticipación mínima (min)</Label>
          <Input type="number" min={0} step={15} value={anticipacion} onChange={e => setAnticipacion(parseInt(e.target.value, 10) || 0)} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Límite de reservas por día (opcional)</Label>
          <Input type="number" min={1} value={limitePorDia} onChange={e => setLimitePorDia(e.target.value)} placeholder="Sin límite" />
        </div>
      </div>

      <div>
        <Label>Modalidades permitidas</Label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {MODALIDADES_DISPONIBLES.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => toggleModalidad(m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                modalidades.includes(m)
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'border-neutral-200 dark:border-white/15 text-neutral-500 dark:text-white/60'
              }`}
            >
              {m === 'jitsi' && <Video className="w-3.5 h-3.5" />}
              {m === 'presencial' && <MapPin className="w-3.5 h-3.5" />}
              {m === 'telefono' && <Phone className="w-3.5 h-3.5" />}
              {AGENDA_MODALIDAD_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {modalidades.includes('presencial') && (
        <div>
          <Label>Dirección</Label>
          <Input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, número, colonia, ciudad" />
        </div>
      )}
      {modalidades.includes('telefono') && (
        <div>
          <Label>Teléfono de contacto</Label>
          <Input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="55 1234 5678" />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} className="w-4 h-4" />
        Activo (visible para reservar)
      </label>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleGuardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</Button>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

// ── Disponibilidad ──────────────────────────────────────────────────

function DisponibilidadTab({ calendarioId, showToast }: { calendarioId: string; showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [reglas, setReglas] = useState<AgendaReglaDisponibilidad[]>([]);
  const [excepciones, setExcepciones] = useState<AgendaExcepcionDisponibilidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevaExcepcionFecha, setNuevaExcepcionFecha] = useState('');
  const [nuevaExcepcionMotivo, setNuevaExcepcionMotivo] = useState('');

  useEffect(() => { cargar(); }, [calendarioId]);

  async function cargar() {
    setLoading(true);
    try {
      const [r, e] = await Promise.all([listReglas(calendarioId), listExcepciones(calendarioId)]);
      setReglas(r);
      setExcepciones(e);
    } finally {
      setLoading(false);
    }
  }

  const reglasPorDia = useMemo(() => {
    const map = new Map<number, AgendaReglaDisponibilidad[]>();
    for (const r of reglas) map.set(r.weekday, [...(map.get(r.weekday) || []), r]);
    return map;
  }, [reglas]);

  async function handleAgregarRegla(weekday: number) {
    try {
      const nueva = await crearRegla({ calendario_id: calendarioId, weekday, start_time: '09:00', end_time: '18:00', activo: true });
      setReglas(prev => [...prev, nueva]);
    } catch (e: any) {
      showToast(e.message || 'Error al agregar horario', 'error');
    }
  }

  async function handleEliminarRegla(id: string) {
    try {
      await eliminarRegla(id);
      setReglas(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      showToast(e.message || 'Error al eliminar', 'error');
    }
  }

  async function handleAgregarExcepcion() {
    if (!nuevaExcepcionFecha) return;
    try {
      const nueva = await crearExcepcion({
        calendario_id: calendarioId, fecha: nuevaExcepcionFecha, todo_el_dia: true,
        start_time: null, end_time: null, motivo: nuevaExcepcionMotivo.trim() || null,
      });
      setExcepciones(prev => [...prev, nueva].sort((a, b) => a.fecha.localeCompare(b.fecha)));
      setNuevaExcepcionFecha('');
      setNuevaExcepcionMotivo('');
    } catch (e: any) {
      showToast(e.message || 'Error al agregar excepción', 'error');
    }
  }

  async function handleEliminarExcepcion(id: string) {
    try {
      await eliminarExcepcion(id);
      setExcepciones(prev => prev.filter(e => e.id !== id));
    } catch (e: any) {
      showToast(e.message || 'Error al eliminar', 'error');
    }
  }

  if (loading) return <div className="text-center py-8 text-neutral-500 text-sm">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">Horarios recurrentes</h3>
        <div className="space-y-2">
          {WEEKDAY_LABELS.map((label, weekday) => (
            <div key={weekday} className="flex items-start gap-3 py-1.5 border-b border-neutral-100 dark:border-white/8 last:border-0">
              <span className="w-24 text-sm font-medium pt-1.5 flex-shrink-0">{label}</span>
              <div className="flex-1 space-y-1.5">
                {(reglasPorDia.get(weekday) || []).map(regla => (
                  <div key={regla.id} className="flex items-center gap-2">
                    <input
                      type="time"
                      defaultValue={regla.start_time.slice(0, 5)}
                      onBlur={async e => {
                        setReglas(prev => prev.map(r => r.id === regla.id ? { ...r, start_time: e.target.value } : r));
                        await eliminarRegla(regla.id);
                        const nueva = await crearRegla({ calendario_id: calendarioId, weekday, start_time: e.target.value, end_time: regla.end_time, activo: true });
                        setReglas(prev => [...prev.filter(r => r.id !== regla.id), nueva]);
                      }}
                      className="h-8 px-2 rounded-lg border border-neutral-200 dark:border-white/15 bg-white dark:bg-white/6 text-sm"
                    />
                    <span className="text-neutral-400 text-sm">–</span>
                    <input
                      type="time"
                      defaultValue={regla.end_time.slice(0, 5)}
                      onBlur={async e => {
                        await eliminarRegla(regla.id);
                        const nueva = await crearRegla({ calendario_id: calendarioId, weekday, start_time: regla.start_time, end_time: e.target.value, activo: true });
                        setReglas(prev => [...prev.filter(r => r.id !== regla.id), nueva]);
                      }}
                      className="h-8 px-2 rounded-lg border border-neutral-200 dark:border-white/15 bg-white dark:bg-white/6 text-sm"
                    />
                    <button onClick={() => handleEliminarRegla(regla.id)} className="text-neutral-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => handleAgregarRegla(weekday)} className="text-xs text-accent font-medium hover:underline">
                  + Agregar horario
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Días bloqueados (vacaciones, excepciones)</h3>
        <div className="flex gap-2 mb-3">
          <Input type="date" value={nuevaExcepcionFecha} onChange={e => setNuevaExcepcionFecha(e.target.value)} className="w-auto" />
          <Input value={nuevaExcepcionMotivo} onChange={e => setNuevaExcepcionMotivo(e.target.value)} placeholder="Motivo (opcional)" />
          <Button size="sm" onClick={handleAgregarExcepcion} disabled={!nuevaExcepcionFecha}><Plus className="w-3.5 h-3.5" /> Bloquear día</Button>
        </div>
        <div className="space-y-1.5">
          {excepciones.map(exc => (
            <div key={exc.id} className="flex items-center justify-between px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 text-sm">
              <span>{exc.fecha} {exc.motivo && <span className="text-neutral-400">— {exc.motivo}</span>}</span>
              <button onClick={() => handleEliminarExcepcion(exc.id)} className="text-neutral-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {excepciones.length === 0 && <p className="text-xs text-neutral-400">Sin días bloqueados.</p>}
        </div>
      </div>
    </div>
  );
}

// ── Reservas ──────────────────────────────────────────────────

function ReservasTab({ calendarioId, usuarioId, showToast }: { calendarioId: string; usuarioId: string; showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [reservas, setReservas] = useState<AgendaReserva[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { cargar(); }, [calendarioId]);

  async function cargar() {
    setLoading(true);
    try {
      const todas = await listReservas(usuarioId);
      setReservas(todas.filter(r => r.calendario_id === calendarioId));
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelar(id: string) {
    const motivo = prompt('Motivo de la cancelación (se puede dejar vacío):') || '';
    try {
      await cancelarReserva(id, motivo);
      cargar();
      showToast('Reserva cancelada');
    } catch (e: any) {
      showToast(e.message || 'Error al cancelar', 'error');
    }
  }

  if (loading) return <div className="text-center py-8 text-neutral-500 text-sm">Cargando...</div>;

  return (
    <div className="space-y-2">
      {reservas.map(r => (
        <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              {new Date(r.start_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
              {r.status === 'cancelada' && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">Cancelada</span>}
            </div>
            <p className="text-xs text-neutral-500 truncate">{r.invitado_nombre} · {r.invitado_email}</p>
            {r.meeting_url && <a href={r.meeting_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Enlace de videollamada</a>}
          </div>
          {r.status === 'confirmada' && (
            <Button variant="ghost" size="sm" onClick={() => handleCancelar(r.id)}>Cancelar</Button>
          )}
        </div>
      ))}
      {reservas.length === 0 && <p className="text-sm text-neutral-400 py-4 text-center">Aún no hay reservas en este calendario.</p>}
    </div>
  );
}

// ── Compartir ──────────────────────────────────────────────────

function CompartirTab({ tipos, webSlug, showToast }: { tipos: AgendaTipoCita[]; webSlug: string | null; showToast: (msg: string, type?: 'success' | 'error') => void }) {
  if (!webSlug) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-800 dark:text-yellow-300">
        Necesitas un slug configurado en "Mi Página Web" para compartir tu liga de reservas. Contacta a tu gerente para que te lo asigne.
      </div>
    );
  }

  const base = typeof window !== 'undefined' ? window.location.origin : 'https://app.movi.digital';

  return (
    <div className="space-y-2">
      {tipos.filter(t => t.activo).map(tipo => {
        const url = `${base}/agenda/${webSlug}/${tipo.slug}`;
        return (
          <div key={tipo.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200 dark:border-white/10">
            <div className="min-w-0">
              <p className="text-sm font-medium">{tipo.nombre}</p>
              <p className="text-xs text-neutral-500 truncate">{url}</p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(url); showToast('Liga copiada'); }}>
                <Copy className="w-3.5 h-3.5" /> Copiar
              </Button>
              <Button variant="ghost" size="icon-sm" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a>
              </Button>
            </div>
          </div>
        );
      })}
      {tipos.filter(t => t.activo).length === 0 && <p className="text-sm text-neutral-400 py-4 text-center">Activa un tipo de cita para compartir su liga.</p>}
    </div>
  );
}
