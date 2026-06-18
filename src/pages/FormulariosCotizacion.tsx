import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Search, Clock, ArrowRight, Loader2,
  Home, Building2, Factory, Shield, Truck, Wrench, Heart,
  GraduationCap, Car, Store, Flame, Fuel, Briefcase, BadgeCheck,
  Baby, Leaf, Bus, Plane, Ship, HardHat, Cog, Settings, Thermometer, Monitor,
  ChevronDown, Users, UserCheck, TreePine, Wheat, Tractor, ShieldCheck, Lock,
  Banknote, Eye, Smile, CalendarDays, PawPrint, KeyRound, Building, Frame,
  Cpu, DollarSign, Scale, AlertTriangle, ClipboardList,
} from 'lucide-react';
import { fetchQuoteFormTemplates } from '../lib/quoteFormUtils';
import type { QuoteFormTemplate, FormCategory } from '../lib/quoteFormTypes';
import { CATEGORY_CONFIG } from '../lib/quoteFormTypes';

const ICON_MAP: Record<string, React.ElementType> = {
  Home, Building2, Factory, Shield, Truck, Wrench, Heart,
  GraduationCap, Car, Store, Flame, Fuel, Briefcase, BadgeCheck,
  Baby, Leaf, Bus, Plane, Ship, HardHat, Cog, Settings, Thermometer, Monitor, FileText,
  Users, UserCheck, TreePine, Wheat, Tractor, ShieldCheck, Lock, Banknote,
  Eye, Smile, CalendarDays, PawPrint, KeyRound, Building, Frame, Cpu,
  DollarSign, Scale, AlertTriangle,
};

const CATEGORY_ORDER: FormCategory[] = [
  'Personas', 'Autos', 'Hogar', 'Empresarial', 'Responsabilidad Civil',
  'Fianzas y Credito', 'Agro', 'RC y Financiero', 'Transportes', 'Ingenieria', 'Especializados',
];

export default function FormulariosCotizacion() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<QuoteFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    fetchQuoteFormTemplates()
      .then(t => { setTemplates(t); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filteredTemplates = templates.filter(t => {
    if (filterCategory && t.category !== filterCategory) return false;
    if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const groupedTemplates = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = filteredTemplates.filter(t => t.category === cat);
    if (items.length > 0) acc.push({ category: cat, items });
    return acc;
  }, [] as { category: FormCategory; items: QuoteFormTemplate[] }[]);

  const startForm = (template: QuoteFormTemplate) => {
    navigate(`/cotizar/formularios/nuevo/${template.form_type}`);
  };

  return (
    <div className="space-y-6">
      {/* Section header — unified Cotizar style */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 flex-shrink-0">
          <ClipboardList className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">Formularios de Cotizacion</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Selecciona un tipo de seguro para iniciar tu solicitud de cotizacion</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar tipo de seguro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las categorias</option>
            {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {groupedTemplates.map(({ category, items }) => {
            const catConfig = CATEGORY_CONFIG[category];
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-sm font-semibold ${catConfig.color}`}>{category}</span>
                  <span className="text-xs text-neutral-400">({items.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(template => {
                    const Icon = ICON_MAP[template.icon] || FileText;
                    return (
                      <div
                        key={template.form_type}
                        className="group bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-xl ${catConfig.bg} ${catConfig.border} border`}>
                            <Icon className={`w-5 h-5 ${catConfig.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                              {template.title}
                            </h3>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">{template.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-100 dark:border-white/10">
                          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>~{template.estimated_minutes} min</span>
                          </div>
                          <button
                            onClick={() => startForm(template)}
                            className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                          >
                            Iniciar <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {groupedTemplates.length === 0 && (
            <div className="text-center py-16 text-neutral-500 dark:text-neutral-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No se encontraron formularios con los filtros aplicados.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
