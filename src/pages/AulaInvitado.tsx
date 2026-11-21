import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, ShieldCheck, Video, Building2, User, AlertCircle, Mail, Phone, MapPin, LogIn, Loader2 } from 'lucide-react';
import { SEGUROS_EDUCATION_LOGO } from '../components/segurosEducation/SegurosEducationLayout';
import { aulaInvitado, aulaDaily, type EntradaAula, type EntradaInvitado, type InfoInvitacion } from '../lib/aulaDaily';
import { supabase } from '../lib/supabase';
import { SalaAula } from '../components/aula/SalaAula';

/**
 * Entrada por el link de un evento del Aula Virtual.
 *
 * Hay dos links por clase y los dos caen aquí:
 *  - `link_token`          → invitado con voz (ponente): nombre, empresa y foto.
 *  - `link_token_asistente` → asistente: nombre, correo, WhatsApp y oficina. Se
 *    registra como usuario nuevo (rol Agente, pendiente de activación) y entra
 *    a la sala como oyente.
 *
 * Quien ya tiene cuenta MOVI puede entrar con ella: el link no lo obliga a
 * pasar por el formulario de invitado.
 */
export function AulaInvitado() {
  const { token } = useParams<{ token: string }>();

  const [info, setInfo] = useState<InfoInvitacion | null>(null);
  const [fechaTexto, setFechaTexto] = useState<string | null>(null);
  const [errorLink, setErrorLink] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [oficinaId, setOficinaId] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sesion, setSesion] = useState<EntradaInvitado | null>(null);
  const [sesionMovi, setSesionMovi] = useState<EntradaAula | null>(null);
  const [usuarioMovi, setUsuarioMovi] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement | null>(null);

  const esAsistente = info?.tipo === 'asistente';

  useEffect(() => {
    if (!token) return;
    let vivo = true;

    aulaInvitado
      .info(token)
      .then((r) => {
        if (!vivo) return;
        setInfo(r);
        if (r.fecha_inicio) {
          const d = new Date(r.fecha_inicio);
          setFechaTexto(
            d.toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
          );
        }
      })
      .catch((e: Error) => {
        if (vivo) setErrorLink(e.message || 'Este link no es válido');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    // Si ya hay sesión MOVI en este navegador, se ofrece entrar con la cuenta.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (vivo && data.session?.user) setUsuarioMovi(data.session.user.id);
      })
      .catch(() => null);

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
    if (!token || !info) return;
    if (nombre.trim().length < 2) return setError('Escribe tu nombre');

    setEnviando(true);
    setError(null);
    try {
      if (esAsistente) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError('Escribe un correo válido');
        if (whatsapp.replace(/[^0-9]/g, '').length !== 10) return setError('El WhatsApp debe tener 10 dígitos');
        if (!oficinaId) return setError('Selecciona tu oficina');

        const r = await aulaInvitado.entrarAsistente(token, {
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          whatsapp: whatsapp.replace(/[^0-9]/g, ''),
          oficina_id: oficinaId,
        });
        setSesion(r);
      } else {
        if (empresa.trim().length < 2) return setError('Escribe tu empresa');
        const r = await aulaInvitado.entrar(token, nombre.trim(), empresa.trim(), avatar);
        setSesion(r);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar a la sesión');
    } finally {
      setEnviando(false);
    }
  };

  const entrarConCuenta = async () => {
    if (!info) return;
    setEnviando(true);
    setError(null);
    try {
      setSesionMovi(await aulaDaily.entrar(info.evento_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar con tu cuenta MOVI');
    } finally {
      setEnviando(false);
    }
  };

  if (sesion) {
    return (
      <div className="min-h-screen bg-surface-canvas p-3">
        <SalaAula
          eventoId={sesion.evento_id}
          entrada={{ ...sesion, rol: sesion.tipo === 'asistente' ? 'oyente' : 'ponente' }}
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

  if (sesionMovi) {
    return (
      <div className="min-h-screen bg-surface-canvas p-3">
        <SalaAula
          eventoId={info!.evento_id}
          entrada={sesionMovi}
          anfitrion={false}
          esInvitado={false}
          usuarioId={usuarioMovi}
          titulo={info!.clase}
          onSalir={() => setSesionMovi(null)}
        />
      </div>
    );
  }

  const input =
    'w-full rounded-xl border border-neutral-200 bg-surface-50 px-3 py-2.5 text-body text-neutral-900 placeholder:text-neutral-400 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white';
  const etiqueta = 'mb-1 flex items-center gap-1.5 text-caption font-semibold text-neutral-700 dark:text-white/70';

  return (
    // `justify-center` dentro de un contenedor de altura fija que sí desplaza:
    // si el formulario no cabe (móvil en horizontal, zoom alto) empieza arriba
    // y se puede recorrer; con items-center la parte de arriba quedaba cortada.
    <div className="h-[100dvh] overflow-y-auto bg-gradient-to-br from-[#101a3a] via-[#16205c] to-[#1C37E0] px-4">
      <div className="flex min-h-full flex-col justify-center py-6">
        <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-white">
          <img src={SEGUROS_EDUCATION_LOGO} alt="Seguros Education" className="h-12 w-auto select-none" />
          <p className="text-[11px] tracking-wide text-white/70">Aula Virtual · MOVI Digital</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-2xl dark:bg-surface-900 sm:p-6">
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
              <p className="text-micro font-semibold uppercase tracking-wide text-accent-ink">
                {esAsistente ? 'Invitación a la capacitación' : 'Invitación como ponente'}
              </p>
              <h1 className="mt-1 text-title font-bold leading-snug text-neutral-900 dark:text-white">{info.clase}</h1>
              <p className="mt-1 text-body-sm text-neutral-500 dark:text-white/60">
                {[fechaTexto, info.ponente].filter(Boolean).join(' · ') || 'Clase en vivo del Aula Virtual'}
              </p>

              {usuarioMovi && (
                <>
                  <button
                    onClick={() => void entrarConCuenta()}
                    disabled={enviando}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent/5 px-4 py-3 text-body font-semibold text-accent-ink transition hover:bg-accent/10 disabled:opacity-60"
                  >
                    <LogIn className="h-4 w-4" /> Entrar con mi cuenta MOVI
                  </button>
                  <p className="mt-2 text-center text-[11px] text-neutral-400">
                    Entras como oyente con tu cuenta, sin llenar el formulario.
                  </p>
                  <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-neutral-300">
                    <span className="h-px flex-1 bg-neutral-200 dark:bg-white/10" /> o como invitado{' '}
                    <span className="h-px flex-1 bg-neutral-200 dark:bg-white/10" />
                  </div>
                </>
              )}

              {!usuarioMovi && (
                <p className="mt-3 text-body-sm text-neutral-500 dark:text-white/60">
                  {esAsistente
                    ? 'Entras como oyente. Si ya tienes cuenta MOVI, '
                    : 'Entras como ponente externo. No necesitas cuenta.'}
                  {esAsistente && (
                    <a
                      href={`/login?redirect=${encodeURIComponent(`/aula/${token ?? ''}`)}`}
                      className="font-semibold text-accent-ink hover:underline"
                    >
                      inicia sesión aquí
                    </a>
                  )}
                </p>
              )}

              <div className="mt-5 space-y-3">
                <div>
                  <label className={etiqueta}>
                    <User className="h-3.5 w-3.5" /> Nombre completo
                  </label>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ana Martínez" maxLength={80} className={input} />
                </div>

                {esAsistente ? (
                  <>
                    <div>
                      <label className={etiqueta}>
                        <Mail className="h-3.5 w-3.5" /> Correo laboral
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ana@correo.com"
                        maxLength={160}
                        autoComplete="email"
                        className={input}
                      />
                    </div>

                    <div>
                      <label className={etiqueta}>
                        <Phone className="h-3.5 w-3.5" /> WhatsApp laboral (10 dígitos)
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                        placeholder="3312345678"
                        className={input}
                      />
                    </div>

                    <div>
                      <label className={etiqueta}>
                        <MapPin className="h-3.5 w-3.5" /> Oficina
                      </label>
                      <select value={oficinaId} onChange={(e) => setOficinaId(e.target.value)} className={input}>
                        <option value="">Selecciona tu oficina</option>
                        {info.oficinas.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className={etiqueta}>
                      <Building2 className="h-3.5 w-3.5" /> Empresa
                    </label>
                    <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Aseguradora" maxLength={80} className={input} />
                  </div>
                )}

                {!esAsistente && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fotoRef.current?.click()}
                      className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-neutral-300 text-neutral-400 transition hover:border-accent hover:text-accent dark:border-white/15"
                      title="Agregar foto"
                    >
                      {avatar ? <img src={avatar} alt="Foto" className="h-full w-full object-cover" /> : <Camera className="h-5 w-5" />}
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
                )}
              </div>

              {error && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-caption text-red-600 dark:bg-red-500/15 dark:text-red-400">{error}</p>
              )}

              <button
                onClick={() => void entrar()}
                disabled={enviando}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-body font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando…
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" /> Entrar a la capacitación
                  </>
                )}
              </button>

              <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-neutral-400">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {esAsistente
                  ? 'La sesión se graba para publicarse en On Demand. Tus datos se registran para que el equipo de MOVI complete tu alta.'
                  : 'La sesión se graba para publicarse en On Demand. Tus datos (nombre y empresa) aparecerán en el material de la clase.'}
              </p>
            </>
          )}
        </div>

          <p className="mt-5 text-center text-[11px] text-white/50">MOVI Digital · Seguros Education</p>
        </div>
      </div>
    </div>
  );
}

export default AulaInvitado;
