import { Award, Flag, Star, Zap, Palmtree, PlaneTakeoff, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMiResumen, type ConvencionStep } from '@/lib/useMiResumen';

function money(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-neutral-200 dark:bg-white/10', className)} />;
}

function nivelBadge(nivel: string): { emoji: string; cls: string } {
  if (nivel.includes('ORO')) return { emoji: '🥇', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-400' };
  if (nivel.includes('PLATA')) return { emoji: '🥈', cls: 'bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-neutral-300' };
  return { emoji: '⭐', cls: 'bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-400' };
}

// ── Mi Convención (vendedor) ──────────────────────────────────────────────

function StepperStep({ step }: { step: ConvencionStep }) {
  const barColor = step.status === 'done' ? 'bg-emerald-500' : step.status === 'active' ? 'bg-sky-600' : 'bg-neutral-200 dark:bg-white/10';
  const textColor = step.status === 'done' ? 'text-emerald-600' : step.status === 'active' ? 'text-sky-600 font-bold' : 'text-neutral-400';
  const icon = step.status === 'done' ? '✓' : step.status === 'active' ? '●' : '○';
  return (
    <div className="flex-1 min-w-[60px] text-center">
      <div className={cn('h-1.5 rounded-full mb-1', barColor)} />
      <p className={cn('text-[10px] truncate', textColor)}>{icon} {step.name}</p>
    </div>
  );
}

function MiConvencionCard() {
  const data = useMiResumen();
  if (data === 'loading' || data === 'error' || !data.vinculado || data.aplica === false) return null;
  const c = data.convencion;
  if (!c) return null;

  const titulo = c.nivel === 'NO CONVENCIONISTA' ? 'META PARA CONVENCIÓN' : c.maximo ? '¡CONVENCIÓN GANADA!' : c.nivel;
  const tituloColor = c.nivel === 'NO CONVENCIONISTA' ? 'text-sky-700' : c.maximo ? 'text-amber-600' : c.nivel.includes('ORO') ? 'text-amber-700' : c.nivel.includes('PLATA') ? 'text-neutral-600' : 'text-[#1B3A6B]';

  const badge = c.nivel === 'NO CONVENCIONISTA'
    ? { txt: '🌴 En camino', cls: 'bg-sky-100 text-sky-700' }
    : c.maximo
    ? { txt: '✈️ Ganada', cls: 'bg-amber-100 text-amber-900' }
    : { txt: `${nivelBadge(c.nivel).emoji} ${c.nivel}`, cls: nivelBadge(c.nivel).cls };

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Mi Convención</p>
            <p className={cn('text-lg font-extrabold mt-0.5', tituloColor)}>{titulo}</p>
            {c.prima_acum > 0 && (
              <p className="text-[11px] text-neutral-500 mt-1">
                Prima convenio acumulada: <strong>{money(c.prima_acum)}</strong>
              </p>
            )}
          </div>
          <span className={cn('shrink-0 px-2.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap', badge.cls)}>{badge.txt}</span>
        </div>

        {c.steps.length > 0 && (
          <div className="flex gap-1 mb-3 overflow-x-auto pb-0.5">
            {c.steps.map(s => <StepperStep key={s.name} step={s} />)}
          </div>
        )}

        {c.maximo ? (
          <div className="flex items-center gap-2 rounded-xl p-2.5 bg-amber-50 dark:bg-amber-950/20 border-l-[3px] border-amber-500">
            <Star className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-[13px] font-bold text-amber-800 dark:text-amber-400">¡Nivel de convención máximo!</p>
          </div>
        ) : c.siguiente && (
          <>
            <div className="flex items-center gap-2 rounded-xl p-2.5 bg-sky-50 dark:bg-sky-950/20 border-l-[3px] border-sky-500">
              <Flag className="w-4 h-4 text-sky-500 shrink-0" />
              <div>
                <p className="text-[11px] text-neutral-500">Falta para {c.siguiente}</p>
                <p className="text-base font-extrabold text-sky-700 dark:text-sky-400">{money(c.falta)}</p>
              </div>
            </div>
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-sky-100 dark:bg-sky-950/30 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400" style={{ width: `${c.pct}%` }} />
              </div>
              <p className="text-right text-[10px] font-semibold text-sky-700 mt-1">{Math.round(c.pct)}% hacia {c.siguiente}</p>
            </div>
            <p className="mt-2 text-[12px] text-neutral-500 italic">{c.msg}</p>
          </>
        )}
      </div>

      <div
        className="relative h-[72px] overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#0c4a6e 0%,#0369a1 30%,#38bdf8 65%,#fde68a 100%)' }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-[50px] flex items-center justify-between px-4 pb-1.5">
          <span className="text-2xl leading-none">🌴</span>
          <div className="text-center leading-tight">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-white/75">¡tu próximo destino!</p>
            <p className="text-[13px] font-extrabold uppercase tracking-wide text-white">
              Convención {new Date().getFullYear()}
            </p>
          </div>
          <span className="text-2xl leading-none">✈️</span>
        </div>
      </div>
    </div>
  );
}

// ── Convención del Equipo (gerencia/despacho) ─────────────────────────────

function ConvencionEquipoCard() {
  const data = useMiResumen();
  if (data === 'loading' || data === 'error' || !data.vinculado || data.aplica === false) return null;
  const ce = data.convencion_equipo;
  if (!ce) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 p-4">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Convención del Equipo</p>
          <p className="text-base font-bold text-[#1B3A6B] dark:text-white mt-0.5">
            {ce.en_convencion.length > 0 ? (
              <>{ce.en_convencion.length} <span className="font-normal text-sm text-neutral-500">de {ce.total_vendedores} vendedores</span></>
            ) : 'Ningún vendedor en convención aún'}
          </p>
        </div>
        <Award className="w-6 h-6 text-amber-500 opacity-80 shrink-0" />
      </div>

      {ce.en_convencion.length > 0 ? (
        <div className="max-h-[260px] overflow-y-auto space-y-0 divide-y divide-neutral-100 dark:divide-white/5">
          {ce.en_convencion.map(v => {
            const badge = nivelBadge(v.nivel_conv);
            const esMaximo = !v.sig_conv;
            return (
              <div key={v.entity} className="flex items-center gap-2 py-2">
                <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap', badge.cls)}>
                  {badge.emoji} {v.nivel_conv}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-neutral-900 dark:text-white truncate" title={v.entity}>{v.entity}</p>
                  {esMaximo ? (
                    <p className="text-[11px] font-semibold text-emerald-600">🏆 Nivel máximo</p>
                  ) : (
                    <p className="text-[11px] text-neutral-400">
                      Falta <span className="text-indigo-500 font-semibold">{money(v.falta_conv)}</span> → {v.sig_conv}
                    </p>
                  )}
                </div>
                {!esMaximo && (
                  <div className="w-12 shrink-0">
                    <div className="h-1 rounded-full bg-indigo-100 dark:bg-indigo-950/30 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${v.pct_conv}%` }} />
                    </div>
                    <p className="text-[9px] text-indigo-500 text-right mt-0.5">{Math.round(v.pct_conv)}%</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4">
          <Award className="w-7 h-7 text-neutral-200 mx-auto" />
          <p className="text-sm text-neutral-400 mt-2">Los vendedores que lleguen a convención aparecerán aquí</p>
        </div>
      )}

      {ce.cerca.length > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" /> Cerca de Alcanzar Convención ({ce.cerca.length})
          </p>
          <div className="space-y-1.5">
            {ce.cerca.map(v => (
              <div key={v.entity} className="flex items-center gap-2">
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 whitespace-nowrap">
                  ⚡ Por llegar
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 truncate" title={v.entity}>{v.entity}</p>
                  <p className="text-[10px] text-neutral-400">
                    Falta <span className="text-amber-600 font-semibold">{money(v.falta_conv)}</span> → {v.sig_conv}
                  </p>
                </div>
                <div className="w-11 shrink-0">
                  <div className="h-1 rounded-full bg-amber-100 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${v.pct_conv}%` }} />
                  </div>
                  <p className="text-[9px] text-amber-600 text-right mt-0.5">{Math.round(v.pct_conv)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Wrapper: elige la vista según el rol ──────────────────────────────────

export function ConvencionCard() {
  const data = useMiResumen();

  if (data === 'loading') {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 p-4">
        <Sk className="h-5 w-32 mb-4" />
        <Sk className="h-16" />
      </div>
    );
  }

  if (data === 'error' || !data.vinculado || data.aplica === false) return null;

  if (data.role === 'vendedor') return <MiConvencionCard />;
  if (data.role === 'gerencia' || data.role === 'despacho') return <ConvencionEquipoCard />;
  return null;
}
