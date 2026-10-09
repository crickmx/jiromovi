import React from 'react';
import {
  Globe,
  Plus,
  Sparkles,
  Layers,
  BookOpen,
  Bot,
  Library,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Zap,
  Sliders,
  LayoutTemplate
} from 'lucide-react';

const LOGO_URL = 'https://mekate.mx/wp-content/uploads/2021/05/Recurso-6.png';

export type StudioTab = 
  | 'sites' 
  | 'hermes_chat' 
  | 'block_builder' 
  | 'ai_wizard' 
  | 'brands' 
  | 'assets' 
  | 'robots' 
  | 'campaigns';

interface MekateSidebarProps {
  currentTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  onLogout: () => void;
  activeLandingCount: number;
}

export function MekateSidebar({ currentTab, onTabChange, onLogout, activeLandingCount }: MekateSidebarProps) {
  const navSections = [
    {
      label: 'Web Creator & Landings',
      accent: '#F97316',
      items: [
        { id: 'sites' as StudioTab, label: 'Mis Sitios & Landings', icon: Globe, count: activeLandingCount },
        { id: 'hermes_chat' as StudioTab, label: 'Creador Crick IA', icon: Sparkles, badge: 'IA Chat' },
        { id: 'block_builder' as StudioTab, label: 'Editor Visual de Bloques', icon: LayoutTemplate, badge: 'Bolt' },
        { id: 'ai_wizard' as StudioTab, label: 'Generador con IA', icon: Zap, badge: 'Wizard' },
      ],
    },
    {
      label: 'Content Factory',
      accent: '#10b981',
      items: [
        { id: 'brands' as StudioTab, label: 'Marcas & Logos', icon: BookOpen },
        { id: 'assets' as StudioTab, label: 'Assets & Media', icon: Layers },
        { id: 'robots' as StudioTab, label: 'Robots & Agentes', icon: Bot },
        { id: 'campaigns' as StudioTab, label: 'Campañas', icon: Library },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-[#0f0f0f] text-white flex flex-col h-full border-r border-[#222] select-none flex-shrink-0">
      
      {/* Header Logo Mekate Studio */}
      <div className="p-5 border-b border-[#1f1f1f] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={LOGO_URL}
            alt="Mekate Studio"
            className="h-8 w-auto object-contain brightness-110"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>Mekate Studio</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-gradient-to-r from-[#F97316] to-[#7E3AF2] text-white">
                v2.5
              </span>
            </h1>
            <p className="text-[10px] text-gray-400">landings.movi.digital</p>
          </div>
        </div>
      </div>

      {/* Navegación por Secciones */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navSections.map((sec, idx) => (
          <div key={idx} className="space-y-1.5">
            <div className="px-3 flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              <span>{sec.label}</span>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sec.accent }} />
            </div>

            <div className="space-y-1">
              {sec.items.map((item) => {
                const isActive = currentTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#1e1e1e] text-white shadow-sm border border-[#333]'
                        : 'text-gray-400 hover:text-white hover:bg-[#181818]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${isActive ? 'text-[#F97316]' : 'text-gray-400'}`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.count !== undefined && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#2a2a2a] text-gray-300 font-bold">
                        {item.count}
                      </span>
                    )}

                    {item.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Usuario y Salir */}
      <div className="p-4 border-t border-[#1f1f1f] bg-[#141414] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#F97316] to-[#7E3AF2] text-white flex items-center justify-center font-bold text-xs">
            C
          </div>
          <div>
            <p className="text-xs font-bold text-white truncate max-w-[120px]">Christofer CCJ</p>
            <p className="text-[10px] text-gray-400">Admin · Marsella 14</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Cerrar sesión"
          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-[#222] transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

    </aside>
  );
}
