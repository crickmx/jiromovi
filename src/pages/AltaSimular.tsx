// ============================================================================
// /alta/simular — Simulador de la sesión de Cincel (solo modo mock, sin
// credenciales reales). Reemplaza la UI alojada de Cincel para poder probar el
// flujo end-to-end. El wizard hace polling y completa el alta automáticamente
// según el resultado codificado en el id del documento (ver mockProvider.ts).
// ============================================================================

import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, Check } from 'lucide-react';

const MARCA = '#164281';

export default function AltaSimular() {
  const [params] = useSearchParams();
  const doc = params.get('doc') || '';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center shadow-sm">
        <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: `${MARCA}15`, color: MARCA }}>
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Simulador de verificación y firma</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Estás en <strong>modo de prueba</strong> (sin credenciales reales de Cincel). En producción,
          aquí capturarías tu INE, tu selfie con prueba de vida y firmarías el contrato.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 mb-5">
          <Check className="w-4 h-4" /> Identidad y firma simuladas como exitosas
        </div>
        <p className="text-xs text-gray-400 mb-6">
          Puedes cerrar esta pestaña. Tu alta se completará automáticamente en la ventana anterior.
        </p>
        <button onClick={() => window.close()} className="px-5 py-2.5 text-sm font-medium text-white rounded-lg" style={{ background: MARCA }}>
          Cerrar y volver
        </button>
        {doc && <p className="mt-4 text-[10px] font-mono text-gray-300 break-all">{doc}</p>}
      </div>
    </div>
  );
}
