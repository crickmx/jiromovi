import { useCallback, useEffect, useState } from 'react';
import { Mail, Plus, Trash2, RefreshCw, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Pencil, Server, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cnSistema as cn } from '@/lib/utils';

// Cuentas de correo EXTERNO (POP3 para recibir, SMTP para enviar).
//
// Es la pantalla que administra los canales: alta, prueba y baja. No toca el
// correo de MOVI/JIRO: ese vive en el gestor y se configura en su propia
// pantalla.
//
// Lo que esta pantalla NO puede prometer, y lo dice cuando alguien la usa:
// POP3 no tiene carpetas ni leído/no leído en el servidor. Lo que se marca
// como leído aquí se queda marcado solo aquí.

interface Canal {
  id: string;
  nombre: string;
  email: string;
  nombre_remitente: string | null;
  pop_host: string;
  pop_port: number;
  pop_tls: string;
  pop_usuario: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_tls: string;
  smtp_requiere_auth: boolean;
  smtp_usuario: string | null;
  remitente_obligatorio: string | null;
  dejar_copia: boolean;
  estado_conexion: string | null;
  ultimo_error: string | null;
  ultima_sincronizacion: string | null;
}

interface FormCanal {
  id?: string;
  nombre: string;
  email: string;
  nombreRemitente: string;
  password: string;
  popHost: string;
  popPort: string;
  popTls: string;
  popUsuario: string;
  smtpHost: string;
  smtpPort: string;
  smtpTls: string;
  smtpRequiereAuth: boolean;
  smtpUsuario: string;
  remitenteObligatorio: string;
  dejarCopia: boolean;
}

const VACIO: FormCanal = {
  nombre: '', email: '', nombreRemitente: '', password: '',
  popHost: '', popPort: '995', popTls: 'ssl', popUsuario: '',
  smtpHost: '', smtpPort: '587', smtpTls: 'starttls', smtpRequiereAuth: true, smtpUsuario: '',
  remitenteObligatorio: '', dejarCopia: true,
};

const inputCls = 'w-full px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 text-neutral-900 dark:text-white text-sm';
const etiquetaCls = 'block text-caption font-medium text-neutral-500 dark:text-neutral-400 mb-1.5';

function aForm(c: Canal): FormCanal {
  return {
    id: c.id,
    nombre: c.nombre,
    email: c.email,
    nombreRemitente: c.nombre_remitente ?? '',
    password: '',
    popHost: c.pop_host,
    popPort: String(c.pop_port),
    popTls: c.pop_tls,
    popUsuario: c.pop_usuario ?? '',
    smtpHost: c.smtp_host,
    smtpPort: String(c.smtp_port),
    smtpTls: c.smtp_tls,
    smtpRequiereAuth: c.smtp_requiere_auth,
    smtpUsuario: c.smtp_usuario ?? '',
    remitenteObligatorio: c.remitente_obligatorio ?? '',
    dejarCopia: c.dejar_copia,
  };
}

const resumenTls = (tls: string) => (tls === 'ssl' ? 'TLS' : tls === 'starttls' ? 'STARTTLS' : 'sin cifrado');

export default function CorreoExterno() {
  const { usuario } = useAuth();
  const [canales, setCanales] = useState<Canal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState<FormCanal | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState<string | null>(null);
  const [confirmarBaja, setConfirmarBaja] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  // Resultado de la última prueba, por canal. Se muestra junto a la cuenta.
  const [pruebas, setPruebas] = useState<Record<string, { ok: boolean; detalle: string }>>({});

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    const { data, error } = await supabase
      .from('correo_externo_canales')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) setAviso({ tipo: 'error', texto: error.message });
    setCanales((data as Canal[]) ?? []);
    setCargando(false);
  }, [usuario]);

  useEffect(() => { void cargar(); }, [cargar]);

  const llamar = async (cuerpo: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/correo-externo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const datos = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(datos.error || 'No se pudo completar la operación.');
    return datos;
  };

  const probar = async (canalId: string) => {
    setProbando(canalId);
    setAviso(null);
    try {
      const r = await llamar({ accion: 'probar', canalId });
      const entrada = r.entrada as { ok: boolean; error?: string; mensajes?: number };
      const salida = r.salida as { ok: boolean; error?: string };
      setPruebas((p) => ({
        ...p,
        [canalId]: r.ok
          ? { ok: true, detalle: `Entrada y salida responden${typeof entrada.mensajes === 'number' ? ` · ${entrada.mensajes} mensaje(s) en el servidor` : ''}` }
          : { ok: false, detalle: [entrada.error, salida.error].filter(Boolean).join(' · ') },
      }));
      void cargar();
    } catch (e) {
      setPruebas((p) => ({ ...p, [canalId]: { ok: false, detalle: e instanceof Error ? e.message : 'falló la prueba' } }));
    } finally {
      setProbando(null);
    }
  };

  const guardar = async () => {
    if (!form) return;
    setGuardando(true);
    setAviso(null);
    try {
      const r = await llamar({ accion: 'guardar', canal: form, password: form.password });
      setForm(null);
      setAviso({ tipo: 'ok', texto: form.id ? 'Cuenta actualizada.' : 'Cuenta agregada.' });
      await cargar();
      // Se prueba de una vez: guardar sin saber si entra es dejar una cuenta
      // que va a fallar la primera vez que alguien la abra.
      if (r.canalId) void probar(r.canalId);
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo guardar.' });
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (canalId: string) => {
    setAviso(null);
    const { error } = await supabase.from('correo_externo_canales').delete().eq('id', canalId);
    if (error) {
      setAviso({ tipo: 'error', texto: error.message });
    } else {
      setAviso({ tipo: 'ok', texto: 'Cuenta eliminada, con sus mensajes descargados.' });
    }
    setConfirmarBaja(null);
    setPruebas((p) => { const n = { ...p }; delete n[canalId]; return n; });
    await cargar();
  };

  const campo = (clave: keyof FormCanal, valor: string | boolean) =>
    setForm((f) => (f ? { ...f, [clave]: valor } : f));

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-title-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-accent" />
            Correo externo
          </h1>
          <p className="text-body-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Tus otras cuentas de correo, de cualquier proveedor. Recibe por POP3 y envía por SMTP.
            El correo de MOVI se configura en el gestor, aparte.
          </p>
        </div>
        {!form && (
          <button
            onClick={() => { setForm({ ...VACIO }); setAviso(null); }}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Agregar cuenta
          </button>
        )}
      </header>

      {aviso && (
        <div className={cn(
          'mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2',
          aviso.tipo === 'ok'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300',
        )}>
          {aviso.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{aviso.texto}</span>
        </div>
      )}

      {form && (
        <section className="mb-6 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-title font-semibold text-neutral-900 dark:text-white">
              {form.id ? 'Editar cuenta' : 'Cuenta nueva'}
            </h2>
            <button onClick={() => setForm(null)} className="text-neutral-400 hover:text-neutral-600" aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={etiquetaCls}>Nombre para ti</label>
              <input className={inputCls} value={form.nombre} onChange={(e) => campo('nombre', e.target.value)} placeholder="Correo de la oficina" />
            </div>
            <div>
              <label className={etiquetaCls}>Tu correo</label>
              <input className={inputCls} value={form.email} onChange={(e) => campo('email', e.target.value)} placeholder="tucorreo@proveedor.com" inputMode="email" />
            </div>
          </div>

          <h3 className="text-caption font-semibold uppercase tracking-wide text-neutral-400 mt-6 mb-3 flex items-center gap-2">
            <Server className="w-3.5 h-3.5" /> Entrada (POP3)
          </h3>
          <div className="grid sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className={etiquetaCls}>Servidor</label>
              <input className={inputCls} value={form.popHost} onChange={(e) => campo('popHost', e.target.value)} placeholder="pop.proveedor.com" />
            </div>
            <div>
              <label className={etiquetaCls}>Puerto</label>
              <input className={inputCls} value={form.popPort} onChange={(e) => campo('popPort', e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <label className={etiquetaCls}>Cifrado</label>
              <select className={inputCls} value={form.popTls} onChange={(e) => campo('popTls', e.target.value)}>
                <option value="ssl">TLS (995)</option>
                <option value="starttls">STARTTLS (110)</option>
                <option value="ninguno">Sin cifrado</option>
              </select>
            </div>
          </div>

          <h3 className="text-caption font-semibold uppercase tracking-wide text-neutral-400 mt-6 mb-3 flex items-center gap-2">
            <Server className="w-3.5 h-3.5" /> Salida (SMTP)
          </h3>
          <div className="grid sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className={etiquetaCls}>Servidor</label>
              <input className={inputCls} value={form.smtpHost} onChange={(e) => campo('smtpHost', e.target.value)} placeholder="smtp.proveedor.com" />
            </div>
            <div>
              <label className={etiquetaCls}>Puerto</label>
              <input className={inputCls} value={form.smtpPort} onChange={(e) => campo('smtpPort', e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <label className={etiquetaCls}>Cifrado</label>
              <select className={inputCls} value={form.smtpTls} onChange={(e) => campo('smtpTls', e.target.value)}>
                <option value="starttls">STARTTLS (587)</option>
                <option value="ssl">TLS (465)</option>
                <option value="ninguno">Sin cifrado</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className={etiquetaCls}>
              Contraseña {form.id && <span className="font-normal">(déjala vacía para conservar la actual)</span>}
            </label>
            <input className={inputCls} type="password" value={form.password} onChange={(e) => campo('password', e.target.value)} autoComplete="new-password" />
            <p className="text-caption text-neutral-500 mt-1.5">
              Si tu proveedor pide una contraseña de aplicación (Gmail, iCloud), pégala aquí.
            </p>
          </div>

          <details className="mt-4">
            <summary className="text-caption text-neutral-500 cursor-pointer select-none">Opciones avanzadas</summary>
            <div className="grid sm:grid-cols-2 gap-4 mt-3">
              <div>
                <label className={etiquetaCls}>Usuario de entrada (si es distinto del correo)</label>
                <input className={inputCls} value={form.popUsuario} onChange={(e) => campo('popUsuario', e.target.value)} />
              </div>
              <div>
                <label className={etiquetaCls}>Usuario de salida</label>
                <input className={inputCls} value={form.smtpUsuario} onChange={(e) => campo('smtpUsuario', e.target.value)} />
              </div>
              <div>
                <label className={etiquetaCls}>Nombre del remitente</label>
                <input className={inputCls} value={form.nombreRemitente} onChange={(e) => campo('nombreRemitente', e.target.value)} placeholder="Tu nombre" />
              </div>
              <div>
                <label className={etiquetaCls}>Forzar remitente</label>
                <input className={inputCls} value={form.remitenteObligatorio} onChange={(e) => campo('remitenteObligatorio', e.target.value)} placeholder="(solo si el servidor lo exige)" />
              </div>
              <label className="flex items-start gap-2 text-body-sm text-neutral-700 dark:text-neutral-300">
                <input type="checkbox" className="mt-1" checked={form.smtpRequiereAuth} onChange={(e) => campo('smtpRequiereAuth', e.target.checked)} />
                El servidor de salida pide usuario y contraseña
              </label>
              <label className="flex items-start gap-2 text-body-sm text-neutral-700 dark:text-neutral-300">
                <input type="checkbox" className="mt-1" checked={form.dejarCopia} onChange={(e) => campo('dejarCopia', e.target.checked)} />
                Dejar copia en el servidor
              </label>
            </div>
            {!form.dejarCopia && (
              <p className="text-caption text-amber-700 dark:text-amber-400 mt-2">
                Con esto apagado, cada mensaje que se descargue se borra del servidor. No se puede deshacer.
              </p>
            )}
          </details>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setForm(null)} className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-700 dark:text-neutral-300">
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando || !form.email || !form.popHost || !form.smtpHost || (!form.id && !form.password)}
              className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              {guardando ? 'Guardando…' : 'Guardar y probar'}
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        {cargando && <p className="text-body-sm text-neutral-500">Cargando tus cuentas…</p>}
        {!cargando && canales.length === 0 && !form && (
          <div className="border border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl p-10 text-center">
            <Mail className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
            <p className="text-body-sm text-neutral-500">Todavía no tienes cuentas externas.</p>
          </div>
        )}

        {canales.map((c) => {
          const prueba = pruebas[c.id];
          const conProblema = prueba ? !prueba.ok : c.estado_conexion === 'error';
          return (
            <article key={c.id} className="border border-neutral-200 dark:border-neutral-700 rounded-2xl p-4 bg-white dark:bg-neutral-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-body font-semibold text-neutral-900 dark:text-white truncate">{c.nombre}</h3>
                  <p className="text-body-sm text-neutral-500 truncate">{c.email}</p>
                  <p className="text-caption text-neutral-400 mt-1">
                    Entrada {c.pop_host}:{c.pop_port} ({resumenTls(c.pop_tls)}) · Salida {c.smtp_host}:{c.smtp_port} ({resumenTls(c.smtp_tls)})
                    {c.dejar_copia ? ' · deja copia' : ' · borra del servidor'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => probar(c.id)}
                    disabled={probando === c.id}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-700 dark:text-neutral-300 disabled:opacity-40"
                  >
                    <RefreshCw className={cn('w-4 h-4', probando === c.id && 'animate-spin')} />
                    {probando === c.id ? 'Probando' : 'Probar'}
                  </button>
                  <button
                    onClick={() => { setForm(aForm(c)); setAviso(null); }}
                    className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-800"
                    aria-label="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmarBaja(c.id)}
                    className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-red-600"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {(prueba?.detalle || c.ultimo_error) && (
                <p className={cn('text-caption mt-2', conProblema ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400')}>
                  {prueba?.detalle ?? c.ultimo_error}
                </p>
              )}

              {confirmarBaja === c.id && (
                <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3">
                  <p className="text-caption text-neutral-600 dark:text-neutral-400">
                    Se elimina la cuenta y <strong>todos los mensajes ya descargados</strong>. Lo que siga en el servidor no se toca.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setConfirmarBaja(null)} className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm">Cancelar</button>
                    <button onClick={() => eliminar(c.id)} className="px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-medium">Eliminar</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <p className="text-caption text-neutral-400 mt-6">
        POP3 no tiene carpetas ni marcas en el servidor: lo que marques como leído aquí se queda marcado solo aquí.
      </p>
    </div>
  );
}
