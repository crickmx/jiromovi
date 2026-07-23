import { useEffect, useState, useRef } from 'react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { supabase } from '../lib/supabase';
import { User, Phone, Mail, MapPin, Building2, Shield, Camera, Check, Loader as Loader2, Pencil, X, Globe, CreditCard, Calendar, BadgeCheck, Info, ExternalLink, Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import UbicacionPicker, { type UbicacionValue } from '../components/ubicacion/UbicacionPicker';

interface FiscalRegime {
  id: string;
  name: string;
  iva_trasladado: number;
  iva_retenido: number;
  isr: number;
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatFieldName(key: string): string {
  const map: Record<string, string> = {
    nombre: 'Nombre(s)',
    apellidos: 'Apellidos',
    celular_personal: 'Celular Personal',
    email_personal: 'Correo Personal',
    celular_laboral: 'Celular Laboral',
    email_laboral: 'Correo Laboral',
    puesto: 'Puesto',
    extension_telefonica: 'Extensión',
    fecha_nacimiento: 'Fecha de Nacimiento',
    fecha_ingreso: 'Fecha de Ingreso',
    regimen_fiscal_id: 'Régimen Fiscal',
    banco: 'Banco',
    clabe: 'CLABE',
  };
  return map[key] || key;
}

type EditableField =
  | 'nombre' | 'apellidos' | 'celular_personal' | 'email_personal'
  | 'celular_laboral' | 'email_laboral' | 'extension_telefonica'
  | 'regimen_fiscal_id' | 'banco' | 'clabe'
  | 'fecha_nacimiento' | 'puesto' | 'fecha_ingreso';

type RolEditable = Record<EditableField, boolean>;

const EDITABLES_BY_ROL: Record<string, RolEditable> = {
  Administrador: {
    nombre: true, apellidos: true, celular_personal: true, email_personal: true,
    celular_laboral: true, email_laboral: true, extension_telefonica: true,
    regimen_fiscal_id: true, banco: true, clabe: true,
    fecha_nacimiento: true, puesto: true, fecha_ingreso: true,
  },
  Gerente: {
    nombre: false, apellidos: false, celular_personal: true, email_personal: true,
    celular_laboral: true, email_laboral: true, extension_telefonica: true,
    regimen_fiscal_id: true, banco: true, clabe: true,
    fecha_nacimiento: true, puesto: false, fecha_ingreso: false,
  },
  Agente: {
    nombre: false, apellidos: false, celular_personal: true, email_personal: true,
    celular_laboral: true, email_laboral: true, extension_telefonica: false,
    regimen_fiscal_id: true, banco: true, clabe: true,
    fecha_nacimiento: true, puesto: false, fecha_ingreso: false,
  },
  Empleado: {
    nombre: false, apellidos: false, celular_personal: true, email_personal: true,
    celular_laboral: true, email_laboral: true, extension_telefonica: false,
    regimen_fiscal_id: false, banco: false, clabe: false,
    fecha_nacimiento: true, puesto: false, fecha_ingreso: false,
  },
};

const DEFAULT_EDITABLES: RolEditable = {
  nombre: false, apellidos: false, celular_personal: true, email_personal: true,
  celular_laboral: true, email_laboral: true, extension_telefonica: false,
  regimen_fiscal_id: false, banco: false, clabe: false,
  fecha_nacimiento: true, puesto: false, fecha_ingreso: false,
};

function getEditables(rol: string): RolEditable {
  return EDITABLES_BY_ROL[rol] ?? DEFAULT_EDITABLES;
}

interface Section {
  title: string;
  icon: React.ElementType;
  fields: EditableField[];
}

const SECTIONS: Section[] = [
  {
    title: 'Datos Personales',
    icon: User,
    fields: ['nombre', 'apellidos', 'celular_personal', 'email_personal', 'fecha_nacimiento'],
  },
  {
    title: 'Datos Laborales',
    icon: BadgeCheck,
    fields: ['puesto', 'fecha_ingreso', 'celular_laboral', 'email_laboral', 'extension_telefonica'],
  },
  {
    title: 'Datos Bancarios',
    icon: CreditCard,
    fields: ['regimen_fiscal_id', 'banco', 'clabe'],
  },
];

interface FieldRowProps {
  label: string;
  value: string;
  editable: boolean;
  editing: boolean;
  onChange: (v: string) => void;
  type?: string;
  icon?: React.ElementType;
}

function FieldRow({ label, value, editable, editing, onChange, type = 'text', icon: Icon }: FieldRowProps) {
  return (
    <div className="group flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/35 flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </label>
      {editing && editable ? (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-9 w-full rounded-xl border border-accent/40 bg-accent/5 dark:bg-accent/10 px-3 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
        />
      ) : (
        <p className={cn(
          'text-sm min-h-[36px] flex items-center px-3 rounded-xl',
          value ? 'text-neutral-800 dark:text-white/85' : 'text-neutral-400 dark:text-white/25 italic',
          !editable && editing && 'bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5',
        )}>
          {value || '—'}
        </p>
      )}
    </div>
  );
}

function PasswordSection() {
  const [mode, setMode] = useState<'idle' | 'create' | 'change'>('idle');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  useEffect(() => {
    checkHasPassword();
  }, []);

  async function checkHasPassword() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const factors = session.user.user_metadata;
      const hasEmailProvider = session.user.app_metadata?.providers?.includes('email') ?? false;
      const hasPasswordSet = hasEmailProvider && !!(factors as any)?.password_set;
      setHasPassword(hasPasswordSet || hasEmailProvider);
    } catch {
      setHasPassword(null);
    }
  }

  function getStrength(pw: string): { level: number; label: string; color: string } {
    if (pw.length === 0) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 2) return { level: 1, label: 'Débil', color: '#ef4444' };
    if (score <= 3) return { level: 2, label: 'Media', color: '#f59e0b' };
    if (score <= 4) return { level: 3, label: 'Fuerte', color: '#22c55e' };
    return { level: 4, label: 'Muy fuerte', color: '#10b981' };
  }

  async function handleCreatePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPw.length < 8) { setMsg({ type: 'error', text: 'La contraseña debe tener al menos 8 caracteres.' }); return; }
    if (newPw !== confirmPw) { setMsg({ type: 'error', text: 'Las contraseñas no coinciden.' }); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) {
        setMsg({ type: 'error', text: 'No se pudo crear la contraseña. Intenta de nuevo.' });
        return;
      }
      setMsg({ type: 'success', text: 'Contraseña creada exitosamente. Ahora puedes iniciar sesión con ella.' });
      setHasPassword(true);
      setMode('idle');
      setNewPw('');
      setConfirmPw('');
    } catch {
      setMsg({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPw.length < 8) { setMsg({ type: 'error', text: 'La nueva contraseña debe tener al menos 8 caracteres.' }); return; }
    if (newPw !== confirmPw) { setMsg({ type: 'error', text: 'Las contraseñas no coinciden.' }); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) {
        setMsg({ type: 'error', text: 'No se pudo actualizar la contraseña.' });
        return;
      }
      setMsg({ type: 'success', text: 'Contraseña actualizada exitosamente.' });
      setMode('idle');
      setNewPw('');
      setConfirmPw('');
    } catch {
      setMsg({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setLoading(false);
    }
  }

  const strength = getStrength(newPw);

  const inputCls = "w-full h-10 rounded-xl text-sm px-3 outline-none border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-900 dark:text-white/90 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all";

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-neutral-100 dark:border-white/[0.06] p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/10">
          <Lock className="w-4 h-4 text-accent" />
        </div>
        <h3 className="text-base font-bold text-neutral-900 dark:text-white/90">Contraseña de acceso</h3>
      </div>

      {msg && (
        <div className={cn(
          "px-4 py-3 rounded-xl text-sm font-medium",
          msg.type === 'success' ? "bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300"
        )}>
          {msg.text}
        </div>
      )}

      {mode === 'idle' && (
        <div className="space-y-3">
          {hasPassword ? (
            <>
              <p className="text-sm text-neutral-600 dark:text-white/50">
                Tu contraseña está configurada. Puedes iniciar sesión con ella o usar Ingreso Express.
              </p>
              <button
                onClick={() => { setMode('change'); setMsg(null); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              >
                <Lock className="w-4 h-4" />
                Cambiar contraseña
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-600 dark:text-white/50">
                Actualmente utilizas Ingreso Express. Puedes crear una contraseña para acceder más rápido.
              </p>
              <button
                onClick={() => { setMode('create'); setMsg(null); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              >
                <Lock className="w-4 h-4" />
                Crear contraseña
              </button>
            </>
          )}
        </div>
      )}

      {mode === 'create' && (
        <form onSubmit={handleCreatePassword} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-500 dark:text-white/40 uppercase tracking-wide">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className={inputCls}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" tabIndex={-1}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPw && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(strength.level / 4) * 100}%`, background: strength.color }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: strength.color }}>{strength.label}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-500 dark:text-white/40 uppercase tracking-wide">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Repite la contraseña"
              className={inputCls}
              autoComplete="new-password"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Crear contraseña
            </button>
            <button
              type="button"
              onClick={() => { setMode('idle'); setNewPw(''); setConfirmPw(''); setMsg(null); }}
              className="text-sm font-medium text-neutral-500 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/60 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {mode === 'change' && (
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-500 dark:text-white/40 uppercase tracking-wide">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className={inputCls}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" tabIndex={-1}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPw && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(strength.level / 4) * 100}%`, background: strength.color }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: strength.color }}>{strength.label}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-500 dark:text-white/40 uppercase tracking-wide">Confirmar nueva contraseña</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Repite la nueva contraseña"
              className={inputCls}
              autoComplete="new-password"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Actualizar contraseña
            </button>
            <button
              type="button"
              onClick={() => { setMode('idle'); setNewPw(''); setConfirmPw(''); setMsg(null); }}
              className="text-sm font-medium text-neutral-500 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/60 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function Perfil() {
  useEffect(() => { document.title = 'Mi Perfil · MOVI Digital'; }, []);
  const { usuario, reloadUsuario } = useMoviAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [regimenesFiscales, setRegimenesFiscales] = useState<FiscalRegime[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from('commission_fiscal_regimes')
      .select('*')
      .order('name')
      .then(({ data }) => { if (data) setRegimenesFiscales(data); });
  }, []);

  type FormState = Record<EditableField, string>;

  const buildForm = (): FormState => ({
    nombre: usuario?.nombre || '',
    apellidos: usuario?.apellidos || '',
    celular_personal: usuario?.celular_personal || '',
    email_personal: usuario?.email_personal || '',
    celular_laboral: usuario?.celular_laboral || '',
    email_laboral: usuario?.email_laboral || '',
    extension_telefonica: usuario?.extension_telefonica || '',
    regimen_fiscal_id: usuario?.regimen_fiscal_id || '',
    banco: usuario?.banco || '',
    clabe: usuario?.clabe || '',
    fecha_nacimiento: usuario?.fecha_nacimiento || '',
    puesto: usuario?.puesto || '',
    fecha_ingreso: usuario?.fecha_ingreso || '',
  });

  const [form, setForm] = useState<FormState>(buildForm);

  const buildUbic = (): UbicacionValue => {
    const u = usuario as any;
    return {
      lat: u?.ubicacion_lat ?? null,
      lng: u?.ubicacion_lng ?? null,
      direccion_manual: u?.ubicacion_direccion_manual ?? null,
      metodo: u?.ubicacion_metodo ?? null,
    };
  };
  const [ubic, setUbic] = useState<UbicacionValue>(buildUbic);

  useEffect(() => {
    setForm(buildForm());
    setUbic(buildUbic());
  }, [usuario]);

  if (!usuario) return null;

  const rol = usuario.rol || 'Agente';
  const editables = getEditables(rol);
  const fullName = toTitleCase(`${usuario.nombre || ''} ${usuario.apellidos || ''}`.trim());
  const initials = `${usuario.nombre?.[0] || ''}${usuario.apellidos?.[0] || ''}`.toUpperCase();
  const oficina = usuario.oficina;

  const hasAnyEditable = Object.values(editables).some(Boolean);

  function handleCancel() {
    setForm(buildForm());
    setUbic(buildUbic());
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, string | number | null> = {};
      (Object.keys(editables) as EditableField[]).forEach(key => {
        if (editables[key]) {
          payload[key] = form[key].trim() || null;
        }
      });

      // Ubicación: el propio usuario siempre puede editar la suya (Parte A.1).
      const prev = buildUbic();
      const ubicCambio =
        prev.lat !== ubic.lat || prev.lng !== ubic.lng ||
        prev.direccion_manual !== ubic.direccion_manual || prev.metodo !== ubic.metodo;
      if (ubicCambio) {
        payload.ubicacion_lat = ubic.lat;
        payload.ubicacion_lng = ubic.lng;
        payload.ubicacion_direccion_manual = ubic.direccion_manual;
        payload.ubicacion_metodo = ubic.metodo;
        payload.ubicacion_updated_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('usuarios')
        .update(payload as any)
        .eq('id', usuario.id);

      if (updateError) throw updateError;

      await reloadUsuario();
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${usuario.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('usuarios')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('usuarios').getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ imagen_perfil_url: publicUrl } as any)
        .eq('id', usuario.id);

      if (updateError) throw updateError;
      await reloadUsuario();
    } catch (err: any) {
      setError(err?.message || 'Error al subir la imagen.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  const rolColor: Record<string, string> = {
    Administrador: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    Gerente: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    Agente: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
    Empleado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  };
  const rolBadgeCls = rolColor[rol] || 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/60';

  return (
    <div className="pb-10">
      {/* Page title row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Mi Perfil</h1>
          <p className="text-sm text-neutral-400 dark:text-white/40 mt-0.5">Información de tu cuenta MOVI Digital</p>
        </div>
        {hasAnyEditable && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 active:scale-95 transition-all shadow-sm"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar perfil
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 dark:border-white/10 text-sm font-medium text-neutral-600 dark:text-white/60 hover:bg-neutral-50 dark:hover:bg-white/[0.04] transition-all active:scale-95"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 active:scale-95 transition-all shadow-sm disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </div>

      {saved && (
        <div className="mb-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-4 py-2.5">
          <Check className="w-4 h-4" />
          Cambios guardados correctamente.
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-2.5">
          <X className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: avatar + identity */}
        <div className="lg:col-span-1 space-y-4">
          {/* Avatar card */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-6 flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24 rounded-2xl">
                <AvatarImage
                  src={usuario.imagen_perfil_url || undefined}
                  alt={fullName}
                  crossOrigin="anonymous"
                  className="rounded-2xl object-cover"
                />
                <AvatarFallback className="rounded-2xl text-2xl font-bold bg-accent/10 text-accent">
                  {initials || <User className="w-10 h-10" />}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center shadow-md hover:bg-accent/90 active:scale-90 transition-all disabled:opacity-60"
                title="Cambiar foto"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="text-center">
              <p className="font-bold text-neutral-900 dark:text-white text-lg leading-tight">{fullName || '—'}</p>
              {usuario.puesto && (
                <p className="text-sm text-neutral-400 dark:text-white/40 mt-0.5">{usuario.puesto}</p>
              )}
              <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mt-2', rolBadgeCls)}>
                <Shield className="w-3 h-3" />
                {rol}
              </span>
            </div>

            {usuario.fecha_ingreso && (
              <div className="w-full flex items-center gap-2 text-xs text-neutral-400 dark:text-white/35 border-t border-neutral-100 dark:border-white/5 pt-3 justify-center">
                <Calendar className="w-3.5 h-3.5" />
                <span>Ingresó el {new Date(usuario.fecha_ingreso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}
          </div>

          {/* Office card */}
          {oficina && (
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-accent" />
                <p className="text-sm font-semibold text-neutral-700 dark:text-white/80">Mi Oficina</p>
              </div>

              {oficina.logo_url && (
                <div className="flex justify-center py-2">
                  <div className="h-12 px-4 flex items-center justify-center bg-neutral-50 dark:bg-white/5 rounded-xl border border-neutral-100 dark:border-white/8">
                    <img
                      src={oficina.logo_url}
                      alt={oficina.nombre}
                      className="h-8 w-auto max-w-[120px] object-contain"
                      onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none'; }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30">Nombre</p>
                  <p className="text-sm text-neutral-800 dark:text-white/80 mt-0.5">{oficina.nombre}</p>
                </div>
                {oficina.domicilio && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-neutral-500 dark:text-white/40">{oficina.domicilio}</p>
                  </div>
                )}
                {oficina.telefono && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                    <p className="text-xs text-neutral-500 dark:text-white/40">{oficina.telefono}</p>
                  </div>
                )}
                {oficina.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                    <p className="text-xs text-neutral-500 dark:text-white/40">{oficina.email}</p>
                  </div>
                )}
                {oficina.whatsapp && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                    <p className="text-xs text-neutral-500 dark:text-white/40">{oficina.whatsapp} (WhatsApp)</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column: editable sections */}
        <div className="lg:col-span-2 space-y-4">
          {SECTIONS.map(section => {
            const SectionIcon = section.icon;

            return (
              <div key={section.title} className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-5">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100 dark:border-white/[0.05]">
                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                    <SectionIcon className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <p className="text-sm font-semibold text-neutral-700 dark:text-white/80">{section.title}</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {section.fields.map(field => {
                    const isEditable = editables[field] ?? false;
                    const isDateField = field === 'fecha_nacimiento' || field === 'fecha_ingreso';

                    if (field === 'regimen_fiscal_id') {
                      const selectedRegimen = regimenesFiscales.find(r => r.id === form.regimen_fiscal_id);
                      return (
                        <div key={field} className="group flex flex-col gap-1 sm:col-span-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/35 flex items-center gap-1.5">
                            {formatFieldName(field)}
                          </label>
                          {editing && isEditable ? (
                            <div>
                              <select
                                value={form.regimen_fiscal_id}
                                onChange={e => setForm(prev => ({ ...prev, regimen_fiscal_id: e.target.value }))}
                                className="h-9 w-full rounded-xl border border-accent/40 bg-accent/5 dark:bg-accent/10 px-3 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
                              >
                                <option value="">Seleccionar régimen</option>
                                {regimenesFiscales.map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                              {form.regimen_fiscal_id && selectedRegimen && (
                                <p className="text-xs text-neutral-500 dark:text-white/40 mt-1">
                                  ISR: {(selectedRegimen.isr * 100).toFixed(2)}% | IVA Ret: {(selectedRegimen.iva_retenido * 100).toFixed(2)}%
                                </p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className={cn(
                                'text-sm min-h-[36px] flex items-center px-3 rounded-xl',
                                selectedRegimen ? 'text-neutral-800 dark:text-white/85' : 'text-neutral-400 dark:text-white/25 italic',
                                !isEditable && editing && 'bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5',
                              )}>
                                {selectedRegimen?.name || '—'}
                              </p>
                              {selectedRegimen && (
                                <p className="text-xs text-neutral-500 dark:text-white/40 mt-1 px-3">
                                  ISR: {(selectedRegimen.isr * 100).toFixed(2)}% | IVA Ret: {(selectedRegimen.iva_retenido * 100).toFixed(2)}%
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }

                    let displayValue = form[field];
                    if ((field === 'nombre' || field === 'apellidos') && !editing) {
                      displayValue = toTitleCase(displayValue);
                    }
                    if (isDateField && !editing && displayValue) {
                      displayValue = new Date(displayValue + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
                    }

                    const iconMap: Partial<Record<EditableField, React.ElementType>> = {
                      email_personal: Mail, email_laboral: Mail,
                      celular_personal: Phone, celular_laboral: Phone,
                      fecha_nacimiento: Calendar, fecha_ingreso: Calendar,
                    };

                    return (
                      <FieldRow
                        key={field}
                        label={formatFieldName(field)}
                        value={displayValue}
                        editable={isEditable}
                        editing={editing}
                        onChange={v => setForm(prev => ({ ...prev, [field]: v }))}
                        type={isDateField ? 'date' : field.includes('email') ? 'email' : 'text'}
                        icon={iconMap[field]}
                      />
                    );
                  })}
                </div>

                {section.title === 'Datos Laborales' && usuario.web_slug && (
                  <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-white/[0.05]">
                    <div className="group flex flex-col gap-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/35 flex items-center gap-1.5">
                        <Globe className="w-3 h-3" />
                        Página Web MOVI
                      </label>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-neutral-800 dark:text-white/85 px-3 min-h-[36px] flex items-center">
                          agentedeseguros.website/{usuario.web_slug}
                        </p>
                        <a
                          href={`https://agentedeseguros.website/${usuario.web_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Abrir
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {section.title === 'Datos Bancarios' && (
                  <div className="mt-4 flex items-start gap-2 sm:gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3 sm:p-4">
                    <Info className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                      <span className="font-medium">Recuerda:</span> La actualización de tus datos de Información de pago tarda de 24 a 72 horas en verse reflejada y aplicada para futuros movimientos.
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Ubicación + seguros.express ── */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100 dark:border-white/[0.05]">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-accent" />
              </div>
              <p className="text-sm font-semibold text-neutral-700 dark:text-white/80">Mi Ubicación</p>
            </div>

            {editing ? (
              <UbicacionPicker value={ubic} onChange={setUbic} />
            ) : (
              <div className="text-sm">
                {ubic.metodo === 'gps' && ubic.lat != null && ubic.lng != null ? (
                  <p className="text-neutral-800 dark:text-white/85 flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-emerald-500" />
                    Ubicación GPS guardada
                    <span className="text-neutral-400 dark:text-white/35">({ubic.lat}, {ubic.lng})</span>
                  </p>
                ) : ubic.metodo === 'manual' && ubic.direccion_manual ? (
                  <p className="text-neutral-800 dark:text-white/85">{ubic.direccion_manual}</p>
                ) : (
                  <p className="text-neutral-400 dark:text-white/25 italic">Sin ubicación registrada</p>
                )}
              </div>
            )}

            {/* seguros.express — estado (solo lectura para el usuario) */}
            <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-white/[0.05] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-sm text-neutral-600 dark:text-white/60">seguros.express</span>
              </div>
              {(usuario as any).seguros_express_habilitado ? (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  Habilitado
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50">
                  No habilitado
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-400 dark:text-white/35">
              La habilitación para recibir leads de seguros.express la gestiona un administrador.
            </p>
          </div>

          {/* ── Password Management Section ── */}
          <PasswordSection />
        </div>
      </div>
    </div>
  );
}
