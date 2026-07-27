import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TareaReportePage() {
  const { tramiteId, campoId } = useParams<{ tramiteId: string; campoId: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-8 space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <div className="text-center space-y-2">
          <div className="text-4xl">🔒</div>
          <h1 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
            Editor de reporte protegido
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Próximamente — Fase 3
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
            tramite: {tramiteId} · campo: {campoId}
          </p>
        </div>
      </div>
    </div>
  );
}
