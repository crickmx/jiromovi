import { useState, useEffect } from 'react';
import { Search, Sparkles, User, CheckCircle, Save, TrendingUp, Users, DollarSign, Calendar, AlertTriangle, Copy, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { resolveImageUrl } from '../lib/storageUtils';
import { tieneAccesoEquipoMkt } from '../lib/mktUtils';
import { UserModal } from '../components/UserModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type MetodoPago = 'deposito_jiro' | 'bono_anual' | 'comisiones';
type PlanTipo = 'mensual' | 'anual';

interface Agente {
  id: string;
  nombre: string;
  apellidos: string;
  puesto: string;
  imagen_perfil_url: string;
  plan_mkt_premium: boolean;
  mkt_premium_fecha_inicio: string | null;
  mkt_premium_fecha_pago: string | null;
  mkt_premium_plan: PlanTipo | null;
  mkt_premium_metodo_pago: MetodoPago | null;
  oficina: { nombre: string } | null;
}

interface FormData {
  plan_mkt_premium: boolean;
  mkt_premium_plan: PlanTipo | '';
  mkt_premium_metodo_pago: MetodoPago | '';
  mkt_premium_fecha_inicio: string;
  mkt_premium_fecha_pago: string;
}

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: 'deposito_jiro', label: 'Depósito a cuenta Jiro' },
  { value: 'bono_anual', label: 'Descuento de bono anual' },
  { value: 'comisiones', label: 'Descuento a comisiones' },
];

const PLANES: { value: PlanTipo; label: string; precio: string }[] = [
  { value: 'mensual', label: 'Mensual', precio: '$200 MXN/mes' },
  { value: 'anual', label: 'Anual', precio: '$2,000 MXN/año' },
];

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function formatFecha(iso: string | null | undefined) {
  if (!iso) return '—';
  try { return format(new Date(iso), "d 'de' MMMM, yyyy", { locale: es }); } catch { return '—'; }
}

function emptyForm(a?: Agente | null): FormData {
  return {
    plan_mkt_premium: a?.plan_mkt_premium ?? false,
    mkt_premium_plan: a?.mkt_premium_plan ?? '',
    mkt_premium_metodo_pago: a?.mkt_premium_metodo_pago ?? '',
    mkt_premium_fecha_inicio: a?.mkt_premium_fecha_inicio ?? '',
    mkt_premium_fecha_pago: a?.mkt_premium_fecha_pago ?? '',
  };
}

export default function MarketingPremiumAdmin({ embedded }: { embedded?: boolean } = {}) {
  const { usuario } = useAuth();
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloConPremium, setSoloConPremium] = useState(false);

  const [seleccionado, setSeleccionado] = useState<Agente | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [sqlCopiado, setSqlCopiado] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState('');
  const [tieneAcceso, setTieneAcceso] = useState(false);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);

  const [mostrarNuevoAgente, setMostrarNuevoAgente] = useState(false);

  useEffect(() => {
    (async () => {
      if (!usuario) { setVerificandoAcceso(false); return; }
      const acceso = usuario.rol === 'Administrador' || await tieneAccesoEquipoMkt(usuario.id);
      setTieneAcceso(acceso);
      setVerificandoAcceso(false);
    })();
  }, [usuario?.id]);

  useEffect(() => { cargarAgentes(); }, []);

  async function cargarAgentes() {
    setLoading(true);

    // Intentar query completa (requiere que las migraciones estén aplicadas)
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, apellidos, puesto, imagen_perfil_url, plan_mkt_premium, mkt_premium_fecha_inicio, mkt_premium_fecha_pago, mkt_premium_plan, mkt_premium_metodo_pago, oficinas:oficina_id(nombre)')
      .eq('activo', true)
      .order('nombre');

    if (error) {
      // Fallback: columnas base sin campos de detalle premium (migraciones pendientes)
      const { data: fallback } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos, puesto, imagen_perfil_url, plan_mkt_premium, oficinas:oficina_id(nombre)')
        .eq('activo', true)
        .order('nombre');

      setAgentes(
        (fallback ?? []).map((u: any) => ({
          ...u,
          mkt_premium_fecha_inicio: null,
          mkt_premium_fecha_pago: null,
          mkt_premium_plan: null,
          mkt_premium_metodo_pago: null,
          oficina: Array.isArray(u.oficinas) ? u.oficinas[0] ?? null : u.oficinas ?? null,
        }))
      );
      setNeedsMigration(true);
    } else {
      setAgentes(
        (data ?? []).map((u: any) => ({
          ...u,
          oficina: Array.isArray(u.oficinas) ? u.oficinas[0] ?? null : u.oficinas ?? null,
        }))
      );
    }

    setLoading(false);
  }

  function seleccionar(agente: Agente) {
    setSeleccionado(agente);
    setForm(emptyForm(agente));
    setGuardado(false);
  }

  async function crearTramiteCobranzaPremium(agente: Agente) {
    // Obtener el estatus "Iniciado" (o el primero disponible)
    const { data: estatuses } = await supabase
      .from('ticket_estatus')
      .select('id, nombre')
      .eq('activo', true)
      .order('orden');

    const estatus = estatuses?.find(e =>
      e.nombre.toLowerCase().includes('inicia') || e.nombre.toLowerCase().includes('nuevo')
    ) ?? estatuses?.[0];

    if (!estatus || !usuario) return;

    const METODO_LABELS: Record<string, string> = {
      deposito_jiro: 'Depósito a cuenta Jiro',
      bono_anual: 'Descuento de bono anual',
      comisiones: 'Descuento a comisiones',
    };

    const plan = form.mkt_premium_plan ? (form.mkt_premium_plan === 'mensual' ? 'Mensual — $200 MXN/mes' : 'Anual — $2,000 MXN/año') : 'Sin especificar';
    const metodo = form.mkt_premium_metodo_pago ? METODO_LABELS[form.mkt_premium_metodo_pago] : 'Sin especificar';
    const fechaInicio = form.mkt_premium_fecha_inicio || 'Sin especificar';
    const fechaPago = form.mkt_premium_fecha_pago || 'Sin especificar';

    const instrucciones =
      `Cobro de Marketing Premium activado para ${agente.nombre} ${agente.apellidos}.\n` +
      `Plan: ${plan}\n` +
      `Método de pago: ${metodo}\n` +
      `Fecha de inicio: ${fechaInicio}\n` +
      `Fecha de próximo pago: ${fechaPago}\n` +
      `Oficina: ${agente.oficina?.nombre ?? '—'}`;

    await supabase.from('tickets').insert({
      tipo_tramite: 'cobranza',
      prioridad: 'Media',
      instrucciones,
      creado_por: usuario.id,
      modificado_por: usuario.id,
      agente_id: agente.id,
      assigned_to_user_id: usuario.id,
      estatus_id: estatus.id,
    });
  }

  async function guardar() {
    if (!seleccionado) return;

    // Validar que si se activa premium, tenga fechas de inicio y pago
    if (form.plan_mkt_premium && !needsMigration) {
      if (!form.mkt_premium_fecha_inicio || !form.mkt_premium_fecha_pago) {
        setErrorValidacion('Para activar el premium debes seleccionar la fecha de inicio y la fecha de pago.');
        return;
      }
    }
    setErrorValidacion('');

    // Detectar si el premium se está activando (transición false → true)
    const activandoPremium = form.plan_mkt_premium && !seleccionado.plan_mkt_premium;

    setGuardando(true);
    setGuardado(false);

    // Si las columnas de detalle no existen, solo actualizar plan_mkt_premium
    const payload: Record<string, unknown> = {
      plan_mkt_premium: form.plan_mkt_premium,
      updated_at: new Date().toISOString(),
    };
    if (!needsMigration) {
      payload.mkt_premium_plan = form.mkt_premium_plan || null;
      payload.mkt_premium_metodo_pago = form.mkt_premium_metodo_pago || null;
      payload.mkt_premium_fecha_inicio = form.mkt_premium_fecha_inicio || null;
      payload.mkt_premium_fecha_pago = form.mkt_premium_fecha_pago || null;
    }

    const selectCols = needsMigration
      ? 'id, nombre, apellidos, puesto, imagen_perfil_url, plan_mkt_premium, oficinas:oficina_id(nombre)'
      : 'id, nombre, apellidos, puesto, imagen_perfil_url, plan_mkt_premium, mkt_premium_fecha_inicio, mkt_premium_fecha_pago, mkt_premium_plan, mkt_premium_metodo_pago, oficinas:oficina_id(nombre)';

    const { data, error } = await supabase
      .from('usuarios')
      .update(payload)
      .eq('id', seleccionado.id)
      .select(selectCols)
      .single();

    setGuardando(false);

    if (error || !data) {
      setErrorValidacion(error?.message || 'No se pudo guardar — no tienes permiso para modificar a este agente.');
      return;
    }

    const actualizado: Agente = {
      ...data,
      oficina: Array.isArray((data as any).oficinas) ? (data as any).oficinas[0] ?? null : (data as any).oficinas ?? null,
    };
    setSeleccionado(actualizado);
    setAgentes(prev => prev.map(a => a.id === actualizado.id ? actualizado : a));

    // Crear trámite de cobranza solo al activar por primera vez
    if (activandoPremium) {
      await crearTramiteCobranzaPremium(actualizado);
    }

    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  }

  const agenesFiltrados = agentes.filter(a => {
    const coincide = busqueda === '' ||
      norm(`${a.nombre} ${a.apellidos}`).includes(norm(busqueda)) ||
      norm(a.oficina?.nombre ?? '').includes(norm(busqueda));
    return coincide && (!soloConPremium || a.plan_mkt_premium);
  });

  // Estadísticas
  const totalPremium = agentes.filter(a => a.plan_mkt_premium).length;
  const mensuales = agentes.filter(a => a.plan_mkt_premium && a.mkt_premium_plan === 'mensual').length;
  const anuales = agentes.filter(a => a.plan_mkt_premium && a.mkt_premium_plan === 'anual').length;
  const ingresoEstimado = mensuales * 200 + anuales * (2000 / 12);

  const MIGRATION_SQL = `-- Ejecuta esto en Supabase Dashboard → SQL Editor
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS mkt_premium_fecha_inicio date,
  ADD COLUMN IF NOT EXISTS mkt_premium_fecha_pago date,
  ADD COLUMN IF NOT EXISTS mkt_premium_plan text CHECK (mkt_premium_plan IN ('mensual', 'anual')),
  ADD COLUMN IF NOT EXISTS mkt_premium_metodo_pago text CHECK (mkt_premium_metodo_pago IN ('deposito_jiro', 'bono_anual', 'comisiones'));`;

  function copiarSQL() {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setSqlCopiado(true);
    setTimeout(() => setSqlCopiado(false), 2500);
  }

  if (verificandoAcceso) return null;
  if (!tieneAcceso) return null;

  return (
    <>
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          title="Marketing Premium — Gestión"
          description="Administra suscripciones, planes y métodos de pago de los agentes"
          icon={Sparkles}
        />
      )}

      {/* Banner de migración pendiente */}
      {needsMigration && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">Migración de base de datos pendiente</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Las columnas de detalle del plan premium no existen aún. Los agentes se muestran, pero no podrás editar plan, método de pago ni fechas hasta aplicar el siguiente SQL en{' '}
                <strong>Supabase Dashboard → SQL Editor</strong>.
              </p>
            </div>
          </div>
          <div className="relative">
            <pre className="text-xs bg-amber-100 border border-amber-200 rounded-xl p-3 overflow-x-auto text-amber-900 whitespace-pre-wrap">
              {MIGRATION_SQL}
            </pre>
            <button
              onClick={copiarSQL}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-amber-300 text-xs text-amber-800 hover:bg-amber-50 transition"
            >
              <Copy className="w-3 h-3" />
              {sqlCopiado ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>
          <button
            onClick={() => { setNeedsMigration(false); cargarAgentes(); }}
            className="text-xs text-amber-700 underline"
          >
            Ya apliqué la migración — recargar
          </button>
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users, label: 'Con Premium', value: totalPremium, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { icon: TrendingUp, label: 'Plan mensual', value: mensuales, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { icon: Calendar, label: 'Plan anual', value: anuales, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { icon: DollarSign, label: 'Ingreso/mes est.', value: `$${Math.round(ingresoEstimado).toLocaleString()}`, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-2xl border border-neutral-200 dark:border-white/8 ${stat.bg} p-4 flex items-center gap-3`}>
            <div className={`w-9 h-9 rounded-xl bg-white dark:bg-black/20 flex items-center justify-center shrink-0`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-white/50">{stat.label}</p>
              <p className="text-xl font-bold text-neutral-800 dark:text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">

        {/* ── Lista de agentes ── */}
        <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/3 overflow-hidden">
          <div className="p-4 border-b border-neutral-100 dark:border-white/8 space-y-3">
            <button
              onClick={() => setMostrarNuevoAgente(true)}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition"
            >
              <UserPlus className="w-4 h-4" />
              Nuevo agente
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar agente…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-800 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={soloConPremium}
                onChange={e => setSoloConPremium(e.target.checked)}
                className="accent-purple-600 w-4 h-4"
              />
              <span className="text-xs text-neutral-600 dark:text-white/60">Solo con Premium activo</span>
            </label>
          </div>

          <div className="overflow-y-auto max-h-[65vh]">
            {loading ? (
              <LoadingState text="Cargando agentes…" compact />
            ) : agenesFiltrados.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-8">Sin resultados</p>
            ) : (
              agenesFiltrados.map(agente => {
                const activo = seleccionado?.id === agente.id;
                return (
                  <button
                    key={agente.id}
                    onClick={() => seleccionar(agente)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-neutral-100 dark:border-white/5 last:border-0 ${
                      activo ? 'bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-neutral-50 dark:hover:bg-white/4'
                    }`}
                  >
                    {agente.imagen_perfil_url ? (
                      <img
                        src={resolveImageUrl(agente.imagen_perfil_url, 'avatars')}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-neutral-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-800 dark:text-white truncate">
                        {agente.nombre} {agente.apellidos}
                      </p>
                      <p className="text-xs text-neutral-400 truncate">{agente.oficina?.nombre ?? '—'}</p>
                    </div>
                    {agente.plan_mkt_premium && (
                      <CheckCircle className="w-4 h-4 text-purple-500 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Panel de edición ── */}
        {!seleccionado ? (
          <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/3">
            <EmptyState
              icon={Sparkles}
              title="Selecciona un agente"
              description="Elige un agente de la lista para gestionar su suscripción de Marketing Premium."
              compact
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/3 overflow-hidden">
            {/* Cabecera */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100 dark:border-white/8">
              {seleccionado.imagen_perfil_url ? (
                <img
                  src={resolveImageUrl(seleccionado.imagen_perfil_url, 'avatars')}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-neutral-400" />
                </div>
              )}
              <div>
                <p className="font-semibold text-neutral-800 dark:text-white">
                  {seleccionado.nombre} {seleccionado.apellidos}
                </p>
                <p className="text-xs text-neutral-400">{seleccionado.oficina?.nombre ?? '—'} · {seleccionado.puesto}</p>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* Toggle premium */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/3">
                <div>
                  <p className="text-sm font-semibold text-neutral-800 dark:text-white">Plan MKT Premium</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Activa o desactiva el acceso premium</p>
                </div>
                <button
                  onClick={() => { setForm(f => ({ ...f, plan_mkt_premium: !f.plan_mkt_premium })); setErrorValidacion(''); }}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                    form.plan_mkt_premium ? 'bg-purple-600' : 'bg-neutral-300 dark:bg-white/20'
                  }`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    form.plan_mkt_premium ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Plan */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-neutral-500 dark:text-white/50 uppercase tracking-wide">
                    Tipo de plan
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLANES.map(plan => (
                      <button
                        key={plan.value}
                        onClick={() => setForm(f => ({ ...f, mkt_premium_plan: plan.value }))}
                        className={`p-3 rounded-xl border-2 text-left transition ${
                          form.mkt_premium_plan === plan.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-neutral-200 dark:border-white/10 hover:border-purple-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-neutral-800 dark:text-white">{plan.label}</p>
                        <p className="text-xs text-neutral-500 dark:text-white/50">{plan.precio}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Método de pago */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-neutral-500 dark:text-white/50 uppercase tracking-wide">
                    Método de pago
                  </label>
                  <div className="space-y-2">
                    {METODOS.map((metodo, i) => (
                      <button
                        key={metodo.value}
                        onClick={() => setForm(f => ({ ...f, mkt_premium_metodo_pago: metodo.value }))}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition ${
                          form.mkt_premium_metodo_pago === metodo.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-neutral-200 dark:border-white/10 hover:border-purple-300'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          form.mkt_premium_metodo_pago === metodo.value
                            ? 'bg-purple-600 text-white'
                            : 'bg-neutral-200 dark:bg-white/15 text-neutral-500 dark:text-white/50'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="text-sm text-neutral-700 dark:text-white/80">{metodo.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fecha inicio */}
                <div className="space-y-2">
                  <label className={`text-xs font-medium uppercase tracking-wide ${
                    form.plan_mkt_premium && !form.mkt_premium_fecha_inicio
                      ? 'text-red-500'
                      : 'text-neutral-500 dark:text-white/50'
                  }`}>
                    Fecha de inicio {form.plan_mkt_premium && !form.mkt_premium_fecha_inicio && '— requerida'}
                  </label>
                  <input
                    type="date"
                    value={form.mkt_premium_fecha_inicio}
                    onChange={e => { setForm(f => ({ ...f, mkt_premium_fecha_inicio: e.target.value })); setErrorValidacion(''); }}
                    className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-neutral-50 dark:bg-white/5 text-neutral-800 dark:text-white focus:outline-none focus:ring-2 ${
                      form.plan_mkt_premium && !form.mkt_premium_fecha_inicio
                        ? 'border-red-400 focus:ring-red-400'
                        : 'border-neutral-200 dark:border-white/10 focus:ring-purple-400'
                    }`}
                  />
                  {seleccionado.mkt_premium_fecha_inicio && (
                    <p className="text-xs text-neutral-400">Actual: {formatFecha(seleccionado.mkt_premium_fecha_inicio)}</p>
                  )}
                </div>

                {/* Fecha de pago */}
                <div className="space-y-2">
                  <label className={`text-xs font-medium uppercase tracking-wide ${
                    form.plan_mkt_premium && !form.mkt_premium_fecha_pago
                      ? 'text-red-500'
                      : 'text-neutral-500 dark:text-white/50'
                  }`}>
                    Fecha de pago / renovación {form.plan_mkt_premium && !form.mkt_premium_fecha_pago && '— requerida'}
                  </label>
                  <input
                    type="date"
                    value={form.mkt_premium_fecha_pago}
                    onChange={e => { setForm(f => ({ ...f, mkt_premium_fecha_pago: e.target.value })); setErrorValidacion(''); }}
                    className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-neutral-50 dark:bg-white/5 text-neutral-800 dark:text-white focus:outline-none focus:ring-2 ${
                      form.plan_mkt_premium && !form.mkt_premium_fecha_pago
                        ? 'border-red-400 focus:ring-red-400'
                        : 'border-neutral-200 dark:border-white/10 focus:ring-purple-400'
                    }`}
                  />
                  {seleccionado.mkt_premium_fecha_pago && (
                    <p className="text-xs text-neutral-400">Actual: {formatFecha(seleccionado.mkt_premium_fecha_pago)}</p>
                  )}
                </div>
              </div>

              {/* Guardar */}
              <div className="space-y-2 pt-2">
                {errorValidacion && (
                  <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {errorValidacion}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    onClick={guardar}
                    disabled={guardando}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    {guardando ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  {guardado && (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle className="w-4 h-4" /> Guardado
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {mostrarNuevoAgente && (
      <UserModal
        user={null}
        lockRoleToAgente
        onClose={() => setMostrarNuevoAgente(false)}
        onSave={() => { setMostrarNuevoAgente(false); cargarAgentes(); }}
      />
    )}
    </>
  );
}
