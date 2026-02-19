import { useState } from 'react';
import { Mail } from 'lucide-react';
import { PlantillasCorreo } from '../components/email/PlantillasCorreo';
import { EnvioManual } from '../components/email/EnvioManual';
import { ProgramacionAutomatica } from '../components/email/ProgramacionAutomatica';
import { HistorialCorreos } from '../components/email/HistorialCorreos';
import { ConfiguracionServidor } from '../components/email/ConfiguracionServidor';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'plantillas' | 'envio' | 'programacion' | 'historial' | 'servidor';

export function CentroCorreos() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';

  const [activeTab, setActiveTab] = useState<Tab>(isAdmin ? 'plantillas' : 'envio');

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex items-center space-x-3">
            <Mail className="w-8 h-8 text-white" />
            <div>
              <h1 className="text-2xl font-bold text-white">Centro de Correos</h1>
              <p className="text-primary-100 mt-1">Gestiona plantillas y envíos de correo electrónico</p>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200">
          <div className="flex px-8 overflow-x-auto">
            {isAdmin && (
              <button
                onClick={() => setActiveTab('plantillas')}
                className={`px-6 py-4 font-medium transition border-b-2 whitespace-nowrap ${
                  activeTab === 'plantillas'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-slate-600 hover:text-slate-800'
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
                  : 'border-transparent text-slate-600 hover:text-slate-800'
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
                      : 'border-transparent text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Programaciones automáticas
                </button>
                <button
                  onClick={() => setActiveTab('historial')}
                  className={`px-6 py-4 font-medium transition border-b-2 whitespace-nowrap ${
                    activeTab === 'historial'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Historial de envíos
                </button>
                <button
                  onClick={() => setActiveTab('servidor')}
                  className={`px-6 py-4 font-medium transition border-b-2 whitespace-nowrap ${
                    activeTab === 'servidor'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-slate-600 hover:text-slate-800'
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
