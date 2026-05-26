import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { SegurosEducationLayout } from '../components/segurosEducation/SegurosEducationLayout';
import { BookOpen, Search, Settings, ChevronRight, FileText, Layers } from 'lucide-react';

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

export default function Manuales() {
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

    if (!error && data) {
      setManuals(data);
    }
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
      <Layout>
        <SegurosEducationLayout sectionTitle="Manuales" sectionDescription="Manuales operativos y de referencia">
          <div className="animate-pulse space-y-6">
            <div className="h-11 w-full max-w-md bg-neutral-200 dark:bg-white/10 rounded-xl" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-neutral-200 dark:bg-white/10 rounded-2xl" />
              ))}
            </div>
          </div>
        </SegurosEducationLayout>
      </Layout>
    );
  }

  return (
    <Layout>
      <SegurosEducationLayout sectionTitle="Manuales" sectionDescription="Manuales operativos y de referencia">
        <div className="space-y-5">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar por titulo o descripcion..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 dark:focus:border-blue-500/40 transition-all"
              />
            </div>
            {isAdmin && (
              <button
                onClick={() => navigate('/manuales/admin')}
                className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-sm font-medium hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] flex-shrink-0"
              >
                <Settings className="w-4 h-4" />
                Administrar
              </button>
            )}
          </div>

          {categories.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setCategoriaFiltro('all')}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  categoriaFiltro === 'all'
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                    : 'bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/10'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Todos
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    categoriaFiltro === cat
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                      : 'bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {busqueda && (
            <p className="text-xs text-neutral-400 dark:text-white/40">
              {filteredManuals.length} {filteredManuals.length === 1 ? 'resultado' : 'resultados'}
              {' '}para "<span className="text-neutral-600 dark:text-white/60">{busqueda}</span>"
            </p>
          )}

          {filteredManuals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-neutral-300 dark:text-white/20" />
              </div>
              <h3 className="text-base font-semibold text-neutral-700 dark:text-white/70 mb-1">
                {busqueda ? 'Sin resultados' : 'No hay manuales disponibles'}
              </h3>
              <p className="text-sm text-neutral-400 dark:text-white/40 text-center max-w-xs">
                {busqueda
                  ? 'Intenta con otro termino de busqueda o cambia el filtro de categoria'
                  : 'Los manuales apareceran aqui cuando esten disponibles'}
              </p>
              {busqueda && (
                <button
                  onClick={() => { setBusqueda(''); setCategoriaFiltro('all'); }}
                  className="mt-4 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
    </Layout>
  );
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
      className="group text-left w-full bg-white dark:bg-white/[0.03] border border-neutral-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-neutral-200/50 dark:hover:shadow-black/20 hover:border-neutral-300 dark:hover:border-white/15 transition-all duration-300 hover:-translate-y-1 active:translate-y-0 active:shadow-md"
    >
      <div className={`relative h-36 sm:h-40 bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
        {manual.cover_image ? (
          <img src={manual.cover_image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="relative">
            <div className="absolute -top-8 -left-8 w-24 h-24 bg-white/30 dark:bg-white/5 rounded-full blur-xl" />
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-white/20 dark:bg-white/5 rounded-full blur-lg" />
            <div className="relative w-14 h-14 rounded-xl bg-white/80 dark:bg-white/10 backdrop-blur-sm shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FileText className={`w-7 h-7 ${iconColor}`} />
            </div>
          </div>
        )}
        <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider text-neutral-700 dark:text-white/70 bg-white/80 dark:bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
          {manual.category}
        </span>
      </div>

      <div className="p-4 sm:p-5 space-y-2">
        <h3 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white line-clamp-2 group-hover:text-[#1C37E0] dark:group-hover:text-blue-400 transition-colors duration-200">
          {manual.title}
        </h3>
        {manual.description && (
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-white/45 line-clamp-2 leading-relaxed">
            {manual.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 pt-2 text-xs font-medium text-[#1C37E0] dark:text-blue-400 opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-200">
          Consultar manual
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </button>
  );
}
