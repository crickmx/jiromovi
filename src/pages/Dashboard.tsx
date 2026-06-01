import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { DashboardHero } from '../components/dashboard/DashboardHero';
import { ChavaInsightsCard } from '../components/dashboard/ChavaInsightsCard';
import { WidgetGrid } from '../components/dashboard/WidgetGrid';
import { AccesosRapidosWidget } from '../components/dashboard/DashboardWidgets';

export default function Dashboard() {
  useEffect(() => { document.title = 'Dashboard · MOVI Digital'; }, []);

  const { usuario } = useMoviAuth();
  const navigate = useNavigate();

  if (!usuario) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Hero: greeting, avatar, office */}
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
