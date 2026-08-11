// ============================================================================
// Admin > Contratos de Registro AT — sube el PDF base de cada tipo de agente
// al bucket privado (via edge function alta-subir-contrato, solo Administrador).
// El flujo de alta usa estos contratos para la firma (SignWell).
// ============================================================================

import { useState } from 'react';
import { Upload, Check, Loader as Loader2, CircleAlert as AlertCircle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

const TIPOS: { tipo: 'con_cedula' | 'en_desarrollo'; titulo: string; desc: string }[] = [
  { tipo: 'con_cedula', titulo: 'Agente con Cédula', desc: 'Contrato de agente (MACHOTE CONTRATO AGENTES).' },
  { tipo: 'en_desarrollo', titulo: 'Agente en Desarrollo (Promotor)', desc: 'Contrato de promotor (MACHOTE CONTRATO PROMOTOR).' },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

export default function AdminContratosAlta() {
  const [estado, setEstado] = useState<Record<string, 'idle' | 'subiendo' | 'ok' | 'error'>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});

  async function subir(tipo: string, file: File | null) {
    if (!file) return;
    if (file.type !== 'application/pdf') { setEstado((p) => ({ ...p, [tipo]: 'error' })); setMsg((p) => ({ ...p, [tipo]: 'Debe ser un PDF' })); return; }
    setEstado((p) => ({ ...p, [tipo]: 'subiendo' })); setMsg((p) => ({ ...p, [tipo]: '' }));
    try {
      const pdf_base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('alta-subir-contrato', { body: { tipo, pdf_base64 } });
      if (error || (data as { error?: string })?.error) {
        throw new Error((data as { error?: string })?.error || error?.message || 'Error');
      }
      setEstado((p) => ({ ...p, [tipo]: 'ok' })); setMsg((p) => ({ ...p, [tipo]: `Subido (${Math.round((data as { bytes: number }).bytes / 1024)} KB)` }));
    } catch (e) {
      setEstado((p) => ({ ...p, [tipo]: 'error' })); setMsg((p) => ({ ...p, [tipo]: (e as Error).message }));
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Contratos de Registro AT</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Sube el PDF base de cada tipo de agente. Se usa para la firma del contrato en el alta (/registro-at). Reemplaza el anterior al subir uno nuevo.
        </p>
      </div>

      {TIPOS.map((t) => {
        const st = estado[t.tipo] || 'idle';
        return (
          <div key={t.tipo} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500"><FileText className="w-5 h-5" /></div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">{t.titulo}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</p>
              </div>
            </div>
            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              st === 'ok' ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${st === 'ok' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                {st === 'subiendo' ? <Loader2 className="w-4 h-4 animate-spin" /> : st === 'ok' ? <Check className="w-4 h-4" /> : st === 'error' ? <AlertCircle className="w-4 h-4 text-red-500" /> : <Upload className="w-4 h-4" />}
              </div>
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">
                {st === 'ok' ? 'Contrato cargado' : st === 'subiendo' ? 'Subiendo…' : 'Elegir PDF'}
              </span>
              <input type="file" accept="application/pdf" className="hidden" disabled={st === 'subiendo'}
                onChange={(e) => subir(t.tipo, e.target.files?.[0] || null)} />
            </label>
            {msg[t.tipo] && <p className={`mt-2 text-xs ${st === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>{msg[t.tipo]}</p>}
          </div>
        );
      })}
    </div>
  );
}
