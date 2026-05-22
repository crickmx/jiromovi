import { useState } from 'react';
import { Mail } from 'lucide-react';
import { PlantillasCorreo } from '../components/email/PlantillasCorreo';
import { EnvioManual } from '../components/email/EnvioManual';
import { ProgramacionAutomatica } from '../components/email/ProgramacionAutomatica';
import { HistorialCorreos } from '../components/email/HistorialCorreos';
import { ConfiguracionServidor } from '../components/email/ConfiguracionServidor';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';

type Tab = 'plantillas' | 'envio' | 'programacion' | 'historial' | 'servidor';

export function CentroCorreos() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';

  const [activeTab, setActiveTab] = useState<Tab>(isAdmin ? 'plantillas' : 'envio');

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden">
        <PageHeader
          title="Centro de Correos"
          description="Gestiona plantillas y envíos de correo electrónico"
          icon={Mail}
        />

        <div className="border-b border-neutral-200 dark:border-white/10">
          <div className="flex px-8 overflow-x-auto">
            {isAdmin && (
              <button
                onClick={() => setActiveTab('plantillas')}
                className={`px-6 py-4 font-medium transition border-b-2 whitespace-nowrap ${
                  activeTab === 'plantillas'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-neutral-600 dark:text-white/60 hover:text-neutral-800 dark:hover:text-white/80'
                }`}
              >
                Plantillas de correo
              </button>
            )}
            <button
              onClick={() => setActiveTab('envio')}
              className={`px-6 py-4 font-medium transition border-b-2 whitespace-nowrap ${
                activeTab === 'envio'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-neutral-600 dark:text-white/60 hover:text-neutral-800 dark:hover:text-white/80'
              }`}
            >
              Envío manual
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('programacion')}
                  className={`px-6 py-4 font-medium transition border-b-2 whitespace-nowrap ${
                    activeTab === 'programacion'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-neutral-600 dark:text-white/60 hover:text-neutral-800 dark:hover:text-white/80'
                  }`}
                >
                  Programaciones automáticas
                </button>
                <button
                  onClick={() => setActiveTab('historial')}
                  className={`px-6 py-4 font-medium transition border-b-2 whitespace-nowrap ${
                    activeTab === 'historial'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-neutral-600 dark:text-white/60 hover:text-neutral-800 dark:hover:text-white/80'
                  }`}
                >
                  Historial de envíos
                </button>
                <button
                  onClick={() => setActiveTab('servidor')}
                  className={`px-6 py-4 font-medium transition border-b-2 whitespace-nowrap ${
                    activeTab === 'servidor'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-neutral-600 dark:text-white/60 hover:text-neutral-800 dark:hover:text-white/80'
                  }`}
                >
                  Configuración de servidor
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-8">
          {activeTab === 'plantillas' && isAdmin && <PlantillasCorreo />}
          {activeTab === 'envio' && <EnvioManual />}
          {activeTab === 'programacion' && isAdmin && <ProgramacionAutomatica />}
          {activeTab === 'historial' && isAdmin && <HistorialCorreos />}
          {activeTab === 'servidor' && isAdmin && <ConfiguracionServidor />}
        </div>
      </div>
    </div>
  );
}
