import React, { useState } from 'react';
import {
  BookOpen,
  Layers,
  Bot,
  Library,
  Plus,
  Sparkles,
  ExternalLink,
  Download,
  Search,
  CheckCircle2,
  Trash2,
  Copy
} from 'lucide-react';

interface ContentFactoryViewProps {
  section: 'brands' | 'assets' | 'robots' | 'campaigns';
}

export function ContentFactoryView({ section }: ContentFactoryViewProps) {
  const [search, setSearch] = useState('');

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 mb-2">
              <Layers className="w-3.5 h-3.5" />
              <span>Mekate Content Factory</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight capitalize">
              {section === 'brands' && 'Marcas & Guías de Identidad'}
              {section === 'assets' && 'Biblioteca de Assets & Media'}
              {section === 'robots' && 'Robots & Agentes Especializados'}
              {section === 'campaigns' && 'Campañas & Contenido Generado'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Recursos centralizados y sincronizados para todas tus landings y campañas publicitarias.
            </p>
          </div>

          <button className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#F97316] to-[#7E3AF2] shadow-md flex items-center gap-2 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Nuevo Recurso</span>
          </button>
        </div>

        {/* Section Cards */}
        {section === 'brands' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Mutuus Salud', slug: 'mutuus', color: '#003896', accent: '#9CD41C', desc: 'Membresía médica y seguro de gastos médicos sin deducible.' },
              { name: 'Seguros Express', slug: 'seguros-express', color: '#D92F3C', accent: '#2563EB', desc: 'Emisión inmediata de seguros de auto en México.' },
              { name: 'Chava IA', slug: 'chava-agente', color: '#10B981', accent: '#3B82F6', desc: 'Asistente comercial inteligente para agentes de seguros.' },
              { name: 'Seguros Education', slug: 'seguros-education', color: '#6366F1', accent: '#F59E0B', desc: 'Portal de capacitación y acreditación para asesores.' },
            ].map((b, i) => (
              <div key={i} className="p-6 rounded-3xl bg-white border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base shadow-md" style={{ backgroundColor: b.color }}>
                    {b.name.charAt(0)}
                  </div>
                  <div className="flex gap-1.5">
                    <span className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: b.color }} title="Primario" />
                    <span className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: b.accent }} title="Acento" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">{b.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {section === 'assets' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { title: 'Hero Mutuus 3D Shield', type: 'PNG Transparente', tag: 'Render 3D' },
              { title: 'Logos Aseguradoras México', type: 'Vector SVG', tag: 'Logos' },
              { title: 'Mockup App Móvil', type: 'Figma Asset', tag: 'Mockup' },
              { title: 'Iconos Coberturas Médicas', type: 'Icon Set', tag: 'Iconos' },
            ].map((a, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-2">
                <div className="h-28 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 font-bold text-xs">
                  {a.tag}
                </div>
                <p className="font-bold text-xs text-gray-900 truncate">{a.title}</p>
                <p className="text-[10px] text-gray-400">{a.type}</p>
              </div>
            ))}
          </div>
        )}

        {section === 'robots' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: 'Hermes Copilot AI', role: 'Diseño Web & Optimización de Conversión', status: 'Activo 24/7', model: 'GPT-4o Mini / OpenRouter' },
              { name: 'Chava SDR Agent', role: 'Calificación de Prospectos & Leads', status: 'Activo 24/7', model: 'Chava AI Engine' },
            ].map((r, i) => (
              <div key={i} className="p-6 rounded-3xl bg-white border border-gray-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#7E3AF2] text-white flex items-center justify-center font-bold">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">{r.name}</h3>
                    <p className="text-xs text-gray-500">{r.role}</p>
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      ● {r.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {section === 'campaigns' && (
          <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 space-y-3">
            <Library className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="font-bold text-base text-gray-900">Campañas Publicitarias</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Genera copies y gráficos automáticos para Facebook, Instagram y Google Ads vinculados a tus landings.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
