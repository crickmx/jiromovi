import React, { useState } from 'react';
import {
  Globe,
  Plus,
  Sparkles,
  LayoutTemplate,
  Zap,
  Eye,
  Settings,
  Trash2,
  Copy,
  ExternalLink,
  Search,
  CheckCircle2,
  Rocket,
  ShieldCheck,
  TrendingUp,
  FolderOpen
} from 'lucide-react';
import type { UnifiedLanding } from '../types';

interface UnifiedLandingListProps {
  landings: UnifiedLanding[];
  selectedLandingId: string;
  onSelectLanding: (id: string) => void;
  onOpenCrickIA: (id: string) => void;
  onOpenBlockBuilder: (id: string) => void;
  onOpenSettings: (landing: UnifiedLanding) => void;
  onOpenNewWizard: () => void;
  onDeleteLanding: (id: string) => void;
  onDeployLanding: (landing: UnifiedLanding) => void;
}

export function UnifiedLandingList({
  landings,
  selectedLandingId,
  onSelectLanding,
  onOpenCrickIA,
  onOpenBlockBuilder,
  onOpenSettings,
  onOpenNewWizard,
  onDeleteLanding,
  onDeployLanding
}: UnifiedLandingListProps) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(landings.map((l) => l.category)))];

  const filtered = landings.filter((l) => {
    const matchSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.slug.toLowerCase().includes(search.toLowerCase()) ||
      l.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || l.category === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#F8FAFC]">
      
      {/* Header Directorio Mekate Studio */}
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-[#F97316] mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mekate Studio & Landings Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Directorio de Páginas & Landings Activas
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Todas las páginas se compilan, sincronizan y publican en tiempo real en{' '}
              <strong className="text-gray-800">landings.movi.digital/[slug]</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenNewWizard}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#F97316] to-[#7E3AF2] shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Landing</span>
            </button>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por slug, nombre o categoría..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:bg-white transition-all text-gray-900"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === 'all' ? 'Todas' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Landings */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((landing) => {
            const isSelected = landing.id === selectedLandingId;
            return (
              <div
                key={landing.id}
                className={`rounded-3xl p-6 bg-white border transition-all duration-200 shadow-sm hover:shadow-xl flex flex-col justify-between relative group ${
                  isSelected ? 'border-[#F97316] ring-2 ring-[#F97316]/20' : 'border-gray-200'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-gray-100 text-gray-700">
                        {landing.category}
                      </span>
                      {landing.creationMode === 'crick_ia' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          ⚡ Crick IA
                        </span>
                      )}
                      {landing.creationMode === 'block_builder' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                          🧱 Bolt Blocks
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          landing.status === 'published'
                            ? 'bg-emerald-500'
                            : landing.status === 'modified'
                            ? 'bg-amber-500'
                            : 'bg-gray-400'
                        }`}
                      />
                      <span className="text-[11px] font-bold capitalize text-gray-600">
                        {landing.status === 'published' ? 'En Vivo' : landing.status === 'modified' ? 'Modificado' : 'Borrador'}
                      </span>
                    </div>
                  </div>

                  {/* Nombre y Slug */}
                  <h3 className="font-black text-xl text-gray-900 group-hover:text-[#F97316] transition-colors">
                    {landing.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-1 font-mono text-xs text-gray-500">
                    <span>{landing.slug}</span>
                    <a
                      href={landing.slug}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-700 p-0.5"
                      title="Abrir en pestaña nueva"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <p className="text-xs text-gray-600 mt-3 line-clamp-2 leading-relaxed">
                    {landing.description}
                  </p>

                  {/* Stats */}
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                    <div>
                      <span className="block text-gray-400 text-[10px]">Visitas</span>
                      <strong className="text-gray-800 font-bold">{landing.views.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="block text-gray-400 text-[10px]">Conversión</span>
                      <strong className="text-emerald-600 font-bold">{landing.conversion}</strong>
                    </div>
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onOpenCrickIA(landing.id)}
                      className="py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7E3AF2] font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border border-purple-200"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Crick IA Chat</span>
                    </button>

                    <button
                      onClick={() => onOpenBlockBuilder(landing.id)}
                      className="py-2.5 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#F97316] font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border border-orange-200"
                    >
                      <LayoutTemplate className="w-3.5 h-3.5" />
                      <span>Editor Bloques</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => onOpenSettings(landing)}
                      className="p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition flex items-center gap-1 text-xs font-semibold cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Ajustes</span>
                    </button>

                    <button
                      onClick={() => onDeployLanding(landing)}
                      className="px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Rocket className="w-3.5 h-3.5 text-[#F97316]" />
                      <span>Publicar</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
