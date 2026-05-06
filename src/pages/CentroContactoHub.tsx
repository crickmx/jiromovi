import { useState, useMemo } from 'react';
import { MessageSquare, Headphones, Bell, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Chat } from './Chat';
import CentroContacto from './CentroContacto';
import { NotificacionesTransaccionales } from './NotificacionesTransaccionales';
import { CentroNotificacionesContent } from './CentroNotificaciones';
import { cn } from '@/lib/utils';

type TabKey = 'chat' | 'bandeja' | 'notificaciones' | 'transaccionales';

interface TabDef {
  key: TabKey;
  label: string;
  icon: typeof MessageSquare;
  show: boolean;
}

export default function CentroContactoHub() {
  const { usuario } = useAuth();

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const isEmpleado = usuario?.rol === 'Empleado';
  const isNotAgent = usuario?.rol !== 'Agente';

  const tabs: TabDef[] = useMemo(() => [
    { key: 'bandeja', label: 'Bandeja', icon: Headphones, show: isAdmin || isGerente || isEmpleado },
    { key: 'chat', label: 'Chat', icon: MessageSquare, show: isNotAgent },
    { key: 'notificaciones', label: 'Notificaciones', icon: Bell, show: isAdmin },
    { key: 'transaccionales', label: 'Transaccionales', icon: Mail, show: isAdmin },
  ], [isAdmin, isGerente, isEmpleado, isNotAgent]);

  const visibleTabs = tabs.filter(t => t.show);
  const [activeTab, setActiveTab] = useState<TabKey>(() => visibleTabs[0]?.key || 'chat');

  const currentTab = visibleTabs.find(t => t.key === activeTab) ? activeTab : (visibleTabs[0]?.key || 'chat');

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-6">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px" aria-label="Tabs">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:border-neutral-300"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {currentTab === 'chat' && <Chat />}
        {currentTab === 'bandeja' && <CentroContacto />}
        {currentTab === 'notificaciones' && <CentroNotificacionesContent />}
        {currentTab === 'transaccionales' && <NotificacionesTransaccionales />}
      </div>
    </div>
  );
}
