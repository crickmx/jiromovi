import { useEffect, useState, useRef, useCallback } from 'react';
import { Shield, Plus, Search, Eye, CreditCard as Edit, RotateCcw, Users, X, Check, UserPlus, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getAgentSicasClients, searchSicasClientsAdmin, type SicasClientResult } from '@/seguwallet/lib/seguwalletAuth';
import { cn } from '@/lib/utils';

interface SeguwalletCustomer {
  id: string;
  auth_user_id: string;
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

interface Agent {
  id: string;
  nombre: string;
  apellidos: string;
}

type SicasClient = SicasClientResult;

interface CreateFormData {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  agent_user_id: string;
}

interface EditFormData {
  full_name: string;
  phone: string;
  status: 'active' | 'inactive' | 'blocked';
  agent_user_id: string;
}

type ModalType = 'create' | 'edit' | 'sicas' | 'reset' | null;

const toTitleCase = (str: string) => {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
};

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  active: { label: 'Activo', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  blocked: { label: 'Bloqueado', class: 'bg-red-50 text-red-700 border-red-200' },
  inactive: { label: 'Inactivo', class: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
};

export function SeguwalletAdmin() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';

  const [customers, setCustomers] = useState<SeguwalletCustomer[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<SeguwalletCustomer | null>(null);

  // Create
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState<CreateFormData>({
    full_name: '', email: '', phone: '', password: '', agent_user_id: '',
  });

  // Edit
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState<EditFormData>({
    full_name: '', phone: '', status: 'active', agent_user_id: '',
  });

  // SICAS
  const [sicasLoading, setSicasLoading] = useState(false);
  const [availableSicas, setAvailableSicas] = useState<SicasClient[]>([]);
  const [assignedSicas, setAssignedSicas] = useState<any[]>([]);
  const [sicasSearch, setSicasSearch] = useState('');
  const [sicasSaving, setSicasSaving] = useState(false);
  const sicasDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sicasAgentIdRef = useRef<string>('');

  // Reset password
  const [newPassword, setNewPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

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
          const [countRes, agentRes] = await Promise.all([
            supabase
              .from('seguwallet_customer_sicas_clients')
              .select('id', { count: 'exact', head: true })
              .eq('seguwallet_customer_id', c.id),
            supabase
              .from('usuarios')
              .select('nombre, apellidos')
              .eq('id', c.agent_user_id)
              .maybeSingle(),
          ]);
          return {
            ...c,
            sicas_clients_count: countRes.count || 0,
            agent_name: agentRes.data ? `${agentRes.data.nombre} ${agentRes.data.apellidos}` : '-',
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

  const fetchSicasAvailable = useCallback(async (agentUserId: string, query: string) => {
    setSicasLoading(true);
    try {
      const results = isAdmin
        ? await searchSicasClientsAdmin(query, 200, 0)
        : await getAgentSicasClients(agentUserId, query, 200, 0);
      setAvailableSicas(results);
    } catch (err) {
      console.error('Error searching SICAS clients:', err);
      setAvailableSicas([]);
    } finally {
      setSicasLoading(false);
    }
  }, [isAdmin]);

  const loadSicasClients = async (agentUserId: string, customerId: string) => {
    sicasAgentIdRef.current = agentUserId;
    const assignedRes = await supabase
      .from('seguwallet_customer_sicas_clients')
      .select('*')
      .eq('seguwallet_customer_id', customerId);
    setAssignedSicas(assignedRes.data || []);
    await fetchSicasAvailable(agentUserId, '');
  };

  const handleSicasSearchChange = (value: string) => {
    setSicasSearch(value);
    if (sicasDebounceRef.current) clearTimeout(sicasDebounceRef.current);
    sicasDebounceRef.current = setTimeout(() => {
      fetchSicasAvailable(sicasAgentIdRef.current, value);
    }, 350);
  };

  // ── Create ────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!createForm.full_name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setCreateError('Nombre, correo y contrasena son obligatorios.');
      return;
    }
    if (!createForm.agent_user_id) {
      setCreateError('Debes seleccionar un agente responsable.');
      return;
    }
    setCreating(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-seguwallet-customer`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...createForm, created_by: usuario?.id, created_by_role: usuario?.rol }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al crear cliente');
      closeModal();
      setCreateForm({ full_name: '', email: '', phone: '', password: '', agent_user_id: '' });
      loadCustomers();
    } catch (err: any) {
      setCreateError(err.message || 'Error al crear cliente.');
    } finally {
      setCreating(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────
  const openEdit = (customer: SeguwalletCustomer) => {
    setSelectedCustomer(customer);
    setEditForm({ full_name: customer.full_name, phone: customer.phone || '', status: customer.status, agent_user_id: customer.agent_user_id });
    setEditError('');
    setActiveModal('edit');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setEditError('');
    if (!editForm.full_name.trim()) { setEditError('El nombre es obligatorio.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('seguwallet_customers')
        .update({ full_name: editForm.full_name.trim(), phone: editForm.phone.trim(), status: editForm.status, agent_user_id: editForm.agent_user_id })
        .eq('id', selectedCustomer.id);
      if (error) throw error;
      closeModal();
      loadCustomers();
    } catch (err: any) {
      setEditError(err.message || 'Error al guardar cambios.');
    } finally {
      setSaving(false);
    }
  };

  // ── SICAS ─────────────────────────────────────────────────────────
  const openSicas = (customer: SeguwalletCustomer) => {
    setSelectedCustomer(customer);
    setSicasSearch('');
    setAvailableSicas([]);
    setActiveModal('sicas');
    loadSicasClients(customer.agent_user_id, customer.id);
  };

  const isAssigned = (clientId: string) =>
    assignedSicas.some(a => a.sicas_client_id === clientId);

  const handleToggleSicas = async (client: SicasClient) => {
    if (!selectedCustomer) return;
    setSicasSaving(true);
    try {
      if (isAssigned(client.sicas_client_id)) {
        await supabase
          .from('seguwallet_customer_sicas_clients')
          .delete()
          .eq('seguwallet_customer_id', selectedCustomer.id)
          .eq('sicas_client_id', client.sicas_client_id);
        setAssignedSicas(prev => prev.filter(a => a.sicas_client_id !== client.sicas_client_id));
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, sicas_clients_count: Math.max(0, (c.sicas_clients_count || 1) - 1) } : c));
      } else {
        const { data } = await supabase
          .from('seguwallet_customer_sicas_clients')
          .insert({ seguwallet_customer_id: selectedCustomer.id, sicas_client_id: client.sicas_client_id, sicas_client_name: client.client_name, sicas_client_rfc: client.rfc || '', created_by: usuario?.id })
          .select()
          .single();
        if (data) setAssignedSicas(prev => [...prev, data]);
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, sicas_clients_count: (c.sicas_clients_count || 0) + 1 } : c));
      }
    } catch (err) {
      console.error('Error toggling SICAS client:', err);
    } finally {
      setSicasSaving(false);
    }
  };

  // ── Reset password ────────────────────────────────────────────────
  const openReset = (customer: SeguwalletCustomer) => {
    setSelectedCustomer(customer);
    setNewPassword('');
    setResetError('');
    setResetSuccess(false);
    setActiveModal('reset');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (newPassword.length < 6) { setResetError('La contrasena debe tener al menos 6 caracteres.'); return; }
    setResetSaving(true);
    setResetError('');
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-seguwallet-customer`;
      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: selectedCustomer.id, auth_user_id: selectedCustomer.auth_user_id, new_password: newPassword }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al actualizar');
      setResetSuccess(true);
      setNewPassword('');
    } catch (err: any) {
      setResetError(err.message || 'Error al actualizar contrasena.');
    } finally {
      setResetSaving(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedCustomer(null);
    setCreateError('');
    setEditError('');
    setResetError('');
    setResetSuccess(false);
  };

  const filteredCustomers = customers.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.agent_name || '').toLowerCase().includes(q);
  });

  // Server-side search — availableSicas is already filtered
  const filteredSicas = availableSicas;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-accent/30 border-t-accent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#1C37E0] shadow-sm">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">Seguwallet</h1>
            <p className="text-xs text-neutral-500 dark:text-white/40">Administracion de clientes</p>
          </div>
        </div>
        <button
          onClick={() => { setCreateForm(p => ({ ...p, agent_user_id: isAdmin ? '' : (usuario?.id || '') })); setCreateError(''); setActiveModal('create'); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent-hover transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Crear Cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { value: customers.length, label: 'Total clientes', color: 'text-neutral-900 dark:text-white' },
          { value: customers.filter(c => c.status === 'active').length, label: 'Activos', color: 'text-emerald-600' },
          { value: customers.filter(c => c.status === 'blocked').length, label: 'Bloqueados', color: 'text-red-600' },
          { value: customers.filter(c => !c.last_login_at).length, label: 'Nunca ingresaron', color: 'text-amber-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] p-4">
            <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
            <p className="text-xs text-neutral-500 dark:text-white/40">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, correo o agente..." className="w-full pl-11 pr-4 py-3 rounded-2xl border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all" />
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
                {filteredCustomers.map(c => {
                  const badge = STATUS_LABELS[c.status] || STATUS_LABELS.inactive;
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
                        <button onClick={() => openSicas(c)} className="inline-flex items-center gap-1 text-xs font-medium text-[#1C37E0] hover:underline">
                          {c.sicas_clients_count}<UserPlus className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold border", badge.class)}>{badge.label}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => window.open(`/seguwallet/dashboard?preview=${c.id}`, '_blank')} className="p-1.5 rounded-lg text-neutral-400 hover:text-[#1C37E0] hover:bg-blue-50 transition-colors" title="Vista previa"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Editar"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openSicas(c)} className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Asignar SICAS"><UserPlus className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openReset(c)} className="p-1.5 rounded-lg text-neutral-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Cambiar contrasena"><RotateCcw className="w-3.5 h-3.5" /></button>
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

      {/* CREATE MODAL */}
      {activeModal === 'create' && (
        <ModalWrap title="Crear Cliente Seguwallet" onClose={closeModal}>
          {createError && <ErrBox>{createError}</ErrBox>}
          <form onSubmit={handleCreate} className="space-y-4">
            <F label="Nombre completo *"><input type="text" value={createForm.full_name} onChange={e => setCreateForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Juan Perez Garcia" className={inp} /></F>
            <F label="Correo electronico *"><input type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} placeholder="cliente@correo.com" className={inp} /></F>
            <F label="Telefono"><input type="tel" value={createForm.phone} onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))} placeholder="55 1234 5678" className={inp} /></F>
            <F label="Contrasena temporal *"><input type="text" value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} placeholder="Minimo 6 caracteres" className={inp} /></F>
            {isAdmin && (
              <F label="Agente responsable *">
                <select value={createForm.agent_user_id} onChange={e => setCreateForm(p => ({ ...p, agent_user_id: e.target.value }))} className={inp}>
                  <option value="">Seleccionar agente...</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellidos}</option>)}
                </select>
              </F>
            )}
            <Acts><button type="submit" disabled={creating} className={pri}>{creating ? 'Creando...' : 'Crear Cliente'}</button><button type="button" onClick={closeModal} className={sec}>Cancelar</button></Acts>
          </form>
        </ModalWrap>
      )}

      {/* EDIT MODAL */}
      {activeModal === 'edit' && selectedCustomer && (
        <ModalWrap title={`Editar: ${toTitleCase(selectedCustomer.full_name)}`} onClose={closeModal}>
          {editError && <ErrBox>{editError}</ErrBox>}
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <F label="Nombre completo *"><input type="text" value={editForm.full_name} onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} className={inp} /></F>
            <F label="Telefono"><input type="tel" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} className={inp} /></F>
            <F label="Estatus">
              <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as EditFormData['status'] }))} className={inp}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="blocked">Bloqueado</option>
              </select>
            </F>
            {isAdmin && (
              <F label="Agente responsable">
                <select value={editForm.agent_user_id} onChange={e => setEditForm(p => ({ ...p, agent_user_id: e.target.value }))} className={inp}>
                  <option value="">Sin asignar</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellidos}</option>)}
                </select>
              </F>
            )}
            <Acts><button type="submit" disabled={saving} className={pri}>{saving ? 'Guardando...' : 'Guardar Cambios'}</button><button type="button" onClick={closeModal} className={sec}>Cancelar</button></Acts>
          </form>
        </ModalWrap>
      )}

      {/* SICAS MODAL */}
      {activeModal === 'sicas' && selectedCustomer && (
        <ModalWrap title={`Clientes SICAS: ${toTitleCase(selectedCustomer.full_name)}`} onClose={closeModal} wide>
          <p className="text-xs text-neutral-500 mb-4">Selecciona los clientes SICAS del agente que este cliente podra visualizar en su portal.</p>
          <div className="relative mb-4">
            {sicasLoading
              ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#1C37E0] animate-spin" />
              : <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            }
            <input type="text" value={sicasSearch} onChange={e => handleSicasSearchChange(e.target.value)} placeholder="Buscar cliente SICAS..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          {sicasLoading && availableSicas.length === 0 ? (
            <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-blue-200 border-t-[#1C37E0] rounded-full animate-spin" /></div>
          ) : filteredSicas.length === 0 ? (
            <div className="text-center py-8 text-sm text-neutral-400">
              {availableSicas.length === 0
                ? 'Este agente no tiene clientes SICAS. Verifica que el agente este mapeado en SICAS.'
                : 'No se encontraron resultados.'}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {filteredSicas.map(client => {
                const assigned = isAssigned(client.sicas_client_id);
                return (
                  <button key={client.sicas_client_id} onClick={() => handleToggleSicas(client)} disabled={sicasSaving}
                    className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all",
                      assigned ? "bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30"
                        : "bg-white border-neutral-200/60 hover:border-blue-200 hover:bg-blue-50/30 dark:bg-white/[0.02] dark:border-white/10")}>
                    <div>
                      <p className={cn("text-sm font-semibold", assigned ? "text-[#1C37E0]" : "text-neutral-900 dark:text-white")}>{toTitleCase(client.client_name)}</p>
                      {client.rfc && <p className="text-xs text-neutral-400 mt-0.5">{client.rfc}</p>}
                    </div>
                    <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all", assigned ? "bg-[#1C37E0]" : "border-2 border-neutral-200 dark:border-white/20")}>
                      {assigned && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-white/[0.06] flex items-center justify-between">
            <p className="text-xs text-neutral-500">{assignedSicas.length} cliente{assignedSicas.length !== 1 ? 's' : ''} asignado{assignedSicas.length !== 1 ? 's' : ''}</p>
            <button onClick={closeModal} className={pri}>Listo</button>
          </div>
        </ModalWrap>
      )}

      {/* RESET MODAL */}
      {activeModal === 'reset' && selectedCustomer && (
        <ModalWrap title={`Cambiar Contrasena`} onClose={closeModal}>
          <p className="text-xs text-neutral-500 mb-4">{toTitleCase(selectedCustomer.full_name)} · {selectedCustomer.email}</p>
          {resetSuccess ? (
            <div className="flex flex-col items-center py-4 gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center"><Check className="w-6 h-6 text-emerald-600" /></div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">Contrasena actualizada</p>
              <button onClick={closeModal} className={pri}>Cerrar</button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {resetError && <ErrBox>{resetError}</ErrBox>}
              <F label="Nueva contrasena"><input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimo 6 caracteres" className={inp} autoComplete="new-password" /></F>
              <Acts><button type="submit" disabled={resetSaving} className={pri}>{resetSaving ? 'Actualizando...' : 'Actualizar'}</button><button type="button" onClick={closeModal} className={sec}>Cancelar</button></Acts>
            </form>
          )}
        </ModalWrap>
      )}
    </div>
  );
}

// Shared UI helpers
const inp = "w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:text-white transition-all";
const pri = "px-4 py-2.5 rounded-xl bg-[#1C37E0] text-white text-sm font-semibold hover:bg-[#1630C8] transition-all disabled:opacity-50";
const sec = "px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-white/60 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors";

function ModalWrap({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200/60 dark:border-white/10 w-full p-6 max-h-[90vh] overflow-y-auto", wide ? "max-w-2xl" : "max-w-lg")}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-400"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-semibold text-neutral-700 dark:text-white/60 mb-1.5">{label}</label>{children}</div>;
}

function ErrBox({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{children}</div>;
}

function Acts({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3 pt-2">{children}</div>;
}
