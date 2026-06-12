import { useEffect, useState, useRef } from 'react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { supabase } from '../lib/supabase';
import { User, Phone, Mail, MapPin, Building2, Shield, Camera, Check, Loader as Loader2, Pencil, X, Globe, CreditCard, Calendar, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';

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
    banco: 'Banco',
    clabe: 'CLABE',
    url_web_jiro: 'Web Jiro',
    url_web_multicotizador: 'Web Multicotizador',
  };
  return map[key] || key;
}

type EditableField =
  | 'nombre' | 'apellidos' | 'celular_personal' | 'email_personal'
  | 'celular_laboral' | 'email_laboral' | 'extension_telefonica'
  | 'banco' | 'clabe' | 'url_web_jiro' | 'url_web_multicotizador';

type RolEditable = Record<EditableField, boolean>;

const EDITABLES_BY_ROL: Record<string, RolEditable> = {
  Administrador: {
    nombre: true, apellidos: true, celular_personal: true, email_personal: true,
    celular_laboral: true, email_laboral: true, extension_telefonica: true,
    banco: true, clabe: true, url_web_jiro: true, url_web_multicotizador: true,
  },
  Gerente: {
    nombre: false, apellidos: false, celular_personal: true, email_personal: true,
    celular_laboral: true, email_laboral: true, extension_telefonica: true,
    banco: true, clabe: true, url_web_jiro: true, url_web_multicotizador: true,
  },
  Agente: {
    nombre: false, apellidos: false, celular_personal: true, email_personal: true,
    celular_laboral: true, email_laboral: true, extension_telefonica: false,
    banco: true, clabe: true, url_web_jiro: false, url_web_multicotizador: false,
  },
  Empleado: {
    nombre: false, apellidos: false, celular_personal: true, email_personal: true,
    celular_laboral: true, email_laboral: true, extension_telefonica: false,
    banco: false, clabe: false, url_web_jiro: false, url_web_multicotizador: false,
  },
};

const DEFAULT_EDITABLES: RolEditable = {
  nombre: false, apellidos: false, celular_personal: true, email_personal: true,
  celular_laboral: true, email_laboral: true, extension_telefonica: false,
  banco: false, clabe: false, url_web_jiro: false, url_web_multicotizador: false,
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
    fields: ['nombre', 'apellidos', 'celular_personal', 'email_personal', 'fecha_nacimiento' as any],
  },
  {
    title: 'Datos Laborales',
    icon: BadgeCheck,
    fields: ['celular_laboral', 'email_laboral', 'extension_telefonica', 'url_web_jiro', 'url_web_multicotizador'],
  },
  {
    title: 'Datos Bancarios',
    icon: CreditCard,
    fields: ['banco', 'clabe'],
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

export default function Perfil() {
  useEffect(() => { document.title = 'Mi Perfil · MOVI Digital'; }, []);
  const { usuario, reloadUsuario } = useMoviAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  type FormState = Record<EditableField, string>;

  const buildForm = (): FormState => ({
    nombre: usuario?.nombre || '',
    apellidos: usuario?.apellidos || '',
    celular_personal: usuario?.celular_personal || '',
    email_personal: usuario?.email_personal || '',
    celular_laboral: usuario?.celular_laboral || '',
    email_laboral: usuario?.email_laboral || '',
    extension_telefonica: usuario?.extension_telefonica || '',
    banco: usuario?.banco || '',
    clabe: usuario?.clabe || '',
    url_web_jiro: usuario?.url_web_jiro || '',
    url_web_multicotizador: usuario?.url_web_multicotizador || '',
  });

  const [form, setForm] = useState<FormState>(buildForm);

  useEffect(() => {
    setForm(buildForm());
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
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<Record<EditableField, string | null>> = {};
      (Object.keys(editables) as EditableField[]).forEach(key => {
        if (editables[key]) {
          payload[key] = form[key].trim() || null;
        }
      });

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
            const visibleFields = section.fields.filter(f => {
              // fecha_nacimiento is read-only for everyone, always show
              if (f === 'fecha_nacimiento' as any) return !!(usuario as any).fecha_nacimiento;
              return true;
            });
            if (visibleFields.length === 0) return null;

            return (
              <div key={section.title} className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-5">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100 dark:border-white/[0.05]">
                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                    <SectionIcon className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <p className="text-sm font-semibold text-neutral-700 dark:text-white/80">{section.title}</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {visibleFields.map(field => {
                    if (field === 'fecha_nacimiento' as any) {
                      return (
                        <FieldRow
                          key={field}
                          label={formatFieldName(field)}
                          value={(usuario as any).fecha_nacimiento
                            ? new Date((usuario as any).fecha_nacimiento).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
                            : ''}
                          editable={false}
                          editing={editing}
                          onChange={() => {}}
                          icon={Calendar}
                        />
                      );
                    }

                    const isEditable = editables[field] ?? false;
                    let displayValue = form[field];
                    if ((field === 'nombre' || field === 'apellidos') && !editing) {
                      displayValue = toTitleCase(displayValue);
                    }

                    const iconMap: Partial<Record<EditableField, React.ElementType>> = {
                      email_personal: Mail, email_laboral: Mail,
                      celular_personal: Phone, celular_laboral: Phone,
                      url_web_jiro: Globe, url_web_multicotizador: Globe,
                    };

                    return (
                      <FieldRow
                        key={field}
                        label={formatFieldName(field)}
                        value={displayValue}
                        editable={isEditable}
                        editing={editing}
                        onChange={v => setForm(prev => ({ ...prev, [field]: v }))}
                        type={field.includes('email') ? 'email' : field.includes('clabe') ? 'text' : 'text'}
                        icon={iconMap[field]}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
