import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Save, Upload, User as UserIcon, ArrowLeft } from 'lucide-react';
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

  const canEditExpediente = currentUser?.rol === 'Administrador' || currentUser?.rol === 'Gerente';

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!usuario) return null;

  const fields = [
    { key: 'nombre', label: 'Nombre', type: 'text' },
    { key: 'apellidos', label: 'Apellidos', type: 'text' },
    { key: 'puesto', label: 'Puesto', type: 'text' },
    { key: 'oficina_id', label: 'Oficina', type: 'select' },
    { key: 'fecha_nacimiento', label: 'Fecha de Nacimiento', type: 'date' },
    { key: 'fecha_ingreso', label: 'Fecha de Ingreso', type: 'date' },
    { key: 'celular_personal', label: 'Celular Personal', type: 'tel' },
    { key: 'email_personal', label: 'Email Personal', type: 'email' },
    { key: 'celular_laboral', label: 'Celular Laboral', type: 'tel' },
    { key: 'email_laboral', label: 'Email Laboral', type: 'email' },
    { key: 'extension_telefonica', label: 'Extensión Telefónica', type: 'text' },
    { key: 'equipo_computo', label: 'Equipo de Cómputo', type: 'text' },
    { key: 'equipo_celular', label: 'Equipo Celular', type: 'text' },
    { key: 'url_web_jiro', label: 'URL Web Jiro', type: 'url' },
    { key: 'url_web_multicotizador', label: 'URL Web Multicotizador', type: 'url' },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/directorio')}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver al Directorio</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Perfil de Usuario</h1>
          <p className="text-blue-100 mt-1">Editar información de {usuario.nombre} {usuario.apellidos}</p>
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

          <div className="flex flex-col items-center mb-8">
            <div className="relative group">
              {formData.imagen_perfil_url ? (
                <img
                  src={formData.imagen_perfil_url}
                  alt="Perfil"
                  className="w-32 h-32 rounded-full object-cover border-4 border-slate-200"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center border-4 border-slate-200">
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
            <p className="text-sm text-slate-500 mt-2">
              {usuario.rol}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {field.label}
                </label>
                {field.type === 'select' ? (
                  <select
                    value={formData[field.key as keyof Usuario] as string || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, [field.key]: e.target.value || null })
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar oficina</option>
                    {oficinas.map((oficina) => (
                      <option key={oficina.id} value={oficina.id}>
                        {oficina.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={(formData[field.key as keyof Usuario] as string) || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, [field.key]: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            ))}

            <CustomFields usuarioId={usuario.id} editable={true} />
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

          <div className="mt-8">
            <DocumentsSection usuarioId={usuario.id} canEdit={true} />
          </div>

          <div className="mt-8">
            <ExpedienteSection usuarioId={usuario.id} canEdit={canEditExpediente} />
          </div>

          <div className="mt-8 flex justify-end space-x-3">
            <button
              onClick={() => navigate('/directorio')}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
