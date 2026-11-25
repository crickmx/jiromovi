import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Plus, Users, Video, Radio, Link as LinkIcon,
  CircleCheck, CircleAlert as AlertCircle, Play, FileVideo, ExternalLink, Loader2, Crown, Hand, Image as ImageIcon, Mic,
  Pencil, Trash2,
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
import { generarPortadaCapacitacion, logoDeAseguradora } from '../lib/portadaCapacitacion';
import { SelectorEtiquetas, PildorasEtiquetas } from '../components/segurosEducation/SelectorEtiquetas';
import {
  cargarEtiquetas,
  etiquetasDeEventos,
  guardarEtiquetasEvento,
  resolverEtiquetas,
  type Etiqueta,
} from '../lib/etiquetas';

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
  link_token_asistente: string | null;
  daily_room_name: string | null;
  portada_url: string | null;
  leccion_id: string | null;
  categoria_id: string | null;
  creado_por: string | null;
  ponente?: string | null;
  etiquetas: Etiqueta[];
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

const ZONA_MX = 'America/Mexico_City';

/** Fecha/hora siempre en horario de México, sin importar el navegador. */
function fmtMX(fecha: Date, opciones: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es-MX', { timeZone: ZONA_MX, ...opciones }).format(fecha);
}

export function SegurosEducationAulaVirtual() {
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [clases, setClases] = useState<Clase[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [grabaciones, setGrabaciones] = useState<Grabacion[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [catalogoEtiquetas, setCatalogoEtiquetas] = useState<Etiqueta[]>([]);
  const [equipo, setEquipo] = useState<UsuarioBrief[]>([]);
  const [asistentes, setAsistentes] = useState<Record<string, number>>({});
  // Se refresca por intervalo para no leer el reloj durante el render.
  const [ahora, setAhora] = useState<number>(() => Date.now());

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCrear, setShowCrear] = useState(false);
  const [editando, setEditando] = useState<Clase | null>(null);
  const [invitacion, setInvitacion] = useState<{
    tipo: 'ponente' | 'oyente';
    clase: Clase;
    url: string;
    mensaje: string;
  } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const avisar = useCallback((mensaje: string) => {
    setAviso(mensaje);
    window.setTimeout(() => setAviso(null), 4000);
  }, []);

  const cargar = useCallback(async () => {
    const { data: eventos } = await supabase
      .from('aula_eventos')
      .select('id, titulo, descripcion, fecha_inicio, fecha_fin, estado, max_participantes, grabar, transcribir, link_token, link_token_asistente, daily_room_name, portada_url, leccion_id, categoria_id, creado_por, ponente')
      .order('fecha_inicio', { ascending: false, nullsFirst: false })
      .limit(200);

    const lista = (eventos ?? []) as Clase[];

    if (lista.length) {
      const ids = lista.map((c) => c.id);
      const [{ data: h }, { data: g }, { data: p }, mapaEtiquetas, catalogo] = await Promise.all([
        supabase.from('aula_evento_hosts').select('evento_id, usuario_id, rol, usuarios(nombre_completo, nombre, apellidos)').in('evento_id', ids),
        supabase.from('aula_grabaciones').select('id, evento_id, origen, estado, duracion_segundos, leccion_id').in('evento_id', ids),
        supabase.from('aula_participantes').select('evento_id').in('evento_id', ids).is('salido_at', null),
        etiquetasDeEventos(ids),
        cargarEtiquetas(),
      ]);

      setCatalogoEtiquetas(catalogo);
      for (const clase of lista) {
        clase.etiquetas = resolverEtiquetas(mapaEtiquetas[clase.id], catalogo);
      }
      setClases(lista);
      setHosts((h ?? []) as unknown as Host[]);
      setGrabaciones((g ?? []) as Grabacion[]);

      const cuenta: Record<string, number> = {};
      for (const fila of (p ?? []) as Array<{ evento_id: string }>) {
        cuenta[fila.evento_id] = (cuenta[fila.evento_id] ?? 0) + 1;
      }
      setAsistentes(cuenta);
    } else {
      setClases([]);
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

  // La sala se prepara con la clase, no al entrar: así el link de ponente y el
  // de oyentes existen desde el primer momento y se pueden mandar con días de
  // anticipación. Cubre también las clases viejas que quedaron sin sala.
  const provisionados = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!usuario) return;
    const pendientes = clases.filter(
      (c) =>
        puedeAdministrar(c.id) &&
        (!c.daily_room_name || !c.link_token_asistente) &&
        !provisionados.current.has(c.id) &&
        c.estado !== 'finalizado' &&
        c.estado !== 'cancelado',
    );
    if (pendientes.length === 0) return;

    let cancelado = false;
    void (async () => {
      let cambio = false;
      for (const c of pendientes) {
        provisionados.current.add(c.id);
        try {
          await aulaDaily.crearSala(c.id);
          cambio = true;
        } catch {
          // Sin permiso o Daily caído: se reintenta al abrir la clase.
        }
      }
      if (!cancelado && cambio) await cargar();
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clases, usuario, isAdmin, hosts, cargar]);

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

  /**
   * Dos invitaciones distintas y separadas a propósito:
   *  - ponente: entra con nombre + empresa y puede hablar y compartir pantalla.
   *  - oyente: entra como público, con micrófono y cámara apagados.
   */
  const invitarPonente = (clase: Clase) => {
    if (!clase.link_token) {
      avisar('La sala todavía no está lista. Espera un momento y vuelve a intentar.');
      return;
    }
    const url = `${window.location.origin}/aula/${clase.link_token}`;
    const mensaje = [
      `Te invito como PONENTE a la capacitación "${clase.titulo}" de Seguros Education.`,
      clase.fecha_inicio
        ? `📅 ${new Date(clase.fecha_inicio).toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
        : null,
      '',
      'Entra desde aquí. No necesitas cuenta: solo tu nombre, tu empresa y una foto.',
      url,
      '',
      'Podrás hablar y compartir tu pantalla cuando quien conduce te ceda la palabra.',
    ]
      .filter((l) => l !== null)
      .join('\n');
    setInvitacion({ tipo: 'ponente', clase, url, mensaje });
  };

  const invitarOyentes = (clase: Clase) => {
    if (!clase.link_token_asistente) {
      avisar('La sala todavía no está lista. Espera un momento y vuelve a intentar.');
      return;
    }
    const url = `${window.location.origin}/aula/${clase.link_token_asistente}`;
    const cuando = clase.fecha_inicio
      ? new Date(clase.fecha_inicio).toLocaleString('es-MX', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
    const mensaje = [
      `Te invito a la capacitación "${clase.titulo}" de Seguros Education.`,
      cuando ? `📅 ${cuando}` : null,
      'Entra desde aquí (puedes usar tu cuenta MOVI o registrarte como invitado):',
      url,
      '',
      'Entras como oyente: puedes seguir la sesión y participar en el chat. Se graba y queda en On Demand.',
    ]
      .filter((l) => l !== null)
      .join('\n');
    setInvitacion({ tipo: 'oyente', clase, url, mensaje });
  };

  const copiarMensaje = async () => {
    if (!invitacion) return;
    try {
      await navigator.clipboard.writeText(invitacion.mensaje);
      avisar('Invitación copiada al portapapeles.');
    } catch {
      window.prompt('Copia la invitación:', invitacion.mensaje);
    }
  };

  const actualizarClase = async (
    clase: Clase,
    datos: {
      titulo: string;
      descripcion: string;
      ponente: string;
      fecha: string;
      hora: string;
      duracionMin: number;
      categoriaId: string | null;
      etiquetas: string[];
      portada: File | null;
    },
  ) => {
    const inicio = new Date(`${datos.fecha}T${datos.hora}:00-06:00`);
    const fin = new Date(inicio.getTime() + datos.duracionMin * 60_000);

    // Solo se cambia la portada si se sube una nueva.
    const portadaUrl = datos.portada ? await subirPortadaClase(datos.portada) : clase.portada_url;

    const { error } = await supabase
      .from('aula_eventos')
      .update({
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim() || null,
        ponente: datos.ponente.trim() || null,
        fecha: datos.fecha,
        hora: `${datos.hora}:00`,
        fecha_inicio: inicio.toISOString(),
        fecha_fin: fin.toISOString(),
        categoria_id: datos.categoriaId,
        portada_url: portadaUrl,
      })
      .eq('id', clase.id);

    if (error) throw error;

    try {
      await guardarEtiquetasEvento(clase.id, datos.etiquetas);
    } catch (err) {
      console.error('Error guardando etiquetas del evento:', err);
    }

    // La sala vive fuera de la base: si movieron la fecha, hay que refrescar su
    // caducidad o los oyentes se encontrarían con la sala vencida.
    try {
      await aulaDaily.crearSala(clase.id);
    } catch (err) {
      console.error('No se pudo refrescar la sala de Daily:', err);
    }

    await cargar();
    avisar('Capacitación actualizada.');
  };

  const eliminarClase = async (clase: Clase) => {
    if (
      !confirm(
        `¿Eliminar "${clase.titulo}"?\n\nSe borra la sesión, su sala, los enlaces de invitación y el chat. No se puede deshacer.`,
      )
    ) {
      return;
    }
    setOcupado(clase.id);
    try {
      await aulaDaily.eliminar(clase.id);
      await cargar();
      avisar('Capacitación eliminada.');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo eliminar la capacitación');
    } finally {
      setOcupado(null);
    }
  };

  const iniciarClase = async (clase: Clase) => {
    if (!confirm(`¿Iniciar "${clase.titulo}"? Se abrirá la grabación en la nube y los asistentes podrán entrar.`)) return;
    setOcupado(clase.id);
    try {
      if (!clase.daily_room_name) await aulaDaily.crearSala(clase.id);
      const r = await aulaDaily.iniciar(clase.id);
      if (r.grabacion?.error) {
        avisar(`La sesión inició, pero la grabación en la nube no arrancó (${r.grabacion.error}). La grabación local sigue activa.`);
      }
      analyticsTracker.trackClassJoinClick?.(clase.id);
      navigate(`/seguros-education/aula-virtual/${clase.id}`);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo iniciar la sesión');
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
    grabar: boolean;
    transcribir: boolean;
    categoriaId: string | null;
    etiquetas: string[];
    cohosts: string[];
    ponente: string;
    portada: File | null;
  }) => {
    if (!usuario) throw new Error('Sesión no disponible');

    // La hora se captura en horario de México: se fija el desfase para que no
    // dependa de la zona horaria del navegador de quien crea la capacitación.
    const inicio = new Date(`${datos.fecha}T${datos.hora}:00-06:00`);
    const fin = new Date(inicio.getTime() + datos.duracionMin * 60_000);

    // Quién imparte: lo que escribió, o quien crea el evento si lo dejó vacío.
    const ponenteFinal = datos.ponente.trim() || nombreUsuario(usuario);

    // La aseguradora sale de las etiquetas elegidas; su logotipo, de la base.
    const idAseguradora = datos.etiquetas.find(
      (id) => catalogoEtiquetas.find((e) => e.id === id)?.tipo === 'aseguradora',
    );
    const nombreAseguradora = idAseguradora
      ? catalogoEtiquetas.find((e) => e.id === idAseguradora)?.nombre ?? null
      : null;

    // Con imagen se sube la que eligió; sin imagen, el sistema dibuja la portada
    // con la identidad de Seguros Education (título, ponente y aseguradora).
    let archivoPortada = datos.portada;
    if (!archivoPortada) {
      const logoAseguradora = nombreAseguradora ? await logoDeAseguradora(nombreAseguradora) : null;
      archivoPortada = await generarPortadaCapacitacion({
        titulo: datos.titulo,
        ponente: datos.ponente.trim() || null,
        aseguradora: nombreAseguradora,
        logoAseguradora,
      });
    }
    const portadaUrl = await subirPortadaClase(archivoPortada);

    const { data, error } = await supabase
      .from('aula_eventos')
      .insert({
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim() || null,
        // `ponente` es legado del calendario, pero la portada del módulo lo pinta.
        ponente: ponenteFinal,
        fecha: datos.fecha,
        hora: `${datos.hora}:00`,
        fecha_inicio: inicio.toISOString(),
        fecha_fin: fin.toISOString(),
        estado: 'programado',
        // Aforo fijo del sistema: 200, el máximo que permite Daily por sala.
        // No se captura ni se muestra; lo pone siempre la aplicación.
        max_participantes: AFORO_SALA,
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

    if (datos.etiquetas.length > 0) {
      try {
        await guardarEtiquetasEvento(id, datos.etiquetas);
      } catch (err) {
        console.error('Error guardando etiquetas del evento:', err);
      }
    }

    const sala = await aulaDaily.crearSala(id);

    // Avisa a la plantilla en cuanto existe la clase (correo + WhatsApp).
    let invitados = 0;
    try {
      const inv = await aulaDaily.invitar(id);
      invitados = inv.encolados ?? 0;
    } catch (err) {
      console.error('No se pudo encolar la invitación:', err);
    }

    await cargar();
    return {
      id,
      invitados,
      link: sala.link_token_asistente ? `${window.location.origin}/aula/${sala.link_token_asistente}` : null,
    };
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
      sectionDescription="Cada capacitación genera su sala, su grabación y su lección en On Demand"
    >
      <div className="space-y-5">
        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-body-sm text-neutral-500 dark:text-white/55">
            <Video className="h-4 w-4 text-accent-ink" />
            <span>
              {proximas.length + enVivo.length} {proximas.length + enVivo.length === 1 ? 'capacitación activa' : 'capacitaciones activas'}
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCrear(true)}
              className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-body-sm font-semibold text-white transition hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" /> Nueva capacitación
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

                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
                    {puedeAdministrar(clase.id) && (
                      <button
                        onClick={() => invitarPonente(clase)}
                        className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-white/20 px-3 py-2.5 text-caption font-semibold transition hover:bg-white/30"
                        title="Ponente externo: habla y comparte pantalla"
                      >
                        <Mic className="h-4 w-4" /> Invitar ponente
                      </button>
                    )}
                    {puedeAdministrar(clase.id) && (
                      <button
                        onClick={() => invitarOyentes(clase)}
                        className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-3 py-2.5 text-caption font-semibold text-red-600 transition hover:bg-red-50"
                        title="Oyentes: entran como público, con micrófono y cámara apagados"
                      >
                        <Users className="h-4 w-4" /> Invitar oyentes
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
              <p className="text-body-sm font-semibold text-amber-900 dark:text-amber-200">No hay sesiones en vivo</p>
              <p className="text-caption text-amber-800 dark:text-amber-300/80">
                Cuando alguien inicie una sesión aparecerá aquí con su sala.
              </p>
            </div>
          </div>
        )}

        {/* Próximas */}
        <section className="overflow-hidden rounded-xl border border-soft bg-surface-card shadow-card dark:border-white/10">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-white/10">
            <h2 className="flex items-center gap-2 text-base font-bold text-neutral-800 dark:text-white">
              <Calendar className="h-4 w-4 text-accent-ink" /> Próximas capacitaciones
            </h2>
            <span className="text-caption text-neutral-400">{proximas.length}</span>
          </div>

          {proximas.length === 0 ? (
            <p className="px-4 py-8 text-center text-body-sm text-neutral-400">
              No hay capacitaciones programadas.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {proximas.map((clase) => {
                const inicio = clase.fecha_inicio ? new Date(clase.fecha_inicio) : null;
                const fin = clase.fecha_fin ? new Date(clase.fecha_fin) : null;
                const minutos =
                  inicio && fin && fin > inicio ? Math.round((fin.getTime() - inicio.getTime()) / 60_000) : null;
                const enUnaHora = inicio ? inicio.getTime() - ahora < 3600_000 : false;
                const admin = puedeAdministrar(clase.id);

                return (
                  <article
                    key={clase.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-soft bg-surface-card shadow-card transition hover:shadow-card-hover dark:border-white/10"
                  >
                    {/* Miniatura */}
                    <div className="relative aspect-video overflow-hidden bg-neutral-100 dark:bg-white/5">
                      {clase.portada_url ? (
                        <img
                          src={clase.portada_url}
                          alt={clase.titulo}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Video className="h-9 w-9 text-neutral-300 dark:text-white/20" />
                        </div>
                      )}

                      {inicio && (
                        <div className="absolute left-2 top-2 flex min-w-[42px] flex-col items-center rounded-xl bg-black/65 px-2 py-1 text-white backdrop-blur-sm">
                          <span className="text-[10px] font-bold uppercase leading-none opacity-90">
                            {fmtMX(inicio, { month: 'short' }).replace('.', '')}
                          </span>
                          <span className="mt-0.5 text-base font-bold leading-none">{fmtMX(inicio, { day: 'numeric' })}</span>
                        </div>
                      )}

                      {enUnaHora && (
                        <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                          Pronto
                        </span>
                      )}
                    </div>

                    {/* Contenido */}
                    <div className="flex flex-1 flex-col p-3">
                      <h3 className="line-clamp-2 text-body-sm font-bold leading-snug text-neutral-900 dark:text-white">
                        {clase.titulo}
                      </h3>

                      {clase.etiquetas?.length > 0 && (
                        <div className="mt-1.5">
                          <PildorasEtiquetas etiquetas={clase.etiquetas} max={3} />
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-neutral-500 dark:text-white/55">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {inicio
                            ? `${fmtMX(inicio, { day: 'numeric', month: 'short' }).replace('.', '')} · ${fmtMX(inicio, { hour: '2-digit', minute: '2-digit', hour12: false })}`
                            : 'Sin fecha'}
                          {minutos ? ` · ${minutos} min` : ''}
                        </span>
                        {clase.grabar && (
                          <span className="flex items-center gap-1">
                            <Radio className="h-3.5 w-3.5" /> Se graba
                          </span>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                        {admin && (
                          <>
                            <button
                              onClick={() => invitarPonente(clase)}
                              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-200 px-2.5 py-1.5 text-caption font-semibold text-neutral-600 transition hover:border-accent hover:text-accent-ink dark:border-white/10 dark:text-white/60"
                              title="Ponente externo: habla y comparte pantalla"
                            >
                              <Mic className="h-3.5 w-3.5" /> Ponente
                            </button>
                            <button
                              onClick={() => invitarOyentes(clase)}
                              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent-soft px-2.5 py-1.5 text-caption font-semibold text-accent-ink transition hover:bg-accent/15"
                              title="Oyentes: entran como público, con micrófono y cámara apagados"
                            >
                              <Users className="h-3.5 w-3.5" /> Oyentes
                            </button>
                            {clase.estado === 'programado' && (
                              <>
                                <button
                                  onClick={() => setEditando(clase)}
                                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-200 px-2.5 py-1.5 text-caption font-semibold text-neutral-600 transition hover:border-accent hover:text-accent-ink dark:border-white/10 dark:text-white/60"
                                  title="Editar fecha, hora, título o ponente"
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Editar
                                </button>
                                <button
                                  onClick={() => void eliminarClase(clase)}
                                  disabled={ocupado === clase.id}
                                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 px-2.5 py-1.5 text-caption font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-500/25 dark:text-red-400 dark:hover:bg-red-500/10"
                                  title="Eliminar la sesión y su sala"
                                >
                                  {ocupado === clase.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                  Eliminar
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => void iniciarClase(clase)}
                              disabled={ocupado === clase.id}
                              className="ml-auto flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent px-3 py-1.5 text-caption font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
                            >
                              {ocupado === clase.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                              Iniciar
                            </button>
                          </>
                        )}
                        {!admin && (
                          <span className="rounded-lg bg-surface-100 px-3 py-1.5 text-caption font-semibold text-neutral-500 dark:bg-white/10 dark:text-white/50">
                            Aún no inicia
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Finalizadas */}
        {pasadas.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-soft bg-surface-card shadow-card dark:border-white/10">
            <div className="border-b border-neutral-200 px-4 py-3 dark:border-white/10">
              <h2 className="flex items-center gap-2 text-base font-bold text-neutral-800 dark:text-white">
                <FileVideo className="h-4 w-4 text-accent-ink" /> Capacitaciones anteriores
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
          catalogoEtiquetas={catalogoEtiquetas}
          onNuevaEtiqueta={(nueva) =>
            setCatalogoEtiquetas((prev) =>
              prev.some((e) => e.id === nueva.id)
                ? prev
                : [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
            )
          }
          equipo={equipo}
          propioId={usuario?.id ?? ''}
          onCrear={crearClase}
          onCreada={(link, invitados) => {
            setShowCrear(false);
            const aviso = invitados > 0
              ? `Clase creada. Invitación en camino a ${invitados} personas por correo y WhatsApp.`
              : 'Clase creada.';
            avisar(link ? `${aviso} Link del ponente copiado.` : aviso);
            if (link) void navigator.clipboard.writeText(link).catch(() => null);
          }}
        />
      )}

      {editando && (
        <FormularioEditarClase
          clase={editando}
          abierto
          onCerrar={() => setEditando(null)}
          categorias={categorias}
          catalogoEtiquetas={catalogoEtiquetas}
          onNuevaEtiqueta={(nueva) =>
            setCatalogoEtiquetas((prev) =>
              prev.some((e) => e.id === nueva.id) ? prev : [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
            )
          }
          onGuardar={async (datos) => {
            await actualizarClase(editando, datos);
            setEditando(null);
          }}
        />
      )}

      {invitacion && (
        <BaseModal
          isOpen
          onClose={() => setInvitacion(null)}
          title={invitacion.tipo === 'ponente' ? 'Invitar a un ponente' : 'Invitar a oyentes'}
          maxWidth="lg"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => void copiarMensaje()}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3.5 py-2 text-body-sm font-semibold text-neutral-600 transition hover:border-accent hover:text-accent-ink dark:border-white/10 dark:text-white/60"
              >
                <LinkIcon className="h-4 w-4" /> Copiar invitación
              </button>
              <button
                onClick={() =>
                  window.open(`https://wa.me/?text=${encodeURIComponent(invitacion.mensaje)}`, '_blank')
                }
                className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-body-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                WhatsApp
              </button>
              <button
                onClick={() =>
                  window.open(
                    `mailto:?subject=${encodeURIComponent(
                      `${invitacion.tipo === 'ponente' ? 'Invitación como ponente' : 'Invitación a la clase'}: ${invitacion.clase.titulo}`,
                    )}&body=${encodeURIComponent(invitacion.mensaje)}`,
                    '_blank',
                  )
                }
                className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-body-sm font-semibold text-white transition hover:bg-accent-hover"
              >
                Enviar por correo
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
                invitacion.tipo === 'ponente'
                  ? 'border-accent/30 bg-accent-soft/60 dark:bg-accent/10'
                  : 'border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10'
              }`}
            >
              {invitacion.tipo === 'ponente' ? (
                <Mic className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
              ) : (
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              )}
              <p className="text-caption leading-relaxed text-neutral-700 dark:text-white/75">
                {invitacion.tipo === 'ponente' ? (
                  <>
                    <strong className="font-semibold">Ponente externo.</strong> No necesita cuenta ni
                    contraseña: escribe su nombre, su empresa y una foto, y entra con voz y pantalla
                    compartida. Puede intervenir cuando le cedas la palabra.
                  </>
                ) : (
                  <>
                    <strong className="font-semibold">Oyente.</strong> Entra como público: micrófono y cámara
                    apagados, con chat y mano levantada. Si tiene cuenta MOVI también puede entrar desde la
                    plataforma.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                readOnly
                value={invitacion.url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-surface-50 px-3 py-2.5 text-caption text-neutral-700 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white/80"
              />
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(invitacion.url);
                  avisar('Link copiado.');
                }}
                className="shrink-0 rounded-xl border border-neutral-200 px-3 py-2.5 text-caption font-semibold text-neutral-600 transition hover:border-accent hover:text-accent-ink dark:border-white/10 dark:text-white/60"
              >
                Copiar link
              </button>
            </div>

            <pre className="whitespace-pre-wrap rounded-xl bg-surface-50 p-3 font-sans text-caption leading-relaxed text-neutral-700 dark:bg-white/5 dark:text-white/70">
              {invitacion.mensaje}
            </pre>
            <p className="text-[11px] text-neutral-400">
              El link es por evento y deja de funcionar cuando la sesión termina.
              {invitacion.tipo === 'ponente'
                ? ' Los ponentes invitados aparecen con su nombre y empresa en la ficha de On Demand.'
                : ''}
            </p>
          </div>
        </BaseModal>
      )}

      {aviso && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-neutral-900 px-4 py-2.5 text-caption font-medium text-white shadow-xl">
          {aviso}
        </div>
      )}
    </SegurosEducationLayout>
  );
}

/** Aforo por sala: el máximo que acepta Daily sin contratarlo aparte. */
const AFORO_SALA = 200;

// ── Formulario de creación ───────────────────────────────────────────────────
function FormularioClase({
  abierto,
  onCerrar,
  categorias,
  catalogoEtiquetas,
  onNuevaEtiqueta,
  equipo,
  propioId,
  onCrear,
  onCreada,
}: {
  abierto: boolean;
  onCerrar: () => void;
  categorias: Categoria[];
  catalogoEtiquetas: Etiqueta[];
  onNuevaEtiqueta: (etiqueta: Etiqueta) => void;
  equipo: UsuarioBrief[];
  propioId: string;
  onCrear: (datos: {
    titulo: string;
    descripcion: string;
    fecha: string;
    hora: string;
    duracionMin: number;
    grabar: boolean;
    transcribir: boolean;
    categoriaId: string | null;
    etiquetas: string[];
    cohosts: string[];
    /** Nombre de quien imparte. Opcional: si falta, firma quien crea el evento. */
    ponente: string;
    /** Si no se sube imagen, el sistema dibuja la portada. */
    portada: File | null;
  }) => Promise<{ id: string; link: string | null; invitados?: number }>;
  onCreada: (link: string | null, invitados: number) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [hora, setHora] = useState(() => format(new Date(Date.now() + 3600_000), 'HH:mm'));
  const [duracionMin, setDuracionMin] = useState(60);
  const [grabar, setGrabar] = useState(true);
  const [transcribir, setTranscribir] = useState(true);
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [etiquetasElegidas, setEtiquetasElegidas] = useState<string[]>([]);
  const [cohosts, setCohosts] = useState<string[]>([]);
  const [ponente, setPonente] = useState('');
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
    if (titulo.trim().length < 3) return setError('Ponle un nombre a la capacitación');
    if (portada && !portada.type.startsWith('image/')) return setError('La imagen miniatura debe ser un archivo de imagen');
    if (portada && portada.size > 8 * 1024 * 1024) return setError('La imagen miniatura no debe pesar más de 8 MB');
    setGuardando(true);
    setError(null);
    try {
      const res = await onCrear({
        titulo,
        descripcion,
        fecha,
        hora,
        duracionMin,
        grabar,
        transcribir,
        categoriaId: categoriaId || null,
        etiquetas: etiquetasElegidas,
        cohosts,
        ponente: ponente.trim(),
        portada,
      });
      onCreada(res.link, res.invitados ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la capacitación');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <BaseModal
      isOpen={abierto}
      onClose={onCerrar}
      title="Nueva capacitación"
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
            {guardando ? 'Creando sala…' : 'Crear capacitación'}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Nombre de la capacitación</label>
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
            placeholder="Qué se va a ver en la capacitación"
            className="w-full resize-none rounded-xl border border-neutral-200 bg-surface-50 px-3 py-2.5 text-body text-neutral-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">
            Ponente <span className="font-normal text-neutral-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={ponente}
            onChange={(e) => setPonente(e.target.value)}
            placeholder="Quién imparte la capacitación"
            className="w-full rounded-xl border border-neutral-200 bg-surface-50 px-3 py-2.5 text-body text-neutral-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <p className="mt-1 text-[11px] leading-snug text-neutral-400">
            Aparece en la portada y en la ficha del evento. Si lo dejas vacío, firma quien crea la capacitación.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">
            Imagen miniatura <span className="font-normal text-neutral-400">(opcional)</span>
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
                {portada
                  ? 'Es la portada del evento y la misma imagen que se publica como miniatura en On Demand.'
                  : 'Sin imagen, el sistema genera la portada con el título, la aseguradora y el ponente.'}
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
            Etiquetas
            <span className="ml-2 text-micro font-normal text-neutral-400">
              Aseguradora, ramo y subramo; también filtran en On Demand
            </span>
          </label>
          <div className="rounded-xl border border-neutral-200 bg-surface-50 p-3 dark:border-white/10 dark:bg-white/5">
            <SelectorEtiquetas
              etiquetas={catalogoEtiquetas}
              valor={etiquetasElegidas}
              onChange={setEtiquetasElegidas}
              onNuevaEtiqueta={onNuevaEtiqueta}
              compacto
            />
          </div>
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
// ── Edición de una capacitación programada ───────────────────────────────────
/** Fecha y hora en horario de México, sin depender de la zona del navegador. */
function fechaHoraMX(iso: string | null): { fecha: string; hora: string } {
  if (!iso) return { fecha: format(new Date(), 'yyyy-MM-dd'), hora: '10:00' };
  const d = new Date(iso);
  const fecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return { fecha, hora };
}

function FormularioEditarClase({
  clase,
  abierto,
  onCerrar,
  categorias,
  catalogoEtiquetas,
  onNuevaEtiqueta,
  onGuardar,
}: {
  clase: Clase;
  abierto: boolean;
  onCerrar: () => void;
  categorias: Categoria[];
  catalogoEtiquetas: Etiqueta[];
  onNuevaEtiqueta: (e: Etiqueta) => void;
  onGuardar: (datos: {
    titulo: string;
    descripcion: string;
    ponente: string;
    fecha: string;
    hora: string;
    duracionMin: number;
    categoriaId: string | null;
    etiquetas: string[];
    portada: File | null;
  }) => Promise<void>;
}) {
  const inicial = fechaHoraMX(clase.fecha_inicio);
  const minutosInicial = clase.fecha_inicio && clase.fecha_fin
    ? Math.max(15, Math.round((new Date(clase.fecha_fin).getTime() - new Date(clase.fecha_inicio).getTime()) / 60_000))
    : 60;

  const [titulo, setTitulo] = useState(clase.titulo);
  const [descripcion, setDescripcion] = useState(clase.descripcion ?? '');
  const [ponente, setPonente] = useState(clase.ponente ?? '');
  const [fecha, setFecha] = useState(inicial.fecha);
  const [hora, setHora] = useState(inicial.hora);
  const [duracionMin, setDuracionMin] = useState(minutosInicial);
  const [categoriaId, setCategoriaId] = useState<string>(clase.categoria_id ?? '');
  const [etiquetas, setEtiquetas] = useState<string[]>(clase.etiquetas.map((e) => e.id));
  const [portada, setPortada] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(clase.portada_url);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegirPortada = (archivo: File | null) => {
    setPortada(archivo);
    if (!archivo) {
      setPreview(clase.portada_url);
      return;
    }
    setPreview((prev) => {
      if (prev && prev !== clase.portada_url) URL.revokeObjectURL(prev);
      return URL.createObjectURL(archivo);
    });
  };

  const guardar = async () => {
    if (titulo.trim().length < 3) return setError('Ponle un nombre a la capacitación');
    if (portada && !portada.type.startsWith('image/')) return setError('La imagen debe ser un archivo de imagen');
    if (portada && portada.size > 8 * 1024 * 1024) return setError('La imagen no debe pesar más de 8 MB');
    setGuardando(true);
    setError(null);
    try {
      await onGuardar({
        titulo,
        descripcion,
        ponente,
        fecha,
        hora,
        duracionMin,
        categoriaId: categoriaId || null,
        etiquetas,
        portada,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const campo =
    'w-full rounded-xl border border-neutral-200 bg-surface-50 px-3 py-2.5 text-body text-neutral-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white';

  return (
    <BaseModal
      isOpen={abierto}
      onClose={onCerrar}
      title="Editar capacitación"
      maxWidth="2xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onCerrar}
            className="rounded-xl px-3.5 py-2 text-body-sm font-semibold text-neutral-600 hover:bg-surface-100 dark:text-white/60 dark:hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={() => void guardar()}
            disabled={guardando}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar cambios
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-caption text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">
            Nombre de la capacitación
          </label>
          <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} />
        </div>

        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            className={`${campo} resize-none`}
          />
        </div>

        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">
            Ponente <span className="font-normal text-neutral-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={ponente}
            onChange={(e) => setPonente(e.target.value)}
            placeholder="Quién imparte la capacitación"
            className={campo}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Hora</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Minutos</label>
            <input
              type="number"
              min={15}
              max={90}
              step={15}
              value={duracionMin}
              onChange={(e) => setDuracionMin(Number(e.target.value))}
              className={campo}
            />
          </div>
          <div>
            <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">Categoría</label>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={campo}>
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">
            Etiquetas <span className="font-normal text-neutral-400">(aseguradora, ramo, subramo)</span>
          </label>
          <SelectorEtiquetas
            etiquetas={catalogoEtiquetas}
            valor={etiquetas}
            onChange={setEtiquetas}
            onNuevaEtiqueta={onNuevaEtiqueta}
          />
        </div>

        <div>
          <label className="mb-1 block text-caption font-semibold text-neutral-700 dark:text-white/70">
            Imagen miniatura <span className="font-normal text-neutral-400">(opcional)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-neutral-300 p-3 transition hover:border-accent dark:border-white/15">
            <span className="relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-100 dark:bg-white/10">
              {preview ? (
                <img src={preview} alt="Miniatura" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-neutral-400" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-caption font-semibold text-neutral-700 dark:text-white/75">
                {portada ? portada.name : 'Cambiar imagen'}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-neutral-400">
                Si no la cambias, se queda la portada actual.
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
      </div>
    </BaseModal>
  );
}
