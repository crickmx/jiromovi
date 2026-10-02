// Historial de pagos del Plan Premium de un agente, con su bitácora.
//
// Espejo de los pagos de MOVI Store, con dos diferencias pedidas: un
// Administrador puede corregir el pago que capturó alguien más —en Store solo
// puede quien lo registró—, y toda acción queda en una bitácora que nadie puede
// borrar. Esa bitácora la escribe la base de datos, no esta pantalla: si
// dependiera de aquí, bastaría una pantalla nueva que olvidara llamarla para
// que un movimiento quedara sin rastro.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, History, Loader2, X, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { saldoPremium, pesos, type PlanPremium } from '../../lib/mktPremiumPagos';
import {
  BUCKET_COMPROBANTES, ACCEPT_COMPROBANTE, validarComprobante, rutaComprobante,
} from '../../lib/comprobantePago';

interface PagoRow {
  id: string;
  fecha: string;
  metodo: string;
  monto: string | number;
  comentario: string;
  registrado_por: string | null;
  comprobante_path: string | null;
  comprobante_nombre: string | null;
  registrador?: { nombre_completo: string | null; nombre: string | null } | null;
}

interface LogRow {
  id: string;
  accion: 'alta' | 'edicion' | 'baja';
  hecho_en: string;
  datos_antes: Record<string, unknown> | null;
  datos_despues: Record<string, unknown> | null;
  autor?: { nombre_completo: string | null; nombre: string | null } | null;
}

const METODOS = [
  { value: 'deposito_jiro', label: 'Depósito a cuenta Jiro' },
  { value: 'bono_anual', label: 'Descuento de bono anual' },
  { value: 'comisiones', label: 'Descuento a comisiones' },
  { value: 'otro', label: 'Otro' },
];

const ETIQUETA_METODO = (v: string) => METODOS.find(m => m.value === v)?.label ?? v;

const ACCION_TEXTO: Record<LogRow['accion'], string> = {
  alta: 'Registró un pago',
  edicion: 'Editó un pago',
  baja: 'Eliminó un pago',
};

interface Props {
  usuarioId: string;
  plan: PlanPremium | null;
  /** Solo quien administra Marketing puede capturar o corregir. */
  puedeEditar: boolean;
}

function nombreDe(p?: { nombre_completo: string | null; nombre: string | null } | null): string {
  return p?.nombre_completo || p?.nombre || '—';
}

function soloDia(iso: string): string {
  // 'YYYY-MM-DD' interpretado sin hora se lee en UTC y en México muestra el día
  // anterior; por eso se le pega la hora local.
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}

export function PagosPremiumPanel({ usuarioId, plan, puedeEditar }: Props) {
  const [pagos, setPagos] = useState<PagoRow[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [verLog, setVerLog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState(METODOS[0].value);
  const [monto, setMonto] = useState('');
  const [comentario, setComentario] = useState('');
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('mkt_premium_pagos')
      .select('id, fecha, metodo, monto, comentario, registrado_por, comprobante_path, comprobante_nombre, registrador:usuarios!registrado_por(nombre_completo, nombre)')
      .eq('usuario_id', usuarioId)
      .order('fecha', { ascending: false });
    if (err) setError(err.message);
    setPagos((data ?? []) as unknown as PagoRow[]);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => { cargar(); }, [cargar]);

  const cargarLog = async () => {
    const { data } = await supabase
      .from('mkt_premium_pagos_log')
      .select('id, accion, hecho_en, datos_antes, datos_despues, autor:usuarios!hecho_por(nombre_completo, nombre)')
      .eq('usuario_id', usuarioId)
      .order('hecho_en', { ascending: false })
      .limit(100);
    setLog((data ?? []) as unknown as LogRow[]);
  };

  const abrirLog = async () => {
    const abriendo = !verLog;
    setVerLog(abriendo);
    if (abriendo) await cargarLog();
  };

  const registrar = async () => {
    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor <= 0) { setError('El monto tiene que ser mayor que cero.'); return; }
    if (comprobante) {
      const problema = validarComprobante(comprobante);
      if (problema) { setError(problema); return; }
    }

    setGuardando(true); setError('');
    const { data: sesion } = await supabase.auth.getUser();

    // El id se decide aquí para poder subir el archivo ANTES de insertar: así la
    // fila nace completa y la bitácora registra un alta, no un alta seguida de
    // una edición por el adjunto.
    const pagoId = crypto.randomUUID();
    let path: string | null = null;

    if (comprobante) {
      path = rutaComprobante(usuarioId, pagoId, comprobante.name);
      const { error: errSubida } = await supabase.storage
        .from(BUCKET_COMPROBANTES)
        .upload(path, comprobante, { upsert: true, contentType: comprobante.type || undefined });
      if (errSubida) {
        setGuardando(false);
        setError(`No se pudo subir el comprobante: ${errSubida.message}`);
        return;
      }
    }

    const { error: err } = await supabase.from('mkt_premium_pagos').insert({
      id: pagoId,
      usuario_id: usuarioId,
      fecha,
      metodo,
      monto: valor,
      comentario: comentario.trim(),
      // La política de inserción exige que coincida con quien está en sesión.
      registrado_por: sesion.user?.id ?? null,
      comprobante_path: path,
      comprobante_nombre: comprobante?.name ?? null,
    });

    setGuardando(false);
    if (err) {
      // El archivo ya está arriba y el pago no existe: se limpia para no dejar
      // basura en el bucket.
      if (path) await supabase.storage.from(BUCKET_COMPROBANTES).remove([path]);
      setError(err.message);
      return;
    }
    setMonto(''); setComentario(''); setComprobante(null); setShowForm(false);
    cargar();
    if (verLog) cargarLog();
  };

  /** El bucket es privado: para ver un comprobante hay que firmar la URL. */
  const abrirComprobante = async (p: PagoRow) => {
    if (!p.comprobante_path) return;
    setAbriendo(p.id); setError('');
    const { data, error: err } = await supabase.storage
      .from(BUCKET_COMPROBANTES)
      .createSignedUrl(p.comprobante_path, 120);
    setAbriendo(null);
    if (err || !data?.signedUrl) { setError(err?.message ?? 'No se pudo abrir el comprobante.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const eliminar = async (p: PagoRow) => {
    if (!confirm(`¿Eliminar el pago de ${pesos(Number(p.monto))} del ${soloDia(p.fecha)}?\n\nQueda registrado en la bitácora, y el comprobante se conserva.`)) return;
    const { error: err } = await supabase.from('mkt_premium_pagos').delete().eq('id', p.id);
    if (err) { setError(err.message); return; }
    cargar();
    if (verLog) cargarLog();
  };

  const cuenta = saldoPremium(plan, pagos);

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">Pagos del Premium</p>
          <p className="text-xs text-neutral-500 dark:text-white/55">
            {cuenta.estado === 'sin_plan' ? 'Sin plan asignado'
              : cuenta.estado === 'al_corriente' ? `Al corriente · ${pesos(cuenta.pagado)} de ${pesos(cuenta.esperado)}`
              : cuenta.estado === 'debe' ? `Falta ${pesos(cuenta.saldo)} de ${pesos(cuenta.esperado)}`
              : `Pagó ${pesos(Math.abs(cuenta.saldo))} de más`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={abrirLog}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/10"
          >
            <History className="w-3.5 h-3.5" /> Bitácora
          </button>
          {puedeEditar && (
            <button
              onClick={() => { setShowForm(v => !v); setError(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
            >
              {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showForm ? 'Cancelar' : 'Registrar pago'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {showForm && puedeEditar && (
        <div className="rounded-xl border border-purple-200 dark:border-purple-500/20 bg-purple-50/50 dark:bg-purple-900/10 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-xs text-neutral-600 dark:text-white/60">
            Fecha
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="mt-0.5 w-full px-2.5 py-1.5 text-sm border border-soft dark:border-white/10 rounded-lg bg-surface-card dark:bg-white/5 text-neutral-900 dark:text-white" />
          </label>
          <label className="text-xs text-neutral-600 dark:text-white/60">
            Monto
            <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00"
              className="mt-0.5 w-full px-2.5 py-1.5 text-sm border border-soft dark:border-white/10 rounded-lg bg-surface-card dark:bg-white/5 text-neutral-900 dark:text-white" />
          </label>
          <label className="text-xs text-neutral-600 dark:text-white/60">
            Método
            <select value={metodo} onChange={e => setMetodo(e.target.value)}
              className="mt-0.5 w-full px-2.5 py-1.5 text-sm border border-soft dark:border-white/10 rounded-lg bg-surface-card dark:bg-white/5 text-neutral-900 dark:text-white">
              {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-neutral-600 dark:text-white/60">
            Comentario <span className="text-neutral-500">(opcional)</span>
            <input type="text" value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Ej: parcialidad 2 de 3"
              className="mt-0.5 w-full px-2.5 py-1.5 text-sm border border-soft dark:border-white/10 rounded-lg bg-surface-card dark:bg-white/5 text-neutral-900 dark:text-white" />
          </label>
          <label className="sm:col-span-2 text-xs text-neutral-600 dark:text-white/60">
            Comprobante <span className="text-neutral-500">(opcional — PDF, JPG o PNG, máx. 10 MB)</span>
            <div className="mt-0.5 flex items-center gap-2">
              <input
                type="file"
                accept={ACCEPT_COMPROBANTE}
                onChange={e => { setComprobante(e.target.files?.[0] ?? null); setError(''); }}
                className="flex-1 text-xs file:mr-2 file:px-2.5 file:py-1 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 file:text-xs"
              />
              {comprobante && (
                <button type="button" onClick={() => setComprobante(null)} title="Quitar"
                  className="p-1 rounded hover:bg-white/60 dark:hover:bg-white/10 text-neutral-500 shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </label>

          <div className="sm:col-span-2 flex justify-end">
            <button onClick={registrar} disabled={guardando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-50">
              {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar pago
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-neutral-500 py-2">Cargando pagos…</p>
      ) : pagos.length === 0 ? (
        <p className="text-xs text-neutral-500 py-2">Todavía no hay pagos registrados.</p>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-white/5">
          {pagos.map(p => (
            <div key={p.id} className="py-2 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-900 dark:text-white">
                  {pesos(Number(p.monto))}
                  <span className="text-neutral-500 font-normal"> · {ETIQUETA_METODO(p.metodo)}</span>
                </p>
                <p className="text-[11px] text-neutral-500">
                  {soloDia(p.fecha)} · {nombreDe(p.registrador)}
                  {p.comentario && ` · ${p.comentario}`}
                </p>
              </div>
              {p.comprobante_path && (
                <button
                  onClick={() => abrirComprobante(p)}
                  disabled={abriendo === p.id}
                  title={p.comprobante_nombre ?? 'Ver comprobante'}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 shrink-0 disabled:opacity-50"
                >
                  {abriendo === p.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <FileText className="w-3.5 h-3.5" />}
                  Comprobante
                </button>
              )}
              {puedeEditar && (
                <button onClick={() => eliminar(p)} title="Eliminar"
                  className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-300 hover:text-red-500 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {verLog && (
        <div className="rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 p-3">
          <p className="text-[11px] font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide mb-2">
            Bitácora — no se puede editar ni borrar
          </p>
          {log.length === 0 ? (
            <p className="text-xs text-neutral-500">Sin movimientos registrados.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {log.map(l => {
                const datos = l.datos_despues ?? l.datos_antes ?? {};
                const montoLog = datos.monto != null ? pesos(Number(datos.monto)) : '—';
                return (
                  <div key={l.id} className="text-[11px] text-neutral-600 dark:text-white/60 flex gap-2">
                    <span className={`shrink-0 font-semibold ${
                      l.accion === 'baja' ? 'text-red-600' : l.accion === 'edicion' ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {ACCION_TEXTO[l.accion]}
                    </span>
                    <span className="min-w-0">
                      {montoLog} · {nombreDe(l.autor)} ·{' '}
                      {new Date(l.hecho_en).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PagosPremiumPanel;
