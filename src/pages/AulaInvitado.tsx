import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GraduationCap, Camera, ShieldCheck, Video, Building2, User, AlertCircle } from 'lucide-react';
import { aulaInvitado, type EntradaInvitado } from '../lib/aulaDaily';
import { SalaAula } from '../components/aula/SalaAula';

/**
 * Entrada del ponente invitado: sin cuenta, sin login.
 * Solo nombre, empresa y —opcional— una foto. El resto del acceso lo resuelve
 * la edge function `aula-invitado` con el link del evento.
 */
export function AulaInvitado() {
  const { token } = useParams<{ token: string }>();

  const [info, setInfo] = useState<{ clase: string; estado: string } | null>(null);
  const [errorLink, setErrorLink] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sesion, setSesion] = useState<EntradaInvitado | null>(null);
  const fotoRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    aulaInvitado
      .info(token)
      .then((r) => {
        if (vivo) setInfo({ clase: r.clase, estado: r.estado });
      })
      .catch((e: Error) => {
        if (vivo) setErrorLink(e.message || 'Este link no es válido');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [token]);

  const elegirFoto = async (archivo: File) => {
    if (!archivo.type.startsWith('image/')) return;

    // Se reduce a 256 px en el navegador: la foto viaja ligera y nítida.
    const bitmap = await createImageBitmap(archivo);
    const lado = 256;
    const escala = Math.min(lado / bitmap.width, lado / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    setAvatar(canvas.toDataURL('image/jpeg', 0.82));
  };

  const entrar = async () => {
    if (!token) return;
    if (nombre.trim().length < 2) return setError('Escribe tu nombre');
    if (empresa.trim().length < 2) return setError('Escribe tu empresa');

    setEnviando(true);
    setError(null);
    try {
      const r = await aulaInvitado.entrar(token, nombre.trim(), empresa.trim(), avatar);
      setSesion(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar a la clase');
    } finally {
      setEnviando(false);
    }
  };

  if (sesion) {
    return (
      <div className="min-h-screen bg-surface-canvas p-3">
        <SalaAula
          eventoId={sesion.evento_id}
          entrada={{ ...sesion, rol: 'ponente' }}
          anfitrion={false}
          esInvitado
          sesionInvitado={sesion.sesion}
          usuarioId={null}
          titulo={sesion.clase}
          onSalir={() => setSesion(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#101a3a] via-[#16205c] to-[#1C37E0] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="text-left leading-tight">
            <p className="text-body-sm font-bold">Seguros Education</p>
            <p className="text-[11px] text-white/70">Aula Virtual · MOVI Digital</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl dark:bg-surface-900">
          {cargando && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-accent/20 border-t-accent" />
              <p className="text-body-sm text-neutral-500 dark:text-white/60">Verificando el link…</p>
            </div>
          )}

          {!cargando && errorLink && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/15">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-title-sm font-bold text-neutral-900 dark:text-white">Link no disponible</p>
              <p className="text-body-sm text-neutral-500 dark:text-white/60">{errorLink}</p>
            </div>
          )}

          {!cargando && !errorLink && info && (
            <>
              <p className="text-micro font-semibold uppercase tracking-wide text-accent-ink">Invitación a ponencia</p>
              <h1 className="mt-1 text-title font-bold leading-snug text-neutral-900 dark:text-white">{info.clase}</h1>
              <p className="mt-1 text-body-sm text-neutral-500 dark:text-white/60">
                Entras como ponente externo. No necesitas cuenta.
              </p>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-caption font-semibold text-neutral-700 dark:text-white/70">
                    <User className="h-3.5 w-3.5" /> Nombre completo
                  </label>
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ana Martínez"
                    maxLength={80}
                    className="w-full rounded-xl border border-neutral-200 bg-surface-50 px-3 py-2.5 text-body text-neutral-900 placeholder:text-neutral-400 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-caption font-semibold text-neutral-700 dark:text-white/70">
                    <Building2 className="h-3.5 w-3.5" /> Empresa
                  </label>
                  <input
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    placeholder="Aseguradora"
                    maxLength={80}
                    className="w-full rounded-xl border border-neutral-200 bg-surface-50 px-3 py-2.5 text-body text-neutral-900 placeholder:text-neutral-400 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fotoRef.current?.click()}
                    className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-neutral-300 text-neutral-400 transition hover:border-accent hover:text-accent dark:border-white/15"
                    title="Agregar foto"
                  >
                    {avatar ? (
                      <img src={avatar} alt="Foto" className="h-full w-full object-cover" />
                    ) : (
                      <Camera className="h-5 w-5" />
                    )}
                  </button>
                  <div className="text-caption text-neutral-500 dark:text-white/55">
                    <p className="font-semibold text-neutral-700 dark:text-white/75">Foto (opcional)</p>
                    <p>Se muestra junto a tu nombre durante la clase.</p>
                  </div>
                  <input
                    ref={fotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void elegirFoto(f);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              {error && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-caption text-red-600 dark:bg-red-500/15 dark:text-red-400">
                  {error}
                </p>
              )}

              <button
                onClick={() => void entrar()}
                disabled={enviando}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-body font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
              >
                {enviando ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Entrando…
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" /> Entrar a la clase
                  </>
                )}
              </button>

              <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-neutral-400">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                La clase se graba para publicarse en On Demand. Tus datos (nombre y empresa) aparecerán en el
                material de la clase.
              </p>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] text-white/50">
          MOVI Digital · Seguros Education
        </p>
      </div>
    </div>
  );
}

export default AulaInvitado;