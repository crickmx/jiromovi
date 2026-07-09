import { Trophy, Clock, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMiResumen, type CampaniaActiva, type CampaniaGroupRow } from '@/lib/useMiResumen';

function money(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-neutral-200 dark:bg-white/10', className)} />;
}

function diasBadgeClass(dias: number): string {
  if (dias <= 7) return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400';
  if (dias <= 15) return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400';
  return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400';
}

function avanceColorClass(pct: number | null): string {
  if (pct == null) return 'text-neutral-400';
  if (pct >= 100) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 75) return 'text-blue-600 dark:text-blue-400';
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function medalla(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

function NeighborRow({ row }: { row: Omit<CampaniaGroupRow, 'is_me' | 'prev' | 'next'> }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1 opacity-50">
      <div className="w-10 shrink-0 text-center text-[11px] font-semibold text-neutral-400">#{row.rank}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-neutral-500 truncate">{row.entity_name}</p>
        {row.despacho && <p className="text-[10px] text-neutral-400">{row.despacho}</p>}
      </div>
      <div className="text-[11px] text-neutral-400 shrink-0">{money(row.prima_ponderada)}</div>
    </div>
  );
}

function CampaniaCard({ cd, role }: { cd: CampaniaActiva; role?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 p-4">
      {role !== 'vendedor' && cd.equipo_count > 0 && (
        <div className="flex gap-3 mb-3">
          <div className="flex-1 text-center bg-neutral-50 dark:bg-white/5 rounded-lg py-1.5 px-1">
            <div className="text-lg font-extrabold text-[#1B3A6B] dark:text-white">{cd.equipo_count}</div>
            <div className="text-[9px] text-neutral-400 mt-0.5">participantes<br />del equipo</div>
          </div>
          <div className="flex-1 text-center bg-neutral-50 dark:bg-white/5 rounded-lg py-1.5 px-1">
            <div className="text-sm font-extrabold text-[#1B3A6B] dark:text-white">{money(cd.equipo_prima_total)}</div>
            <div className="text-[9px] text-neutral-400 mt-0.5">prima pond.<br />del equipo</div>
          </div>
          {cd.equipo_en_zona > 0 && (
            <div className="flex-1 text-center bg-emerald-50 dark:bg-emerald-950/20 rounded-lg py-1.5 px-1">
              <div className="text-lg font-extrabold text-emerald-600">{cd.equipo_en_zona}</div>
              <div className="text-[9px] text-neutral-400 mt-0.5">en zona<br />de premio</div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Campaña Activa</p>
          <p className="text-[15px] font-extrabold text-[#1B3A6B] dark:text-white truncate mt-0.5" title={cd.nombre}>
            🏆 {cd.nombre}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold', diasBadgeClass(cd.dias_restantes))}>
            <Clock className="w-3 h-3" />{cd.dias_restantes}d
          </span>
          <p className="text-[10px] text-neutral-400 mt-1">{cd.total_participantes} participantes</p>
        </div>
      </div>

      {cd.group_rows.length > 0 ? (
        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {cd.group_rows.map(gr => (
            <div key={gr.entity_name}>
              {gr.prev && <NeighborRow row={gr.prev} />}
              <div
                className={cn(
                  'flex items-center gap-2 px-2 py-2 rounded-lg border-l-[3px]',
                  gr.is_me
                    ? 'bg-gradient-to-br from-indigo-50 to-emerald-50 dark:from-indigo-950/20 dark:to-emerald-950/20 border-l-indigo-500'
                    : 'bg-neutral-50 dark:bg-white/5 border-l-[#1B3A6B] dark:border-l-white/30'
                )}
              >
                <div className="w-10 shrink-0 text-center">
                  {medalla(gr.rank) ? (
                    <span className="text-sm">{medalla(gr.rank)}</span>
                  ) : (
                    <span className="text-[12px] font-bold text-neutral-600 dark:text-neutral-300">#{gr.rank}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#1B3A6B] dark:text-white truncate" title={gr.entity_name}>
                    {gr.entity_name}
                    {gr.is_me && <span className="text-[10px] font-normal text-indigo-500"> ← tú</span>}
                  </p>
                  {gr.despacho && !gr.is_me && (
                    <p className="text-[10px] text-neutral-400">{gr.despacho}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-bold text-[#1B3A6B] dark:text-white">{money(gr.prima_ponderada)}</p>
                  {gr.avance_pct != null && (
                    <p className={cn('text-[11px] font-semibold', avanceColorClass(gr.avance_pct))}>
                      {Math.round(gr.avance_pct)}%
                    </p>
                  )}
                </div>
              </div>
              {gr.next && <NeighborRow row={gr.next} />}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <UserX className="w-7 h-7 text-neutral-300 mx-auto" />
          <p className="text-sm text-neutral-400 mt-2">Sin participación en esta campaña</p>
        </div>
      )}
    </div>
  );
}

export function CampaniasActivasCard() {
  const data = useMiResumen();

  if (data === 'loading') {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 p-4">
        <Sk className="h-5 w-40 mb-4" />
        <Sk className="h-24" />
      </div>
    );
  }

  if (data === 'error' || !data.vinculado || data.aplica === false) return null;

  const campanias = data.campanias ?? [];
  if (campanias.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Trophy className="w-4 h-4 text-neutral-400 dark:text-white/40" />
        <h3 className="text-sm font-bold text-neutral-800 dark:text-white/90">Campañas Activas</h3>
      </div>
      {campanias.map(cd => (
        <CampaniaCard key={cd.id} cd={cd} role={data.role} />
      ))}
    </div>
  );
}
