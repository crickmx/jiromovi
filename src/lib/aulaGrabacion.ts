import type { DailyCall } from '@daily-co/daily-js';

/**
 * Grabador de la clase en el navegador del anfitrión.
 *
 * Daily descarga su grabación local como archivo y no expone el blob, así que
 * para publicar automáticamente grabamos nosotros: un canvas que compone al
 * ponente o la pantalla compartida, y un mezclador de audio con todas las voces.
 *
 * Se graban dos pistas a la vez:
 *  - video compuesto 720p (lo que se publica)
 *  - audio solo a 32 kbps (lo que se transcribe con Whisper, pesa poquísimo)
 *
 * La grabación en la nube de Daily corre en paralelo desde el servidor: si este
 * navegador se cae, esa copia es la que rescata la clase.
 */

export interface ResultadoGrabacion {
  video: Blob;
  audio: Blob | null;
  duracionSegundos: number;
}

type CallObject = DailyCall;

const ANCHO = 1280;
const ALTO = 720;
const FPS_VIDEO = 24;

function mejorMime() {
  const candidatos = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidatos.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export class GrabadorClase {
  private call: CallObject;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audioCtx: AudioContext | null = null;
  private destinoAudio: MediaStreamAudioDestinationNode | null = null;
  private mezclados = new Set<string>();
  private recVideo: MediaRecorder | null = null;
  private recAudio: MediaRecorder | null = null;
  private partesVideo: Blob[] = [];
  private partesAudio: Blob[] = [];
  private temporizador: number | null = null;
  private inicio = 0;
  private detenido = false;

  constructor(call: CallObject) {
    this.call = call;
    this.canvas = document.createElement('canvas');
    this.canvas.width = ANCHO;
    this.canvas.height = ALTO;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Este navegador no puede componer el video de la clase');
    this.ctx = ctx;
  }

  get activo() {
    return this.recVideo?.state === 'recording';
  }

  private participantes() {
    const todos = Object.values(this.call.participants() ?? {});
    const conPantalla = todos.find((p) => p.tracks?.screenVideo?.state === 'playable');
    if (conPantalla) return { principal: conPantalla, esPantalla: true };

    // Sin pantalla compartida se muestra a quien esté conduciendo y, si no hay
    // cámara, al primero que sí la tenga.
    const conCamara = todos
      .filter((p) => p.tracks?.video?.state === 'playable')
      .sort((a, b) => Number(!!(b as unknown as { owner?: boolean }).owner) - Number(!!(a as unknown as { owner?: boolean }).owner));
    return { principal: conCamara[0] ?? null, esPantalla: false };
  }

  private pintar() {
    const { ctx } = this;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, ANCHO, ALTO);

    const { principal, esPantalla } = this.participantes();
    const track = esPantalla
      ? principal?.tracks?.screenVideo?.persistentTrack
      : principal?.tracks?.video?.persistentTrack;

    if (track) {
      let el = (this as unknown as { _video?: HTMLVideoElement })._video;
      if (!el) {
        el = document.createElement('video');
        el.muted = true;
        el.playsInline = true;
        el.autoplay = true;
        (this as unknown as { _video?: HTMLVideoElement })._video = el;
      }
      if ((this as unknown as { _trackId?: string })._trackId !== track.id) {
        (this as unknown as { _trackId?: string })._trackId = track.id;
        el.srcObject = new MediaStream([track]);
        void el.play().catch(() => null);
      }

      const vw = el.videoWidth || ANCHO;
      const vh = el.videoHeight || ALTO;
      const escala = Math.min(ANCHO / vw, ALTO / vh);
      const w = vw * escala;
      const h = vh * escala;
      try {
        ctx.drawImage(el, (ANCHO - w) / 2, (ALTO - h) / 2, w, h);
      } catch {
        /* frame aún no disponible */
      }
    }

    ctx.fillStyle = 'rgba(15,23,42,0.55)';
    ctx.fillRect(0, ALTO - 54, ANCHO, 54);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 22px Manrope, system-ui, sans-serif';
    const nombre = (principal as unknown as { user_name?: string })?.user_name ?? 'Aula Virtual';
    ctx.fillText(nombre.slice(0, 46), 24, ALTO - 20);

    const enVivo = this.activo && !this.detenido;
    if (enVivo) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(ANCHO - 132, ALTO - 27, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '600 18px Manrope, system-ui, sans-serif';
      ctx.fillText('REC', ANCHO - 114, ALTO - 21);
    }
  }

  private mezclarAudio() {
    if (!this.audioCtx || !this.destinoAudio) return;
    const todos = Object.values(this.call.participants() ?? {});
    for (const p of todos) {
      const track = p.tracks?.audio?.persistentTrack;
      if (!track) continue;
      const id = track.id;
      if (this.mezclados.has(id)) continue;
      try {
        const fuente = this.audioCtx.createMediaStreamSource(new MediaStream([track]));
        fuente.connect(this.destinoAudio);
        this.mezclados.add(id);
      } catch {
        /* pista ya cerrada */
      }
    }
  }

  async iniciar() {
    if (this.recVideo) return;

    this.inicio = Date.now();
    this.detenido = false;
    this.partesVideo = [];
    this.partesAudio = [];

    // Audio mezclado de todos los participantes
    this.audioCtx = new AudioContext();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume().catch(() => null);
    this.destinoAudio = this.audioCtx.createMediaStreamDestination();
    this.mezclarAudio();

    const mimeVideo = mejorMime();
    if (!mimeVideo) throw new Error('Este navegador no puede grabar video (usa Chrome o Edge de escritorio)');

    // Video: canvas compuesto
    this.pintar();
    const streamVideo = this.canvas.captureStream(FPS_VIDEO);
    this.recVideo = new MediaRecorder(streamVideo, {
      mimeType: mimeVideo,
      videoBitsPerSecond: 1_200_000,
    });
    this.recVideo.ondataavailable = (e) => {
      if (e.data.size > 0) this.partesVideo.push(e.data);
    };
    this.recVideo.start(10_000);

    // Audio solo (para transcripción)
    try {
      const streamAudio = this.destinoAudio.stream;
      this.recAudio = new MediaRecorder(streamAudio, {
        mimeType: mimeVideo.includes('opus') ? mimeVideo.replace('video/webm', 'audio/webm') : 'audio/webm',
        audioBitsPerSecond: 32_000,
      });
      this.recAudio.ondataavailable = (e) => {
        if (e.data.size > 0) this.partesAudio.push(e.data);
      };
      this.recAudio.start(10_000);
    } catch {
      this.recAudio = null; // la transcripción es opcional
    }

    this.temporizador = window.setInterval(() => {
      this.mezclarAudio();
      this.pintar();
    }, 1000 / FPS_VIDEO);
  }

  async detener(): Promise<ResultadoGrabacion | null> {
    if (!this.recVideo) return null;
    this.detenido = true;
    if (this.temporizador) {
      window.clearInterval(this.temporizador);
      this.temporizador = null;
    }

    const duracionSegundos = Math.max(1, Math.round((Date.now() - this.inicio) / 1000));

    const cerrar = (rec: MediaRecorder | null) =>
      new Promise<Blob | null>((resolve) => {
        if (!rec || rec.state === 'inactive') return resolve(null);
        rec.onstop = () => resolve(new Blob([], { type: rec.mimeType }));
        rec.stop();
      });

    await cerrar(this.recAudio);
    await cerrar(this.recVideo);

    const video = new Blob(this.partesVideo, { type: this.recVideo.mimeType.split(';')[0] });
    const audio = this.partesAudio.length ? new Blob(this.partesAudio, { type: 'audio/webm' }) : null;

    this.partesVideo = [];
    this.partesAudio = [];
    this.recVideo = null;
    this.recAudio = null;

    await this.audioCtx?.close().catch(() => null);
    this.audioCtx = null;
    this.destinoAudio = null;
    this.mezclados.clear();

    if (video.size < 10_000) return null;
    return { video, audio, duracionSegundos };
  }
}