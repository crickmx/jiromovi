import { useState } from 'react';
import { Mail, Ligature as FileSignature, Users, Eye } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
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
      <PageHeader
        title="Gestor de Firmas de E-Mail"
        description="Crea, asigna y gestiona firmas HTML profesionales para correos electrónicos"
        icon={Mail}
      />

      <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden">
        <div className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/3">
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
                      ? 'border-accent text-accent bg-white dark:bg-white/5'
                      : 'border-transparent text-neutral-600 dark:text-white/60 hover:text-accent hover:bg-white/50'
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

      <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 p-8">
        {activeTab === 'plantillas' && <PlantillasFirma />}
        {activeTab === 'asignaciones' && <AsignacionesFirma />}
        {activeTab === 'vista-previa' && <VistaPreviaFirma />}
      </div>
    </div>
  );
}
export default FirmasEmail;
