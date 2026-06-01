import { useState } from 'react';
import { X, RefreshCw, Copy, Check, Pencil, Undo2, Download, Sparkles, Loader as Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '@/components/ui/button';

interface AICopy {
  apertura: string;
  desarrollo: string;
  cta: string;
  firma: string;
  url_web: string;
  hashtags: string[];
}

interface Diseno {
  id: string;
  plantilla_id: string;
  archivo_resultante_url: string | null;
  created_at: string;
  ai_copy: AICopy | null;
  ai_copy_generated_at: string | null;
  ai_copy_version: number;
  ai_copy_editado_manual: boolean;
  ai_copy_original: AICopy | null;
  publicidad_plantillas?: {
    titulo: string | null;
    tipo: string;
    categoria: string;
    ramo: string;
  } | null;
}

interface DesignDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  diseno: Diseno;
  onUpdate: () => void;
}

export function DesignDetailModal({ isOpen, onClose, diseno, onUpdate }: DesignDetailModalProps) {
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedCopy, setEditedCopy] = useState<AICopy | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentCopy = editing ? editedCopy : diseno.ai_copy;

  const handleGenerateCopy = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-design-copy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ diseno_id: diseno.id }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error generating copy');
      }

      onUpdate();
    } catch (err: any) {
      alert(`Error al generar copy: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleStartEdit = () => {
    setEditedCopy(diseno.ai_copy ? { ...diseno.ai_copy } : null);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedCopy(null);
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editedCopy) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('publicidad_disenos')
        .update({
          ai_copy: editedCopy,
          ai_copy_editado_manual: true,
        })
        .eq('id', diseno.id);

      if (error) throw error;
      setEditing(false);
      onUpdate();
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreOriginal = async () => {
    if (!diseno.ai_copy_original) return;
    if (!confirm('Esto restaurara el copy original generado por IA. Los cambios manuales se perderan.')) return;

    try {
      const { error } = await supabase
        .from('publicidad_disenos')
        .update({
          ai_copy: diseno.ai_copy_original,
          ai_copy_editado_manual: false,
        })
        .eq('id', diseno.id);

      if (error) throw error;
      setEditing(false);
      onUpdate();
    } catch (err: any) {
      alert(`Error al restaurar: ${err.message}`);
    }
  };

  const handleCopyToClipboard = () => {
    if (!currentCopy) return;
    const fullText = [
      currentCopy.apertura,
      '',
      currentCopy.desarrollo,
      '',
      currentCopy.cta,
      '',
      currentCopy.firma,
      currentCopy.url_web ? `\n${currentCopy.url_web}` : '',
      '',
      currentCopy.hashtags?.map(h => `#${h.replace(/^#/, '')}`).join(' ') || '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!diseno.archivo_resultante_url) return;
    const link = document.createElement('a');
    link.href = diseno.archivo_resultante_url;
    link.download = `diseno-${diseno.id.slice(0, 8)}.png`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-white/8">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              {diseno.publicidad_plantillas?.titulo || 'Detalle del Diseno'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {diseno.publicidad_plantillas?.categoria && (
                <span className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-white/60 rounded-md">
                  {diseno.publicidad_plantillas.categoria}
                </span>
              )}
              {diseno.publicidad_plantillas?.ramo && (
                <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded-md">
                  {diseno.publicidad_plantillas.ramo}
                </span>
              )}
              <span className="text-xs text-neutral-400 dark:text-white/30">
                {new Date(diseno.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 text-neutral-500 dark:text-white/50" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0">
            {/* Image Preview */}
            <div className="p-5 flex items-center justify-center bg-neutral-50 dark:bg-neutral-800/30 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-white/8">
              <div className="relative w-full max-w-sm aspect-[4/5] rounded-lg overflow-hidden bg-white dark:bg-neutral-800 shadow-sm">
                {diseno.archivo_resultante_url ? (
                  <img
                    src={diseno.archivo_resultante_url}
                    alt="Diseno"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-300 dark:text-white/20">
                    <Sparkles className="w-16 h-16" />
                  </div>
                )}
              </div>
            </div>

            {/* Copy Section */}
            <div className="p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  Copy para Redes Sociales
                </h3>
                {diseno.ai_copy_editado_manual && (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-md">
                    Editado
                  </span>
                )}
              </div>

              {!currentCopy ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                  <Sparkles className="w-10 h-10 text-neutral-300 dark:text-white/20 mb-3" />
                  <p className="text-sm text-neutral-500 dark:text-white/50 mb-4">
                    Genera copy con IA para esta publicacion
                  </p>
                  <Button
                    onClick={handleGenerateCopy}
                    disabled={generating}
                  >
                    {generating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Generar Copy IA</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex-1 space-y-3">
                  {/* Apertura */}
                  <CopyField
                    label="Apertura"
                    value={currentCopy.apertura}
                    editing={editing}
                    onChange={(v) => setEditedCopy(prev => prev ? { ...prev, apertura: v } : null)}
                  />

                  {/* Desarrollo */}
                  <CopyField
                    label="Desarrollo"
                    value={currentCopy.desarrollo}
                    editing={editing}
                    onChange={(v) => setEditedCopy(prev => prev ? { ...prev, desarrollo: v } : null)}
                    multiline
                  />

                  {/* CTA */}
                  <CopyField
                    label="Llamada a la accion"
                    value={currentCopy.cta}
                    editing={editing}
                    onChange={(v) => setEditedCopy(prev => prev ? { ...prev, cta: v } : null)}
                  />

                  {/* Firma */}
                  <CopyField
                    label="Firma"
                    value={currentCopy.firma}
                    editing={editing}
                    onChange={(v) => setEditedCopy(prev => prev ? { ...prev, firma: v } : null)}
                  />

                  {/* URL */}
                  {currentCopy.url_web && (
                    <CopyField
                      label="URL Web"
                      value={currentCopy.url_web}
                      editing={editing}
                      onChange={(v) => setEditedCopy(prev => prev ? { ...prev, url_web: v } : null)}
                    />
                  )}

                  {/* Hashtags */}
                  <div>
                    <span className="text-xs font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider">
                      Hashtags
                    </span>
                    {editing ? (
                      <input
                        type="text"
                        value={currentCopy.hashtags?.map(h => `#${h.replace(/^#/, '')}`).join(' ') || ''}
                        onChange={(e) => {
                          const tags = e.target.value.split(/\s+/).map(t => t.replace(/^#/, '')).filter(Boolean);
                          setEditedCopy(prev => prev ? { ...prev, hashtags: tags } : null);
                        }}
                        className="mt-1 w-full px-3 py-1.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                      />
                    ) : (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {currentCopy.hashtags?.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded-md">
                            #{tag.replace(/^#/, '')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Version info */}
                  {diseno.ai_copy_version > 0 && (
                    <p className="text-xs text-neutral-400 dark:text-white/25 pt-2">
                      v{diseno.ai_copy_version} — generado {diseno.ai_copy_generated_at
                        ? new Date(diseno.ai_copy_generated_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-200 dark:border-white/8 bg-neutral-50 dark:bg-neutral-800/30">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Descargar Imagen
            </Button>
            {currentCopy && (
              <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
                {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                {copied ? 'Copiado' : 'Copiar Copy'}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentCopy && !editing && (
              <>
                {diseno.ai_copy_editado_manual && diseno.ai_copy_original && (
                  <Button variant="outline" size="sm" onClick={handleRestoreOriginal}>
                    <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                    Restaurar Original
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleStartEdit}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Editar
                </Button>
                <Button size="sm" onClick={handleGenerateCopy} disabled={generating}>
                  {generating ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Regenerando...</>
                  ) : (
                    <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerar Copy</>
                  )}
                </Button>
              </>
            )}
            {editing && (
              <>
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyField({ label, value, editing, onChange, multiline }: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider">
        {label}
      </span>
      {editing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="mt-1 w-full px-3 py-1.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        )
      ) : (
        <p className="mt-1 text-sm text-neutral-800 dark:text-white/80 leading-relaxed">
          {value}
        </p>
      )}
    </div>
  );
}
