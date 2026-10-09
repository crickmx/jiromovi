import React, { useState, useEffect } from 'react';
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
  Copy,
  Edit2,
  Save,
  X,
  Palette,
  Globe,
  Phone,
  Mail,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface BrandItem {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  description: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  tone?: string;
  prompt_rules?: string;
}

const INITIAL_BRANDS: BrandItem[] = [
  {
    id: 'mutuus',
    name: 'Mutuus Salud',
    slug: 'mutuus',
    logo_url: 'https://movi.digital/wp-content/uploads/2026/02/og-mutuus-banner.jpg',
    primary_color: '#003896',
    secondary_color: '#9CD41C',
    font_family: 'Montserrat',
    description: 'Membresía médica integral y seguro de gastos médicos mayores con $0 deducible y $0 coaseguro.',
    phone: '55 1209 0955',
    whatsapp: '525540001234',
    email: 'contacto@mutuus.mx',
    tone: 'Profesional & Seguro',
    prompt_rules: 'Enfocar siempre en cero deducible, red hospitalaria de pago directo (+115 hospitales) y telemedicina 24/7.'
  },
  {
    id: 'seguros-express',
    name: 'Seguros Express',
    slug: 'seguros-express',
    logo_url: 'https://movi.digital/wp-content/uploads/elementor/thumbs/moviRecurso-10-rgqg5n2oyvobfmstl7md0o8mr5w7vjv6rsxrkauuio.png',
    primary_color: '#D92F3C',
    secondary_color: '#2563EB',
    font_family: 'Sora',
    description: 'Cotizador ultrarrápido y emisión inmediata de pólizas de autos en México.',
    phone: '55 1209 0955',
    whatsapp: '525540001234',
    email: 'autos@seguros.express',
    tone: 'Dinámico & Directo',
    prompt_rules: 'Resaltar cotización en menos de 2 minutos, comparativa con las mejores aseguradoras y emisión digital.'
  },
  {
    id: 'chava-agente',
    name: 'Chava IA',
    slug: 'chava-agente',
    logo_url: '/chava-ai-logo.svg',
    primary_color: '#10B981',
    secondary_color: '#3B82F6',
    font_family: 'Manrope',
    description: 'Copilot comercial y asistente de inteligencia artificial para agentes de seguros.',
    phone: '55 1209 0955',
    whatsapp: '525540001234',
    email: 'chava@agentedeseguros.ai',
    tone: 'Innovador & Cercano',
    prompt_rules: 'Personalidad consultiva de experto en seguros Grupo JIRO, sin tecnicismos innecesarios.'
  },
  {
    id: 'seguros-education',
    name: 'Seguros Education',
    slug: 'seguros-education',
    logo_url: '/brand/logos/image.png',
    primary_color: '#6366F1',
    secondary_color: '#F59E0B',
    font_family: 'Inter',
    description: 'Portal de capacitación, preparación para Cédula A y acreditación continua de asesores.',
    phone: '55 1209 0955',
    whatsapp: '525540001234',
    email: 'contacto@seguros.education',
    tone: 'Académico & Experto',
    prompt_rules: 'Enfoque en exámenes CNSF, profesionalización y certificación de promotores.'
  }
];

const STORAGE_BRANDS_KEY = 'mekate_studio_brands_v1';

interface ContentFactoryViewProps {
  section: 'brands' | 'assets' | 'robots' | 'campaigns';
}

export function ContentFactoryView({ section }: ContentFactoryViewProps) {
  const [brands, setBrands] = useState<BrandItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_BRANDS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return INITIAL_BRANDS;
  });

  const [editingBrand, setEditingBrand] = useState<BrandItem | null>(null);
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_BRANDS_KEY, JSON.stringify(brands));
  }, [brands]);

  const handleSaveBrand = (updated: BrandItem) => {
    if (isCreatingBrand) {
      setBrands([updated, ...brands]);
    } else {
      setBrands(brands.map((b) => (b.id === updated.id ? updated : b)));
    }
    setEditingBrand(null);
    setIsCreatingBrand(false);

    // Sync to Supabase
    supabase.from('leads').insert([
      {
        full_name: `Brand Update: ${updated.name}`,
        email: 'brands@mekate.studio',
        company: `Slug: ${updated.slug} | Primary: ${updated.primary_color}`,
        message: JSON.stringify(updated),
        created_at: new Date().toISOString()
      }
    ]).then(() => {}).catch(() => {});
  };

  const handleDeleteBrand = (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta marca?')) return;
    setBrands(brands.filter((b) => b.id !== id));
  };

  const handleOpenNewBrand = () => {
    setIsCreatingBrand(true);
    setEditingBrand({
      id: 'brand-' + Date.now(),
      name: '',
      slug: '',
      logo_url: '',
      primary_color: '#F97316',
      secondary_color: '#7E3AF2',
      font_family: 'Poppins',
      description: '',
      phone: '',
      whatsapp: '',
      email: '',
      tone: 'Profesional',
      prompt_rules: ''
    });
  };

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
              {section === 'brands' && 'Marcas, Logos & Reglas de Identidad'}
              {section === 'assets' && 'Biblioteca de Assets & Media'}
              {section === 'robots' && 'Robots & Agentes Especializados'}
              {section === 'campaigns' && 'Campañas & Generador de Contenido'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Configura paletas, logos, reglas de prompt y directrices de IA que se aplican automáticamente a tus páginas y copys.
            </p>
          </div>

          {section === 'brands' && (
            <button
              onClick={handleOpenNewBrand}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#F97316] to-[#7E3AF2] shadow-md flex items-center gap-2 cursor-pointer hover:opacity-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Marca</span>
            </button>
          )}
        </div>

        {/* SECTION 1: MARCAS Y LOGOS (CON EDICIÓN COMPLETA) */}
        {section === 'brands' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {brands.map((b) => (
                <div key={b.id} className="p-6 rounded-3xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all space-y-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-md flex-shrink-0"
                        style={{ backgroundColor: b.primary_color }}
                      >
                        {b.logo_url && b.logo_url.startsWith('http') ? (
                          <img src={b.logo_url} alt={b.name} className="w-8 h-8 object-contain rounded-lg" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        ) : (
                          b.name.charAt(0) || 'M'
                        )}
                      </div>
                      <div>
                        <h3 className="font-black text-lg text-gray-900">{b.name}</h3>
                        <span className="font-mono text-xs text-gray-400">/{b.slug}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setIsCreatingBrand(false);
                          setEditingBrand(b);
                        }}
                        className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition cursor-pointer"
                        title="Editar Marca y Reglas de IA"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBrand(b.id)}
                        className="p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Eliminar Marca"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">{b.description}</p>

                  {/* Colores y Tipografía */}
                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: b.primary_color }} />
                        <span className="font-mono text-[11px] text-gray-600">{b.primary_color}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: b.secondary_color }} />
                        <span className="font-mono text-[11px] text-gray-600">{b.secondary_color}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-md border border-gray-200">
                      {b.font_family}
                    </span>
                  </div>

                  {/* Reglas de Prompt IA */}
                  {b.prompt_rules && (
                    <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-100 space-y-1">
                      <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Reglas de Prompt & Copilot
                      </p>
                      <p className="text-xs text-purple-900 leading-relaxed line-clamp-2">{b.prompt_rules}</p>
                    </div>
                  )}

                  {/* Contactos */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                    <span>WhatsApp: <strong className="text-gray-800">{b.whatsapp || 'No configurado'}</strong></span>
                    <span>Tono: <strong className="text-gray-800">{b.tone || 'Profesional'}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 2: ASSETS */}
        {section === 'assets' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { title: 'Hero Mutuus 3D Shield', type: 'PNG Transparente', tag: 'Render 3D' },
              { title: 'Logos Aseguradoras México', type: 'Vector SVG', tag: 'Logos' },
              { title: 'Mockup App Móvil Seguwallet', type: 'Figma Asset', tag: 'Mockup' },
              { title: 'Iconos Coberturas Médicas', type: 'Icon Set', tag: 'Iconos' },
              { title: 'Banners Seguros Express Autos', type: 'WebP Banners', tag: 'Campañas' },
              { title: 'Logo Grupo JIRO Vectorial', type: 'SVG', tag: 'Institucional' },
            ].map((a, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-2 hover:shadow-md transition">
                <div className="h-28 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 font-bold text-xs border border-gray-100">
                  {a.tag}
                </div>
                <p className="font-bold text-xs text-gray-900 truncate">{a.title}</p>
                <p className="text-[10px] text-gray-400">{a.type}</p>
              </div>
            ))}
          </div>
        )}

        {/* SECTION 3: ROBOTS */}
        {section === 'robots' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: 'Hermes Copilot Designer', role: 'Diseño Web & Optimización de Conversión', status: 'Activo 24/7', model: 'GPT-4o Mini / OpenRouter' },
              { name: 'Chava SDR Agent', role: 'Calificación de Prospectos & Leads', status: 'Activo 24/7', model: 'Chava AI Engine' },
              { name: 'Copywriter Seguros Pro', role: 'Generación de Copies para Ads & Landings', status: 'Activo 24/7', model: 'Sonnet 3.5' },
              { name: 'SEO & GEO Optimizer MX', role: 'Indexación y Metatags Semánticos', status: 'Activo 24/7', model: 'Gemini 2.5 Flash' },
            ].map((r, i) => (
              <div key={i} className="p-6 rounded-3xl bg-white border border-gray-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#7E3AF2] text-white flex items-center justify-center font-bold shadow-md">
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

        {/* SECTION 4: CAMPAIGNS */}
        {section === 'campaigns' && (
          <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 space-y-3">
            <Library className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="font-bold text-base text-gray-900">Campañas Publicitarias & Generación Multicanal</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Genera copies y gráficos automáticos para Facebook, Instagram, Google Ads y WhatsApp vinculados directamente a tus landings de conversión.
            </p>
          </div>
        )}

      </div>

      {/* MODAL DE EDICIÓN / CREACIÓN DE MARCA */}
      {editingBrand && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-gray-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#F97316]" />
                <h3 className="font-black text-base text-gray-900">
                  {isCreatingBrand ? 'Nueva Marca & Identidad' : `Editar Marca: ${editingBrand.name}`}
                </h3>
              </div>
              <button onClick={() => setEditingBrand(null)} className="p-1 rounded-full text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveBrand(editingBrand);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nombre de la Marca *</label>
                  <input
                    type="text"
                    required
                    value={editingBrand.name}
                    onChange={(e) => setEditingBrand({ ...editingBrand, name: e.target.value })}
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Slug / Identificador *</label>
                  <input
                    type="text"
                    required
                    value={editingBrand.slug}
                    onChange={(e) => setEditingBrand({ ...editingBrand, slug: e.target.value })}
                    className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">URL del Logotipo</label>
                <input
                  type="text"
                  value={editingBrand.logo_url || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, logo_url: e.target.value })}
                  placeholder="https://... o /logo.png"
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Descripción del Negocio</label>
                <textarea
                  rows={2}
                  value={editingBrand.description}
                  onChange={(e) => setEditingBrand({ ...editingBrand, description: e.target.value })}
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Color Primario</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={editingBrand.primary_color}
                      onChange={(e) => setEditingBrand({ ...editingBrand, primary_color: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer p-0.5 border"
                    />
                    <input
                      type="text"
                      value={editingBrand.primary_color}
                      onChange={(e) => setEditingBrand({ ...editingBrand, primary_color: e.target.value })}
                      className="w-full text-xs font-mono border border-gray-200 rounded-xl px-2 py-1.5 uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Color Acento</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={editingBrand.secondary_color}
                      onChange={(e) => setEditingBrand({ ...editingBrand, secondary_color: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer p-0.5 border"
                    />
                    <input
                      type="text"
                      value={editingBrand.secondary_color}
                      onChange={(e) => setEditingBrand({ ...editingBrand, secondary_color: e.target.value })}
                      className="w-full text-xs font-mono border border-gray-200 rounded-xl px-2 py-1.5 uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tipografía</label>
                  <select
                    value={editingBrand.font_family}
                    onChange={(e) => setEditingBrand({ ...editingBrand, font_family: e.target.value })}
                    className="w-full text-xs border border-gray-200 rounded-xl px-2 py-2"
                  >
                    <option value="Montserrat">Montserrat</option>
                    <option value="Poppins">Poppins</option>
                    <option value="Sora">Sora</option>
                    <option value="Manrope">Manrope</option>
                    <option value="Inter">Inter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">WhatsApp de Contacto</label>
                  <input
                    type="tel"
                    value={editingBrand.whatsapp || ''}
                    onChange={(e) => setEditingBrand({ ...editingBrand, whatsapp: e.target.value })}
                    placeholder="525540001234"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tono de Comunicación</label>
                  <input
                    type="text"
                    value={editingBrand.tone || ''}
                    onChange={(e) => setEditingBrand({ ...editingBrand, tone: e.target.value })}
                    placeholder="Profesional, Cercano, etc."
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-800 mb-1">
                  Reglas de Prompt para Hermes AI (Directrices de Marca)
                </label>
                <textarea
                  rows={3}
                  value={editingBrand.prompt_rules || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, prompt_rules: e.target.value })}
                  placeholder="Instrucciones para la IA: términos obligatorios, coberturas clave, beneficios que siempre se deben resaltar..."
                  className="w-full text-xs border border-purple-200 bg-purple-50/30 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                />
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingBrand(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#7E3AF2] text-white font-bold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Marca y Reglas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
