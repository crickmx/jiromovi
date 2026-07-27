import { useRef, useState } from 'react';
import { X, Lock, Loader2, AlertTriangle, Eye, EyeOff, Download, CheckCircle, XCircle, Clock, Smartphone, Monitor, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  tramiteId: string;
  campoId: string;
  campoLabel: string;
  onClose: () => void;
}

export default function TOTPDecryptModal({ tramiteId, campoId, campoLabel, onClose }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [texto, setTexto] = useState<string | null>(null);
  const [showText, setShowText] = useState(true);
  const [meta, setMeta] = useState<{ tiempo_segundos: number | null; score_humano: number | null; chars_pegados: number | null; dispositivo: string | null } | null>(null);
  const [palabras, setPalabras] = useState<number | null>(null);
  const [enviadoEn, setEnviadoEn] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function descifrar() {
    if (code.length !== 6) { setErrMsg('Ingresa los 6 dígitos'); return; }
    setLoading(true);
    setErrMsg('');

    const { data, error } = await supabase.functions.invoke('descifrar-reporte-protegido', {
      body: { tramite_id: tramiteId, campo_id: campoId, codigo_totp: code },
    });

    setLoading(false);
    if (error || !data?.texto) {
      setErrMsg(data?.error ?? 'Error al descifrar. Verifica tu código.');
      setCode('');
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    setTexto(data.texto);
    setMeta(data.meta ?? null);
    setPalabras(data.palabras ?? null);
    setEnviadoEn(data.enviado_en ?? null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-violet-500" />
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{campoLabel}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {texto === null ? (
            // ── Code entry ────────────────────────────────────────────────────
            <>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Ingresa el código de tu autenticador para ver el contenido.
              </p>
              <input
                ref={inputRef}
                autoFocus
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setErrMsg(''); }}
                onKeyDown={e => e.key === 'Enter' && descifrar()}
                placeholder="000000"
                className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              {errMsg && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />{errMsg}
                </div>
              )}
              <button
                onClick={descifrar}
                disabled={code.length !== 6 || loading}
                className="w-full py-2.5 bg-violet-600 text-white text-sm rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Descifrando…</> : 'Ver reporte'}
              </button>
            </>
          ) : (
            // ── Decrypted text ─────────────────────────────────────────────────
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Reporte descifrado</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const blob = new Blob([texto!], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${campoLabel.replace(/\s+/g, '_')}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" /> Descargar
                  </button>
                  <button
                    onClick={() => setShowText(v => !v)}
                    className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  >
                    {showText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showText ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div className={`rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 p-4 max-h-60 overflow-y-auto transition-all ${!showText ? 'filter blur-sm select-none' : ''}`}>
                <p className="text-sm text-neutral-800 dark:text-neutral-100 whitespace-pre-wrap leading-relaxed">{texto}</p>
              </div>

              {/* Metadatos de verificación */}
              {meta && (
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/40 p-3 space-y-2">
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Verificación anti-trampa</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">

                    {/* Palabras */}
                    {palabras != null && (
                      <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                        <Shield className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{palabras} palabras</span>
                      </div>
                    )}

                    {/* Tiempo */}
                    {meta.tiempo_segundos != null && (
                      <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                        <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{meta.tiempo_segundos < 60
                          ? `${meta.tiempo_segundos}s`
                          : `${Math.floor(meta.tiempo_segundos / 60)}m ${meta.tiempo_segundos % 60}s`}
                        </span>
                      </div>
                    )}

                    {/* Dispositivo */}
                    {meta.dispositivo && (
                      <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                        {meta.dispositivo === 'móvil'
                          ? <Smartphone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          : <Monitor className="w-3.5 h-3.5 text-neutral-400 shrink-0" />}
                        <span className="capitalize">{meta.dispositivo}</span>
                      </div>
                    )}

                    {/* Score de originalidad */}
                    {meta.score_humano != null && (
                      <div className="flex items-center gap-1.5">
                        {meta.score_humano >= 0.7
                          ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        <span className={meta.score_humano >= 0.7 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                          {Math.round(meta.score_humano * 100)}% original
                        </span>
                      </div>
                    )}

                    {/* Caracteres pegados */}
                    {meta.chars_pegados != null && meta.chars_pegados > 0 && (
                      <div className="col-span-2 flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{meta.chars_pegados} caracteres pegados detectados</span>
                      </div>
                    )}

                    {/* Fecha de envío */}
                    {enviadoEn && (
                      <div className="col-span-2 text-neutral-400 text-[11px]">
                        Enviado: {new Date(enviadoEn).toLocaleString('es-MX')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-neutral-400 text-center">Esta vista no se guarda. Cierra para ocultarla.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
