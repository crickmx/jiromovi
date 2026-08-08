import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Copy,
  Code,
  Check,
  RefreshCw,
  CircleAlert as AlertCircle,
  Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type CopyKind = 'firma' | 'html';

export function MiFirmaEmail() {
  const { usuario } = useAuth();
  const [firmaHtml, setFirmaHtml] = useState('');
  const [firmaInfo, setFirmaInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<CopyKind | null>(null);

  const loadFirma = useCallback(async () => {
    if (!usuario?.id) return;

    setLoading(true);
    setError('');
    setFirmaHtml('');
    setFirmaInfo(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-firma`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ usuarioId: usuario.id }),
        }
      );

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Error ${response.status}: ${txt}`);
      }

      const result = await response.json();

      if (result.success && result.html) {
        setFirmaHtml(result.html);
        setFirmaInfo(result.info);
      } else {
        setError(result.error || 'Aún no tienes una firma asignada');
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar tu firma');
    } finally {
      setLoading(false);
    }
  }, [usuario?.id]);

  useEffect(() => {
    loadFirma();
  }, [loadFirma]);

  const flagCopied = (kind: CopyKind) => {
    setCopied(kind);
    setTimeout(() => setCopied((c) => (c === kind ? null : c)), 2500);
  };

  // Copia la firma con formato: al pegar en Gmail/Outlook conserva el diseño.
  const copiarFirma = async () => {
    if (!firmaHtml) return;
    try {
      const tmp = document.createElement('div');
      tmp.innerHTML = firmaHtml;
      const plain = (tmp.innerText || '').trim();

      if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([firmaHtml], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(firmaHtml);
      }
      flagCopied('firma');
    } catch {
      try {
        await navigator.clipboard.writeText(firmaHtml);
        flagCopied('firma');
      } catch {
        setError('Tu navegador no permitió copiar. Copia el HTML manualmente.');
      }
    }
  };

  // Copia el código HTML tal cual (para pegarlo en la configuración de firma del correo).
  const copiarHtml = async () => {
    if (!firmaHtml) return;
    try {
      await navigator.clipboard.writeText(firmaHtml);
      flagCopied('html');
    } catch {
      setError('Tu navegador no permitió copiar el HTML.');
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-neutral-100 rounded-lg">
            <Mail className="w-5 h-5 text-neutral-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Mi Firma para E-Mail</h3>
            <p className="text-sm text-neutral-500 mt-0.5">
              Esta es tu firma asignada. Cópiala y pégala en tu correo externo (Gmail, Outlook,
              etc.). Las imágenes se enlazan desde el sistema, así que no se rompen al enviarla.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadFirma}
          disabled={loading}
          title="Actualizar"
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-10 justify-center text-neutral-500 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Cargando tu firma…
        </div>
      )}

      {!loading && error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-0.5">No pudimos mostrar tu firma</p>
            <p>{error}</p>
            <p className="mt-1 text-amber-700">
              Si crees que deberías tener una firma, contacta a tu administrador.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && firmaHtml && (
        <div className="space-y-4">
          {/* Vista previa */}
          <div className="border border-neutral-200 rounded-xl overflow-hidden">
            <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                Vista previa
              </span>
              {firmaInfo?.template_nombre && (
                <span className="text-xs text-neutral-400">{firmaInfo.template_nombre}</span>
              )}
            </div>
            <div className="p-6 bg-white overflow-x-auto">
              <div dangerouslySetInnerHTML={{ __html: firmaHtml }} />
            </div>
          </div>

          {/* Acciones de copiado */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={copiarFirma}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {copied === 'firma' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === 'firma' ? '¡Firma copiada!' : 'Copiar firma'}
            </button>
            <button
              type="button"
              onClick={copiarHtml}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-neutral-50 text-neutral-700 text-sm font-medium rounded-lg border border-neutral-300 transition-colors"
            >
              {copied === 'html' ? <Check className="w-4 h-4" /> : <Code className="w-4 h-4" />}
              {copied === 'html' ? '¡HTML copiado!' : 'Copiar HTML'}
            </button>
          </div>

          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-neutral-600 leading-relaxed">
              <strong>Copiar firma</strong>: pégala directo al redactar o en la firma de tu correo y
              conserva el diseño. <strong>Copiar HTML</strong>: pega el código en la configuración de
              firma que pida HTML. Si actualizas tu logo o colores en Mi Marca / Mi Página Web,
              vuelve a copiarla para reflejar los cambios.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
