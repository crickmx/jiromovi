import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PaymentFields } from './PaymentFields';
import { BaseModal } from './BaseModal';
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

  const [formData, setFormData] = useState({
    password: '',
    nombre: '',
    apellidos: '',
    rol: 'Empleado' as 'Administrador' | 'Gerente' | 'Empleado' | 'Agente',
    puesto: '',
    oficina_id: '',
    fecha_nacimiento: '',
    fecha_ingreso: '',
    celular_personal: '',
    email_personal: '',
    celular_laboral: '',
    email_laboral: '',
    extension_telefonica: '',
    url_web_jiro: '',
    url_web_multicotizador: '',
    esquema_pago_id: '',
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
        fecha_nacimiento: user.fecha_nacimiento || '',
        fecha_ingreso: user.fecha_ingreso || '',
        celular_personal: user.celular_personal,
        email_personal: user.email_personal,
        celular_laboral: user.celular_laboral,
        email_laboral: user.email_laboral,
        extension_telefonica: user.extension_telefonica,
        url_web_jiro: user.url_web_jiro,
        url_web_multicotizador: user.url_web_multicotizador,
        esquema_pago_id: user.esquema_pago_id || '',
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
          fecha_nacimiento: formData.fecha_nacimiento || null,
          fecha_ingreso: formData.fecha_ingreso || null,
          celular_personal: formData.celular_personal,
          email_personal: formData.email_personal,
          celular_laboral: formData.celular_laboral,
          email_laboral: formData.email_laboral,
          extension_telefonica: formData.extension_telefonica,
          url_web_jiro: formData.url_web_jiro,
          url_web_multicotizador: formData.url_web_multicotizador,
          esquema_pago_id: formData.esquema_pago_id || null,
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
                esquema_pago_id: formData.esquema_pago_id || null,
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
    <div className="flex justify-end space-x-3">
      <button
        type="button"
        onClick={onClose}
        className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
      >
        Cancelar
      </button>
      <button
        type="submit"
        form="user-form"
        disabled={loading}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? 'Guardando...' : user ? 'Actualizar' : 'Crear Usuario'}
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={user ? 'Editar Usuario' : 'Nuevo Usuario'}
      maxWidth="4xl"
      footer={footer}
    >
      <form id="user-form" onSubmit={handleSubmit}>
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Información de Acceso</h3>
            </div>

            {!user && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Contraseña *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {user && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nueva Contraseña (dejar vacío para no cambiar)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="md:col-span-2 pt-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Información Personal</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nombre *</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Apellidos *</label>
              <input
                type="text"
                value={formData.apellidos}
                onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Rol *</label>
              <select
                value={formData.rol}
                onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Empleado">Empleado</option>
                <option value="Agente">Agente</option>
                {!isGerente && <option value="Gerente">Gerente</option>}
                {!isGerente && <option value="Administrador">Administrador</option>}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Puesto</label>
              <input
                type="text"
                value={formData.puesto}
                onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Oficina</label>
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                value={formData.fecha_nacimiento}
                onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Fecha de Ingreso
              </label>
              <input
                type="date"
                value={formData.fecha_ingreso}
                onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2 pt-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Información de Contacto</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Celular Personal
              </label>
              <input
                type="tel"
                value={formData.celular_personal}
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
                value={formData.email_personal}
                onChange={(e) => setFormData({ ...formData, email_personal: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Celular Laboral
              </label>
              <input
                type="tel"
                value={formData.celular_laboral}
                onChange={(e) => setFormData({ ...formData, celular_laboral: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Laboral
              </label>
              <input
                type="email"
                value={formData.email_laboral}
                onChange={(e) => setFormData({ ...formData, email_laboral: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Extensión Telefónica
              </label>
              <input
                type="text"
                value={formData.extension_telefonica}
                onChange={(e) =>
                  setFormData({ ...formData, extension_telefonica: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                URL Web Jiro
              </label>
              <input
                type="url"
                value={formData.url_web_jiro}
                onChange={(e) => setFormData({ ...formData, url_web_jiro: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                URL Web Multicotizador
              </label>
              <input
                type="url"
                value={formData.url_web_multicotizador}
                onChange={(e) =>
                  setFormData({ ...formData, url_web_multicotizador: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-6">
            <PaymentFields
              esquemaPagoId={formData.esquema_pago_id}
              banco={formData.banco}
              clabe={formData.clabe}
              onChange={(field, value) => setFormData({ ...formData, [field]: value })}
              editable={true}
            />
          </div>

          {currentUser?.rol === 'Administrador' && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Gestión de Vacaciones</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Días de Vacaciones Disponibles
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.dias_vacaciones_disponibles}
                  onChange={(e) =>
                    setFormData({ ...formData, dias_vacaciones_disponibles: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Número de días de vacaciones que este usuario puede solicitar
                </p>
              </div>
            </div>
          )}

        </form>
    </BaseModal>
  );
}
