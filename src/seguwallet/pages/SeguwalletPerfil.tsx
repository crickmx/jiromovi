import { useState, useRef, useEffect } from 'react';
import { User, Lock, Phone, Mail, CheckCircle, Camera, Trash2, MapPin, Calendar, ChevronDown, MessageCircle, Pencil, X, Loader2, AlertCircle } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand } from '../lib/AgentBrandContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

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

function getPhotoUrl(path: string | null | undefined, fallback: string | null | undefined): string | null {
  if (path) return `${SUPABASE_URL}/storage/v1/object/public/seguwallet-profile-photos/${path}`;
  return fallback || null;
}

function getInitials(name: string) {
  if (!name) return 'SW';
  const parts = name.split(' ');
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function toTitleCase(s: string) {
  return s ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';
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

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    full_name: '',
    phone: '',
    whatsapp: '',
    state: '',
    municipality: '',
    birth_date: '',
    gender: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  // Photo
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  const photoUrl = localPhotoUrl || getPhotoUrl(customer?.profile_photo_path, customer?.profile_photo_url);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !customer) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      setPhotoError('Formato no permitido. Usa JPG, PNG o WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('La imagen no debe superar 5 MB.');
      return;
    }

    setPhotoUploading(true);
    setPhotoError('');
    try {
      const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
      const path = `seguwallet/customers/${customer.id}/profile-photo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('seguwallet-profile-photos')
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('seguwallet_customers')
        .update({
          profile_photo_path: path,
          profile_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id);

      if (dbError) throw dbError;

      // Log audit
      await supabase.from('seguwallet_profile_audit_logs').insert({
        customer_id: customer.id,
        actor_id: customer.id,
        actor_type: 'customer',
        action: 'profile_photo_uploaded',
        changed_fields: { profile_photo_path: path },
      });

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
      if (customer.profile_photo_path) {
        await supabase.storage.from('seguwallet-profile-photos').remove([customer.profile_photo_path]);
      }
      await supabase.from('seguwallet_customers').update({
        profile_photo_path: null,
        profile_photo_url: null,
        updated_at: new Date().toISOString(),
      }).eq('id', customer.id);

      await supabase.from('seguwallet_profile_audit_logs').insert({
        customer_id: customer.id,
        actor_id: customer.id,
        actor_type: 'customer',
        action: 'profile_photo_deleted',
        changed_fields: {},
      });

      setLocalPhotoUrl(null);
      await refresh();
    } catch (err: any) {
      setPhotoError(err.message || 'Error al eliminar foto.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleOpenEdit = () => {
    setProfileError('');
    setProfileSuccess(false);
    setEditing(true);
  };

  const handleCancelEdit = () => {
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
    }
    setProfileError('');
    setEditing(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!profileForm.full_name.trim()) {
      setProfileError('El nombre es obligatorio.');
      return;
    }
    setProfileSaving(true);
    setProfileError('');
    try {
      const { error } = await supabase
        .from('seguwallet_customers')
        .update({
          full_name: profileForm.full_name.trim(),
          phone: profileForm.phone.trim() || null,
          whatsapp: profileForm.whatsapp.trim() || null,
          state: profileForm.state || null,
          municipality: profileForm.municipality.trim() || null,
          birth_date: profileForm.birth_date || null,
          gender: profileForm.gender || null,
          profile_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id);

      if (error) throw error;

      await supabase.from('seguwallet_profile_audit_logs').insert({
        customer_id: customer.id,
        actor_id: customer.id,
        actor_type: 'customer',
        action: 'profile_updated_by_customer',
        changed_fields: profileForm,
      });

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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setPwError('Completa todos los campos.');
      return;
    }
    if (passwordForm.next.length < 8) {
      setPwError('La nueva contrasena debe tener al menos 8 caracteres.');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPwError('Las contrasenas no coinciden.');
      return;
    }
    setPwLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: customer?.email || '',
        password: passwordForm.current,
      });
      if (signInError) {
        setPwError('La contrasena actual es incorrecta.');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: passwordForm.next });
      if (updateError) throw updateError;
      setPwSuccess(true);
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      setPwError(err.message || 'Error al cambiar la contrasena.');
    } finally {
      setPwLoading(false);
    }
  };

  const fieldInput = (label: string, field: keyof ProfileFormData, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-semibold text-neutral-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={profileForm[field]}
        onChange={e => setProfileForm(f => ({ ...f, [field]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none transition-all"
        style={{ ['--focus-color' as string]: primary }}
        onFocus={e => e.target.style.borderColor = primary}
        onBlur={e => e.target.style.borderColor = ''}
      />
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Mi Perfil</h1>
        <p className="text-sm text-neutral-500 mt-1">Edita tu informacion personal y preferencias</p>
      </div>

      {/* ── Photo + Name Card ── */}
      <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: primary }} />
        <div className="p-6">
          {/* Avatar row */}
          <div className="flex items-center gap-5 mb-6">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-neutral-100 bg-neutral-50 shadow-sm">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                    onError={() => setLocalPhotoUrl(null)}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white text-2xl font-bold"
                    style={{ backgroundColor: primary }}
                  >
                    {getInitials(customer?.full_name || '')}
                  </div>
                )}
              </div>
              {/* Camera overlay button */}
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl flex items-center justify-center shadow-md border-2 border-white text-white transition-all hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: primary }}
                title="Cambiar foto"
              >
                {photoUploading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-neutral-900 text-lg truncate">
                {toTitleCase(customer?.full_name || '')}
              </p>
              <p className="text-sm text-neutral-500">Cliente Seguwallet</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="text-xs font-semibold transition-colors hover:underline"
                  style={{ color: primary }}
                >
                  Cambiar foto
                </button>
                {photoUrl && (
                  <>
                    <span className="text-neutral-300">·</span>
                    <button
                      onClick={handleDeletePhoto}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 hover:underline transition-colors"
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>

            {!editing && (
              <button
                onClick={handleOpenEdit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition-all hover:shadow-sm flex-shrink-0"
                style={{ borderColor: primary + '40', color: primary, backgroundColor: primary + '08' }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </button>
            )}
          </div>

          {photoError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {photoError}
            </div>
          )}

          {profileSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Perfil actualizado correctamente.
            </div>
          )}

          {/* ── View mode ── */}
          {!editing && (
            <div className="space-y-2.5">
              {[
                { icon: Mail, label: 'Correo electronico', value: customer?.email },
                { icon: Phone, label: 'Telefono', value: customer?.phone },
                { icon: MessageCircle, label: 'WhatsApp', value: customer?.whatsapp },
                { icon: MapPin, label: 'Estado', value: customer?.state },
                { icon: MapPin, label: 'Municipio', value: customer?.municipality },
                { icon: Calendar, label: 'Fecha de nacimiento', value: customer?.birth_date },
                { icon: User, label: 'Genero', value: customer?.gender ? GENDER_OPTIONS.find(g => g.value === customer.gender)?.label : null },
              ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <div className="p-1.5 rounded-lg bg-white border border-neutral-100 flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-neutral-400 font-medium">{label}</p>
                    <p className="text-sm font-semibold text-neutral-900">{value}</p>
                  </div>
                </div>
              ))}
              {/* Email always shown even if no other fields */}
              {!customer?.phone && !customer?.whatsapp && !customer?.state && (
                <p className="text-xs text-neutral-400 text-center py-2">
                  Completa tu perfil para ver mas informacion.
                </p>
              )}
            </div>
          )}

          {/* ── Edit mode ── */}
          {editing && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                  {profileError}
                </div>
              )}

              {fieldInput('Nombre completo *', 'full_name', 'text', 'Tu nombre completo')}
              {fieldInput('Telefono', 'phone', 'tel', 'Ej. 8112345678')}
              {fieldInput('WhatsApp', 'whatsapp', 'tel', 'Ej. 8112345678')}

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 inline mr-1 opacity-60" />
                  Estado
                </label>
                <div className="relative">
                  <select
                    value={profileForm.state}
                    onChange={e => setProfileForm(f => ({ ...f, state: e.target.value }))}
                    className="w-full appearance-none px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none transition-all pr-10"
                  >
                    <option value="">Selecciona tu estado</option>
                    {MEXICAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                </div>
              </div>

              {fieldInput('Municipio / Alcaldía', 'municipality', 'text', 'Ej. Monterrey')}

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 inline mr-1 opacity-60" />
                  Fecha de nacimiento
                </label>
                <input
                  type="date"
                  value={profileForm.birth_date}
                  onChange={e => setProfileForm(f => ({ ...f, birth_date: e.target.value }))}
                  max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0]}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Genero</label>
                <div className="grid grid-cols-2 gap-2">
                  {GENDER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setProfileForm(f => ({ ...f, gender: f.gender === opt.value ? '' : opt.value }))}
                      className={cn(
                        "px-4 py-2.5 rounded-xl border text-sm font-medium transition-all text-left",
                        profileForm.gender === opt.value
                          ? "border-current font-semibold"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                      )}
                      style={profileForm.gender === opt.value
                        ? { borderColor: primary, color: primary, backgroundColor: primary + '0f' }
                        : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-neutral-200 bg-white text-neutral-700 text-sm font-semibold transition-all hover:bg-neutral-50"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-lg hover:shadow-xl disabled:opacity-60 hover:brightness-105"
                  style={{ backgroundColor: primary }}
                >
                  {profileSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</>
                    : <><CheckCircle className="w-4 h-4" />Guardar cambios</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ── Password change ── */}
      <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 rounded-xl" style={{ backgroundColor: primary + '12' }}>
            <Lock className="w-3.5 h-3.5" style={{ color: primary }} />
          </div>
          <h2 className="font-bold text-neutral-900">Cambiar Contrasena</h2>
        </div>

        {pwSuccess && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">Contrasena actualizada correctamente.</p>
          </div>
        )}

        {pwError && (
          <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-700 font-medium">
            {pwError}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4" noValidate>
          {(['current', 'next', 'confirm'] as const).map((field, i) => (
            <div key={field}>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                {i === 0 ? 'Contrasena actual' : i === 1 ? 'Nueva contrasena' : 'Confirmar nueva contrasena'}
              </label>
              <input
                type="password"
                value={passwordForm[field]}
                onChange={e => setPasswordForm(f => ({ ...f, [field]: e.target.value }))}
                placeholder={i === 0 ? 'Tu contrasena actual' : i === 1 ? 'Minimo 8 caracteres' : 'Repite tu nueva contrasena'}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none transition-all"
                autoComplete={i === 0 ? 'current-password' : 'new-password'}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={pwLoading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg hover:shadow-xl disabled:opacity-60 hover:brightness-105"
            style={{ backgroundColor: primary }}
          >
            {pwLoading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Actualizar contrasena'}
          </button>
        </form>
      </div>
    </div>
  );
}
