import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutGrid as Layout, Save, RefreshCw, Eye, Code, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Info, RotateCcw } from 'lucide-react';

interface GlobalSettings {
  id: string;
  header_html: string;
  footer_html: string;
  activo: boolean;
  version: number;
  updated_at: string;
  updated_by: string | null;
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
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
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
    fetchSettings();
  }, []);

  useEffect(() => {
    if (showPreview && iframeRef.current) {
      updatePreview();
    }
  }, [headerHtml, footerHtml, showPreview]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_global_settings')
        .select('*')
        .eq('activo', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
        setHeaderHtml(data.header_html || DEFAULT_HEADER);
        setFooterHtml(data.footer_html || DEFAULT_FOOTER);
      }
    } catch (err) {
      console.error('Error cargando configuracion:', err);
    } finally {
      setLoading(false);
    }
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
    try {
      setSaving(true);
      setMessage(null);

      const newVersion = (settings?.version || 0) + 1;

      if (settings) {
        const { error } = await supabase
          .from('email_global_settings')
          .update({
            header_html: headerHtml,
            footer_html: footerHtml,
            version: newVersion,
            updated_at: new Date().toISOString(),
            updated_by: usuario?.id || null,
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_global_settings')
          .insert({
            header_html: headerHtml,
            footer_html: footerHtml,
            activo: true,
            version: 1,
            updated_by: usuario?.id || null,
          });

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Header y Footer guardados. Se aplicaran a todos los correos.' });
      await fetchSettings();
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
        <span className="text-sm text-neutral-500">Cargando configuracion...</span>
      </div>
    );
  }

  const currentValue = activeSection === 'header' ? headerHtml : footerHtml;
  const setCurrentValue = activeSection === 'header' ? setHeaderHtml : setFooterHtml;

  return (
    <div className="space-y-5">
      {/* Banner informativo */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Header y Footer globales</p>
          <p className="text-sm text-blue-700 mt-0.5">
            El HTML que configures aqui se inyectara automaticamente en <strong>todos</strong> los correos enviados desde la plataforma — sin excepcion. Los templates solo deben contener el cuerpo del mensaje.
          </p>
          {settings && (
            <p className="text-xs text-blue-500 mt-1.5">
              Version {settings.version} &middot; Ultima actualizacion: {new Date(settings.updated_at).toLocaleString('es-MX')}
            </p>
          )}
        </div>
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
          <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
            {(['header', 'footer'] as const).map(section => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  activeSection === section
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {section === 'header' ? 'Header (Encabezado)' : 'Footer (Pie de pagina)'}
              </button>
            ))}
          </div>

          {/* Toggle code / preview del fragmento */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'code'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                HTML
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'preview'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
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
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium shadow-sm"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button
              onClick={handleRestoreDefaults}
              className="flex items-center gap-2 px-4 py-2.5 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors text-sm font-medium"
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
            className="flex items-center justify-between w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-neutral-600" />
              <span className="text-sm font-semibold text-neutral-700">Vista previa del correo completo</span>
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
                    <span>Header global (esta configuracion)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-neutral-400 rounded-sm flex-shrink-0" />
                    <span>Cuerpo del template (por notificacion)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-400 rounded-sm flex-shrink-0" />
                    <span>Footer global (esta configuracion)</span>
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
