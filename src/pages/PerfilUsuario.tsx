import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Save, Upload, User as UserIcon, ArrowLeft, FileText, Briefcase, Link as LinkIcon, FolderOpen } from 'lucide-react';
import { CustomFields } from '../components/CustomFields';
import { DocumentsSection } from '../components/DocumentsSection';
import { PaymentFields } from '../components/PaymentFields';
import { ExpedienteSection } from '../components/ExpedienteSection';
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

  const canEditExpediente = currentUser?.rol === 'Administrador' || currentUser?.rol === 'Gerente';

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

    const updateData: Partial<Usuario> = { ...formData };
    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', id);

    if (error) {
      setMessage({ type: 'error', text: 'Error al guardar cambios' });
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
    const filePath = `avatars/${fileName}`;

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
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!usuario) return null;

  const tabs = [
    { id: 'general' as const, label: 'Información General', icon: FileText },
    { id: 'laboral' as const, label: 'Datos Laborales', icon: Briefcase },
    { id: 'accesos' as const, label: 'Accesos y Enlaces', icon: LinkIcon },
    { id: 'documentos' as const, label: 'Documentos y Expediente', icon: FolderOpen },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={handleBackClick}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver al Directorio</span>
        </button>

        {hasUnsavedChanges && (
          <span className="text-sm text-amber-600 font-medium">
            Tienes cambios sin guardar
          </span>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Ver / Editar Usuario</h1>
              <p className="text-blue-100 mt-1">{usuario.nombre} {usuario.apellidos}</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBackClick}
                className="px-4 py-2 border-2 border-white/30 text-white rounded-lg hover:bg-white/10 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className="flex items-center space-x-2 bg-white text-blue-700 px-6 py-2 rounded-lg font-medium hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex">
          <div className="w-80 bg-slate-50 border-r border-slate-200 p-6">
            <div className="flex flex-col items-center mb-6">
              <div className="relative group">
                {formData.imagen_perfil_url ? (
                  <img
                    src={formData.imagen_perfil_url}
                    alt="Perfil"
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center border-4 border-white shadow-lg">
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
              <h3 className="text-lg font-semibold text-slate-900 mt-4">
                {usuario.nombre} {usuario.apellidos}
              </h3>
              <p className="text-sm text-slate-600">{usuario.puesto}</p>
              <span className={`mt-2 px-3 py-1 text-xs font-semibold rounded-full ${
                usuario.rol === 'Administrador'
                  ? 'bg-red-100 text-red-800'
                  : usuario.rol === 'Gerente'
                  ? 'bg-purple-100 text-purple-800'
                  : usuario.rol === 'Empleado'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {usuario.rol}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-slate-500">Email:</span>
                <p className="text-slate-900 font-medium">{usuario.email_laboral || usuario.email_personal}</p>
              </div>
              <div>
                <span className="text-slate-500">Teléfono:</span>
                <p className="text-slate-900 font-medium">{usuario.celular_laboral || usuario.celular_personal}</p>
              </div>
              <div>
                <span className="text-slate-500">Oficina:</span>
                <p className="text-slate-900 font-medium">{oficinas.find(o => o.id === usuario.oficina_id)?.nombre || '-'}</p>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="border-b border-slate-200">
              <nav className="flex space-x-1 px-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 px-4 py-4 border-b-2 font-medium text-sm transition ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
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
                  <h3 className="text-lg font-semibold text-slate-900">Información General</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={formData.nombre || ''}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Apellidos
                      </label>
                      <input
                        type="text"
                        value={formData.apellidos || ''}
                        onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Fecha de Nacimiento
                      </label>
                      <input
                        type="date"
                        value={formData.fecha_nacimiento || ''}
                        onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Celular Personal
                      </label>
                      <input
                        type="tel"
                        value={formData.celular_personal || ''}
                        onChange={(e) => setFormData({ ...formData, celular_personal: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Email Personal
                      </label>
                      <input
                        type="email"
                        value={formData.email_personal || ''}
                        onChange={(e) => setFormData({ ...formData, email_personal: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <CustomFields usuarioId={usuario.id} editable={true} />
                </div>
              )}

              {activeTab === 'laboral' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-slate-900">Datos Laborales</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Puesto
                      </label>
                      <input
                        type="text"
                        value={formData.puesto || ''}
                        onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Oficina
                      </label>
                      <select
                        value={formData.oficina_id || ''}
                        onChange={(e) => setFormData({ ...formData, oficina_id: e.target.value || null })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Fecha de Ingreso
                      </label>
                      <input
                        type="date"
                        value={formData.fecha_ingreso || ''}
                        onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Email Laboral
                      </label>
                      <input
                        type="email"
                        value={formData.email_laboral || ''}
                        onChange={(e) => setFormData({ ...formData, email_laboral: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Celular Laboral
                      </label>
                      <input
                        type="tel"
                        value={formData.celular_laboral || ''}
                        onChange={(e) => setFormData({ ...formData, celular_laboral: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Extensión Telefónica
                      </label>
                      <input
                        type="text"
                        value={formData.extension_telefonica || ''}
                        onChange={(e) => setFormData({ ...formData, extension_telefonica: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Equipo de Cómputo
                      </label>
                      <input
                        type="text"
                        value={formData.equipo_computo || ''}
                        onChange={(e) => setFormData({ ...formData, equipo_computo: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Equipo Celular
                      </label>
                      <input
                        type="text"
                        value={formData.equipo_celular || ''}
                        onChange={(e) => setFormData({ ...formData, equipo_celular: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mt-8">
                    <PaymentFields
                      esquemaPagoId={formData.esquema_pago_id || ''}
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
                  <h3 className="text-lg font-semibold text-slate-900">Accesos y Enlaces</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        URL Web JIRO
                      </label>
                      <input
                        type="url"
                        value={formData.url_web_jiro || ''}
                        onChange={(e) => setFormData({ ...formData, url_web_jiro: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        URL Web Multicotizador
                      </label>
                      <input
                        type="url"
                        value={formData.url_web_multicotizador || ''}
                        onChange={(e) => setFormData({ ...formData, url_web_multicotizador: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'documentos' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Documentos</h3>
                    <DocumentsSection usuarioId={usuario.id} canEdit={true} />
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Expediente</h3>
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
