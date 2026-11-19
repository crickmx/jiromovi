import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import type { DailyCall, DailyParticipant } from '@daily-co/daily-js';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorX, Hand, MessageSquare,
  Users, PhoneOff, Paperclip, Send, Shield, Volume2, CircleStop, Radio, X, Crown,
  UserPlus, Copy, Check, Mail, MessageCircle,
} from 'lucide-react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase';
import { aulaDaily, aulaInvitado, aulaPublicar, subirConUrlFirmada, type EntradaAula } from '../../lib/aulaDaily';
import { GrabadorClase } from '../../lib/aulaGrabacion';
import { BaseModal } from '../BaseModal';

export interface MensajeChat {
  id: string;
  autor_nombre: string;
  autor_rol: string | null;
  texto: string | null;
  adjunto_url: string | null;
  adjunto_nombre: string | null;
  adjunto_mime: string | null;
  enviado_at: string;
}

interface Props {
  eventoId: string;
  entrada: EntradaAula;
  anfitrion: boolean;
  esInvitado?: boolean;
  sesionInvitado?: string | null;
  /** Id del usuario de MOVI. En la ruta pública del invitado viene nulo. */
  usuarioId?: string | null;
  /** Link público para invitar ponentes externos. Solo lo recibe quien conduce. */
  linkInvitado?: string | null;
  titulo: string;
  conGrabacion?: boolean;
  onSalir: () => void;
}

const MAX_ARCHIVO_MOVI = 25 * 1024 * 1024;
const MAX_ARCHIVO_INVITADO = 3.5 * 1024 * 1024;

function nombreDe(p: DailyParticipant) {
  return (p.user_name || 'Participante').slice(0, 40);
}

function iniciales(texto: string) {
  return texto.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function VideoTile({ participante, grande }: { participante: DailyParticipant; grande?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const track = participante.tracks?.screenVideo?.state === 'playable'
    ? participante.tracks.screenVideo.persistentTrack
    : participante.tracks?.video?.state === 'playable'
    ? participante.tracks.video.persistentTrack
    : null;
  const esPantalla = participante.tracks?.screenVideo?.state === 'playable';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (track) {
      el.srcObject = new MediaStream([track]);
      void el.play().catch(() => null);
    } else {
      el.srcObject = null;
    }
  }, [track]);

  const hablando = participante.tracks?.audio?.state === 'playable';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-surface-900 ${
        grande ? 'col-span-full' : ''
      } ${hablando ? 'ring-2 ring-accent/70' : 'ring-1 ring-white/10'}`}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={participante.local}
        className={`h-full w-full bg-surface-900 ${esPantalla ? 'object-contain' : 'object-cover'}`}
      />
      {!track && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-800">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-base font-bold text-accent-ink">
            {iniciales(nombreDe(participante))}
          </div>
          <span className="text-caption text-white/60">Cámara apagada</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
        <span className="truncate text-caption font-semibold text-white">{nombreDe(participante)}</span>
        {participante.local && <span className="rounded bg-white/20 px-1.5 text-[10px] font-bold text-white">TÚ</span>}
        {!hablando && <MicOff className="h-3 w-3 text-white/60" />}
      </div>
      {esPantalla && (
        <span className="absolute left-3 top-3 rounded-md bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Compartiendo
        </span>
      )}
    </div>
  );
}

export function SalaAula({
  eventoId,
  entrada,
  anfitrion,
  esInvitado = false,
  sesionInvitado = null,
  usuarioId = null,
  linkInvitado = null,
  titulo,
  conGrabacion = false,
  onSalir,
}: Props) {
  const [call, setCall] = useState<DailyCall | null>(null);
  const [participantes, setParticipantes] = useState<DailyParticipant[]>([]);
  const [estado, setEstado] = useState<'conectando' | 'dentro' | 'error'>('conectando');
  const [error, setError] = useState<string | null>(null);

  const [mic, setMic] = useState(!esInvitado ? false : true);
  const [cam, setCam] = useState(false);
  const [pantalla, setPantalla] = useState(false);
  const [mano, setMano] = useState(false);
  const [manos, setManos] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'chat' | 'gente'>('chat');
  const [panelAbierto, setPanelAbierto] = useState(true);

  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [invitarAbierto, setInvitarAbierto] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const [grabando, setGrabando] = useState(false);
  const [segundosGrabacion, setSegundosGrabacion] = useState(0);
  const [publicando, setPublicando] = useState<string | null>(null);

  const grabadorRef = useRef<GrabadorClase | null>(null);
  const chatFondo = useRef<HTMLDivElement | null>(null);
  const avisoTimer = useRef<number | null>(null);

  const avisar = useCallback((mensaje: string) => {
    setAviso(mensaje);
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), 4200);
  }, []);

  // ── Conexión a la sala ───────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;

    // Daily solo permite UNA instancia por pestaña. Si la anterior no se
    // destruyó (navegar de una clase a otra muy rápido), se limpia antes de
    // crear la nueva; si no, revienta con "Duplicate DailyIframe instances".
    try {
      const previa = DailyIframe.getCallInstance();
      if (previa) previa.destroy();
    } catch {
      /* no había instancia previa */
    }

    const objeto = DailyIframe.createCallObject();

    const refrescar = () => {
      if (!vivo) return;
      setParticipantes(Object.values(objeto.participants() ?? {}));
    };

    const alEntrar = () => {
      refrescar();
      setEstado('dentro');
      setCall(objeto);
      const local = objeto.participants()?.local;
      setMic(!!local?.audio);
      setCam(!!local?.video);

      // La grabación en nube la arranca el servidor, pero solo cuando ya hay
      // alguien dentro: Daily no graba salas vacías.
      if (anfitrion && conGrabacion) {
        void aulaDaily.iniciarGrabacionNube(eventoId).catch(() => null);
      }
    };

    const alMensaje = (e: { data?: Record<string, unknown>; fromId?: string }) => {
      const datos = e.data ?? {};
      if (datos.tipo === 'palabra' && !anfitrion) {
        objeto.setLocalAudio(true);
        setMic(true);
        avisar('El instructor te dio la palabra: tu micrófono está abierto.');
      }
      if (datos.tipo === 'mano') {
        const desde = String(e.fromId ?? '');
        setManos((prev) => {
          const copia = { ...prev };
          if (datos.arriba && desde) copia[desde] = String(datos.nombre ?? 'Participante');
          else delete copia[desde];
          return copia;
        });
      }
    };

    objeto
      .on('joined-meeting', alEntrar)
      .on('participant-joined', refrescar)
      .on('participant-updated', refrescar)
      .on('participant-left', refrescar)
      .on('track-started', refrescar)
      .on('track-stopped', refrescar)
      .on('app-message', alMensaje)
      .on('error', (e) => {
        setError(e?.errorMsg || 'No se pudo conectar a la sala');
        setEstado('error');
      })
      .on('left-meeting', () => {
        if (vivo) onSalir();
      });

    objeto
      .join({ url: entrada.room_url, token: entrada.token, startVideoOff: true, startAudioOff: true })
      .catch((e: Error) => {
        setError(e?.message || 'No se pudo entrar a la sala');
        setEstado('error');
      });

    return () => {
      vivo = false;
      // destroy() ya saca de la llamada; llamar leave() antes dejaba la
      // instancia viva unos ms y la siguiente montura chocaba con ella.
      try {
        objeto.destroy();
      } catch {
        /* ya estaba destruida */
      }
    };
    // La sala se conecta una sola vez por entrada; reconectar al cambiar de
    // evento rompería la grabación en curso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrada.room_url, entrada.token]);

  useEffect(() => {
    if (!grabando) return;
    const id = window.setInterval(() => setSegundosGrabacion((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [grabando]);

  // ── Chat ─────────────────────────────────────────────────────────────────
  const cargarMensajes = useCallback(async () => {
    if (esInvitado && sesionInvitado) {
      const res = await fetch(`${supabaseUrl}/functions/v1/aula-invitado`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ action: 'mensajes', sesion: sesionInvitado }),
      }).then((r) => r.json()).catch(() => null);
      if (res?.mensajes) setMensajes(res.mensajes as MensajeChat[]);
      return;
    }

    const { data } = await supabase
      .from('aula_chat')
      .select('id, autor_nombre, autor_rol, texto, adjunto_path, adjunto_nombre, adjunto_mime, enviado_at')
      .eq('evento_id', eventoId)
      .eq('borrado', false)
      .order('enviado_at', { ascending: true })
      .limit(200);

    setMensajes(
      (data ?? []).map((m) => ({
        ...m,
        adjunto_url: m.adjunto_path
          ? supabase.storage.from('aula-adjuntos').getPublicUrl(m.adjunto_path).data.publicUrl
          : null,
      })) as MensajeChat[],
    );
  }, [eventoId, esInvitado, sesionInvitado]);

  useEffect(() => {
    // La carga es asíncrona (fetch/consulta): no hay cascada de renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarMensajes();

    if (esInvitado) {
      const id = window.setInterval(() => void cargarMensajes(), 3500);
      return () => window.clearInterval(id);
    }

    const canal = supabase
      .channel(`aula-chat-${eventoId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'aula_chat', filter: `evento_id=eq.${eventoId}` },
        () => void cargarMensajes(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [eventoId, esInvitado, cargarMensajes]);

  useEffect(() => {
    if (tab === 'chat' && chatFondo.current) {
      chatFondo.current.scrollTop = chatFondo.current.scrollHeight;
    }
  }, [mensajes, tab]);

  // ── Controles ────────────────────────────────────────────────────────────
  const alternarMic = async () => {
    if (!call) return;
    await call.setLocalAudio(!mic);
    setMic(!mic);
  };

  const alternarCam = async () => {
    if (!call) return;
    await call.setLocalVideo(!cam);
    setCam(!cam);
  };

  const alternarPantalla = async () => {
    if (!call) return;
    try {
      if (pantalla) await call.stopScreenShare();
      else await call.startScreenShare();
      setPantalla(!pantalla);
    } catch {
      avisar('No se pudo compartir la pantalla. Revisa los permisos del navegador.');
    }
  };

  const alternarMano = async () => {
    if (!call) return;
    const arriba = !mano;
    setMano(arriba);
    call.sendAppMessage({ tipo: 'mano', arriba, nombre: entrada.nombre }, '*');
    if (!esInvitado && usuarioId) {
      await supabase
        .from('aula_participantes')
        .update({ mano_levantada: arriba, mano_levantada_at: arriba ? new Date().toISOString() : null })
        .eq('evento_id', eventoId)
        .eq('usuario_id', usuarioId)
        .is('salido_at', null)
        .then(() => null, () => null);
    }
    if (arriba) avisar('Levantaste la mano. El instructor lo está viendo.');
  };

  // ── Moderación (host y co-host) ──────────────────────────────────────────
  const silenciar = async (p: DailyParticipant) => {
    if (!call) return;
    await call.updateParticipant(p.session_id, { setAudio: false });
    avisar(`${nombreDe(p)} quedó en silencio.`);
  };

  const apagarCamara = async (p: DailyParticipant) => {
    if (!call) return;
    await call.updateParticipant(p.session_id, { setVideo: false });
  };

  const cortarPantalla = async (p: DailyParticipant) => {
    if (!call) return;
    await call.updateParticipant(p.session_id, { setScreenShare: false });
  };

  const darPalabra = (p: DailyParticipant) => {
    if (!call) return;
    call.sendAppMessage({ tipo: 'palabra', nombre: entrada.nombre }, p.session_id);
    avisar(`Le diste la palabra a ${nombreDe(p)}. Su micrófono se abre en su equipo.`);
  };

  const expulsar = async (p: DailyParticipant) => {
    if (!call) return;
    await call.updateParticipant(p.session_id, { eject: true });
    setManos((prev) => {
      const copia = { ...prev };
      delete copia[p.session_id];
      return copia;
    });
  };

  const bajarMano = (sessionId: string) => {
    setManos((prev) => {
      const copia = { ...prev };
      delete copia[sessionId];
      return copia;
    });
  };

  // ── Chat: enviar ─────────────────────────────────────────────────────────
  const enviarTexto = async () => {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    try {
      if (esInvitado && sesionInvitado) {
        await aulaInvitado.mensaje(sesionInvitado, limpio);
      } else {
        const { error: e } = await supabase.from('aula_chat').insert({
          evento_id: eventoId,
          autor_tipo: 'usuario',
          autor_id: usuarioId,
          autor_nombre: entrada.nombre,
          autor_rol: entrada.rol,
          texto: limpio,
        });
        if (e) throw e;
      }
      setTexto('');
      if (esInvitado) await cargarMensajes();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo enviar el mensaje');
    } finally {
      setEnviando(false);
    }
  };

  const enviarArchivo = async (archivo: File) => {
    const tope = esInvitado ? MAX_ARCHIVO_INVITADO : MAX_ARCHIVO_MOVI;
    if (archivo.size > tope) {
      avisar(`El archivo supera ${Math.round(tope / 1024 / 1024)} MB`);
      return;
    }

    try {
      if (esInvitado && sesionInvitado) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const lector = new FileReader();
          lector.onload = () => resolve(String(lector.result));
          lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
          lector.readAsDataURL(archivo);
        });
        await aulaInvitado.adjunto(sesionInvitado, archivo.name, archivo.type || 'application/octet-stream', base64);
        await cargarMensajes();
      } else {
        const ext = (archivo.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
        const path = `${eventoId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('aula-adjuntos').upload(path, archivo, {
          contentType: archivo.type || 'application/octet-stream',
        });
        if (upErr) throw upErr;

        await supabase.from('aula_chat').insert({
          evento_id: eventoId,
          autor_tipo: 'usuario',
          autor_id: usuarioId,
          autor_nombre: entrada.nombre,
          autor_rol: entrada.rol,
          adjunto_path: path,
          adjunto_nombre: archivo.name,
          adjunto_bytes: archivo.size,
          adjunto_mime: archivo.type,
        });
      }
      avisar('Archivo compartido en el chat.');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo enviar el archivo');
    }
  };

  // ── Invitar a ponente externo ────────────────────────────────────────────
  const mensajeInvitacion = [
    `Te invito a participar como ponente en "${titulo}".`,
    '',
    'Entra desde aquí (no necesitas cuenta, solo tu nombre y empresa):',
    linkInvitado ?? '',
    '',
    'La clase se graba y queda publicada en On Demand.',
  ].join('\n');

  const copiarLink = async () => {
    if (!linkInvitado) return;
    try {
      await navigator.clipboard.writeText(linkInvitado);
      setLinkCopiado(true);
      window.setTimeout(() => setLinkCopiado(false), 2000);
    } catch {
      window.prompt('Copia el link del ponente:', linkInvitado);
    }
  };

  const enviarPorCorreo = () => {
    if (!linkInvitado) return;
    const asunto = `Invitación como ponente: ${titulo}`;
    window.open(`mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensajeInvitacion)}`, '_blank');
  };

  const enviarPorWhatsapp = () => {
    if (!linkInvitado) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensajeInvitacion)}`, '_blank');
  };

  // ── Grabación local + publicación ────────────────────────────────────────
  const iniciarGrabacion = async () => {
    if (!call) return;
    try {
      const grabador = new GrabadorClase(call);
      await grabador.iniciar();
      grabadorRef.current = grabador;
      setGrabando(true);
      setSegundosGrabacion(0);
      avisar('Grabando la clase. Se publicará sola en On Demand al terminar.');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo iniciar la grabación');
    }
  };

  const detenerGrabacion = async () => {
    const grabador = grabadorRef.current;
    if (!grabador) return;
    setGrabando(false);
    setPublicando('Preparando la grabación…');
    try {
      const res = await grabador.detener();
      grabadorRef.current = null;
      if (!res) {
        setPublicando(null);
        avisar('La grabación quedó vacía. La copia en la nube sigue disponible.');
        return;
      }

      setPublicando('Subiendo la grabación…');
      const [videoUrl, audioUrl] = await aulaPublicar.subirUrls(eventoId);
      await subirConUrlFirmada(videoUrl.path, videoUrl.token, res.video);
      if (res.audio) await subirConUrlFirmada(audioUrl.path, audioUrl.token, res.audio);

      setPublicando('Publicando en On Demand…');
      await aulaPublicar.publicar(eventoId, {
        video_path: videoUrl.path,
        audio_path: res.audio ? audioUrl.path : null,
        duracion_segundos: res.duracionSegundos,
        tamano_bytes: res.video.size,
      });

      setPublicando(null);
      avisar('Clase publicada en On Demand con su transcripción y material de apoyo.');
    } catch (e) {
      setPublicando(null);
      avisar(e instanceof Error ? e.message : 'No se pudo publicar la grabación');
    }
  };

  const terminarClase = async () => {
    if (!confirm('¿Finalizar la clase? Se desconectará a todos y la grabación se publicará.')) return;
    try {
      if (grabando) await detenerGrabacion();
      await aulaDaily.finalizar(eventoId);
    } catch {
      /* aunque falle el cierre remoto, salimos */
    }
    await call?.leave().catch(() => null);
    onSalir();
  };

  const salir = async () => {
    if (grabando) await detenerGrabacion();
    if (esInvitado && sesionInvitado) await aulaInvitado.salir(sesionInvitado).catch(() => null);
    await call?.leave().catch(() => null);
    onSalir();
  };

  useEffect(() => {
    const antes = (e: BeforeUnloadEvent) => {
      if (grabando) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [grabando]);

  // ── Orden de la rejilla: quien conduce primero ───────────────────────────
  const ordenados = useMemo(() => {
    const peso = (p: DailyParticipant) => {
      if (p.tracks?.screenVideo?.state === 'playable') return 0;
      if ((p as unknown as { owner?: boolean }).owner) return 1;
      if (p.local) return 2;
      if (p.tracks?.video?.state === 'playable') return 3;
      return 4;
    };
    return [...participantes].sort((a, b) => peso(a) - peso(b));
  }, [participantes]);

  const hayPantalla = ordenados.some((p) => p.tracks?.screenVideo?.state === 'playable');
  const manosActivas = Object.entries(manos);
  const puedoModerar = anfitrion || entrada.rol === 'cohost';

  const tiempo = `${String(Math.floor(segundosGrabacion / 60)).padStart(2, '0')}:${String(segundosGrabacion % 60).padStart(2, '0')}`;

  if (estado === 'error') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-body font-semibold text-neutral-900 dark:text-white">No se pudo entrar a la clase</p>
        <p className="max-w-md text-body-sm text-neutral-500 dark:text-white/60">{error}</p>
        <button onClick={onSalir} className="rounded-xl bg-accent px-4 py-2 text-body-sm font-semibold text-white">
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-3">
      {/* ── Escenario ── */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <h2 className="truncate text-title-sm font-bold text-neutral-900 dark:text-white">{titulo}</h2>
            <span className="rounded-full bg-surface-100 px-2 py-0.5 text-micro font-semibold text-neutral-600 dark:bg-white/10 dark:text-white/70">
              {participantes.length} conectados
            </span>
            {grabando && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-micro font-bold text-red-600 dark:bg-red-500/15 dark:text-red-400">
                REC {tiempo}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {anfitrion && linkInvitado && (
              <button
                onClick={() => setInvitarAbierto(true)}
                className="flex items-center gap-1.5 rounded-xl bg-accent-soft px-3 py-2 text-caption font-semibold text-accent-ink transition hover:bg-accent/15"
                title="Invitar a un ponente externo"
              >
                <UserPlus className="h-4 w-4" /> Invitar a ponente
              </button>
            )}
            {anfitrion && conGrabacion && (
              grabando ? (
                <button
                  onClick={detenerGrabacion}
                  className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-caption font-semibold text-white hover:bg-red-700"
                >
                  <CircleStop className="h-4 w-4" /> Detener grabación
                </button>
              ) : (
                <button
                  onClick={iniciarGrabacion}
                  disabled={publicando !== null}
                  className="flex items-center gap-1.5 rounded-xl bg-surface-100 px-3 py-2 text-caption font-semibold text-neutral-700 hover:bg-surface-200 disabled:opacity-50 dark:bg-white/10 dark:text-white/80"
                >
                  <Radio className="h-4 w-4" /> Grabar clase
                </button>
              )
            )}
            {anfitrion && (
              <button
                onClick={terminarClase}
                className="flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3 py-2 text-caption font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
              >
                <PhoneOff className="h-4 w-4" /> Finalizar
              </button>
            )}
          </div>
        </div>

        {publicando && (
          <div className="flex items-center gap-2 rounded-xl border border-accent/25 bg-accent-soft px-3 py-2 text-caption font-medium text-accent-ink">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            {publicando}
          </div>
        )}

        <div
          className={`grid flex-1 auto-rows-fr gap-2 overflow-y-auto rounded-2xl bg-surface-950 p-2 ${
            hayPantalla ? 'grid-cols-1' : participantes.length <= 1 ? 'grid-cols-1' : participantes.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {ordenados.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center gap-2 text-white/50">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
              <span className="text-caption">Conectando a la sala…</span>
            </div>
          )}

          {ordenados.map((p) => (
            <VideoTile
              key={p.session_id}
              participante={p}
              grande={!!hayPantalla && p.tracks?.screenVideo?.state === 'playable'}
            />
          ))}

          {hayPantalla && (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {ordenados
                .filter((p) => p.tracks?.screenVideo?.state !== 'playable')
                .map((p) => (
                  <VideoTile key={`mini-${p.session_id}`} participante={p} />
                ))}
            </div>
          )}
        </div>

        {/* Barra de controles */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-soft bg-surface-card px-3 py-2 shadow-card dark:border-white/10">
          <button
            onClick={alternarMic}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              mic ? 'bg-accent text-white' : 'bg-surface-100 text-neutral-600 hover:bg-surface-200 dark:bg-white/10 dark:text-white/70'
            }`}
            title={mic ? 'Silenciar micrófono' : 'Activar micrófono'}
          >
            {mic ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>

          <button
            onClick={alternarCam}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              cam ? 'bg-accent text-white' : 'bg-surface-100 text-neutral-600 hover:bg-surface-200 dark:bg-white/10 dark:text-white/70'
            }`}
            title={cam ? 'Apagar cámara' : 'Encender cámara'}
          >
            {cam ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>

          {(anfitrion || entrada.rol === 'cohost' || entrada.rol === 'ponente' || entrada.rol === 'oyente') && (
            <button
              onClick={alternarPantalla}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                pantalla ? 'bg-accent text-white' : 'bg-surface-100 text-neutral-600 hover:bg-surface-200 dark:bg-white/10 dark:text-white/70'
              }`}
              title={pantalla ? 'Dejar de compartir' : 'Compartir pantalla'}
            >
              {pantalla ? <MonitorX className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
            </button>
          )}

          <button
            onClick={alternarMano}
            className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-caption font-semibold transition ${
              mano ? 'bg-amber-500 text-white' : 'bg-surface-100 text-neutral-600 hover:bg-surface-200 dark:bg-white/10 dark:text-white/70'
            }`}
            title="Levantar la mano"
          >
            <Hand className="h-4 w-4" /> {mano ? 'Mano levantada' : 'Pedir la palabra'}
          </button>

          <div className="mx-1 h-6 w-px bg-neutral-200 dark:bg-white/10" />

          <button
            onClick={() => { setPanelAbierto(true); setTab('chat'); }}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-surface-100 px-3 text-caption font-semibold text-neutral-600 hover:bg-surface-200 dark:bg-white/10 dark:text-white/70"
          >
            <MessageSquare className="h-4 w-4" /> Chat
            {mensajes.length > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{mensajes.length}</span>
            )}
          </button>

          <button
            onClick={() => { setPanelAbierto(true); setTab('gente'); }}
            className="relative flex h-10 items-center gap-1.5 rounded-xl bg-surface-100 px-3 text-caption font-semibold text-neutral-600 hover:bg-surface-200 dark:bg-white/10 dark:text-white/70"
          >
            <Users className="h-4 w-4" /> Gente
            {manosActivas.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {manosActivas.length}
              </span>
            )}
          </button>

          <button
            onClick={salir}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-red-50 px-3 text-caption font-semibold text-red-600 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-400"
          >
            <PhoneOff className="h-4 w-4" /> Salir
          </button>
        </div>
      </div>

      {/* ── Panel lateral ── */}
      {panelAbierto && (
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-soft bg-surface-card shadow-card dark:border-white/10">
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-white/10">
            <div className="flex gap-1">
              {(['chat', 'gente'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-2.5 py-1 text-caption font-semibold capitalize transition ${
                    tab === t ? 'bg-accent-soft text-accent-ink' : 'text-neutral-500 hover:text-neutral-800 dark:text-white/50'
                  }`}
                >
                  {t === 'chat' ? 'Chat' : 'Participantes'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPanelAbierto(false)}
              className="rounded-lg p-1 text-neutral-400 hover:bg-surface-100 dark:hover:bg-white/10"
              title="Ocultar panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {tab === 'chat' ? (
            <>
              <div ref={chatFondo} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
                {mensajes.length === 0 && (
                  <p className="py-8 text-center text-caption text-neutral-400">
                    Aquí aparecerá el chat de la clase.
                  </p>
                )}
                {mensajes.map((m) => {
                  const propio = m.autor_nombre === entrada.nombre;
                  return (
                    <div key={m.id} className={`flex flex-col ${propio ? 'items-end' : 'items-start'}`}>
                      {!propio && (
                        <span className="mb-0.5 flex items-center gap-1 text-micro font-semibold text-neutral-500 dark:text-white/50">
                          {m.autor_nombre}
                          {(m.autor_rol === 'host' || m.autor_rol === 'cohost' || m.autor_rol === 'ponente') && (
                            <Crown className="h-2.5 w-2.5 text-amber-500" />
                          )}
                        </span>
                      )}
                      <div
                        className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-body-sm ${
                          propio
                            ? 'bg-accent text-white'
                            : 'bg-surface-100 text-neutral-800 dark:bg-white/10 dark:text-white/85'
                        }`}
                      >
                        {m.texto}
                        {m.adjunto_url && (
                          <a
                            href={m.adjunto_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1 text-caption font-semibold underline ${
                              propio ? 'bg-white/15 text-white' : 'bg-white text-accent-ink dark:bg-white/10'
                            }`}
                          >
                            <Paperclip className="h-3 w-3" />
                            <span className="truncate">{m.adjunto_nombre ?? 'Archivo'}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-neutral-200 p-2 dark:border-white/10">
                <div className="flex items-end gap-1.5">
                  <label className="cursor-pointer rounded-lg p-2 text-neutral-500 hover:bg-surface-100 dark:hover:bg-white/10" title="Enviar archivo">
                    <Paperclip className="h-4 w-4" />
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void enviarArchivo(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void enviarTexto();
                      }
                    }}
                    rows={1}
                    placeholder="Escribe un mensaje…"
                    className="max-h-24 min-h-[38px] flex-1 resize-none rounded-lg border border-neutral-200 bg-surface-50 px-2.5 py-2 text-body-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                  <button
                    onClick={() => void enviarTexto()}
                    disabled={!texto.trim() || enviando}
                    className="rounded-lg bg-accent p-2 text-white disabled:opacity-40"
                    title="Enviar"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {manosActivas.length > 0 && (
                <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="mb-1 flex items-center gap-1 text-caption font-bold text-amber-800 dark:text-amber-300">
                    <Hand className="h-3.5 w-3.5" /> Piden la palabra
                  </p>
                  {manosActivas.map(([sessionId, nombre]) => (
                    <div key={sessionId} className="flex items-center justify-between py-0.5">
                      <span className="truncate text-caption text-amber-900 dark:text-amber-200">{nombre}</span>
                      {puedoModerar && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              const p = participantes.find((x) => x.session_id === sessionId);
                              if (p) darPalabra(p);
                            }}
                            className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                          >
                            Dar palabra
                          </button>
                          <button
                            onClick={() => bajarMano(sessionId)}
                            className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
                          >
                            Bajar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {ordenados.map((p) => (
                <div
                  key={p.session_id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-100 dark:hover:bg-white/5"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent-ink">
                    {iniciales(nombreDe(p))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-caption font-semibold text-neutral-800 dark:text-white/85">
                      {nombreDe(p)} {p.local && <span className="text-neutral-400">(tú)</span>}
                    </p>
                    <p className="text-[10px] text-neutral-400">
                      {(p as unknown as { owner?: boolean }).owner ? 'Instructor' : 'Participante'}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 text-neutral-400">
                    {p.tracks?.audio?.state === 'playable' ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                    {p.tracks?.video?.state === 'playable' ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                  </div>

                  {puedoModerar && !p.local && (
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => void silenciar(p)} title="Silenciar" className="rounded p-1 text-neutral-400 hover:bg-surface-200 hover:text-red-600 dark:hover:bg-white/10">
                        <MicOff className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => darPalabra(p)} title="Dar la palabra" className="rounded p-1 text-neutral-400 hover:bg-surface-200 hover:text-emerald-600 dark:hover:bg-white/10">
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => void apagarCamara(p)} title="Apagar cámara" className="rounded p-1 text-neutral-400 hover:bg-surface-200 hover:text-red-600 dark:hover:bg-white/10">
                        <VideoOff className="h-3.5 w-3.5" />
                      </button>
                      {p.tracks?.screenVideo?.state === 'playable' && (
                        <button onClick={() => void cortarPantalla(p)} title="Cortar pantalla" className="rounded p-1 text-neutral-400 hover:bg-surface-200 hover:text-red-600 dark:hover:bg-white/10">
                          <MonitorX className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => void expulsar(p)} title="Sacar de la clase" className="rounded p-1 text-neutral-400 hover:bg-surface-200 hover:text-red-600 dark:hover:bg-white/10">
                        <Shield className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      )}

      <BaseModal
        isOpen={invitarAbierto}
        onClose={() => setInvitarAbierto(false)}
        title="Invitar a un ponente"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className="text-body-sm text-neutral-600 dark:text-white/70">
            Comparte este link con el ponente externo. No necesita cuenta: solo escribe su nombre y su
            empresa, y entra directo a la clase con permiso para compartir pantalla.
          </p>

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={linkInvitado ?? ''}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-surface-50 px-3 py-2.5 text-caption text-neutral-700 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white/80"
            />
            <button
              onClick={() => void copiarLink()}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-caption font-semibold transition ${
                linkCopiado ? 'bg-emerald-600 text-white' : 'bg-accent text-white hover:bg-accent-hover'
              }`}
            >
              {linkCopiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {linkCopiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={enviarPorCorreo}
              className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-body-sm font-semibold text-neutral-700 transition hover:border-accent hover:text-accent-ink dark:border-white/10 dark:text-white/75"
            >
              <Mail className="h-4 w-4" /> Enviar por correo
            </button>
            <button
              onClick={enviarPorWhatsapp}
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-body-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
            >
              <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
            </button>
          </div>

          <p className="rounded-lg bg-surface-50 px-3 py-2 text-[11px] leading-relaxed text-neutral-500 dark:bg-white/5 dark:text-white/50">
            El link sirve para todo el evento y deja de funcionar cuando finalizas la clase. Quien entre
            por aquí queda registrado como ponente invitado, con nombre y empresa en la ficha de On Demand.
          </p>
        </div>
      </BaseModal>

      {aviso && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-neutral-900 px-4 py-2.5 text-caption font-medium text-white shadow-xl">
          {aviso}
        </div>
      )}
    </div>
  );
}

export default SalaAula;