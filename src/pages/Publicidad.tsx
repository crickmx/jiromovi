import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Image, Video, Plus, Search, Filter, CreditCard as Edit, Trash2, Copy, Palette } from 'lucide-react';
import { NuevaPlantillaModal } from '../components/NuevaPlantillaModal';
import { PersonalizarPlantillaModal } from '../components/PersonalizarPlantillaModal';

interface Categoria {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
}

interface Plantilla {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: 'imagen' | 'video';
  categoria_id: string | null;
  archivo_url: string;
  miniatura_url: string | null;
  ancho: number | null;
  alto: number | null;
  duracion: number | null;
  activa: boolean;
  zona_logo?: any;
  zona_texto?: any;
  estilo_texto_default?: any;
  publicidad_categorias?: { nombre: string } | null;
}

interface Diseno {
  id: string;
  plantilla_id: string;
  archivo_resultante_url: string | null;
  created_at: string;
  publicidad_plantillas?: {
    titulo: string;
    tipo: string;
    publicidad_categorias?: { nombre: string } | null;
  } | null;
}

export function Publicidad() {
  const { usuario } = useAuth();
  const [activeTab, setActiveTab] = useState<'biblioteca' | 'mis-disenos' | 'admin'>('biblioteca');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [disenos, setDisenos] = useState<Diseno[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas');
  const [selectedTipo, setSelectedTipo] = useState<string>('todos');
  const [showNuevaPlantillaModal, setShowNuevaPlantillaModal] = useState(false);
  const [showPersonalizarModal, setShowPersonalizarModal] = useState(false);
  const [selectedPlantilla, setSelectedPlantilla] = useState<Plantilla | null>(null);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadCategorias(),
      activeTab === 'biblioteca' && loadPlantillas(),
      activeTab === 'mis-disenos' && loadDisenos(),
    ]);
    setLoading(false);
  };

  const loadCategorias = async () => {
    const { data } = await supabase
      .from('publicidad_categorias')
      .select('*')
      .order('orden');
    if (data) setCategorias(data);
  };

  const loadPlantillas = async () => {
    let query = supabase
      .from('publicidad_plantillas')
      .select('*, publicidad_categorias(nombre)')
      .eq('activa', true)
      .order('created_at', { ascending: false });

    if (selectedCategoria !== 'todas') {
      query = query.eq('categoria_id', selectedCategoria);
    }

    if (selectedTipo !== 'todos') {
      query = query.eq('tipo', selectedTipo);
    }

    const { data } = await query;
    if (data) setPlantillas(data);
  };

  const loadDisenos = async () => {
    if (!usuario) return;

    const { data } = await supabase
      .from('publicidad_disenos')
      .select(`
        *,
        publicidad_plantillas(
          titulo,
          tipo,
          publicidad_categorias(nombre)
        )
      `)
      .eq('usuario_id', usuario.id)
      .order('created_at', { ascending: false });

    if (data) setDisenos(data);
  };

  const filteredPlantillas = plantillas.filter(p =>
    p.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUsarPlantilla = (plantilla: Plantilla) => {
    setSelectedPlantilla(plantilla);
    setShowPersonalizarModal(true);
  };

  const handleEliminarPlantilla = async (plantilla: Plantilla) => {
    if (!isAdmin) {
      alert('Solo los administradores pueden eliminar plantillas');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar la plantilla "${plantilla.titulo}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('deactivate_plantilla', {
        plantilla_id: plantilla.id
      });

      if (error) throw error;

      alert('Plantilla eliminada correctamente');
      loadPlantillas();
    } catch (error: any) {
      console.error('Error al eliminar plantilla:', error);
      alert(`Error al eliminar la plantilla: ${error.message}`);
    }
  };

  const handleEliminarDiseno = async (diseno: Diseno) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este diseño?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('publicidad_disenos')
        .delete()
        .eq('id', diseno.id);

      if (error) throw error;

      alert('Diseño eliminado correctamente');
      loadDisenos();
    } catch (error: any) {
      console.error('Error al eliminar diseño:', error);
      alert('Error al eliminar el diseño');
    }
  };

  const handleDescargarDiseno = (url: string, titulo: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${titulo}-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-primary-600 mb-1 sm:mb-2">
              Publicidad
            </h1>
            <p className="text-sm sm:text-base text-neutral-600">
              Crea diseños personalizados con tu logo y texto
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowNuevaPlantillaModal(true)}
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 sm:px-5 py-3 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold min-h-[44px] w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              <span>Nueva Plantilla</span>
            </button>
          )}
        </div>

        <div className="flex overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 space-x-2 sm:space-x-2 border-b border-neutral-200 scrollbar-hide">
          <button
            onClick={() => setActiveTab('biblioteca')}
            className={`flex-shrink-0 px-4 sm:px-6 py-3 font-semibold transition-all min-h-[44px] ${
              activeTab === 'biblioteca'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Palette className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Biblioteca</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('mis-disenos')}
            className={`flex-shrink-0 px-4 sm:px-6 py-3 font-semibold transition-all min-h-[44px] ${
              activeTab === 'mis-disenos'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Image className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Mis Diseños</span>
            </div>
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-shrink-0 px-4 sm:px-6 py-3 font-semibold transition-all min-h-[44px] ${
                activeTab === 'admin'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">Gestión</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'biblioteca' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Buscar plantillas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all min-h-[44px]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={selectedCategoria}
                  onChange={(e) => setSelectedCategoria(e.target.value)}
                  className="px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all min-h-[44px]"
                >
                  <option value="todas">Todas las categorías</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
                <select
                  value={selectedTipo}
                  onChange={(e) => setSelectedTipo(e.target.value)}
                  className="px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all min-h-[44px]"
                >
                  <option value="todos">Todos los tipos</option>
                  <option value="imagen">Imágenes</option>
                  <option value="video">Videos</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredPlantillas.length === 0 ? (
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-8 sm:p-12 text-center">
              <Palette className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-300 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-neutral-700 mb-2">
                No hay plantillas disponibles
              </h3>
              <p className="text-sm sm:text-base text-neutral-500">
                {isAdmin ? 'Crea tu primera plantilla para comenzar' : 'Próximamente habrá plantillas disponibles'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredPlantillas.map(plantilla => (
                <div
                  key={plantilla.id}
                  className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 overflow-hidden hover:shadow-medium transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="relative aspect-video bg-neutral-100">
                    {plantilla.miniatura_url ? (
                      <img
                        src={plantilla.miniatura_url}
                        alt={plantilla.titulo}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {plantilla.tipo === 'imagen' ? (
                          <Image className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-300" />
                        ) : (
                          <Video className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-300" />
                        )}
                      </div>
                    )}
                    <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 flex items-center justify-between">
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
                        plantilla.tipo === 'imagen'
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {plantilla.tipo === 'imagen' ? 'Imagen' : 'Video'}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEliminarPlantilla(plantilla);
                          }}
                          className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all duration-200 shadow-lg min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95"
                          title="Eliminar plantilla"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="text-base sm:text-lg font-semibold text-neutral-900 mb-1 line-clamp-1">{plantilla.titulo}</h3>
                    {plantilla.descripcion && (
                      <p className="text-xs sm:text-sm text-neutral-600 mb-2 sm:mb-3 line-clamp-2">{plantilla.descripcion}</p>
                    )}
                    {plantilla.publicidad_categorias && (
                      <span className="inline-block px-2 py-1 bg-neutral-100 text-neutral-700 text-xs rounded-lg mb-2 sm:mb-3">
                        {plantilla.publicidad_categorias.nombre}
                      </span>
                    )}
                    <button
                      onClick={() => handleUsarPlantilla(plantilla)}
                      className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-2.5 sm:py-3 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold text-sm sm:text-base min-h-[44px] active:scale-95"
                    >
                      Usar este diseño
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'mis-disenos' && (
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-neutral-900 mb-4 sm:mb-6">
            Mis Diseños Personalizados
          </h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : disenos.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Image className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-300 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-neutral-700 mb-2">
                No tienes diseños personalizados
              </h3>
              <p className="text-sm sm:text-base text-neutral-500 mb-4 sm:mb-6">
                Crea tu primer diseño desde la biblioteca
              </p>
              <button
                onClick={() => setActiveTab('biblioteca')}
                className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-5 sm:px-6 py-3 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold min-h-[44px]"
              >
                Ir a la Biblioteca
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {disenos.map(diseno => (
                <div
                  key={diseno.id}
                  className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 overflow-hidden hover:shadow-medium transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="relative aspect-video bg-neutral-100">
                    {diseno.archivo_resultante_url ? (
                      <img
                        src={diseno.archivo_resultante_url}
                        alt="Diseño personalizado"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="text-base sm:text-lg font-semibold text-neutral-900 mb-1 line-clamp-1">
                      {diseno.publicidad_plantillas?.titulo || 'Diseño'}
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 mb-3">
                      {new Date(diseno.created_at).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDescargarDiseno(diseno.archivo_resultante_url || '', diseno.publicidad_plantillas?.titulo || 'Diseño')}
                        className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white py-2.5 sm:py-3 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold text-sm sm:text-base min-h-[44px] active:scale-95"
                      >
                        Descargar
                      </button>
                      <button
                        onClick={() => handleEliminarDiseno(diseno)}
                        className="p-2.5 sm:p-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-200 hover:scale-105 min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95"
                        title="Eliminar diseño"
                      >
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'admin' && isAdmin && (
        <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
          <h2 className="text-2xl font-display font-bold text-neutral-900 mb-6">
            Gestión de Plantillas
          </h2>
          <p className="text-neutral-600">
            Herramientas de administración próximamente disponibles
          </p>
        </div>
      )}

      <NuevaPlantillaModal
        isOpen={showNuevaPlantillaModal}
        onClose={() => setShowNuevaPlantillaModal(false)}
        onSuccess={() => {
          setShowNuevaPlantillaModal(false);
          loadData();
        }}
        categorias={categorias}
      />

      <PersonalizarPlantillaModal
        isOpen={showPersonalizarModal}
        onClose={() => {
          setShowPersonalizarModal(false);
          setSelectedPlantilla(null);
        }}
        plantilla={selectedPlantilla}
        onSuccess={() => {
          setShowPersonalizarModal(false);
          setSelectedPlantilla(null);
          setActiveTab('mis-disenos');
          loadData();
        }}
      />
    </div>
  );
}
