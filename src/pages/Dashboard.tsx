import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui/page-header';
import { HomeDashboardSummary } from '../components/home/HomeDashboardSummary';
import { TramitesWidget } from '../components/TramitesWidget';
import { UltimoComunicado } from '../components/UltimoComunicado';
import ProgresoGamificacion from '../components/ProgresoGamificacion';

export default function Dashboard() {
  useEffect(() => { document.title = 'Dashboard · MOVI Digital'; }, []);

  const { usuario } = useMoviAuth();
  const navigate = useNavigate();

  if (!usuario) {
    navigate('/login', { replace: true });
    return null;
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  return (
    <Layout>
      <PageHeader
        title={`${getGreeting()}, ${usuario.nombre || 'Agente'}`}
        subtitle="Aquí tienes un resumen de tu actividad reciente."
      />

      <div className="space-y-6 mt-6">
        <HomeDashboardSummary userId={usuario.id} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TramitesWidget />
          <UltimoComunicado />
        </div>

        <ProgresoGamificacion />
      </div>
    </Layout>
  );
}
