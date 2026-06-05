import { useEffect, useState } from 'react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/ui/page-header';
import { Button } from '../components/ui/button';
import { LoadingState } from '../components/ui/loading-state';
import { CustomFields } from '../components/CustomFields';
import { PaymentFields } from '../components/PaymentFields';
import { MiLogotipoEditor } from '../components/MiLogotipoEditor';
import { getMiPaginaWeb } from '../lib/webUrlUtils';
import {
  User, Save, Camera, Mail, Phone, Building2, MapPin,
  Calendar, Briefcase, Link as LinkIcon, CreditCard, Shield,
  Copy, Check, FileText
} from 'lucide-react';
import type { Database } from '../lib/database.types';

type UsuarioRow = Database['public']['Tables']['usuarios']['Row'];

export default function Perfil() {
  useEffect(() => { document.title = 'Mi Perfil · MOVI Digital'; }, []);
  const { usuario, reloadUsuario } = useMoviAuth();

  const [formData, setFormData] = useState<Partial<UsuarioRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'laboral' | 'fiscal' | 'enlaces'>('personal');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const isAgente = usuario?.rol === 'Agente';

  useEffect(() => {
    if (usuario) {
      setFormData({
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        puesto: usuario.puesto,
        fecha_nacimiento: usuario.fecha_nacimiento,
        celular_personal: usuario.celular_personal,
        email_personal: usuario.email_personal,
        celular_laboral: usuario.celular_laboral,
        email_laboral: usuario.email_laboral,
        extension_telefonica: usuario.extension_telefonica,
        regimen_fiscal_id: usuario.regimen_fiscal_id,
        banco: usuario.banco,
        clabe: usuario.clabe,
        imagen_perfil_url: usuario.imagen_perfil_url,
        mi_logotipo_url: usuario.mi_logotipo_url,
      });
      setLoading(false);
    }
  }, [usuario]);

  useEffect(() => {
    if (!usuario || loading) return;
    const changed = Object.keys(formData).some(key => {
      const k = key as keyof typeof formData;
      return (formData[k] ?? '') !== (usuario[k] ?? '');
    });
    setHasUnsavedChanges(changed);
  }, [formData, usuario, loading]);

  const handleSave = async () => {
    if (!usuario) return;
    setSaving(true);
    setMessage(null);

    const updateData: Record<string, unknown> = {
      nombre: formData.nombre,
      apellidos: formData.apellidos,
      fecha_nacimiento: formData.fecha_nacimiento || null,
      celular_personal: formData.celular_personal || '',
      email_personal: formData.email_personal || '',
      celular_laboral: formData.celular_laboral || '',
      extension_telefonica: formData.extension_telefonica || '',
      regimen_fiscal_id: formData.regimen_fiscal_id || null,
      banco: formData.banco || '',
      clabe: formData.clabe || '',
      updated_at: new Date().toISOString(),
    };

    if (isAdmin || isGerente) {
      updateData.puesto = formData.puesto || '';
    }

    const { error } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', usuario.id);

    if (error) {
      setMessage({ type: 'error', text: `Error al guardar: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente' });
      setHasUnsavedChanges(false);
      await reloadUsuario();
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 4000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${usuario.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file);

    if (uploadError) {
      setMessage({ type: 'error', text: 'Error al subir imagen' });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ imagen_perfil_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', usuario.id);

    if (updateError) {
      setMessage({ type: 'error', text: 'Error al actualizar imagen' });
    } else {
      setFormData(prev => ({ ...prev, imagen_perfil_url: publicUrl }));
      setMessage({ type: 'success', text: 'Foto de perfil actualizada' });
      await reloadUsuario();
    }
    setTimeout(() => setMessage(null), 4000);
  };

  if (!usuario || loading) return <LoadingState text="Cargando perfil..." />;

  const fullName = `${usuario.nombre || ''} ${usuario.apellidos || ''}`.trim();
  const webSlug = (usuario as any).web_slug;

  const tabs = [
    { id: 'personal' as const, label: 'Personal', icon: User },
    { id: 'laboral' as const, label: 'Laboral', icon: Briefcase },
    { id: 'fiscal' as const, label: 'Fiscal y Pago', icon: CreditCard },
    { id: 'enlaces' as const, label: 'Enlaces', icon: LinkIcon },
  ];

  const inputCls = 'w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition';
  const readOnlyCls = 'w-full px-4 py-2.5 text-sm bg-neutral-100 dark:bg-white/3 border border-neutral-200 dark:border-white/10 rounded-xl text-neutral-500 dark:text-white/50 cursor-not-allowed';
  const labelCls = 'block text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide mb-1.5';

  return (
    <>
      <PageHeader title="Mi Perfil" subtitle="Administra tu informacion personal y profesional." />

      {message && (
        <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
            : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
        }`}>
          {message.text}
        </div>
      )}

      <div className="mt-6 grid lg:grid-cols-[320px_1fr] gap-6">
        {/* Left sidebar - Identity card */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative group mb-4">
                {formData.imagen_perfil_url ? (
                  <img
                    src={formData.imagen_perfil_url}
                    alt="Perfil"
                    className="w-28 h-28 rounded-2xl object-cover border-2 border-neutral-200 dark:border-white/10 shadow-sm"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-accent/80 to-accent flex items-center justify-center shadow-sm">
                    <User className="w-12 h-12 text-white" />
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition cursor-pointer">
                  <Camera className="w-6 h-6 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <h2 className="text-lg font-bold text-slate-800 dark:text-white">{fullName}</h2>
              {usuario.puesto && (
                <p className="text-sm text-neutral-500 dark:text-white/50 mt-0.5">{usuario.puesto}</p>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-accent/10 text-accent mt-2">
                <Shield className="w-3 h-3" />
                {usuario.rol}
              </span>
            </div>

            <div className="mt-6 pt-5 border-t border-neutral-100 dark:border-white/[0.06] space-y-3 text-sm">
              {usuario.email_laboral && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-white/70 truncate">{usuario.email_laboral}</span>
                </div>
              )}
              {usuario.celular_laboral && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-white/70">{usuario.celular_laboral}</span>
                </div>
              )}
              {usuario.oficina?.nombre && (
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-white/70">{usuario.oficina.nombre}</span>
                </div>
              )}
              {usuario.oficina?.domicilio && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-white/70 text-xs leading-relaxed">{usuario.oficina.domicilio}</span>
                </div>
              )}
              {usuario.fecha_ingreso && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-white/70">
                    Desde {new Date(usuario.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Logo section */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              Mi Logotipo
            </h3>
            <MiLogotipoEditor
              userId={usuario.id}
              currentLogoUrl={usuario.mi_logotipo_url}
              onLogoChange={async () => { await reloadUsuario(); }}
            />
          </div>
        </div>

        {/* Right main content */}
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200 dark:border-white/[0.06] overflow-hidden">
          {/* Tab navigation */}
          <div className="border-b border-neutral-200 dark:border-white/[0.06] px-6">
            <nav className="flex gap-1 -mb-px overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-accent text-accent'
                        : 'border-transparent text-neutral-500 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/70'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab content */}
          <div className="p-6 lg:p-8">
            {activeTab === 'personal' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Nombre</label>
                    <input
                      type="text"
                      value={formData.nombre || ''}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Apellidos</label>
                    <input
                      type="text"
                      value={formData.apellidos || ''}
                      onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Fecha de Nacimiento</label>
                    <input
                      type="date"
                      value={formData.fecha_nacimiento || ''}
                      onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Celular Personal</label>
                    <input
                      type="tel"
                      value={formData.celular_personal || ''}
                      onChange={(e) => setFormData({ ...formData, celular_personal: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Email Personal</label>
                    <input
                      type="email"
                      value={formData.email_personal || ''}
                      onChange={(e) => setFormData({ ...formData, email_personal: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <CustomFields usuarioId={usuario.id} editable={true} />
              </div>
            )}

            {activeTab === 'laboral' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Puesto</label>
                    <input
                      type="text"
                      value={formData.puesto || ''}
                      onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                      disabled={!isAdmin && !isGerente}
                      className={isAdmin || isGerente ? inputCls : readOnlyCls}
                    />
                    {!isAdmin && !isGerente && (
                      <p className="text-xs text-neutral-400 mt-1">Tu puesto es asignado por la administracion</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Rol</label>
                    <input
                      type="text"
                      value={usuario.rol}
                      disabled
                      className={readOnlyCls}
                    />
                    <p className="text-xs text-neutral-400 mt-1">Asignado por la administracion</p>
                  </div>
                  <div>
                    <label className={labelCls}>Oficina</label>
                    <input
                      type="text"
                      value={usuario.oficina?.nombre || 'Sin asignar'}
                      disabled
                      className={readOnlyCls}
                    />
                    <p className="text-xs text-neutral-400 mt-1">Asignada por la administracion</p>
                  </div>
                  <div>
                    <label className={labelCls}>Fecha de Ingreso</label>
                    <input
                      type="text"
                      value={usuario.fecha_ingreso ? new Date(usuario.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No registrada'}
                      disabled
                      className={readOnlyCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Email Laboral</label>
                    <input
                      type="email"
                      value={formData.email_laboral || ''}
                      onChange={(e) => setFormData({ ...formData, email_laboral: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Celular Laboral</label>
                    <input
                      type="tel"
                      value={formData.celular_laboral || ''}
                      onChange={(e) => setFormData({ ...formData, celular_laboral: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Extension Telefonica</label>
                    <input
                      type="text"
                      value={formData.extension_telefonica || ''}
                      onChange={(e) => setFormData({ ...formData, extension_telefonica: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'fiscal' && (
              <div className="space-y-6">
                <PaymentFields
                  regimenFiscalId={formData.regimen_fiscal_id || ''}
                  banco={formData.banco || ''}
                  clabe={formData.clabe || ''}
                  onChange={(field, value) => setFormData({ ...formData, [field]: value })}
                  editable={true}
                />
              </div>
            )}

            {activeTab === 'enlaces' && (
              <div className="space-y-6">
                {webSlug ? (
                  <div className="p-4 rounded-xl bg-accent/5 dark:bg-accent/10 border border-accent/20">
                    <label className={labelCls}>Mi Pagina Web Publica</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={getMiPaginaWeb(webSlug) || ''}
                        readOnly
                        className="flex-1 px-4 py-2.5 text-sm border border-neutral-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-neutral-700 dark:text-white/70 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = getMiPaginaWeb(webSlug);
                          if (url) {
                            navigator.clipboard.writeText(`https://${url}`);
                            setCopiedUrl(true);
                            setTimeout(() => setCopiedUrl(false), 2000);
                          }
                        }}
                        className="px-4 py-2.5 bg-accent text-white rounded-xl hover:bg-accent/90 transition flex items-center gap-2 text-sm font-medium"
                      >
                        {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedUrl ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 dark:text-white/50">
                    No tienes una pagina web publica configurada. Contacta a tu administrador para activarla.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Save bar */}
          <div className="border-t border-neutral-200 dark:border-white/[0.06] px-6 lg:px-8 py-4 flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.02]">
            <div>
              {hasUnsavedChanges && (
                <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  Tienes cambios sin guardar
                </span>
              )}
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
