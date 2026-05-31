import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BookOpen, Search, Settings, ChevronRight, FileText, Layers } from 'lucide-react';
import { SegurosEducationLayout } from '../components/segurosEducation/SegurosEducationLayout';

interface Manual {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  html_path: string | null;
  pdf_path: string | null;
  cover_image: string | null;
  status: string;
  sort_order: number;
  created_at: string;
}

const CARD_GRADIENTS = [
  'from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30',
  'from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30',
  'from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30',
  'from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30',
  'from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30',
  'from-neutral-50 to-zinc-100 dark:from-neutral-950/30 dark:to-zinc-950/30',
];

const ICON_COLORS = [
  'text-blue-500 dark:text-blue-400',
  'text-emerald-500 dark:text-emerald-400',
  'text-amber-500 dark:text-amber-400',
  'text-rose-500 dark:text-rose-400',
  'text-cyan-500 dark:text-cyan-400',
  'text-neutral-500 dark:text-neutral-400',
];

function ManualCard({ manual, index, onClick }: { manual: Manual; index: number; onClick: () => void }) {
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const iconColor = ICON_COLORS[index % ICON_COLORS.length];

  return (
    <button
      onClick={onClick}
      className="group text-left w-full bg-white dark:bg-white/[0.03] border border-neutral-200/80 dark:border-white/[0.07] rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 active:translate-y-0"
    >
      <div className={`relative h-36 bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
        {manual.cover_image ? (
          <img src={manual.cover_image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="relative">
            <div className="absolute -top-8 -left-8 w-24 h-24 bg-white/30 dark:bg-white/5 rounded-full blur-xl" />
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-white/20 dark:bg-white/5 rounded-full blur-lg" />
            <div className="relative w-12 h-12 rounded-xl bg-white/80 dark:bg-white/10 backdrop-blur-sm shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FileText className={`w-6 h-6 ${iconColor}`} />
            </div>
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-700 dark:text-white/70 bg-white/80 dark:bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
          {manual.category}
        </span>
      </div>

      <div className="p-4 space-y-1.5">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-2 group-hover:text-[#1C37E0] dark:group-hover:text-blue-400 transition-colors">
          {manual.title}
        </h3>
        {manual.description && (
          <p className="text-xs text-neutral-500 dark:text-white/40 line-clamp-2 leading-relaxed">
            {manual.description}
          </p>
        )}
        <div className="flex items-center gap-1 pt-1 text-xs font-medium text-[#1C37E0] dark:text-blue-400 opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-200">
          Consultar manual
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </button>
  );
}

export function SegurosEducationManuales() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('all');

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    fetchManuals();
  }, []);

  async function fetchManuals() {
    setLoading(true);
    const { data, error } = await supabase
      .from('manuals')
      .select('*')
      .eq('status', 'active')
      .order('sort_order', { ascending: true });

    if (!error && data) setManuals(data);
    setLoading(false);
  }

  const categories = [...new Set(manuals.map(m => m.category))];

  const filteredManuals = manuals.filter(m => {
    const matchSearch = !busqueda ||
      m.title.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.description.toLowerCase().includes(busqueda.toLowerCase());
    const matchCategory = categoriaFiltro === 'all' || m.category === categoriaFiltro;
    return matchSearch && matchCategory;
  });

  if (loading) {
    return (
      <>
        <SegurosEducationLayout sectionTitle="Manuales" sectionDescription="Documentos operativos y de referencia">
          <div className="flex justify-center items-center py-16">
            <div className="w-8 h-8 border-[3px] border-[#1C37E0]/20 border-t-[#1C37E0] rounded-full animate-spin" />
          </div>
        </SegurosEducationLayout>
      </>
    );
  }

  return (
    <>
      <SegurosEducationLayout sectionTitle="Manuales" sectionDescription="Documentos operativos y de referencia">
        <div className="space-y-5">
          {/* Section header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">Documentos disponibles</h2>
              <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5">{filteredManuals.length} manual{filteredManuals.length !== 1 ? 'es' : ''}</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => navigate('/manuales/admin')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 dark:bg-white/8 text-neutral-700 dark:text-white/70 text-xs font-semibold hover:bg-neutral-200 dark:hover:bg-white/12 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Administrar
              </button>
            )}
          </div>

          {/* Search & Category filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar por titulo o descripcion..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] rounded-xl text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#1C37E0]/30 focus:border-[#1C37E0] transition-all"
              />
            </div>
            {categories.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  onClick={() => setCategoriaFiltro('all')}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    categoriaFiltro === 'all'
                      ? 'bg-[#1C37E0] text-white shadow-sm'
                      : 'bg-neutral-100 dark:bg-white/[0.05] text-neutral-600 dark:text-white/60 hover:bg-neutral-200 dark:hover:bg-white/10'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Todos
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoriaFiltro(cat)}
                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      categoriaFiltro === cat
                        ? 'bg-[#1C37E0] text-white shadow-sm'
                        : 'bg-neutral-100 dark:bg-white/[0.05] text-neutral-600 dark:text-white/60 hover:bg-neutral-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {busqueda && (
            <p className="text-xs text-neutral-400 dark:text-white/40">
              {filteredManuals.length} {filteredManuals.length === 1 ? 'resultado' : 'resultados'} para{' '}
              <span className="text-neutral-600 dark:text-white/60">"{busqueda}"</span>
            </p>
          )}

          {/* Grid */}
          {filteredManuals.length === 0 ? (
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl border-2 border-dashed border-neutral-200 dark:border-white/10 p-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-6 h-6 text-neutral-400" />
              </div>
              <h3 className="text-base font-bold text-neutral-700 dark:text-white/70 mb-1">
                {busqueda ? 'Sin resultados' : 'No hay manuales disponibles'}
              </h3>
              <p className="text-sm text-neutral-400">
                {busqueda
                  ? 'Intenta con otro termino de busqueda'
                  : 'Los manuales apareceran aqui cuando esten disponibles'}
              </p>
              {busqueda && (
                <button
                  onClick={() => { setBusqueda(''); setCategoriaFiltro('all'); }}
                  className="mt-4 px-4 py-2 text-sm text-[#1C37E0] hover:underline font-medium"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredManuals.map((manual, index) => (
                <ManualCard
                  key={manual.id}
                  manual={manual}
                  index={index}
                  onClick={() => navigate(`/manuales/${manual.slug}`)}
                />
              ))}
            </div>
          )}
        </div>
      </SegurosEducationLayout>
    </>
  );
}
