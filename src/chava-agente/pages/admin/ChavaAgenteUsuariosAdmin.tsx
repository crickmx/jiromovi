import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { ChavaUser, TipoUsuario } from '../../lib/types';
import { TIPO_USUARIO_LABELS } from '../../lib/types';
import { ChavaBrandLogo } from '../../../components/chava/ChavaBrandLogo';
import { Users, Search, Shield, ShieldOff, ListFilter as Filter } from 'lucide-react';

export default function ChavaAgenteUsuariosAdmin() {
  const [users, setUsers] = useState<ChavaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstatus, setFilterEstatus] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [stats, setStats] = useState({ total: 0, activos: 0, bloqueados: 0 });

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase
      .from('chava_agente_users')
      .select('*')
      .order('created_at', { ascending: false });
    const list = (data || []) as ChavaUser[];
    setUsers(list);
    setStats({
      total: list.length,
      activos: list.filter(u => u.estatus === 'activo').length,
      bloqueados: list.filter(u => u.estatus === 'bloqueado').length,
    });
    setLoading(false);
  }

  async function toggleEstatus(user: ChavaUser) {
    const newEstatus = user.estatus === 'activo' ? 'bloqueado' : 'activo';
    await supabase.from('chava_agente_users').update({ estatus: newEstatus }).eq('id', user.id);
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, estatus: newEstatus } : u));
    setStats(prev => ({
      ...prev,
      activos: newEstatus === 'activo' ? prev.activos + 1 : prev.activos - 1,
      bloqueados: newEstatus === 'bloqueado' ? prev.bloqueados + 1 : prev.bloqueados - 1,
    }));
  }

  const filtered = users.filter(u => {
    const matchSearch = !search || u.nombre_completo.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchEstatus = filterEstatus === 'todos' || u.estatus === filterEstatus;
    const matchTipo = filterTipo === 'todos' || u.tipo_usuario === filterTipo;
    return matchSearch && matchEstatus && matchTipo;
  });

  const ESTATUS_BADGE: Record<string, string> = {
    activo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bloqueado: 'bg-red-50 text-red-700 border-red-200',
    pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const ORIGEN_BADGE: Record<string, string> = {
    movi: 'bg-blue-50 text-blue-700 border-blue-200',
    seguwallet: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    externo: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ChavaBrandLogo size="sm" theme="light" showDomain={false} />
          <div className="w-px h-6 bg-slate-200" />
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-500" />
            Usuarios
          </h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">Gestiona los usuarios registrados en la plataforma.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total usuarios', value: stats.total, color: 'text-slate-700' },
          { label: 'Activos', value: stats.activos, color: 'text-emerald-600' },
          { label: 'Bloqueados', value: stats.bloqueados, color: 'text-red-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o email..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-400" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select value={filterEstatus} onChange={e => setFilterEstatus(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none">
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="bloqueado">Bloqueado</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none">
            <option value="todos">Todos los tipos</option>
            {(Object.entries(TIPO_USUARIO_LABELS) as [TipoUsuario, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Usuario', 'Tipo', 'Origen', 'Términos', 'Último acceso', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-sm text-slate-400">Sin resultados</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{u.nombre_completo}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                    {u.whatsapp && <p className="text-xs text-slate-400">{u.whatsapp}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-600">{TIPO_USUARIO_LABELS[u.tipo_usuario as TipoUsuario] || u.tipo_usuario}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border ${ORIGEN_BADGE[u.plataforma_origen] || ORIGEN_BADGE.externo}`}>
                      {u.plataforma_origen}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${u.terminos_aceptados ? 'text-emerald-600' : 'text-red-500'}`}>
                      {u.terminos_aceptados ? `v${u.terminos_version}` : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${ESTATUS_BADGE[u.estatus]}`}>
                      {u.estatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleEstatus(u)}
                      title={u.estatus === 'activo' ? 'Bloquear' : 'Activar'}
                      className={`p-1.5 rounded-lg transition-colors ${u.estatus === 'activo' ? 'text-red-400 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                    >
                      {u.estatus === 'activo' ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
