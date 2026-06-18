import { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, User, Save, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MiLogotipoEditor } from '../components/MiLogotipoEditor';
import { getDisplayName } from '../lib/utils';
import { trackSettingsOpened, trackBrandingUpdated, trackProfileImageUpdated, trackLogoUpdated } from '../lib/activityLogger';

export default function MiMarca() {
  const { usuario, reloadUsuario: refreshUsuario } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const defaultDisplayName = getDisplayName({ ...usuario, nombre_publico: null });
  const [nombrePublico, setNombrePublico] = useState<string>(
    usuario?.nombre_publico ?? defaultDisplayName
  );
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    trackSettingsOpened();
  }, []);

  useEffect(() => {
    if (!usuario) return;
    setNombrePublico(usuario.nombre_publico ?? getDisplayName({ ...usuario, nombre_publico: null }));
  }, [usuario?.id, usuario?.nombre_publico, usuario?.nombre_completo, usuario?.nombre, usuario?.apellidos]);

  if (!usuario) return null;

  const isUsingDefault = !usuario.nombre_publico || usuario.nombre_publico.trim() === '';
  const hasChanges = (nombrePublico ?? '').trim() !== (usuario.nombre_publico ?? defaultDisplayName).trim();

  const handleSaveName = async () => {
    const value = nombrePublico.trim();
    setSavingName(true);
    setMessage(null);

    const valueToStore = value === '' || value === defaultDisplayName ? null : value;

    const { error } = await supabase
      .from('usuarios')
      .update({ nombre_publico: valueToStore, updated_at: new Date().toISOString() })
      .eq('id', usuario.id);

    if (error) {
      setMessage({ type: 'error', text: 'No se pudo guardar el nombre' });
    } else {
      setMessage({ type: 'success', text: 'Nombre actualizado correctamente' });
      trackBrandingUpdated('nombre_publico');
      await refreshUsuario();
    }
    setSavingName(false);
  };

  const handleResetName = async () => {
    setSavingName(true);
    setMessage(null);

    const { error } = await supabase
      .from('usuarios')
      .update({ nombre_publico: null, updated_at: new Date().toISOString() })
      .eq('id', usuario.id);

    if (error) {
      setMessage({ type: 'error', text: 'No se pudo restaurar el nombre' });
    } else {
      setNombrePublico(defaultDisplayName);
      setMessage({ type: 'success', text: 'Nombre restaurado al predeterminado' });
      await refreshUsuario();
    }
    setSavingName(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Solo se permiten archivos de imagen' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'La imagen no debe superar 5MB' });
      return;
    }

    setUploading(true);
    setMessage(null);

    const fileExt = file.name.split('.').pop();
    const fileName = `${usuario.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      setMessage({ type: 'error', text: 'Error al subir la imagen' });
      setUploading(false);
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
      setMessage({ type: 'error', text: 'Error al actualizar el perfil' });
    } else {
      setMessage({ type: 'success', text: 'Foto de perfil actualizada correctamente' });
      trackProfileImageUpdated();
      await refreshUsuario();
    }

    setUploading(false);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleAvatarRemove = async () => {
    if (!confirm('¿Estás seguro de quitar tu foto de perfil?')) return;

    setUploading(true);
    setMessage(null);

    const { error } = await supabase
      .from('usuarios')
      .update({ imagen_perfil_url: null, updated_at: new Date().toISOString() })
      .eq('id', usuario.id);

    if (error) {
      setMessage({ type: 'error', text: 'Error al eliminar la imagen' });
    } else {
      setMessage({ type: 'success', text: 'Foto de perfil eliminada' });
      await refreshUsuario();
    }

    setUploading(false);
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-neutral-100 rounded-lg">
            <User className="w-5 h-5 text-neutral-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-neutral-900">Nombre</h3>
            <p className="text-sm text-neutral-500 mt-0.5">
              Se muestra en Mi Página Web, Publicidad y documentos que tú generas. Por defecto se
              arma con tu nombre y apellidos; puedes editarlo sin cambiar tu nombre real del sistema.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">
              Nombre para mostrar
            </label>
            <input
              type="text"
              value={nombrePublico}
              onChange={(e) => setNombrePublico(e.target.value)}
              placeholder={defaultDisplayName}
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={120}
            />
            <p className="text-xs text-neutral-500 mt-1.5">
              {isUsingDefault ? (
                <>Actualmente se usa el nombre predeterminado: <strong>{defaultDisplayName || '—'}</strong></>
              ) : (
                <>Nombre personalizado activo. Predeterminado: <strong>{defaultDisplayName || '—'}</strong></>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveName}
              disabled={savingName || !hasChanges}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Guardar nombre
            </button>
            {!isUsingDefault && (
              <button
                type="button"
                onClick={handleResetName}
                disabled={savingName}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-50 disabled:opacity-60 text-neutral-700 text-sm font-medium rounded-lg border border-neutral-300 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Usar predeterminado
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Foto de perfil</h3>
            <p className="text-sm text-neutral-500 mt-1">
              Se muestra en tu avatar del sistema, directorio, chat y tu página pública.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="flex-shrink-0">
            <div className="w-36 h-36 rounded-full overflow-hidden bg-neutral-100 border-4 border-white shadow-lg ring-1 ring-neutral-200 flex items-center justify-center">
              {usuario.imagen_perfil_url ? (
                <img
                  src={usuario.imagen_perfil_url}
                  alt="Foto de perfil"
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-neutral-400" />
              )}
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                {usuario.imagen_perfil_url ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {usuario.imagen_perfil_url && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-50 disabled:opacity-60 text-neutral-700 text-sm font-medium rounded-lg border border-neutral-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Quitar foto
                </button>
              )}
            </div>
            <p className="text-xs text-neutral-500">
              PNG, JPG o GIF · máx 5MB · recomendado cuadrado 512x512
            </p>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      <MiLogotipoEditor
        userId={usuario.id}
        currentLogoUrl={usuario.mi_logotipo_url}
        onLogoChange={() => {
          refreshUsuario();
        }}
      />

      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">
          ¿Dónde se usa tu marca?
        </h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-neutral-600">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            Tu perfil y el encabezado del sistema
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            Mi Página Web pública
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            Publicidad (plantillas y diseños)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            PDFs de cotizaciones (GMM, multicotizador)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            Firmas de correo y comunicados
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            Directorio, chat y CRM
          </li>
        </ul>
      </div>
    </div>
  );
}
