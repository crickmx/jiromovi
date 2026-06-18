import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Save, Upload, User as UserIcon, ArrowLeft, FileText, Briefcase, Link as LinkIcon, FolderOpen, Copy, Check } from 'lucide-react';
import { CustomFields } from '../components/CustomFields';
import { PaymentFields } from '../components/PaymentFields';
import { ExpedienteSection } from '../components/ExpedienteSection';
import { MiLogotipoEditor } from '../components/MiLogotipoEditor';
import { getMiPaginaWeb } from '../lib/webUrlUtils';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';
import type { Database } from '../lib/database.types';

type Usuario = Database['public']['Tables']['usuarios']['Row'];
type Oficina = Database['public']['Tables']['oficinas']['Row'];

export function PerfilUsuario() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario: currentUser } = useAuth();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState<Partial<Usuario>>({});
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'laboral' | 'accesos' | 'documentos'>('general');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const canEditExpediente = currentUser?.rol === 'Administrador' || currentUser?.rol === 'Gerente';
  const isAdmin = currentUser?.rol === 'Administrador';
  const isGerente = currentUser?.rol === 'Gerente';
  const canEditRole = isAdmin || isGerente;

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  useEffect(() => {
    if (usuario && JSON.stringify(formData) !== JSON.stringify(usuario)) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [formData, usuario]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const loadData = async () => {
    if (!id) return;

    try {
      const [usuarioRes, oficinasRes] = await Promise.all([
        supabase.from('usuarios').select('*').eq('id', id).maybeSingle(),
        supabase.from('oficinas').select('*').eq('activa', true).order('nombre'),
      ]);

      if (usuarioRes.data) {
        setUsuario(usuarioRes.data);
        setFormData(usuarioRes.data);
      } else {
        setMessage({ type: 'error', text: 'Usuario no encontrado' });
        setTimeout(() => navigate('/directorio'), 2000);
      }

      if (oficinasRes.data) setOficinas(oficinasRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setMessage({ type: 'error', text: 'Error cargando datos del usuario' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!usuario || !id) return;

    setSaving(true);
    setMessage(null);

    const updateData: Partial<Usuario> = {
      nombre: formData.nombre,
      apellidos: formData.apellidos,
      puesto: formData.puesto,
      oficina_id: formData.oficina_id || null,
      fecha_nacimiento: formData.fecha_nacimiento || null,
      fecha_ingreso: formData.fecha_ingreso || null,
      celular_personal: formData.celular_personal,
      email_personal: formData.email_personal,
      celular_laboral: formData.celular_laboral,
      email_laboral: formData.email_laboral,
      extension_telefonica: formData.extension_telefonica,
      equipo_computo: formData.equipo_computo || null,
      equipo_celular: formData.equipo_celular || null,
      url_web_jiro: formData.url_web_jiro,
      url_web_multicotizador: formData.url_web_multicotizador,
      web_slug: formData.web_slug || null,
      regimen_fiscal_id: formData.regimen_fiscal_id || null,
      banco: formData.banco || null,
      clabe: formData.clabe || null,
      dias_vacaciones_disponibles: formData.dias_vacaciones_disponibles ?? 0,
      updated_at: new Date().toISOString(),
    };

    if (isAdmin && formData.rol) {
      updateData.rol = formData.rol;
    }

    const { error } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error saving user:', error);
      setMessage({ type: 'error', text: `Error al guardar cambios: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Cambios guardados correctamente' });
      setHasUnsavedChanges(false);
      await loadData();
    }

    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${id}-${Date.now()}.${fileExt}`;
    const filePath = fileName; // No incluir 'avatars/' ya que es el nombre del bucket

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) {
      setMessage({ type: 'error', text: 'Error al subir imagen' });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    setFormData({ ...formData, imagen_perfil_url: publicUrl });

    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ imagen_perfil_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      setMessage({ type: 'error', text: 'Error al actualizar imagen' });
    } else {
      setMessage({ type: 'success', text: 'Imagen actualizada correctamente' });
      await loadData();
    }
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm('Tienes cambios sin guardar. ¿Deseas salir sin guardar?');
      if (confirmLeave) {
        navigate('/directorio');
      }
    } else {
      navigate('/directorio');
    }
  };

  if (loading) {
    return <LoadingState text="Cargando perfil de usuario..." />;
  }

  if (!usuario) return null;

  const tabs = [
    { id: 'general' as const, label: 'Información General', icon: FileText },
    { id: 'laboral' as const, label: 'Datos Laborales', icon: Briefcase },
    { id: 'accesos' as const, label: 'Accesos y Enlaces', icon: LinkIcon },
    { id: 'documentos' as const, label: 'Expediente', icon: FolderOpen },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={handleBackClick}
          className="flex items-center space-x-2 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver a Usuarios</span>
        </button>

        {hasUnsavedChanges && (
          <span className="text-sm text-amber-600 font-medium">
            Tienes cambios sin guardar
          </span>
        )}
      </div>

      <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden">
        <PageHeader
          title="Ver / Editar Usuario"
          description={`${usuario.nombre} ${usuario.apellidos}`}
          icon={UserIcon}
        >
          <Button
            variant="outline"
            onClick={handleBackClick}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
          </Button>
        </PageHeader>

        <div className="flex">
          <div className="w-80 bg-neutral-50 dark:bg-white/3 border-r border-neutral-200 dark:border-white/10 p-6">
            <div className="flex flex-col items-center mb-6">
              <div className="relative group">
                {formData.imagen_perfil_url ? (
                  <img
                    src={formData.imagen_perfil_url}
                    alt="Perfil"
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-accent flex items-center justify-center border-4 border-white shadow-lg">
                    <UserIcon className="w-16 h-16 text-white" />
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition cursor-pointer">
                  <Upload className="w-8 h-8 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mt-4">
                {usuario.nombre} {usuario.apellidos}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-white/60">{usuario.puesto}</p>
              <span className={`mt-2 px-3 py-1 text-xs font-semibold rounded-full ${
                usuario.rol === 'Administrador'
                  ? 'bg-red-100 text-red-800'
                  : usuario.rol === 'Gerente'
                  ? 'bg-purple-100 text-purple-800'
                  : usuario.rol === 'Empleado'
                  ? 'bg-primary-100 text-primary-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {usuario.rol}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-neutral-500 dark:text-white/40">Email:</span>
                <p className="text-neutral-900 dark:text-white font-medium">{usuario.email_laboral || usuario.email_personal}</p>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-white/40">Teléfono:</span>
                <p className="text-neutral-900 dark:text-white font-medium">{usuario.celular_laboral || usuario.celular_personal}</p>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-white/40">Oficina:</span>
                <p className="text-neutral-900 dark:text-white font-medium">{oficinas.find(o => o.id === usuario.oficina_id)?.nombre || '-'}</p>
              </div>
              {usuario.fecha_nacimiento && (
                <div>
                  <span className="text-neutral-500 dark:text-white/40">Cumpleaños:</span>
                  <p className="text-neutral-900 dark:text-white font-medium">
                    {new Date(usuario.fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long'
                    })}
                  </p>
                </div>
              )}
              {usuario.fecha_ingreso && (
                <div>
                  <span className="text-neutral-500 dark:text-white/40">Aniversario Laboral:</span>
                  <p className="text-neutral-900 dark:text-white font-medium">
                    {new Date(usuario.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              )}
              {usuario.equipo_computo && (
                <div>
                  <span className="text-neutral-500 dark:text-white/40">Equipo de Cómputo:</span>
                  <p className="text-neutral-900 dark:text-white font-medium">{usuario.equipo_computo}</p>
                </div>
              )}
              {usuario.equipo_celular && (
                <div>
                  <span className="text-neutral-500 dark:text-white/40">Equipo Celular:</span>
                  <p className="text-neutral-900 dark:text-white font-medium">{usuario.equipo_celular}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="border-b border-neutral-200 dark:border-white/10">
              <nav className="flex space-x-1 px-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 px-4 py-4 border-b-2 font-medium text-sm transition ${
                        activeTab === tab.id
                          ? 'border-accent text-accent'
                          : 'border-transparent text-neutral-500 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/70 hover:border-neutral-200 dark:hover:border-white/10'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-8">
              {message && (
                <div
                  className={`mb-6 px-4 py-3 rounded-lg ${
                    message.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {message.text}
                </div>
              )}

              {activeTab === 'general' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Información General</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={formData.nombre || ''}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Apellidos
                      </label>
                      <input
                        type="text"
                        value={formData.apellidos || ''}
                        onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Rol
                      </label>
                      <select
                        value={formData.rol || 'Empleado'}
                        onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
                        disabled={!canEditRole}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-neutral-100 dark:disabled:bg-white/5 disabled:cursor-not-allowed"
                      >
                        <option value="Empleado">Empleado</option>
                        <option value="Agente">Agente</option>
                        {isAdmin && <option value="Gerente">Gerente</option>}
                        {isAdmin && <option value="Administrador">Administrador</option>}
                      </select>
                      {!canEditRole && (
                        <p className="text-xs text-neutral-500 dark:text-white/40 mt-1">
                          Solo los Administradores y Gerentes pueden cambiar roles
                        </p>
                      )}
                      {isGerente && (
                        <p className="text-xs text-amber-600 mt-1">
                          Como Gerente, solo puedes asignar roles de Agente o Empleado
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Fecha de Nacimiento
                      </label>
                      <input
                        type="date"
                        value={formData.fecha_nacimiento || ''}
                        onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Celular Personal
                      </label>
                      <input
                        type="tel"
                        value={formData.celular_personal || ''}
                        onChange={(e) => setFormData({ ...formData, celular_personal: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Email Personal
                      </label>
                      <input
                        type="email"
                        value={formData.email_personal || ''}
                        onChange={(e) => setFormData({ ...formData, email_personal: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                  </div>

                  <CustomFields usuarioId={usuario.id} editable={true} />

                  <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-white/10">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2 mb-2">
                        <span className="text-2xl">📸</span>
                        Mi Logotipo Personal
                      </h3>
                      <p className="text-sm text-neutral-600 dark:text-white/60">
                        Tu logotipo personal aparecerá en tus PDFs de comisiones y materiales oficiales.
                      </p>
                    </div>
                    <MiLogotipoEditor
                      userId={usuario.id}
                      currentLogoUrl={usuario.mi_logotipo_url}
                      onLogoChange={async () => {
                        await loadData();
                      }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'laboral' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Datos Laborales</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Puesto
                      </label>
                      <input
                        type="text"
                        value={formData.puesto || ''}
                        onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Oficina
                      </label>
                      <select
                        value={formData.oficina_id || ''}
                        onChange={(e) => setFormData({ ...formData, oficina_id: e.target.value || null })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      >
                        <option value="">Seleccionar oficina</option>
                        {oficinas.map((oficina) => (
                          <option key={oficina.id} value={oficina.id}>
                            {oficina.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Fecha de Ingreso
                      </label>
                      <input
                        type="date"
                        value={formData.fecha_ingreso || ''}
                        onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Email Laboral
                      </label>
                      <input
                        type="email"
                        value={formData.email_laboral || ''}
                        onChange={(e) => setFormData({ ...formData, email_laboral: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Celular Laboral
                      </label>
                      <input
                        type="tel"
                        value={formData.celular_laboral || ''}
                        onChange={(e) => setFormData({ ...formData, celular_laboral: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Extensión Telefónica
                      </label>
                      <input
                        type="text"
                        value={formData.extension_telefonica || ''}
                        onChange={(e) => setFormData({ ...formData, extension_telefonica: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Equipo de Cómputo
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Dell Latitude 5420"
                        value={formData.equipo_computo || ''}
                        onChange={(e) => setFormData({ ...formData, equipo_computo: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                      <p className="text-xs text-neutral-500 dark:text-white/40 mt-1">Modelo y detalles del equipo de cómputo asignado</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Equipo Celular
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: iPhone 13 Pro"
                        value={formData.equipo_celular || ''}
                        onChange={(e) => setFormData({ ...formData, equipo_celular: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                      <p className="text-xs text-neutral-500 dark:text-white/40 mt-1">Modelo y detalles del equipo celular asignado</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                        Días de Vacaciones Disponibles
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={formData.dias_vacaciones_disponibles ?? 0}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          const clampedValue = Math.max(0, Math.min(50, value));
                          setFormData({ ...formData, dias_vacaciones_disponibles: clampedValue });
                        }}
                        className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                      <p className="text-xs text-neutral-500 dark:text-white/40 mt-1">Días disponibles: 0 - 50</p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <PaymentFields
                      regimenFiscalId={formData.regimen_fiscal_id || ''}
                      banco={formData.banco || ''}
                      clabe={formData.clabe || ''}
                      onChange={(field, value) => setFormData({ ...formData, [field]: value })}
                      editable={true}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'accesos' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Página Web del Agente</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {isAdmin && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                          Slug
                        </label>
                        <input
                          type="text"
                          value={formData.web_slug || ''}
                          onChange={(e) => {
                            setFormData({ ...formData, web_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') });
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="ejemplo: juanperez"
                          className="w-full px-4 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                        />
                        <p className="text-xs text-neutral-500 dark:text-white/40 mt-1">
                          Solo minúsculas, números y guiones. Sin espacios ni caracteres especiales.
                        </p>
                      </div>
                    )}

                    {formData.web_slug && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">
                          Mi Página Web
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={getMiPaginaWeb(formData.web_slug)}
                            readOnly
                            className="flex-1 px-4 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg bg-neutral-50 dark:bg-white/3 text-neutral-600 dark:text-white/60 font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const miPaginaWeb = getMiPaginaWeb(formData.web_slug);
                              if (miPaginaWeb) {
                                navigator.clipboard.writeText(`https://${miPaginaWeb}`);
                                setCopiedUrl(true);
                                setTimeout(() => setCopiedUrl(false), 2000);
                              }
                            }}
                            className="px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition flex items-center gap-2"
                          >
                            {copiedUrl ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Copiar URL</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-white/40 mt-1">
                          Esta es la página web pública del agente que puede compartir con sus clientes
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'documentos' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Expediente</h3>
                    <ExpedienteSection usuarioId={usuario.id} canEdit={canEditExpediente} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default PerfilUsuario;
