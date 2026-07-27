import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import {
  MapPin, Save, Loader2, ShieldAlert, Zap, RefreshCw, Search, Users,
  SlidersHorizontal, Phone, Mail, ExternalLink, Clock, X, ListChecks,
  UserCheck, UserPlus, Ban, ArrowRightLeft, CheckCircle2, AlertTriangle,
} from 'lucide-react';

// Dashboard de Admin para seguros.express: monitoreo de leads (quién los tomó,
// seguimiento, estado), habilitación de agentes y configuración del motor.

type Tab = 'leads' | 'agentes' | 'config';

interface Config {
  id: number;
  anillo_km_inicial: number;
  incremento_km: number;
  intervalo_minutos: number;
  tope_maximo_km: number;
  expiracion_minutos_extra: number;
  activo: boolean;
}

interface Lead {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  tipo_seguro_interes: string | null;
  lat: number | null;
  lng: number | null;
  direccion_manual: string | null;
  ubicacion_metodo: string | null;
  anillo_km_actual: number;
  estado: string;
  agente_asignado_id: string | null;
  crm_contacto_id: string | null;
  ultima_expansion_at: string | null;
  tope_alcanzado_at: string | null;
  admin_notificado_at: string | null;
  origen: string | null;
  created_at: string;
  updated_at: string;
}

interface Agente {
  id: string;
  nombre: string;
  apellidos: string;
  email_laboral: string | null;
  celular_laboral: string | null;
  rol: string;
  activo: boolean;
  seguros_express_habilitado: boolean;
  ubicacion_lat: number | null;
  ubicacion_lng: number | null;
  ubicacion_direccion_manual: string | null;
  ubicacion_updated_at: string | null;
}

const ESTADOS = ['nuevo', 'notificado', 'contactado', 'convertido', 'expirado'] as const;

const ESTADO_BADGE: Record<string, string> = {
  nuevo: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  notificado: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  contactado: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
  convertido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  expirado: 'bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50',
};

const CAMPOS_CONFIG: { key: keyof Config; label: string; help: string; min: number; max: number }[] = [
  { key: 'anillo_km_inicial', label: 'Anillo inicial (km)', help: 'Radio de búsqueda al crear el lead.', min: 1, max: 100 },
  { key: 'incremento_km', label: 'Incremento por paso (km)', help: 'Cuánto crece el radio en cada expansión.', min: 1, max: 100 },
  { key: 'intervalo_minutos', label: 'Intervalo (min)', help: 'Cada cuánto se expande el anillo si nadie lo toma.', min: 1, max: 120 },
  { key: 'tope_maximo_km', label: 'Tope máximo (km)', help: 'Radio máximo antes de avisar a Admin.', min: 1, max: 500 },
  { key: 'expiracion_minutos_extra', label: 'Expiración extra (min)', help: 'Tiempo tras el tope antes de expirar el lead.', min: 1, max: 1440 },
];

function fmtFechaHora(v: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtFecha(v: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}
function nombreCompleto(a: { nombre: string; apellidos: string } | undefined | null): string {
  if (!a) return '—';
  return `${a.nombre ?? ''} ${a.apellidos ?? ''}`.trim() || '—';
}

export default function AdminSegurosExpress() {
  useEffect(() => { document.title = 'seguros.express · Admin'; }, []);
  const { usuario } = useMoviAuth();
  const isAdmin = usuario?.rol === 'Administrador';

  const [tab, setTab] = useState<Tab>('leads');
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const cargar = useCallback(async () => {
    const [cfgRes, leadsRes, usersRes] = await Promise.all([
      supabase.from('express_leads_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('express_leads').select('*').order('created_at', { ascending: false }),
      supabase
        .from('usuarios')
        .select('id, nombre, apellidos, email_laboral, celular_laboral, rol, activo, seguros_express_habilitado, ubicacion_lat, ubicacion_lng, ubicacion_direccion_manual, ubicacion_updated_at')
        .eq('is_deleted', false)
        .order('nombre', { ascending: true }),
    ]);
    if (cfgRes.data) setConfig(cfgRes.data as Config);
    if (!leadsRes.error && leadsRes.data) setLeads(leadsRes.data as Lead[]);
    if (!usersRes.error && usersRes.data) setAgentes(usersRes.data as Agente[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) cargar(); else setLoading(false); }, [isAdmin, cargar]);

  const agentesById = useMemo(() => {
    const m: Record<string, Agente> = {};
    for (const a of agentes) m[a.id] = a;
    return m;
  }, [agentes]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: leads.length, sin_tomar: 0 };
    for (const e of ESTADOS) c[e] = 0;
    for (const l of leads) {
      c[l.estado] = (c[l.estado] || 0) + 1;
      if (l.estado === 'notificado' && !l.agente_asignado_id) c.sin_tomar += 1;
    }
    return c;
  }, [leads]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-neutral-400" />
        <h1 className="mt-4 text-xl font-bold text-neutral-900 dark:text-white">Acceso restringido</h1>
        <p className="mt-2 text-neutral-500 dark:text-white/50">Sólo administradores pueden acceder a seguros.express.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-sky-500" /></div>;
  }

  const KPIS: { key: string; label: string; accent: string }[] = [
    { key: 'total', label: 'Total leads', accent: 'text-neutral-900 dark:text-white' },
    { key: 'sin_tomar', label: 'Sin tomar', accent: 'text-sky-600 dark:text-sky-400' },
    { key: 'contactado', label: 'Tomados', accent: 'text-indigo-600 dark:text-indigo-400' },
    { key: 'convertido', label: 'Convertidos', accent: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'expirado', label: 'Expirados', accent: 'text-neutral-400 dark:text-white/40' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white"><Zap className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">seguros.express</h1>
            <p className="text-sm text-neutral-500 dark:text-white/50">
              Monitoreo de leads, agentes habilitados y motor de reparto.
              {config && !config.activo && <span className="ml-2 font-semibold text-red-500">· Motor PAUSADO</span>}
            </p>
          </div>
        </div>
        <button
          onClick={cargar}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5"
        >
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {KPIS.map((k) => (
          <div key={k.key} className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <p className={`text-2xl font-bold ${k.accent}`}>{counts[k.key] || 0}</p>
            <p className="text-xs text-neutral-500 dark:text-white/50">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-white/10 dark:bg-white/[0.03]">
        {([
          { id: 'leads', label: 'Leads', icon: ListChecks },
          { id: 'agentes', label: 'Agentes', icon: Users },
          { id: 'config', label: 'Configuración', icon: SlidersHorizontal },
        ] as { id: Tab; label: string; icon: typeof ListChecks }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? 'bg-white text-sky-700 shadow-sm dark:bg-white/10 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-700 dark:text-white/50 dark:hover:text-white/80'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            {t.id === 'agentes' && (
              <span className="ml-1 rounded-full bg-neutral-200 px-1.5 text-xs text-neutral-600 dark:bg-white/10 dark:text-white/60">
                {agentes.filter((a) => a.seguros_express_habilitado).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'leads' && (
        <LeadsTab leads={leads} agentesById={agentesById} agentes={agentes} onChanged={cargar} showToast={showToast} />
      )}
      {tab === 'agentes' && (
        <AgentesTab agentes={agentes} leads={leads} onChanged={cargar} showToast={showToast} />
      )}
      {tab === 'config' && config && (
        <ConfigTab config={config} setConfig={setConfig} usuarioId={usuario?.id ?? null} showToast={showToast} />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab: Leads
// ─────────────────────────────────────────────────────────────────────────
function LeadsTab({
  leads, agentesById, agentes, onChanged, showToast,
}: {
  leads: Lead[];
  agentesById: Record<string, Agente>;
  agentes: Agente[];
  onChanged: () => Promise<void>;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [q, setQ] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<string>('todos');
  const [detalle, setDetalle] = useState<Lead | null>(null);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (estadoFiltro !== 'todos' && l.estado !== estadoFiltro) return false;
      if (!term) return true;
      const ag = l.agente_asignado_id ? nombreCompleto(agentesById[l.agente_asignado_id]) : '';
      return (
        l.nombre?.toLowerCase().includes(term) ||
        l.telefono?.toLowerCase().includes(term) ||
        (l.email || '').toLowerCase().includes(term) ||
        (l.tipo_seguro_interes || '').toLowerCase().includes(term) ||
        ag.toLowerCase().includes(term)
      );
    });
  }, [leads, q, estadoFiltro, agentesById]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, teléfono, seguro o agente…"
            className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e} className="capitalize">{e}</option>)}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-400 dark:border-white/10 dark:text-white/40">
          No hay leads que coincidan.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-white/[0.03] dark:text-white/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Seguro</th>
                <th className="px-4 py-3 font-semibold">Ubicación</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Tomado por</th>
                <th className="px-4 py-3 font-semibold">Recibido</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {filtrados.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setDetalle(l)}
                  className="cursor-pointer transition hover:bg-neutral-50 dark:hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900 dark:text-white">{l.nombre}</p>
                    <p className="text-xs text-neutral-400">{l.telefono}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-white/70">{l.tipo_seguro_interes || '—'}</td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-white/70">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      {l.direccion_manual || (l.lat != null ? 'GPS' : 'Sin ubicación')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ESTADO_BADGE[l.estado] || ''}`}>{l.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-white/70">
                    {l.agente_asignado_id ? nombreCompleto(agentesById[l.agente_asignado_id]) : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500 dark:text-white/50">{fmtFecha(l.created_at)}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">
                    {l.estado === 'convertido' && l.crm_contacto_id ? (
                      <Link to={`/mi-crm/contactos/${l.crm_contacto_id}`} onClick={(e) => e.stopPropagation()} className="text-emerald-600 hover:underline dark:text-emerald-400">
                        <ExternalLink className="inline h-4 w-4" />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalle && (
        <LeadDetalleModal
          lead={detalle}
          agentesById={agentesById}
          agentesHabilitados={agentes.filter((a) => a.seguros_express_habilitado && a.activo)}
          onClose={() => setDetalle(null)}
          onChanged={async () => { await onChanged(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function LeadDetalleModal({
  lead, agentesById, agentesHabilitados, onClose, onChanged, showToast,
}: {
  lead: Lead;
  agentesById: Record<string, Agente>;
  agentesHabilitados: Agente[];
  onClose: () => void;
  onChanged: () => Promise<void>;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reasignarA, setReasignarA] = useState('');

  const timeline = useMemo(() => {
    const items: { at: string; label: string }[] = [];
    items.push({ at: lead.created_at, label: 'Lead recibido desde seguros.express' });
    if (lead.ultima_expansion_at && lead.ultima_expansion_at !== lead.created_at)
      items.push({ at: lead.ultima_expansion_at, label: `Última expansión de anillo (${lead.anillo_km_actual} km)` });
    if (lead.tope_alcanzado_at) items.push({ at: lead.tope_alcanzado_at, label: 'Alcanzó el tope máximo de km' });
    if (lead.admin_notificado_at) items.push({ at: lead.admin_notificado_at, label: 'Aviso a administradores (sin match)' });
    if (lead.agente_asignado_id && (lead.estado === 'contactado' || lead.estado === 'convertido'))
      items.push({ at: lead.updated_at, label: `Tomado por ${nombreCompleto(agentesById[lead.agente_asignado_id])}` });
    if (lead.estado === 'convertido') items.push({ at: lead.updated_at, label: 'Convertido a contacto en CRM' });
    if (lead.estado === 'expirado') items.push({ at: lead.updated_at, label: 'Lead expirado' });
    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [lead, agentesById]);

  async function accion(rpc: string, params: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc(rpc, params);
      if (error) throw error;
      if (data && data.success === false) {
        showToast(`No se pudo completar: ${data.reason || 'error'}`, 'error');
      } else {
        showToast(okMsg, 'success');
        await onChanged();
        onClose();
      }
    } catch (e: any) {
      showToast(e?.message || 'Error al ejecutar la acción.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const puedeIntervenir = lead.estado !== 'convertido';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{lead.nombre}</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ESTADO_BADGE[lead.estado] || ''}`}>{lead.estado}</span>
            </div>
            <p className="text-sm text-neutral-500 dark:text-white/50">{lead.tipo_seguro_interes || 'Seguro'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>

        {/* Contacto */}
        <div className="mb-4 grid gap-2 rounded-xl border border-neutral-200 p-3 text-sm dark:border-white/10">
          <a href={`tel:${lead.telefono}`} className="flex items-center gap-2 text-neutral-700 hover:text-sky-600 dark:text-white/70"><Phone className="h-4 w-4" /> {lead.telefono}</a>
          {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-neutral-700 hover:text-sky-600 dark:text-white/70"><Mail className="h-4 w-4" /> {lead.email}</a>}
          <span className="flex items-center gap-2 text-neutral-700 dark:text-white/70">
            <MapPin className="h-4 w-4" />
            {lead.direccion_manual || (lead.lat != null ? `GPS: ${lead.lat?.toFixed(4)}, ${lead.lng?.toFixed(4)}` : 'Sin ubicación')}
            {lead.ubicacion_metodo && <span className="text-xs text-neutral-400">({lead.ubicacion_metodo})</span>}
          </span>
        </div>

        {/* Timeline */}
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-white/50"><Clock className="h-3.5 w-3.5" /> Seguimiento</h3>
        <ol className="mb-5 space-y-3 border-l border-neutral-200 pl-4 dark:border-white/10">
          {timeline.map((t, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
              <p className="text-sm text-neutral-800 dark:text-white/80">{t.label}</p>
              <p className="text-xs text-neutral-400">{fmtFechaHora(t.at)}</p>
            </li>
          ))}
        </ol>

        {lead.estado === 'convertido' && lead.crm_contacto_id && (
          <Link
            to={`/mi-crm/contactos/${lead.crm_contacto_id}`}
            className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
          >
            <ExternalLink className="h-4 w-4" /> Ver contacto en CRM
          </Link>
        )}

        {/* Acciones admin */}
        {puedeIntervenir && (
          <div className="rounded-xl border border-neutral-200 p-3 dark:border-white/10">
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-white/50">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Acciones de administrador
            </h3>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[180px]">
                <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-white/50">Reasignar a agente</label>
                <select
                  value={reasignarA}
                  onChange={(e) => setReasignarA(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <option value="">Elegir agente…</option>
                  {agentesHabilitados.map((a) => (
                    <option key={a.id} value={a.id}>{nombreCompleto(a)}</option>
                  ))}
                </select>
              </div>
              <button
                disabled={busy || !reasignarA}
                onClick={() => accion('express_admin_reasignar_lead', { p_lead_id: lead.id, p_agente_id: reasignarA }, 'Lead reasignado.')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
              >
                <ArrowRightLeft className="h-4 w-4" /> Reasignar
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {lead.agente_asignado_id && (
                <button
                  disabled={busy}
                  onClick={() => accion('express_admin_liberar_lead', { p_lead_id: lead.id }, 'Lead liberado al pool.')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
                >
                  <UserPlus className="h-4 w-4" /> Liberar al pool
                </button>
              )}
              {lead.estado !== 'expirado' && (
                <button
                  disabled={busy}
                  onClick={() => accion('express_admin_expirar_lead', { p_lead_id: lead.id }, 'Lead marcado como expirado.')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <Ban className="h-4 w-4" /> Expirar
                </button>
              )}
            </div>
            {busy && <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400"><Loader2 className="h-3 w-3 animate-spin" /> Procesando…</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab: Agentes
// ─────────────────────────────────────────────────────────────────────────
function AgentesTab({
  agentes, leads, onChanged, showToast,
}: {
  agentes: Agente[];
  leads: Lead[];
  onChanged: () => Promise<void>;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [q, setQ] = useState('');
  const [soloHabilitados, setSoloHabilitados] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const statsPorAgente = useMemo(() => {
    const m: Record<string, { tomados: number; convertidos: number }> = {};
    for (const l of leads) {
      if (!l.agente_asignado_id) continue;
      if (!m[l.agente_asignado_id]) m[l.agente_asignado_id] = { tomados: 0, convertidos: 0 };
      m[l.agente_asignado_id].tomados += 1;
      if (l.estado === 'convertido') m[l.agente_asignado_id].convertidos += 1;
    }
    return m;
  }, [leads]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return agentes.filter((a) => {
      if (soloHabilitados && !a.seguros_express_habilitado) return false;
      if (!term) return true;
      return (
        nombreCompleto(a).toLowerCase().includes(term) ||
        (a.email_laboral || '').toLowerCase().includes(term) ||
        (a.celular_laboral || '').toLowerCase().includes(term)
      );
    });
  }, [agentes, q, soloHabilitados]);

  async function toggle(a: Agente) {
    setTogglingId(a.id);
    try {
      const nuevo = !a.seguros_express_habilitado;
      const { error } = await supabase
        .from('usuarios')
        .update({ seguros_express_habilitado: nuevo })
        .eq('id', a.id);
      if (error) throw error;
      showToast(nuevo ? `${nombreCompleto(a)} habilitado.` : `${nombreCompleto(a)} deshabilitado.`, 'success');
      await onChanged();
    } catch (e: any) {
      showToast(e?.message || 'No se pudo actualizar.', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar agente por nombre, email o teléfono…"
            className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-white/70">
          <input
            type="checkbox"
            checked={soloHabilitados}
            onChange={(e) => setSoloHabilitados(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
          />
          Solo habilitados
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-white/[0.03] dark:text-white/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Agente</th>
              <th className="px-4 py-3 font-semibold">Contacto</th>
              <th className="px-4 py-3 font-semibold">Ubicación</th>
              <th className="px-4 py-3 font-semibold text-center">Leads</th>
              <th className="px-4 py-3 font-semibold text-center">Habilitado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
            {filtrados.map((a) => {
              const tieneUbic = a.ubicacion_lat != null && a.ubicacion_lng != null;
              const st = statsPorAgente[a.id];
              return (
                <tr key={a.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900 dark:text-white">{nombreCompleto(a)}</p>
                    <p className="text-xs text-neutral-400">{a.rol}{!a.activo && ' · inactivo'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600 dark:text-white/60">
                    {a.email_laboral && <p>{a.email_laboral}</p>}
                    {a.celular_laboral && <p>{a.celular_laboral}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {tieneUbic || a.ubicacion_direccion_manual ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                        <MapPin className="h-3 w-3" /> {a.ubicacion_direccion_manual ? 'Manual' : 'GPS'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> Sin ubicación
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-neutral-600 dark:text-white/60">
                    {st ? (
                      <span className="inline-flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5 text-indigo-500" /> {st.tomados}
                        <CheckCircle2 className="ml-1.5 h-3.5 w-3.5 text-emerald-500" /> {st.convertidos}
                      </span>
                    ) : <span className="text-neutral-300 dark:text-white/20">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggle(a)}
                      disabled={togglingId === a.id || (!a.activo && !a.seguros_express_habilitado)}
                      title={!a.activo ? 'Usuario inactivo' : ''}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-40 ${
                        a.seguros_express_habilitado ? 'bg-sky-600' : 'bg-neutral-300 dark:bg-white/20'
                      }`}
                    >
                      {togglingId === a.id ? (
                        <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin text-white" />
                      ) : (
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${a.seguros_express_habilitado ? 'translate-x-6' : 'translate-x-1'}`} />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-400">No hay agentes que coincidan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-400 dark:text-white/40">
        Un agente habilitado sin ubicación cargada no recibe leads geolocalizados. La ubicación se carga desde su perfil o desde la ficha del usuario en Directorio.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab: Configuración del motor
// ─────────────────────────────────────────────────────────────────────────
function ConfigTab({
  config, setConfig, usuarioId, showToast,
}: {
  config: Config;
  setConfig: (c: Config) => void;
  usuarioId: string | null;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [saving, setSaving] = useState(false);

  async function guardar() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('express_leads_config')
        .update({
          anillo_km_inicial: config.anillo_km_inicial,
          incremento_km: config.incremento_km,
          intervalo_minutos: config.intervalo_minutos,
          tope_maximo_km: config.tope_maximo_km,
          expiracion_minutos_extra: config.expiracion_minutos_extra,
          activo: config.activo,
          updated_by: usuarioId,
        })
        .eq('id', 1);
      if (error) throw error;
      showToast('Configuración guardada.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Error al guardar.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-white">
          <MapPin className="h-4 w-4 text-sky-600" /> Parámetros del motor de reparto
        </h2>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-white/70">
          <input
            type="checkbox"
            checked={config.activo}
            onChange={(e) => setConfig({ ...config, activo: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
          />
          Motor activo
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS_CONFIG.map((c) => (
          <div key={c.key}>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-white/70">{c.label}</label>
            <input
              type="number"
              min={c.min}
              max={c.max}
              value={config[c.key] as number}
              onChange={(e) => {
                const v = Math.max(c.min, Math.min(c.max, parseInt(e.target.value) || c.min));
                setConfig({ ...config, [c.key]: v });
              }}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <p className="mt-1 text-xs text-neutral-400 dark:text-white/35">{c.help}</p>
          </div>
        ))}
      </div>

      <button
        onClick={guardar}
        disabled={saving}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar configuración
      </button>
    </div>
  );
}
