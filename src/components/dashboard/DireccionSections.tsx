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
  return <div className={cn('animate-pulse rounded-lg bg-neutral-200 dark:bg-white/10', className)} />;
}

type GerenteItem = {
  id: string;
  nombre: string;
  apellidos: string;
  oficina_nombre: string;
  total_tickets: number;
  urgentes: number;
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
    <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col box-shadow-sm">
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
  'linear-gradient(135deg,#065F46,#10B981)',
  'linear-gradient(135deg,#0369A1,#0EA5E9)',
  'linear-gradient(135deg,#D97706,#B45309)',
  'linear-gradient(135deg,#7C3AED,#4C1D95)',
  'linear-gradient(135deg,#9D174D,#E84F8A)',
  'linear-gradient(135deg,#4338CA,#1E1B8C)',
];

function initials(nombre: string, apellidos: string) {
  return `${nombre.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
}

function nivelChip(nivel: string) {
  const n = nivel.toUpperCase();
  if (n.includes('ORO') || n.includes('MAX') || n.includes('MÁX'))
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">🥇 {nivel}</span>;
  if (n.includes('PLATA'))
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/60">🥈 {nivel}</span>;
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

// ── Gerentes panel ─────────────────────────────────────────────────────────

function GerentesPanel() {
  const [gerentes, setGerentes] = useState<GerenteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const HORA_MS = 3_600_000;
    const ahora = Date.now();

    async function load() {
      const { data: users } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos, oficina:oficinas(nombre)')
        .eq('rol', 'Gerente')
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

      const items: GerenteItem[] = users.map(u => {
        const mine = (tickets ?? []).filter(t => t.agente_id === u.id);
        const urgentes = mine.filter(t => ahora - new Date(t.created_at).getTime() > 24 * HORA_MS).length;
        const ofRaw = u.oficina as unknown as { nombre: string } | { nombre: string }[] | null;
        const ofName = Array.isArray(ofRaw) ? (ofRaw[0]?.nombre ?? '—') : (ofRaw?.nombre ?? '—');
        return { id: u.id, nombre: u.nombre, apellidos: u.apellidos, oficina_nombre: ofName, total: mine.length, urgentes, total_tickets: mine.length };
      });

      setGerentes(items);
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, []);

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#1E1035] to-[#6366F1]"
      eyebrow="Red corporativa"
      title="Gerentes"
      desc="Trámites activos por gerencia"
    >
      {loading ? (
        <><Sk className="h-12" /><Sk className="h-12" /><Sk className="h-12" /><Sk className="h-12" /></>
      ) : gerentes.length === 0 ? (
        <p className="text-xs text-neutral-400 dark:text-white/35 text-center py-6">Sin gerentes activos</p>
      ) : (
        <>
          <div className="flex flex-col">
            {gerentes.map((g, i) => (
              <div key={g.id} className="flex items-center gap-3 py-2.5 border-b last:border-0 border-neutral-100 dark:border-white/6">
                <div
                  className="w-[34px] h-[34px] rounded-full grid place-items-center text-[13px] font-bold text-white flex-shrink-0"
                  style={{ background: AVATAR_GRADS[i % AVATAR_GRADS.length] }}
                >
                  {initials(g.nombre, g.apellidos)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-neutral-900 dark:text-white truncate">
                    {g.nombre} {g.apellidos}
                  </p>
                  <p className="text-[10px] text-neutral-500 dark:text-white/40 mt-0.5 truncate">{g.oficina_nombre}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {g.urgentes > 0 ? (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                      {g.urgentes} urgente{g.urgentes !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                      Al día
                    </span>
                  )}
                  <div className="w-14 h-[3px] bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: '#6366F1',
                        width: `${Math.min(100, (g.total_tickets / Math.max(...gerentes.map(x => x.total_tickets), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3 mt-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400 dark:text-white/35 mb-2">Corporativo · resumen</p>
            <div className="flex justify-between">
              <div className="text-center">
                <p className="text-base font-extrabold text-neutral-900 dark:text-white font-variant-numeric tabular-nums">
                  {gerentes.reduce((s, g) => s + g.total_tickets, 0)}
                </p>
                <p className="text-[9px] text-neutral-400 dark:text-white/35 mt-0.5">Trámites totales</p>
              </div>
              <div className="text-center">
                <p className={cn('text-base font-extrabold font-variant-numeric tabular-nums', gerentes.some(g => g.urgentes > 0) ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                  {gerentes.reduce((s, g) => s + g.urgentes, 0)}
                </p>
                <p className="text-[9px] text-neutral-400 dark:text-white/35 mt-0.5">Urgentes</p>
              </div>
              <div className="text-center">
                <p className="text-base font-extrabold text-neutral-900 dark:text-white">
                  {gerentes.length}
                </p>
                <p className="text-[9px] text-neutral-400 dark:text-white/35 mt-0.5">Gerentes</p>
              </div>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

// ── Produccion panel ───────────────────────────────────────────────────────

function ProduccionPanel() {
  const data = useMiResumen();

  const prod =
    data !== 'loading' && data !== 'error' && data.vinculado && data.aplica !== false
      ? data.produccion
      : null;

  const renovaciones =
    data !== 'loading' && data !== 'error' ? (data.renovaciones ?? []) : [];

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#0369A1] to-[#38BDF8]"
      eyebrow="Corporativo"
      title="Producción"
      desc="Prima acumulada del período"
    >
      {data === 'loading' ? (
        <><Sk className="h-16" /><Sk className="h-12" /><Sk className="h-12" /></>
      ) : prod ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400 dark:text-white/35 mb-1">Prima total</p>
              <p className="text-base font-extrabold text-sky-600 dark:text-sky-400">{money(prod.prima_conv_actual)}</p>
              {prod.delta_pct != null && (
                <p className={cn('text-[10px] font-semibold mt-1', prod.delta_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                  {prod.delta_pct >= 0 ? '↑ +' : '↓ '}{prod.delta_pct}% vs año anterior
                </p>
              )}
            </div>
            {prod.meta_monto != null && (
              <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3">
                <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400 dark:text-white/35 mb-1">Meta anual</p>
                <p className="text-base font-extrabold text-violet-600 dark:text-violet-400">{money(prod.meta_monto)}</p>
                <p className="text-[10px] text-neutral-400 dark:text-white/35 mt-1">{prod.meta_pct}% alcanzado</p>
              </div>
            )}
          </div>

          {prod.meta_monto != null && (
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-neutral-500 dark:text-white/40">Avance meta corporativa</span>
                <span className="font-bold text-sky-600 dark:text-sky-400">{prod.meta_pct}%</span>
              </div>
              <div className="h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, prod.meta_pct ?? 0)}%`, background: 'linear-gradient(90deg,#0369A1,#38BDF8)' }}
                />
              </div>
            </div>
          )}

          {renovaciones.length > 0 && (
            <div className="bg-sky-50 dark:bg-sky-950/20 border-l-[3px] border-sky-500 rounded-r-xl p-2.5">
              <p className="text-[11px] font-bold text-neutral-800 dark:text-white">Renovaciones próximas</p>
              <p className="text-[10px] text-neutral-500 dark:text-white/40">
                {renovaciones.length} póliza{renovaciones.length !== 1 ? 's' : ''} por renovar
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
          <span className="text-2xl">📊</span>
          <p className="text-[11px] font-semibold text-neutral-700 dark:text-white/70">Datos disponibles en</p>
          <p className="text-[10px] text-neutral-400 dark:text-white/40 leading-relaxed">Central de Producción</p>
          <a
            href="/produccion"
            className="text-[11px] font-bold text-sky-600 dark:text-sky-400 underline underline-offset-2 mt-1"
          >
            Ir a Producción →
          </a>
        </div>
      )}
    </Panel>
  );
}

// ── Metas panel ────────────────────────────────────────────────────────────

function MetasPanel() {
  const data = useMiResumen();

  const ce =
    data !== 'loading' && data !== 'error' && data.vinculado && data.aplica !== false
      ? data.convencion_equipo
      : null;

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#059669] to-[#34D399]"
      eyebrow="Convención · corporativo"
      title="Metas"
      desc="Asesores en convención por sucursal"
    >
      {data === 'loading' ? (
        <><Sk className="h-16" /><Sk className="h-12" /><Sk className="h-12" /></>
      ) : ce ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400 dark:text-white/35 mb-1">En convención</p>
              <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                {ce.en_convencion.length}
                <span className="text-[11px] font-normal text-neutral-400 dark:text-white/35"> / {ce.total_vendedores}</span>
              </p>
              <p className="text-[10px] text-neutral-400 dark:text-white/35 mt-1">asesores activos</p>
            </div>
            <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400 dark:text-white/35 mb-1">Cerca del nivel</p>
              <p className="text-base font-extrabold text-amber-600 dark:text-amber-400">{ce.cerca.length}</p>
              <p className="text-[10px] text-neutral-400 dark:text-white/35 mt-1">por alcanzar</p>
            </div>
          </div>

          {ce.en_convencion.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 dark:text-white/35 mb-2">Nivel por asesor</p>
              <div className="flex flex-col gap-1.5">
                {ce.en_convencion.map(v => (
                  <div
                    key={v.entity}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/8"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-neutral-900 dark:text-white truncate">{v.entity}</p>
                      <div className="h-1 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                        <div className="h-full rounded-full" style={{ width: `${v.pct_conv}%`, background: 'linear-gradient(90deg,#059669,#34D399)' }} />
                      </div>
                    </div>
                    {nivelChip(v.nivel_conv)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ce.cerca.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 dark:text-white/35 mb-2">Cerca del siguiente nivel</p>
              {ce.cerca.map(v => (
                <div key={v.entity} className="bg-emerald-50 dark:bg-emerald-950/20 border-l-[3px] border-emerald-500 rounded-r-xl p-2.5 mb-2">
                  <p className="text-[11px] font-bold text-neutral-800 dark:text-white">{v.entity}</p>
                  <p className="text-[10px] text-neutral-500 dark:text-white/40">
                    Falta {money(v.falta_conv)} para {v.sig_conv}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
          <span className="text-2xl">🏆</span>
          <p className="text-[11px] font-semibold text-neutral-700 dark:text-white/70">Datos de convención</p>
          <p className="text-[10px] text-neutral-400 dark:text-white/40 leading-relaxed">disponibles en Central de Producción</p>
          <a
            href="/produccion"
            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 underline underline-offset-2 mt-1"
          >
            Ir a Producción →
          </a>
        </div>
      )}
    </Panel>
  );
}

// ── Solicitudes panel ──────────────────────────────────────────────────────

function SolicitudesPanel() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketAbierto[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ urgentes: 0, total: 0 });

  useEffect(() => {
    let active = true;
    const HORA_MS = 3_600_000;
    const ahora = Date.now();

    async function load() {
      // All-org view: no oficina_id filter. Fetch agente names separately.
      const [{ data: raw }, { data: agentes }] = await Promise.all([
        supabase
          .from('tickets')
          .select('id, folio, tipo_tramite, custom_estatus_label, created_at, agente_id, ticket_tipos(label)')
          .is('cerrado_en', null)
          .order('created_at', { ascending: true })
          .limit(10),
        supabase
          .from('usuarios')
          .select('id, nombre, apellidos'),
      ]);

      if (!active) return;

      const nameMap = new Map((agentes ?? []).map(u => [u.id, `${u.nombre} ${u.apellidos}`]));

      const list = (raw ?? []).map(t => ({
        ...(t as unknown as TicketAbierto),
        _agente_nombre: (t as { agente_id?: string | null }).agente_id
          ? (nameMap.get((t as { agente_id: string }).agente_id) ?? '—')
          : '—',
      }));

      const urgentes = list.filter(t => ahora - new Date(t.created_at).getTime() > 24 * HORA_MS).length;
      setTickets(list);
      setCounts({ urgentes, total: list.length });
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, []);

  return (
    <Panel
      stripe="bg-gradient-to-r from-[#9D174D] to-[#E84F8A]"
      eyebrow="Todas las sucursales"
      title="Solicitudes"
      desc="Trámites abiertos en la organización"
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
                    <p className="text-[12px] font-bold text-neutral-900 dark:text-white font-variant-numeric tabular-nums">{t.folio}</p>
                    <p className="text-[10px] text-neutral-400 dark:text-white/35 truncate">
                      {(t.ticket_tipos as { label: string } | null)?.label ?? t.tipo_tramite}
                    </p>
                    <p className="text-[10px] text-neutral-500 dark:text-white/40 mt-0.5">👤 {t._agente_nombre}</p>
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
              <p className="text-[10px] text-neutral-400 dark:text-white/35">Bandeja corporativa completa</p>
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-400 dark:text-white/30 shrink-0" />
          </button>
        </>
      )}
    </Panel>
  );
}

// ── Exported component ─────────────────────────────────────────────────────

export function DireccionSections({ usuario: _usuario }: { usuario: Usuario }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-neutral-200 dark:border-white/15 bg-white dark:bg-white/5 grid place-items-center text-base">
          🏛️
        </div>
        <div>
          <p className="text-lg font-extrabold text-neutral-900 dark:text-white leading-tight">Dirección</p>
          <p className="text-[11px] text-neutral-400 dark:text-white/35">Vista corporativa · todas las sucursales</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <GerentesPanel />
        <ProduccionPanel />
        <MetasPanel />
        <SolicitudesPanel />
      </div>
    </div>
  );
}
