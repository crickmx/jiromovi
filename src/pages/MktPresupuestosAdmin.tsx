import { useEffect, useState } from 'react';
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronUp, DollarSign, Wallet,
  TrendingDown, AlertTriangle, Archive, ArchiveRestore, Search, X, User, Building2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';

const PLATAFORMAS = ['Facebook', 'Instagram', 'Google Ads', 'TikTok', 'LinkedIn', 'Otro'];

const PLATAFORMA_COLORS: Record<string, string> = {
  Facebook: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Instagram: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Google Ads': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  TikTok: 'bg-neutral-200 text-neutral-800 dark:bg-white/10 dark:text-white/80',
  LinkedIn: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  Otro: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

interface Gasto {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
}

interface UsuarioSimple {
  id: string;
  nombre: string;
  apellidos: string;
}

interface OficinaSimple {
  id: string;
  nombre: string;
}

interface Campania {
  id: string;
  nombre: string;
  plataforma: string;
  presupuesto_asignado: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  descripcion: string | null;
  usuario_id: string | null;
  oficina_id: string | null;
  activa: boolean;
  gastos: Gasto[];
}

function formatMonto(n: number) {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

function formatFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function UsuarioBuscador({
  usuarios, value, onChange,
}: { usuarios: UsuarioSimple[]; value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const seleccionado = usuarios.find(u => u.id === value);
  const filtrados = usuarios.filter(u => norm(`${u.nombre} ${u.apellidos}`).includes(norm(search)));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm text-left flex items-center justify-between gap-2"
      >
        <span className="truncate">
          {seleccionado ? `${seleccionado.nombre} ${seleccionado.apellidos}` : <span className="text-neutral-400">Sin asignar</span>}
        </span>
        {seleccionado && (
          <X className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-600 shrink-0" onClick={e => { e.stopPropagation(); onChange(null); }} />
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-neutral-100 dark:border-white/5 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar usuario..."
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-neutral-200 dark:border-white/10 rounded-md bg-white dark:bg-white/5 text-neutral-900 dark:text-white"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); setSearch(''); }}
              className="w-full px-3 py-2 text-sm text-left text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/5"
            >
              Sin asignar
            </button>
            {filtrados.slice(0, 50).map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => { onChange(u.id); setOpen(false); setSearch(''); }}
                className={`w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 dark:hover:bg-white/5 ${u.id === value ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' : 'text-neutral-800 dark:text-white/80'}`}
              >
                {u.nombre} {u.apellidos}
              </button>
            ))}
            {filtrados.length === 0 && (
              <p className="text-xs text-neutral-400 text-center py-3">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MktPresupuestosAdmin({ embedded }: { embedded?: boolean } = {}) {
  const { usuario } = useAuth();
  const [campanias, setCampanias] = useState<Campania[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSimple[]>([]);
  const [oficinas, setOficinas] = useState<OficinaSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [soloActivas, setSoloActivas] = useState(true);
  const [expandidaId, setExpandidaId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Campania | null>(null);
  const [nombre, setNombre] = useState('');
  const [plataforma, setPlataforma] = useState(PLATAFORMAS[0]);
  const [presupuesto, setPresupuesto] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [usuarioAsignadoId, setUsuarioAsignadoId] = useState<string | null>(null);
  const [oficinaAsignadaId, setOficinaAsignadaId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const [nuevoGasto, setNuevoGasto] = useState<{ campaniaId: string; fecha: string; concepto: string; monto: string } | null>(null);
  const [guardandoGasto, setGuardandoGasto] = useState(false);

  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    supabase.from('usuarios').select('id, nombre, apellidos').eq('activo', true).order('nombre')
      .then(({ data }) => setUsuarios(data ?? []));
    supabase.from('oficinas').select('id, nombre').order('nombre')
      .then(({ data }) => setOficinas(data ?? []));
  }, []);

  async function cargar() {
    setLoading(true);
    const { data: campaniasData } = await supabase
      .from('mkt_campanias')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: gastosData } = await supabase
      .from('mkt_campania_gastos')
      .select('id, campania_id, fecha, concepto, monto')
      .order('fecha', { ascending: false });

    const gastosPorCampania = new Map<string, Gasto[]>();
    (gastosData ?? []).forEach((g: any) => {
      const lista = gastosPorCampania.get(g.campania_id) ?? [];
      lista.push({ id: g.id, fecha: g.fecha, concepto: g.concepto, monto: Number(g.monto) });
      gastosPorCampania.set(g.campania_id, lista);
    });

    setCampanias(
      (campaniasData ?? []).map((c: any) => ({
        ...c,
        presupuesto_asignado: Number(c.presupuesto_asignado),
        gastos: gastosPorCampania.get(c.id) ?? [],
      }))
    );
    setLoading(false);
  }

  function abrirFormNuevo() {
    setEditando(null);
    setNombre('');
    setPlataforma(PLATAFORMAS[0]);
    setPresupuesto('');
    setFechaInicio('');
    setFechaFin('');
    setDescripcion('');
    setUsuarioAsignadoId(null);
    setOficinaAsignadaId(null);
    setErrorForm('');
    setShowForm(true);
  }

  function abrirFormEditar(c: Campania) {
    setEditando(c);
    setNombre(c.nombre);
    setPlataforma(c.plataforma);
    setPresupuesto(String(c.presupuesto_asignado));
    setFechaInicio(c.fecha_inicio ?? '');
    setFechaFin(c.fecha_fin ?? '');
    setDescripcion(c.descripcion ?? '');
    setUsuarioAsignadoId(c.usuario_id);
    setOficinaAsignadaId(c.oficina_id);
    setErrorForm('');
    setShowForm(true);
  }

  async function guardarCampania() {
    if (!nombre.trim() || !usuario) return;
    if (!usuarioAsignadoId || !oficinaAsignadaId) {
      setErrorForm('Debes asignar un usuario y una oficina a la campaña.');
      return;
    }
    setErrorForm('');
    setGuardando(true);
    const payload = {
      nombre: nombre.trim(),
      plataforma,
      presupuesto_asignado: parseFloat(presupuesto) || 0,
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
      descripcion: descripcion.trim() || null,
      usuario_id: usuarioAsignadoId,
      oficina_id: oficinaAsignadaId,
    };
    if (editando) {
      await supabase.from('mkt_campanias').update(payload).eq('id', editando.id);
    } else {
      await supabase.from('mkt_campanias').insert({ ...payload, created_by: usuario.id });
    }
    setGuardando(false);
    setShowForm(false);
    await cargar();
  }

  async function eliminarCampania(id: string) {
    if (!confirm('¿Eliminar esta campaña? También se borrarán todos sus gastos registrados.')) return;
    await supabase.from('mkt_campanias').delete().eq('id', id);
    await cargar();
  }

  async function toggleActiva(c: Campania) {
    await supabase.from('mkt_campanias').update({ activa: !c.activa }).eq('id', c.id);
    await cargar();
  }

  async function guardarGasto() {
    if (!nuevoGasto || !nuevoGasto.concepto.trim() || !usuario) return;
    setGuardandoGasto(true);
    await supabase.from('mkt_campania_gastos').insert({
      campania_id: nuevoGasto.campaniaId,
      fecha: nuevoGasto.fecha || new Date().toISOString().split('T')[0],
      concepto: nuevoGasto.concepto.trim(),
      monto: parseFloat(nuevoGasto.monto) || 0,
      created_by: usuario.id,
    });
    setGuardandoGasto(false);
    setNuevoGasto(null);
    await cargar();
  }

  async function eliminarGasto(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return;
    await supabase.from('mkt_campania_gastos').delete().eq('id', id);
    await cargar();
  }

  const campaniasVisibles = campanias.filter(c => !soloActivas || c.activa);
  const totalAsignado = campaniasVisibles.reduce((s, c) => s + c.presupuesto_asignado, 0);
  const totalGastado = campaniasVisibles.reduce((s, c) => s + c.gastos.reduce((g, x) => g + x.monto, 0), 0);
  const totalDisponible = totalAsignado - totalGastado;

  if (loading) return <LoadingState text="Cargando presupuestos..." compact />;

  return (
    <div className="space-y-5">
      {!embedded && (
        <div>
          <h1 className="text-lg font-bold text-neutral-900 dark:text-white">Presupuestos de campañas</h1>
          <p className="text-sm text-neutral-500 dark:text-white/50">Control de presupuesto y gasto por campaña de redes sociales</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-purple-50 dark:bg-purple-900/10 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-black/20 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-white/50">Presupuesto asignado</p>
            <p className="text-lg font-bold text-neutral-800 dark:text-white">{formatMonto(totalAsignado)}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-amber-50 dark:bg-amber-900/10 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-black/20 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-white/50">Gastado</p>
            <p className="text-lg font-bold text-neutral-800 dark:text-white">{formatMonto(totalGastado)}</p>
          </div>
        </div>
        <div className={`rounded-2xl border border-neutral-200 dark:border-white/8 p-4 flex items-center gap-3 ${totalDisponible < 0 ? 'bg-red-50 dark:bg-red-900/10' : 'bg-emerald-50 dark:bg-emerald-900/10'}`}>
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-black/20 flex items-center justify-center shrink-0">
            <DollarSign className={`w-5 h-5 ${totalDisponible < 0 ? 'text-red-600' : 'text-emerald-600'}`} />
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-white/50">Disponible</p>
            <p className={`text-lg font-bold ${totalDisponible < 0 ? 'text-red-600' : 'text-neutral-800 dark:text-white'}`}>{formatMonto(totalDisponible)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soloActivas}
            onChange={e => setSoloActivas(e.target.checked)}
            className="accent-purple-600 w-4 h-4"
          />
          <span className="text-sm text-neutral-600 dark:text-white/60">Solo campañas activas</span>
        </label>
        <button
          onClick={abrirFormNuevo}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nueva campaña
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6 space-y-4">
          <h3 className="font-semibold text-neutral-900 dark:text-white">{editando ? 'Editar campaña' : 'Nueva campaña'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Nombre de la campaña</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Campaña Seguro de Auto — Agosto"
                className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Plataforma</label>
              <select
                value={plataforma}
                onChange={e => setPlataforma(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
              >
                {PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Presupuesto asignado (MXN)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={presupuesto}
                onChange={e => setPresupuesto(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Fecha inicio</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Fecha fin</label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={e => setFechaFin(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm"
                />
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${!usuarioAsignadoId ? 'text-red-500' : 'text-neutral-700 dark:text-white/70'}`}>
                Asignar a usuario {!usuarioAsignadoId && '— requerido'}
              </label>
              <UsuarioBuscador usuarios={usuarios} value={usuarioAsignadoId} onChange={setUsuarioAsignadoId} />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${!oficinaAsignadaId ? 'text-red-500' : 'text-neutral-700 dark:text-white/70'}`}>
                Asignar a oficina {!oficinaAsignadaId && '— requerido'}
              </label>
              <select
                value={oficinaAsignadaId ?? ''}
                onChange={e => setOficinaAsignadaId(e.target.value || null)}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm ${!oficinaAsignadaId ? 'border-red-400' : 'border-neutral-200 dark:border-white/10'}`}
              >
                <option value="">Selecciona oficina...</option>
                {oficinas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Descripción (opcional)</label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white text-sm resize-none"
            />
          </div>
          {errorForm && (
            <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorForm}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={guardarCampania}
              disabled={guardando || !nombre.trim() || !usuarioAsignadoId || !oficinaAsignadaId}
              className="bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 px-5 py-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/15 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {campaniasVisibles.length === 0 ? (
        <EmptyState icon={Wallet} title="No hay campañas" description="Crea una campaña para empezar a llevar el control de su presupuesto" compact />
      ) : (
        <div className="space-y-3">
          {campaniasVisibles.map(c => {
            const gastado = c.gastos.reduce((s, g) => s + g.monto, 0);
            const disponible = c.presupuesto_asignado - gastado;
            const porcentaje = c.presupuesto_asignado > 0 ? Math.min(100, (gastado / c.presupuesto_asignado) * 100) : 0;
            const sobrepasado = disponible < 0;
            const expandida = expandidaId === c.id;

            return (
              <div
                key={c.id}
                className={`bg-white dark:bg-white/5 rounded-xl border ${c.activa ? 'border-neutral-200 dark:border-white/10' : 'border-neutral-100 dark:border-white/5 opacity-60'} overflow-hidden`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-neutral-900 dark:text-white">{c.nombre}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATAFORMA_COLORS[c.plataforma] ?? PLATAFORMA_COLORS.Otro}`}>
                          {c.plataforma}
                        </span>
                        {!c.activa && (
                          <span className="text-xs bg-neutral-100 dark:bg-white/10 text-neutral-500 px-2 py-0.5 rounded-full">Archivada</span>
                        )}
                        {sobrepasado && (
                          <span className="flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                            <AlertTriangle className="w-3 h-3" /> Sobre presupuesto
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400">{formatFecha(c.fecha_inicio)} — {formatFecha(c.fecha_fin)}</p>
                      {(c.usuario_id || c.oficina_id) && (
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {c.usuario_id && (() => {
                            const u = usuarios.find(x => x.id === c.usuario_id);
                            return u ? (
                              <span className="flex items-center gap-1 text-xs text-neutral-500 dark:text-white/50">
                                <User className="w-3 h-3" /> {u.nombre} {u.apellidos}
                              </span>
                            ) : null;
                          })()}
                          {c.oficina_id && (() => {
                            const o = oficinas.find(x => x.id === c.oficina_id);
                            return o ? (
                              <span className="flex items-center gap-1 text-xs text-neutral-500 dark:text-white/50">
                                <Building2 className="w-3 h-3" /> {o.nombre}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      )}
                      {c.descripcion && <p className="text-xs text-neutral-500 dark:text-white/50 mt-1">{c.descripcion}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => toggleActiva(c)} className="p-2 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors" title={c.activa ? 'Archivar' : 'Reactivar'}>
                        {c.activa ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                      </button>
                      <button onClick={() => abrirFormEditar(c)} className="p-2 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => eliminarCampania(c.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-white/50 mb-1">
                      <span>{formatMonto(gastado)} gastado de {formatMonto(c.presupuesto_asignado)}</span>
                      <span className={sobrepasado ? 'text-red-600 font-medium' : ''}>{formatMonto(disponible)} disponible</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${sobrepasado ? 'bg-red-500' : porcentaje > 80 ? 'bg-amber-500' : 'bg-purple-500'}`}
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandidaId(expandida ? null : c.id)}
                    className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium mt-3"
                  >
                    {expandida ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {c.gastos.length} {c.gastos.length === 1 ? 'gasto registrado' : 'gastos registrados'}
                  </button>
                </div>

                {expandida && (
                  <div className="border-t border-neutral-100 dark:border-white/5 p-4 bg-neutral-50 dark:bg-white/3 space-y-2">
                    {c.gastos.length === 0 && (
                      <p className="text-xs text-neutral-400 text-center py-2">Sin gastos registrados todavía</p>
                    )}
                    {c.gastos.map(g => (
                      <div key={g.id} className="flex items-center justify-between bg-white dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/10 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-neutral-800 dark:text-white/80 truncate">{g.concepto}</p>
                          <p className="text-xs text-neutral-400">{formatFecha(g.fecha)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-medium text-neutral-700 dark:text-white/70">{formatMonto(g.monto)}</span>
                          <button onClick={() => eliminarGasto(g.id)} className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {nuevoGasto?.campaniaId === c.id ? (
                      <div className="bg-white dark:bg-white/5 rounded-lg border border-purple-200 dark:border-purple-800 p-3 space-y-2 mt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px] gap-2">
                          <input
                            type="text"
                            value={nuevoGasto.concepto}
                            onChange={e => setNuevoGasto(g => g && { ...g, concepto: e.target.value })}
                            placeholder="Concepto (ej. Anuncio 5-11 ago)"
                            className="px-2.5 py-1.5 text-sm border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white"
                          />
                          <input
                            type="date"
                            value={nuevoGasto.fecha}
                            onChange={e => setNuevoGasto(g => g && { ...g, fecha: e.target.value })}
                            className="px-2.5 py-1.5 text-sm border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white"
                          />
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={nuevoGasto.monto}
                            onChange={e => setNuevoGasto(g => g && { ...g, monto: e.target.value })}
                            placeholder="Monto"
                            className="px-2.5 py-1.5 text-sm border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={guardarGasto}
                            disabled={guardandoGasto || !nuevoGasto.concepto.trim()}
                            className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                          >
                            {guardandoGasto ? 'Guardando...' : 'Agregar gasto'}
                          </button>
                          <button
                            onClick={() => setNuevoGasto(null)}
                            className="bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-white/60 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-neutral-200 dark:hover:bg-white/15"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setNuevoGasto({ campaniaId: c.id, fecha: new Date().toISOString().split('T')[0], concepto: '', monto: '' })}
                        className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium mt-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar gasto
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
