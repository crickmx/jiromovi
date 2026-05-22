import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Save, Upload, User as UserIcon, Copy, Check } from 'lucide-react';
import { CustomFields } from '../components/CustomFields';
import { PaymentFields } from '../components/PaymentFields';
import { CorreoIONOSFields } from '../components/CorreoIONOSFields';
import { ExpedienteSection } from '../components/ExpedienteSection';
import { MiLogotipoEditor } from '../components/MiLogotipoEditor';
import { getMiPaginaWeb } from '../lib/webUrlUtils';
import { trackProfileUpdate } from '../lib/activityLogger';
import type { Database } from '../lib/database.types';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';

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
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (usuario) {
      setFormData(usuario);
      loadData();
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

    // Guardar valores originales de información de pago para detectar cambios
    const originalBanco = usuario.banco;
    const originalClabe = usuario.clabe;
    const originalRegimenFiscalId = usuario.regimen_fiscal_id;

    const updateData: Partial<Usuario> = {};
    Object.keys(formData).forEach((key) => {
      if (isFieldEditable(key)) {
        updateData[key as keyof Usuario] = formData[key as keyof Usuario];
      }
    });

    // Siempre incluir campos de información de pago si están presentes en formData
    // Estos campos son editables desde PaymentFields y deben guardarse
    const paymentFields = ['banco', 'clabe', 'regimen_fiscal_id'];
    paymentFields.forEach((field) => {
      if (field in formData) {
        updateData[field as keyof Usuario] = formData[field as keyof Usuario];
      }
    });

    updateData.updated_at = new Date().toISOString();

    // Debug: Verificar que los campos de pago se incluyen
    console.log('Datos a actualizar:', {
      banco: updateData.banco,
      clabe: updateData.clabe,
      regimen_fiscal_id: updateData.regimen_fiscal_id,
      totalFields: Object.keys(updateData).length
    });

    const { error } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', usuario.id);

    if (error) {
      console.error('Error al actualizar perfil:', error);
      setMessage({
        type: 'error',
        text: `Error al guardar cambios: ${error.message || 'Error desconocido'}`
      });
      setSaving(false);
      return;
    }

    trackProfileUpdate('perfil general');

    // Detectar si cambió información de pago
    // Comparar con los valores actuales en formData, no con updateData
    const cambioBanco = formData.banco !== originalBanco;
    const cambioClabe = formData.clabe !== originalClabe;
    const cambioRegimenFiscal = formData.regimen_fiscal_id !== originalRegimenFiscalId;

    console.log('🔍 Detección de cambios en información de pago:', {
      cambioBanco,
      cambioClabe,
      cambioRegimenFiscal,
      banco: { original: originalBanco, nuevo: formData.banco },
      clabe: { original: originalClabe, nuevo: formData.clabe },
      regimenFiscal: { original: originalRegimenFiscalId, nuevo: formData.regimen_fiscal_id }
    });

    // Si cambió algún dato de pago, crear ticket automáticamente
    if (cambioBanco || cambioClabe || cambioRegimenFiscal) {
      console.log('✅ Se detectaron cambios en información de pago, creando ticket...');

      try {
        // Obtener nombre del régimen fiscal si cambió
        let regimenFiscalNombre = null;
        if (formData.regimen_fiscal_id) {
          console.log('📋 Obteniendo nombre del régimen fiscal:', formData.regimen_fiscal_id);

          const { data: regimenData, error: regimenError } = await supabase
            .from('commission_fiscal_regimes')
            .select('name')
            .eq('id', formData.regimen_fiscal_id)
            .maybeSingle();

          if (regimenError) {
            console.error('Error al obtener régimen fiscal:', regimenError);
          } else if (regimenData) {
            regimenFiscalNombre = regimenData.name;
            console.log('✅ Régimen fiscal encontrado:', regimenFiscalNombre);
          }
        }

        // Llamar a la función de crear ticket
        console.log('📞 Llamando a crear_ticket_cambio_bancario con parámetros:', {
          p_usuario_id: usuario.id,
          p_regimen_fiscal_nombre: regimenFiscalNombre,
          p_banco: formData.banco || null,
          p_clabe: formData.clabe || null
        });

        const { data: ticketResult, error: ticketError } = await supabase.rpc(
          'crear_ticket_cambio_bancario',
          {
            p_usuario_id: usuario.id,
            p_regimen_fiscal_nombre: regimenFiscalNombre,
            p_banco: formData.banco || null,
            p_clabe: formData.clabe || null
          }
        );

        if (ticketError) {
          console.error('❌ Error al crear ticket:', ticketError);
          setMessage({
            type: 'error',
            text: `Cambios guardados, pero no se pudo crear el ticket de cambios bancarios: ${ticketError.message}`
          });
        } else if (ticketResult) {
          console.log('✅ Ticket creado/actualizado exitosamente:', ticketResult);
          setMessage({
            type: 'success',
            text: `Cambios guardados correctamente. Ticket de cambios bancarios ${ticketResult.accion} con folio ${ticketResult.folio}`
          });
        }
      } catch (ticketErr) {
        console.error('❌ Error en proceso de ticket:', ticketErr);
        setMessage({
          type: 'error',
          text: `Cambios guardados, pero hubo un error al crear el ticket: ${ticketErr}`
        });
      }
    } else {
      console.log('ℹ️ No se detectaron cambios en información de pago, no se creará ticket');
      setMessage({ type: 'success', text: 'Cambios guardados correctamente' });
    }

    await refreshUsuario();
    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${usuario.id}-${Date.now()}.${fileExt}`;
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
      .eq('id', usuario.id);

    if (updateError) {
      setMessage({ type: 'error', text: 'Error al actualizar imagen' });
    } else {
      setMessage({ type: 'success', text: 'Imagen actualizada correctamente' });
      await refreshUsuario();
    }
  };

  if (loading) {
    return <LoadingState text="Cargando perfil..." />;
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
    { key: 'web_slug', label: 'Slug', type: 'text' },
  ];

  const handleCopyUrl = async () => {
    const miPaginaWeb = getMiPaginaWeb(formData.web_slug);
    if (miPaginaWeb) {
      await navigator.clipboard.writeText(`https://${miPaginaWeb}`);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        title="Mi Perfil"
        description="Administra tu informacion personal"
        icon={UserIcon}
        actions={
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        }
      />

      <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-5 sm:p-6">
          {message && (
            <div
              className={`mb-5 px-4 py-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/30'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/30'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              {formData.imagen_perfil_url ? (
                <img
                  src={formData.imagen_perfil_url}
                  alt="Perfil"
                  className="w-24 h-24 rounded-full object-cover border-3 border-neutral-200 dark:border-white/10"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center border-3 border-neutral-200 dark:border-white/10">
                  <UserIcon className="w-12 h-12 text-white" />
                </div>
              )}
              {isFieldEditable('imagen_perfil_url') && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition cursor-pointer">
                  <Upload className="w-6 h-6 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-neutral-500 dark:text-white/40 mt-2">
              {usuario.rol}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => {
              if (!isFieldVisible(field.key)) return null;
              const editable = isFieldEditable(field.key);

              return (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1.5">
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={formData[field.key as keyof Usuario] as string || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, [field.key]: e.target.value || null })
                      }
                      disabled={!editable}
                      className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                      className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    />
                  )}
                </div>
              );
            })}

            {formData.web_slug && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1.5">
                  Mi Pagina Web
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={getMiPaginaWeb(formData.web_slug)}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-neutral-600 dark:text-white/60 font-medium"
                  />
                  <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                    {copiedUrl ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copiar URL
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-neutral-500 dark:text-white/40 mt-1">
                  Esta es tu pagina web publica que puedes compartir con tus clientes
                </p>
              </div>
            )}

            <CustomFields usuarioId={usuario.id} editable={true} />
          </div>

          {/* Configuración de correos IONOS - Oculto para todos los roles */}
          {false && (
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
          )}

          <div className="mt-8">
            <PaymentFields
              regimenFiscalId={formData.regimen_fiscal_id || ''}
              banco={formData.banco || ''}
              clabe={formData.clabe || ''}
              onChange={(field, value) => setFormData({ ...formData, [field]: value })}
              editable={true}
            />
          </div>

          <div className="mt-8">
            <MiLogotipoEditor
              userId={usuario.id}
              currentLogoUrl={formData.mi_logotipo_url}
              onLogoChange={(url) => setFormData({ ...formData, mi_logotipo_url: url })}
            />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Expediente</h3>
            <ExpedienteSection usuarioId={usuario.id} canEdit={false} />
          </div>
      </div>
    </div>
  );
}
