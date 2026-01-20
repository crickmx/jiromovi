import { useState, useEffect } from 'react';
import { supabase, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PaymentFields } from './PaymentFields';
import { BaseModal } from './BaseModal';
import { ImageUploader } from './ImageUploader';
import { ExpedienteSection } from './ExpedienteSection';
import { User, Mail, Phone, Building2, Image, FileText, Calendar, Smartphone, Laptop, Palette, Shield } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Usuario = Database['public']['Tables']['usuarios']['Row'];
type Oficina = Database['public']['Tables']['oficinas']['Row'];

interface ModuloSistema {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  activo: boolean;
  orden: number;
}

interface PermisoAdicional {
  modulo_id: string;
  modulo_codigo: string;
}

interface UserModalProps {
  user: Usuario | null;
  onClose: () => void;
  onSave: () => void;
}

type TabType = 'general' | 'contact' | 'images' | 'payment' | 'other';

export function UserModal({ user, onClose, onSave }: UserModalProps) {
  const { usuario: currentUser } = useAuth();
  const isGerente = currentUser?.rol === 'Gerente';
  const isAdmin = currentUser?.rol === 'Administrador';

  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    password: '',
    nombre: '',
    apellidos: '',
    rol: 'Empleado' as 'Administrador' | 'Gerente' | 'Empleado' | 'Agente',
    puesto: '',
    oficina_id: '',
    web_slug: '',
    fecha_nacimiento: '',
    fecha_ingreso: '',
    celular_personal: '',
    email_personal: '',
    celular_laboral: '',
    email_laboral: '',
    extension_telefonica: '',
    regimen_fiscal_id: '',
    banco: '',
    clabe: '',
    dias_vacaciones_disponibles: 0,
    equipo_computo: '',
    equipo_celular: '',
    plan_mkt_premium: false,
  });
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [modulosSistema, setModulosSistema] = useState<ModuloSistema[]>([]);
  const [permisosAdicionales, setPermisosAdicionales] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isGerente && currentUser?.oficina_id) {
      setFormData(prev => ({ ...prev, oficina_id: currentUser.oficina_id || '' }));
    }
  }, [isGerente, currentUser]);

  useEffect(() => {
    loadOficinas();
    loadModulosSistema();
    if (user) {
      setFormData({
        password: '',
        nombre: user.nombre,
        apellidos: user.apellidos,
        rol: user.rol,
        puesto: user.puesto,
        oficina_id: user.oficina_id || '',
        web_slug: user.web_slug || '',
        fecha_nacimiento: user.fecha_nacimiento || '',
        fecha_ingreso: user.fecha_ingreso || '',
        celular_personal: user.celular_personal,
        email_personal: user.email_personal,
        celular_laboral: user.celular_laboral,
        email_laboral: user.email_laboral,
        extension_telefonica: user.extension_telefonica,
        regimen_fiscal_id: user.regimen_fiscal_id || '',
        banco: user.banco || '',
        clabe: user.clabe || '',
        dias_vacaciones_disponibles: user.dias_vacaciones_disponibles || 0,
        equipo_computo: user.equipo_computo || '',
        equipo_celular: user.equipo_celular || '',
        plan_mkt_premium: user.plan_mkt_premium || false,
      });
      loadPermisosAdicionales(user.id);
    }
  }, [user]);

  const loadOficinas = async () => {
    const { data } = await supabase
      .from('oficinas')
      .select('*')
      .eq('activa', true)
      .order('nombre');
    if (data) setOficinas(data);
  };

  const loadModulosSistema = async () => {
    const { data } = await supabase
      .from('modulos_sistema')
      .select('*')
      .eq('activo', true)
      .order('orden, nombre');
    if (data) setModulosSistema(data);
  };

  const loadPermisosAdicionales = async (userId: string) => {
    const { data } = await supabase
      .from('permisos_adicionales_gerente')
      .select('modulo_id')
      .eq('usuario_id', userId);
    if (data) {
      setPermisosAdicionales(data.map(p => p.modulo_id));
    }
  };

  const togglePermisoModulo = (moduloId: string) => {
    setPermisosAdicionales(prev => {
      if (prev.includes(moduloId)) {
        return prev.filter(id => id !== moduloId);
      } else {
        return [...prev, moduloId];
      }
    });
  };

  const savePermisosAdicionales = async (userId: string) => {
    try {
      // Primero eliminar permisos existentes
      await supabase
        .from('permisos_adicionales_gerente')
        .delete()
        .eq('usuario_id', userId);

      // Luego insertar los nuevos permisos
      if (permisosAdicionales.length > 0) {
        const permisosToInsert = permisosAdicionales.map(moduloId => ({
          usuario_id: userId,
          modulo_id: moduloId,
          asignado_por: currentUser?.id,
        }));

        const { error: insertError } = await supabase
          .from('permisos_adicionales_gerente')
          .insert(permisosToInsert);

        if (insertError) throw insertError;
      }
    } catch (err) {
      console.error('Error saving additional permissions:', err);
      throw err;
    }
  };

  const validateSlug = (slug: string): boolean => {
    if (!slug) return true;
    const slugRegex = /^[a-z0-9-]+$/;
    return slugRegex.test(slug);
  };

  const uploadImage = async (file: File, bucket: string, userId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error(`Error uploading to ${bucket}:`, err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validar campos obligatorios
      if (!formData.email_laboral) {
        setError('El email laboral es obligatorio');
        setLoading(false);
        return;
      }

      if (!formData.celular_laboral) {
        setError('El celular laboral es obligatorio');
        setLoading(false);
        return;
      }

      if (!formData.oficina_id) {
        setError('La oficina es obligatoria');
        setLoading(false);
        return;
      }

      if (formData.web_slug && !validateSlug(formData.web_slug)) {
        setError('El slug solo puede contener letras minúsculas, números y guiones');
        setLoading(false);
        return;
      }

      if (formData.web_slug) {
        const { data: existingSlug } = await supabase
          .from('usuarios')
          .select('id')
          .eq('web_slug', formData.web_slug)
          .maybeSingle();

        if (existingSlug && (!user || existingSlug.id !== user.id)) {
          setError(`El slug "${formData.web_slug}" ya está en uso. Por favor elige otro.`);
          setLoading(false);
          return;
        }
      }

      if (user) {
        // Editar usuario existente
        let avatarUrl = user.imagen_perfil_url;
        let logoUrl = user.mi_logotipo_url;

        // Subir avatar si hay uno nuevo
        if (avatarFile) {
          const url = await uploadImage(avatarFile, 'avatars', user.id);
          if (url) avatarUrl = url;
        }

        // Subir logo si hay uno nuevo
        if (logoFile) {
          const url = await uploadImage(logoFile, 'usuarios-logos', user.id);
          if (url) logoUrl = url;
        }

        const updateData: Partial<Usuario> = {
          nombre: formData.nombre,
          apellidos: formData.apellidos,
          rol: formData.rol,
          puesto: formData.puesto,
          oficina_id: formData.oficina_id || null,
          web_slug: formData.web_slug || null,
          fecha_nacimiento: formData.fecha_nacimiento || null,
          fecha_ingreso: formData.fecha_ingreso || null,
          celular_personal: formData.celular_personal,
          email_personal: formData.email_personal,
          celular_laboral: formData.celular_laboral,
          email_laboral: formData.email_laboral,
          extension_telefonica: formData.extension_telefonica,
          regimen_fiscal_id: formData.regimen_fiscal_id || null,
          banco: formData.banco,
          clabe: formData.clabe,
          dias_vacaciones_disponibles: formData.dias_vacaciones_disponibles,
          equipo_computo: formData.equipo_computo || null,
          equipo_celular: formData.equipo_celular || null,
          plan_mkt_premium: formData.plan_mkt_premium,
          imagen_perfil_url: avatarUrl,
          mi_logotipo_url: logoUrl,
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from('usuarios')
          .update(updateData)
          .eq('id', user.id);

        if (updateError) throw updateError;

        // Guardar permisos adicionales si es Gerente
        if (formData.rol === 'Gerente' && isAdmin) {
          await savePermisosAdicionales(user.id);
        }

        if (formData.password) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No hay sesión activa');

          const response = await fetch(
            `${supabaseUrl}/functions/v1/update-user-password`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                userId: user.id,
                password: formData.password,
              }),
            }
          );

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || 'Error al actualizar la contraseña');
          }
        }
      } else {
        // Crear usuario nuevo
        if (!formData.email_laboral || !formData.password) {
          setError('E-mail laboral y contraseña son requeridos para crear un usuario');
          setLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('No hay sesión activa');
          setLoading(false);
          return;
        }

        const requestBody = {
          password: formData.password,
          userData: {
            nombre: formData.nombre,
            apellidos: formData.apellidos,
            rol: formData.rol,
            email_laboral: formData.email_laboral,
            puesto: formData.puesto,
            oficina_id: formData.oficina_id || null,
            fecha_nacimiento: formData.fecha_nacimiento || null,
            fecha_ingreso: formData.fecha_ingreso || null,
            celular_personal: formData.celular_personal,
            email_personal: formData.email_personal,
            celular_laboral: formData.celular_laboral,
            extension_telefonica: formData.extension_telefonica,
            web_slug: formData.web_slug,
            regimen_fiscal_id: formData.regimen_fiscal_id || null,
            banco: formData.banco,
            clabe: formData.clabe,
            dias_vacaciones_disponibles: formData.dias_vacaciones_disponibles,
            equipo_computo: formData.equipo_computo || null,
            equipo_celular: formData.equipo_celular || null,
            plan_mkt_premium: formData.plan_mkt_premium,
          },
        };

        const response = await fetch(
          `${supabaseUrl}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(requestBody),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          const errorMessage = result.error || 'Error al crear el usuario';
          const detailsMessage = result.details ? ` (${result.details})` : '';
          throw new Error(errorMessage + detailsMessage);
        }

        // Si se creó el usuario y hay imágenes, subirlas ahora
        if (result.userId && (avatarFile || logoFile)) {
          const userId = result.userId;

          if (avatarFile) {
            const avatarUrl = await uploadImage(avatarFile, 'avatars', userId);
            if (avatarUrl) {
              await supabase
                .from('usuarios')
                .update({ imagen_perfil_url: avatarUrl })
                .eq('id', userId);
            }
          }

          if (logoFile) {
            const logoUrl = await uploadImage(logoFile, 'usuarios-logos', userId);
            if (logoUrl) {
              await supabase
                .from('usuarios')
                .update({ mi_logotipo_url: logoUrl })
                .eq('id', userId);
            }
          }
        }

        // Guardar permisos adicionales si es Gerente
        if (result.userId && formData.rol === 'Gerente' && isAdmin) {
          await savePermisosAdicionales(result.userId);
        }
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al guardar usuario');
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'general' as TabType, label: 'General', icon: User },
    { id: 'contact' as TabType, label: 'Contacto', icon: Phone },
    { id: 'images' as TabType, label: 'Imágenes', icon: Image },
    { id: 'payment' as TabType, label: 'Pago', icon: FileText },
    ...(isAdmin ? [{ id: 'other' as TabType, label: 'Otros', icon: Calendar }] : []),
  ];

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
      >
        Cancelar
      </button>
      <button
        type="submit"
        form="user-form"
        disabled={loading}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
      >
        {loading ? 'Guardando...' : user ? 'Actualizar Usuario' : 'Crear Usuario'}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {user ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            <p className="text-xs text-slate-500">
              {user ? 'Actualiza la información del usuario' : 'Completa los datos del nuevo usuario'}
            </p>
          </div>
        </div>
      }
      maxWidth="4xl"
      footer={footer}
    >
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <span className="text-red-500 text-lg">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="-mb-px flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap
                  ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <form id="user-form" onSubmit={handleSubmit}>
        {/* Tab: General */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Contraseña */}
            {(!user || (user && isAdmin)) && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-primary-900 mb-3 flex items-center gap-2">
                  <span>🔐</span>
                  Contraseña de Acceso
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {user ? 'Nueva Contraseña (opcional)' : 'Contraseña *'}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!user}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={user ? 'Dejar en blanco para mantener actual' : 'Mínimo 6 caracteres'}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Información Básica */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-600" />
                Información Básica
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Juan"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Apellidos *</label>
                  <input
                    type="text"
                    value={formData.apellidos}
                    onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Pérez García"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Rol *</label>
                  <select
                    value={formData.rol}
                    onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
                    required
                    disabled={!isAdmin && !isGerente}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="Empleado">Empleado</option>
                    <option value="Agente">Agente</option>
                    {isAdmin && <option value="Gerente">Gerente</option>}
                    {isAdmin && <option value="Administrador">Administrador</option>}
                  </select>
                  {isGerente && (
                    <p className="text-xs text-slate-500 mt-1">
                      Puedes asignar roles: Empleado o Agente
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Puesto</label>
                  <input
                    type="text"
                    value={formData.puesto}
                    onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Gerente de Ventas"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Oficina *
                  </label>
                  <select
                    value={formData.oficina_id}
                    onChange={(e) => setFormData({ ...formData, oficina_id: e.target.value })}
                    disabled={isGerente}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Seleccionar oficina</option>
                    {oficinas.map((oficina) => (
                      <option key={oficina.id} value={oficina.id}>
                        {oficina.nombre}
                      </option>
                    ))}
                  </select>
                  {isGerente && (
                    <p className="text-xs text-slate-500 mt-1">
                      Solo puedes asignar usuarios a tu oficina
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    value={formData.fecha_nacimiento}
                    onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Fecha de Ingreso
                  </label>
                  <input
                    type="date"
                    value={formData.fecha_ingreso}
                    onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {isAdmin && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Slug para Página Web
                    </label>
                    <input
                      type="text"
                      value={formData.web_slug}
                      onChange={(e) => setFormData({ ...formData, web_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      placeholder="ejemplo: juanperez"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {formData.web_slug ? (
                        <>URL: <span className="font-mono text-primary-600">agentedeseguros.website/{formData.web_slug}</span></>
                      ) : (
                        'Solo letras minúsculas, números y guiones'
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Permisos Adicionales - Solo para Gerentes y solo si el usuario actual es Admin */}
            {isAdmin && formData.rol === 'Gerente' && (
              <div className="bg-gradient-to-br from-blue-50 to-primary-50 border-2 border-blue-200 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Permisos Adicionales (Nivel Administrador por Módulo)
                </h3>
                <p className="text-xs text-slate-600 mb-4">
                  Al activar un módulo, este Gerente tendrá permisos de Administrador únicamente dentro de dicho módulo, sin convertirse en administrador global.
                </p>

                {modulosSistema.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Cargando módulos...</p>
                ) : (
                  <div className="space-y-4">
                    {/* Agrupar por categoría */}
                    {Array.from(new Set(modulosSistema.map(m => m.categoria || 'Otros'))).map(categoria => {
                      const modulosCategoria = modulosSistema.filter(m => (m.categoria || 'Otros') === categoria);

                      return (
                        <div key={categoria} className="bg-white rounded-lg p-4 border border-slate-200">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
                            {categoria}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {modulosCategoria.map(modulo => (
                              <label
                                key={modulo.id}
                                className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition"
                              >
                                <input
                                  type="checkbox"
                                  checked={permisosAdicionales.includes(modulo.id)}
                                  onChange={() => togglePermisoModulo(modulo.id)}
                                  className="mt-1 h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-slate-900">
                                    {modulo.nombre}
                                  </div>
                                  {modulo.descripcion && (
                                    <div className="text-xs text-slate-500 mt-0.5">
                                      {modulo.descripcion}
                                    </div>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>💡 Nota:</strong> Los módulos seleccionados otorgarán permisos completos de administrador únicamente dentro de ese módulo. El usuario seguirá siendo Gerente en el resto del sistema.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Contacto */}
        {activeTab === 'contact' && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-600" />
              Información de Contacto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Laboral *
                </label>
                <input
                  type="email"
                  value={formData.email_laboral}
                  onChange={(e) => setFormData({ ...formData, email_laboral: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="usuario@empresa.com"
                />
                {!user && (
                  <p className="text-xs text-slate-500 mt-1">Se usará como usuario de acceso</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Personal
                </label>
                <input
                  type="email"
                  value={formData.email_personal}
                  onChange={(e) => setFormData({ ...formData, email_personal: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="usuario@gmail.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Celular Laboral *
                </label>
                <input
                  type="tel"
                  value={formData.celular_laboral}
                  onChange={(e) => setFormData({ ...formData, celular_laboral: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+52 55 1234 5678"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Celular Personal
                </label>
                <input
                  type="tel"
                  value={formData.celular_personal}
                  onChange={(e) => setFormData({ ...formData, celular_personal: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+52 55 8765 4321"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Extensión Telefónica
                </label>
                <input
                  type="text"
                  value={formData.extension_telefonica}
                  onChange={(e) => setFormData({ ...formData, extension_telefonica: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: 1234"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab: Imágenes */}
        {activeTab === 'images' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUploader
                currentImageUrl={user?.imagen_perfil_url}
                onImageChange={setAvatarFile}
                label="Foto de Perfil"
                description="Esta imagen aparecerá en tu perfil y tarjeta de contacto"
                aspectRatio="aspect-square"
                maxSizeMB={2}
              />

              <ImageUploader
                currentImageUrl={user?.mi_logotipo_url}
                onImageChange={setLogoFile}
                label="Logotipo Personal"
                description="Aparecerá en tus PDFs de comisiones y materiales oficiales"
                aspectRatio="aspect-video"
                maxSizeMB={2}
              />
            </div>

            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-primary-900 mb-2">💡 Recomendaciones</h4>
              <ul className="text-xs text-primary-800 space-y-1">
                <li>• Foto de perfil: formato cuadrado (1:1), mínimo 400x400px</li>
                <li>• Logotipo: formato horizontal (16:9), fondo transparente preferible</li>
                <li>• Formatos: PNG, JPG o GIF. Tamaño máximo: 2MB</li>
                <li>• Si no subes un logotipo, se usará el de tu oficina o el logo JIRO</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab: Pago */}
        {activeTab === 'payment' && (
          <div>
            <PaymentFields
              regimenFiscalId={formData.regimen_fiscal_id}
              banco={formData.banco}
              clabe={formData.clabe}
              onChange={(field, value) => setFormData({ ...formData, [field]: value })}
              editable={true}
            />
          </div>
        )}

        {/* Tab: Otros (solo admins) */}
        {activeTab === 'other' && isAdmin && (
          <div className="space-y-6">
            {/* Plan MKT Premium - Solo para Agentes */}
            {formData.rol === 'Agente' && (
              <div className="bg-gradient-to-br from-purple-50 to-primary-50 border-2 border-purple-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-600" />
                  Plan MKT Premium
                </h3>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="plan_mkt_premium"
                    checked={formData.plan_mkt_premium}
                    onChange={(e) => setFormData({ ...formData, plan_mkt_premium: e.target.checked })}
                    className="mt-1 h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <label htmlFor="plan_mkt_premium" className="text-sm font-medium text-slate-900 cursor-pointer">
                      Habilitar Plan de MKT Premium
                    </label>
                    <p className="text-xs text-slate-600 mt-1">
                      Permite al agente acceder a la funcionalidad completa de Personalizar Publicidad (edición de diseños con logo y texto personalizado)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Vacaciones */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-600" />
                Gestión de Vacaciones
              </h3>
              <div className="max-w-md">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Días de Vacaciones Disponibles
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={formData.dias_vacaciones_disponibles}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    const clampedValue = Math.max(0, Math.min(50, value));
                    setFormData({ ...formData, dias_vacaciones_disponibles: clampedValue });
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Rango permitido: 0 - 50 días
                </p>
              </div>
            </div>

            {/* Equipos Asignados - Solo para Administradores */}
            {isAdmin && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-slate-600" />
                  Equipos Asignados
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                      <Laptop className="w-3 h-3" />
                      Equipo de Cómputo
                    </label>
                    <input
                      type="text"
                      value={formData.equipo_computo}
                      onChange={(e) => setFormData({ ...formData, equipo_computo: e.target.value })}
                      placeholder="Ej: Dell Latitude 5420"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Modelo y detalles del equipo de cómputo asignado
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                      <Smartphone className="w-3 h-3" />
                      Equipo Celular
                    </label>
                    <input
                      type="text"
                      value={formData.equipo_celular}
                      onChange={(e) => setFormData({ ...formData, equipo_celular: e.target.value })}
                      placeholder="Ej: iPhone 13 Pro"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Modelo y detalles del equipo celular asignado
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Expediente - Solo si el usuario ya existe */}
            {user && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  Expediente de Documentos
                </h3>
                <ExpedienteSection usuarioId={user.id} canEdit={true} />
              </div>
            )}

            {!user && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <p className="text-sm text-primary-700">
                  💡 El expediente de documentos estará disponible después de crear el usuario
                </p>
              </div>
            )}
          </div>
        )}
      </form>
    </BaseModal>
  );
}
