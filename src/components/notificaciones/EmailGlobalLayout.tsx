import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutGrid as Layout, Save, RefreshCw, Eye, Code, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Info, RotateCcw, Radio } from 'lucide-react';

interface NotificationChannel {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
  is_active: boolean;
  branding: {
    header_html?: string;
    footer_html?: string;
    logo_url?: string;
    primary_color?: string;
    sender_name?: string;
  } | null;
}

const DEFAULT_HEADER = `<div style="background-color:#ffffff; border-bottom:2px solid #f0f0f0; padding:24px 32px; text-align:center; font-family:Arial,sans-serif;">
  <img src="https://app.movidigital.mx/logojiro.png" alt="MOVI Digital" style="max-height:56px; max-width:200px; object-fit:contain;" />
</div>
<div style="background-color:#f8f9fa; height:4px; width:100%;"></div>`;

const DEFAULT_FOOTER = `<div style="background-color:#f8f9fa; border-top:1px solid #e9ecef; padding:20px 32px; text-align:center; font-family:Arial,sans-serif; margin-top:0;">
  <img src="https://app.movidigital.mx/logojiro.png" alt="Grupo JIRO" style="max-height:28px; max-width:120px; opacity:0.65; object-fit:contain; display:block; margin:0 auto 10px;" />
  <p style="margin:0; font-size:11px; color:#9ca3af; line-height:1.6;">
    Este mensaje fue enviado automaticamente por MOVI Digital.<br/>
    Si tienes preguntas, contacta a tu administrador.
  </p>
  <p style="margin:6px 0 0; font-size:10px; color:#d1d5db;">
    &copy; 2025 Grupo JIRO. Todos los derechos reservados.
  </p>
</div>`;

const SAMPLE_BODY = `<h2 style="margin:0 0 12px; font-size:20px; color:#1a1a1a;">Notificacion de ejemplo</h2>
<p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.6;">
  Este es el <strong>cuerpo del mensaje</strong> de una notificacion transaccional. El header y footer de arriba y abajo son los que configuras en esta seccion.
</p>
<p style="margin:0; font-size:14px; color:#6b7280;">Saludos,<br/>El equipo de MOVI Digital</p>`;

type EditMode = 'header' | 'footer';
type ViewMode = 'code' | 'preview';

export function EmailGlobalLayout() {
  const { usuario } = useAuth();
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [headerHtml, setHeaderHtml] = useState(DEFAULT_HEADER);
  const [footerHtml, setFooterHtml] = useState(DEFAULT_FOOTER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState<EditMode>('header');
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [showPreview, setShowPreview] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetchChannels();
  }, []);

  useEffect(() => {
    if (showPreview && iframeRef.current) {
      updatePreview();
    }
  }, [headerHtml, footerHtml, showPreview]);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notification_channels')
        .select('id, name, type, is_default, is_active, branding')
        .eq('type', 'email_resend')
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;

      const list: NotificationChannel[] = data || [];
      setChannels(list);

      if (list.length > 0) {
        const defaultChannel = list.find(c => c.is_default) || list[0];
        loadChannel(defaultChannel);
      }
    } catch (err) {
      console.error('Error cargando canales:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadChannel = (channel: NotificationChannel) => {
    setSelectedChannelId(channel.id);
    setHeaderHtml(channel.branding?.header_html || DEFAULT_HEADER);
    setFooterHtml(channel.branding?.footer_html || DEFAULT_FOOTER);
  };

  const handleChannelChange = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (channel) loadChannel(channel);
  };

  const updatePreview = () => {
    if (!iframeRef.current) return;
    const html = buildPreviewHtml();
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  };

  const buildPreviewHtml = () => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vista previa</title>
</head>
<body style="margin:0; padding:16px; background-color:#f4f4f4; font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <tr><td>${headerHtml}</td></tr>
          <tr>
            <td style="padding:32px;">
              ${SAMPLE_BODY}
            </td>
          </tr>
          <tr><td>${footerHtml}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const handleSave = async () => {
    if (!selectedChannelId) return;
    try {
      setSaving(true);
      setMessage(null);

      const channel = channels.find(c => c.id === selectedChannelId);
      const existingBranding = channel?.branding || {};

      const { error } = await supabase
        .from('notification_channels')
        .update({
          branding: {
            ...existingBranding,
            header_html: headerHtml,
            footer_html: footerHtml,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedChannelId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Header y Footer guardados en el canal seleccionado.' });
      await fetchChannels();
    } catch (err: any) {
      setMessage({ type: 'error', text: `Error al guardar: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    setHeaderHtml(DEFAULT_HEADER);
    setFooterHtml(DEFAULT_FOOTER);
    setMessage({ type: 'success', text: 'Valores por defecto restaurados. Guarda para aplicarlos.' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-neutral-400 mr-2" />
        <span className="text-sm text-neutral-500">Cargando canales...</span>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Radio className="w-12 h-12 text-neutral-300 mb-4" />
        <p className="text-neutral-600 font-medium">No hay canales de correo configurados</p>
        <p className="text-sm text-neutral-400 mt-1">Crea un canal de tipo "Resend (Email)" en la pestana de Canales.</p>
      </div>
    );
  }

  const currentValue = activeSection === 'header' ? headerHtml : footerHtml;
  const setCurrentValue = activeSection === 'header' ? setHeaderHtml : setFooterHtml;
  const selectedChannel = channels.find(c => c.id === selectedChannelId);

  return (
    <div className="space-y-5">
      {/* Banner informativo */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Header y Footer por canal</p>
          <p className="text-sm text-blue-700 mt-0.5">
            Cada canal de correo tiene su propio header y footer. Selecciona el canal que deseas editar. El HTML se inyectara automaticamente en todos los correos enviados por ese canal.
          </p>
        </div>
      </div>

      {/* Channel selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-neutral-700 dark:text-white/70 flex-shrink-0">Canal:</label>
        <select
          value={selectedChannelId}
          onChange={e => handleChannelChange(e.target.value)}
          className="flex-1 max-w-xs px-3 py-2 border border-neutral-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {channels.map(channel => (
            <option key={channel.id} value={channel.id}>
              {channel.name}{channel.is_default ? ' (predeterminado)' : ''}
            </option>
          ))}
        </select>
        {selectedChannel && (
          <span className="text-xs text-neutral-500 dark:text-white/40">
            {selectedChannel.is_default ? 'Canal predeterminado' : 'Canal personalizado'}
          </span>
        )}
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {message.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />
          }
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-current opacity-60 hover:opacity-100">
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Editor */}
        <div className="space-y-3">
          {/* Tabs header/footer */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-white/5 rounded-lg p-1">
            {(['header', 'footer'] as const).map(section => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  activeSection === section
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/70'
                }`}
              >
                {section === 'header' ? 'Header (Encabezado)' : 'Footer (Pie de pagina)'}
              </button>
            ))}
          </div>

          {/* Toggle code / preview del fragmento */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'code'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/70'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                HTML
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/70'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Vista fragmento
              </button>
            </div>
          </div>

          {viewMode === 'code' ? (
            <div className="relative">
              <textarea
                value={currentValue}
                onChange={e => setCurrentValue(e.target.value)}
                rows={18}
                spellCheck={false}
                className="w-full font-mono text-xs border border-neutral-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-neutral-950 text-emerald-400 leading-relaxed"
                placeholder={`Escribe el HTML del ${activeSection}...`}
              />
              <div className="absolute bottom-2 right-2 text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded">
                {currentValue.length} chars
              </div>
            </div>
          ) : (
            <div className="border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50 min-h-[250px]">
              <div
                className="p-2"
                dangerouslySetInnerHTML={{ __html: currentValue }}
              />
              {!currentValue.trim() && (
                <p className="text-xs text-neutral-400 text-center py-8">Sin contenido</p>
              )}
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !selectedChannelId}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium shadow-sm"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button
              onClick={handleRestoreDefaults}
              className="flex items-center gap-2 px-4 py-2.5 border border-neutral-300 dark:border-white/10 text-neutral-700 dark:text-white/70 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Restaurar defecto
            </button>
          </div>
        </div>

        {/* Preview completo del correo */}
        <div className="space-y-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center justify-between w-full px-4 py-3 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/8 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/8 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-neutral-600 dark:text-white/60" />
              <span className="text-sm font-semibold text-neutral-700 dark:text-white/80">Vista previa del correo completo</span>
            </div>
            {showPreview
              ? <ChevronUp className="w-4 h-4 text-neutral-500" />
              : <ChevronDown className="w-4 h-4 text-neutral-500" />
            }
          </button>

          {showPreview && (
            <div className="border border-neutral-200 rounded-lg overflow-hidden bg-neutral-100">
              <div className="px-3 py-1.5 bg-neutral-200 flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs text-neutral-500">Vista previa — correo real</span>
              </div>
              <iframe
                ref={iframeRef}
                title="Email preview"
                className="w-full border-0"
                style={{ height: '480px' }}
                onLoad={() => updatePreview()}
              />
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Layout className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 space-y-1">
                <p className="font-semibold">Estructura del correo final:</p>
                <div className="space-y-0.5 ml-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-blue-400 rounded-sm flex-shrink-0" />
                    <span>Header del canal seleccionado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-neutral-400 rounded-sm flex-shrink-0" />
                    <span>Cuerpo del template (por notificacion)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-400 rounded-sm flex-shrink-0" />
                    <span>Footer del canal seleccionado</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
