import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, ArrowUpRight, ChevronRight, FileText,
  Mail, MessageCircle, Play, Radio, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Usuario } from '@/contexts/MoviAuthContext';
import { useMiResumen } from '@/lib/useMiResumen';

// ── Tipos ───────────────────────────────────────────────────────────────

interface Tramite {
  id: string;
  folio: string | null;
  tipo_tramite: string | null;
  prioridad: string | null;
  fecha_creacion: string | null;
  estatus: { nombre: string; color?: string | null } | null;
}

interface Correo {
  id: string;
  remitente_nombre: string | null;
  remitente_email: string | null;
  asunto: string | null;
  fecha: string | null;
}

interface ChatWa {
  id: string;
  remote_name: string | null;
  remote_phone: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number | null;
}

interface Comunicado {
  id: string;
  titulo: string;
  imagen_principal: string | null;
  fecha_publicacion: string | null;
}

interface Capacitacion {
  id: string;
  titulo: string;
  fecha_inicio: string | null;
  portada_url: string | null;
  estado: string;
}

interface Leccion {
  id: string;
  titulo: string;
  miniatura_url: string | null;
  duracion: number | null;
}

// ── Utilidades ──────────────────────────────────────────────────────────

const dinero = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

function hace(iso: string | null, ahora: number) {
  if (!iso || !ahora) return '';
  const min = Math.floor((ahora - new Date(iso).getTime()) / 60000);
  if (min < 60) return `${Math.max(min, 1)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 día' : `${d} días`;
}

function cuando(iso: string | null, ahora: number) {
  if (!iso || !ahora) return '';
  const d = new Date(iso);
  const hoy = new Date(ahora);
  const mismoDia = d.toDateString() === hoy.toDateString();
  const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  if (mismoDia) return `Hoy · ${hora}`;
  return `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · ${hora}`;
}

function minutos(seg: number | null) {
  const total = Math.round(seg || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

// ── Bloque principal ────────────────────────────────────────────────────

export function PanelDelDia({ usuario }: { usuario: Usuario }) {
  const navigate = useNavigate();
  const resumen = useMiResumen();

  const [cargando, setCargando] = useState(true);
  // Se fija al cargar para no leer el reloj durante el render.
  const [ahora, setAhora] = useState(0);
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [totalTramites, setTotalTramites] = useState(0);
  const [correos, setCorreos] = useState<Correo[]>([]);
  const [totalCorreos, setTotalCorreos] = useState(0);
  const [chats, setChats] = useState<ChatWa[]>([]);
  const [totalChats, setTotalChats] = useState(0);
  const [comunicado, setComunicado] = useState<Comunicado | null>(null);
  const [capacitacion, setCapacitacion] = useState<Capacitacion | null>(null);
  const [leccion, setLeccion] = useState<Leccion | null>(null);

  useEffect(() => {
    let vivo = true;

    const cargar = async () => {
      const t0 = Date.now();
      const [tramitesRes, correosRes, chatsRes, comunicadoRes, claseRes, leccionRes] = await Promise.all([
        // Trámites abiertos: primero los de prioridad alta y los más viejos.
        supabase
          .from('tickets')
          .select('id, folio, tipo_tramite, prioridad, fecha_creacion, estatus:estatus_id(nombre, color)')
          .is('cerrado_en', null)
          .is('eliminado_at', null)
          .order('fecha_creacion', { ascending: true })
          .limit(30),
        supabase
          .from('correos_usuario')
          .select('id, remitente_nombre, remitente_email, asunto, fecha')
          .eq('usuario_id', usuario.id)
          .eq('leido', false)
          .order('fecha', { ascending: false })
          .limit(4),
        supabase
          .from('whatsapp_conversations')
          .select('id, remote_name, remote_phone, last_message_text, last_message_at, unread_count')
          .eq('user_id', usuario.id)
          .gt('unread_count', 0)
          .order('last_message_at', { ascending: false })
          .limit(4),
        supabase
          .from('comunicados_publicaciones')
          .select('id, titulo, imagen_principal, fecha_publicacion')
          .eq('publicado', true)
          .order('fecha_publicacion', { ascending: false })
          .limit(1),
        supabase
          .from('aula_eventos')
          .select('id, titulo, fecha_inicio, portada_url, estado')
          .in('estado', ['programado', 'en_vivo'])
          .gte('fecha_inicio', new Date(Date.now() - 3600_000).toISOString())
          .order('fecha_inicio', { ascending: true })
          .limit(1),
        supabase
          .from('seguros_lessons')
          .select('id, titulo, miniatura_url, duracion')
          .order('fecha_creacion', { ascending: false })
          .limit(1),
      ]);

      if (!vivo) return;
      setAhora(t0);

      const listaTramites = (tramitesRes.data ?? []) as unknown as Tramite[];
      const ordenados = [...listaTramites].sort((a, b) => {
        const peso = (p: string | null) => (p === 'Alta' ? 0 : p === 'Media' ? 1 : 2);
        const porPrioridad = peso(a.prioridad) - peso(b.prioridad);
        if (porPrioridad !== 0) return porPrioridad;
        return new Date(a.fecha_creacion ?? 0).getTime() - new Date(b.fecha_creacion ?? 0).getTime();
      });
      setTramites(ordenados.slice(0, 4));
      setTotalTramites(ordenados.length);

      const listaCorreos = (correosRes.data ?? []) as Correo[];
      setCorreos(listaCorreos.slice(0, 3));
      setTotalCorreos(listaCorreos.length);

      const listaChats = (chatsRes.data ?? []) as ChatWa[];
      setChats(listaChats.slice(0, 3));
      setTotalChats(listaChats.reduce((s, c) => s + (c.unread_count ?? 0), 0));

      setComunicado(((comunicadoRes.data ?? []) as Comunicado[])[0] ?? null);
      setCapacitacion(((claseRes.data ?? []) as Capacitacion[])[0] ?? null);
      setLeccion(((leccionRes.data ?? []) as Leccion[])[0] ?? null);
      setCargando(false);
    };

    void cargar();
    return () => {
      vivo = false;
    };
  }, [usuario.id]);

  const produccion = resumen !== 'loading' && resumen !== 'error' ? resumen.produccion : null;
  const zona = useMemo(() => usuario.oficina?.nombre ?? null, [usuario.oficina?.nombre]);

  return (
    <div className="space-y-4">

      {/* ── 1. Lo que requiere tu atención ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">

        {/* Trámites: lista, no tarjetas */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-soft bg-surface-card shadow-card dark:border-white/[0.07] dark:bg-neutral-900/60">
          <header className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 dark:border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold leading-tight text-neutral-900 dark:text-white">Requieren tu atención</h2>
                <p className="text-[11px] text-neutral-500 dark:text-white/50">
                  {cargando ? 'Cargando…' : `${totalTramites} trámite${totalTramites === 1 ? '' : 's'} abierto${totalTramites === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/tramites')}
              className="flex items-center gap-0.5 text-[11px] font-semibold text-accent-ink hover:underline"
            >
              Ver todos <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </header>

          <div className="flex-1 divide-y divide-neutral-100 dark:divide-white/[0.05]">
            {cargando ? (
              [0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-9 w-9 animate-pulse rounded-lg bg-neutral-200/70 dark:bg-white/10" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-2/5 animate-pulse rounded bg-neutral-200/70 dark:bg-white/10" />
                    <div className="h-2.5 w-1/4 animate-pulse rounded bg-neutral-200/70 dark:bg-white/10" />
                  </div>
                </div>
              ))
            ) : tramites.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-10 text-center">
                <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                  <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-neutral-700 dark:text-white/80">Todo al día</p>
                <p className="text-[11px] text-neutral-500 dark:text-white/50">No hay trámites abiertos contigo.</p>
              </div>
            ) : (
              tramites.map(t => {
                const dias = t.fecha_creacion && ahora
                  ? Math.floor((ahora - new Date(t.fecha_creacion).getTime()) / 86_400_000)
                  : 0;
                const urgente = t.prioridad === 'Alta' || dias >= 3;
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/tramites/${t.id}`)}
                    className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-50 dark:hover:bg-white/[0.03]"
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                        urgente
                          ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                          : 'bg-neutral-100 text-neutral-500 dark:bg-white/[0.06] dark:text-white/60',
                      )}
                    >
                      {dias > 0 ? `${dias}d` : 'hoy'}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-neutral-800 dark:text-white">
                        {t.tipo_tramite || 'Trámite'} {t.folio ? <span className="font-normal text-neutral-400">· {t.folio}</span> : null}
                      </p>
                      <p className="truncate text-[11px] text-neutral-500 dark:text-white/50">
                        {t.estatus?.nombre || 'Sin estatus'}
                        {t.prioridad ? ` · Prioridad ${t.prioridad.toLowerCase()}` : ''}
                      </p>
                    </div>

                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-accent-ink" />
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Mensajes sin leer */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <BandejaMensajes
            icono={Mail}
            titulo="Correos"
            tono="azul"
            total={totalCorreos}
            cargando={cargando}
            vacio="Bandeja al día"
            items={correos.map(c => ({
              id: c.id,
              titulo: c.remitente_nombre || c.remitente_email || 'Remitente',
              detalle: c.asunto || '(sin asunto)',
              cuando: hace(c.fecha, ahora),
            }))}
            onVerTodo={() => navigate('/centro-contacto/correos')}
          />

          <BandejaMensajes
            icono={MessageCircle}
            titulo="WhatsApp personal"
            tono="verde"
            total={totalChats}
            cargando={cargando}
            vacio="Sin mensajes pendientes"
            items={chats.map(c => ({
              id: c.id,
              titulo: c.remote_name || c.remote_phone || 'Chat',
              detalle: c.last_message_text || 'Nuevo mensaje',
              cuando: hace(c.last_message_at, ahora),
            }))}
            onVerTodo={() => navigate('/centro-contacto')}
          />
        </div>
      </div>

      {/* ── 2. Para ponerte al día ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">

        {/* Aula Virtual */}
        <TarjetaMedia
          etiqueta="Aula Virtual"
          tono="esmeralda"
          imagen={capacitacion?.portada_url ?? null}
          icono={Radio}
          onClick={() => navigate('/seguros-education/aula-virtual')}
          titulo={capacitacion?.titulo ?? 'Sin capacitaciones programadas'}
          pie={capacitacion?.fecha_inicio ? cuando(capacitacion.fecha_inicio, ahora) : 'Agenda la siguiente desde el Aula'}
          cta="Ver Aula Virtual"
          destacado={capacitacion?.estado === 'en_vivo'}
          textoDestacado={capacitacion?.estado === 'en_vivo' ? 'En vivo' : undefined}
        />

        {/* On Demand */}
        <TarjetaMedia
          etiqueta="On Demand"
          tono="indigo"
          imagen={leccion?.miniatura_url ?? null}
          icono={Play}
          onClick={() => navigate('/seguros-education/on-demand')}
          titulo={leccion?.titulo ?? 'Aún no hay grabaciones'}
          pie={leccion ? `Última publicada · ${minutos(leccion.duracion)}` : 'Publica desde Seguros Education'}
          cta="Ver On Demand"
        />

        {/* Comunicados */}
        <TarjetaMedia
          etiqueta="Comunicados"
          tono="violeta"
          imagen={comunicado?.imagen_principal ?? null}
          icono={Mail}
          onClick={() => navigate('/comunicados')}
          titulo={comunicado?.titulo ?? 'Sin comunicados nuevos'}
          pie={comunicado?.fecha_publicacion ? cuando(comunicado.fecha_publicacion, ahora) : 'Todo publicado'}
          cta="Ver comunicados"
        />
      </div>

      {/* ── 3. Central de producción ───────────────────────────────── */}
      {produccion && (
        <section className="overflow-hidden rounded-2xl border border-soft bg-surface-card dark:border-white/[0.07] dark:bg-neutral-900/60">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                <Wallet className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Central de producción</p>
                <p className="text-[11px] text-neutral-500 dark:text-white/50">
                  {zona ? `Tu producción · ${zona}` : 'Tu producción del año'}
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-wrap items-center gap-x-8 gap-y-3">
              <Dato
                etiqueta="Prima convenio"
                valor={dinero(produccion.prima_conv_actual)}
                extra={produccion.delta_pct != null ? {
                  texto: `${produccion.delta_pct >= 0 ? '+' : ''}${produccion.delta_pct}%`,
                  positivo: produccion.delta_pct >= 0,
                } : null}
              />
              {produccion.meta_monto != null && (
                <Dato
                  etiqueta="Meta anual"
                  valor={dinero(produccion.meta_monto)}
                  extra={produccion.meta_pct != null ? {
                    texto: `${Math.round(produccion.meta_pct)}%`,
                    positivo: produccion.meta_pct >= 50,
                  } : null}
                />
              )}
            </div>

            <button
              onClick={() => navigate('/central-produccion')}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-accent-ink transition hover:bg-accent-soft"
            >
              Ver detalle <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Piezas ──────────────────────────────────────────────────────────────

function Dato({
  etiqueta,
  valor,
  extra,
}: {
  etiqueta: string;
  valor: string;
  extra: { texto: string; positivo: boolean } | null;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-white/40">{etiqueta}</p>
      <p className="flex items-baseline gap-2 text-lg font-bold leading-tight text-neutral-900 dark:text-white">
        {valor}
        {extra && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-[11px] font-bold',
              extra.positivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
            )}
          >
            {extra.positivo ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {extra.texto}
          </span>
        )}
      </p>
    </div>
  );
}

function BandejaMensajes({
  icono: Icono,
  titulo,
  tono,
  total,
  items,
  vacio,
  cargando,
  onVerTodo,
}: {
  icono: typeof Mail;
  titulo: string;
  tono: 'azul' | 'verde';
  total: number;
  items: { id: string; titulo: string; detalle: string; cuando: string }[];
  vacio: string;
  cargando: boolean;
  onVerTodo: () => void;
}) {
  const color = tono === 'azul'
    ? { chip: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400', barra: 'bg-blue-500' }
    : { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', barra: 'bg-emerald-500' };

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-soft bg-surface-card shadow-card dark:border-white/[0.07] dark:bg-neutral-900/60">
      <button
        onClick={onVerTodo}
        className="group flex items-center gap-2.5 border-b border-neutral-100 px-4 py-3 text-left transition hover:bg-neutral-50 dark:border-white/[0.06] dark:hover:bg-white/[0.03]"
      >
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', color.chip)}>
          <Icono className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight text-neutral-900 dark:text-white">{titulo}</p>
          <p className="text-[11px] text-neutral-500 dark:text-white/50">
            {cargando ? 'Cargando…' : total > 0 ? `${total} sin leer` : vacio}
          </p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-accent-ink" />
      </button>

      {items.length > 0 && (
        <div className="flex-1 divide-y divide-neutral-100 dark:divide-white/[0.05]">
          {items.map(item => (
            <button
              key={item.id}
              onClick={onVerTodo}
              className="group flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-neutral-50 dark:hover:bg-white/[0.03]"
            >
              <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', color.barra)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-neutral-800 dark:text-white/90">{item.titulo}</p>
                <p className="truncate text-[11px] text-neutral-500 dark:text-white/45">{item.detalle}</p>
              </div>
              <span className="shrink-0 text-[10px] font-medium text-neutral-400">{item.cuando}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function TarjetaMedia({
  etiqueta,
  titulo,
  pie,
  imagen,
  icono: Icono,
  cta,
  onClick,
  tono,
  destacado,
  textoDestacado,
}: {
  etiqueta: string;
  titulo: string;
  pie: string;
  imagen: string | null;
  icono: typeof Mail;
  cta: string;
  onClick: () => void;
  tono: 'esmeralda' | 'indigo' | 'violeta';
  destacado?: boolean;
  textoDestacado?: string;
}) {
  const fondos: Record<string, string> = {
    esmeralda: 'from-emerald-600/90 to-teal-700/90',
    indigo: 'from-[#1C37E0]/90 to-indigo-800/90',
    violeta: 'from-violet-600/90 to-purple-800/90',
  };

  return (
    <button
      onClick={onClick}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-soft bg-surface-card text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/[0.07] dark:bg-neutral-900/60"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        {imagen ? (
          <img
            src={imagen}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={cn('absolute inset-0 bg-gradient-to-br', fondos[tono])} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          <Icono className="h-3 w-3" /> {etiqueta}
        </span>

        {destacado && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold uppercase text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> {textoDestacado}
          </span>
        )}

        <h3 className="absolute inset-x-3 bottom-3 line-clamp-2 text-sm font-bold leading-snug text-white drop-shadow">
          {titulo}
        </h3>
      </div>

      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <p className="truncate text-[11px] text-neutral-500 dark:text-white/50">{pie}</p>
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-accent-ink">
          {cta} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}