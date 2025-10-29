import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Save, Upload, User as UserIcon, FileSignature, AlertCircle } from 'lucide-react';
import { CustomFields } from '../components/CustomFields';
import { DocumentsSection } from '../components/DocumentsSection';
import { PaymentFields } from '../components/PaymentFields';
import { CorreoIONOSFields } from '../components/CorreoIONOSFields';
import { UltimosCorreos } from '../components/UltimosCorreos';
import { ProximasReuniones } from '../components/ProximasReuniones';
import type { Database } from '../lib/database.types';

type Usuario = Database['public']['Tables']['usuarios']['Row'];
type Oficina = Database['public']['Tables']['oficinas']['Row'];
type PermisosCampo = Database['public']['Tables']['permisos_campos']['Row'];

export function Perfil() {
  const { usuario, refreshUsuario } = useAuth();
  const [formData, setFormData] = useState<Partial<Usuario>>({});
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [permisos, setPermisos] = useState<PermisosCampo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [firmaHtml, setFirmaHtml] = useState('');
  const [firmaInfo, setFirmaInfo] = useState<any>(null);
  const [loadingFirma, setLoadingFirma] = useState(false);

  useEffect(() => {
    if (usuario) {
      setFormData(usuario);
      loadData();
      loadFirma();
    }
  }, [usuario]);

  const loadData = async () => {
    try {
      const [oficinasRes, permisosRes] = await Promise.all([
        supabase.from('oficinas').select('*').eq('activa', true).order('nombre'),
        supabase.from('permisos_campos').select('*').eq('rol', usuario?.rol || ''),
      ]);

      if (oficinasRes.data) setOficinas(oficinasRes.data);
      if (permisosRes.data) setPermisos(permisosRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFirma = async () => {
    if (!usuario) return;

    setLoadingFirma(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-firma`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            usuarioId: usuario.id
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        setFirmaHtml(result.html);
        setFirmaInfo(result.info);
      }
    } catch (error) {
      console.error('Error cargando firma:', error);
    } finally {
      setLoadingFirma(false);
    }
  };

  const isFieldEditable = (fieldName: string) => {
    const permiso = permisos.find(p => p.nombre_campo === fieldName);
    return permiso?.editable ?? false;
  };

  const isFieldVisible = (fieldName: string) => {
    const permiso = permisos.find(p => p.nombre_campo === fieldName);
    return permiso?.visible ?? true;
  };

  const handleSave = async () => {
    if (!usuario) return;

    setSaving(true);
    setMessage(null);

    const updateData: Partial<Usuario> = {};
    Object.keys(formData).forEach((key) => {
      if (isFieldEditable(key)) {
        updateData[key as keyof Usuario] = formData[key as keyof Usuario];
      }
    });

    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', usuario.id);

    if (error) {
      setMessage({ type: 'error', text: 'Error al guardar cambios' });
    } else {
      setMessage({ type: 'success', text: 'Cambios guardados correctamente' });
      await refreshUsuario();
    }

    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${usuario.id}-${Date.now()}.${fileExt}`;
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
      .eq('id', usuario.id);

    if (updateError) {
      setMessage({ type: 'error', text: 'Error al actualizar imagen' });
    } else {
      setMessage({ type: 'success', text: 'Imagen actualizada correctamente' });
      await refreshUsuario();
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UltimosCorreos />
        <ProximasReuniones />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
          <p className="text-blue-100 mt-1">Administra tu información personal</p>
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
              {isFieldEditable('imagen_perfil_url') && (
                <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition cursor-pointer">
                  <Upload className="w-8 h-8 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-2">
              {usuario.rol}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fields.map((field) => {
              if (!isFieldVisible(field.key)) return null;
              const editable = isFieldEditable(field.key);

              return (
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
                      disabled={!editable}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
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
                      disabled={!editable}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  )}
                </div>
              );
            })}

            <CustomFields usuarioId={usuario.id} editable={true} />
          </div>

          <div className="mt-8">
            <CorreoIONOSFields
              emailCuenta={formData.email_cuenta || null}
              emailPassword={formData.email_password || null}
              emailVerificado={formData.email_verificado || null}
              emailUltimaVerificacion={formData.email_ultima_verificacion || null}
              emailErrorMensaje={formData.email_error_mensaje || null}
              onChange={(field, value) => setFormData({ ...formData, [field]: value })}
              editable={true}
              usuarioId={usuario.id}
            />
          </div>

          <div className="mt-8">
            <PaymentFields
              esquemaPagoId={formData.esquema_pago_id || ''}
              banco={formData.cuenta_banco || ''}
              clabe={formData.clabe_interbancaria || ''}
              onChange={(field, value) => {
                const dbField = field === 'banco' ? 'cuenta_banco' : field === 'clabe' ? 'clabe_interbancaria' : field;
                setFormData({ ...formData, [dbField]: value });
              }}
              editable={true}
            />
          </div>

          <div className="mt-8">
            <DocumentsSection usuarioId={usuario.id} canEdit={true} />
          </div>

          <div className="mt-8 border-t border-slate-200 pt-8">
            <div className="flex items-center space-x-3 mb-4">
              <FileSignature className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-slate-900">Mi Firma de E-Mail</h2>
            </div>

            {loadingFirma ? (
              <div className="text-center py-8">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-slate-500 mt-2">Cargando firma...</p>
              </div>
            ) : firmaHtml ? (
              <div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        Esta firma se aplica automáticamente en tus correos salientes
                      </p>
                      <p className="text-xs text-blue-700">
                        {firmaInfo && (
                          <>
                            Plantilla: <strong>{firmaInfo.template_nombre}</strong>
                            {' '} · Asignación: <strong className="capitalize">{firmaInfo.tipo_asignacion}</strong>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-2 border-slate-300 rounded-xl p-6 bg-white">
                  <div dangerouslySetInnerHTML={{ __html: firmaHtml }} />
                </div>

                <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-sm text-slate-600">
                    <strong>Nota:</strong> Las firmas son gestionadas por el Administrador. Si necesitas cambios en tu firma,
                    contacta al departamento de administración.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-lg">
                <FileSignature className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-semibold">No tienes una firma asignada</p>
                <p className="text-sm text-slate-500 mt-1">
                  Contacta al Administrador para que te asigne una firma.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end">
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
