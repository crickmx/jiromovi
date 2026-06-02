import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';
import { Users, Plus, Search, Trash2, Save, X, Mail, Phone, Building2, Calendar, ListFilter as Filter, Shield, CreditCard, UserCheck, Briefcase, RefreshCw, CreditCard as Edit2, Eye, MoveVertical as MoreVertical, ExternalLink, ChevronRight, CircleCheck as CheckCircle2, Circle as XCircle, CircleAlert as AlertCircle, UserPlus, ArrowUpRight, FileText, MessageSquare, ChartBar as BarChart3, Link2, UserX, Send, Star, LogIn, ClipboardList, Zap, Tag } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type FuenteContacto = 'email' | 'crm' | 'seguwallet' | 'manual';
type EstatusContacto = 'activo' | 'inactivo' | 'prospecto' | 'cliente' | 'suspendido';

interface ContactoUnificado {
  id: string;
  nombre_completo: string;
  nombre: string;
  apellido: string;
  email: string | null;
  celular: string | null;
  empresa: string | null;
  fuente: FuenteContacto;
  fuente_id: string;
  ultima_interaccion: string | null;
  estatus: string | null;
  cantidad_emails?: number;
  // Seguwallet
  seguwallet_activo: boolean;
  seguwallet_customer_id: string | null;
  seguwallet_status: string | null;
  // SICAS
  sicas_vinculado: boolean;
  sicas_cliente_id: string | null;
  sicas_usuario: string | null;
  sicas_vendedor: string | null;
  sicas_despacho: string | null;
  sicas_polizas_count: number;
  // CRM
  crm_contacto_id: string | null;
  tipo_contacto: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FUENTE_LABEL: Record<FuenteContacto, string> = {
  email: 'Correo',
  crm: 'CRM',
  seguwallet: 'Seguwallet',
  manual: 'Manual',
};

const FUENTE_COLOR: Record<FuenteContacto, string> = {
  email: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  crm: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  seguwallet: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  manual: 'bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-white/60',
};

const FUENTE_ICON: Record<FuenteContacto, React.ElementType> = {
  email: Mail,
  crm: Briefcase,
  seguwallet: Shield,
  manual: UserCheck,
};

const ESTATUS_COLOR: Record<string, string> = {
  activo: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  inactivo: 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/50',
  inactive: 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/50',
  prospecto: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cliente: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  suspendido: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const ESTATUS_LABEL: Record<string, string> = {
  activo: 'Activo', active: 'Activo',
  inactivo: 'Inactivo', inactive: 'Inactivo',
  prospecto: 'Prospecto',
  cliente: 'Cliente',
  suspendido: 'Suspendido',
};

// ─── ActionMenu ──────────────────────────────────────────────────────────────

interface ActionItem {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success';
  disabled?: boolean;
  separator?: boolean;
}

function ActionMenu({ items }: { items: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/10 transition"
        title="Acciones"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-52 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-white/10 overflow-hidden">
          {items.map((item, i) => {
            const Icon = item.icon;
            const variantCls =
              item.variant === 'danger'
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                : item.variant === 'success'
                ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                : 'text-neutral-700 dark:text-white/80 hover:bg-neutral-50 dark:hover:bg-white/5';
            return (
              <div key={i}>
                {item.separator && i > 0 && <div className="border-t border-neutral-100 dark:border-white/10 my-1" />}
                <button
                  onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${variantCls}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {item.label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── BottomSheet (mobile) ────────────────────────────────────────────────────

function BottomSheet({
  items, onClose
}: { items: ActionItem[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl pb-safe"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-neutral-300 dark:bg-white/20 rounded-full" />
        </div>
        <div className="pb-4">
          {items.map((item, i) => {
            const Icon = item.icon;
            const variantCls =
              item.variant === 'danger'
                ? 'text-red-600 dark:text-red-400'
                : item.variant === 'success'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-neutral-800 dark:text-white/90';
            return (
              <div key={i}>
                {item.separator && i > 0 && <div className="border-t border-neutral-100 dark:border-white/10 mx-4 my-1" />}
                <button
                  onClick={() => { onClose(); item.onClick(); }}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition disabled:opacity-40 ${variantCls}`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </button>
              </div>
            );
          })}
          <div className="mx-4 mt-2">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EditContactoModal ───────────────────────────────────────────────────────

interface EditContactoModalProps {
  editingId: string | null;
  initialData: {
    nombre: string; apellido: string; email: string;
    celular: string; empresa: string; comentarios: string;
  };
  onClose: () => void;
  onSaved: () => void;
  userId: string;
}

function EditContactoModal({ editingId, initialData, onClose, onSaved, userId }: EditContactoModalProps) {
  const [formData, setFormData] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!formData.email.trim()) { setError('El email es obligatorio'); return; }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const { error: err } = await supabase.from('contactos').update({
          nombre: formData.nombre.trim() || null,
          apellido: formData.apellido.trim() || null,
          email: formData.email.trim().toLowerCase(),
          celular: formData.celular.trim() || null,
          empresa: formData.empresa.trim() || null,
          comentarios: formData.comentarios.trim() || null,
        }).eq('id', editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('contactos').insert({
          usuario_id: userId,
          nombre: formData.nombre.trim() || null,
          apellido: formData.apellido.trim() || null,
          email: formData.email.trim().toLowerCase(),
          celular: formData.celular.trim() || null,
          empresa: formData.empresa.trim() || null,
          comentarios: formData.comentarios.trim() || null,
          origen: 'manual',
        });
        if (err) {
          if (err.code === '23505') throw new Error('Ya existe un contacto con este email');
          throw err;
        }
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-lg w-full my-8">
        <div className="bg-neutral-50 dark:bg-white/3 px-6 py-4 flex items-center justify-between rounded-t-2xl border-b border-neutral-200 dark:border-white/10">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
            {editingId ? 'Editar Contacto' : 'Nuevo Contacto'}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 p-2 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-1.5">Nombre</label>
              <input type="text" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
                placeholder="Juan" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-1.5">Apellido</label>
              <input type="text" value={formData.apellido} onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
                placeholder="Pérez" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-1.5">Email <span className="text-red-500">*</span></label>
            <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
              placeholder="juan@ejemplo.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-1.5">Celular</label>
              <input type="tel" value={formData.celular} onChange={e => setFormData({ ...formData, celular: e.target.value })}
                className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
                placeholder="+52 555 123 4567" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-1.5">Empresa</label>
              <input type="text" value={formData.empresa} onChange={e => setFormData({ ...formData, empresa: e.target.value })}
                className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
                placeholder="Empresa S.A." />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-1.5">Comentarios</label>
            <textarea value={formData.comentarios} onChange={e => setFormData({ ...formData, comentarios: e.target.value })}
              rows={3}
              className="w-full px-3 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
              placeholder="Notas adicionales..." />
          </div>
          {error && <div className="px-3 py-2.5 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>}
        </div>
        <div className="px-6 py-4 bg-neutral-50 dark:bg-white/3 border-t border-neutral-200 dark:border-white/10 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-white/70 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition text-sm font-medium">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition text-sm font-medium disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper: Avatar initials ──────────────────────────────────────────────────

function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatFecha(fecha: string | null) {
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
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
];
function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function Contactos() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [allContactos, setAllContactos] = useState<ContactoUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroFuente, setFiltroFuente] = useState<FuenteContacto | 'todos'>('todos');
  const [filtroEstatus, setFiltroEstatus] = useState<string>('todos');
  const [filtroSeguwallet, setFiltroSeguwallet] = useState<'todos' | 'activo' | 'inactivo'>('todos');
  const [filtroSICAS, setFiltroSICAS] = useState<'todos' | 'vinculado' | 'no_vinculado'>('todos');
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContacto, setEditingContacto] = useState<ContactoUnificado | null>(null);

  // Mobile bottom sheet
  const [bottomSheetContact, setBottomSheetContact] = useState<ContactoUnificado | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadAllContactos = useCallback(async (isRefresh = false) => {
    if (!usuario) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const isAdmin = usuario.rol === 'Administrador';
      const isGerente = usuario.rol === 'Gerente' || usuario.rol === 'Ejecutivo';
      const officeId = (usuario as any).oficina_id;

      // Fetch office user IDs for scoping
      let officeUserIds: string[] = [];
      if (!isAdmin && isGerente && officeId) {
        const { data: officeUsers } = await supabase
          .from('usuarios').select('id').eq('oficina_id', officeId);
        officeUserIds = (officeUsers || []).map(u => u.id);
      }

      const [emailRes, crmRes, swRes, sicasRes] = await Promise.allSettled([
        fetchEmailContactos(usuario.id),
        fetchCRMContactos(usuario.id, isAdmin, isGerente, officeUserIds),
        fetchSeguwalletClientes(usuario.id, isAdmin, isGerente, officeUserIds),
        fetchSICASClients(usuario.id, isAdmin, isGerente, officeUserIds),
      ]);

      const emailContacts = emailRes.status === 'fulfilled' ? emailRes.value : [];
      const crmContacts = crmRes.status === 'fulfilled' ? crmRes.value : [];
      const swContacts = swRes.status === 'fulfilled' ? swRes.value : [];
      const sicasMap = sicasRes.status === 'fulfilled' ? sicasRes.value : new Map<string, any>();

      // Merge & deduplicate by email (priority: crm > seguwallet > email > manual)
      const byEmail = new Map<string, ContactoUnificado>();
      const byId = new Map<string, ContactoUnificado>();

      const addContact = (c: ContactoUnificado) => {
        const emailKey = c.email?.toLowerCase().trim();
        if (emailKey) {
          const existing = byEmail.get(emailKey);
          if (!existing) {
            byEmail.set(emailKey, c);
          } else {
            const priority: FuenteContacto[] = ['crm', 'seguwallet', 'email', 'manual'];
            if (priority.indexOf(c.fuente) < priority.indexOf(existing.fuente)) {
              // Merge seguwallet info from lower-priority into winner
              const merged: ContactoUnificado = {
                ...c,
                seguwallet_activo: c.seguwallet_activo || existing.seguwallet_activo,
                seguwallet_customer_id: c.seguwallet_customer_id || existing.seguwallet_customer_id,
                seguwallet_status: c.seguwallet_status || existing.seguwallet_status,
              };
              byEmail.set(emailKey, merged);
            } else {
              // Merge seguwallet info from higher-priority source into existing
              if (c.fuente === 'seguwallet' && !existing.seguwallet_customer_id) {
                byEmail.set(emailKey, {
                  ...existing,
                  seguwallet_activo: c.seguwallet_activo,
                  seguwallet_customer_id: c.seguwallet_customer_id,
                  seguwallet_status: c.seguwallet_status,
                });
              }
            }
          }
        } else {
          byId.set(c.id, c);
        }
      };

      [...emailContacts, ...crmContacts, ...swContacts].forEach(addContact);

      // Merge SICAS data
      const unified = [...Array.from(byEmail.values()), ...Array.from(byId.values())].map(c => {
        const key = c.email?.toLowerCase().trim();
        const sicas = key ? sicasMap.get(key) : null;
        if (sicas) {
          return {
            ...c,
            sicas_vinculado: true,
            sicas_cliente_id: sicas.sicas_cliente_id,
            sicas_usuario: sicas.sicas_usuario,
            sicas_vendedor: sicas.sicas_vendedor,
            sicas_despacho: sicas.sicas_despacho,
            sicas_polizas_count: sicas.polizas_count || 0,
          };
        }
        return c;
      });

      unified.sort((a, b) => {
        const da = a.ultima_interaccion ? new Date(a.ultima_interaccion).getTime() : 0;
        const db = b.ultima_interaccion ? new Date(b.ultima_interaccion).getTime() : 0;
        if (db !== da) return db - da;
        return a.nombre_completo.localeCompare(b.nombre_completo);
      });

      setAllContactos(unified);
    } catch (err) {
      console.error('Error cargando contactos:', err);
      showToast('error', 'Error al cargar contactos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [usuario, showToast]);

  useEffect(() => {
    if (usuario) loadAllContactos();
  }, [usuario]);

  const fetchEmailContactos = async (userId: string): Promise<ContactoUnificado[]> => {
    const { data } = await supabase
      .from('contactos')
      .select('id, nombre, apellido, email, celular, empresa, origen, ultima_interaccion, cantidad_emails')
      .eq('usuario_id', userId)
      .order('ultima_interaccion', { ascending: false, nullsFirst: false });

    return (data || []).map(c => ({
      id: c.id,
      nombre: c.nombre || '',
      apellido: c.apellido || '',
      nombre_completo: `${c.nombre || ''} ${c.apellido || ''}`.trim() || c.email || 'Sin nombre',
      email: c.email,
      celular: c.celular,
      empresa: c.empresa,
      fuente: c.origen === 'manual' ? 'manual' : 'email',
      fuente_id: c.id,
      ultima_interaccion: c.ultima_interaccion,
      estatus: null,
      cantidad_emails: c.cantidad_emails,
      seguwallet_activo: false,
      seguwallet_customer_id: null,
      seguwallet_status: null,
      sicas_vinculado: false,
      sicas_cliente_id: null,
      sicas_usuario: null,
      sicas_vendedor: null,
      sicas_despacho: null,
      sicas_polizas_count: 0,
      crm_contacto_id: null,
      tipo_contacto: null,
    }));
  };

  const fetchCRMContactos = async (
    userId: string, isAdmin: boolean, isGerente: boolean, officeUserIds: string[]
  ): Promise<ContactoUnificado[]> => {
    let query = supabase
      .from('crm_contactos')
      .select('id, nombre_completo, email, celular, tipo_contacto, estatus, fecha_creacion, creado_por')
      .order('fecha_creacion', { ascending: false });

    if (!isAdmin) {
      if (isGerente) {
        if (officeUserIds.length === 0) return [];
        query = query.in('creado_por', officeUserIds);
      } else {
        query = query.eq('creado_por', userId);
      }
    }

    const { data } = await query;
    return (data || []).map(c => {
      const parts = (c.nombre_completo || '').split(' ');
      return {
        id: `crm_${c.id}`,
        nombre: parts[0] || '',
        apellido: parts.slice(1).join(' ') || '',
        nombre_completo: c.nombre_completo || 'Sin nombre',
        email: c.email,
        celular: c.celular,
        empresa: null,
        fuente: 'crm',
        fuente_id: c.id,
        ultima_interaccion: c.fecha_creacion,
        estatus: c.estatus,
        seguwallet_activo: false,
        seguwallet_customer_id: null,
        seguwallet_status: null,
        sicas_vinculado: false,
        sicas_cliente_id: null,
        sicas_usuario: null,
        sicas_vendedor: null,
        sicas_despacho: null,
        sicas_polizas_count: 0,
        crm_contacto_id: c.id,
        tipo_contacto: c.tipo_contacto,
      };
    });
  };

  const fetchSeguwalletClientes = async (
    userId: string, isAdmin: boolean, isGerente: boolean, officeUserIds: string[]
  ): Promise<ContactoUnificado[]> => {
    let query = supabase
      .from('seguwallet_customers')
      .select('id, full_name, email, phone, status, created_at, agent_user_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      if (isGerente) {
        if (officeUserIds.length === 0) return [];
        query = query.in('agent_user_id', officeUserIds);
      } else {
        query = query.eq('agent_user_id', userId);
      }
    }

    const { data } = await query;
    return (data || []).map(c => {
      const parts = (c.full_name || '').split(' ');
      return {
        id: `sw_${c.id}`,
        nombre: parts[0] || '',
        apellido: parts.slice(1).join(' ') || '',
        nombre_completo: c.full_name || 'Sin nombre',
        email: c.email,
        celular: c.phone,
        empresa: null,
        fuente: 'seguwallet',
        fuente_id: c.id,
        ultima_interaccion: c.created_at,
        estatus: c.status,
        seguwallet_activo: c.status === 'active',
        seguwallet_customer_id: c.id,
        seguwallet_status: c.status,
        sicas_vinculado: false,
        sicas_cliente_id: null,
        sicas_usuario: null,
        sicas_vendedor: null,
        sicas_despacho: null,
        sicas_polizas_count: 0,
        crm_contacto_id: null,
        tipo_contacto: null,
      };
    });
  };

  const fetchSICASClients = async (
    userId: string, isAdmin: boolean, isGerente: boolean, officeUserIds: string[]
  ): Promise<Map<string, any>> => {
    // Fetch from sicas_documents for email→sicas mapping via seguwallet_customer_sicas_clients
    const map = new Map<string, any>();
    try {
      let query = supabase
        .from('seguwallet_customer_sicas_clients')
        .select('id, seguwallet_customer_id, sicas_cliente_id, sicas_usuario, sicas_vendedor, sicas_despacho');

      const { data: sicasLinks } = await query;
      if (!sicasLinks || sicasLinks.length === 0) return map;

      // Get customer emails
      const custIds = [...new Set(sicasLinks.map(l => l.seguwallet_customer_id).filter(Boolean))];
      if (custIds.length === 0) return map;

      const { data: customers } = await supabase
        .from('seguwallet_customers')
        .select('id, email')
        .in('id', custIds)
        .is('deleted_at', null);

      const emailById = new Map<string, string>();
      (customers || []).forEach(c => { if (c.email) emailById.set(c.id, c.email.toLowerCase()); });

      sicasLinks.forEach(link => {
        const email = emailById.get(link.seguwallet_customer_id);
        if (email) {
          map.set(email, {
            sicas_cliente_id: link.sicas_cliente_id,
            sicas_usuario: link.sicas_usuario,
            sicas_vendedor: link.sicas_vendedor,
            sicas_despacho: link.sicas_despacho,
          });
        }
      });
    } catch (e) {
      // SICAS linking is optional
    }
    return map;
  };

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filteredContactos = useMemo(() => {
    let list = allContactos;

    if (filtroFuente !== 'todos') list = list.filter(c => c.fuente === filtroFuente);
    if (filtroEstatus !== 'todos') {
      list = list.filter(c => {
        if (!c.estatus) return false;
        return c.estatus === filtroEstatus || (filtroEstatus === 'activo' && c.estatus === 'active') ||
          (filtroEstatus === 'inactivo' && c.estatus === 'inactive');
      });
    }
    if (filtroSeguwallet !== 'todos') {
      list = list.filter(c => filtroSeguwallet === 'activo' ? c.seguwallet_activo : !c.seguwallet_activo);
    }
    if (filtroSICAS !== 'todos') {
      list = list.filter(c => filtroSICAS === 'vinculado' ? c.sicas_vinculado : !c.sicas_vinculado);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.nombre_completo.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.empresa?.toLowerCase().includes(q) ||
        c.celular?.includes(q) ||
        c.sicas_cliente_id?.toLowerCase().includes(q) ||
        c.sicas_usuario?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allContactos, searchQuery, filtroFuente, filtroEstatus, filtroSeguwallet, filtroSICAS]);

  const counts = useMemo(() => ({
    total: allContactos.length,
    email: allContactos.filter(c => c.fuente === 'email').length,
    crm: allContactos.filter(c => c.fuente === 'crm').length,
    seguwallet: allContactos.filter(c => c.fuente === 'seguwallet').length,
    manual: allContactos.filter(c => c.fuente === 'manual').length,
  }), [allContactos]);

  const hasActiveFilters = filtroFuente !== 'todos' || filtroEstatus !== 'todos' ||
    filtroSeguwallet !== 'todos' || filtroSICAS !== 'todos';

  // ── Actions ───────────────────────────────────────────────────────────────

  const getActions = (c: ContactoUnificado): ActionItem[] => {
    const isAdmin = usuario?.rol === 'Administrador';
    const actions: ActionItem[] = [];

    // Ver detalle
    if (c.fuente === 'crm' && c.crm_contacto_id) {
      actions.push({
        label: 'Ver en CRM',
        icon: ExternalLink,
        onClick: () => navigate('/mi-crm'),
      });
    }
    if (c.seguwallet_activo && c.seguwallet_customer_id) {
      actions.push({
        label: 'Ver en Seguwallet',
        icon: Shield,
        onClick: () => navigate('/seguwallet-admin'),
      });
    }

    // Editar
    if (c.fuente === 'manual' || c.fuente === 'email') {
      actions.push({
        label: 'Editar contacto',
        icon: Edit2,
        onClick: () => openEdit(c),
      });
    }

    // Seguwallet
    actions.push({ label: '', icon: Shield, onClick: () => {}, separator: true, disabled: true });

    if (!c.seguwallet_activo) {
      actions.push({
        label: 'Activar en Seguwallet',
        icon: UserPlus,
        variant: 'success',
        onClick: () => handleActivarSeguwallet(c),
      });
    } else {
      actions.push({
        label: 'Reenviar acceso Seguwallet',
        icon: Send,
        onClick: () => handleReenviarAccesoSeguwallet(c),
      });
      actions.push({
        label: 'Ver como cliente',
        icon: LogIn,
        onClick: () => navigate('/seguwallet-admin'),
      });
      actions.push({
        label: 'Pólizas Seguwallet',
        icon: FileText,
        onClick: () => navigate('/seguwallet-admin'),
      });
    }

    // SICAS
    if (c.sicas_vinculado) {
      actions.push({ label: '', icon: Shield, onClick: () => {}, separator: true, disabled: true });
      actions.push({
        label: 'Ver producción SICAS',
        icon: BarChart3,
        onClick: () => navigate('/mi-produccion'),
      });
      actions.push({
        label: 'Ver pólizas SICAS',
        icon: ClipboardList,
        onClick: () => navigate('/mis-polizas'),
      });
    }

    // Trámites / conversaciones
    actions.push({ label: '', icon: Shield, onClick: () => {}, separator: true, disabled: true });
    actions.push({
      label: 'Ver trámites',
      icon: Briefcase,
      onClick: () => navigate('/tramites'),
    });
    actions.push({
      label: 'Enviar WhatsApp',
      icon: MessageSquare,
      onClick: () => {
        if (c.celular) {
          const num = c.celular.replace(/\D/g, '');
          window.open(`https://wa.me/${num}`, '_blank');
        }
      },
      disabled: !c.celular,
    });
    actions.push({
      label: 'Enviar email',
      icon: Mail,
      onClick: () => {
        if (c.email) window.open(`mailto:${c.email}`, '_blank');
      },
      disabled: !c.email,
    });

    // CRM conversion
    if (c.fuente !== 'crm') {
      actions.push({ label: '', icon: Shield, onClick: () => {}, separator: true, disabled: true });
      actions.push({
        label: 'Agregar al CRM',
        icon: Zap,
        onClick: () => handleAgregarCRM(c),
      });
    }
    if (c.tipo_contacto !== 'cliente') {
      actions.push({
        label: 'Convertir a cliente',
        icon: Star,
        onClick: () => handleConvertirCliente(c),
        disabled: c.fuente !== 'crm',
      });
    }

    // Eliminar
    if (c.fuente === 'manual') {
      actions.push({ label: '', icon: Shield, onClick: () => {}, separator: true, disabled: true });
      actions.push({
        label: 'Eliminar contacto',
        icon: Trash2,
        variant: 'danger',
        onClick: () => handleDelete(c),
      });
    }

    // Filter out separator-only items at edges and consecutive separators
    return actions.filter((a, i, arr) => {
      if (!a.separator) return true;
      if (i === 0 || i === arr.length - 1) return false;
      if (arr[i - 1]?.separator) return false;
      return true;
    });
  };

  const openEdit = (c: ContactoUnificado) => {
    setEditingContacto(c);
    setShowEditModal(true);
  };

  const handleDelete = async (c: ContactoUnificado) => {
    if (!confirm(`¿Eliminar a ${c.nombre_completo}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('contactos').delete().eq('id', c.fuente_id);
    if (error) { showToast('error', 'Error al eliminar'); return; }
    showToast('success', 'Contacto eliminado');
    loadAllContactos(true);
  };

  const handleActivarSeguwallet = async (c: ContactoUnificado) => {
    if (!c.email) { showToast('error', 'Este contacto no tiene email'); return; }
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-seguwallet-customer`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: c.email,
          full_name: c.nombre_completo,
          phone: c.celular,
          agent_user_id: usuario?.id,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('success', `${c.nombre_completo} activado en Seguwallet`);
      loadAllContactos(true);
    } catch (err: any) {
      showToast('error', err.message || 'Error al activar Seguwallet');
    }
  };

  const handleReenviarAccesoSeguwallet = async (c: ContactoUnificado) => {
    if (!c.seguwallet_customer_id) return;
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seguwallet-send-welcome`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customer_id: c.seguwallet_customer_id }),
      });
      showToast('success', 'Acceso reenviado por email/WhatsApp');
    } catch {
      showToast('error', 'Error al reenviar acceso');
    }
  };

  const handleAgregarCRM = async (c: ContactoUnificado) => {
    if (!usuario) return;
    try {
      const { error } = await supabase.from('crm_contactos').insert({
        nombre_completo: c.nombre_completo,
        email: c.email,
        celular: c.celular,
        tipo_contacto: 'prospecto',
        estatus: 'activo',
        creado_por: usuario.id,
      });
      if (error && error.code === '23505') { showToast('error', 'Ya existe en el CRM'); return; }
      if (error) throw error;
      showToast('success', 'Contacto agregado al CRM');
      loadAllContactos(true);
    } catch (err: any) {
      showToast('error', err.message || 'Error');
    }
  };

  const handleConvertirCliente = async (c: ContactoUnificado) => {
    if (!c.crm_contacto_id) { showToast('error', 'Solo se pueden convertir contactos del CRM'); return; }
    const { error } = await supabase.from('crm_contactos')
      .update({ tipo_contacto: 'cliente', estatus: 'activo' })
      .eq('id', c.crm_contacto_id);
    if (error) { showToast('error', 'Error al convertir'); return; }
    showToast('success', 'Convertido a cliente');
    loadAllContactos(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <LoadingState text="Cargando contactos..." />;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
          toast.type === 'success'
            ? 'bg-white dark:bg-neutral-800 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
            : 'bg-white dark:bg-neutral-800 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <XCircle className="w-4 h-4 shrink-0" />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden">
        <PageHeader
          title="Contactos"
          description={`${counts.total} contactos · CRM, Seguwallet, correo y manual`}
          icon={Users}
        >
          <Button variant="outline" onClick={() => loadAllContactos(true)} disabled={refreshing} className="hidden sm:flex">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>
          <Button onClick={() => {
            setEditingContacto(null);
            setShowEditModal(true);
          }}>
            <Plus className="w-4 h-4" />
            <span>Nuevo</span>
          </Button>
        </PageHeader>

        {/* Source summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 md:p-6 border-b border-neutral-200 dark:border-white/10">
          {(['crm', 'seguwallet', 'email', 'manual'] as FuenteContacto[]).map(fuente => {
            const Icon = FUENTE_ICON[fuente];
            const count = counts[fuente];
            const active = filtroFuente === fuente;
            return (
              <button
                key={fuente}
                onClick={() => setFiltroFuente(active ? 'todos' : fuente)}
                className={`p-3 md:p-4 rounded-xl border transition text-left group ${
                  active
                    ? 'border-accent bg-accent/5 dark:bg-accent/10'
                    : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20 hover:bg-neutral-50 dark:hover:bg-white/3'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-accent' : 'text-neutral-400 dark:text-white/40'}`} />
                  <span className={`text-xs font-medium ${active ? 'text-accent' : 'text-neutral-500 dark:text-white/40'}`}>
                    {FUENTE_LABEL[fuente]}
                  </span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white">{count}</p>
              </button>
            );
          })}
        </div>

        {/* Search & filter bar */}
        <div className="p-4 md:p-6 border-b border-neutral-200 dark:border-white/10 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, email, teléfono, ID SICAS..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                showFilters || hasActiveFilters
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-white/60 hover:border-neutral-300 dark:hover:border-white/20'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtros
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-accent" />
              )}
            </button>
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
              <select
                value={filtroFuente}
                onChange={e => setFiltroFuente(e.target.value as any)}
                className="px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-transparent text-sm text-neutral-700 dark:text-white/70 focus:outline-none focus:border-accent"
              >
                <option value="todos">Todas las fuentes</option>
                <option value="crm">CRM</option>
                <option value="seguwallet">Seguwallet</option>
                <option value="email">Correo</option>
                <option value="manual">Manual</option>
              </select>
              <select
                value={filtroEstatus}
                onChange={e => setFiltroEstatus(e.target.value)}
                className="px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-transparent text-sm text-neutral-700 dark:text-white/70 focus:outline-none focus:border-accent"
              >
                <option value="todos">Todos los estatus</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="prospecto">Prospecto</option>
                <option value="cliente">Cliente</option>
              </select>
              <select
                value={filtroSeguwallet}
                onChange={e => setFiltroSeguwallet(e.target.value as any)}
                className="px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-transparent text-sm text-neutral-700 dark:text-white/70 focus:outline-none focus:border-accent"
              >
                <option value="todos">Seguwallet: todos</option>
                <option value="activo">Con Seguwallet</option>
                <option value="inactivo">Sin Seguwallet</option>
              </select>
              <select
                value={filtroSICAS}
                onChange={e => setFiltroSICAS(e.target.value as any)}
                className="px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-transparent text-sm text-neutral-700 dark:text-white/70 focus:outline-none focus:border-accent"
              >
                <option value="todos">SICAS: todos</option>
                <option value="vinculado">Vinculados SICAS</option>
                <option value="no_vinculado">Sin SICAS</option>
              </select>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setFiltroFuente('todos');
                    setFiltroEstatus('todos');
                    setFiltroSeguwallet('todos');
                    setFiltroSICAS('todos');
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-neutral-500 dark:text-white/40">
            {filteredContactos.length} de {counts.total} contactos
            {hasActiveFilters && ' (filtrado)'}
          </p>
        </div>

        {/* Content */}
        {filteredContactos.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Users className="w-14 h-14 text-neutral-200 dark:text-white/15 mx-auto mb-3" />
            <p className="font-semibold text-neutral-600 dark:text-white/60 text-sm">Sin contactos</p>
            <p className="text-xs text-neutral-400 dark:text-white/30 mt-1">
              {searchQuery || hasActiveFilters
                ? 'Ningún contacto coincide con los filtros aplicados'
                : 'Agrega contactos manualmente o sincroniza tus módulos'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Desktop/Tablet table ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="bg-neutral-50 dark:bg-white/3 border-b border-neutral-200 dark:border-white/10">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider">Contacto</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider hidden lg:table-cell">Contacto / Info</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider">Estatus</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider hidden lg:table-cell">Fuente</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider hidden xl:table-cell">Integraciones</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider">Actividad</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                  {filteredContactos.map(c => {
                    const FuenteIcon = FUENTE_ICON[c.fuente];
                    const initials = getInitials(c.nombre_completo);
                    const avatarCls = avatarColor(c.nombre_completo);
                    const estatusLabel = c.estatus ? (ESTATUS_LABEL[c.estatus] || c.estatus) : null;
                    const estatusCls = c.estatus ? (ESTATUS_COLOR[c.estatus] || 'bg-neutral-100 text-neutral-600') : null;
                    return (
                      <tr key={c.id} className="hover:bg-neutral-50/60 dark:hover:bg-white/2 transition group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm ${avatarCls}`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-neutral-900 dark:text-white text-sm truncate max-w-[160px]">{c.nombre_completo}</p>
                              {c.empresa && (
                                <p className="text-xs text-neutral-400 dark:text-white/40 flex items-center gap-1 truncate">
                                  <Building2 className="w-3 h-3 shrink-0" /> {c.empresa}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell">
                          <div className="space-y-0.5">
                            {c.email && (
                              <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-white/50">
                                <Mail className="w-3 h-3 shrink-0 text-neutral-400" />
                                <span className="truncate max-w-[180px]">{c.email}</span>
                              </div>
                            )}
                            {c.celular && (
                              <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-white/50">
                                <Phone className="w-3 h-3 shrink-0 text-neutral-400" />
                                {c.celular}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {estatusLabel ? (
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${estatusCls}`}>
                              {estatusLabel}
                            </span>
                          ) : (
                            <span className="text-neutral-300 dark:text-white/20 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${FUENTE_COLOR[c.fuente]}`}>
                            <FuenteIcon className="w-3 h-3" />
                            {FUENTE_LABEL[c.fuente]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 hidden xl:table-cell">
                          <div className="flex items-center gap-1.5">
                            {c.seguwallet_activo ? (
                              <span title="Seguwallet activo" className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <Shield className="w-3 h-3" /> SW
                              </span>
                            ) : (
                              <span title="Sin Seguwallet" className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-neutral-100 text-neutral-400 dark:bg-white/5 dark:text-white/30">
                                <Shield className="w-3 h-3" /> —
                              </span>
                            )}
                            {c.sicas_vinculado && (
                              <span title={`SICAS: ${c.sicas_cliente_id || ''}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                <Link2 className="w-3 h-3" /> SICAS
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1 text-xs text-neutral-400 dark:text-white/30">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {formatFecha(c.ultima_interaccion)}
                          </div>
                          {c.cantidad_emails != null && c.cantidad_emails > 0 && (
                            <p className="text-xs text-neutral-300 dark:text-white/25 mt-0.5">{c.cantidad_emails} emails</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <ActionMenu items={getActions(c)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ── */}
            <div className="md:hidden divide-y divide-neutral-100 dark:divide-white/5">
              {filteredContactos.map(c => {
                const FuenteIcon = FUENTE_ICON[c.fuente];
                const initials = getInitials(c.nombre_completo);
                const avatarCls = avatarColor(c.nombre_completo);
                const estatusLabel = c.estatus ? (ESTATUS_LABEL[c.estatus] || c.estatus) : null;
                const estatusCls = c.estatus ? (ESTATUS_COLOR[c.estatus] || 'bg-neutral-100 text-neutral-600') : null;
                return (
                  <div key={c.id} className="flex items-start gap-3 px-4 py-3.5 active:bg-neutral-50 dark:active:bg-white/3 transition">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm mt-0.5 ${avatarCls}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-900 dark:text-white text-sm truncate">{c.nombre_completo}</p>
                          {c.empresa && (
                            <p className="text-xs text-neutral-400 dark:text-white/40 truncate">{c.empresa}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setBottomSheetContact(c)}
                          className="p-1.5 -mr-1 shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                        {c.email && (
                          <span className="text-xs text-neutral-500 dark:text-white/50 truncate max-w-[180px]">{c.email}</span>
                        )}
                        {c.celular && (
                          <span className="text-xs text-neutral-500 dark:text-white/50">{c.celular}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${FUENTE_COLOR[c.fuente]}`}>
                          <FuenteIcon className="w-2.5 h-2.5" />
                          {FUENTE_LABEL[c.fuente]}
                        </span>
                        {estatusLabel && (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${estatusCls}`}>
                            {estatusLabel}
                          </span>
                        )}
                        {c.seguwallet_activo && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <Shield className="w-2.5 h-2.5" /> SW
                          </span>
                        )}
                        {c.sicas_vinculado && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            <Link2 className="w-2.5 h-2.5" /> SICAS
                          </span>
                        )}
                        <span className="text-xs text-neutral-400 dark:text-white/30">{formatFecha(c.ultima_interaccion)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Edit/Create Modal */}
      {showEditModal && (
        <EditContactoModal
          editingId={editingContacto?.fuente === 'manual' || editingContacto?.fuente === 'email' ? editingContacto.fuente_id : null}
          initialData={{
            nombre: editingContacto?.nombre || '',
            apellido: editingContacto?.apellido || '',
            email: editingContacto?.email || '',
            celular: editingContacto?.celular || '',
            empresa: editingContacto?.empresa || '',
            comentarios: '',
          }}
          onClose={() => { setShowEditModal(false); setEditingContacto(null); }}
          onSaved={() => {
            showToast('success', editingContacto ? 'Contacto actualizado' : 'Contacto creado');
            loadAllContactos(true);
          }}
          userId={usuario?.id || ''}
        />
      )}

      {/* Mobile BottomSheet */}
      {bottomSheetContact && (
        <BottomSheet
          items={getActions(bottomSheetContact)}
          onClose={() => setBottomSheetContact(null)}
        />
      )}
    </div>
  );
}

export default Contactos;
