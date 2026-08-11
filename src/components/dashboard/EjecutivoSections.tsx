import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Usuario } from '../../contexts/MoviAuthContext';
import { useMiResumen } from '../../lib/useMiResumen';
import type { CampaniaActiva } from '../../lib/useMiResumen';

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-neutral-200 dark:bg-white/10', className)} />;
}

type AsesorItem = {
  id: string;
  nombre: string;
  apellidos: string;
  total_tickets: number;
  urgentes: number;
  nivel_conv?: string | null;
  pct_conv?: number | null;
};

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
    <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-sm">
      <div className={cn('h-1 w-full', stripe)} />
      <div className="px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-white/8">
        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 dark:text-white/35 mb-1">{eyebrow}</p>
        <p className="text-base font-extrabold text-neutral-900 dark:text-white leading-tight">{title}</p>
        <p className="text-[11px] text-neutral-500 dark:text-white/40 mt-0.5">{desc}</p>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-3">{children}</div>
    </div>
  );
}

const AVATAR_GRADS = [
  'linear-gradient(135deg,#4338CA,#1E1B8C)',
  'linear-gradient(135deg,#0369A1,#0EA5E9)',
  'linear-gradient(135deg,#D97706,#B45309)',
  'linear-gradient(135deg,#065F46,#10B981)',
  'linear-gradient(135deg,#9D174D,#E84F8A)',
  'linear-gradient(135deg,#7C3AED,#4C1D95)',
];

function initials(nombre: string, apellidos: string) {
  return `${nombre.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
}

function nivelChip(nivel?: string | null) {
  if (!nivel) return null;
  const n = nivel.toUpperCase();
  if (n.includes('ORO') || n.includes('MAX') || n.includes('MÁX'))
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">🥇 {nivel}</span>;
  if (n.includes('PLATA'))
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/60">🥈 {nivel}</span>;
  if (n.includes('BRONCE'))
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">⭐ {nivel}</span>;
  return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400 dark:bg-white/8 dark:text-white/35">En camino</span>;
}

function estatusChip(label?: string | null) {
  if (!label) return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50">Activo</span>;
  const lc = label.toLowerCase();
  if (lc.includes('urgente') || lc.includes('bloqueado'))
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">{label}</span>;
  if (lc.includes('revis') || lc.includes('espera') || lc.includes('pendient'))
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">{label}</span>;
  return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400">{label}</span>;
}

// ── Asesores panel ─────────────────────────────────────────────────────────

function AsesoresPanel({ usuario }: { usuario: Usuario }) {
  const [asesores, setAsesores] = useState<AsesorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const data = useMiResumen();

  useEffect(() => {
    let active = true;
    const HORA_MS = 3_600_000;
    const ahora = Date.now();

    async function load() {
      if (!usuario.oficina_id) { setLoading(false); return; }

      const { data: users } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos')
        .eq('rol', 'Agente')
        .eq('oficina_id', usuario.oficina_id)
        .eq('activo', true)
        .order('nombre');

      if (!active || !users?.length) { setLoading(false); return; }

      const ids = users.map(u => u.id);

      const { data: tickets } = await supabase
        .from('tickets')
        .select('agente_id, created_at')
        .in('agente_id', ids)
        .is('cerrado_en', null);

      if (!active) return;

      // Build convention lookup from useMiResumen if available
      const ceMap = new Map<string, { nivel: string; pct: number }>();
      if (data !== 'loading' && data !== 'error' && data.convencion_equipo) {
        for (const v of data.convencion_equipo.en_convencion) {
          ceMap.set(v.entity, { nivel: v.nivel_conv, pct: v.pct_conv });
        }
      }

      const items: AsesorItem[] = users.map(u => {
        const mine = (tickets ?? []).filter(t => t.agente_id === u.id);
        const urgentes = mine.filter(t => ahora - new Date(t.created_at).getTime() > 24 * HORA_MS).length;
        const fullName = `${u.nombre} ${u.apellidos}`;
        const conv = ceMap.get(fullName);
        return {
          id: u.id,
          nombre: u.nombre,
          apellidos: u.apellidos,
          total_tickets: mine.length,
          urgentes,
          nivel_conv: conv?.nivel ?? null,
          pct_conv: conv?.pct ?? null,
        };
      });

      setAsesores(items);
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, [usuario.id, usuario.oficina_id, data]);

  const maxTickets = Math.max(...asesores.map(a => a.total_tickets), 1);

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#4338CA] to-[#818CF8]"
      eyebrow="Mi equipo"
      title="Asesores"
      desc="Actividad y meta de cada asesor"
    >
      {loading ? (
        <><Sk className="h-12" /><Sk className="h-12" /><Sk className="h-12" /><Sk className="h-12" /></>
      ) : asesores.length === 0 ? (
        <p className="text-xs text-neutral-400 dark:text-white/35 text-center py-6">Sin asesores en esta oficina</p>
      ) : (
        <>
          <div className="flex flex-col">
            {asesores.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5 border-b last:border-0 border-neutral-100 dark:border-white/6">
                <div
                  className="w-[34px] h-[34px] rounded-full grid place-items-center text-[13px] font-bold text-white flex-shrink-0"
                  style={{ background: AVATAR_GRADS[i % AVATAR_GRADS.length] }}
                >
                  {initials(a.nombre, a.apellidos)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-neutral-900 dark:text-white truncate">
                    {a.nombre} {a.apellidos}
                  </p>
                  <p className="text-[10px] text-neutral-500 dark:text-white/40 mt-0.5">
                    {a.total_tickets} trámite{a.total_tickets !== 1 ? 's' : ''} activo{a.total_tickets !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {a.nivel_conv ? nivelChip(a.nivel_conv) : (
                    a.urgentes > 0 ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                        {a.urgentes} urgente{a.urgentes !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        Al día
                      </span>
                    )
                  )}
                  <div className="w-14 h-[3px] bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: '#6366F1',
                        width: `${Math.min(100, (a.total_tickets / maxTickets) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3 mt-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400 dark:text-white/35 mb-2">Oficina · resumen</p>
            <div className="flex justify-between">
              <div className="text-center">
                <p className="text-base font-extrabold text-neutral-900 dark:text-white tabular-nums">
                  {asesores.reduce((s, a) => s + a.total_tickets, 0)}
                </p>
                <p className="text-[9px] text-neutral-400 dark:text-white/35 mt-0.5">Trámites</p>
              </div>
              <div className="text-center">
                <p className={cn('text-base font-extrabold tabular-nums', asesores.some(a => a.urgentes > 0) ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                  {asesores.reduce((s, a) => s + a.urgentes, 0)}
                </p>
                <p className="text-[9px] text-neutral-400 dark:text-white/35 mt-0.5">Urgentes</p>
              </div>
              <div className="text-center">
                <p className="text-base font-extrabold text-neutral-900 dark:text-white">{asesores.length}</p>
                <p className="text-[9px] text-neutral-400 dark:text-white/35 mt-0.5">Asesores</p>
              </div>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

// ── Campañas panel ─────────────────────────────────────────────────────────

function CampañasPanel() {
  const data = useMiResumen();

  const campanias: CampaniaActiva[] =
    data !== 'loading' && data !== 'error' ? (data.campanias ?? []) : [];

  if (data === 'loading') {
    return (
      <Panel stripe="bg-gradient-to-r from-[#D97706] to-[#FBBF24]" eyebrow="Activas" title="Campañas" desc="Tu posición en cada campaña">
        <Sk className="h-16" /><Sk className="h-12" /><Sk className="h-12" />
      </Panel>
    );
  }

  if (campanias.length === 0) {
    return (
      <Panel stripe="bg-gradient-to-r from-[#D97706] to-[#FBBF24]" eyebrow="Activas" title="Campañas" desc="Tu posición en cada campaña">
        <p className="text-xs text-neutral-400 dark:text-white/35 text-center py-6">Sin campañas activas</p>
      </Panel>
    );
  }

  return (
    <Panel stripe="bg-gradient-to-r from-[#D97706] to-[#FBBF24]" eyebrow="Activas" title="Campañas" desc="Tu posición en cada campaña">
      {campanias.map((c, ci) => (
        <div key={ci} className={cn(ci > 0 && 'pt-3 border-t border-neutral-100 dark:border-white/8')}>
          {/* Campaign header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-neutral-900 dark:text-white leading-tight">{c.nombre}</p>
              <p className="text-[10px] text-neutral-500 dark:text-white/40 mt-1">{c.descripcion ?? 'Campaña activa'}</p>
            </div>
            {c.dias_restantes != null && (
              <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                ⏱ {c.dias_restantes}d
              </span>
            )}
          </div>

          {/* Ranking rows */}
          {c.group_rows && c.group_rows.length > 0 && (
            <div className="flex flex-col gap-1">
              {c.group_rows.map((row, ri) => {
                const isMe = row.is_me;
                const isPrev = !isMe && ri < c.group_rows!.findIndex(r => r.is_me);
                const isNext = !isMe && ri > c.group_rows!.findIndex(r => r.is_me);
                const dimmed = (isPrev || isNext) && !isMe;
                return (
                  <div
                    key={ri}
                    className={cn(
                      'flex items-center gap-2 px-2 py-2 rounded-xl',
                      isMe
                        ? 'bg-gradient-to-r from-indigo-500/8 to-sky-500/6 border-l-[3px] border-indigo-500'
                        : 'bg-neutral-100 dark:bg-white/5 border-l-[3px] border-transparent',
                      dimmed && 'opacity-45'
                    )}
                  >
                    <span className="w-6 text-center text-[11px] font-bold text-neutral-500 dark:text-white/40 flex-shrink-0">
                      {row.rank ?? ri + 1}
                    </span>
                    <p className="flex-1 min-w-0 text-[12px] font-bold text-neutral-900 dark:text-white truncate">
                      {row.entity}
                      {isMe && <span className="text-[10px] font-normal text-indigo-500 ml-1">tú</span>}
                    </p>
                    <div className="text-right flex-shrink-0">
                      {row.prima_ponderada != null && (
                        <p className="text-[11px] font-bold text-neutral-900 dark:text-white tabular-nums">
                          {row.prima_ponderada.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })}
                        </p>
                      )}
                      {row.pct_meta != null && (
                        <p className={cn('text-[10px] font-semibold', row.pct_meta >= 100 ? 'text-emerald-600 dark:text-emerald-400' : row.pct_meta >= 75 ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400')}>
                          {row.pct_meta}%
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </Panel>
  );
}

// ── Trámites panel ─────────────────────────────────────────────────────────

function TrámitesPanel({ usuario }: { usuario: Usuario }) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketAbierto[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ urgentes: 0, total: 0 });

  useEffect(() => {
    let active = true;
    const HORA_MS = 3_600_000;
    const ahora = Date.now();

    async function load() {
      // Tickets where this ejecutivo is the agent
      const { data: raw } = await supabase
        .from('tickets')
        .select('id, folio, tipo_tramite, custom_estatus_label, created_at, agente_id, ticket_tipos(label)')
        .eq('agente_id', usuario.id)
        .is('cerrado_en', null)
        .order('created_at', { ascending: true })
        .limit(10);

      if (!active) return;

      const list = (raw ?? []).map(t => t as unknown as TicketAbierto);
      const urgentes = list.filter(t => ahora - new Date(t.created_at).getTime() > 24 * HORA_MS).length;

      setTickets(list);
      setCounts({ urgentes, total: list.length });
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, [usuario.id]);

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#9D174D] to-[#E84F8A]"
      eyebrow="Mis solicitudes"
      title="Trámites"
      desc="Solicitudes abiertas asignadas a ti"
    >
      {loading ? (
        <><Sk className="h-8" /><Sk className="h-10" /><Sk className="h-10" /><Sk className="h-10" /></>
      ) : (
        <>
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

          {tickets.length > 0 ? (
            <div className="flex flex-col">
              {tickets.map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/tramites/${t.id}`)}
                  className="flex items-start justify-between gap-2 py-2.5 border-b last:border-0 border-neutral-100 dark:border-white/6 text-left hover:bg-neutral-50 dark:hover:bg-white/3 -mx-1 px-1 rounded transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-neutral-900 dark:text-white tabular-nums">{t.folio}</p>
                    <p className="text-[10px] text-neutral-400 dark:text-white/35 truncate">
                      {(t.ticket_tipos as { label: string } | null)?.label ?? t.tipo_tramite}
                    </p>
                  </div>
                  {estatusChip(t.custom_estatus_label)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-400 dark:text-white/35 text-center py-4">Sin solicitudes abiertas</p>
          )}

          <button
            onClick={() => navigate('/tramites')}
            className="flex items-center gap-3 w-full bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/8 border border-neutral-200 dark:border-white/10 rounded-xl p-3 text-left transition-colors mt-1"
          >
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 grid place-items-center shrink-0 text-sm">📋</div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-neutral-900 dark:text-white">Ver todas las solicitudes</p>
              <p className="text-[10px] text-neutral-400 dark:text-white/35">Bandeja completa</p>
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-400 dark:text-white/30 shrink-0" />
          </button>
        </>
      )}
    </Panel>
  );
}

// ── Exported component ─────────────────────────────────────────────────────

export function EjecutivoSections({ usuario }: { usuario: Usuario }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-neutral-200 dark:border-white/15 bg-white dark:bg-white/5 grid place-items-center text-base">
          💼
        </div>
        <div>
          <p className="text-lg font-extrabold text-neutral-900 dark:text-white leading-tight">Ejecutivo</p>
          <p className="text-[11px] text-neutral-400 dark:text-white/35">Tu equipo y solicitudes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AsesoresPanel usuario={usuario} />
        <CampañasPanel />
        <TrámitesPanel usuario={usuario} />
      </div>
    </div>
  );
}
