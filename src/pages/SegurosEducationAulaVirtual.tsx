import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Plus, Users, Video, Radio, Link as LinkIcon, Check,
  CircleCheck, CircleAlert as AlertCircle, Play, FileVideo, ExternalLink, Loader2, Crown, Hand, Image as ImageIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SegurosEducationLayout } from '../components/segurosEducation/SegurosEducationLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BaseModal } from '../components/BaseModal';
import { aulaDaily } from '../lib/aulaDaily';
import { analyticsTracker } from '../lib/analyticsTracker';
import { subirPortadaClase } from '../lib/aulaDaily';

interface Clase {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string;
  max_participantes: number | null;
  grabar: boolean;
  transcribir: boolean;
  link_token: string | null;
  daily_room_name: string | null;
  portada_url: string | null;
  leccion_id: string | null;
  categoria_id: string | null;
  creado_por: string | null;
}

interface Host {
  evento_id: string;
  usuario_id: string;
  rol: string;
  usuarios?: { nombre_completo: string | null; nombre: string | null; apellidos: string | null } | null;
}

interface Grabacion {
  id: string;
  evento_id: string;
  origen: string;
  estado: string;
  duracion_segundos: number | null;
  leccion_id: string | null;
}

interface Categoria {
  id: string;
  nombre: string;
}

interface UsuarioBrief {
  id: string;
  nombre_completo: string | null;
  nombre: string | null;
  apellidos: string | null;
  rol: string;
}

const nombreUsuario = (u?: { nombre_completo?: string | null; nombre?: string | null; apellidos?: string | null } | null) =>
  u?.nombre_completo || [u?.nombre, u?.apellidos].filter(Boolean).join(' ') || 'Usuario MOVI';

function estadoVisual(estado: string) {
  if (estado === 'en_vivo') return { texto: 'En vivo', clase: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400' };
  if (estado === 'finalizado') return { texto: 'Finalizada', clase: 'bg-surface-100 text-neutral-500 dark:bg-white/10 dark:text-white/55' };
  if (estado === 'cancelado') return { texto: 'Cancelada', clase: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' };
  return { texto: 'Programada', clase: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' };
}

function duracion(segundos: number | null) {
  if (!segundos) return '—';
  const m = Math.round(segundos / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export function SegurosEducationAulaVirtual() {
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [clases, setClases] = useState<Clase[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [grabaciones, setGrabaciones] = useState<Grabacion[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [equipo, setEquipo] = useState<UsuarioBrief[]>([]);
  const [asistentes, setAsistentes] = useState<Record<string, number>>({});
  // Se refresca por intervalo para no leer el reloj durante el render.
  const [ahora, setAhora] = useState<number>(() => Date.now());

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCrear, setShowCrear] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const avisar = useCallback((mensaje: string) => {
    setAviso(mensaje);
    window.setTimeout(() => setAviso(null), 4000);
  }, []);

  const cargar = useCallback(async () => {
    const { data: eventos } = await supabase
      .from('aula_eventos')
      .select('id, titulo, descripcion, fecha_inicio, fecha_fin, estado, max_participantes, grabar, transcribir, link_token, daily_room_name, portada_url, leccion_id, categoria_id, creado_por')
      .order('fecha_inicio', { ascending: false, nullsFirst: false })
      .limit(200);

    const lista = (eventos ?? []) as Clase[];
    setClases(lista);

    if (lista.length) {
      const ids = lista.map((c) => c.id);
      const [{ data: h }, { data: g }, { data: p }] = await Promise.all([
        supabase.from('aula_evento_hosts').select('evento_id, usuario_id, rol, usuarios(nombre_completo, nombre, apellidos)').in('evento_id', ids),
        supabase.from('aula_grabaciones').select('id, evento_id, origen, estado, duracion_segundos, leccion_id').in('evento_id', ids),
        supabase.from('aula_participantes').select('evento_id').in('evento_id', ids).is('salido_at', null),
      ]);

      setHosts((h ?? []) as unknown as Host[]);
      setGrabaciones((g ?? []) as Grabacion[]);

      const cuenta: Record<string, number> = {};
      for (const fila of (p ?? []) as Array<{ evento_id: string }>) {
        cuenta[fila.evento_id] = (cuenta[fila.evento_id] ?? 0) + 1;
      }
      setAsistentes(cuenta);
    } else {
      setHosts([]);
      setGrabaciones([]);
      setAsistentes({});
    }
  }, []);

  const cargarCatalogos = useCallback(async () => {
    const [{ data: cats }, { data: users }] = await Promise.all([
      supabase.from('seguros_categories').select('id, nombre').eq('activa', true).order('orden'),
      supabase.from('usuarios').select('id, nombre_completo, nombre, apellidos, rol').eq('activo', true).order('nombre'),
    ]);
    setCategorias((cats ?? []) as Categoria[]);
    setEquipo((users ?? []) as UsuarioBrief[]);
  }, []);

  useEffect(() => {
    let vivo = true;
    const init = async () => {
      if (!usuario) return;
      let admin = usuario.rol === 'Administrador';
      if (!admin && usuario.rol === 'Gerente') {
        const { data } = await supabase.rpc('tiene_permiso_admin_en_modulo', {
          p_usuario_id: usuario.id,
          p_modulo_codigo: 'seguros_education',
        });
        admin = data === true;
      }
      if (!vivo) return;
      setIsAdmin(admin);
      await Promise.all([cargar(), admin ? cargarCatalogos() : Promise.resolve()]);
      if (vivo) setLoading(false);
    };
    void init();
    return () => {
      vivo = false;
    };
  }, [usuario, cargar, cargarCatalogos]);

  const puedeAdministrar = (claseId: string) => {
    if (!usuario) return false;
    if (isAdmin) return true;
    return hosts.some((h) => h.evento_id === claseId && h.usuario_id === usuario.id);
  };

  // Mantiene "próximas" y la etiqueta "Pronto" al día sin leer el reloj en render.
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const enVivo = useMemo(() => clases.filter((c) => c.estado === 'en_vivo'), [clases]);
  const proximas = useMemo(() => {
    return clases
      .filter((c) => c.estado === 'programado' && (!c.fecha_inicio || new Date(c.fecha_inicio).getTime() >= ahora - 30 * 60_000))
      .sort((a, b) => (a.fecha_inicio ?? '').localeCompare(b.fecha_inicio ?? ''));
  }, [clases, ahora]);
  const pasadas = useMemo(
    () => clases.filter((c) => c.estado === 'finalizado' || c.estado === 'cancelado').slice(0, 12),
    [clases],
  );

  const copiarEnlace = async (clase: Clase) => {
    if (!clase.link_token) {
      avisar('La sala todavía no está creada. Abre la clase para generarla.');
      return;
    }
    const url = `${window.location.origin}/aula/${clase.link_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(clase.id);
      window.setTimeout(() => setCopiado(null), 2000);
    } catch {
      window.prompt('Copia el link para el ponente externo:', url);
    }
  };

  const iniciarClase = async (clase: Clase) => {
    if (!confirm(`¿Iniciar "${clase.titulo}"? Se abrirá la grabación en la nube y los asistentes podrán entrar.`)) return;
    setOcupado(clase.id);
    try {
      if (!clase.daily_room_name) await aulaDaily.crearSala(clase.id);
      const r = await aulaDaily.iniciar(clase.id);
      if (r.grabacion?.error) {
        avisar(`La clase inició, pero la grabación en la nube no arrancó (${r.grabacion.error}). La grabación local sigue activa.`);
      }
      analyticsTracker.trackClassJoinClick?.(clase.id);
      navigate(`/seguros-education/aula-virtual/${clase.id}`);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo iniciar la clase');
    } finally {
      setOcupado(null);
    }
  };

  const entrar = (clase: Clase) => {
    analyticsTracker.trackClassJoinClick?.(clase.id);
    navigate(`/seguros-education/aula-virtual/${clase.id}`);
  };

  const crearClase = async (datos: {
    titulo: string;
    descripcion: string;
    fecha: string;
    hora: string;
    duracionMin: number;
    cupo: number;
    grabar: boolean;
    transcribir: boolean;
    categoriaId: string | null;
    cohosts: string[];
    portada: File;
  }) => {
    if (!usuario) throw new Error('Sesión no disponible');

    const inicio = new Date(`${datos.fecha}T${datos.hora}:00`);
    const fin = new Date(inicio.getTime() + datos.duracionMin * 60_000);

    // La portada se sube antes de crear el evento: es obligatoria y es la misma
    // imagen que después viaja como miniatura de la lección en On Demand.
    const portadaUrl = await subirPortadaClase(datos.portada);

    const { data, error } = await supabase
      .from('aula_eventos')
      .insert({
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim() || null,
        // `ponente` es legado del calendario, pero la portada del módulo lo pinta.
        ponente: nombreUsuario(usuario),
        fecha: datos.fecha,
        hora: `${datos.hora}:00`,
        fecha_inicio: inicio.toISOString(),
        fecha_fin: fin.toISOString(),
        estado: 'programado',
        max_participantes: datos.cupo,
        grabar: datos.grabar,
        transcribir: datos.transcribir,
        categoria_id: datos.categoriaId,
        portada_url: portadaUrl,
        creado_por: usuario.id,
        visible_para_todos: true,
        link_activo: true,
      })
      .select('id')
      .maybeSingle();

    if (error) throw error;
    const id = data!.id as string;

    await supabase.from('aula_evento_hosts').insert([
      { evento_id: id, usuario_id: usuario.id, rol: 'host' },
      ...datos.cohosts.filter((u) => u !== usuario.id).map((u) => ({ evento_id: id, usuario_id: u, rol: 'cohost' })),
    ]);

    const sala = await aulaDaily.crearSala(id);
    await cargar();
    return { id, link: sala.link_token ? `${window.location.origin}/aula/${sala.link_token}` : null };
  };

  if (loading) {
    return (
      <SegurosEducationLayout sectionTitle="Aula Virtual" sectionDescription="Clases en vivo con grabación automática">
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-accent/20 border-t-accent" />
        </div>
      </SegurosEducationLayout>
    );
  }

  return (
    <SegurosEducationLayout
      sectionTitle="Aula Virtual"
      sectionDescription="Cada clase genera su sala, su grabación y su lección en On Demand"
    >
      <div className="space-y-5">
        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-body-sm text-neutral-500 dark:text-white/55">
            <Video className="h-4 w-4 text-accent-ink" />
            <span>
              {proximas.length + enVivo.length} {proximas.length + enVivo.length === 1 ? 'clase activa' : 'clases activas'}
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCrear(true)}
              className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-body-sm font-semibold text-white transition hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" /> Nueva clase
            </button>
          )}
        </div>

        {/* En vivo */}
        {enVivo.length > 0 && (
          <div className="space-y-3">
            {enVivo.map((clase) => (
              <div
                key={clase.id}
                className="overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-red-500 to-red-600 p-5 text-white shadow-lg dark:border-red-500/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                      </span>
                      <span className="text-micro font-bold uppercase tracking-wide">En vivo</span>
                      <span className="text-micro text-white/80">
                        {asistentes[clase.id] ?? 0} conectados
                      </span>
                    </div>
                    <h3 className="truncate text-title font-bold">{clase.titulo}</h3>
                    {clase.descripcion && (
                      <p className="mt-0.5 line-clamp-2 text-body-sm text-white/85">{clase.descripcion}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-caption text-white/80">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {clase.fecha_inicio ? format(new Date(clase.fecha_inicio), 'HH:mm', { locale: es }) : '—'}
                      </span>
                      {clase.grabar && (
                        <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
                          <Radio className="h-3 w-3" /> Grabando
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {puedeAdministrar(clase.id) && (
                      <button
                        onClick={() => void copiarEnlace(clase)}
                        className="rounded-lg bg-white/20 p-2.5 transition hover:bg-white/30"
                        title="Copiar link del ponente externo"
                      >
                        {copiado === clase.id ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                      </button>
                    )}
                    <button
                      onClick={() => entrar(clase)}
                      className="rounded-lg bg-white px-5 py-2.5 text-body-sm font-bold text-red-600 transition hover:bg-red-50"
                    >
                      Entrar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {enVivo.length === 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-body-sm font-semibold text-amber-900 dark:text-amber-200">No hay clases en vivo</p>
              <p className="text-caption text-amber-800 dark:text-amber-300/80">
                Cuando alguien inicie una clase aparecerá aquí con su sala.
              </p>
            </div>
          </div>
        )}

        {/* Próximas */}
        <section className="overflow-hidden rounded-xl border border-soft bg-surface-card shadow-card dark:border-white/10">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-white/10">
            <h2 className="flex items-center gap-2 text-base font-bold text-neutral-800 dark:text-white">
              <Calendar className="h-4 w-4 text-accent-ink" /> Próximas clases
            </h2>
            <span className="text-caption text-neutral-400">{proximas.length}</span>
          </div>

          {proximas.length === 0 ? (
            <p className="px-4 py-8 text-center text-body-sm text-neutral-400">
              No hay clases programadas.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-white/5">
              {proximas.map((clase) => {
                const inicio = clase.fecha_inicio ? new Date(clase.fecha_inicio) : null;
                const enUnaHora = inicio ? inicio.getTime() - ahora < 3600_000 : false;
                return (
                  <li key={clase.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-surface-50 dark:hover:bg-white/[0.03]">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                      <span className="text-[10px] font-bold uppercase leading-none">
                        {inicio ? format(inicio, 'MMM', { locale: es }) : '—'}
                      </span>
                      <span className="text-body font-bold leading-tight">{inicio ? format(inicio, 'd') : '—'}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-body-sm font-semibold text-neutral-900 dark:text-white">{clase.titulo}</h3>
                        {enUnaHora && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                            Pronto
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-neutral-500 dark:text-white/50">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {inicio ? format(inicio, "d MMM · HH:mm", { locale: es }) : 'Sin fecha'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {clase.max_participantes ?? 100}
                        </span>
                        {clase.grabar && <span className="flex items-center gap-1"><Radio className="h-3 w-3" /> Se graba</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {puedeAdministrar(clase.id) && (
                        <button
                          onClick={() => void copiarEnlace(clase)}
                          className="rounded-lg p-2 text-neutral-400 transition hover:bg-surface-100 hover:text-accent-ink dark:hover:bg-white/10"
                          title="Copiar link del ponente externo"
                        >
                          {copiado === clase.id ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                        </button>
                      )}
                      {puedeAdministrar(clase.id) ? (
                        <button
                          onClick={() => void iniciarClase(clase)}
                          disabled={ocupado === clase.id}
                          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-caption font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
                        >
                          {ocupado === clase.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          Iniciar
                        </button>
                      ) : (
                        <span className="rounded-lg bg-surface-100 px-3 py-1.5 text-caption font-semibold text-neutral-500 dark:bg-white/10 dark:text-white/50">
                          Aún no inicia
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Finalizadas */}
        {pasadas.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-soft bg-surface-card shadow-card dark:border-white/10">
            <div className="border-b border-neutral-200 px-4 py-3 dark:border-white/10">
              <h2 className="flex items-center gap-2 text-base font-bold text-neutral-800 dark:text-white">
                <FileVideo className="h-4 w-4 text-accent-ink" /> Clases anteriores
              </h2>
            </div>
            <ul className="divide-y divide-neutral-100 dark:divide-white/5">
              {pasadas.map((clase) => {
                const grab = grabaciones.filter((g) => g.evento_id === clase.id);
                const publicada = grab.find((g) => g.estado === 'publicada');
                return (
                  <li key={clase.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-body-sm font-semibold text-neutral-900 dark:text-white">{clase.titulo}</h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-caption text-neutral-500 dark:text-white/50">
                        <span>{clase.fecha_inicio ? format(new Date(clase.fecha_inicio), "d MMM yyyy · HH:mm", { locale: es }) : '—'}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${estadoVisual(clase.estado).clase}`}>
                          {estadoVisual(clase.estado).texto}
                        </span>
                        {publicada && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                            <CircleCheck className="h-2.5 w-2.5" /> Publicada · {duracion(publicada.duracion_segundos)}
                          </span>
                        )}
                        {!publicada && grab.some((g) => g.estado === 'error') && (
                          <span className="flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-400">
                            <AlertCircle className="h-2.5 w-2.5" /> Grabación con error
                          </span>
                        )}
                      </div>
                    </div>
                    {clase.leccion_id && (
                      <button
                        onClick={() => navigate('/seguros-education/on-demand')}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-caption font-semibold text-neutral-700 transition hover:border-accent hover:text-accent-ink dark:border-white/10 dark:text-white/70"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Ver en On Demand
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Ponentes por clase (visibilidad rápida para admin) */}
        {isAdmin && hosts.length > 0 && (
          <section className="rounded-xl border border-soft bg-surface-card p-4 shadow-card dark:border-white/10">
            <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-neutral-800 dark:text-white">
              <Crown className="h-4 w-4 text-amber-500" /> Quién conduce cada clase
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {clases
                .filter((c) => c.estado !== 'finalizado' && c.estado !== 'cancelado')
                .slice(0, 6)
                .map((c) => {
                  const equipoClase = hosts.filter((h) => h.evento_id === c.id);
                  return (
                    <div key={c.id} className="rounded-lg bg-surface-50 px-3 py-2 dark:bg-white/5">
                      <p className="truncate text-caption font-semibold text-neutral-800 dark:text-white/80">{c.titulo}</p>
                      <p className="truncate text-[11px] text-neutral-500 dark:text-white/45">
                        {equipoClase.length
                          ? equipoClase.map((h) => `${nombreUsuario(h.usuarios)}${h.rol === 'host' ? ' (instructor)' : ''}`).join(' · ')
                          : 'Sin instructor asignado'}
                      </p>
                    </div>
                  );
                })}
            </div>
          </section>
        )}
      </div>

      {/* Solo se monta al abrir: el formulario arranca limpio sin efectos de reinicio. */}
      {showCrear && (
        <FormularioClase
          abierto
          onCerrar={() => setShowCrear(false)}
          categorias={categorias}
          equipo={equipo}
          propioId={usuario?.id ?? ''}
          onCrear={crearClase}
          onCreada={(link) => {
            setShowCrear(false);
            avisar(link ? 'Clase creada. Link del ponente externo copiado al portapapeles.' : 'Clase creada.');
            if (link) void navigator.clipboard.writeText(link).catch(() => null);
          }}
        />
      )}

      {aviso && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-neutral-900 px-4 py-2.5 text-caption font-medium text-white shadow-xl">
          {aviso}
        </div>
      )}
    </SegurosEducationLayout>
  );
}

// ── Formulario de creación ───────────────────────────────────────────────────
function FormularioClase({
  abierto,
  onCerrar,
  categorias,
  equipo,
  propioId,
  onCrear,
  onCreada,
}: {
  abierto: boolean;
  onCerrar: () => void;
  categorias: Categoria[];
  equipo: UsuarioBrief[];
  propioId: string;
  onCrear: (datos: {
    titulo: string;
    descripcion: string;
    fecha: string;
    hora: string;
    duracionMin: number;
    cupo: number;
    grabar: boolean;
    transcribir: boolean;
    categoriaId: string | null;
    cohosts: string[];
    portada: File;
  }) => Promise<{ id: string; link: string | null }>;
  onCreada: (link: string | null) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [hora, setHora] = useState(() => format(new Date(Date.now() + 3600_000), 'HH:mm'));
  const [duracionMin, setDuracionMin] = useState(60);
  const [cupo, setCupo] = useState(100);
  const [grabar, setGrabar] = useState(true);
  const [transcribir, setTranscribir] = useState(true);
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [cohosts, setCohosts] = useState<string[]>([]);
  const [portada, setPortada] = useState<File | null>(null);
  const [portadaPreview, setPortadaPreview] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegirPortada = (archivo: File | null) => {
    setPortada(archivo);
    setPortadaPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return archivo ? URL.createObjectURL(archivo) : null;
    });
  };

  const guardar = async () => {
    if (titulo.trim().length < 3) return setError('Ponle un nombre a la clase');
    if (!portada) return setError('Carga la imagen miniatura de la clase');
    if (!portada.type.startsWith('image/')) return setError('La imagen miniatura debe ser un archivo de imagen');
    if (portada.size > 8 * 1024 * 1024) return setError('La imagen miniatura no debe pesar más de 8 MB');
    setGuardando(true);
    setError(null);
    try {
      const res = await onCrear({
        titulo,
        descripcion,
        fecha,
        hora,
        duracionMin,
        cupo,
        grabar,
        transcribir,
        categoriaId: categoriaId || null,
        cohosts,
        portada,
      });
      onCreada(res.link);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la clase');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <BaseModal
      isOpen={abierto}
      onClose={onCerrar}
      title="Nueva clase"
      maxWidth="2xl"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onCerrar} className="rounded-xl px-3.5 py-2 text-body-sm font-semibold text-neutral-600 hover:bg-surface-100 dark:text-white/60 dark:hover:bg-white/10">
            Cancelar
          </button>
          <button
            onClick={() => void guardar()}
            disabled={guardando}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            {guardando ? 'Creando sala…' : 'Crear clase'}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Nombre de la clase</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Protección Médica Internacional BUPA"
            className="w-full rounded-xl border border-neutral-200 bg-surface-50 px-3 py-2.5 text-body text-neutral-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            placeholder="Qué se va a ver en la clase"
            className="w-full resize-none rounded-xl border border-neutral-200 bg-surface-50 px-3 py-2.5 text-body text-neutral-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">
            Imagen miniatura <span className="text-red-500">*</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-neutral-300 p-3 transition hover:border-accent dark:border-white/15">
            <span className="relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-100 dark:bg-white/10">
              {portadaPreview ? (
                <img src={portadaPreview} alt="Miniatura" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-neutral-400" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-caption font-semibold text-neutral-700 dark:text-white/75">
                {portada ? portada.name : 'Cargar imagen (JPG o PNG, hasta 8 MB)'}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-neutral-400">
                Obligatoria. Es la portada del evento y la misma imagen que se publica como miniatura de la lección
                en On Demand.
              </span>
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                elegirPortada(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-surface-50 px-2.5 py-2 text-body-sm text-neutral-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Hora</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-surface-50 px-2.5 py-2 text-body-sm text-neutral-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Minutos</label>
            <input type="number" min={15} max={90} step={15} value={duracionMin} onChange={(e) => setDuracionMin(Number(e.target.value))}
              className="w-full rounded-xl border border-neutral-200 bg-surface-50 px-2.5 py-2 text-body-sm text-neutral-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Cupo</label>
            <input type="number" min={2} max={1000} value={cupo} onChange={(e) => setCupo(Number(e.target.value))}
              className="w-full rounded-xl border border-neutral-200 bg-surface-50 px-2.5 py-2 text-body-sm text-neutral-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Categoría en On Demand</label>
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-surface-50 px-3 py-2.5 text-body-sm text-neutral-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">
            Co-instructores <span className="font-normal text-neutral-400">(pueden moderar y ceder la palabra)</span>
          </label>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 p-2 dark:border-white/10">
            {equipo.filter((u) => u.id !== propioId).map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-50 dark:hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={cohosts.includes(u.id)}
                  onChange={(e) =>
                    setCohosts((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)))
                  }
                  className="h-3.5 w-3.5 accent-[#1C37E0]"
                />
                <span className="flex-1 truncate text-caption text-neutral-700 dark:text-white/70">{nombreUsuario(u)}</span>
                <span className="text-[10px] text-neutral-400">{u.rol}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 rounded-xl bg-surface-50 px-3 py-2.5 dark:bg-white/5">
          <label className="flex cursor-pointer items-center gap-2 text-caption font-medium text-neutral-700 dark:text-white/70">
            <input type="checkbox" checked={grabar} onChange={(e) => setGrabar(e.target.checked)} className="h-3.5 w-3.5 accent-[#1C37E0]" />
            Grabar (nube + local)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-caption font-medium text-neutral-700 dark:text-white/70">
            <input type="checkbox" checked={transcribir} onChange={(e) => setTranscribir(e.target.checked)} className="h-3.5 w-3.5 accent-[#1C37E0]" />
            Transcribir como material de apoyo
          </label>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] text-neutral-400">
          <Hand className="mt-0.5 h-3 w-3 shrink-0" />
          Al crearla también se genera el link del ponente externo, la sala privada y la grabación programada.
        </p>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-caption text-red-600 dark:bg-red-500/15 dark:text-red-400">{error}</p>
        )}
      </div>
    </BaseModal>
  );
}

export default SegurosEducationAulaVirtual;