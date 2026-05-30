import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Users, Phone, Mail, Wallet, X,
  LayoutGrid, List, Eye, UserPlus, ChevronDown,
  BadgeCheck, Clock, Ban, Wifi, WifiOff, CheckCircle,
  Pencil, Database, Trash2, AlertTriangle, Loader2, User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { PageHeader } from '@/components/ui/page-header';
import type { UnifiedContacto } from '../lib/contactosTypes';
import type { CRMContacto } from '../lib/crmTypes';
import ContactoModal from '../components/crm/ContactoModal';
import ActivarSeguwalletModal from '../components/contactos/ActivarSeguwalletModal';
import AsignarSicasModal from '../components/contactos/AsignarSicasModal';
import { obtenerContactoPorId } from '../lib/crmUtils';

const ESTATUS_OPTIONS = [
  { value: '', label: 'Todos los estatus' },
  { value: 'Prospecto', label: 'Prospecto' },
  { value: 'Cliente', label: 'Cliente' },
];

const SW_FILTER_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'con_seguwallet', label: 'Con Seguwallet' },
  { value: 'sin_seguwallet', label: 'Sin Seguwallet' },
];

export default function ContactosCRM() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();
  const isAdmin = usuario?.rol === 'Administrador';
  const [contactos, setContactos] = useState<UnifiedContacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterEstatus, setFilterEstatus] = useState('');
  const [filterSeguwallet, setFilterSeguwallet] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showContactoModal, setShowContactoModal] = useState(false);
  const [editContacto, setEditContacto] = useState<CRMContacto | null>(null);
  const [editContactoSwId, setEditContactoSwId] = useState<string | null>(null);
  const [showActivarSW, setShowActivarSW] = useState<UnifiedContacto | null>(null);
  const [showAsignarSicas, setShowAsignarSicas] = useState<UnifiedContacto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnifiedContacto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState({ total: 0, conSW: 0, clientes: 0, prospectos: 0 });

  const isAdminOrGerente = ['Administrador', 'Gerente'].includes(usuario?.rol || '');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadContactos = useCallback(async () => {
    setLoading(true);
    try {
      const hasSW =
        filterSeguwallet === 'con_seguwallet' ? true
        : filterSeguwallet === 'sin_seguwallet' ? false
        : null;

      const { data, error } = await supabase.rpc('get_unified_contactos', {
        p_user_id: usuario?.id ?? null,
        p_search: debouncedSearch || null,
        p_estatus: filterEstatus || null,
        p_has_seguwallet: hasSW,
        p_limit: 200,
        p_offset: 0,
      });

      if (error) throw error;
      const rows = (data || []) as UnifiedContacto[];
      setContactos(rows);
      setStats({
        total: rows.length,
        conSW: rows.filter((c) => c.seguwallet_customer_id).length,
        clientes: rows.filter((c) => c.estatus === 'Cliente').length,
        prospectos: rows.filter((c) => c.estatus === 'Prospecto').length,
      });
    } catch (err) {
      console.error('Error loading contactos:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterEstatus, filterSeguwallet]);

  useEffect(() => {
    loadContactos();
  }, [loadContactos]);

  const getEstatusStyle = (estatus: string) => {
    switch (estatus) {
      case 'Prospecto': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Cliente': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default: return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-white/50';
    }
  };

  const timeSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'hace minutos';
    if (h < 24) return `hace ${h}h`;
    const d = Math.floor(h / 24);
    return `hace ${d}d`;
  };

  const openEdit = async (c: UnifiedContacto) => {
    if (c.source !== 'crm') return;
    try {
      const data = await obtenerContactoPorId(c.id);
      setEditContacto(data);
      setEditContactoSwId(c.seguwallet_customer_id);
    } catch {
      navigate(`/mi-crm/contactos/${c.id}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('crm_contactos')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null);
      loadContactos();
    } catch (err: any) {
      console.error('Error eliminando contacto:', err);
      alert(`No se pudo eliminar: ${err.message || 'Error desconocido'}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Contactos"
        description={`${stats.total} contactos`}
        icon={Users}
        actions={
          <button
            onClick={() => setShowContactoModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition text-sm font-medium shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo Contacto
          </button>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', value: stats.total, Icon: Users, color: 'text-neutral-600 dark:text-white/70', bg: 'bg-neutral-50 dark:bg-neutral-800' },
          { label: 'Prospectos', value: stats.prospectos, Icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Clientes', value: stats.clientes, Icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Con Seguwallet', value: stats.conSW, Icon: Wallet, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/20' },
        ].map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`h-4.5 w-4.5 ${color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-neutral-900 dark:text-white leading-none">{value}</p>
              <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 mb-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select
                value={filterEstatus}
                onChange={(e) => setFilterEstatus(e.target.value)}
                className="appearance-none pl-3 pr-7 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
              >
                {ESTATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filterSeguwallet}
                onChange={(e) => setFilterSeguwallet(e.target.value)}
                className="appearance-none pl-3 pr-7 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
              >
                {SW_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
            </div>
            {(filterEstatus || filterSeguwallet || search) && (
              <button
                onClick={() => { setSearch(''); setFilterEstatus(''); setFilterSeguwallet(''); }}
                className="flex items-center gap-1 px-2.5 py-2 text-xs text-neutral-500 hover:text-neutral-700 dark:text-white/50 dark:hover:text-white/80 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
              >
                <X className="h-3 w-3" />
                Limpiar
              </button>
            )}
            <div className="hidden sm:flex items-center border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 transition ${viewMode === 'table' ? 'bg-accent/10 text-accent' : 'text-neutral-400 hover:text-neutral-600 dark:text-white/40 dark:hover:text-white/70'}`}
                title="Vista tabla"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 transition ${viewMode === 'cards' ? 'bg-accent/10 text-accent' : 'text-neutral-400 hover:text-neutral-600 dark:text-white/40 dark:hover:text-white/70'}`}
                title="Vista tarjetas"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
        </div>
      ) : contactos.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 py-16 text-center">
          <Users className="h-10 w-10 text-neutral-300 dark:text-white/20 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-600 dark:text-white/70">No se encontraron contactos</p>
          <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">Ajusta los filtros o agrega un nuevo contacto</p>
          <button
            onClick={() => setShowContactoModal(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-accent bg-accent/10 rounded-lg hover:bg-accent/15 transition"
          >
            <Plus className="h-4 w-4" />
            Agregar Contacto
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <TableView
          contactos={contactos}
          isAdminOrGerente={isAdminOrGerente}
          getEstatusStyle={getEstatusStyle}
          timeSince={timeSince}
          onView={(c) => navigate(`/mi-crm/contactos/${c.id}`)}
          onEdit={openEdit}
          onActivarSW={setShowActivarSW}
          onAsignarSicas={setShowAsignarSicas}
          onDelete={setDeleteTarget}
        />
      ) : (
        <CardsView
          contactos={contactos}
          isAdminOrGerente={isAdminOrGerente}
          isAdmin={isAdmin}
          getEstatusStyle={getEstatusStyle}
          timeSince={timeSince}
          onView={(c) => navigate(`/mi-crm/contactos/${c.id}`)}
          onEdit={openEdit}
          onActivarSW={setShowActivarSW}
          onAsignarSicas={setShowAsignarSicas}
          onDelete={setDeleteTarget}
          onImpersonate={async (c) => {
            if (c.seguwallet_customer_id) {
              const ok = await startImpersonation({ platform: 'seguwallet', customerId: c.seguwallet_customer_id });
              if (ok) navigate('/seguwallet/dashboard');
            }
          }}
        />
      )}

      {showContactoModal && (
        <ContactoModal
          contacto={null}
          onClose={() => setShowContactoModal(false)}
          onSave={() => { setShowContactoModal(false); loadContactos(); }}
        />
      )}

      {editContacto && (
        <ContactoModal
          contacto={editContacto}
          seguwalletCustomerId={editContactoSwId}
          onClose={() => { setEditContacto(null); setEditContactoSwId(null); }}
          onSave={() => { setEditContacto(null); setEditContactoSwId(null); loadContactos(); }}
        />
      )}

      {showActivarSW && (
        <ActivarSeguwalletModal
          contacto={showActivarSW}
          onClose={() => setShowActivarSW(null)}
          onSuccess={() => { setShowActivarSW(null); loadContactos(); }}
        />
      )}

      {showAsignarSicas && showAsignarSicas.seguwallet_customer_id && (
        <AsignarSicasModal
          contacto={showAsignarSicas}
          onClose={() => setShowAsignarSicas(null)}
          onSave={() => { setShowAsignarSicas(null); loadContactos(); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Eliminar contacto</h3>
                <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5">Esta accion no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-neutral-700 dark:text-white/80 mb-5">
              ¿Estas seguro que deseas eliminar a{' '}
              <span className="font-semibold text-neutral-900 dark:text-white">{deleteTarget.nombre_completo}</span>?
              Se perderan todos sus datos, tareas y notas asociadas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-white/70 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Seguwallet Badge ────────────────────────────────────────────────────────

function SeguwalletBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-white/40">
        <WifiOff className="h-2.5 w-2.5" />
        Sin SW
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
        <Wifi className="h-2.5 w-2.5" />
        Seguwallet
      </span>
    );
  }
  if (status === 'blocked') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <Ban className="h-2.5 w-2.5" />
        Bloqueado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      <Clock className="h-2.5 w-2.5" />
      SW Inactivo
    </span>
  );
}

// ─── Table View ──────────────────────────────────────────────────────────────

function TableView({
  contactos, isAdminOrGerente, getEstatusStyle, timeSince, onView, onEdit, onActivarSW, onAsignarSicas, onDelete,
}: {
  contactos: UnifiedContacto[];
  isAdminOrGerente: boolean;
  getEstatusStyle: (e: string) => string;
  timeSince: (d: string) => string;
  onView: (c: UnifiedContacto) => void;
  onEdit: (c: UnifiedContacto) => void;
  onActivarSW: (c: UnifiedContacto) => void;
  onAsignarSicas: (c: UnifiedContacto) => void;
  onDelete: (c: UnifiedContacto) => void;
}) {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider">Contacto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider">Estatus</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider hidden md:table-cell">Seguwallet</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider hidden lg:table-cell">SICAS</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider hidden lg:table-cell">Creado</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
            {contactos.map((c) => (
              <tr
                key={`${c.source}-${c.id}`}
                className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition group"
              >
                <td
                  className="px-4 py-3 cursor-pointer"
                  onClick={() => c.source === 'crm' ? onView(c) : undefined}
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">{c.nombre_completo}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.celular && (
                        <span className="text-xs text-neutral-500 dark:text-white/50 flex items-center gap-1">
                          <Phone className="h-3 w-3" />{c.celular}
                        </span>
                      )}
                      {c.email && (
                        <span className="text-xs text-neutral-500 dark:text-white/50 hidden sm:flex items-center gap-1">
                          <Mail className="h-3 w-3" />{c.email}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${getEstatusStyle(c.estatus)}`}>
                    {c.estatus}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <SeguwalletBadge status={c.seguwallet_status} />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {c.sicas_count > 0 ? (
                    <span className="text-xs font-medium text-neutral-700 dark:text-white/70">
                      {c.sicas_count} cliente{c.sicas_count !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 dark:text-white/30">—</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-neutral-400 dark:text-white/40">{timeSince(c.fecha_creacion)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {c.source === 'crm' && (
                      <button
                        onClick={() => onView(c)}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                        title="Ver perfil completo"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    {c.source === 'crm' && (
                      <button
                        onClick={() => onEdit(c)}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
                        title="Editar contacto"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {!c.seguwallet_customer_id && c.source === 'crm' && (
                      <button
                        onClick={() => onActivarSW(c)}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition"
                        title="Activar Seguwallet"
                      >
                        <Wallet className="h-4 w-4" />
                      </button>
                    )}
                    {c.seguwallet_customer_id && (
                      <button
                        onClick={() => onAsignarSicas(c)}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition"
                        title="Gestionar clientes SICAS"
                      >
                        <Database className="h-4 w-4" />
                      </button>
                    )}
                    {isAdmin && c.seguwallet_customer_id && (
                      <button
                        onClick={async () => {
                          const ok = await startImpersonation({ platform: 'seguwallet', customerId: c.seguwallet_customer_id! });
                          if (ok) navigate('/seguwallet/dashboard');
                        }}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
                        title="Ver como este cliente en Seguwallet"
                      >
                        <User className="h-4 w-4" />
                      </button>
                    )}
                    {c.source === 'crm' && (
                      <button
                        onClick={() => onDelete(c)}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        title="Eliminar contacto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Cards View ──────────────────────────────────────────────────────────────

function CardsView({
  contactos, getEstatusStyle, timeSince, onView, onEdit, onActivarSW, onAsignarSicas, onDelete, onImpersonate, isAdmin,
}: {
  contactos: UnifiedContacto[];
  isAdminOrGerente: boolean;
  isAdmin: boolean;
  getEstatusStyle: (e: string) => string;
  timeSince: (d: string) => string;
  onView: (c: UnifiedContacto) => void;
  onEdit: (c: UnifiedContacto) => void;
  onActivarSW: (c: UnifiedContacto) => void;
  onAsignarSicas: (c: UnifiedContacto) => void;
  onDelete: (c: UnifiedContacto) => void;
  onImpersonate: (c: UnifiedContacto) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {contactos.map((c) => (
        <div
          key={`${c.source}-${c.id}`}
          className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 hover:border-accent/40 hover:shadow-sm transition group"
        >
          <div
            className="flex items-start justify-between mb-3 cursor-pointer"
            onClick={() => c.source === 'crm' ? onView(c) : undefined}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{c.nombre_completo}</p>
              <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5">{c.tipo_contacto}</p>
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 ml-2 ${getEstatusStyle(c.estatus)}`}>
              {c.estatus}
            </span>
          </div>

          <div className="space-y-1.5 mb-3">
            {c.celular && (
              <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-white/60">
                <Phone className="h-3 w-3 text-neutral-400 flex-shrink-0" />
                <span>{c.celular}</span>
              </div>
            )}
            {c.email && (
              <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-white/60">
                <Mail className="h-3 w-3 text-neutral-400 flex-shrink-0" />
                <span className="truncate">{c.email}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <SeguwalletBadge status={c.seguwallet_status} />
            {c.sicas_count > 0 && (
              <span className="text-[10px] text-neutral-500 dark:text-white/40">
                {c.sicas_count} SICAS
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <span className="text-[10px] text-neutral-400 dark:text-white/40">
              {c.fuente_origen || 'Sin fuente'} · {timeSince(c.fecha_creacion)}
            </span>
            <div className="flex items-center gap-1">
              {c.source === 'crm' && (
                <button
                  onClick={() => onView(c)}
                  className="p-1 rounded text-neutral-400 hover:text-blue-600 transition"
                  title="Ver perfil completo"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              )}
              {c.source === 'crm' && (
                <button
                  onClick={() => onEdit(c)}
                  className="p-1 rounded text-neutral-400 hover:text-amber-600 transition"
                  title="Editar contacto"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {!c.seguwallet_customer_id && c.source === 'crm' && (
                <button
                  onClick={() => onActivarSW(c)}
                  className="p-1 rounded text-neutral-400 hover:text-teal-600 transition"
                  title="Activar Seguwallet"
                >
                  <Wallet className="h-3.5 w-3.5" />
                </button>
              )}
              {c.seguwallet_customer_id && (
                <button
                  onClick={() => onAsignarSicas(c)}
                  className="p-1 rounded text-neutral-400 hover:text-cyan-600 transition"
                  title="Gestionar clientes SICAS"
                >
                  <Database className="h-3.5 w-3.5" />
                </button>
              )}
              {isAdmin && c.seguwallet_customer_id && (
                <button
                  onClick={() => onImpersonate(c)}
                  className="p-1 rounded text-neutral-400 hover:text-amber-600 transition"
                  title="Ver como este cliente"
                >
                  <User className="h-3.5 w-3.5" />
                </button>
              )}
              {c.source === 'crm' && (
                <button
                  onClick={() => onDelete(c)}
                  className="p-1 rounded text-neutral-400 hover:text-red-600 transition"
                  title="Eliminar contacto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
