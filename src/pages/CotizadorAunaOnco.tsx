import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Download, AlertTriangle, ChevronDown, ChevronUp, Info, Loader2, ShieldCheck, FileSignature, FileText, FilePlus, Save, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/ui/page-header';
import { getEffectiveUserLogo } from '../lib/logoUtils';
import {
  cotizar,
  EXTRAPRIMAS,
  PREGUNTAS_MEDICAS,
  AVISO_IMPORTANTE,
  LIMITE_ANUAL,
  VIGENCIA_TARIFAS,
  imc,
  type Asegurado,
  type FormaPago,
  type Sexo,
} from '../lib/aunaOncoCotizador';
import { generarPdfAunaOnco, agenteDesdeUsuario, type AgentePdf } from '../lib/aunaOncoPdf';
import { guardarCotizacion, cargarCotizacion, idCotizacionEnUrl } from '../lib/cotizaciones';
import type { DatosAuna } from '../lib/aunaOncoGuardado';
import { generarPdfSolicitudAuna } from '../lib/aunaOncoSolicitudPdf';
import { solicitudInicial, sincronizar, faltantes, type Solicitud } from '../lib/aunaOncoSolicitud';
import SolicitudEmisionAuna from '../components/cotizador/SolicitudEmisionAuna';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const nuevoAsegurado = (n: number): Asegurado => ({
  id: crypto.randomUUID(),
  nombre: '',
  sexo: n === 0 ? 'M' : 'F',
  fechaNacimiento: '',
  estatura: null,
  peso: null,
  respuestas: {},
  extraprimas: [],
});

const inputCls = 'w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent';
const labelCls = 'block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1';

const descargar = (blob: Blob, nombre: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
};

export default function CotizadorAunaOnco() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState('');
  const [formaPago, setFormaPago] = useState<FormaPago>('anual');
  const [descuento, setDescuento] = useState(0);
  const [asegurados, setAsegurados] = useState<Asegurado[]>([nuevoAsegurado(0)]);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<'cotizacion' | 'solicitud'>('cotizacion');
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [cotizacionId, setCotizacionId] = useState<string | null>(null);
  const [folio, setFolio] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<'idle' | 'guardando' | 'ok'>('idle');

  // Abrir una cotización guardada desde Cotizar › Cotizaciones (?cotizacion=<id>).
  useEffect(() => {
    const id = idCotizacionEnUrl();
    if (!id) return;
    cargarCotizacion<DatosAuna>(id)
      .then(c => {
        const d = c.datos;
        setCliente(d.cliente ?? c.cliente_nombre);
        setFormaPago(d.formaPago ?? 'anual');
        setDescuento(d.descuento ?? 0);
        if (d.asegurados?.length) setAsegurados(d.asegurados);
        setSolicitud(d.solicitud ?? null);
        setCotizacionId(c.id);
        setFolio(c.folio);
      })
      .catch(e => setError('No se pudo abrir la cotización: ' + (e?.message ?? e)));
  }, []);

  // Si el titular no lleva nombre propio, es el mismo cliente.
  const aseguradosConNombre = useMemo(
    () => asegurados.map((a, i) => (i === 0 && !a.nombre.trim() ? { ...a, nombre: cliente } : a)),
    [asegurados, cliente],
  );
  const resultado = useMemo(() => cotizar(aseguradosConNombre, formaPago, descuento), [aseguradosConNombre, formaPago, descuento]);
  const faltan = useMemo(() => (solicitud ? faltantes(solicitud, aseguradosConNombre) : []), [solicitud, aseguradosConNombre]);

  const datosAgente = async (): Promise<AgentePdf> =>
    agenteDesdeUsuario(usuario, usuario?.id ? await getEffectiveUserLogo(usuario.id) : null);

  /** Guarda en Cotizaciones (mismo folio si ya existe) y devuelve el folio. */
  const guardar = async (): Promise<string> => {
    setGuardado('guardando');
    try {
      const c = solicitud?.contratante;
      const r = await guardarCotizacion<DatosAuna>({
        id: cotizacionId,
        cotizador: 'auna_onco',
        cliente_nombre: cliente,
        cliente_email: c?.email.trim() || null,
        cliente_telefono: c?.telefono.trim() || null,
        datos: { cliente, formaPago, descuento, asegurados, resultado, solicitud },
        resumen: { asegurados: asegurados.length, formaPago, solicitud: !!solicitud },
        prima_total: resultado.primaTotal,
      });
      setCotizacionId(r.id);
      setFolio(r.folio);
      setGuardado('ok');
      setTimeout(() => setGuardado('idle'), 3000);
      return r.folio;
    } catch (e) {
      setGuardado('idle');
      throw e;
    }
  };

  const guardarAMano = async () => {
    setError(null);
    if (!validarCotizacion()) return;
    try { await guardar(); } catch (e) { setError('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e))); }
  };

  const nueva = () => {
    setCliente('');
    setFormaPago('anual');
    setDescuento(0);
    setAsegurados([nuevoAsegurado(0)]);
    setSolicitud(null);
    setCotizacionId(null);
    setFolio(null);
    setModo('cotizacion');
    setError(null);
    navigate('/cotizar/auna-oncologico', { replace: true });
  };

  const validarCotizacion = () => {
    if (!cliente.trim()) { setError('Escribe el nombre del cliente para la cotización.'); return false; }
    if (!resultado.valido) { setError('Revisa los asegurados: todos necesitan nombre y una edad aceptable.'); return false; }
    return true;
  };

  const abrirSolicitud = () => {
    setError(null);
    if (!validarCotizacion()) return;
    setSolicitud(prev => sincronizar(prev ?? solicitudInicial(cliente.trim(), aseguradosConNombre), cliente.trim(), aseguradosConNombre));
    setModo('solicitud');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generarSolicitud = async () => {
    if (!solicitud || faltan.length) return;
    setError(null);
    setGenerando(true);
    try {
      const folioCot = await guardar();
      const folio = `${folioCot}-SOL`;
      const blob = await generarPdfSolicitudAuna({
        folio,
        folioCotizacion: folioCot,
        fecha: new Date(),
        solicitud,
        asegurados: aseguradosConNombre,
        resultado,
        agente: await datosAgente(),
      });
      descargar(blob, `Solicitud-Oncosalud-${cliente.trim().replace(/\s+/g, '-')}-${folio}.pdf`);
    } catch (e) {
      setError('No se pudo generar el PDF: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGenerando(false);
    }
  };

  const actualizar = (id: string, cambios: Partial<Asegurado>) =>
    setAsegurados(prev => prev.map(a => (a.id === id ? { ...a, ...cambios } : a)));

  const toggleRespuesta = (a: Asegurado, preguntaId: string, valor: boolean) => {
    const respuestas = { ...a.respuestas, [preguntaId]: valor };
    // Sin tabaquismo declarado, no puede quedar una extraprima de tabaco.
    const extraprimas = preguntaId === 'p16' && !valor
      ? a.extraprimas.filter(id => EXTRAPRIMAS.find(e => e.id === id)?.grupo !== 'tabaco')
      : a.extraprimas;
    actualizar(a.id, { respuestas, extraprimas });
  };

  const toggleExtraprima = (a: Asegurado, id: string) => {
    const ep = EXTRAPRIMAS.find(e => e.id === id)!;
    let lista = a.extraprimas.includes(id) ? a.extraprimas.filter(x => x !== id) : [...a.extraprimas, id];
    if (ep.grupo && lista.includes(id)) {
      lista = lista.filter(x => x === id || EXTRAPRIMAS.find(e => e.id === x)?.grupo !== ep.grupo);
    }
    actualizar(a.id, { extraprimas: lista });
  };

  const toggleAbierto = (id: string) =>
    setAbiertos(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const descargarPdf = async () => {
    setError(null);
    if (!validarCotizacion()) return;
    setGenerando(true);
    try {
      const folio = await guardar();
      const blob = await generarPdfAunaOnco({
        folio,
        cliente: cliente.trim(),
        fecha: new Date(),
        resultado,
        agente: await datosAgente(),
      });
      descargar(blob, `Cotizacion-Oncosalud-${cliente.trim().replace(/\s+/g, '-')}-${folio}.pdf`);
    } catch (e) {
      setError('No se pudo generar el PDF: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Auna Oncosalud Plus"
        description="Seguro oncológico individual y familiar. Cotiza por quinquenio y sexo, con cuestionario médico y extraprimas preliminares."
        backTo="/cotizar"
        backLabel="Cotizar"
        badge={<img src="/logo-auna.png" alt="Auna" className="h-5 w-auto" />}
        actions={
          <div className="flex items-center gap-2">
            {folio && (
              <button type="button" onClick={nueva} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.05]">
                <FilePlus className="w-4 h-4" /> Nueva
              </button>
            )}
            <button type="button" onClick={guardarAMano} disabled={guardado === 'guardando'} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-white/10 hover:border-accent disabled:opacity-50">
              {guardado === 'guardando' ? <Loader2 className="w-4 h-4 animate-spin" /> : guardado === 'ok' ? <Check className="w-4 h-4 text-emerald-600" /> : <Save className="w-4 h-4" />}
              {guardado === 'ok' ? 'Guardada' : 'Guardar'}
            </button>
            <Link to="/cotizar/cotizaciones" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-white/10 hover:border-accent">
              <FileText className="w-4 h-4" /> Cotizaciones
            </Link>
          </div>
        }
      />
      {folio && (
        <p className="-mt-3 text-xs text-neutral-500 dark:text-neutral-400">Folio <span className="font-mono font-semibold text-accent">{folio}</span> — al guardar o descargar se actualiza este mismo folio.</p>
      )}

      {modo === 'solicitud' && solicitud ? (
        <SolicitudEmisionAuna
          solicitud={solicitud}
          setSolicitud={fn => setSolicitud(prev => (prev ? fn(prev) : prev))}
          asegurados={aseguradosConNombre}
          resultado={resultado}
          faltan={faltan}
          generando={generando}
          error={error}
          onVolver={() => { setError(null); setModo('cotizacion'); }}
          onGenerar={generarSolicitud}
        />
      ) : (
      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* ── Captura ── */}
        <div className="space-y-5">
          <section className="rounded-2xl bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/[0.06] p-5">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className={labelCls}>Cliente (contratante)</label>
                <input className={inputCls} value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre completo" />
              </div>
              <div>
                <label className={labelCls}>Forma de pago</label>
                <div className="flex rounded-lg border border-neutral-200 dark:border-white/10 overflow-hidden">
                  {(['anual', 'mensual'] as FormaPago[]).map(fp => (
                    <button
                      key={fp}
                      type="button"
                      onClick={() => setFormaPago(fp)}
                      className={`flex-1 py-2 text-sm font-semibold transition-colors ${formaPago === fp ? 'bg-accent text-accent-foreground' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}
                    >
                      {fp === 'anual' ? 'Anual (contado)' : 'Mensual'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Descuento vigente (%)</label>
                <input type="number" min={0} max={100} step={1} className={inputCls} value={descuento} onChange={e => setDescuento(Number(e.target.value) || 0)} />
              </div>
              <div className="flex items-end">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                  Tarifas sin descuento vigentes al {VIGENCIA_TARIFAS}. Valida con Auna si hay descuento el día de hoy.
                </p>
              </div>
            </div>
          </section>

          {asegurados.map((a, i) => {
            const linea = resultado.lineas[i];
            const abierto = abiertos.has(a.id);
            const valorImc = imc(a.estatura, a.peso);
            const preguntas = PREGUNTAS_MEDICAS.filter(p => !p.sexo || p.sexo === a.sexo);
            const extraprimas = EXTRAPRIMAS.filter(e => !e.sexo || e.sexo === a.sexo)
              .filter(e => e.grupo !== 'tabaco' || a.respuestas.p16);
            const respondidas = preguntas.filter(p => a.respuestas[p.id] !== undefined).length;
            return (
              <section key={a.id} className="rounded-2xl bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/[0.06] overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-[#1FB3C9] via-[#48F6D1] to-[#B5E61D]" />
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                      {i === 0 ? 'Titular' : `Dependiente A${i}`}
                    </h3>
                    {i > 0 && (
                      <button type="button" onClick={() => setAsegurados(prev => prev.filter(x => x.id !== a.id))} className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="Quitar asegurado" title="Quitar asegurado">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-6 gap-3">
                    <div className="sm:col-span-3">
                      <label className={labelCls}>Nombre</label>
                      <input className={inputCls} value={a.nombre} onChange={e => actualizar(a.id, { nombre: e.target.value })} placeholder={i === 0 ? (cliente || 'Igual que el cliente') : 'Nombre completo'} />
                    </div>
                    <div className="sm:col-span-1">
                      <label className={labelCls}>Sexo</label>
                      <select className={inputCls} value={a.sexo} onChange={e => {
                        const sexo = e.target.value as Sexo;
                        actualizar(a.id, { sexo, extraprimas: a.extraprimas.filter(id => { const ep = EXTRAPRIMAS.find(x => x.id === id); return !ep?.sexo || ep.sexo === sexo; }) });
                      }}>
                        <option value="M">Hombre</option>
                        <option value="F">Mujer</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Fecha de nacimiento</label>
                      <input type="date" className={inputCls} value={a.fechaNacimiento} onChange={e => actualizar(a.id, { fechaNacimiento: e.target.value })} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    {linea.edad != null && !linea.error && (
                      <span className="text-neutral-500 dark:text-neutral-400">Edad <b className="text-neutral-800 dark:text-neutral-200">{linea.edad}</b> · quinquenio {linea.quinquenio}</span>
                    )}
                    {linea.error && a.fechaNacimiento && <span className="text-red-600 dark:text-red-400 font-medium">{linea.error}</span>}
                    {!linea.error && (
                      <span className="ml-auto font-semibold text-neutral-900 dark:text-white">
                        Prima neta {fmt(linea.primaNeta)}
                        {linea.extraprima > 0 && <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">(incl. extraprima {Math.round(linea.extraprimaPct * 100)}%)</span>}
                      </span>
                    )}
                  </div>

                  {linea.alertas.length > 0 && (
                    <ul className="space-y-1">
                      {linea.alertas.map(t => (
                        <li key={t} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{t}
                        </li>
                      ))}
                    </ul>
                  )}

                  <button type="button" onClick={() => toggleAbierto(a.id)} className="w-full flex items-center justify-between text-sm font-semibold text-neutral-700 dark:text-neutral-200 pt-3 border-t border-neutral-100 dark:border-white/5">
                    <span>Cuestionario médico y extraprimas <span className="ml-1 text-xs font-normal text-neutral-400">{respondidas}/{preguntas.length} respondidas</span></span>
                    {abierto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {abierto && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={labelCls}>Estatura (m)</label>
                          <input type="number" step="0.01" min={0} className={inputCls} value={a.estatura ?? ''} onChange={e => actualizar(a.id, { estatura: e.target.value ? Number(e.target.value) : null })} placeholder="1.70" />
                        </div>
                        <div>
                          <label className={labelCls}>Peso (kg)</label>
                          <input type="number" step="0.1" min={0} className={inputCls} value={a.peso ?? ''} onChange={e => actualizar(a.id, { peso: e.target.value ? Number(e.target.value) : null })} placeholder="70" />
                        </div>
                        <div>
                          <label className={labelCls}>IMC</label>
                          <div className="px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300">{valorImc ? valorImc.toFixed(1) : '—'}</div>
                        </div>
                      </div>

                      <div className="divide-y divide-neutral-100 dark:divide-white/5">
                        {preguntas.map(p => (
                          <div key={p.id} className="flex items-start gap-3 py-2.5">
                            <span className="text-[11px] font-bold text-neutral-400 w-6 shrink-0 pt-0.5">{p.num}.</span>
                            <p className="flex-1 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">{p.texto}</p>
                            <div className="flex shrink-0 rounded-lg border border-neutral-200 dark:border-white/10 overflow-hidden">
                              {[true, false].map(v => (
                                <button
                                  key={String(v)}
                                  type="button"
                                  onClick={() => toggleRespuesta(a, p.id, v)}
                                  className={`px-3 py-1 text-xs font-semibold ${a.respuestas[p.id] === v
                                    ? v ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                                    : 'bg-white dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}
                                >
                                  {v ? 'Sí' : 'No'}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 mb-1">Extraprimas frecuentes (preliminares)</p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2">Marca la que aplique según lo declarado. La extraprima definitiva la fija la suscripción médica de Auna.</p>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {extraprimas.map(ep => {
                            const activa = a.extraprimas.includes(ep.id);
                            return (
                              <button
                                key={ep.id}
                                type="button"
                                onClick={() => toggleExtraprima(a, ep.id)}
                                className={`flex items-center justify-between gap-2 text-left px-3 py-2 rounded-lg border text-xs transition-colors ${activa
                                  ? 'border-accent bg-accent/10 text-neutral-900 dark:text-white'
                                  : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300'}`}
                              >
                                <span>{ep.label}</span>
                                <span className="font-bold shrink-0">+{Math.round(ep.pct * 100)}%</span>
                              </button>
                            );
                          })}
                        </div>
                        {!a.respuestas.p16 && (
                          <p className="text-[11px] text-neutral-400 mt-2">Las extraprimas por tabaquismo aparecen al responder "Sí" en la pregunta 16.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          })}

          {asegurados.length < 8 && (
            <button type="button" onClick={() => setAsegurados(prev => [...prev, nuevoAsegurado(prev.length)])} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-white/10 text-sm font-semibold text-neutral-500 hover:text-accent hover:border-accent transition-colors">
              <Plus className="w-4 h-4" /> Agregar dependiente
            </button>
          )}
        </div>

        {/* ── Resumen ── */}
        <aside className="lg:sticky lg:top-4 space-y-4">
          <section className="rounded-2xl bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-white/5">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Resumen</h3>
              <img src="/logo-auna.png" alt="Auna" className="h-5 w-auto" />
            </div>
            <dl className="px-5 py-4 space-y-2 text-sm">
              {[
                ['Prima neta', fmt(resultado.primaNetaTotal)],
                ...(resultado.extraprimaTotal > 0 ? [['  incluye extraprimas', fmt(resultado.extraprimaTotal)]] : []),
                ...(resultado.descuento > 0 ? [[`Descuento ${resultado.descuentoPct}%`, `- ${fmt(resultado.descuento)}`]] : []),
                ['Recargo pago fraccionado', fmt(resultado.recargoFraccionado)],
                ['Derechos de póliza', fmt(resultado.derechos)],
                ['Subtotal', fmt(resultado.subtotal)],
                ['IVA 16%', fmt(resultado.iva)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className={`text-neutral-500 dark:text-neutral-400 ${k.startsWith('  ') ? 'pl-3 text-xs' : ''}`}>{k.trim()}</dt>
                  <dd className="font-medium text-neutral-800 dark:text-neutral-200 tabular-nums">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-white/5">
                <dt className="font-bold text-neutral-900 dark:text-white">Prima total</dt>
                <dd className="font-bold text-neutral-900 dark:text-white tabular-nums">{fmt(resultado.primaTotal)}</dd>
              </div>
            </dl>
            <div className="mx-5 mb-5 rounded-xl bg-neutral-900 dark:bg-black/40 text-white p-4">
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">{formaPago === 'anual' ? 'Pago único' : 'Primer recibo'}</p>
              <p className="text-2xl font-bold tabular-nums">{fmt(resultado.primerRecibo)}</p>
              {resultado.reciboSubsecuente != null && (
                <p className="text-xs text-neutral-300 mt-1">+ 11 recibos de <b className="text-white">{fmt(resultado.reciboSubsecuente)}</b></p>
              )}
            </div>
          </section>

          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 mb-1"><Info className="w-3.5 h-3.5" /> Aviso importante sobre su cotización</p>
            <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-200/80">{AVISO_IMPORTANTE}</p>
          </div>

          {resultado.requiereSuscripcion && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-neutral-900 p-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Uno o más asegurados requieren valoración de suscripción médica. El PDF lo indica.
            </div>
          )}

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="button"
            onClick={descargarPdf}
            disabled={generando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent-hover disabled:opacity-60 transition-colors"
          >
            {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Descargar cotización PDF
          </button>

          <button
            type="button"
            onClick={abrirSolicitud}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-accent text-accent font-semibold text-sm hover:bg-accent/10 transition-colors"
          >
            <FileSignature className="w-4 h-4" />
            Solicitar emisión
          </button>

          <p className="flex items-start gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
            Límite anual por asegurado {fmt(LIMITE_ANUAL)} · deducible $0 · copago 0% · carencia 180 días · red cerrada Auna.
          </p>
        </aside>
      </div>
      )}
    </div>
  );
}
