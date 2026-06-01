import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';
import {
  Users, Plus, Search, Trash2, Save, X, Mail, Phone,
  Building2, Calendar, ListFilter as Filter, Shield, CreditCard,
  UserCheck, Briefcase, RefreshCw,
} from 'lucide-react';

type FuenteContacto = 'email' | 'crm' | 'seguwallet' | 'manual';

interface ContactoUnificado {
  id: string;
  nombre: string;
  email: string;
  celular: string | null;
  empresa: string | null;
  fuente: FuenteContacto;
  fuente_id: string;
  ultima_interaccion: string | null;
  estatus: string | null;
  cantidad_emails?: number;
  seguwallet_activo?: boolean;
}

type FiltroFuente = 'todos' | FuenteContacto;

const FUENTE_LABEL: Record<FuenteContacto, string> = {
  email: 'Correo',
  crm: 'CRM',
  seguwallet: 'Seguwallet',
  manual: 'Manual',
};

const FUENTE_COLOR: Record<FuenteContacto, string> = {
  email: 'bg-blue-100 text-blue-700',
  crm: 'bg-amber-100 text-amber-700',
  seguwallet: 'bg-green-100 text-green-700',
  manual: 'bg-neutral-100 text-neutral-700',
};

const FUENTE_ICON: Record<FuenteContacto, React.ElementType> = {
  email: Mail,
  crm: Briefcase,
  seguwallet: Shield,
  manual: UserCheck,
};

export function Contactos() {
  const { usuario } = useAuth();
  const [allContactos, setAllContactos] = useState<ContactoUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroFuente, setFiltroFuente] = useState<FiltroFuente>('todos');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    celular: '',
    empresa: '',
    comentarios: '',
  });

  useEffect(() => {
    if (usuario) {
      loadAllContactos();
    }
  }, [usuario]);

  const loadAllContactos = async (isRefresh = false) => {
    if (!usuario) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const isAdmin = usuario.rol === 'Administrador';
      const isGerente = usuario.rol === 'Gerente' || usuario.rol === 'Ejecutivo';

      const results = await Promise.allSettled([
        fetchEmailContactos(usuario.id),
        fetchCRMContactos(usuario.id, isAdmin, isGerente),
        fetchSeguwalletClientes(usuario.id, isAdmin, isGerente),
      ]);

      const emailContacts = results[0].status === 'fulfilled' ? results[0].value : [];
      const crmContacts = results[1].status === 'fulfilled' ? results[1].value : [];
      const swContacts = results[2].status === 'fulfilled' ? results[2].value : [];

      // Deduplicate by email: CRM > Seguwallet > email-sync > manual
      const byEmail = new Map<string, ContactoUnificado>();

      const addContact = (c: ContactoUnificado) => {
        const key = c.email.toLowerCase().trim();
        if (!key) {
          byEmail.set(c.id, c);
          return;
        }
        const existing = byEmail.get(key);
        if (!existing) {
          byEmail.set(key, c);
          return;
        }
        const priority: FuenteContacto[] = ['crm', 'seguwallet', 'email', 'manual'];
        if (priority.indexOf(c.fuente) < priority.indexOf(existing.fuente)) {
          byEmail.set(key, c);
        }
      };

      [...emailContacts, ...crmContacts, ...swContacts].forEach(addContact);

      const unified = Array.from(byEmail.values()).sort((a, b) => {
        const da = a.ultima_interaccion ? new Date(a.ultima_interaccion).getTime() : 0;
        const db = b.ultima_interaccion ? new Date(b.ultima_interaccion).getTime() : 0;
        if (db !== da) return db - da;
        return a.nombre.localeCompare(b.nombre);
      });

      setAllContactos(unified);
    } catch (err) {
      console.error('Error cargando contactos:', err);
      setMessage({ type: 'error', text: 'Error al cargar contactos' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchEmailContactos = async (userId: string): Promise<ContactoUnificado[]> => {
    const { data, error } = await supabase
      .from('contactos')
      .select('id, nombre, apellido, email, celular, empresa, origen, ultima_interaccion, cantidad_emails')
      .eq('usuario_id', userId)
      .order('ultima_interaccion', { ascending: false, nullsFirst: false });

    if (error) return [];
    return (data || []).map(c => ({
      id: c.id,
      nombre: `${c.nombre || ''} ${c.apellido || ''}`.trim() || c.email,
      email: c.email,
      celular: c.celular,
      empresa: c.empresa,
      fuente: c.origen === 'manual' ? 'manual' : 'email',
      fuente_id: c.id,
      ultima_interaccion: c.ultima_interaccion,
      estatus: null,
      cantidad_emails: c.cantidad_emails,
    }));
  };

  const fetchCRMContactos = async (userId: string, isAdmin: boolean, isGerente: boolean): Promise<ContactoUnificado[]> => {
    let query = supabase
      .from('crm_contactos')
      .select('id, nombre_completo, email, celular, tipo_contacto, estatus, fecha_creacion, creado_por')
      .order('fecha_creacion', { ascending: false });

    if (!isAdmin) {
      if (isGerente) {
        // Gerente sees contacts from their office — filter by users in same office
        const { data: officeUsers } = await supabase
          .from('usuarios')
          .select('id')
          .eq('oficina_id', (usuario as any).oficina_id);
        const ids = (officeUsers || []).map(u => u.id);
        if (ids.length > 0) query = query.in('creado_por', ids);
        else return [];
      } else {
        query = query.eq('creado_por', userId);
      }
    }

    const { data, error } = await query;
    if (error) return [];
    return (data || []).map(c => ({
      id: `crm_${c.id}`,
      nombre: c.nombre_completo || 'Sin nombre',
      email: c.email || '',
      celular: c.celular,
      empresa: null,
      fuente: 'crm' as FuenteContacto,
      fuente_id: c.id,
      ultima_interaccion: c.fecha_creacion,
      estatus: c.estatus,
    }));
  };

  const fetchSeguwalletClientes = async (userId: string, isAdmin: boolean, isGerente: boolean): Promise<ContactoUnificado[]> => {
    let query = supabase
      .from('seguwallet_customers')
      .select('id, full_name, email, phone, status, created_at, agent_user_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      if (isGerente) {
        const { data: officeUsers } = await supabase
          .from('usuarios')
          .select('id')
          .eq('oficina_id', (usuario as any).oficina_id);
        const ids = (officeUsers || []).map(u => u.id);
        if (ids.length > 0) query = query.in('agent_user_id', ids);
        else return [];
      } else {
        query = query.eq('agent_user_id', userId);
      }
    }

    const { data, error } = await query;
    if (error) return [];
    return (data || []).map(c => ({
      id: `sw_${c.id}`,
      nombre: c.full_name || 'Sin nombre',
      email: c.email || '',
      celular: c.phone,
      empresa: null,
      fuente: 'seguwallet' as FuenteContacto,
      fuente_id: c.id,
      ultima_interaccion: c.created_at,
      estatus: c.status,
      seguwallet_activo: c.status === 'active',
    }));
  };

  const filteredContactos = useMemo(() => {
    let list = allContactos;

    if (filtroFuente !== 'todos') {
      list = list.filter(c => c.fuente === filtroFuente);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        c =>
          c.nombre.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.empresa?.toLowerCase().includes(q) ||
          c.celular?.includes(q)
      );
    }

    return list;
  }, [allContactos, searchQuery, filtroFuente]);

  const counts = useMemo(() => ({
    total: allContactos.length,
    email: allContactos.filter(c => c.fuente === 'email').length,
    crm: allContactos.filter(c => c.fuente === 'crm').length,
    seguwallet: allContactos.filter(c => c.fuente === 'seguwallet').length,
    manual: allContactos.filter(c => c.fuente === 'manual').length,
  }), [allContactos]);

  const handleSaveContacto = async () => {
    if (!usuario) return;
    if (!formData.email.trim()) {
      setMessage({ type: 'error', text: 'El email es obligatorio' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase.from('contactos').insert({
        usuario_id: usuario.id,
        nombre: formData.nombre.trim() || null,
        apellido: formData.apellido.trim() || null,
        email: formData.email.trim().toLowerCase(),
        celular: formData.celular.trim() || null,
        empresa: formData.empresa.trim() || null,
        comentarios: formData.comentarios.trim() || null,
        origen: 'manual',
      });
      if (error) {
        if (error.code === '23505') throw new Error('Ya existe un contacto con este email');
        throw error;
      }
      setMessage({ type: 'success', text: 'Contacto agregado exitosamente' });
      setShowModal(false);
      loadAllContactos(true);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al guardar contacto' });
    } finally {
      setSaving(false);
    }
  };

  const formatFecha = (fecha: string | null) => {
    if (!fecha) return 'Sin registro';
    const date = new Date(fecha);
    const now = new Date();
    const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days} días`;
    if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
    if (days < 365) return `Hace ${Math.floor(days / 30)} meses`;
    return `Hace ${Math.floor(days / 365)} años`;
  };

  if (loading) return <LoadingState text="Cargando contactos..." />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden">
        <PageHeader
          title="Contactos"
          description="Vista unificada de todos tus contactos: CRM, Seguwallet y correo"
          icon={Users}
        >
          <Button variant="outline" onClick={() => loadAllContactos(true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>
          <Button onClick={() => {
            setFormData({ nombre: '', apellido: '', email: '', celular: '', empresa: '', comentarios: '' });
            setShowModal(true);
          }}>
            <Plus className="w-4 h-4" />
            <span>Nuevo Contacto</span>
          </Button>
        </PageHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b border-neutral-200 dark:border-white/10">
          {((['crm', 'seguwallet', 'email', 'manual'] as FuenteContacto[])).map(fuente => {
            const Icon = FUENTE_ICON[fuente];
            const count = counts[fuente];
            return (
              <button
                key={fuente}
                onClick={() => setFiltroFuente(filtroFuente === fuente ? 'todos' : fuente)}
                className={`p-4 rounded-xl border transition text-left ${
                  filtroFuente === fuente
                    ? 'border-accent bg-accent/5'
                    : 'border-neutral-200 dark:border-white/10 hover:border-accent/50 hover:bg-neutral-50 dark:hover:bg-white/3'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-neutral-500 dark:text-white/40" />
                  <span className="text-xs font-medium text-neutral-500 dark:text-white/40">{FUENTE_LABEL[fuente]}</span>
                </div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{count}</p>
              </button>
            );
          })}
        </div>

        {/* Search & filter bar */}
        <div className="p-6 border-b border-neutral-200 dark:border-white/10">
          {message && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, email, teléfono..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-neutral-500 dark:text-white/40 shrink-0" />
              <select
                value={filtroFuente}
                onChange={e => setFiltroFuente(e.target.value as FiltroFuente)}
                className="px-4 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
              >
                <option value="todos">Todas las fuentes ({counts.total})</option>
                <option value="crm">CRM ({counts.crm})</option>
                <option value="seguwallet">Seguwallet ({counts.seguwallet})</option>
                <option value="email">Correo ({counts.email})</option>
                <option value="manual">Manual ({counts.manual})</option>
              </select>
            </div>
          </div>

          <p className="mt-3 text-sm text-neutral-500 dark:text-white/40">
            Mostrando {filteredContactos.length} de {counts.total} contactos
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {filteredContactos.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-16 h-16 text-neutral-300 dark:text-white/20 mx-auto mb-4" />
              <p className="font-semibold text-neutral-600 dark:text-white/60">No hay contactos</p>
              <p className="text-sm text-neutral-500 dark:text-white/40 mt-1">
                {searchQuery || filtroFuente !== 'todos'
                  ? 'No se encontraron contactos con ese criterio'
                  : 'Agrega un contacto manual o sincroniza tus módulos'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-white/3 border-b border-neutral-200 dark:border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">Teléfono</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">Estatus</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">Última actividad</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">Fuente</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-transparent divide-y divide-neutral-200 dark:divide-white/10">
                {filteredContactos.map(c => {
                  const FuenteIcon = FUENTE_ICON[c.fuente];
                  const initials = c.nombre.slice(0, 2).toUpperCase();
                  return (
                    <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-white/3 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                            <span className="text-accent font-semibold text-sm">{initials}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900 dark:text-white text-sm">{c.nombre}</p>
                            {c.empresa && (
                              <p className="text-xs text-neutral-500 dark:text-white/40 flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {c.empresa}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {c.email ? (
                          <div className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-white/60">
                            <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="truncate max-w-[200px]">{c.email}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 dark:text-white/30 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {c.celular ? (
                          <div className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-white/60">
                            <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            {c.celular}
                          </div>
                        ) : (
                          <span className="text-neutral-400 dark:text-white/30 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {c.estatus ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70">
                            {c.estatus === 'active' ? 'Activo' : c.estatus === 'inactive' ? 'Inactivo' : c.estatus}
                          </span>
                        ) : (
                          <span className="text-neutral-400 dark:text-white/30 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-white/40">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatFecha(c.ultima_interaccion)}
                          {c.cantidad_emails != null && c.cantidad_emails > 0 && (
                            <span className="ml-1 text-xs">· {c.cantidad_emails} emails</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${FUENTE_COLOR[c.fuente]}`}>
                          <FuenteIcon className="w-3 h-3" />
                          {FUENTE_LABEL[c.fuente]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* New contact modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-lg w-full my-8 flex flex-col">
            <div className="bg-neutral-50 dark:bg-white/3 px-6 py-4 flex items-center justify-between rounded-t-2xl border-b border-neutral-200 dark:border-white/10">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Nuevo Contacto Manual</h2>
              <button onClick={() => setShowModal(false)} className="text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 p-2 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-1.5">Nombre</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-1.5">Apellido</label>
                  <input
                    type="text"
                    value={formData.apellido}
                    onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                    className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
                    placeholder="Pérez"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
                  placeholder="juan@ejemplo.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-1.5">Celular</label>
                  <input
                    type="tel"
                    value={formData.celular}
                    onChange={e => setFormData({ ...formData, celular: e.target.value })}
                    className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
                    placeholder="+52 555 123 4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-1.5">Empresa</label>
                  <input
                    type="text"
                    value={formData.empresa}
                    onChange={e => setFormData({ ...formData, empresa: e.target.value })}
                    className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
                    placeholder="Empresa S.A."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-1.5">Comentarios</label>
                <textarea
                  value={formData.comentarios}
                  onChange={e => setFormData({ ...formData, comentarios: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
                  placeholder="Notas adicionales..."
                />
              </div>

              {message && (
                <div className={`px-3 py-2.5 rounded-lg text-sm ${
                  message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {message.text}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-neutral-50 dark:bg-white/3 border-t border-neutral-200 dark:border-white/10 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-white/70 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveContacto}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition text-sm font-medium disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contactos;
