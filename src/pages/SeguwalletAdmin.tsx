import { useEffect, useState } from 'react';
import { Shield, Plus, Search, Eye, CreditCard as Edit, Lock, Unlock, RotateCcw, Users, ExternalLink, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface SeguwalletCustomer {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  status: 'active' | 'inactive' | 'blocked';
  agent_user_id: string;
  last_login_at: string | null;
  created_at: string;
  sicas_clients_count?: number;
  agent_name?: string;
}

interface CreateFormData {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  agent_user_id: string;
}

export function SeguwalletAdmin() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';
  const [customers, setCustomers] = useState<SeguwalletCustomer[]>([]);
  const [agents, setAgents] = useState<{ id: string; nombre: string; apellidos: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [formData, setFormData] = useState<CreateFormData>({
    full_name: '', email: '', phone: '', password: '', agent_user_id: '',
  });

  useEffect(() => {
    loadCustomers();
    loadAgents();
  }, []);

  const loadCustomers = async () => {
    try {
      const { data } = await supabase
        .from('seguwallet_customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        const enriched = await Promise.all(data.map(async (c) => {
          const { count } = await supabase
            .from('seguwallet_customer_sicas_clients')
            .select('id', { count: 'exact', head: true })
            .eq('seguwallet_customer_id', c.id);

          const { data: agentData } = await supabase
            .from('usuarios')
            .select('nombre, apellidos')
            .eq('id', c.agent_user_id)
            .maybeSingle();

          return {
            ...c,
            sicas_clients_count: count || 0,
            agent_name: agentData ? `${agentData.nombre} ${agentData.apellidos}` : '-',
          };
        }));
        setCustomers(enriched);
      }
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, apellidos')
      .in('rol', ['Agente', 'Administrador', 'Gerente', 'Ejecutivo'])
      .eq('activo', true)
      .order('nombre');

    setAgents(data || []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!formData.full_name.trim() || !formData.email.trim() || !formData.password.trim()) {
      setCreateError('Nombre, correo y contrasena son obligatorios.');
      return;
    }
    if (!formData.agent_user_id) {
      setCreateError('Debes seleccionar un agente responsable.');
      return;
    }

    setCreating(true);
    try {
      // Create auth user via edge function
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-seguwallet-customer`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          created_by: usuario?.id,
          created_by_role: usuario?.rol,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al crear cliente');

      setShowCreateModal(false);
      setFormData({ full_name: '', email: '', phone: '', password: '', agent_user_id: '' });
      loadCustomers();
    } catch (err: any) {
      setCreateError(err.message || 'Error al crear cliente.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (customer: SeguwalletCustomer) => {
    const newStatus = customer.status === 'active' ? 'blocked' : 'active';
    await supabase
      .from('seguwallet_customers')
      .update({ status: newStatus })
      .eq('id', customer.id);
    loadCustomers();
  };

  const handleResetPassword = async (customer: SeguwalletCustomer) => {
    const newPass = prompt('Ingresa la nueva contrasena temporal:');
    if (!newPass) return;

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-seguwallet-customer`;
      await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customer.id,
          auth_user_id: customer.auth_user_id,
          new_password: newPass,
        }),
      });
      alert('Contrasena actualizada.');
    } catch {
      alert('Error al actualizar contrasena.');
    }
  };

  const handlePreview = (customer: SeguwalletCustomer) => {
    // Open Seguwallet preview in a new tab with admin token
    window.open(`/seguwallet/dashboard?preview_customer=${customer.id}`, '_blank');
  };

  const filteredCustomers = customers.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.agent_name?.toLowerCase().includes(q);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return { label: 'Activo', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'blocked': return { label: 'Bloqueado', class: 'bg-red-50 text-red-700 border-red-200' };
      case 'inactive': return { label: 'Inactivo', class: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
      default: return { label: status, class: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
    }
  };

  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-500 shadow-sm">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">Seguwallet</h1>
            <p className="text-xs text-neutral-500 dark:text-white/40">Administracion de clientes</p>
          </div>
        </div>
        <button
          onClick={() => {
            setFormData(prev => ({ ...prev, agent_user_id: isAdmin ? '' : (usuario?.id || '') }));
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent-hover transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Crear Cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] p-4">
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{customers.length}</p>
          <p className="text-xs text-neutral-500 dark:text-white/40">Total clientes</p>
        </div>
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] p-4">
          <p className="text-2xl font-bold text-emerald-600">{customers.filter(c => c.status === 'active').length}</p>
          <p className="text-xs text-neutral-500 dark:text-white/40">Activos</p>
        </div>
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] p-4">
          <p className="text-2xl font-bold text-red-600">{customers.filter(c => c.status === 'blocked').length}</p>
          <p className="text-xs text-neutral-500 dark:text-white/40">Bloqueados</p>
        </div>
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] p-4">
          <p className="text-2xl font-bold text-amber-600">{customers.filter(c => !c.last_login_at).length}</p>
          <p className="text-xs text-neutral-500 dark:text-white/40">Nunca ingresaron</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, correo o agente..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
        />
      </div>

      {/* Table */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] p-12 text-center">
          <Users className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">No hay clientes Seguwallet</p>
          <p className="text-xs text-neutral-400 mt-1">Crea tu primer cliente para comenzar</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40 hidden md:table-cell">Agente</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40 hidden sm:table-cell">SICAS</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40">Estatus</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => {
                  const badge = getStatusBadge(c.status);
                  return (
                    <tr key={c.id} className="border-b border-neutral-50 dark:border-white/[0.03] hover:bg-neutral-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-neutral-900 dark:text-white">{toTitleCase(c.full_name)}</p>
                        <p className="text-xs text-neutral-500 dark:text-white/40">{c.email}</p>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <p className="text-xs text-neutral-600 dark:text-white/50">{toTitleCase(c.agent_name || '')}</p>
                      </td>
                      <td className="px-5 py-3 text-center hidden sm:table-cell">
                        <span className="text-xs font-medium text-neutral-600 dark:text-white/50">{c.sicas_clients_count}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold border", badge.class)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handlePreview(c)} className="p-1.5 rounded-lg text-neutral-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="Vista previa">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleToggleStatus(c)} className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title={c.status === 'active' ? 'Bloquear' : 'Desbloquear'}>
                            {c.status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => handleResetPassword(c)} className="p-1.5 rounded-lg text-neutral-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Resetear contrasena">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200/60 dark:border-white/10 w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Crear Cliente Seguwallet</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{createError}</div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-white/60 mb-1.5">Nombre completo *</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Juan Perez Garcia"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-white/60 mb-1.5">Correo electronico *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="cliente@correo.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-white/60 mb-1.5">Telefono</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="55 1234 5678"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-white/60 mb-1.5">Contrasena temporal *</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Minimo 6 caracteres"
                />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-white/60 mb-1.5">Agente responsable *</label>
                  <select
                    value={formData.agent_user_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, agent_user_id: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">Seleccionar agente...</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.nombre} {a.apellidos}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent-hover transition-all disabled:opacity-50"
                >
                  {creating ? 'Creando...' : 'Crear Cliente'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-white/60 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
