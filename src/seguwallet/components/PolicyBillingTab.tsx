import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, AlertTriangle, CheckCircle, Clock, Ban,
  Calendar, DollarSign, RefreshCw, Phone, ChevronRight,
  Info, Wifi,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAgentBrand } from '../lib/AgentBrandContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingRecord {
  id_documento: string | null;
  no_poliza: string | null;
  cliente: string | null;
  importe: number | null;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  fecha_vencimiento: string | null;
  fecha_pago: string | null;
  status: string | null;
  forma_pago: string | null;
  moneda: string | null;
  serie: string | null;
  dias_vencidos: number | null;
  referencia: string | null;
}

type BillingStatus = 'al_corriente' | 'pendiente' | 'vencido' | 'sin_info';

interface BillingSummary {
  billing_status: BillingStatus;
  total_records: number;
  paid_count: number;
  pending_count: number;
  overdue_count: number;
  next_due_date: string | null;
  next_due_amount: number | null;
  next_due_days: number | null;
  total_paid: number;
  total_pending: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(s: string | null | undefined) {
  if (!s) return null;
  try {
    return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return s; }
}

function fmtMoney(n: number | null | undefined, moneda?: string | null) {
  if (n == null) return null;
  const suffix = moneda && moneda !== 'MXN' && moneda !== 'Pesos' ? ` ${moneda}` : '';
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
}

function getDaysRemaining(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

type ReceiptClass = 'pagado' | 'vencido' | 'pendiente' | 'programado' | 'cancelado';

function classifyStatus(record: BillingRecord): ReceiptClass {
  const s = (record.status || '').toLowerCase();
  if (s.includes('pagado') || s.includes('liquidado') || s.includes('cobrado')) return 'pagado';
  if (s.includes('cancel')) return 'cancelado';
  const daysOver = record.dias_vencidos ?? 0;
  if (daysOver > 0) return 'vencido';
  // If there is a vencimiento date and it's in the past
  if (record.fecha_vencimiento) {
    const remaining = getDaysRemaining(record.fecha_vencimiento);
    if (remaining !== null && remaining < 0) return 'vencido';
    if (remaining !== null && remaining >= 0) return remaining === 0 ? 'pendiente' : 'programado';
  }
  return 'pendiente';
}

function buildSummary(records: BillingRecord[]): BillingSummary {
  let paid = 0, pending = 0, overdue = 0;
  let totalPaid = 0, totalPending = 0;
  let nextDate: string | null = null;
  let nextAmount: number | null = null;

  for (const r of records) {
    const cls = classifyStatus(r);
    const importe = r.importe ?? 0;

    if (cls === 'pagado') {
      paid++;
      totalPaid += importe;
    } else if (cls === 'vencido') {
      overdue++;
      totalPending += importe;
    } else if (cls === 'pendiente' || cls === 'programado') {
      pending++;
      totalPending += importe;
      const dueDate = r.fecha_vencimiento;
      if (dueDate && (!nextDate || new Date(dueDate) < new Date(nextDate))) {
        nextDate = dueDate;
        nextAmount = importe;
      }
    }
  }

  let billing_status: BillingStatus = 'sin_info';
  if (records.length > 0) {
    if (overdue > 0) billing_status = 'vencido';
    else if (pending > 0) billing_status = 'pendiente';
    else billing_status = 'al_corriente';
  }

  return {
    billing_status,
    total_records: records.length,
    paid_count: paid,
    pending_count: pending,
    overdue_count: overdue,
    next_due_date: nextDate,
    next_due_amount: nextAmount,
    next_due_days: nextDate ? getDaysRemaining(nextDate) : null,
    total_paid: totalPaid,
    total_pending: totalPending,
  };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReceiptClass }) {
  const map: Record<ReceiptClass, { label: string; cls: string }> = {
    pagado:     { label: 'Pagado',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    vencido:    { label: 'Vencido',     cls: 'bg-red-50 text-red-700 border-red-200' },
    pendiente:  { label: 'Pendiente',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    programado: { label: 'Programado',  cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    cancelado:  { label: 'Cancelado',   cls: 'bg-neutral-100 text-neutral-500 border-neutral-200' },
  };
  const cfg = map[status];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border leading-none', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function StatCell({ label, value, color }: { label: string; value: string; color?: 'emerald' | 'amber' | 'red' }) {
  return (
    <div className="bg-white/70 rounded-xl p-2.5">
      <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">{label}</p>
      <p className={cn('text-lg font-bold mt-0.5 leading-none',
        color === 'emerald' ? 'text-emerald-700'
        : color === 'amber' ? 'text-amber-700'
        : color === 'red' ? 'text-red-700'
        : 'text-neutral-900'
      )}>{value}</p>
    </div>
  );
}

function BillingSummaryCard({ summary, primary, onContactAgent }: {
  summary: BillingSummary; primary: string; onContactAgent: () => void;
}) {
  const cfg = {
    al_corriente: { icon: CheckCircle, label: 'Al corriente', desc: 'No tienes pagos pendientes ni vencidos.', cls: 'bg-emerald-50 border-emerald-200', iconCls: 'text-emerald-600', textCls: 'text-emerald-800' },
    pendiente:    { icon: Clock,        label: 'Tienes pagos pendientes', desc: 'Hay recibos por vencer. Evita cargos adicionales.', cls: 'bg-amber-50 border-amber-200', iconCls: 'text-amber-600', textCls: 'text-amber-800' },
    vencido:      { icon: AlertTriangle, label: 'Tienes pagos vencidos', desc: 'Contacta a tu agente para evitar afectaciones en tu cobertura.', cls: 'bg-red-50 border-red-200', iconCls: 'text-red-600', textCls: 'text-red-800' },
    sin_info:     { icon: Info,          label: 'Sin informacion', desc: 'No se encontro informacion de cobranza para esta poliza.', cls: 'bg-neutral-50 border-neutral-200', iconCls: 'text-neutral-400', textCls: 'text-neutral-600' },
  }[summary.billing_status];

  const IconComp = cfg.icon;

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3', cfg.cls)}>
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-xl bg-white/70 flex-shrink-0')}>
          <IconComp className={cn('w-4 h-4', cfg.iconCls)} />
        </div>
        <div>
          <p className={cn('font-bold text-sm', cfg.textCls)}>{cfg.label}</p>
          <p className={cn('text-xs mt-0.5 opacity-80', cfg.textCls)}>{cfg.desc}</p>
        </div>
      </div>

      {summary.billing_status === 'vencido' && (
        <button
          onClick={onContactAgent}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-all"
        >
          <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />Contactar a mi agente</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-70" />
        </button>
      )}

      {summary.total_records > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <StatCell label="Total recibos" value={String(summary.total_records)} />
          <StatCell label="Pagados" value={String(summary.paid_count)} color="emerald" />
          <StatCell label="Pendientes" value={String(summary.pending_count)} color="amber" />
          <StatCell label="Vencidos" value={String(summary.overdue_count)} color="red" />
        </div>
      )}

      {summary.total_records > 0 && (summary.total_paid > 0 || summary.total_pending > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {summary.total_paid > 0 && (
            <div className="bg-white/70 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Total pagado</p>
              <p className="text-sm font-bold text-emerald-700 mt-0.5">{fmtMoney(summary.total_paid)}</p>
            </div>
          )}
          {summary.total_pending > 0 && (
            <div className="bg-white/70 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Total pendiente</p>
              <p className="text-sm font-bold text-amber-700 mt-0.5">{fmtMoney(summary.total_pending)}</p>
            </div>
          )}
        </div>
      )}

      {summary.next_due_date && (
        <div className="bg-white/80 rounded-xl border border-white p-3">
          <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">Proximo pago</p>
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-1.5 text-sm font-bold text-neutral-900">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              {fmt(summary.next_due_date)}
            </div>
            {summary.next_due_amount != null && (
              <span className="text-sm font-bold" style={{ color: primary }}>
                {fmtMoney(summary.next_due_amount)}
              </span>
            )}
          </div>
          {summary.next_due_days !== null && (
            <p className="text-[11px] text-neutral-500 mt-1">
              {summary.next_due_days > 0
                ? `Faltan ${summary.next_due_days} dia${summary.next_due_days !== 1 ? 's' : ''}`
                : summary.next_due_days === 0 ? 'Vence hoy'
                : `Vencio hace ${Math.abs(summary.next_due_days)} dia${Math.abs(summary.next_due_days) !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Receipt Row ─────────────────────────────────────────────────────────────

function ReceiptRow({ record, isLast }: { record: BillingRecord; isLast: boolean }) {
  const cls = classifyStatus(record);
  const importe = record.importe;
  const daysOver = record.dias_vencidos ?? 0;

  const iconEl = cls === 'pagado'    ? <CheckCircle className="w-4 h-4 text-emerald-500" />
    : cls === 'vencido'              ? <AlertTriangle className="w-4 h-4 text-red-500" />
    : cls === 'pendiente'            ? <Clock className="w-4 h-4 text-amber-500" />
    : cls === 'programado'           ? <Calendar className="w-4 h-4 text-sky-500" />
    : <Ban className="w-4 h-4 text-neutral-400" />;

  const iconBg = cls === 'pagado' ? 'bg-emerald-50' : cls === 'vencido' ? 'bg-red-50'
    : cls === 'pendiente' ? 'bg-amber-50' : cls === 'programado' ? 'bg-sky-50' : 'bg-neutral-100';

  // Prefer fecha_vencimiento for display, fallback to fecha_hasta
  const displayDate = record.fecha_vencimiento || record.fecha_hasta;

  return (
    <div className={cn('px-4 py-3 flex items-start gap-3', !isLast && 'border-b border-neutral-100')}>
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', iconBg)}>
        {iconEl}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {/* Reference number */}
            {(record.id_documento || record.serie) && (
              <p className="text-xs font-bold text-neutral-800 truncate font-mono">
                {record.serie ? `${record.serie}` : ''}{record.id_documento ? ` #${record.id_documento}` : ''}
              </p>
            )}
            {/* Period covered */}
            {(record.fecha_desde || record.fecha_hasta) && (
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {fmt(record.fecha_desde)}{record.fecha_hasta ? ` — ${fmt(record.fecha_hasta)}` : ''}
              </p>
            )}
            {/* Due date */}
            {displayDate && (
              <p className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                Vence: {fmt(displayDate)}
                {daysOver > 0 && (
                  <span className="text-red-500 font-semibold ml-1">({daysOver}d vencido)</span>
                )}
              </p>
            )}
            {/* Payment date */}
            {record.fecha_pago && (
              <p className="text-[11px] text-emerald-600 mt-0.5 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 flex-shrink-0" />
                Pagado: {fmt(record.fecha_pago)}
              </p>
            )}
            {/* Payment reference */}
            {record.referencia && (
              <p className="text-[11px] text-neutral-400 mt-0.5">Ref: {record.referencia}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0 space-y-1">
            <StatusBadge status={cls} />
            {importe != null && importe > 0 && (
              <p className={cn('text-sm font-bold',
                cls === 'vencido' ? 'text-red-600'
                : cls === 'pendiente' || cls === 'programado' ? 'text-amber-700'
                : 'text-neutral-700')}>
                {fmtMoney(importe, record.moneda)}
              </p>
            )}
            {record.forma_pago && (
              <p className="text-[10px] text-neutral-400">{record.forma_pago}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PolicyBillingTabProps {
  poliza: string;
  idDocto: string | null;
  onContactAgent: () => void;
}

export function PolicyBillingTab({ poliza, idDocto, onContactAgent }: PolicyBillingTabProps) {
  const { brand } = useAgentBrand();
  const primary = brand.primaryColor;

  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('no_session');

      console.log('[PolicyBilling] querying billing for poliza:', poliza, 'id_docto:', idDocto);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seguwallet-get-policy-billing`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ poliza, id_docto: idDocto }),
        }
      );

      const data = await res.json();
      console.log('[PolicyBilling] response source:', data.source, 'records:', data.receipts?.length ?? 0);

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const rows = (data.receipts || []) as BillingRecord[];
      setRecords(rows);
      setSummary(buildSummary(rows));
      setSource(data.source || null);
    } catch (err: any) {
      console.error('[PolicyBilling] error:', err);
      setErrorMsg(err?.message || 'Error desconocido');
      setRecords([]);
      setSummary(buildSummary([]));
    } finally {
      setLoading(false);
    }
  }, [poliza, idDocto]);

  useEffect(() => { load(); }, [load]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-40 bg-neutral-100 rounded-2xl animate-pulse" />
        <div className="h-20 bg-neutral-100 rounded-2xl animate-pulse" />
        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-neutral-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (errorMsg && records.length === 0) {
    const isTimeout = errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('45 seg');
    return (
      <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-8 text-center">
        {isTimeout
          ? <Wifi className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
          : <DollarSign className="w-8 h-8 text-neutral-300 mx-auto mb-3" />}
        <p className="text-sm font-semibold text-neutral-600">
          {isTimeout ? 'SICAS tardo demasiado en responder' : 'No se pudo consultar la cobranza'}
        </p>
        <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
          {isTimeout
            ? 'El servidor SICAS puede estar ocupado. Intenta en unos momentos.'
            : 'Por el momento no es posible consultar la cobranza de esta poliza.'}
        </p>
        <button
          onClick={load}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      </div>
    );
  }

  // ── No data (SICAS returned 0 receipts) ───────────────────────────────────
  if (summary && summary.total_records === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-8 text-center">
          <DollarSign className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-500">Sin recibos disponibles</p>
          <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
            {source === 'sicas_unavailable'
              ? 'El servicio de cobranza de SICAS no esta disponible en este momento.'
              : 'No se encontraron recibos asociados a esta poliza en el sistema.'}
          </p>
          <button
            onClick={load}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  // ── Data ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <BillingSummaryCard summary={summary} primary={primary} onContactAgent={onContactAgent} />

      <div className="bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <CreditCard className="w-3.5 h-3.5 text-neutral-500" />
            <p className="text-xs font-bold text-neutral-700 uppercase tracking-wide">Historial de recibos</p>
            <span className="text-[10px] text-neutral-400">({records.length})</span>
          </div>
          <button
            onClick={load}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-all"
            title="Actualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div>
          {records.map((r, idx) => (
            <ReceiptRow key={`${r.id_documento}-${idx}`} record={r} isLast={idx === records.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
