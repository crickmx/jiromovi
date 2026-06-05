import { useState } from 'react';
import { FileText, Shield, ExternalLink, Check, Eye } from 'lucide-react';
import type { TermsAcceptanceStatus } from '@/hooks/usePlatformTerms';

interface Props {
  status: TermsAcceptanceStatus;
  accepting: boolean;
  onAccept: () => void;
  platformName?: string;
}

export function TermsAcceptanceModal({ status, accepting, onAccept, platformName = 'MOVI Digital' }: Props) {
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [viewing, setViewing] = useState<'terminos' | 'privacidad' | null>(null);

  const canAccept = termsChecked && privacyChecked;
  const termsDoc = status.terminos.terms;
  const privacyDoc = status.privacidad.terms;

  if (viewing) {
    const doc = viewing === 'terminos' ? termsDoc : privacyDoc;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-5 border-b border-neutral-100 dark:border-white/8 flex items-center justify-between shrink-0">
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
              {doc?.titulo || (viewing === 'terminos' ? 'Términos y Condiciones' : 'Aviso de Privacidad')}
            </h2>
            <button
              onClick={() => setViewing(null)}
              className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-white/8 text-neutral-600 dark:text-white/60 text-sm font-medium hover:bg-neutral-200 transition-colors"
            >
              Cerrar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {doc ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: doc.contenido_html }}
              />
            ) : (
              <p className="text-neutral-400 text-sm">Contenido no disponible.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-4 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center">
            <FileText className="w-7 h-7 text-slate-600 dark:text-white/60" />
          </div>
          <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
            Términos y Condiciones
          </h1>
          <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
            Para continuar usando <strong>{platformName}</strong>, es necesario que aceptes nuestros términos actualizados.
          </p>
        </div>

        {/* Terms cards */}
        <div className="px-6 space-y-3">
          {/* Terms & Conditions */}
          {!status.terminos.accepted && termsDoc && (
            <div className="flex items-start gap-3 p-4 rounded-2xl border border-neutral-100 dark:border-white/8 bg-neutral-50/50 dark:bg-white/3">
              <button
                onClick={() => setTermsChecked(!termsChecked)}
                className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                  termsChecked
                    ? 'bg-slate-800 border-slate-800 text-white'
                    : 'border-neutral-300 dark:border-white/20 hover:border-neutral-400'
                }`}
              >
                {termsChecked && <Check className="w-3 h-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800 dark:text-white/90">
                  Acepto los Términos y Condiciones
                </p>
                <p className="text-xs text-neutral-400 dark:text-white/40 mt-0.5">
                  Versión {termsDoc.version} — Aplica para MOVI Digital, Seguwallet y Chava AI
                </p>
                <button
                  onClick={() => setViewing('terminos')}
                  className="flex items-center gap-1 mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                >
                  <Eye className="w-3 h-3" />
                  Leer términos completos
                </button>
              </div>
            </div>
          )}

          {/* Privacy Policy */}
          {!status.privacidad.accepted && privacyDoc && (
            <div className="flex items-start gap-3 p-4 rounded-2xl border border-neutral-100 dark:border-white/8 bg-neutral-50/50 dark:bg-white/3">
              <button
                onClick={() => setPrivacyChecked(!privacyChecked)}
                className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                  privacyChecked
                    ? 'bg-slate-800 border-slate-800 text-white'
                    : 'border-neutral-300 dark:border-white/20 hover:border-neutral-400'
                }`}
              >
                {privacyChecked && <Check className="w-3 h-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800 dark:text-white/90">
                  Acepto el Aviso de Privacidad
                </p>
                <p className="text-xs text-neutral-400 dark:text-white/40 mt-0.5">
                  Consulta el aviso completo en jiro.mx/privacidad
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => setViewing('privacidad')}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    <Eye className="w-3 h-3" />
                    Ver resumen
                  </button>
                  <a
                    href="https://jiro.mx/privacidad"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-neutral-500 dark:text-white/40 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                  >
                    <ExternalLink className="w-3 h-3" />
                    jiro.mx/privacidad
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Auto-check items already accepted */}
          {status.terminos.accepted && termsDoc && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Términos y Condiciones aceptados</p>
            </div>
          )}
          {status.privacidad.accepted && privacyDoc && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Aviso de Privacidad aceptado</p>
            </div>
          )}
        </div>

        {/* Action */}
        <div className="p-6 pt-5">
          <button
            onClick={onAccept}
            disabled={!canAccept || accepting}
            className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-bold hover:bg-slate-800 dark:hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {accepting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white dark:border-neutral-400/30 dark:border-t-neutral-900 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Aceptar y continuar
              </>
            )}
          </button>
          <p className="text-[11px] text-neutral-400 dark:text-white/30 text-center mt-3">
            Al aceptar, se registrará tu aceptación con fecha, hora e IP para fines de auditoría.
          </p>
        </div>
      </div>
    </div>
  );
}
