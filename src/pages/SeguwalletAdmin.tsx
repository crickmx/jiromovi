import { useEffect, useState, useRef, useCallback } from 'react';
import { Shield, Plus, Search, Eye, CreditCard as Edit, RotateCcw, Users, X, Check, UserPlus, Loader2, FileText, AlertCircle, CheckCircle2, Clock, Building2, ToggleLeft, ToggleRight, Trash2, Phone, Upload, Link, ImageOff, Camera, User, FileStack, Download, Copy, ExternalLink, Calendar, Hash } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { getAgentSicasClients, searchSicasClientsAdmin, type SicasClientResult } from '@/seguwallet/lib/seguwalletAuth';
import { cn } from '@/lib/utils';
import { type SeguwalletInsurer, type InsurerFormData, emptyInsurerForm, sanitizePhone, formatPhoneDisplay, getInsurerLogoUrl, isBlockedLogoUrl } from '@/seguwallet/lib/insurerTypes';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface SeguwalletCustomer {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  status: 'active' | 'inactive' | 'blocked';
  agent_user_id: string;
  last_login_at: string | null;
  created_at: string;
  profile_completed: boolean;
  profile_completed_at: string | null;
  profile_photo_url: string | null;
  profile_photo_path: string | null;
  profile_updated_at: string | null;
  state: string | null;
  municipality: string | null;
  birth_date: string | null;
  gender: 'masculino' | 'femenino' | 'no_binario' | 'prefiero_no_decir' | null;
  terms_accepted: boolean;
  terms_version_accepted: string | null;
  terms_accepted_at: string | null;
  sicas_clients_count?: number;
  sicas_primary_name?: string | null;
  agent_name?: string;
  office_name?: string | null;
}

function getPhotoUrl(path: string | null | undefined, fallback = ''): string {
  if (!path) return fallback;
  return `${SUPABASE_URL}/storage/v1/object/public/seguwallet-profile-photos/${path}`;
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

interface SeguwalletTerm {
  id: string;
  title: string;
  version: string;
  content: string;
  is_active: boolean;
  created_at: string;
  published_at: string | null;
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
  whatsapp: string;
  state: string;
  municipality: string;
  birth_date: string;
  gender: string;
  status: 'active' | 'inactive' | 'blocked';
  agent_user_id: string;
}

type ModalType = 'create' | 'edit' | 'sicas' | 'reset' | 'terms_create' | 'terms_view' | 'polizas_externas' | null;

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
  const { startImpersonation } = useImpersonation();
  const isAdmin = usuario?.rol === 'Administrador';
  const isAgent = usuario?.rol === 'Agente';

  const [activeTab, setActiveTab] = useState<'customers' | 'terms' | 'insurers'>('customers');
  const [customers, setCustomers] = useState<SeguwalletCustomer[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOffice, setFilterOffice] = useState('all');
  const [filterSicas, setFilterSicas] = useState<'all' | 'vinculado' | 'sin_vinculo'>('all');
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
    full_name: '', phone: '', whatsapp: '', state: '', municipality: '', birth_date: '', gender: '', status: 'active', agent_user_id: '',
  });
  const [editPhotoPath, setEditPhotoPath] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const editPhotoRef = useRef<HTMLInputElement>(null);

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

  // Terms
  const [terms, setTerms] = useState<SeguwalletTerm[]>([]);
  const [termsLoading, setTermsLoading] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<SeguwalletTerm | null>(null);
  const [termForm, setTermForm] = useState({ title: 'Términos y Condiciones', version: '', content: '' });
  const [termSaving, setTermSaving] = useState(false);
  const [termError, setTermError] = useState('');
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Insurers
  const [insurers, setInsurers] = useState<SeguwalletInsurer[]>([]);
  const [insurersLoading, setInsurersLoading] = useState(false);
  const [insurerSearch, setInsurerSearch] = useState('');
  const [insurerFilter, setInsurerFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedInsurer, setSelectedInsurer] = useState<SeguwalletInsurer | null>(null);
  const [insurerModalMode, setInsurerModalMode] = useState<'create' | 'edit' | null>(null);
  const [insurerForm, setInsurerForm] = useState<InsurerFormData>(emptyInsurerForm);
  const [insurerSaving, setInsurerSaving] = useState(false);
  const [insurerError, setInsurerError] = useState('');
  const [deletingInsurerId, setDeletingInsurerId] = useState<string | null>(null);
  const [logoUploadLoading, setLogoUploadLoading] = useState(false);
  const [logoImportUrl, setLogoImportUrl] = useState('');
  const [logoImportLoading, setLogoImportLoading] = useState(false);
  const [logoLocalPath, setLogoLocalPath] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // External policies viewer
  const [extPolicies, setExtPolicies] = useState<ExternalPolicy[]>([]);
  const [extPoliciesLoading, setExtPoliciesLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
    loadAgents();
    if (isAdmin) { loadTerms(); loadInsurers(); }
  }, []);

  const loadCustomers = async () => {
    try {
      let query = supabase
        .from('seguwallet_customers')
        .select('*')
        .order('created_at', { ascending: false });

      // Agents and Ejecutivos only see customers they are responsible for
      if (!isAdmin && usuario?.id) {
        query = query.eq('agent_user_id', usuario.id);
      }

      const { data } = await query;

      if (data) {
        const enriched = await Promise.all(data.map(async (c) => {
          const [countRes, primarySicasRes, agentRes] = await Promise.all([
            supabase
              .from('seguwallet_customer_sicas_clients')
              .select('id', { count: 'exact', head: true })
              .eq('seguwallet_customer_id', c.id),
            supabase
              .from('seguwallet_customer_sicas_clients')
              .select('nombre_sicas')
              .eq('seguwallet_customer_id', c.id)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('usuarios')
              .select('nombre, apellidos, oficina_id, oficinas(nombre)')
              .eq('id', c.agent_user_id)
              .maybeSingle(),
          ]);
          const agent = agentRes.data as any;
          return {
            ...c,
            sicas_clients_count: countRes.count || 0,
            sicas_primary_name: primarySicasRes.data?.nombre_sicas || null,
            agent_name: agent ? `${agent.nombre} ${agent.apellidos}` : '-',
            office_name: agent?.oficinas?.nombre || null,
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
    setEditForm({
      full_name: customer.full_name,
      phone: customer.phone || '',
      whatsapp: customer.whatsapp || '',
      state: customer.state || '',
      municipality: customer.municipality || '',
      birth_date: customer.birth_date || '',
      gender: customer.gender || '',
      status: customer.status,
      agent_user_id: customer.agent_user_id,
    });
    setEditPhotoPath(customer.profile_photo_path || null);
    setEditError('');
    setActiveModal('edit');
  };

  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCustomer) return;
    setPhotoUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const storagePath = `seguwallet/customers/${selectedCustomer.id}/profile-photo.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('seguwallet-profile-photos')
        .upload(storagePath, file, { contentType: file.type, upsert: true });
      if (uploadErr) throw uploadErr;
      const publicUrl = getPhotoUrl(storagePath);
      await supabase.from('seguwallet_customers')
        .update({ profile_photo_path: storagePath, profile_photo_url: publicUrl, profile_updated_at: new Date().toISOString() })
        .eq('id', selectedCustomer.id);
      setEditPhotoPath(storagePath);
      setSelectedCustomer(prev => prev ? { ...prev, profile_photo_path: storagePath, profile_photo_url: publicUrl } : prev);
    } catch (err: any) {
      setEditError(err.message || 'Error al subir foto.');
    } finally {
      setPhotoUploading(false);
      if (editPhotoRef.current) editPhotoRef.current.value = '';
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setEditError('');
    if (!editForm.full_name.trim()) { setEditError('El nombre es obligatorio.'); return; }
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
        whatsapp: editForm.whatsapp.trim() || null,
        state: editForm.state.trim() || null,
        municipality: editForm.municipality.trim() || null,
        birth_date: editForm.birth_date || null,
        gender: editForm.gender || null,
        status: editForm.status,
        agent_user_id: editForm.agent_user_id,
        profile_updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('seguwallet_customers').update(updates).eq('id', selectedCustomer.id);
      if (error) throw error;

      // Audit log
      const actorType = isAdmin ? 'admin' : 'agent';
      const changedFields = Object.keys(updates).filter(k => {
        const prev = (selectedCustomer as any)[k];
        const next = updates[k];
        return prev !== next;
      });
      if (changedFields.length > 0) {
        await supabase.from('seguwallet_profile_audit_logs').insert({
          customer_id: selectedCustomer.id,
          actor_id: usuario?.id,
          actor_type: actorType,
          action: 'profile_update',
          changed_fields: changedFields,
        });
      }

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

  // ── Terms ─────────────────────────────────────────────────────────
  const loadTerms = async () => {
    setTermsLoading(true);
    try {
      const { data } = await supabase
        .from('seguwallet_terms')
        .select('*')
        .order('created_at', { ascending: false });
      setTerms(data || []);
    } finally {
      setTermsLoading(false);
    }
  };

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    setTermError('');
    if (!termForm.version.trim() || !termForm.content.trim()) {
      setTermError('Versión y contenido son obligatorios.');
      return;
    }
    setTermSaving(true);
    try {
      const { error } = await supabase.from('seguwallet_terms').insert({
        title: termForm.title.trim(),
        version: termForm.version.trim(),
        content: termForm.content.trim(),
        created_by: usuario?.id,
      });
      if (error) throw error;
      setTermForm({ title: 'Términos y Condiciones', version: '', content: '' });
      closeModal();
      loadTerms();
    } catch (err: any) {
      setTermError(err.message || 'Error al crear términos.');
    } finally {
      setTermSaving(false);
    }
  };

  const handlePublishTerm = async (termId: string) => {
    setPublishingId(termId);
    try {
      const { error } = await supabase
        .from('seguwallet_terms')
        .update({ is_active: true, published_at: new Date().toISOString(), published_by: usuario?.id })
        .eq('id', termId);
      if (error) throw error;
      loadTerms();
    } finally {
      setPublishingId(null);
    }
  };

  // ── Insurers ──────────────────────────────────────────────────────
  const loadInsurers = async () => {
    setInsurersLoading(true);
    try {
      const { data } = await supabase
        .from('seguwallet_insurers')
        .select('*')
        .is('deleted_at', null)
        .order('display_order');
      setInsurers(data || []);
    } finally {
      setInsurersLoading(false);
    }
  };

  const openCreateInsurer = () => {
    setInsurerForm({ ...emptyInsurerForm, display_order: insurers.length + 1 });
    setLogoLocalPath(null);
    setLogoImportUrl('');
    setInsurerError('');
    setSelectedInsurer(null);
    setInsurerModalMode('create');
  };

  const openEditInsurer = (ins: SeguwalletInsurer) => {
    setSelectedInsurer(ins);
    setInsurerForm({
      name: ins.name,
      logo_url: ins.logo_url || '',
      primary_color: ins.primary_color || '',
      website_url: ins.website_url || '',
      customer_service_phone: ins.customer_service_phone || '',
      payment_phone: ins.payment_phone || '',
      claims_phone: ins.claims_phone || '',
      customer_service_whatsapp: ins.customer_service_whatsapp || '',
      claims_whatsapp: ins.claims_whatsapp || '',
      payment_url: ins.payment_url || '',
      ios_app_url: ins.ios_app_url || '',
      android_app_url: ins.android_app_url || '',
      general_conditions_url: ins.general_conditions_url || '',
      claims_instructions: ins.claims_instructions || '',
      is_active: ins.is_active,
      show_in_directory: ins.show_in_directory,
      show_in_claims: ins.show_in_claims,
      display_order: ins.display_order,
    });
    setLogoLocalPath(ins.logo_local_path || null);
    setLogoImportUrl(ins.logo_original_source_url || '');
    setInsurerError('');
    setInsurerModalMode('edit');
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedInsurer) return;
    setLogoUploadLoading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const storagePath = `logos/insurer-${selectedInsurer.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('insurance-carriers-logos')
        .upload(storagePath, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      await supabase.from('seguwallet_insurers').update({ logo_local_path: storagePath }).eq('id', selectedInsurer.id);
      setLogoLocalPath(storagePath);
      setInsurers(prev => prev.map(i => i.id === selectedInsurer.id ? { ...i, logo_local_path: storagePath } : i));
    } catch (err: any) {
      setInsurerError(err.message || 'Error al subir logo.');
    } finally {
      setLogoUploadLoading(false);
      if (logoFileInputRef.current) logoFileInputRef.current.value = '';
    }
  };

  const handleLogoImportFromUrl = async () => {
    if (!logoImportUrl.trim() || !selectedInsurer) return;
    setLogoImportLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-insurer-logo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            insurer_id: selectedInsurer.id,
            source_url: logoImportUrl.trim(),
            file_name: `insurer-${selectedInsurer.id}`,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Error al importar');
      setLogoLocalPath(result.storage_path);
      setInsurers(prev => prev.map(i => i.id === selectedInsurer.id
        ? { ...i, logo_local_path: result.storage_path, logo_original_source_url: logoImportUrl.trim() }
        : i
      ));
    } catch (err: any) {
      setInsurerError(err.message || 'Error al importar logo desde URL.');
    } finally {
      setLogoImportLoading(false);
    }
  };

  const handleSaveInsurer = async (e: React.FormEvent) => {
    e.preventDefault();
    setInsurerError('');
    if (!insurerForm.name.trim()) { setInsurerError('El nombre es obligatorio.'); return; }
    setInsurerSaving(true);
    try {
      const payload = {
        ...insurerForm,
        name: insurerForm.name.trim(),
        customer_service_phone: insurerForm.customer_service_phone ? sanitizePhone(insurerForm.customer_service_phone) : null,
        payment_phone: insurerForm.payment_phone ? sanitizePhone(insurerForm.payment_phone) : null,
        claims_phone: insurerForm.claims_phone ? sanitizePhone(insurerForm.claims_phone) : null,
        customer_service_whatsapp: insurerForm.customer_service_whatsapp ? sanitizePhone(insurerForm.customer_service_whatsapp) : null,
        claims_whatsapp: insurerForm.claims_whatsapp ? sanitizePhone(insurerForm.claims_whatsapp) : null,
        logo_url: insurerForm.logo_url || null,
        primary_color: insurerForm.primary_color || null,
        website_url: insurerForm.website_url || null,
        payment_url: insurerForm.payment_url || null,
        ios_app_url: insurerForm.ios_app_url || null,
        android_app_url: insurerForm.android_app_url || null,
        general_conditions_url: insurerForm.general_conditions_url || null,
        claims_instructions: insurerForm.claims_instructions || null,
      };
      if (insurerModalMode === 'create') {
        const { error } = await supabase.from('seguwallet_insurers').insert(payload);
        if (error) throw error;
      } else if (selectedInsurer) {
        const { error } = await supabase.from('seguwallet_insurers').update(payload).eq('id', selectedInsurer.id);
        if (error) throw error;
      }
      setInsurerModalMode(null);
      loadInsurers();
    } catch (err: any) {
      setInsurerError(err.message || 'Error al guardar aseguradora.');
    } finally {
      setInsurerSaving(false);
    }
  };

  const handleToggleInsurerActive = async (ins: SeguwalletInsurer) => {
    try {
      await supabase.from('seguwallet_insurers').update({ is_active: !ins.is_active }).eq('id', ins.id);
      setInsurers(prev => prev.map(i => i.id === ins.id ? { ...i, is_active: !ins.is_active } : i));
    } catch (err) { console.error(err); }
  };

  const handleDeleteInsurer = async (ins: SeguwalletInsurer) => {
    if (!confirm(`¿Eliminar "${ins.name}"? Esta accion no se puede deshacer.`)) return;
    setDeletingInsurerId(ins.id);
    try {
      await supabase.from('seguwallet_insurers').update({ deleted_at: new Date().toISOString() }).eq('id', ins.id);
      setInsurers(prev => prev.filter(i => i.id !== ins.id));
    } finally {
      setDeletingInsurerId(null);
    }
  };

  const openPolizasExternas = async (customer: SeguwalletCustomer) => {
    setSelectedCustomer(customer);
    setExtPolicies([]);
    setActiveModal('polizas_externas');
    setExtPoliciesLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_customer_external_policies', {
        p_customer_id: customer.id,
      });
      if (error) throw error;
      setExtPolicies((data || []) as ExternalPolicy[]);
    } catch (err) {
      console.error('Error loading external policies:', err);
    } finally {
      setExtPoliciesLoading(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedCustomer(null);
    setSelectedTerm(null);
    setCreateError('');
    setEditError('');
    setResetError('');
    setResetSuccess(false);
    setTermError('');
    setEditPhotoPath(null);
  };

  const officeOptions = [...new Set(customers.map(c => c.office_name).filter(Boolean) as string[])].sort();

  const filteredCustomers = customers.filter(c => {
    if (filterOffice !== 'all' && c.office_name !== filterOffice) return false;
    if (filterSicas === 'vinculado' && (c.sicas_clients_count || 0) === 0) return false;
    if (filterSicas === 'sin_vinculo' && (c.sicas_clients_count || 0) > 0) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.agent_name || '').toLowerCase().includes(q) ||
      (c.sicas_primary_name || '').toLowerCase().includes(q) ||
      (c.office_name || '').toLowerCase().includes(q)
    );
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
            <p className="text-xs text-neutral-500 dark:text-white/40">
              {isAgent ? 'Mis clientes Seguwallet' : 'Administracion de clientes'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && activeTab === 'terms' && (
            <button
              onClick={() => { setTermForm({ title: 'Términos y Condiciones', version: '', content: '' }); setTermError(''); setActiveModal('terms_create'); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-neutral-700 dark:text-white/70 text-sm font-semibold hover:bg-neutral-50 transition-all"
            >
              <Plus className="w-4 h-4" />
              Nueva versión
            </button>
          )}
          {isAdmin && activeTab === 'insurers' && (
            <button
              onClick={openCreateInsurer}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent-hover transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nueva aseguradora
            </button>
          )}
          {activeTab === 'customers' && (
            <button
              onClick={() => { setCreateForm(p => ({ ...p, agent_user_id: isAdmin ? '' : (usuario?.id || '') })); setCreateError(''); setActiveModal('create'); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent-hover transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Crear Cliente
            </button>
          )}
        </div>
      </div>

      {/* Tabs (admin only) */}
      {isAdmin && (
        <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-white/[0.04] rounded-2xl w-fit">
          {(['customers', 'insurers', 'terms'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                activeTab === tab
                  ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white shadow-sm"
                  : "text-neutral-500 dark:text-white/40 hover:text-neutral-700"
              )}
            >
              {tab === 'customers' ? 'Clientes' : tab === 'insurers' ? 'Aseguradoras' : 'Términos'}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'customers' && (<>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { value: customers.length, label: 'Total clientes', color: 'text-neutral-900 dark:text-white' },
          { value: customers.filter(c => c.status === 'active').length, label: 'Activos', color: 'text-emerald-600' },
          { value: customers.filter(c => !c.profile_completed).length, label: 'Perfil incompleto', color: 'text-amber-600' },
          { value: customers.filter(c => !c.last_login_at).length, label: 'Nunca ingresaron', color: 'text-neutral-500' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] p-4">
            <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
            <p className="text-xs text-neutral-500 dark:text-white/40">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, correo, agente u oficina..." className="w-full pl-11 pr-4 py-3 rounded-2xl border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all" />
        </div>
        {isAdmin && officeOptions.length > 0 && (
          <select
            value={filterOffice}
            onChange={e => setFilterOffice(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/70"
          >
            <option value="all">Todas las oficinas</option>
            {officeOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <select
          value={filterSicas}
          onChange={e => setFilterSicas(e.target.value as typeof filterSicas)}
          className="px-4 py-3 rounded-2xl border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/70"
        >
          <option value="all">Todos (SICAS)</option>
          <option value="vinculado">Con SICAS</option>
          <option value="sin_vinculo">Sin SICAS</option>
        </select>
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
                  <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40 hidden lg:table-cell">Oficina</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40 hidden sm:table-cell">SICAS</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40 hidden lg:table-cell">Perfil</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40 hidden lg:table-cell">Términos</th>
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
                      <td className="px-5 py-3 hidden lg:table-cell">
                        {c.office_name ? (
                          <span className="inline-flex items-center gap-1 text-xs text-neutral-600 dark:text-white/50">
                            <Building2 className="w-3 h-3 text-neutral-400" />
                            {c.office_name}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-300 dark:text-white/20">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <button onClick={() => openSicas(c)} className="group text-left">
                          {(c.sicas_clients_count || 0) > 0 ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#1C37E0]/10 text-[#1C37E0] text-[10px] font-bold">
                                {c.sicas_clients_count} vinculado{(c.sicas_clients_count || 0) !== 1 ? 's' : ''}
                              </span>
                              {c.sicas_primary_name && (
                                <p className="text-[10px] text-neutral-500 dark:text-white/40 mt-0.5 truncate max-w-[120px]">{c.sicas_primary_name}</p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-white/5 text-neutral-400 dark:text-white/30 text-[10px] font-medium">
                              Sin vínculo
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-center hidden lg:table-cell">
                        {c.profile_completed
                          ? <span title="Perfil completo"><CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /></span>
                          : <span title="Perfil incompleto"><AlertCircle className="w-4 h-4 text-amber-400 mx-auto" /></span>
                        }
                      </td>
                      <td className="px-5 py-3 text-center hidden lg:table-cell">
                        {c.terms_accepted
                          ? <span title={`v${c.terms_version_accepted}`}><CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /></span>
                          : <span title="Términos pendientes"><Clock className="w-4 h-4 text-neutral-400 mx-auto" /></span>
                        }
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold border", badge.class)}>{badge.label}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => window.open(`/seguwallet/dashboard?preview=${c.id}`, '_blank')} className="p-1.5 rounded-lg text-neutral-400 hover:text-[#1C37E0] hover:bg-blue-50 transition-colors" title="Vista previa"><Eye className="w-3.5 h-3.5" /></button>
                          {isAdmin && (
                            <button
                              onClick={async () => {
                                const ok = await startImpersonation({ platform: 'seguwallet', customerId: c.id });
                                if (ok) window.location.href = '/seguwallet/dashboard';
                              }}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Ver como este cliente"
                            >
                              <User className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Editar"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openSicas(c)} className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Asignar SICAS"><UserPlus className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openReset(c)} className="p-1.5 rounded-lg text-neutral-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Cambiar contrasena"><RotateCcw className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openPolizasExternas(c)} className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Ver polizas externas"><FileStack className="w-3.5 h-3.5" /></button>
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

      </>)}

      {/* ── INSURERS TAB ──────────────────────────────────────────── */}
      {activeTab === 'insurers' && isAdmin && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input type="text" value={insurerSearch} onChange={e => setInsurerSearch(e.target.value)} placeholder="Buscar aseguradora..." className="w-full pl-11 pr-4 py-3 rounded-2xl border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all" />
            </div>
            <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-white/[0.04] rounded-2xl h-fit">
              {(['all', 'active', 'inactive'] as const).map(f => (
                <button key={f} onClick={() => setInsurerFilter(f)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                    insurerFilter === f ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white shadow-sm" : "text-neutral-500 dark:text-white/40")}>
                  {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Inactivas'}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {insurersLoading ? (
            <div className="flex justify-center py-10"><div className="w-8 h-8 border-[3px] border-blue-200 border-t-[#1C37E0] rounded-full animate-spin" /></div>
          ) : (() => {
            const filtered = insurers.filter(ins => {
              const matchSearch = !insurerSearch.trim() || ins.name.toLowerCase().includes(insurerSearch.toLowerCase());
              const matchFilter = insurerFilter === 'all' || (insurerFilter === 'active' ? ins.is_active : !ins.is_active);
              return matchSearch && matchFilter;
            });
            return filtered.length === 0 ? (
              <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] p-12 text-center">
                <Building2 className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                <p className="text-sm text-neutral-500">No hay aseguradoras{insurerSearch ? ` para "${insurerSearch}"` : ''}</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 dark:border-white/[0.06]">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40">Aseguradora</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40 hidden sm:table-cell">Tel. Siniestros</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40 hidden md:table-cell">Directorio</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40 hidden md:table-cell">Siniestros</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40">Estatus</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500 dark:text-white/40">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(ins => (
                        <tr key={ins.id} className="border-b border-neutral-50 dark:border-white/[0.03] hover:bg-neutral-50/50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl overflow-hidden border border-neutral-100 bg-white flex-shrink-0 shadow-sm">
                                {(() => {
                                  const logoUrl = getInsurerLogoUrl(ins);
                                  return logoUrl ? (
                                    <img src={logoUrl} alt={ins.name} className="w-full h-full object-contain p-0.5" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-neutral-100">
                                      <span className="text-xs font-bold text-neutral-400">{ins.name.slice(0, 2).toUpperCase()}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                              <div>
                                <p className="font-semibold text-neutral-900 dark:text-white text-sm">{ins.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <p className="text-xs text-neutral-400">Orden: {ins.display_order}</p>
                                  {ins.logo_local_path ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">local</span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-neutral-100 text-neutral-400 border border-neutral-200">externo</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 hidden sm:table-cell">
                            <p className="text-xs text-neutral-600 dark:text-white/50 font-mono">{ins.claims_phone ? formatPhoneDisplay(ins.claims_phone) : <span className="text-neutral-300">—</span>}</p>
                          </td>
                          <td className="px-4 py-3 text-center hidden md:table-cell">
                            {ins.show_in_directory
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                              : <X className="w-4 h-4 text-neutral-300 mx-auto" />}
                          </td>
                          <td className="px-4 py-3 text-center hidden md:table-cell">
                            {ins.show_in_claims
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                              : <X className="w-4 h-4 text-neutral-300 mx-auto" />}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold border",
                              ins.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-neutral-100 text-neutral-500 border-neutral-200")}>
                              {ins.is_active ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEditInsurer(ins)} className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Editar"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleToggleInsurerActive(ins)} className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title={ins.is_active ? 'Desactivar' : 'Activar'}>
                                {ins.is_active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                              </button>
                              <button onClick={() => handleDeleteInsurer(ins)} disabled={deletingInsurerId === ins.id} className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Eliminar">
                                {deletingInsurerId === ins.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── TERMS TAB ─────────────────────────────────────────────── */}
      {activeTab === 'terms' && isAdmin && (
        <div className="space-y-3">
          {termsLoading ? (
            <div className="flex justify-center py-10"><div className="w-8 h-8 border-[3px] border-blue-200 border-t-[#1C37E0] rounded-full animate-spin" /></div>
          ) : terms.length === 0 ? (
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] p-12 text-center">
              <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No hay versiones de términos</p>
              <p className="text-xs text-neutral-400 mt-1">Crea la primera versión para activarla</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] divide-y divide-neutral-100 dark:divide-white/[0.04]">
              {terms.map(term => (
                <div key={term.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-neutral-900 dark:text-white text-sm">{term.title}</p>
                      {term.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">ACTIVO</span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Versión {term.version} · {term.published_at ? `Publicado ${new Date(term.published_at).toLocaleDateString('es-MX')}` : 'No publicado'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setSelectedTerm(term); setActiveModal('terms_view'); }}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-[#1C37E0] hover:bg-blue-50 transition-colors"
                      title="Ver contenido"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {!term.is_active && (
                      <button
                        onClick={() => handlePublishTerm(term.id)}
                        disabled={publishingId === term.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C37E0] text-white text-xs font-semibold hover:bg-[#1630C8] transition-all disabled:opacity-50"
                      >
                        {publishingId === term.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Publicar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INSURER MODAL */}
      {insurerModalMode && (
        <ModalWrap title={insurerModalMode === 'create' ? 'Nueva Aseguradora' : `Editar: ${selectedInsurer?.name}`} onClose={() => setInsurerModalMode(null)} wide>
          {insurerError && <ErrBox>{insurerError}</ErrBox>}
          <form onSubmit={handleSaveInsurer} className="space-y-5">
            {/* Datos generales */}
            <div>
              <p className="text-xs font-bold text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-3">Datos Generales</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <F label="Nombre *"><input type="text" value={insurerForm.name} onChange={e => setInsurerForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej. Qualitas" className={inp} /></F>
                  <F label="Orden"><input type="number" value={insurerForm.display_order} onChange={e => setInsurerForm(p => ({ ...p, display_order: +e.target.value }))} className={inp} min={0} /></F>
                </div>
                {/* Logo field with local upload + import from URL */}
                <div>
                  <p className="text-xs font-semibold text-neutral-600 dark:text-white/60 mb-2">Logotipo</p>

                  {/* Preview */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-16 h-16 rounded-2xl border border-neutral-200 bg-neutral-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {(() => {
                        const localPreview = logoLocalPath
                          ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/insurance-carriers-logos/${logoLocalPath}`
                          : null;
                        const externalUrl = insurerForm.logo_url && !isBlockedLogoUrl(insurerForm.logo_url) ? insurerForm.logo_url : null;
                        const src = localPreview || externalUrl;
                        return src ? (
                          <img src={src} alt="logo" className="w-full h-full object-contain p-1" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                        ) : (
                          <ImageOff className="w-6 h-6 text-neutral-300" />
                        );
                      })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      {logoLocalPath ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Logo local guardado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-200">
                          <AlertCircle className="w-3 h-3" /> Sin logo local
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Upload file — only when editing */}
                  {insurerModalMode === 'edit' && selectedInsurer && (
                    <div className="space-y-2 mb-3">
                      <input ref={logoFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileUpload} />
                      <button type="button" disabled={logoUploadLoading}
                        onClick={() => logoFileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-400 bg-neutral-50 hover:bg-neutral-100 text-sm font-medium text-neutral-600 transition-all disabled:opacity-50">
                        {logoUploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {logoUploadLoading ? 'Subiendo...' : 'Subir archivo de imagen'}
                      </button>

                      <div className="flex gap-2">
                        <input type="url" value={logoImportUrl} onChange={e => setLogoImportUrl(e.target.value)}
                          placeholder="https://ejemplo.com/logo.png"
                          className={`${inp} flex-1 text-xs`} />
                        <button type="button" disabled={logoImportLoading || !logoImportUrl.trim()}
                          onClick={handleLogoImportFromUrl}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1C37E0] text-white text-xs font-semibold hover:bg-[#1630C8] transition-all disabled:opacity-40 flex-shrink-0">
                          {logoImportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
                          Importar
                        </button>
                      </div>
                      <p className="text-[10px] text-neutral-400">Pega la URL del logo externo y pulsa Importar para guardarlo localmente.</p>
                    </div>
                  )}
                  {insurerModalMode === 'create' && (
                    <p className="text-[10px] text-neutral-400 mb-2">Guarda la aseguradora primero, luego podras subir o importar el logo local.</p>
                  )}

                  <F label="URL logotipo externo (referencia)">
                    <input type="url" value={insurerForm.logo_url || ''} onChange={e => setInsurerForm(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://..." className={inp} />
                    {isBlockedLogoUrl(insurerForm.logo_url) && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-600 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        Esta URL es de un servicio externo (Clearbit) que es detectado como rastreador por Brave. Importa el logo localmente usando el boton Importar de arriba.
                      </p>
                    )}
                  </F>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Sitio web"><input type="url" value={insurerForm.website_url || ''} onChange={e => setInsurerForm(p => ({ ...p, website_url: e.target.value }))} placeholder="https://..." className={inp} /></F>
                  <F label="Color principal"><input type="text" value={insurerForm.primary_color || ''} onChange={e => setInsurerForm(p => ({ ...p, primary_color: e.target.value }))} placeholder="#1C37E0" className={inp} /></F>
                </div>
              </div>
            </div>

            {/* Telefonos */}
            <div>
              <p className="text-xs font-bold text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-3">Telefonos y WhatsApp</p>
              <div className="grid grid-cols-2 gap-3">
                <F label="Tel. Atencion a Clientes"><input type="tel" value={insurerForm.customer_service_phone || ''} onChange={e => setInsurerForm(p => ({ ...p, customer_service_phone: e.target.value }))} placeholder="8001234567" className={inp} /></F>
                <F label="Tel. Pago de Poliza"><input type="tel" value={insurerForm.payment_phone || ''} onChange={e => setInsurerForm(p => ({ ...p, payment_phone: e.target.value }))} placeholder="8001234567" className={inp} /></F>
                <F label="Tel. Siniestros"><input type="tel" value={insurerForm.claims_phone || ''} onChange={e => setInsurerForm(p => ({ ...p, claims_phone: e.target.value }))} placeholder="8001234567" className={inp} /></F>
                <F label="WhatsApp Atencion"><input type="tel" value={insurerForm.customer_service_whatsapp || ''} onChange={e => setInsurerForm(p => ({ ...p, customer_service_whatsapp: e.target.value }))} placeholder="5512345678" className={inp} /></F>
                <F label="WhatsApp Siniestros"><input type="tel" value={insurerForm.claims_whatsapp || ''} onChange={e => setInsurerForm(p => ({ ...p, claims_whatsapp: e.target.value }))} placeholder="5512345678" className={inp} /></F>
              </div>
            </div>

            {/* Links */}
            <div>
              <p className="text-xs font-bold text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-3">Links</p>
              <div className="space-y-3">
                <F label="Link de pago en linea"><input type="url" value={insurerForm.payment_url || ''} onChange={e => setInsurerForm(p => ({ ...p, payment_url: e.target.value }))} placeholder="https://..." className={inp} /></F>
                <div className="grid grid-cols-2 gap-3">
                  <F label="App iOS"><input type="url" value={insurerForm.ios_app_url || ''} onChange={e => setInsurerForm(p => ({ ...p, ios_app_url: e.target.value }))} placeholder="https://apps.apple.com/..." className={inp} /></F>
                  <F label="App Android"><input type="url" value={insurerForm.android_app_url || ''} onChange={e => setInsurerForm(p => ({ ...p, android_app_url: e.target.value }))} placeholder="https://play.google.com/..." className={inp} /></F>
                </div>
                <F label="Condiciones Generales"><input type="url" value={insurerForm.general_conditions_url || ''} onChange={e => setInsurerForm(p => ({ ...p, general_conditions_url: e.target.value }))} placeholder="https://..." className={inp} /></F>
              </div>
            </div>

            {/* Siniestros */}
            <div>
              <p className="text-xs font-bold text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-3">Siniestros</p>
              <F label="Instrucciones para reportar siniestro">
                <textarea value={insurerForm.claims_instructions || ''} onChange={e => setInsurerForm(p => ({ ...p, claims_instructions: e.target.value }))} rows={3} placeholder="Ej. Llama al 800 y ten a la mano tu numero de poliza y ubicacion." className={`${inp} resize-none`} />
              </F>
            </div>

            {/* Visibilidad */}
            <div>
              <p className="text-xs font-bold text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-3">Visibilidad</p>
              <div className="space-y-2">
                {[
                  { key: 'is_active' as const, label: 'Aseguradora activa' },
                  { key: 'show_in_directory' as const, label: 'Mostrar en directorio' },
                  { key: 'show_in_claims' as const, label: 'Mostrar en reporte de siniestros' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => setInsurerForm(p => ({ ...p, [key]: !p[key] }))}
                      className={cn("w-10 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer relative",
                        insurerForm[key] ? "bg-[#1C37E0]" : "bg-neutral-200 dark:bg-white/10")}>
                      <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                        insurerForm[key] ? "translate-x-5" : "translate-x-1")} />
                    </div>
                    <span className="text-sm text-neutral-700 dark:text-white/70">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Acts>
              <button type="submit" disabled={insurerSaving} className={pri}>{insurerSaving ? 'Guardando...' : insurerModalMode === 'create' ? 'Crear Aseguradora' : 'Guardar Cambios'}</button>
              <button type="button" onClick={() => setInsurerModalMode(null)} className={sec}>Cancelar</button>
            </Acts>
          </form>
        </ModalWrap>
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
        <ModalWrap title={`Editar perfil: ${toTitleCase(selectedCustomer.full_name)}`} onClose={closeModal} wide>
          {editError && <ErrBox>{editError}</ErrBox>}

          {/* Photo section */}
          <div className="flex items-center gap-4 mb-5 pb-5 border-b border-neutral-100 dark:border-white/[0.06]">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5">
                {editPhotoPath ? (
                  <img src={getPhotoUrl(editPhotoPath)} alt="foto" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1C37E0]/10 to-[#1C37E0]/20">
                    <span className="text-lg font-bold text-[#1C37E0]">{getInitials(selectedCustomer.full_name)}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => editPhotoRef.current?.click()}
                disabled={photoUploading}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-[#1C37E0] text-white flex items-center justify-center shadow-md hover:bg-[#1630C8] transition-colors disabled:opacity-50"
                title="Cambiar foto"
              >
                {photoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input ref={editPhotoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleEditPhotoUpload} />
            </div>
            <div>
              <p className="font-semibold text-sm text-neutral-900 dark:text-white">{toTitleCase(selectedCustomer.full_name)}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{selectedCustomer.email}</p>
              <div className="flex items-center gap-2 mt-1">
                {selectedCustomer.profile_completed
                  ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Perfil completo</span>
                  : <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600"><AlertCircle className="w-3 h-3" /> Perfil incompleto</span>
                }
                {selectedCustomer.terms_accepted && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><Check className="w-3 h-3" /> Términos v{selectedCustomer.terms_version_accepted}</span>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            {/* Datos personales */}
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-3">Datos personales</p>
              <div className="space-y-3">
                <F label="Nombre completo *">
                  <input type="text" value={editForm.full_name} onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} className={inp} />
                </F>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Fecha de nacimiento">
                    <input type="date" value={editForm.birth_date} onChange={e => setEditForm(p => ({ ...p, birth_date: e.target.value }))} className={inp} />
                  </F>
                  <F label="Genero">
                    <select value={editForm.gender} onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))} className={inp}>
                      <option value="">No especificado</option>
                      <option value="masculino">Masculino</option>
                      <option value="femenino">Femenino</option>
                      <option value="no_binario">No binario</option>
                      <option value="prefiero_no_decir">Prefiero no decir</option>
                    </select>
                  </F>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Estado">
                    <input type="text" value={editForm.state} onChange={e => setEditForm(p => ({ ...p, state: e.target.value }))} placeholder="Ej. Ciudad de Mexico" className={inp} />
                  </F>
                  <F label="Municipio / Alcaldia">
                    <input type="text" value={editForm.municipality} onChange={e => setEditForm(p => ({ ...p, municipality: e.target.value }))} placeholder="Ej. Cuauhtemoc" className={inp} />
                  </F>
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-3">Contacto</p>
              <div className="grid grid-cols-2 gap-3">
                <F label="Telefono">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                    <input type="tel" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} placeholder="55 1234 5678" className={`${inp} pl-9`} />
                  </div>
                </F>
                <F label="WhatsApp">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                    <input type="tel" value={editForm.whatsapp} onChange={e => setEditForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="55 1234 5678" className={`${inp} pl-9`} />
                  </div>
                </F>
              </div>
            </div>

            {/* Cuenta */}
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-3">Cuenta</p>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
            </div>

            {/* Info readonly */}
            <div className="bg-neutral-50 dark:bg-white/[0.02] rounded-2xl p-3 space-y-1.5 text-xs text-neutral-500">
              {selectedCustomer.last_login_at && (
                <p><span className="font-semibold text-neutral-700 dark:text-white/50">Ultimo acceso:</span> {new Date(selectedCustomer.last_login_at).toLocaleString('es-MX')}</p>
              )}
              {selectedCustomer.terms_accepted_at && (
                <p><span className="font-semibold text-neutral-700 dark:text-white/50">Terminos aceptados:</span> {new Date(selectedCustomer.terms_accepted_at).toLocaleDateString('es-MX')} (v{selectedCustomer.terms_version_accepted})</p>
              )}
              {selectedCustomer.profile_updated_at && (
                <p><span className="font-semibold text-neutral-700 dark:text-white/50">Perfil actualizado:</span> {new Date(selectedCustomer.profile_updated_at).toLocaleString('es-MX')}</p>
              )}
              <p><span className="font-semibold text-neutral-700 dark:text-white/50">Creado:</span> {new Date(selectedCustomer.created_at).toLocaleDateString('es-MX')}</p>
            </div>

            <Acts>
              <button type="submit" disabled={saving} className={pri}>{saving ? 'Guardando...' : 'Guardar Cambios'}</button>
              <button type="button" onClick={closeModal} className={sec}>Cancelar</button>
            </Acts>
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

      {/* TERMS CREATE MODAL */}
      {activeModal === 'terms_create' && (
        <ModalWrap title="Nueva versión de Términos" onClose={closeModal} wide>
          {termError && <ErrBox>{termError}</ErrBox>}
          <form onSubmit={handleCreateTerm} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <F label="Título"><input type="text" value={termForm.title} onChange={e => setTermForm(p => ({ ...p, title: e.target.value }))} className={inp} /></F>
              <F label="Versión *"><input type="text" value={termForm.version} onChange={e => setTermForm(p => ({ ...p, version: e.target.value }))} placeholder="Ej. 1.0, 2.1, 2026-05" className={inp} /></F>
            </div>
            <F label="Contenido *">
              <textarea
                value={termForm.content}
                onChange={e => setTermForm(p => ({ ...p, content: e.target.value }))}
                rows={12}
                placeholder="Escribe o pega el texto completo de los términos y condiciones..."
                className={`${inp} resize-none`}
              />
            </F>
            <Acts>
              <button type="submit" disabled={termSaving} className={pri}>{termSaving ? 'Guardando...' : 'Crear versión'}</button>
              <button type="button" onClick={closeModal} className={sec}>Cancelar</button>
            </Acts>
          </form>
        </ModalWrap>
      )}

      {/* TERMS VIEW MODAL */}
      {activeModal === 'terms_view' && selectedTerm && (
        <ModalWrap title={`${selectedTerm.title} — v${selectedTerm.version}`} onClose={closeModal} wide>
          <div className="text-xs text-neutral-500 mb-3">
            {selectedTerm.published_at ? `Publicado el ${new Date(selectedTerm.published_at).toLocaleDateString('es-MX')}` : 'Sin publicar'}
            {selectedTerm.is_active && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">ACTIVO</span>}
          </div>
          <div className="bg-neutral-50 dark:bg-white/[0.03] rounded-2xl p-4 max-h-80 overflow-y-auto text-sm text-neutral-700 dark:text-white/70 leading-relaxed whitespace-pre-wrap border border-neutral-100 dark:border-white/[0.06]">
            {selectedTerm.content}
          </div>
          <div className="mt-4 flex gap-3">
            {!selectedTerm.is_active && (
              <button
                onClick={() => { handlePublishTerm(selectedTerm.id); closeModal(); }}
                className={pri}
              >
                Publicar esta versión
              </button>
            )}
            <button onClick={closeModal} className={sec}>Cerrar</button>
          </div>
        </ModalWrap>
      )}

      {/* POLIZAS EXTERNAS MODAL */}
      {activeModal === 'polizas_externas' && selectedCustomer && (
        <PolizasExternasModal
          customer={selectedCustomer}
          policies={extPolicies}
          loading={extPoliciesLoading}
          onClose={closeModal}
        />
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

// ─── External Policies Types & Modal ─────────────────────────────────────────

interface ExternalPolicyDocument {
  id: string;
  document_type: string;
  document_name: string;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface ExternalPolicy {
  id: string;
  insurer_name: string | null;
  ramo: string | null;
  subramo: string | null;
  policy_number: string | null;
  contractor_name: string | null;
  insured_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  total_premium: number | null;
  currency: string | null;
  notes: string | null;
  created_at: string;
  documents: ExternalPolicyDocument[];
}

const SUPABASE_URL_EXT = import.meta.env.VITE_SUPABASE_URL as string;

function getSignedDocUrl(filePath: string): string {
  return `${SUPABASE_URL_EXT}/storage/v1/object/authenticated/seguwallet-external-policies/${filePath}`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateMX(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

const RAMO_COLORS: Record<string, string> = {
  Vehiculos: '#f59e0b', Salud: '#10b981', Vida: '#ef4444', Hogar: '#3b82f6',
  Danos: '#8b5cf6', Viaje: '#14b8a6', Otro: '#6b7280',
};

function PolizasExternasModal({ customer, policies, loading, onClose }: {
  customer: SeguwalletCustomer;
  policies: ExternalPolicy[];
  loading: boolean;
  onClose: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyPolicy = (p: ExternalPolicy) => {
    const lines = [
      `Aseguradora: ${p.insurer_name || '—'}`,
      `Tipo: ${[p.ramo, p.subramo].filter(Boolean).join(' / ') || '—'}`,
      `Poliza: ${p.policy_number || '—'}`,
      p.start_date ? `Inicio: ${formatDateMX(p.start_date)}` : null,
      p.end_date ? `Fin: ${formatDateMX(p.end_date)}` : null,
      p.contractor_name ? `Contratante: ${p.contractor_name}` : null,
      p.insured_name ? `Asegurado: ${p.insured_name}` : null,
      p.total_premium ? `Prima: $${p.total_premium.toLocaleString('es-MX')} ${p.currency || 'MXN'}` : null,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const statusBadge = (status: string | null) => {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'activa' || s === 'vigente') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'expired' || s === 'vencida') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-neutral-100 text-neutral-600 border-neutral-200';
  };

  const statusLabel = (status: string | null) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'Vigente';
    if (s === 'expired') return 'Vencida';
    return status || '—';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-neutral-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <FileStack className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">Polizas externas</h2>
              <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5">
                {toTitleCase(customer.full_name)}
                {customer.email && <span className="ml-1">· {customer.email}</span>}
                {customer.phone && <span className="ml-1">· {customer.phone}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <span className="px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-white/[0.06] text-xs font-bold text-neutral-600 dark:text-white/50">
                {policies.length} poliza{policies.length !== 1 ? 's' : ''}
              </span>
            )}
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/[0.06] text-neutral-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-[3px] border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : policies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-neutral-50 dark:bg-white/[0.03] border border-neutral-100 dark:border-white/[0.06] flex items-center justify-center mb-4">
                <FileStack className="w-8 h-8 text-neutral-300" />
              </div>
              <p className="text-sm font-semibold text-neutral-500 dark:text-white/40">Sin polizas externas</p>
              <p className="text-xs text-neutral-400 dark:text-white/30 mt-1 max-w-xs">
                Este cliente aun no ha cargado polizas externas en Seguwallet.
              </p>
            </div>
          ) : (
            policies.map(p => {
              const ramoColor = RAMO_COLORS[p.ramo || ''] || '#6b7280';
              const docs = p.documents || [];
              return (
                <div key={p.id} className="rounded-2xl border border-neutral-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* Policy header row */}
                  <div className="flex items-start gap-4 px-5 pt-4 pb-3">
                    {/* Ramo color tag */}
                    <div
                      className="w-1 h-full rounded-full flex-shrink-0 self-stretch min-h-[48px]"
                      style={{ backgroundColor: ramoColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <p className="font-bold text-neutral-900 dark:text-white text-sm">
                          {p.insurer_name || 'Aseguradora no indicada'}
                        </p>
                        {p.ramo && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border" style={{ backgroundColor: ramoColor + '15', color: ramoColor, borderColor: ramoColor + '40' }}>
                            {p.ramo}{p.subramo ? ` · ${p.subramo}` : ''}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${statusBadge(p.status)}`}>
                          {statusLabel(p.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-white/40">
                        {p.policy_number && (
                          <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{p.policy_number}</span>
                        )}
                        {p.start_date && (
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateMX(p.start_date)} → {formatDateMX(p.end_date)}</span>
                        )}
                        {p.total_premium && (
                          <span className="font-semibold text-neutral-700 dark:text-white/60">
                            ${p.total_premium.toLocaleString('es-MX')} {p.currency || 'MXN'}
                          </span>
                        )}
                      </div>
                      {(p.contractor_name || p.insured_name) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-neutral-400 dark:text-white/30">
                          {p.contractor_name && <span>Contratante: {p.contractor_name}</span>}
                          {p.insured_name && <span>Asegurado: {p.insured_name}</span>}
                        </div>
                      )}
                      {p.notes && (
                        <p className="mt-1.5 text-xs text-neutral-500 dark:text-white/40 italic leading-relaxed">{p.notes}</p>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => copyPolicy(p)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                        title="Copiar datos"
                      >
                        {copiedId === p.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Documents */}
                  {docs.length > 0 && (
                    <div className="px-5 pb-4 pt-1 space-y-1.5">
                      <p className="text-[10px] font-bold text-neutral-400 dark:text-white/30 uppercase tracking-wider mb-2">
                        Documentos adjuntos ({docs.length})
                      </p>
                      {docs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-neutral-50 dark:bg-white/[0.03] border border-neutral-100 dark:border-white/[0.04]">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-neutral-700 dark:text-white/70 truncate">{doc.document_name || doc.document_type}</p>
                            <p className="text-[10px] text-neutral-400 dark:text-white/30">
                              {doc.document_type}{doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
                            </p>
                          </div>
                          {doc.file_path && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <a
                                href={getSignedDocUrl(doc.file_path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                title="Ver archivo"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={getSignedDocUrl(doc.file_path)}
                                download
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                                title="Descargar"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer: uploaded date */}
                  <div className="px-5 pb-3 flex items-center justify-between">
                    <p className="text-[10px] text-neutral-300 dark:text-white/20">
                      Cargada el {new Date(p.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-white/[0.06] flex justify-end">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-white/60 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
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
