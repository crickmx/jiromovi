import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PaymentFields } from './PaymentFields';
import { BaseModal } from './BaseModal';
import { MiLogotipoEditor } from './MiLogotipoEditor';
import type { Database } from '../lib/database.types';

type Usuario = Database['public']['Tables']['usuarios']['Row'];
type Oficina = Database['public']['Tables']['oficinas']['Row'];

interface UserModalProps {
  user: Usuario | null;
  onClose: () => void;
  onSave: () => void;
}

export function UserModal({ user, onClose, onSave }: UserModalProps) {
  const { usuario: currentUser } = useAuth();
  const isGerente = currentUser?.rol === 'Gerente';
  const isAdmin = currentUser?.rol === 'Administrador';

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
    url_web_jiro: '',
    url_web_multicotizador: '',
    regimen_fiscal_id: '',
    banco: '',
    clabe: '',
    dias_vacaciones_disponibles: 0,
  });
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isGerente && currentUser?.oficina_id) {
      setFormData(prev => ({ ...prev, oficina_id: currentUser.oficina_id || '' }));
    }
  }, [isGerente, currentUser]);

  useEffect(() => {
    loadOficinas();
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
        url_web_jiro: user.url_web_jiro,
        url_web_multicotizador: user.url_web_multicotizador,
        regimen_fiscal_id: user.regimen_fiscal_id || '',
        banco: user.banco || '',
        clabe: user.clabe || '',
        dias_vacaciones_disponibles: user.dias_vacaciones_disponibles || 0,
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (user) {
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
          url_web_jiro: formData.url_web_jiro,
          url_web_multicotizador: formData.url_web_multicotizador,
          regimen_fiscal_id: formData.regimen_fiscal_id || null,
          banco: formData.banco,
          clabe: formData.clabe,
          dias_vacaciones_disponibles: formData.dias_vacaciones_disponibles,
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from('usuarios')
          .update(updateData)
          .eq('id', user.id);

        if (updateError) throw updateError;

        if (formData.password) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No hay sesión activa');

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-password`,
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

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
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
                url_web_jiro: formData.url_web_jiro,
                url_web_multicotizador: formData.url_web_multicotizador,
                regimen_fiscal_id: formData.regimen_fiscal_id || null,
                banco: formData.banco,
                clabe: formData.clabe,
                dias_vacaciones_disponibles: formData.dias_vacaciones_disponibles,
              },
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Error al crear el usuario');
        }
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al guardar usuario');
      setLoading(false);
    }
  };

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
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? 'Guardando...' : user ? 'Actualizar' : 'Crear'}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={user ? 'Editar Usuario' : 'Nuevo Usuario'}
      maxWidth="3xl"
      footer={footer}
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <h3 className="text-base font-semibold text-slate-800 mb-2 pb-2 border-b border-slate-200">Información de Acceso</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {!user && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contraseña *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {user && isAdmin && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nueva Contraseña (opcional)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Dejar en blanco para mantener la contraseña actual
                </p>
              </div>
            )}

          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-800 mb-2 pb-2 border-b border-slate-200">Información Personal</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {!isAdmin && !isGerente && (
                <p className="text-xs text-slate-500 mt-1">
                  Solo Administradores y Gerentes pueden cambiar roles
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
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Oficina</label>
              <select
                value={formData.oficina_id}
                onChange={(e) => setFormData({ ...formData, oficina_id: e.target.value })}
                disabled={isGerente}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
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
                  Solo puedes crear usuarios en tu oficina asignada
                </p>
              )}
            </div>

            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Slug Página Web (opcional)
                </label>
                <input
                  type="text"
                  value={formData.web_slug}
                  onChange={(e) => setFormData({ ...formData, web_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="ejemplo: segurosstudio"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  URL pública: agentedeseguros.online/soy/{formData.web_slug || 'slug'}
                </p>
              </div>
            )}

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

          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-800 mb-2 pb-2 border-b border-slate-200">Información de Contacto</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Celular Personal
              </label>
              <input
                type="tel"
                value={formData.celular_personal}
                onChange={(e) => setFormData({ ...formData, celular_personal: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Celular Laboral
              </label>
              <input
                type="tel"
                value={formData.celular_laboral}
                onChange={(e) => setFormData({ ...formData, celular_laboral: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Laboral
              </label>
              <input
                type="email"
                value={formData.email_laboral}
                onChange={(e) => setFormData({ ...formData, email_laboral: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Extensión Telefónica
              </label>
              <input
                type="text"
                value={formData.extension_telefonica}
                onChange={(e) =>
                  setFormData({ ...formData, extension_telefonica: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                URL Web Jiro
              </label>
              <input
                type="url"
                value={formData.url_web_jiro}
                onChange={(e) => setFormData({ ...formData, url_web_jiro: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                URL Web Multicotizador
              </label>
              <input
                type="url"
                value={formData.url_web_multicotizador}
                onChange={(e) =>
                  setFormData({ ...formData, url_web_multicotizador: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
              <span className="text-blue-600">📸</span>
              Mi Logotipo Personal
            </h3>
            {user ? (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>Importante:</strong> Tu logotipo personal aparecerá en tus PDFs de comisiones y materiales oficiales.
                  </p>
                  <p className="text-xs text-blue-700">
                    Si no subes un logo personal, se usará el logo de tu oficina o el logo JIRO por defecto.
                  </p>
                </div>
                <MiLogotipoEditor
                  userId={user.id}
                  currentLogoUrl={user.mi_logotipo_url}
                  onLogoChange={async () => {
                    // Recargar los datos después de cambiar el logo
                    const { data } = await supabase
                      .from('usuarios')
                      .select('mi_logotipo_url')
                      .eq('id', user.id)
                      .single();
                    if (data) {
                      user.mi_logotipo_url = data.mi_logotipo_url;
                    }
                  }}
                />
              </>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 font-medium mb-1">
                      Subir Logotipo Personal
                    </p>
                    <p className="text-xs text-gray-600">
                      Primero crea el usuario. Luego podrás editarlo para subir su logotipo personal.
                      El logotipo se usará en PDFs de comisiones y materiales oficiales.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <PaymentFields
              regimenFiscalId={formData.regimen_fiscal_id}
              banco={formData.banco}
              clabe={formData.clabe}
              onChange={(field, value) => setFormData({ ...formData, [field]: value })}
              editable={true}
            />
          </div>

          {currentUser?.rol === 'Administrador' && (
            <div>
              <h3 className="text-base font-semibold text-slate-800 mb-2 pb-2 border-b border-slate-200">Gestión de Vacaciones</h3>
              <div>
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
                  Días disponibles: 0 - 50
                </p>
              </div>
            </div>
          )}

        </form>
    </BaseModal>
  );
}
