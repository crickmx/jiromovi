import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Mail, MessageCircle, CreditCard as Edit2, Trash2, CheckCircle,
  XCircle, Star, StarOff, Send, Eye, EyeOff, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, Code, RotateCcw, Save, Layout,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationChannel {
  id: string;
  name: string;
  description: string | null;
  type: 'email_resend' | 'whatsapp_wazzup24';
  provider: 'resend' | 'wazzup24';
  config: Record<string, string>;
  branding: Record<string, string>;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

type ChannelType = 'email_resend' | 'whatsapp_wazzup24';

const DEFAULT_HEADER = `<div style="background-color:#ffffff; border-bottom:2px solid #f0f0f0; padding:24px 32px; text-align:center; font-family:Arial,sans-serif;">
  <a href="https://movi.digital/">
    <img src="https://movi.digital/wp-content/uploads/2025/12/moviRecurso-1.png" alt="MOVI Digital" style="max-height:56px; max-width:200px; object-fit:contain;" />
  </a>
</div>
<div style="background-color:#f8f9fa; height:4px; width:100%;"></div>`;

const DEFAULT_FOOTER = `<div style="background-color:#f8f9fa; border-top:1px solid #e9ecef; padding:20px 32px; text-align:center; font-family:Arial,sans-serif; margin-top:0;">
  <a href="https://grupojiro.com/">
    <img src="https://movi.digital/wp-content/uploads/elementor/thumbs/JIRO-removebg-preview-q7jqo7rw54f9czhmjfhpfn83yk55ykwwarsblzb0u8.png" alt="Grupo JIRO" style="max-height:28px; max-width:120px; opacity:0.65; object-fit:contain; display:block; margin:0 auto 10px;" />
  </a>
  <p style="margin:0; font-size:11px; color:#9ca3af; line-height:1.6;">
    Este mensaje fue enviado automaticamente por MOVI Digital.<br/>
    Si tienes preguntas, contacta a tu gerente.
  </p>
  <p style="margin:6px 0 0; font-size:10px; color:#d1d5db;">
    &copy; 2026 Grupo JIRO. Todos los derechos reservados.
  </p>
</div>`;

const SAMPLE_BODY = `<h2 style="margin:0 0 12px; font-size:20px; color:#1a1a1a;">Notificacion de ejemplo</h2>
<p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.6;">
  Este es el <strong>cuerpo del mensaje</strong> de una notificacion transaccional. El header y footer de arriba y abajo son los que configuras aqui.
</p>
<p style="margin:0; font-size:14px; color:#6b7280;">Saludos,<br/>El equipo de MOVI Digital</p>`;

const EMPTY_EMAIL_CHANNEL: Omit<NotificationChannel, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  description: '',
  type: 'email_resend',
  provider: 'resend',
  config: { api_key: '', from_email: '', from_name: '', reply_to: '', domain: '' },
  branding: { logo_url: '', primary_color: '#0b2d6b', secondary_color: '#5b78ff', header_html: '', footer_html: '', legal_text: '' },
  is_active: true,
  is_default: false,
};

const EMPTY_WA_CHANNEL: Omit<NotificationChannel, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  description: '',
  type: 'whatsapp_wazzup24',
  provider: 'wazzup24',
  config: { api_key: '', channel_id: '', phone_label: '' },
  branding: {},
  is_active: true,
  is_default: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskSecret(val: string): string {
  if (!val || val.length < 8) return val ? '••••••••' : '';
  return val.slice(0, 4) + '••••' + val.slice(-4);
}

function typeLabel(type: ChannelType) {
  return type === 'email_resend' ? 'Correo / Resend' : 'WhatsApp / Wazzup24';
}

function buildPreviewHtml(headerHtml: string, footerHtml: string): string {
  return `<!DOCTYPE html>
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
          <tr><td style="padding:32px;">${SAMPLE_BODY}</td></tr>
          <tr><td>${footerHtml}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── HTML + Preview Editor ────────────────────────────────────────────────────

type HtmlSection = 'header' | 'footer';
type ViewMode = 'code' | 'preview';

interface HtmlEditorProps {
  headerHtml: string;
  footerHtml: string;
  onChange: (section: HtmlSection, value: string) => void;
  onRestoreDefaults: () => void;
}

function HtmlEditor({ headerHtml, footerHtml, onChange, onRestoreDefaults }: HtmlEditorProps) {
  const [section, setSection] = useState<HtmlSection>('header');
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [previewOpen, setPreviewOpen] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentValue = section === 'header' ? headerHtml : footerHtml;

  useEffect(() => {
    if (previewOpen && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(buildPreviewHtml(headerHtml, footerHtml));
        doc.close();
      }
    }
  }, [headerHtml, footerHtml, previewOpen]);

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-500/8 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs">
        <Layout className="w-4 h-4 mt-0.5 shrink-0" />
        <span>El header y footer se inyectan automaticamente en todos los correos enviados por este canal. Estructura: <strong>Header → Cuerpo → Footer</strong>.</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Editor column */}
        <div className="space-y-3">
          {/* Section tabs */}
          <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-1">
            {(['header', 'footer'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSection(s)}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${section === s ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              >
                {s === 'header' ? 'Header (Encabezado)' : 'Footer (Pie de página)'}
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-1 w-fit">
            <button
              type="button"
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'code' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
            >
              <Code className="w-3.5 h-3.5" /> HTML
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'preview' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
            >
              <Eye className="w-3.5 h-3.5" /> Vista fragmento
            </button>
          </div>

          {viewMode === 'code' ? (
            <div className="relative">
              <textarea
                value={currentValue}
                onChange={e => onChange(section, e.target.value)}
                rows={16}
                spellCheck={false}
                className="w-full font-mono text-xs border border-[var(--border)] rounded-xl p-3 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-y bg-neutral-950 text-emerald-400 leading-relaxed"
                placeholder={`Escribe el HTML del ${section}...`}
              />
              <div className="absolute bottom-2 right-2 text-[10px] text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded">
                {currentValue.length} chars
              </div>
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-secondary)] min-h-[200px]">
              <div
                className="p-2"
                dangerouslySetInnerHTML={{ __html: currentValue }}
              />
              {!currentValue.trim() && (
                <p className="text-xs text-[var(--text-tertiary)] text-center py-8">Sin contenido</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onRestoreDefaults}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar valores MOVI por defecto
          </button>
        </div>

        {/* Preview column */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setPreviewOpen(o => !o)}
            className="flex items-center justify-between w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
              Vista previa del correo completo
            </div>
            {previewOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {previewOpen && (
            <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-neutral-100">
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
                style={{ height: '420px' }}
                onLoad={() => {
                  const doc = iframeRef.current?.contentDocument;
                  if (doc) {
                    doc.open();
                    doc.write(buildPreviewHtml(headerHtml, footerHtml));
                    doc.close();
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Channel Form ─────────────────────────────────────────────────────────────

interface ChannelFormProps {
  channel: Partial<NotificationChannel> & { config: Record<string, string>; branding: Record<string, string> };
  onChange: (c: typeof channel) => void;
  isNew: boolean;
}

function ChannelForm({ channel, onChange, isNew }: ChannelFormProps) {
  const [showKey, setShowKey] = useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);

  const set = (field: string, val: unknown) => onChange({ ...channel, [field]: val });
  const setConfig = (k: string, v: string) => onChange({ ...channel, config: { ...channel.config, [k]: v } });
  const setBranding = (k: string, v: string) => onChange({ ...channel, branding: { ...channel.branding, [k]: v } });

  const isEmail = channel.type === 'email_resend';

  function handleRestoreDefaults() {
    onChange({
      ...channel,
      branding: {
        ...channel.branding,
        header_html: DEFAULT_HEADER,
        footer_html: DEFAULT_FOOTER,
      },
    });
  }

  return (
    <div className="space-y-5">
      {/* Base fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Nombre del canal *</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder={isEmail ? 'Correo MOVI' : 'WhatsApp Seguwallet'}
            value={channel.name || ''}
            onChange={e => set('name', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Descripción interna</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder="Uso interno / notas"
            value={channel.description || ''}
            onChange={e => set('description', e.target.value)}
          />
        </div>
      </div>

      {/* Config fields */}
      {isEmail ? (
        <>
          {/* API Key */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              API Key de Resend *
              {!isNew && channel.config.api_key && (
                <span className="ml-2 font-normal text-amber-500">(dejar vacío para conservar actual)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder={isNew ? 're_xxxxxxxxxxxxxxxx' : maskSecret(channel.config.api_key || '')}
                value={channel.config.api_key || ''}
                onChange={e => setConfig('api_key', e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                onClick={() => setShowKey(s => !s)}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Email remitente *</label>
              <input
                type="email"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="noreply@tudominio.com"
                value={channel.config.from_email || ''}
                onChange={e => setConfig('from_email', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Nombre remitente *</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="MOVI Digital"
                value={channel.config.from_name || ''}
                onChange={e => setConfig('from_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Reply-to (opcional)</label>
              <input
                type="email"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="soporte@tudominio.com"
                value={channel.config.reply_to || ''}
                onChange={e => setConfig('reply_to', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Dominio verificado</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="tudominio.com"
                value={channel.config.domain || ''}
                onChange={e => setConfig('domain', e.target.value)}
              />
            </div>
          </div>

          {/* Branding collapsible */}
          <div className="border border-[var(--border)] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setBrandingOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] text-sm font-semibold text-[var(--text-primary)]"
            >
              <span>Branding del canal (logo, colores, header/footer HTML)</span>
              {brandingOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {brandingOpen && (
              <div className="p-4 space-y-5">
                {/* Logo + colors */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">URL del logo</label>
                    <input
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      placeholder="https://..."
                      value={channel.branding.logo_url || ''}
                      onChange={e => setBranding('logo_url', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Color primario</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        className="h-9 w-10 rounded border border-[var(--border)] cursor-pointer"
                        value={channel.branding.primary_color || '#0b2d6b'}
                        onChange={e => setBranding('primary_color', e.target.value)}
                      />
                      <input
                        className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        value={channel.branding.primary_color || '#0b2d6b'}
                        onChange={e => setBranding('primary_color', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Color secundario</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        className="h-9 w-10 rounded border border-[var(--border)] cursor-pointer"
                        value={channel.branding.secondary_color || '#5b78ff'}
                        onChange={e => setBranding('secondary_color', e.target.value)}
                      />
                      <input
                        className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        value={channel.branding.secondary_color || '#5b78ff'}
                        onChange={e => setBranding('secondary_color', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Legal text */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Texto legal (pie de página)</label>
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="© 2026 Grupo JIRO. Todos los derechos reservados."
                    value={channel.branding.legal_text || ''}
                    onChange={e => setBranding('legal_text', e.target.value)}
                  />
                </div>

                {/* HTML editor */}
                <div className="border-t border-[var(--border)] pt-4">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mb-3">Header y Footer HTML del correo</p>
                  <HtmlEditor
                    headerHtml={channel.branding.header_html || ''}
                    footerHtml={channel.branding.footer_html || ''}
                    onChange={(section, value) => setBranding(section === 'header' ? 'header_html' : 'footer_html', value)}
                    onRestoreDefaults={handleRestoreDefaults}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* WhatsApp fields */
        <>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              API Key Wazzup24 *
              {!isNew && channel.config.api_key && (
                <span className="ml-2 font-normal text-amber-500">(dejar vacío para conservar actual)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder={isNew ? 'wz_xxxxxxxxxxxxxxxx' : maskSecret(channel.config.api_key || '')}
                value={channel.config.api_key || ''}
                onChange={e => setConfig('api_key', e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                onClick={() => setShowKey(s => !s)}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Channel ID / Integración *</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={channel.config.channel_id || ''}
                onChange={e => setConfig('channel_id', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Número / Etiqueta visible</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="5215588545516 o MOVI WhatsApp"
                value={channel.config.phone_label || ''}
                onChange={e => setConfig('phone_label', e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      {/* Toggles */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={channel.is_active}
            onChange={e => set('is_active', e.target.checked)}
            className="w-4 h-4 rounded accent-[var(--accent)]"
          />
          <span className="text-sm text-[var(--text-primary)]">Canal activo</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={channel.is_default}
            onChange={e => set('is_default', e.target.checked)}
            className="w-4 h-4 rounded accent-amber-500"
          />
          <span className="text-sm text-[var(--text-primary)]">Canal por defecto</span>
        </label>
      </div>
    </div>
  );
}

// ─── Test Panel ───────────────────────────────────────────────────────────────

function TestPanel({ channel, onClose }: { channel: NotificationChannel; onClose: () => void }) {
  const [target, setTarget] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  async function handleTest() {
    if (!target) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/test-notification-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ channel_id: channel.id, target }),
      });
      const data = await res.json();
      setResult({ ok: data.success ?? res.ok, msg: data.message || (res.ok ? 'Enviado correctamente' : data.error || 'Error desconocido') });
    } catch {
      setResult({ ok: false, msg: 'Error de conexión' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-primary)] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-base font-bold text-[var(--text-primary)]">Probar canal: {channel.name}</h3>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
            {channel.type === 'email_resend' ? 'Email de destino' : 'Número WhatsApp (10 dígitos)'}
          </label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder={channel.type === 'email_resend' ? 'test@ejemplo.com' : '5511234567'}
            value={target}
            onChange={e => setTarget(e.target.value)}
          />
        </div>
        {result && (
          <div className={`px-3 py-2 rounded-lg text-sm ${result.ok ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
            {result.msg}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
            Cerrar
          </button>
          <button
            onClick={handleTest}
            disabled={!target || sending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar prueba
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Channel Card ─────────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleDefault,
  onTest,
}: {
  channel: NotificationChannel;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onToggleDefault: () => void;
  onTest: () => void;
}) {
  const isEmail = channel.type === 'email_resend';
  const Icon = isEmail ? Mail : MessageCircle;
  const iconColor = isEmail ? 'text-blue-500' : 'text-green-500';
  const iconBg = isEmail ? 'bg-blue-500/10' : 'bg-green-500/10';
  const hasHtmlBranding = isEmail && (channel.branding?.header_html || channel.branding?.footer_html);

  return (
    <div className={`relative rounded-2xl border p-5 transition-all ${channel.is_active ? 'border-[var(--border)] bg-[var(--bg-primary)]' : 'border-[var(--border)] bg-[var(--bg-secondary)] opacity-70'}`}>
      {channel.is_default && (
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-semibold uppercase tracking-wide">
            <Star className="w-3 h-3" /> Default
          </span>
        </div>
      )}

      <div className="flex items-start gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[var(--text-primary)] text-sm leading-tight">{channel.name}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{typeLabel(channel.type)}</div>
          {channel.description && (
            <div className="text-xs text-[var(--text-tertiary)] mt-1 line-clamp-1">{channel.description}</div>
          )}
        </div>
      </div>

      <div className="space-y-1 mb-4">
        {isEmail ? (
          <>
            {channel.config.from_email && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span className="text-[var(--text-tertiary)]">De:</span>
                <span className="font-medium truncate">{channel.config.from_name} &lt;{channel.config.from_email}&gt;</span>
              </div>
            )}
            {channel.config.api_key && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span className="text-[var(--text-tertiary)]">API Key:</span>
                <span className="font-mono">{maskSecret(channel.config.api_key)}</span>
              </div>
            )}
            {hasHtmlBranding && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <Layout className="w-3 h-3" />
                <span className="font-medium">Header/Footer HTML configurado</span>
              </div>
            )}
          </>
        ) : (
          <>
            {channel.config.phone_label && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span className="text-[var(--text-tertiary)]">Número:</span>
                <span className="font-medium">{channel.config.phone_label}</span>
              </div>
            )}
            {channel.config.channel_id && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span className="text-[var(--text-tertiary)]">Channel ID:</span>
                <span className="font-mono truncate">{channel.config.channel_id.slice(0, 8)}...</span>
              </div>
            )}
            {channel.config.api_key && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span className="text-[var(--text-tertiary)]">API Key:</span>
                <span className="font-mono">{maskSecret(channel.config.api_key)}</span>
              </div>
            )}
          </>
        )}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[var(--text-tertiary)]">Estado:</span>
          {channel.is_active ? (
            <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
              <CheckCircle className="w-3 h-3" /> Activo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[var(--text-tertiary)] font-semibold">
              <XCircle className="w-3 h-3" /> Inactivo
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--border)]">
        <button onClick={onTest} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors">
          <Send className="w-3.5 h-3.5" /> Probar
        </button>
        <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors">
          <Edit2 className="w-3.5 h-3.5" /> Editar
        </button>
        <button onClick={onToggleActive} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors">
          {channel.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
          {channel.is_active ? 'Desactivar' : 'Activar'}
        </button>
        <button
          onClick={onToggleDefault}
          disabled={channel.is_default}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${channel.is_default ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border)]'}`}
        >
          {channel.is_default ? <Star className="w-3.5 h-3.5" /> : <StarOff className="w-3.5 h-3.5" />}
          {channel.is_default ? 'Default' : 'Marcar default'}
        </button>
        <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors">
          <Trash2 className="w-3.5 h-3.5" /> Eliminar
        </button>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function ChannelModal({
  initial,
  onSave,
  onClose,
  loading,
  error,
}: {
  initial: Partial<NotificationChannel> & { config: Record<string, string>; branding: Record<string, string> };
  onSave: (data: typeof initial) => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState(initial);
  const isNew = !('id' in initial) || !initial.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-primary)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {isNew ? 'Nuevo canal' : `Editar: ${initial.name}`}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{typeLabel(form.type as ChannelType)}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1.5">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          <ChannelForm channel={form as any} onChange={setForm as any} isNew={isNew} />
        </div>

        <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form as any)}
            disabled={loading || !form.name}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Guardando...' : isNew ? 'Crear canal' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-primary)] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Eliminar canal</h3>
            <p className="text-xs text-[var(--text-secondary)]">Esta acción no se puede deshacer</p>
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          ¿Estás seguro de que quieres eliminar el canal <strong className="text-[var(--text-primary)]">{name}</strong>?
          Las plantillas que lo usen quedarán sin canal asignado (usarán el default).
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type FilterType = 'all' | 'email_resend' | 'whatsapp_wazzup24';

export function CanalesNotificacion() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const [modalData, setModalData] = useState<(Partial<NotificationChannel> & { config: Record<string, string>; branding: Record<string, string> }) | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [testChannel, setTestChannel] = useState<NotificationChannel | null>(null);
  const [deleteChannel, setDeleteChannel] = useState<NotificationChannel | null>(null);

  useEffect(() => { loadChannels(); }, []);

  async function loadChannels() {
    setLoading(true);
    const { data } = await supabase
      .from('notification_channels')
      .select('*')
      .order('created_at', { ascending: true });
    setChannels(data || []);
    setLoading(false);
  }

  function openNew(type: ChannelType) {
    setShowTypeSelector(false);
    setModalError(null);
    setModalData(type === 'email_resend'
      ? { ...EMPTY_EMAIL_CHANNEL }
      : { ...EMPTY_WA_CHANNEL });
  }

  function openEdit(ch: NotificationChannel) {
    setModalError(null);
    setModalData({ ...ch });
  }

  async function handleSave(form: Partial<NotificationChannel> & { config: Record<string, string>; branding: Record<string, string> }) {
    setModalLoading(true);
    setModalError(null);

    const isNew = !form.id;
    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description || null,
      type: form.type,
      provider: form.provider,
      config: form.config,
      branding: form.branding || {},
      is_active: form.is_active ?? true,
      is_default: form.is_default ?? false,
    };

    try {
      let err;
      if (isNew) {
        const { data: { user } } = await supabase.auth.getUser();
        payload.created_by = user?.id;
        payload.updated_by = user?.id;
        const res = await supabase.from('notification_channels').insert(payload);
        err = res.error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        payload.updated_by = user?.id;
        const res = await supabase.from('notification_channels').update(payload).eq('id', form.id);
        err = res.error;
      }

      if (err) { setModalError(err.message); return; }
      await loadChannels();
      setModalData(null);
    } finally {
      setModalLoading(false);
    }
  }

  async function handleToggleActive(ch: NotificationChannel) {
    await supabase.from('notification_channels').update({ is_active: !ch.is_active }).eq('id', ch.id);
    await loadChannels();
  }

  async function handleToggleDefault(ch: NotificationChannel) {
    if (ch.is_default) return;
    await supabase.from('notification_channels').update({ is_default: true }).eq('id', ch.id);
    await loadChannels();
  }

  async function handleDelete(ch: NotificationChannel) {
    await supabase.from('notification_channels').delete().eq('id', ch.id);
    setDeleteChannel(null);
    await loadChannels();
  }

  const filtered = channels.filter(c => filter === 'all' || c.type === filter);
  const emailChannels = channels.filter(c => c.type === 'email_resend');
  const waChannels = channels.filter(c => c.type === 'whatsapp_wazzup24');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Canales de Notificación</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Gestiona los canales de envío de correo (Resend) y WhatsApp (Wazzup24).
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowTypeSelector(s => !s)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow"
          >
            <Plus className="w-4 h-4" /> Nuevo canal
          </button>
          {showTypeSelector && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl z-20 overflow-hidden">
              <button onClick={() => openNew('email_resend')} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors text-sm text-left">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">Correo / Resend</div>
                  <div className="text-xs text-[var(--text-tertiary)]">Email transaccional</div>
                </div>
              </button>
              <div className="h-px bg-[var(--border)]" />
              <button onClick={() => openNew('whatsapp_wazzup24')} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors text-sm text-left">
                <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">WhatsApp / Wazzup24</div>
                  <div className="text-xs text-[var(--text-tertiary)]">Mensajería móvil</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total canales', value: channels.length, color: 'text-[var(--accent)]' },
          { label: 'Correo Resend', value: emailChannels.length, color: 'text-blue-500' },
          { label: 'WhatsApp Wazzup24', value: waChannels.length, color: 'text-green-500' },
          { label: 'Canales activos', value: channels.filter(c => c.is_active).length, color: 'text-emerald-500' },
        ].map((s, i) => (
          <div key={i} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)]">
            <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-xl p-1 w-fit">
        {([
          { key: 'all', label: 'Todos' },
          { key: 'email_resend', label: 'Correo / Resend' },
          { key: 'whatsapp_wazzup24', label: 'WhatsApp / Wazzup24' },
        ] as { key: FilterType; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === t.key ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Channels grid */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-tertiary)]">
          <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mx-auto mb-3">
            <Mail className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium">No hay canales configurados</p>
          <p className="text-xs mt-1">Crea tu primer canal con el botón "Nuevo canal"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(ch => (
            <ChannelCard
              key={ch.id}
              channel={ch}
              onEdit={() => openEdit(ch)}
              onDelete={() => setDeleteChannel(ch)}
              onToggleActive={() => handleToggleActive(ch)}
              onToggleDefault={() => handleToggleDefault(ch)}
              onTest={() => setTestChannel(ch)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modalData && (
        <ChannelModal
          initial={modalData}
          onSave={handleSave}
          onClose={() => setModalData(null)}
          loading={modalLoading}
          error={modalError}
        />
      )}
      {testChannel && (
        <TestPanel channel={testChannel} onClose={() => setTestChannel(null)} />
      )}
      {deleteChannel && (
        <ConfirmDeleteModal
          name={deleteChannel.name}
          onConfirm={() => handleDelete(deleteChannel)}
          onCancel={() => setDeleteChannel(null)}
        />
      )}

      {showTypeSelector && (
        <div className="fixed inset-0 z-10" onClick={() => setShowTypeSelector(false)} />
      )}
    </div>
  );
}
