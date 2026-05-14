import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Search, Plus, Clock, ArrowRight, Loader2, ArrowLeft,
  Home, Building2, Factory, Shield, Truck, Wrench, Heart,
  GraduationCap, Car, Store, Flame, Fuel, Briefcase, BadgeCheck,
  Baby, Leaf, Bus, Plane, Ship, HardHat, Cog, Settings, Thermometer, Monitor,
  List, LayoutGrid, ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { fetchQuoteFormTemplates, fetchQuoteForms } from '../lib/quoteFormUtils';
import type { QuoteFormTemplate, QuoteForm, FormCategory } from '../lib/quoteFormTypes';
import { STATUS_CONFIG, CATEGORY_CONFIG, PRIORITY_CONFIG } from '../lib/quoteFormTypes';

const ICON_MAP: Record<string, React.ElementType> = {
  Home, Building2, Factory, Shield, Truck, Wrench, Heart,
  GraduationCap, Car, Store, Flame, Fuel, Briefcase, BadgeCheck,
  Baby, Leaf, Bus, Plane, Ship, HardHat, Cog, Settings, Thermometer, Monitor, FileText,
};

const CATEGORY_ORDER: FormCategory[] = ['Personas', 'Hogar', 'Empresarial', 'Responsabilidad Civil', 'Transportes', 'Ingenieria'];

export default function FormulariosCotizacion() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [view, setView] = useState<'catalog' | 'list'>('catalog');
  const [templates, setTemplates] = useState<QuoteFormTemplate[]>([]);
  const [forms, setForms] = useState<QuoteForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tpls, fms] = await Promise.all([
        fetchQuoteFormTemplates(),
        fetchQuoteForms({ search: searchTerm || undefined, status: filterStatus || undefined, form_type: filterType || undefined }),
      ]);
      setTemplates(tpls);
      setForms(fms);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [searchTerm, filterStatus, filterType]);

  useEffect(() => { loadData(); }, [loadData]);

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
    navigate(`/tramites/formularios/nuevo/${template.form_type}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/tramites')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Volver a Tramites"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Formularios de Cotizacion</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Solicita cotizaciones de seguros con formularios rapidos e inteligentes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('catalog')}
            className={`p-2 rounded-lg transition-colors ${view === 'catalog' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            title="Vista catalogo"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            title="Mis formularios"
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={view === 'catalog' ? 'Buscar tipo de seguro...' : 'Buscar por folio, cliente...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {view === 'catalog' && (
          <div className="relative">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las categorias</option>
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}
        {view === 'list' && (
          <>
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los estatus</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los tipos</option>
                {templates.map(t => <option key={t.form_type} value={t.form_type}>{t.title}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : view === 'catalog' ? (
        /* Catalog Grid View */
        <div className="space-y-8">
          {groupedTemplates.map(({ category, items }) => {
            const catConfig = CATEGORY_CONFIG[category];
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-sm font-semibold ${catConfig.color}`}>{category}</span>
                  <span className="text-xs text-gray-400">({items.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(template => {
                    const Icon = ICON_MAP[template.icon] || FileText;
                    return (
                      <div
                        key={template.form_type}
                        className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => startForm(template)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-xl ${catConfig.bg} ${catConfig.border} border`}>
                            <Icon className={`w-5 h-5 ${catConfig.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors truncate">
                              {template.title}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{template.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>~{template.estimated_minutes} min</span>
                          </div>
                          <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            Iniciar <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {groupedTemplates.length === 0 && (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No se encontraron formularios con los filtros aplicados.</p>
            </div>
          )}
        </div>
      ) : (
        /* List View - My Forms */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {forms.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No tienes formularios aun</p>
              <p className="text-xs mt-1">Inicia una cotizacion desde el catalogo</p>
              <button onClick={() => setView('catalog')} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4" /> Nueva cotizacion
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Folio</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estatus</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Prioridad</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {forms.map(form => {
                    const statusCfg = STATUS_CONFIG[form.status];
                    const prioCfg = PRIORITY_CONFIG[form.priority];
                    return (
                      <tr
                        key={form.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/tramites/formularios/${form.id}`)}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium text-gray-800 dark:text-gray-200">{form.folio}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{form.form_title}</td>
                        <td className="px-4 py-3 text-xs text-gray-800 dark:text-gray-200 font-medium">{form.client_name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${prioCfg.bg} ${prioCfg.color}`}>
                            {prioCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-500">
                          {new Date(form.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
