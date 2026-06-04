import { useEffect, useState } from 'react';
import { X, FlaskConical } from 'lucide-react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { DashboardHero } from '../components/dashboard/DashboardHero';
import { ChavaInsightsCard } from '../components/dashboard/ChavaInsightsCard';
import { WidgetGrid } from '../components/dashboard/WidgetGrid';
import { AccesosRapidosWidget } from '../components/dashboard/DashboardWidgets';

export default function Dashboard() {
  useEffect(() => { document.title = 'Dashboard · MOVI Digital'; }, []);

  const { usuario } = useMoviAuth();
  const [betaDismissed, setBetaDismissed] = useState(() =>
    sessionStorage.getItem('movi_beta_dismissed') === '1'
  );

  const dismissBeta = () => {
    sessionStorage.setItem('movi_beta_dismissed', '1');
    setBetaDismissed(true);
  };

  if (!usuario) return null;

  return (
    <div className="space-y-6 pb-8">
      {/* Beta notice */}
      {!betaDismissed && (
        <div className="relative flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 px-4 py-3 text-sm">
          <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-amber-800 dark:text-amber-300 leading-snug">
            <span className="font-semibold">MOVI Digital se encuentra en Beta.</span>{' '}
            Es posible que experimentes fallas o comportamientos inesperados. Si encuentras algun problema, contacta al equipo de soporte.
          </p>
          <button
            onClick={dismissBeta}
            aria-label="Cerrar aviso beta"
            className="ml-auto flex-shrink-0 rounded-md p-1 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <DashboardHero usuario={usuario} />

      {/* Chava AI Insights */}
      <ChavaInsightsCard usuario={usuario} />

      {/* Accesos Rápidos — always pinned after Chava */}
      <AccesosRapidosWidget usuario={usuario} />

      {/* Modular widget grid — skips chava_insights and accesos_rapidos */}
      <WidgetGrid usuario={usuario} />
    </div>
  );
}
