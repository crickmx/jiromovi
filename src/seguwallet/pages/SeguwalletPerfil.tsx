import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User, Phone, Mail, CheckCircle, Camera, MapPin, Calendar,
  ChevronDown, MessageCircle, Pencil, X, Loader2, AlertCircle,
  FolderOpen, Shield, Globe, Phone as PhoneIcon, ExternalLink,
  Clock, KeyRound, Smartphone, Lock
} from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand } from '../lib/AgentBrandContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import SeguwalletExpedienteModal from '../../components/contactos/SeguwalletExpedienteModal';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const MEXICAN_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
  'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima',
  'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo',
  'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
  'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz',
  'Yucatán', 'Zacatecas',
];

const GENDER_OPTIONS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'no_binario', label: 'No binario' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decir' },
];

type TabId = 'datos' | 'expediente' | 'agente' | 'seguridad';

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: 'datos', label: 'Datos Personales', icon: User },
  { id: 'expediente', label: 'Expediente 492', icon: FolderOpen },
  { id: 'agente', label: 'Mi Agente', icon: Globe },
  { id: 'seguridad', label: 'Seguridad', icon: Shield },
];

function getPhotoUrl(path: string | null | undefined, fallback?: string | null): string | null {
  if (path) return `${SUPABASE_URL}/storage/v1/object/public/seguwallet-profile-photos/${path}?t=${Date.now()}`;
  return fallback || null;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return 'SW';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function toTitleCase(s: string) {
  return s ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return d; }
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return 'Nunca';
  try {
    return new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

function getContrastColor(hex: string): string {
  const h = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.179 ? '#111827' : '#ffffff';
}

interface ProfileFormData {
  full_name: string;
  phone: string;
  whatsapp: string;
  state: string;
  municipality: string;
  birth_date: string;
  gender: string;
}

export function SeguwalletPerfil() {
  const { customer, refresh } = useSeguwallet();
  const { brand } = useAgentBrand();
  const primary = brand.primaryColor;
  const contrastOnPrimary = getContrastColor(primary);
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab — driven by ?tab= query param
  const tabParam = (searchParams.get('tab') || 'datos') as TabId;
  const activeTab: TabId = ['datos', 'expediente', 'agente', 'seguridad'].includes(tabParam) ? tabParam : 'datos';
  const setTab = (id: TabId) => setSearchParams(id === 'datos' ? {} : { tab: id }, { replace: true });

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    full_name: '', phone: '', whatsapp: '', state: '', municipality: '', birth_date: '', gender: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Photo
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Expediente modal
  const [showExpediente, setShowExpediente] = useState(false);

  useEffect(() => {
    if (customer) {
      setProfileForm({
        full_name: customer.full_name || '',
        phone: customer.phone || '',
        whatsapp: customer.whatsapp || '',
        state: customer.state || '',
        municipality: customer.municipality || '',
        birth_date: customer.birth_date || '',
        gender: customer.gender || '',
      });
      setLocalPhotoUrl(getPhotoUrl(customer.profile_photo_path, customer.profile_photo_url));
    }
  }, [customer]);

  const photoUrl = localPhotoUrl;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !customer) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowed.includes(file.type)) { setPhotoError('Formato no permitido. Usa JPG, PNG o WEBP.'); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError('La imagen no debe superar 5 MB.'); return; }

    setPhotoUploading(true);
    setPhotoError('');
    try {
      const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
      const path = `seguwallet/customers/${customer.id}/profile-photo.${ext}`;
      const { error: uploadError } = await supabase.storage.from('seguwallet-profile-photos').upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      await supabase.from('seguwallet_customers').update({ profile_photo_path: path, profile_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', customer.id);
      await supabase.from('seguwallet_profile_audit_logs').insert({ customer_id: customer.id, actor_id: customer.id, actor_type: 'customer', action: 'profile_photo_uploaded', changed_fields: { profile_photo_path: path } });
      const newUrl = `${SUPABASE_URL}/storage/v1/object/public/seguwallet-profile-photos/${path}?t=${Date.now()}`;
      setLocalPhotoUrl(newUrl);
      await refresh();
    } catch (err: any) {
      setPhotoError(err.message || 'Error al subir foto.');
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    if (!customer) return;
    setPhotoUploading(true);
    try {
      if (customer.profile_photo_path) await supabase.storage.from('seguwallet-profile-photos').remove([customer.profile_photo_path]);
      await supabase.from('seguwallet_customers').update({ profile_photo_path: null, profile_photo_url: null, updated_at: new Date().toISOString() }).eq('id', customer.id);
      await supabase.from('seguwallet_profile_audit_logs').insert({ customer_id: customer.id, actor_id: customer.id, actor_type: 'customer', action: 'profile_photo_deleted', changed_fields: {} });
      setLocalPhotoUrl(null);
      await refresh();
    } catch (err: any) {
      setPhotoError(err.message || 'Error al eliminar foto.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!profileForm.full_name.trim()) { setProfileError('El nombre es obligatorio.'); return; }
    setProfileSaving(true);
    setProfileError('');
    try {
      const { error } = await supabase.from('seguwallet_customers').update({
        full_name: profileForm.full_name.trim(),
        phone: profileForm.phone.trim() || null,
        whatsapp: profileForm.whatsapp.trim() || null,
        state: profileForm.state || null,
        municipality: profileForm.municipality.trim() || null,
        birth_date: profileForm.birth_date || null,
        gender: profileForm.gender || null,
        profile_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', customer.id);
      if (error) throw error;
      await supabase.from('seguwallet_profile_audit_logs').insert({ customer_id: customer.id, actor_id: customer.id, actor_type: 'customer', action: 'profile_updated_by_customer', changed_fields: profileForm });
      setProfileSuccess(true);
      setEditing(false);
      await refresh();
      setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err: any) {
      setProfileError(err.message || 'Error al guardar cambios.');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Reusable field input ───────────────────────────────────────────────
  const fieldInput = (label: string, field: keyof ProfileFormData, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={profileForm[field]}
        onChange={e => setProfileForm(f => ({ ...f, [field]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none transition-all"
        onFocus={e => { e.target.style.borderColor = primary; e.target.style.boxShadow = `0 0 0 3px ${primary}20`; }}
        onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}
      />
    </div>
  );

  // ── Info row ───────────────────────────────────────────────────────────
  const InfoRow = ({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (
      <div className="flex items-center gap-4 py-3.5 border-b border-neutral-100 last:border-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primary + '15' }}>
          <Icon className="w-4 h-4" style={{ color: primary }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">{label}</p>
          <p className="text-sm font-semibold text-neutral-900 mt-0.5 truncate">{value}</p>
        </div>
      </div>
    );
  };

  // ── Profile hero header ────────────────────────────────────────────────
  const ProfileHero = () => (
    <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm overflow-hidden mb-5">
      {/* Gradient banner */}
      <div
        className="h-24 relative"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}aa 100%)` }}
      />

      <div className="px-6 pb-6 relative">
        {/* Avatar — overlapping banner */}
        <div className="flex items-end justify-between -mt-12 mb-4">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-neutral-100"
              style={{ backgroundColor: primary }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Foto de perfil" className="w-full h-full object-cover" onError={() => setLocalPhotoUrl(null)} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold" style={{ color: contrastOnPrimary }}>
                  {getInitials(customer?.full_name)}
                </div>
              )}
            </div>

            {/* Camera button */}
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl flex items-center justify-center shadow-md border-2 border-white text-white transition-all hover:brightness-110 disabled:opacity-60"
              style={{ backgroundColor: primary }}
              title="Cambiar foto"
            >
              {photoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>

            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
          </div>

          {/* Edit button */}
          <button
            onClick={() => { setEditing(true); setTab('datos'); setProfileError(''); setProfileSuccess(false); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition-all hover:shadow-sm"
            style={{ borderColor: primary + '40', color: primary, backgroundColor: primary + '08' }}
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar perfil
          </button>
        </div>

        {/* Name + status */}
        <div>
          <h2 className="text-xl font-bold text-neutral-900 leading-tight">
            {toTitleCase(customer?.full_name || 'Usuario')}
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">{customer?.email}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: primary + '18', color: primary }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primary }} />
              Cliente Seguwallet Activo
            </span>
            {customer?.whatsapp && (
              <a
                href={`https://wa.me/${customer.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <MessageCircle className="w-3 h-3" />
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Photo actions */}
        {photoUrl && (
          <div className="flex items-center gap-2 mt-3">
            <button onClick={handleDeletePhoto} className="text-xs font-semibold text-red-500 hover:text-red-600 hover:underline transition-colors">
              Eliminar foto
            </button>
          </div>
        )}

        {photoError && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {photoError}
          </div>
        )}
      </div>
    </div>
  );

  // ── Tabs bar ───────────────────────────────────────────────────────────
  const TabBar = () => (
    <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-1.5 mb-5 flex gap-1">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => { setTab(tab.id); setEditing(false); }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150',
              !isActive && 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
            )}
            style={isActive ? { backgroundColor: primary, color: contrastOnPrimary } : undefined}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" />
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );

  // ── TAB: DATOS PERSONALES ──────────────────────────────────────────────
  const TabDatos = () => (
    <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-2 flex items-center justify-between">
        <h3 className="font-bold text-neutral-900">Datos Personales</h3>
        {!editing && (
          <button
            onClick={() => { setEditing(true); setProfileError(''); }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ color: primary, backgroundColor: primary + '10' }}
          >
            <Pencil className="w-3 h-3" />
            Editar
          </button>
        )}
      </div>

      {profileSuccess && (
        <div className="mx-6 mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Perfil actualizado correctamente.
        </div>
      )}

      {!editing ? (
        <div className="px-6 pb-5">
          <InfoRow icon={Mail} label="Correo electrónico" value={customer?.email} />
          <InfoRow icon={Phone} label="Teléfono" value={customer?.phone} />
          <InfoRow icon={MessageCircle} label="WhatsApp" value={customer?.whatsapp} />
          <InfoRow icon={MapPin} label="Estado" value={customer?.state} />
          <InfoRow icon={MapPin} label="Municipio / Alcaldía" value={customer?.municipality} />
          <InfoRow icon={Calendar} label="Fecha de nacimiento" value={formatDate(customer?.birth_date)} />
          <InfoRow icon={User} label="Género" value={customer?.gender ? GENDER_OPTIONS.find(g => g.value === customer.gender)?.label : null} />
          <InfoRow icon={Clock} label="Fecha de registro" value={formatDateTime(customer?.created_at)} />
          <InfoRow icon={Clock} label="Último acceso" value={formatDateTime(customer?.last_login_at)} />

          {!customer?.phone && !customer?.state && (
            <div className="py-4 text-center">
              <p className="text-sm text-neutral-400">Completa tu perfil para ver más información.</p>
              <button onClick={() => setEditing(true)} className="text-sm font-semibold mt-1 hover:underline" style={{ color: primary }}>
                Completar ahora
              </button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSaveProfile} className="px-6 pb-6 space-y-4">
          {profileError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {profileError}
            </div>
          )}

          {fieldInput('Nombre completo *', 'full_name', 'text', 'Tu nombre completo')}

          <div className="grid grid-cols-2 gap-4">
            {fieldInput('Teléfono', 'phone', 'tel', 'Ej. 8112345678')}
            {fieldInput('WhatsApp', 'whatsapp', 'tel', 'Ej. 8112345678')}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">Estado</label>
            <div className="relative">
              <select
                value={profileForm.state}
                onChange={e => setProfileForm(f => ({ ...f, state: e.target.value }))}
                className="w-full appearance-none px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none pr-10"
                onFocus={e => { e.target.style.borderColor = primary; e.target.style.boxShadow = `0 0 0 3px ${primary}20`; }}
                onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}
              >
                <option value="">Selecciona tu estado</option>
                {MEXICAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            </div>
          </div>

          {fieldInput('Municipio / Alcaldía', 'municipality', 'text', 'Ej. Monterrey')}

          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">Fecha de nacimiento</label>
            <input
              type="date"
              value={profileForm.birth_date}
              onChange={e => setProfileForm(f => ({ ...f, birth_date: e.target.value }))}
              max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0]}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none"
              onFocus={e => { e.target.style.borderColor = primary; e.target.style.boxShadow = `0 0 0 3px ${primary}20`; }}
              onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">Género</label>
            <div className="grid grid-cols-2 gap-2">
              {GENDER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProfileForm(f => ({ ...f, gender: f.gender === opt.value ? '' : opt.value }))}
                  className={cn('px-4 py-2.5 rounded-xl border text-sm font-medium transition-all text-left',
                    profileForm.gender !== opt.value && 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                  )}
                  style={profileForm.gender === opt.value ? { borderColor: primary, color: primary, backgroundColor: primary + '0f' } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setEditing(false); setProfileError(''); }}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-neutral-200 bg-white text-neutral-700 text-sm font-semibold"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={profileSaving}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-60 transition-all"
              style={{ backgroundColor: primary, color: contrastOnPrimary }}
            >
              {profileSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</> : <><CheckCircle className="w-4 h-4" />Guardar cambios</>}
            </button>
          </div>
        </form>
      )}
    </div>
  );

  // ── TAB: EXPEDIENTE ────────────────────────────────────────────────────
  const TabExpediente = () => (
    <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: primary + '18' }}>
          <FolderOpen className="w-5 h-5" style={{ color: primary }} />
        </div>
        <div>
          <h3 className="font-bold text-neutral-900">Mi Expediente Digital</h3>
          <p className="text-xs text-neutral-400">Documentos e identificaciones</p>
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-neutral-100 bg-neutral-50">
        <p className="text-sm text-neutral-600 leading-relaxed">
          Aquí puedes subir y administrar tus documentos personales. Tu asesor puede solicitarlos para trámites y cotizaciones.
        </p>
      </div>

      <button
        onClick={() => setShowExpediente(true)}
        className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
        style={{ backgroundColor: primary, color: contrastOnPrimary }}
      >
        <FolderOpen className="w-4 h-4" />
        Administrar expediente
      </button>
    </div>
  );

  // ── TAB: MI AGENTE ─────────────────────────────────────────────────────
  const TabAgente = () => {
    const agentInitials = getInitials(brand.agentName);
    const hasAgent = brand.agentName !== 'Tu Agente';

    if (!hasAgent) {
      return (
        <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-neutral-300" />
          </div>
          <p className="font-semibold text-neutral-700">Sin agente asignado</p>
          <p className="text-sm text-neutral-400 mt-1">Contacta a soporte para que te asignen un asesor.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Agent card */}
        <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm overflow-hidden">
          {/* Banner */}
          <div className="h-16" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}99 100%)` }} />

          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-8 mb-4">
              <div
                className="w-16 h-16 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-xl font-bold overflow-hidden bg-neutral-100 flex-shrink-0"
              >
                {brand.profileImageUrl ? (
                  <img src={brand.profileImageUrl} alt={brand.agentName} className="w-full h-full object-cover" />
                ) : (
                  <span style={{ backgroundColor: primary, color: getContrastColor(primary) }}
                    className="w-full h-full flex items-center justify-center text-xl font-bold">
                    {agentInitials}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 mb-1">
                <h3 className="font-bold text-neutral-900 text-lg leading-tight">{toTitleCase(brand.agentName)}</h3>
                {brand.officeName && (
                  <p className="text-sm text-neutral-500 mt-0.5">{brand.officeName}</p>
                )}
              </div>
            </div>

            {/* Contact info */}
            <div className="space-y-2.5 mb-5">
              {brand.email && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <Mail className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  <span className="text-sm text-neutral-700 truncate">{brand.email}</span>
                </div>
              )}
              {brand.phone && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <Phone className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  <span className="text-sm text-neutral-700">{brand.phone}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              {brand.whatsappUrl && (
                <a
                  href={brand.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1ebe5d] transition-colors shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
              {brand.telUrl && (
                <a
                  href={brand.telUrl}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold transition-colors shadow-sm"
                  style={{ backgroundColor: primary, color: contrastOnPrimary }}
                >
                  <PhoneIcon className="w-4 h-4" />
                  Llamar
                </a>
              )}
              {brand.mailtoUrl && (
                <a
                  href={brand.mailtoUrl}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors shadow-sm"
                >
                  <Mail className="w-4 h-4" />
                  Correo
                </a>
              )}
              {brand.webUrl && (
                <a
                  href={brand.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver página
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── TAB: SEGURIDAD ─────────────────────────────────────────────────────
  const TabSeguridad = () => (
    <div className="space-y-4">
      {/* Access info */}
      <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm p-6 space-y-0">
        <h3 className="font-bold text-neutral-900 mb-4">Información de acceso</h3>
        <InfoRow icon={Mail} label="Correo de acceso" value={customer?.email} />
        <InfoRow icon={Clock} label="Último acceso" value={formatDateTime(customer?.last_login_at)} />
        <InfoRow icon={Clock} label="Cuenta creada" value={formatDateTime(customer?.created_at)} />
        <InfoRow icon={Shield} label="Estado de cuenta" value={customer?.status === 'active' ? 'Activa' : 'Inactiva'} />
      </div>

      {/* Access method */}
      <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primary + '18' }}>
            <Smartphone className="w-5 h-5" style={{ color: primary }} />
          </div>
          <div>
            <h4 className="font-bold text-neutral-900">Acceso sin contraseña</h4>
            <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
              Tu cuenta usa acceso mediante código de verificación enviado por WhatsApp o correo. No necesitas recordar contraseñas.
            </p>
          </div>
        </div>
      </div>

      {/* Security tips */}
      <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primary + '18' }}>
            <Lock className="w-5 h-5" style={{ color: primary }} />
          </div>
          <h4 className="font-bold text-neutral-900">Consejos de seguridad</h4>
        </div>
        <ul className="space-y-2">
          {[
            'Nunca compartas tu código de acceso con nadie.',
            'Usa un correo electrónico al que solo tú tengas acceso.',
            'Si pierdes acceso a tu correo, contacta a tu asesor.',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-600">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: primary }} />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-0">
      {/* Profile hero */}
      <ProfileHero />

      {/* Tabs */}
      <TabBar />

      {/* Tab content */}
      {activeTab === 'datos' && <TabDatos />}
      {activeTab === 'expediente' && <TabExpediente />}
      {activeTab === 'agente' && <TabAgente />}
      {activeTab === 'seguridad' && <TabSeguridad />}

      {/* Expediente modal */}
      {showExpediente && customer && (
        <SeguwalletExpedienteModal
          customerId={customer.id}
          customerName={customer.full_name}
          agentUserId={customer.agent_user_id}
          onClose={() => setShowExpediente(false)}
          readOnly={false}
        />
      )}
    </div>
  );
}
