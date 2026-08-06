import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Usuario } from '../../contexts/MoviAuthContext';
import { useMiResumen } from '../../lib/useMiResumen';

function money(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-neutral-200 dark:bg-white/10', className)} />;
}

type TramiteReciente = {
  id: string;
  folio: string;
  tipo_tramite: string;
  custom_estatus_label?: string | null;
  created_at: string;
  ticket_tipos?: { label: string } | null;
};

// ── Panel wrapper ──────────────────────────────────────────────────────────

function Panel({
  stripe, eyebrow, title, desc, children,
}: {
  stripe: string; eyebrow: string; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col">
      <div className={cn('h-1 w-full', stripe)} />
      <div className="px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-white/8">
        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 dark:text-white/35 mb-1">
          {eyebrow}
        </p>
        <p className="text-base font-extrabold text-neutral-900 dark:text-white leading-tight">{title}</p>
        <p className="text-[11px] text-neutral-500 dark:text-white/40 mt-0.5">{desc}</p>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function StatBox({
  label, value, sub, subColor,
}: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3">
      <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400 dark:text-white/35 mb-1">
        {label}
      </p>
      <p className="text-lg font-extrabold text-neutral-900 dark:text-white font-variant-numeric tabular-nums">
        {value}
      </p>
      {sub && <p className={cn('text-[10px] font-semibold mt-1', subColor)}>{sub}</p>}
    </div>
  );
}

// ── Producción ─────────────────────────────────────────────────────────────

function ProduccionPanel() {
  const data = useMiResumen();

  const content =
    data !== 'loading' && data !== 'error' && data.vinculado && data.aplica !== false ? data : null;

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#1B3A6B] to-[#3B60C4]"
      eyebrow="Módulo"
      title="Producción"
      desc="Prima convenio individual"
    >
      {data === 'loading' ? (
        <><Sk className="h-16" /><Sk className="h-16 mt-1" /><Sk className="h-32 mt-1" /></>
      ) : content?.produccion ? (
        <>
          <StatBox
            label="Prima convenio (año)"
            value={money(content.produccion.prima_conv_actual)}
            sub={
              content.produccion.delta_pct != null
                ? `${content.produccion.delta_pct >= 0 ? '↑ +' : '↓ '}${content.produccion.delta_pct}% vs año anterior`
                : undefined
            }
            subColor={
              content.produccion.delta_pct != null && content.produccion.delta_pct >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-500'
            }
          />

          {content.produccion.meta_monto != null && (
            <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400 dark:text-white/35 mb-1">
                Meta {content.produccion.meta_pct != null ? `(${content.produccion.meta_pct}%)` : ''}
              </p>
              <p className="text-lg font-extrabold text-neutral-900 dark:text-white">
                {money(content.produccion.meta_monto)}
              </p>
              <div className="w-full h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, content.produccion.meta_pct ?? 0)}%`,
                    background: 'linear-gradient(90deg,#E84F8A,#8E1A52)',
                  }}
                />
              </div>
              <p className="text-right text-[10px] text-neutral-400 dark:text-white/35 mt-1">
                {content.produccion.meta_pct}% alcanzado
              </p>
            </div>
          )}

          {(content.renovaciones ?? []).length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 dark:text-white/35 mb-2 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Próximas renovaciones
              </p>
              <div>
                {(content.renovaciones ?? []).slice(0, 4).map(r => (
                  <div
                    key={r.numero_poliza}
                    className="flex items-center justify-between py-2 border-b last:border-0 border-neutral-100 dark:border-white/6"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-neutral-800 dark:text-white/80 truncate">
                        {r.asegurado || '—'}
                      </p>
                      <p className="text-[10px] text-neutral-400 dark:text-white/35">
                        {r.ramo} · {r.compania}
                      </p>
                    </div>
                    <span className="text-[11px] text-neutral-400 dark:text-white/40 ml-2 shrink-0">
                      {new Date(r.fecha_fin).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-neutral-400 dark:text-white/35 text-center py-6">Sin datos de producción</p>
      )}
    </Panel>
  );
}

// ── Metas ──────────────────────────────────────────────────────────────────

function MetasPanel() {
  const data = useMiResumen();

  const c =
    data !== 'loading' && data !== 'error' && data.vinculado && data.aplica !== false
      ? data.convencion
      : null;

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#0EA5E9] to-[#38BDF8]"
      eyebrow="Módulo"
      title="Metas"
      desc="Convención y objetivos"
    >
      {data === 'loading' ? (
        <><Sk className="h-16" /><Sk className="h-8 mt-1" /><Sk className="h-16 mt-1" /></>
      ) : c ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400 dark:text-white/35 mb-1">
                Nivel actual
              </p>
              <p className="text-xl font-extrabold text-sky-600 dark:text-sky-400">
                {c.nivel === 'NO CONVENCIONISTA' ? 'EN CAMINO' : c.nivel}
              </p>
            </div>
            {c.nivel !== 'NO CONVENCIONISTA' && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-100 dark:bg-white/8 text-neutral-600 dark:text-white/60">
                {c.nivel.includes('ORO') ? '🥇' : c.nivel.includes('PLATA') ? '🥈' : '⭐'} {c.nivel}
              </span>
            )}
          </div>

          <StatBox label="Prima acumulada" value={money(c.prima_acum)} />

          {c.steps.length > 0 && (
            <div className="flex gap-1.5">
              {c.steps.map(s => (
                <div key={s.name} className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'h-1 rounded-full mb-1',
                      s.status === 'done'
                        ? 'bg-emerald-500'
                        : s.status === 'active'
                        ? 'bg-sky-500'
                        : 'bg-neutral-200 dark:bg-white/10',
                    )}
                  />
                  <p
                    className={cn(
                      'text-[9px] truncate',
                      s.status === 'done'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : s.status === 'active'
                        ? 'text-sky-600 dark:text-sky-400 font-bold'
                        : 'text-neutral-400',
                    )}
                  >
                    {s.status === 'done' ? '✓ ' : s.status === 'active' ? '● ' : '○ '}
                    {s.name}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!c.maximo && c.siguiente ? (
            <>
              <div className="bg-sky-50 dark:bg-sky-950/20 border-l-[3px] border-sky-500 rounded-r-xl p-2.5">
                <p className="text-[10px] text-neutral-500 dark:text-white/40">Falta para {c.siguiente}</p>
                <p className="text-base font-extrabold text-sky-600 dark:text-sky-400">{money(c.falta)}</p>
              </div>
              <div>
                <div className="h-1.5 bg-sky-100 dark:bg-sky-950/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${c.pct}%`, background: 'linear-gradient(90deg,#0284c7,#38bdf8)' }}
                  />
                </div>
                <p className="text-right text-[10px] font-semibold text-sky-600 dark:text-sky-400 mt-1">
                  {Math.round(c.pct)}% hacia {c.siguiente}
                </p>
              </div>
            </>
          ) : c.maximo ? (
            <div className="bg-amber-50 dark:bg-amber-950/20 border-l-[3px] border-amber-500 rounded-r-xl p-2.5">
              <p className="text-[13px] font-bold text-amber-700 dark:text-amber-400">
                🏆 ¡Nivel máximo alcanzado!
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-neutral-400 dark:text-white/35 text-center py-6">Sin datos de convención</p>
      )}

      {/* Beach convention banner */}
      <div
        className="-mx-4 -mb-4 h-[48px] flex items-center justify-between px-4"
        style={{ background: 'linear-gradient(160deg,#0c4a6e 0%,#0369a1 30%,#38bdf8 65%,#fde68a 100%)' }}
      >
        <span className="text-lg">🌴</span>
        <div className="text-center">
          <p className="text-[8px] font-semibold uppercase tracking-widest text-white/65">¡tu próximo destino!</p>
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-white">
            Convención {new Date().getFullYear()}
          </p>
        </div>
        <span className="text-lg">✈️</span>
      </div>
    </Panel>
  );
}

// ── Campaña ────────────────────────────────────────────────────────────────

function CampanaPanel() {
  const data = useMiResumen();

  const campanias =
    data !== 'loading' && data !== 'error' && data.vinculado && data.aplica !== false
      ? (data.campanias ?? [])
      : [];
  const cd = campanias[0] ?? null;

  function diasColor(d: number) {
    if (d <= 7) return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
    if (d <= 15) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
  }

  function medalla(r: number) {
    return r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null;
  }

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#D946A8] to-[#8E1A52]"
      eyebrow="Activa"
      title="Campaña"
      desc="Ranking en tiempo real"
    >
      {data === 'loading' ? (
        <><Sk className="h-16" /><Sk className="h-40 mt-1" /></>
      ) : cd ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-white/35">
                Campaña
              </p>
              <p className="text-sm font-extrabold text-neutral-900 dark:text-white mt-0.5 truncate">
                🏆 {cd.nombre}
              </p>
              <p className="text-[10px] text-neutral-400 dark:text-white/35 mt-0.5">
                {cd.total_participantes} participantes
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold',
                diasColor(cd.dias_restantes),
              )}
            >
              <Clock className="w-3 h-3" />
              {cd.dias_restantes}d
            </span>
          </div>

          {cd.group_rows.length > 0 ? (
            <div className="space-y-1">
              {cd.group_rows.map(gr => (
                <div key={`${gr.entity_name}-${gr.rank}`}>
                  {gr.prev && (
                    <div className="flex items-center gap-2 px-2 py-1.5 opacity-40">
                      <div className="w-7 text-center text-[11px] text-neutral-400">#{gr.prev.rank}</div>
                      <p className="flex-1 text-[11px] text-neutral-500 truncate">{gr.prev.entity_name}</p>
                      <p className="text-[11px] text-neutral-400">{money(gr.prev.prima_ponderada)}</p>
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex items-center gap-2 px-2 py-2 rounded-lg border-l-[3px]',
                      gr.is_me
                        ? 'bg-gradient-to-br from-indigo-50 to-sky-50 dark:from-indigo-950/20 dark:to-sky-950/20 border-l-indigo-500'
                        : 'bg-neutral-50 dark:bg-white/5 border-l-neutral-200 dark:border-l-white/15',
                    )}
                  >
                    <div className="w-7 text-center shrink-0">
                      {medalla(gr.rank) ? (
                        <span className="text-sm">{medalla(gr.rank)}</span>
                      ) : (
                        <span className="text-[12px] font-bold text-neutral-600 dark:text-neutral-300">
                          #{gr.rank}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-neutral-900 dark:text-white truncate">
                        {gr.entity_name}
                        {gr.is_me && (
                          <span className="text-[10px] font-normal text-indigo-500 ml-1">← tú</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-bold text-neutral-800 dark:text-white">
                        {money(gr.prima_ponderada)}
                      </p>
                      {gr.avance_pct != null && (
                        <p
                          className={cn(
                            'text-[10px] font-semibold',
                            gr.avance_pct >= 100
                              ? 'text-emerald-500'
                              : gr.avance_pct >= 75
                              ? 'text-sky-500'
                              : gr.avance_pct >= 50
                              ? 'text-amber-500'
                              : 'text-red-500',
                          )}
                        >
                          {Math.round(gr.avance_pct)}%
                        </p>
                      )}
                    </div>
                  </div>
                  {gr.next && (
                    <div className="flex items-center gap-2 px-2 py-1.5 opacity-40">
                      <div className="w-7 text-center text-[11px] text-neutral-400">#{gr.next.rank}</div>
                      <p className="flex-1 text-[11px] text-neutral-500 truncate">{gr.next.entity_name}</p>
                      <p className="text-[11px] text-neutral-400">{money(gr.next.prima_ponderada)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-400 dark:text-white/35 text-center py-4">
              Sin participación en esta campaña
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-neutral-400 dark:text-white/35 text-center py-6">Sin campañas activas</p>
      )}
    </Panel>
  );
}

// ── Solicitud / Trámite ────────────────────────────────────────────────────

function TramitePanel({ usuario }: { usuario: Usuario }) {
  const navigate = useNavigate();
  const [tramites, setTramites] = useState<TramiteReciente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('tickets')
      .select('id, folio, tipo_tramite, custom_estatus_label, created_at, ticket_tipos(label)')
      .eq('creado_por', usuario.id)
      .is('cerrado_en', null)
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (active) {
          setTramites((data ?? []) as TramiteReciente[]);
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [usuario.id]);

  function estatusChip(label?: string | null) {
    if (!label) {
      return (
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400">
          Activo
        </span>
      );
    }
    const lc = label.toLowerCase();
    if (lc.includes('complet') || lc.includes('termin') || lc.includes('finaliz')) {
      return (
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
          {label}
        </span>
      );
    }
    if (lc.includes('revis') || lc.includes('espera') || lc.includes('pendient')) {
      return (
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          {label}
        </span>
      );
    }
    return (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/50">
        {label}
      </span>
    );
  }

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#10B981] to-[#059669]"
      eyebrow="Módulo"
      title="Solicitud/Trámite"
      desc="Aclaraciones y solicitudes"
    >
      <button
        onClick={() => navigate('/tramites')}
        className="flex items-center gap-3 w-full bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/8 border border-neutral-200 dark:border-white/10 rounded-xl p-3 text-left transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-[#E84F8A]/10 grid place-items-center shrink-0 text-sm">
          📋
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-neutral-900 dark:text-white">Nuevo Trámite</p>
          <p className="text-[10px] text-neutral-400 dark:text-white/35">Crear solicitud</p>
        </div>
        <ArrowRight className="w-4 h-4 text-neutral-400 dark:text-white/30 shrink-0" />
      </button>

      <button
        onClick={() => navigate('/tramites')}
        className="flex items-center gap-3 w-full bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/8 border border-neutral-200 dark:border-white/10 rounded-xl p-3 text-left transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 grid place-items-center shrink-0 text-sm">
          🔍
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-neutral-900 dark:text-white">Mis Trámites</p>
          <p className="text-[10px] text-neutral-400 dark:text-white/35">Ver activos e historial</p>
        </div>
        <ArrowRight className="w-4 h-4 text-neutral-400 dark:text-white/30 shrink-0" />
      </button>

      {loading ? (
        <><Sk className="h-9" /><Sk className="h-9 mt-1" /><Sk className="h-9 mt-1" /></>
      ) : tramites.length > 0 ? (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 dark:text-white/35 mb-2">
            Trámites activos
          </p>
          <div>
            {tramites.map(t => (
              <button
                key={t.id}
                onClick={() => navigate(`/tramites/${t.id}`)}
                className="flex items-center justify-between w-full py-2.5 border-b last:border-0 border-neutral-100 dark:border-white/6 text-left hover:bg-neutral-50 dark:hover:bg-white/3 -mx-1 px-1 rounded transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-neutral-800 dark:text-white">
                    {t.folio}
                  </p>
                  <p className="text-[10px] text-neutral-400 dark:text-white/35 truncate">
                    {(t.ticket_tipos as { label: string } | null)?.label ?? t.tipo_tramite}
                  </p>
                </div>
                {estatusChip(t.custom_estatus_label)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-neutral-400 dark:text-white/35 text-center py-4">
          Sin trámites activos
        </p>
      )}
    </Panel>
  );
}

// ── Exported component ─────────────────────────────────────────────────────

export function VendedorSections({ usuario }: { usuario: Usuario }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-neutral-200 dark:border-white/15 bg-white dark:bg-white/5 grid place-items-center text-base">
          👤
        </div>
        <div>
          <p className="text-lg font-extrabold text-neutral-900 dark:text-white leading-tight">Vendedor</p>
          <p className="text-[11px] text-neutral-400 dark:text-white/35">Lo que necesitas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <ProduccionPanel />
        <MetasPanel />
        <CampanaPanel />
        <TramitePanel usuario={usuario} />
      </div>
    </div>
  );
}
