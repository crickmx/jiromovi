import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BookOpen, Search, Filter, Plus, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/ui/page-header';

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
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-neutral-200 dark:bg-white/10 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-56 bg-neutral-200 dark:bg-white/10 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Manuales"
        description="Consulta los manuales operativos y de referencia"
        icon={BookOpen}
        actions={isAdmin ? (
          <button
            onClick={() => navigate('/manuales/admin')}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Administrar
          </button>
        ) : undefined}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar manual..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
          />
        </div>
        {categories.length > 1 && (
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <select
              value={categoriaFiltro}
              onChange={e => setCategoriaFiltro(e.target.value)}
              className="pl-10 pr-8 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 appearance-none transition-all"
            >
              <option value="all">Todas las categorias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Manual Cards Grid */}
      {filteredManuals.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-neutral-300 dark:text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-600 dark:text-white/60">
            {busqueda ? 'No se encontraron manuales' : 'No hay manuales disponibles'}
          </h3>
          <p className="text-sm text-neutral-400 dark:text-white/40 mt-1">
            {busqueda ? 'Intenta con otro termino de busqueda' : 'Los manuales apareceran aqui cuando esten disponibles'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredManuals.map(manual => (
            <ManualCard key={manual.id} manual={manual} onClick={() => navigate(`/manuales/${manual.slug}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ManualCard({ manual, onClick }: { manual: Manual; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left w-full bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-5 hover:shadow-lg hover:border-accent/30 dark:hover:border-accent/40 transition-all duration-300 hover:-translate-y-0.5"
    >
      {/* Cover or Icon */}
      <div className="w-full h-32 rounded-xl bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-900/20 dark:to-sky-900/20 flex items-center justify-center mb-4 overflow-hidden">
        {manual.cover_image ? (
          <img src={manual.cover_image} alt={manual.title} className="w-full h-full object-cover" />
        ) : (
          <BookOpen className="w-10 h-10 text-blue-400 dark:text-blue-300 group-hover:scale-110 transition-transform duration-300" />
        )}
      </div>

      {/* Category badge */}
      <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-accent bg-accent/10 px-2.5 py-1 rounded-full mb-2">
        {manual.category}
      </span>

      {/* Title */}
      <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1.5 line-clamp-2 group-hover:text-accent transition-colors">
        {manual.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-neutral-500 dark:text-white/50 line-clamp-2 mb-3">
        {manual.description}
      </p>

      {/* CTA */}
      <div className="flex items-center gap-1 text-xs font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        Abrir manual
        <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </button>
  );
}
