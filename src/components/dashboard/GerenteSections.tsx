import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Usuario } from '../../contexts/MoviAuthContext';
import { useMiResumen } from '../../lib/useMiResumen';

function money(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('rounded-lg bg-surface-muted dark:bg-white/10 shimmer', className)} />;
}

type TicketAbierto = {
  id: string;
  folio: string;
  tipo_tramite: string;
  custom_estatus_label?: string | null;
  created_at: string;
  agente_id?: string | null;
  ticket_tipos?: { label: string } | null;
  _agente_nombre?: string;
};

// ── Panel wrapper ──────────────────────────────────────────────────────────

function Panel({
  stripe, eyebrow, title, desc, children,
}: {
  stripe: string; eyebrow: string; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-card border border-soft rounded-[var(--radius-lg)] shadow-card overflow-hidden flex flex-col transition-[box-shadow,transform] duration-base ease-smooth hover:shadow-card-hover hover:-translate-y-0.5">
      <div className={cn('h-1 w-full', stripe)} />
      <div className="px-4 pt-4 pb-3 border-b border-soft">
        <p className="movi-eyebrow text-neutral-500 dark:text-white/50 mb-1">{eyebrow}</p>
        <p className="font-display text-title-sm font-semibold text-neutral-900 dark:text-white leading-tight">{title}</p>
        <p className="text-xs text-neutral-600 dark:text-white/55 mt-0.5">{desc}</p>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-3">{children}</div>
    </div>
  );
}

// ── Utilidades ─────────────────────────────────────────────────────────────

function nivelChip(nivel: string) {
  const n = nivel.toUpperCase();
  if (n.includes('ORO') || n.includes('MAX') || n.includes('MÁX'))
    return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">🥇 {nivel}</span>;
  if (n.includes('PLATA'))
    return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/60">🥈 {nivel}</span>;
  if (n.includes('BRONCE'))
    return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">⭐ {nivel}</span>;
  return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 dark:bg-white/8 dark:text-white/50">En camino</span>;
}

function estatusChip(label?: string | null) {
  if (!label) return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50">Activo</span>;
  const lc = label.toLowerCase();
  if (lc.includes('complet') || lc.includes('termin'))
    return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">{label}</span>;
  if (lc.includes('urgente') || lc.includes('bloqueado'))
    return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">{label}</span>;
  if (lc.includes('revis') || lc.includes('espera') || lc.includes('pendient'))
    return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">{label}</span>;
  return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400">{label}</span>;
}

// ── Producción panel ───────────────────────────────────────
// Los mismos tres indicadores que la pantalla de inicio de Central de
// Producción, acotados a la oficina del gerente. La definición vive allá
// (`_kpi_agg`, apps/reporting/views.py): prima neta es el total pagado,
// convenio la parte bajo acuerdo con la aseguradora, y no convenio la resta.

function Delta({ pct }: { pct?: number | null }) {
  if (pct == null) return null;
  return (
    <p className={cn('text-[11px] font-semibold mt-1', pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
      {pct >= 0 ? '↑ +' : '↓ '}{pct}% vs año anterior
    </p>
  );
}

/** '—' y no $0 cuando bonos aún no manda el dato: cero es un número, no un hueco. */
function monto(n?: number | null) {
  return n == null ? '—' : money(n);
}

function ProduccionPanel() {
  const data = useMiResumen();

  const prod =
    data !== 'loading' && data !== 'error' && data.vinculado && data.aplica !== false
      ? data.produccion
      : null;

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#065F46] to-[#10B981]"
      eyebrow="Central de producción"
      title="Producción"
      desc="Prima pagada de tu oficina en el año"
    >
      {data === 'loading' ? (
        <><Sk className="h-20" /><Sk className="h-16" /><Sk className="h-10" /></>
      ) : !prod ? (
        <p className="text-xs text-neutral-500 dark:text-white/50 text-center py-6">Sin datos de producción</p>
      ) : (
        <>
          <div className="bg-surface-muted dark:bg-white/5 rounded-2xl p-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-neutral-500 dark:text-white/50">Prima neta</p>
            <p className="text-[10.5px] text-neutral-400 dark:text-white/40 mb-1">convenio + no convenio</p>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {monto(prod.prima_neta_actual)}
            </p>
            <Delta pct={prod.delta_neta_pct} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface-muted dark:bg-white/5 rounded-2xl p-3">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-neutral-500 dark:text-white/50 mb-1">De convenio</p>
              <p className="text-base font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">{monto(prod.prima_conv_actual)}</p>
              <Delta pct={prod.delta_pct} />
            </div>
            <div className="bg-surface-muted dark:bg-white/5 rounded-2xl p-3">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-neutral-500 dark:text-white/50 mb-1">No convenio</p>
              <p className="text-base font-extrabold text-neutral-700 dark:text-white/80 tabular-nums">{monto(prod.prima_no_conv_actual)}</p>
              <Delta pct={prod.delta_no_conv_pct} />
            </div>
          </div>

          {prod.meta_monto != null && (
            <div className="mt-auto pt-1">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-neutral-500 dark:text-white/55">Meta anual de oficina</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{prod.meta_pct}%</span>
              </div>
              <div className="h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, prod.meta_pct ?? 0)}%`, background: 'linear-gradient(90deg,#059669,#34D399)' }} />
              </div>
              <p className="text-[10.5px] text-neutral-400 dark:text-white/40 mt-1">Meta {money(prod.meta_monto)}</p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}


// ── Convención panel ─────────────────────────────────────
// Los 5 de mayor prima PONDERADA del equipo — que es con la que se mide la
// convención, no con la prima a secas (TablaPonderacion en bonos). Van los
// cinco primeros aunque todavía no alcancen nivel: el gerente necesita ver a
// quién le falta poco, no solo a quien ya llegó.

function MetasPanel() {
  const data = useMiResumen();

  const ce =
    data !== 'loading' && data !== 'error' && data.vinculado && data.aplica !== false
      ? data.convencion_equipo
      : null;

  const top = ce?.top ?? [];

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#0284C7] to-[#38BDF8]"
      eyebrow="Convención · oficina"
      title="Top 5 del equipo"
      desc="Mayor producción ponderada y su nivel"
    >
      {data === 'loading' ? (
        <><Sk className="h-12" /><Sk className="h-12" /><Sk className="h-12" /><Sk className="h-12" /></>
      ) : !ce ? (
        <p className="text-xs text-neutral-500 dark:text-white/50 text-center py-6">Sin datos de convención del equipo</p>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{ce.en_convencion.length}</span>
            <span className="text-[11px] text-neutral-500 dark:text-white/50">de {ce.total_vendedores} ejecutivos ya en convención</span>
          </div>

          {top.length === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-white/50 text-center py-6">
              Sin producción registrada en el periodo
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {top.map((v, i) => (
                <div
                  key={v.entity}
                  className="px-3 py-2 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/8"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full grid place-items-center text-[10.5px] font-bold text-white flex-shrink-0 bg-sky-600 dark:bg-sky-500">
                      {i + 1}
                    </span>
                    <p className="flex-1 min-w-0 text-[12px] font-bold text-neutral-900 dark:text-white truncate">{v.entity}</p>
                    {nivelChip(v.nivel_conv)}
                  </div>
                  <div className="flex items-baseline justify-between mt-1 pl-7">
                    <span className="text-[11px] font-semibold text-neutral-700 dark:text-white/70 tabular-nums">{money(v.prima_pond)}</span>
                    <span className="text-[11px] text-neutral-500 dark:text-white/50">
                      {v.sig_conv ? <>falta {money(v.falta_conv)} para {v.sig_conv}</> : 'nivel máximo'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden mt-1.5 ml-7">
                    <div className="h-full rounded-full" style={{ width: `${v.pct_conv}%`, background: 'linear-gradient(90deg,#0284c7,#38bdf8)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}


// ── Solicitudes panel ──────────────────────────────────────────────────────

function SolicitudesPanel({ usuario }: { usuario: Usuario }) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketAbierto[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ urgentes: 0, total: 0 });

  useEffect(() => {
    let active = true;
    const HORA_MS = 3_600_000;
    const ahora = Date.now();

    async function load() {
      if (!usuario.oficina_id) { setLoading(false); return; }

      const { data: users } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos')
        .eq('rol', 'Ejecutivo')
        .eq('oficina_id', usuario.oficina_id);

      if (!active || !users?.length) { setLoading(false); return; }

      const ids = users.map(u => u.id);
      const nameMap = new Map(users.map(u => [u.id, `${u.nombre} ${u.apellidos}`]));

      const { data: raw } = await supabase
        .from('tickets')
        .select('id, folio, tipo_tramite, custom_estatus_label, created_at, agente_id, ticket_tipos(label)')
        .in('agente_id', ids)
        .is('cerrado_en', null)
        .order('created_at', { ascending: true })
        .limit(10);

      if (!active) return;

      const list = (raw ?? []).map(t => ({
        ...(t as unknown as TicketAbierto),
        _agente_nombre: t.agente_id ? (nameMap.get(t.agente_id) ?? '—') : '—',
      }));

      const urgentes = list.filter(t => ahora - new Date(t.created_at).getTime() > 24 * HORA_MS).length;
      setTickets(list);
      setCounts({ urgentes, total: list.length });
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, [usuario.id, usuario.oficina_id]);

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]"
      eyebrow="De tu equipo"
      title="Solicitudes"
      desc="Trámites abiertos de la oficina"
    >
      {loading ? (
        <><Sk className="h-8" /><Sk className="h-10" /><Sk className="h-10" /><Sk className="h-10" /></>
      ) : (
        <>
          {/* Summary chips */}
          <div className="flex gap-2 flex-wrap">
            {counts.urgentes > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                🔴 {counts.urgentes} urgente{counts.urgentes !== 1 ? 's' : ''}
              </span>
            )}
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 dark:bg-white/8 dark:text-white/50">
              {counts.total} abierto{counts.total !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Ticket list */}
          {tickets.length > 0 ? (
            <div className="flex flex-col">
              {tickets.map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/tramites/${t.id}`)}
                  className="flex items-start justify-between gap-2 py-2.5 border-b last:border-0 border-neutral-100 dark:border-white/6 text-left hover:bg-neutral-50 dark:hover:bg-white/3 -mx-1 px-1 rounded transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-neutral-900 dark:text-white font-variant-numeric tabular-nums">{t.folio}</p>
                    <p className="text-[11px] text-neutral-500 dark:text-white/50 truncate">
                      {(t.ticket_tipos as { label: string } | null)?.label ?? t.tipo_tramite}
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-white/55 mt-0.5">👤 {t._agente_nombre}</p>
                  </div>
                  {estatusChip(t.custom_estatus_label)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-500 dark:text-white/50 text-center py-4">Sin solicitudes abiertas</p>
          )}

          <button
            onClick={() => navigate('/tramites')}
            className="flex items-center gap-3 w-full bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/8 border border-neutral-200 dark:border-white/10 rounded-xl p-3 text-left transition-colors mt-1"
          >
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 grid place-items-center shrink-0 text-sm">📋</div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-neutral-900 dark:text-white">Ver todas las solicitudes</p>
              <p className="text-[11px] text-neutral-500 dark:text-white/50">Bandeja completa de la oficina</p>
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-500 dark:text-white/45 shrink-0" />
          </button>
        </>
      )}
    </Panel>
  );
}

// ── Exported component ─────────────────────────────────────────────────────

export function GerenteSections({ usuario }: { usuario: Usuario }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-soft dark:border-white/15 bg-surface-card dark:bg-white/5 grid place-items-center text-base">
          🏦
        </div>
        <div>
          <p className="font-display text-title font-semibold text-neutral-900 dark:text-white leading-tight">Gerente</p>
          <p className="text-xs text-neutral-500 dark:text-white/50">Vista de tu sucursal</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 movi-stagger">
        <ProduccionPanel />
        <MetasPanel />
        <SolicitudesPanel usuario={usuario} />
      </div>
    </div>
  );
}
