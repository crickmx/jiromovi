import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Search, FolderOpen, FileDown, Send, Copy, Trash2, Loader2, Mail, MessageCircle, X, CheckCircle2, AlertTriangle, FileSignature,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/ui/page-header';
import { normalizarTexto } from '../lib/utils';
import {
  COTIZADORES, mensajeDeError, listarCotizaciones, eliminarCotizacion, duplicarCotizacion,
  type Cotizacion, type CotizadorId,
} from '../lib/cotizaciones';
import { pdfDeCotizacion } from '../lib/cotizacionesPdf';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
const inputCls = 'w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent';

const aBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve((r.result as string).split(',')[1]);
  r.onerror = reject;
  r.readAsDataURL(blob);
});

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function resumenTexto(c: Cotizacion): string {
  const r = c.resumen as { productos?: string[]; personas?: number; formaPago?: string; asegurados?: number; tramite_folio?: string | null };
  const partes: string[] = [];
  if (r.productos?.length) {
    const nombres: Record<string, string> = { BXPLUS: 'BX+', BNV: 'Bupa Vital', BNP: 'Bupa Plus' };
    partes.push(r.productos.map(p => nombres[p] ?? p).join(' · '));
  }
  const personas = r.personas ?? r.asegurados;
  if (personas) partes.push(`${personas} asegurado${personas === 1 ? '' : 's'}`);
  if (r.formaPago) partes.push(r.formaPago === 'mensual' ? 'Mensual' : 'Anual');
  if (r.tramite_folio) partes.push(`Emisión ${r.tramite_folio}`);
  return partes.join(' · ');
}

export default function Cotizaciones() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [agentes, setAgentes] = useState<Map<string, string>>(new Map());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCotizador, setFiltroCotizador] = useState<CotizadorId | ''>('');
  const [filtroAgente, setFiltroAgente] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Cotizacion | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const avisar = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await listarCotizaciones();
      setCotizaciones(lista);
      const ids = [...new Set(lista.map(c => c.usuario_id))];
      if (ids.length) {
        const { data } = await supabase.from('usuarios').select('id, nombre, apellidos').in('id', ids);
        setAgentes(new Map((data ?? []).map(u => [u.id, `${u.nombre} ${u.apellidos}`.trim()])));
      }
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const hayDeOtros = useMemo(() => cotizaciones.some(c => c.usuario_id !== usuario?.id), [cotizaciones, usuario?.id]);

  const filtradas = useMemo(() => {
    const q = normalizarTexto(busqueda);
    return cotizaciones.filter(c => {
      if (filtroCotizador && c.cotizador !== filtroCotizador) return false;
      if (filtroAgente && c.usuario_id !== filtroAgente) return false;
      if (!q) return true;
      return normalizarTexto(`${c.folio} ${c.cliente_nombre} ${agentes.get(c.usuario_id) ?? ''}`).includes(q);
    });
  }, [cotizaciones, busqueda, filtroCotizador, filtroAgente, agentes]);

  const opcionesAgente = useMemo(
    () => [...new Set(cotizaciones.map(c => c.usuario_id))]
      .map(id => ({ id, nombre: agentes.get(id) ?? 'Usuario eliminado' }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [cotizaciones, agentes],
  );

  const conAccion = async (c: Cotizacion, accion: string, fn: () => Promise<void>) => {
    setOcupado(`${c.id}:${accion}`);
    try { await fn(); } catch (e) { avisar(mensajeDeError(e), 'error'); } finally { setOcupado(null); }
  };

  const abrir = (c: Cotizacion) => navigate(`${COTIZADORES[c.cotizador]?.ruta ?? '/cotizar'}?cotizacion=${c.id}`);

  const pdf = (c: Cotizacion) => conAccion(c, 'pdf', async () => {
    const { blob, nombre } = await pdfDeCotizacion(c);
    descargar(blob, nombre);
  });

  const duplicar = (c: Cotizacion) => conAccion(c, 'dup', async () => {
    const { folio } = await duplicarCotizacion(c);
    avisar(`Copia creada: ${folio}`);
    await cargar();
  });

  const eliminar = (c: Cotizacion) => {
    if (!window.confirm(`¿Eliminar la cotización ${c.folio} de ${c.cliente_nombre}?`)) return;
    conAccion(c, 'del', async () => {
      await eliminarCotizacion(c.id);
      setCotizaciones(prev => prev.filter(x => x.id !== c.id));
      avisar(`Cotización ${c.folio} eliminada`);
    });
  };

  const iconBtn = 'p-2 rounded-lg text-neutral-500 hover:text-accent hover:bg-neutral-100 dark:hover:bg-white/[0.06] disabled:opacity-40 transition-colors';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Cotizaciones"
        badge={cargando ? undefined : `${filtradas.length}`}
        description="Todas las cotizaciones hechas en los cotizadores de MOVI: ábrelas, edítalas, descarga su PDF o envíalas al cliente."
        icon={FileText}
        backTo="/cotizar"
        backLabel="Cotizar"
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input className={`${inputCls} pl-9`} placeholder="Buscar por folio, cliente o agente" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className={`${inputCls} sm:w-56`} value={filtroCotizador} onChange={e => setFiltroCotizador(e.target.value as CotizadorId | '')}>
          <option value="">Todos los cotizadores</option>
          {Object.values(COTIZADORES).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {hayDeOtros && (
          <select className={`${inputCls} sm:w-56`} value={filtroAgente} onChange={e => setFiltroAgente(e.target.value)}>
            <option value="">Todos los agentes</option>
            {opcionesAgente.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">No se pudieron cargar las cotizaciones: {error}</p>}

      {cargando ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-neutral-500 rounded-2xl border border-dashed border-neutral-200 dark:border-white/10">
          <FileText className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">{cotizaciones.length ? 'Ninguna cotización coincide con el filtro' : 'Aún no hay cotizaciones guardadas'}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-white/[0.06] text-left text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Folio</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Cotizador</th>
                  {hayDeOtros && <th className="px-4 py-3">Agente</th>}
                  <th className="px-4 py-3 text-right">Prima total</th>
                  <th className="px-4 py-3">Actualizada</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(c => {
                  const info = COTIZADORES[c.cotizador];
                  const ultimoEnvio = c.envios?.[c.envios.length - 1];
                  return (
                    <tr key={c.id} className="border-b border-neutral-50 dark:border-white/[0.03] hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-accent whitespace-nowrap">
                        <button type="button" onClick={() => abrir(c)} className="hover:underline">{c.folio}</button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900 dark:text-white">{c.cliente_nombre}</p>
                        <p className="text-[11px] text-neutral-500">{resumenTexto(c)}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
                          {info?.logo && <img src={info.logo} alt="" className="h-4 w-auto max-w-[48px] object-contain" />}
                          {info?.label ?? c.cotizador}
                        </span>
                      </td>
                      {hayDeOtros && <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-300">{agentes.get(c.usuario_id) ?? '—'}</td>}
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-800 dark:text-neutral-200">
                        {c.prima_total != null ? fmt(c.prima_total) : '—'}
                        {(c.resumen as { prima_sin_extraprima?: number | null }).prima_sin_extraprima != null && (
                          <span className="block text-[10px] text-neutral-500">sin extraprima {fmt((c.resumen as { prima_sin_extraprima: number }).prima_sin_extraprima)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                        {fecha(c.updated_at)}
                        {ultimoEnvio && (
                          <span className="block text-[10px] text-emerald-600 dark:text-emerald-400" title={`${c.envios.length} envío(s)`}>
                            Enviada por {ultimoEnvio.canal === 'correo' ? 'correo' : 'WhatsApp'} · {fecha(ultimoEnvio.at)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button type="button" className={iconBtn} title="Abrir y editar" onClick={() => abrir(c)}><FolderOpen className="w-4 h-4" /></button>
                          <button type="button" className={iconBtn} title="Descargar PDF" disabled={!!ocupado} onClick={() => pdf(c)}>
                            {ocupado === `${c.id}:pdf` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                          </button>
                          <button type="button" className={iconBtn} title="Enviar al cliente" onClick={() => setEnviando(c)}><Send className="w-4 h-4" /></button>
                          {c.cotizador === 'auna_onco' && (
                            <button type="button" className={iconBtn} title={(c.resumen as { tramite_folio?: string }).tramite_folio ? 'Ver solicitud de emisión' : 'Solicitar emisión'}
                              onClick={() => navigate(`${COTIZADORES.auna_onco.ruta}?cotizacion=${c.id}&emision=1`)}>
                              <FileSignature className="w-4 h-4" />
                            </button>
                          )}
                          <button type="button" className={iconBtn} title="Duplicar" disabled={!!ocupado} onClick={() => duplicar(c)}>
                            {ocupado === `${c.id}:dup` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button type="button" className={`${iconBtn} hover:!text-red-600`} title="Eliminar" disabled={!!ocupado} onClick={() => eliminar(c)}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {enviando && (
        <EnviarCotizacionModal
          cotizacion={enviando}
          nombreAgente={agentes.get(enviando.usuario_id) ?? ''}
          onCerrar={() => setEnviando(null)}
          onEnviado={(msg) => { setEnviando(null); avisar(msg); cargar(); }}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function EnviarCotizacionModal({ cotizacion: c, nombreAgente, onCerrar, onEnviado }: {
  cotizacion: Cotizacion;
  nombreAgente: string;
  onCerrar: () => void;
  onEnviado: (mensaje: string) => void;
}) {
  const [canal, setCanal] = useState<'correo' | 'whatsapp'>(c.cliente_telefono && !c.cliente_email ? 'whatsapp' : 'correo');
  const [email, setEmail] = useState(c.cliente_email ?? '');
  const [telefono, setTelefono] = useState(c.cliente_telefono ?? '');
  // Nota opcional del asesor; el saludo, su nombre y su WhatsApp los pone el servidor.
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destinoValido = canal === 'correo'
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    : telefono.replace(/\D/g, '').length >= 10;

  const enviar = async () => {
    setError(null);
    setEnviando(true);
    try {
      const { blob, nombre } = await pdfDeCotizacion(c);
      const { data, error: err } = await supabase.functions.invoke('enviar-cotizacion', {
        body: {
          cotizacion_id: c.id,
          canal,
          destino: canal === 'correo' ? email.trim() : telefono.trim(),
          mensaje: mensaje.trim(),
          pdf_base64: await aBase64(blob),
          filename: nombre,
        },
      });
      if (err || !data?.success) {
        // invoke() pone el cuerpo de un 4xx/5xx en err.context: ahí viene el motivo.
        let motivo = data?.error as string | undefined;
        if (!motivo && err && 'context' in err) {
          try { motivo = (await (err as { context: Response }).context.json())?.error; } catch { /* sin cuerpo */ }
        }
        throw new Error(motivo || err?.message || 'No se pudo enviar');
      }
      onEnviado(`Cotización ${c.folio} enviada por ${canal === 'correo' ? 'correo' : 'WhatsApp'}`);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 border border-soft dark:border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-white/5">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Enviar cotización {c.folio}</h3>
            <p className="text-xs text-neutral-500">{c.cliente_nombre} · se adjunta el PDF</p>
          </div>
          <button type="button" onClick={onCerrar} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex rounded-lg border border-neutral-200 dark:border-white/10 overflow-hidden">
            {(['correo', 'whatsapp'] as const).map(k => (
              <button key={k} type="button" onClick={() => setCanal(k)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold ${canal === k ? 'bg-accent text-accent-foreground' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}>
                {k === 'correo' ? <Mail className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                {k === 'correo' ? 'Correo' : 'WhatsApp'}
              </button>
            ))}
          </div>
          {canal === 'correo' ? (
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Correo del cliente</label>
              <input type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@correo.com" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">WhatsApp del cliente</label>
              <input type="tel" className={inputCls} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="10 dígitos" />

            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Nota para el cliente <span className="font-normal text-neutral-400">(opcional)</span></label>
            <textarea rows={3} className={inputCls} value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Ej. Te dejo las dos opciones que platicamos." />
          </div>
          <div className="rounded-lg bg-neutral-50 dark:bg-white/[0.03] border border-neutral-100 dark:border-white/5 p-3 text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
            Sale desde <b>Seguwallet</b> ({canal === 'correo' ? 'seguwallet@movi.digital' : 'WhatsApp de Seguwallet'}) con el PDF adjunto. Dice que <b>{nombreAgente || 'el asesor'}</b> le envía la cotización y que puede contactarlo a su WhatsApp a 10 dígitos (el celular de su perfil).
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-3 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <div>{error}</div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-neutral-100 dark:border-white/5">
          <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5">Cancelar</button>
          <button type="button" onClick={enviar} disabled={!destinoValido || enviando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent-hover disabled:opacity-50">
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
