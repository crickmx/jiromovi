import { useState } from 'react';
import { Mail, FileSignature, Users, Eye } from 'lucide-react';
import { PlantillasFirma } from '../components/firmas/PlantillasFirma';
import { AsignacionesFirma } from '../components/firmas/AsignacionesFirma';
import { VistaPreviaFirma } from '../components/firmas/VistaPreviaFirma';

type Tab = 'plantillas' | 'asignaciones' | 'vista-previa';

export function FirmasEmail() {
  const [activeTab, setActiveTab] = useState<Tab>('plantillas');

  const tabs = [
    { id: 'plantillas' as Tab, label: 'Plantillas', icon: FileSignature },
    { id: 'asignaciones' as Tab, label: 'Asignaciones', icon: Users },
    { id: 'vista-previa' as Tab, label: 'Vista Previa', icon: Eye }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-white">
                Gestor de Firmas de E-Mail
              </h1>
              <p className="text-primary-100 mt-1">
                Crea, asigna y gestiona firmas HTML profesionales para correos electrónicos
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-neutral-200 bg-neutral-50">
          <div className="flex space-x-1 px-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-4 font-semibold transition-all border-b-2 ${
                    isActive
                      ? 'border-accent text-accent bg-white'
                      : 'border-transparent text-neutral-600 hover:text-accent hover:bg-white/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
        {activeTab === 'plantillas' && <PlantillasFirma />}
        {activeTab === 'asignaciones' && <AsignacionesFirma />}
        {activeTab === 'vista-previa' && <VistaPreviaFirma />}
      </div>
    </div>
  );
}
