import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Save, Eye, AlertCircle, CheckCircle2, Mail, MessageCircle, Bell, Star, ChevronDown } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email_resend' | 'whatsapp_wazzup24';
  is_active: boolean;
  is_default: boolean;
}

interface Plantilla {
  id: string;
  asunto: string;
  html_cuerpo: string;
  variables_disponibles: string[];
  enviar_correo: boolean;
  enviar_whatsapp: boolean;
  enviar_notificacion: boolean;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  resend_channel_id: string | null;
  wazzup24_channel_id: string | null;
  tipo_notificacion: {
    id: string;
    nombre: string;
    codigo: string;
  };
}

// ─── Channel selector ─────────────────────────────────────────────────────────

function ChannelSelector({
  label,
  icon,
  iconColor,
  channels,
  value,
  onChange,
  defaultChannel,
}: {
  label: string;
  icon: React.ReactNode;
  iconColor: string;
  channels: NotificationChannel[];
  value: string | null;
  onChange: (v: string | null) => void;
  defaultChannel?: NotificationChannel;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-neutral-600 mb-1.5 flex items-center gap-1.5">
        <span className={iconColor}>{icon}</span>
        {label}
      </label>
      <div className="relative">
        <select
          value={value || ''}
          onChange={e => onChange(e.target.value || null)}
          className="w-full px-3 py-2 pr-8 border border-neutral-300 rounded-lg text-sm bg-white text-neutral-800 focus:ring-2 focus:ring-accent focus:border-accent appearance-none"
        >
          <option value="">
            {defaultChannel ? `Usar default: ${defaultChannel.name}` : 'Usar canal default'}
          </option>
          {channels.map(ch => (
            <option key={ch.id} value={ch.id}>
              {ch.name}{ch.is_default ? ' (default)' : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
      </div>
      {value && channels.find(c => c.id === value) && (
        <p className="text-[11px] text-neutral-500 mt-1">
          Canal seleccionado: <strong>{channels.find(c => c.id === value)?.name}</strong>
        </p>
      )}
      {!value && defaultChannel && (
        <p className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1">
          <Star className="w-3 h-3 text-amber-500" />
          Se usará: <strong>{defaultChannel.name}</strong>
        </p>
      )}
    </div>
  );
}

export function GestionPlantillas() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [selectedPlantilla, setSelectedPlantilla] = useState<Plantilla | null>(null);
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [enviarCorreo, setEnviarCorreo] = useState(true);
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(false);
  const [enviarNotificacion, setEnviarNotificacion] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [resendChannelId, setResendChannelId] = useState<string | null>(null);
  const [wazzupChannelId, setWazzupChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Channels
  const [emailChannels, setEmailChannels] = useState<NotificationChannel[]>([]);
  const [waChannels, setWaChannels] = useState<NotificationChannel[]>([]);

  useEffect(() => {
    fetchPlantillas();
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    const { data } = await supabase
      .from('notification_channels')
      .select('id, name, type, is_active, is_default')
      .eq('is_active', true)
      .order('is_default', { ascending: false });
    if (data) {
      setEmailChannels(data.filter(c => c.type === 'email_resend'));
      setWaChannels(data.filter(c => c.type === 'whatsapp_wazzup24'));
    }
  };

  const fetchPlantillas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('correo_plantillas')
        .select(`
          *,
          tipo_notificacion:tipo_notificacion_id (
            id,
            nombre,
            codigo
          )
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPlantillas(data || []);
    } catch (error) {
      console.error('Error al cargar plantillas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlantilla = (plantilla: Plantilla) => {
    setSelectedPlantilla(plantilla);
    setAsunto(plantilla.asunto);
    setCuerpo(plantilla.html_cuerpo);
    setEnviarCorreo(plantilla.enviar_correo ?? true);
    setEnviarWhatsapp(plantilla.enviar_whatsapp ?? false);
    setEnviarNotificacion(plantilla.enviar_notificacion ?? true);
    setEmailEnabled(plantilla.email_enabled ?? true);
    setWhatsappEnabled(plantilla.whatsapp_enabled ?? false);
    setResendChannelId(plantilla.resend_channel_id ?? null);
    setWazzupChannelId(plantilla.wazzup24_channel_id ?? null);
    setShowPreview(false);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!selectedPlantilla) return;

    try {
      setSaving(true);
      setMessage(null);

      const { error } = await supabase
        .from('correo_plantillas')
        .update({
          asunto,
          html_cuerpo: cuerpo,
          enviar_correo: enviarCorreo,
          enviar_whatsapp: enviarWhatsapp,
          enviar_notificacion: enviarNotificacion,
          email_enabled: emailEnabled,
          whatsapp_enabled: whatsappEnabled,
          resend_channel_id: resendChannelId || null,
          wazzup24_channel_id: wazzupChannelId || null,
          ultima_actualizacion: new Date().toISOString(),
          actualizado_por: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', selectedPlantilla.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Plantilla guardada exitosamente' });
      fetchPlantillas();
    } catch (error: any) {
      console.error('Error al guardar:', error);
      setMessage({ type: 'error', text: 'Error al guardar la plantilla' });
    } finally {
      setSaving(false);
    }
  };

  const defaultEmailChannel = emailChannels.find(c => c.is_default);
  const defaultWaChannel = waChannels.find(c => c.is_default);

  if (loading) {
    return <div className="text-center py-8 text-neutral-600">Cargando...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista de Plantillas */}
      <div className="lg:col-span-1">
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">Plantillas Disponibles</h3>
        <div className="space-y-2">
          {plantillas.map((plantilla) => (
            <button
              key={plantilla.id}
              onClick={() => handleSelectPlantilla(plantilla)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                selectedPlantilla?.id === plantilla.id
                  ? 'border-accent bg-primary-50'
                  : 'border-neutral-200 hover:border-neutral-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <FileText className={`w-5 h-5 flex-shrink-0 ${
                  selectedPlantilla?.id === plantilla.id ? 'text-accent' : 'text-neutral-400'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-800 truncate">
                    {(plantilla.tipo_notificacion as any)?.nombre || 'Sin nombre'}
                  </p>
                  <p className="text-sm text-neutral-600 truncate">{plantilla.asunto}</p>
                  {/* Channel indicators */}
                  <div className="flex gap-1 mt-1.5">
                    {(plantilla.email_enabled || plantilla.enviar_correo) && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-medium">
                        <Mail className="w-2.5 h-2.5" /> Email
                      </span>
                    )}
                    {(plantilla.whatsapp_enabled || plantilla.enviar_whatsapp) && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-medium">
                        <MessageCircle className="w-2.5 h-2.5" /> WA
                      </span>
                    )}
                    {plantilla.resend_channel_id && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-medium">
                        Canal
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="lg:col-span-2">
        {selectedPlantilla ? (
          <div className="space-y-4">
            {message && (
              <div className={`flex items-center gap-2 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-accent-50 text-accent-800 border border-accent-200'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <p className="text-sm">{message.text}</p>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                Editar Plantilla: {(selectedPlantilla.tipo_notificacion as any)?.nombre}
              </h3>

              {/* Variables Disponibles */}
              <div className="mb-4 p-4 bg-primary-50 rounded-lg border border-primary-200">
                <p className="text-sm font-medium text-primary-900 mb-2">Variables Disponibles:</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedPlantilla.variables_disponibles || []).map((variable) => (
                    <code
                      key={variable}
                      className="px-2 py-1 bg-white rounded text-xs text-primary-700 border border-primary-300"
                    >
                      {variable}
                    </code>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {/* Canales de Notificación + selectores */}
                <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-4">
                  <p className="text-sm font-semibold text-neutral-800">Canales de Envío</p>

                  {/* Toggles básicos */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-accent" />
                        <Label htmlFor="enviar-correo" className="text-sm font-medium text-neutral-700">
                          Correo Electrónico
                        </Label>
                      </div>
                      <Switch
                        id="enviar-correo"
                        checked={enviarCorreo}
                        onCheckedChange={setEnviarCorreo}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-green-600" />
                        <Label htmlFor="enviar-whatsapp" className="text-sm font-medium text-neutral-700">
                          WhatsApp
                        </Label>
                      </div>
                      <Switch
                        id="enviar-whatsapp"
                        checked={enviarWhatsapp}
                        onCheckedChange={setEnviarWhatsapp}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-600" />
                        <Label htmlFor="enviar-notificacion" className="text-sm font-medium text-neutral-700">
                          Notificación Interna
                        </Label>
                      </div>
                      <Switch
                        id="enviar-notificacion"
                        checked={enviarNotificacion}
                        onCheckedChange={setEnviarNotificacion}
                      />
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-neutral-200 pt-3">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                      Canal específico (opcional)
                    </p>
                    <div className="space-y-3">
                      {/* Email channel selector */}
                      {enviarCorreo && (
                        <ChannelSelector
                          label="Canal de correo Resend"
                          icon={<Mail className="w-3.5 h-3.5" />}
                          iconColor="text-blue-500"
                          channels={emailChannels}
                          value={resendChannelId}
                          onChange={setResendChannelId}
                          defaultChannel={defaultEmailChannel}
                        />
                      )}
                      {/* WhatsApp channel selector */}
                      {enviarWhatsapp && (
                        <ChannelSelector
                          label="Canal de WhatsApp Wazzup24"
                          icon={<MessageCircle className="w-3.5 h-3.5" />}
                          iconColor="text-green-500"
                          channels={waChannels}
                          value={wazzupChannelId}
                          onChange={setWazzupChannelId}
                          defaultChannel={defaultWaChannel}
                        />
                      )}
                      {!enviarCorreo && !enviarWhatsapp && (
                        <p className="text-xs text-neutral-400 italic">Activa correo o WhatsApp para ver los selectores de canal.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Asunto
                  </label>
                  <input
                    type="text"
                    value={asunto}
                    onChange={(e) => setAsunto(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Cuerpo HTML
                  </label>
                  <textarea
                    value={cuerpo}
                    onChange={(e) => setCuerpo(e.target.value)}
                    rows={15}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent font-mono text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <Save className="w-5 h-5" />
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>

                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="px-6 py-3 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-2 font-medium"
                  >
                    <Eye className="w-5 h-5" />
                    {showPreview ? 'Ocultar' : 'Vista Previa'}
                  </button>
                </div>
              </div>

              {/* Vista Previa */}
              {showPreview && (
                <div className="mt-6 p-6 bg-white rounded-lg border-2 border-neutral-200">
                  <h4 className="font-semibold text-neutral-800 mb-2">Asunto: {asunto}</h4>
                  <div
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: cuerpo }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-96 text-neutral-500">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Selecciona una plantilla para editar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
