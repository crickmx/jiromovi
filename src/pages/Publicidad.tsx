import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Image, Video, Plus, Search, Filter, Edit, Trash2, Copy, Palette } from 'lucide-react';

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
  const [showEditorModal, setShowEditorModal] = useState(false);
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
    setShowEditorModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-neutral-900 mb-2">
              Publicidad
            </h1>
            <p className="text-neutral-600">
              Crea diseños personalizados con tu logo y texto
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className="flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-5 py-3 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold"
            >
              <Plus className="w-5 h-5" />
              <span>Nueva Plantilla</span>
            </button>
          )}
        </div>

        <div className="flex space-x-2 border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('biblioteca')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'biblioteca'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Palette className="w-5 h-5" />
              <span>Biblioteca</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('mis-disenos')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'mis-disenos'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Image className="w-5 h-5" />
              <span>Mis Diseños</span>
            </div>
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'admin'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Edit className="w-5 h-5" />
                <span>Gestión</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'biblioteca' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar plantillas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                />
              </div>
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              >
                <option value="todas">Todas las categorías</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
              <select
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
                className="px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              >
                <option value="todos">Todos los tipos</option>
                <option value="imagen">Imágenes</option>
                <option value="video">Videos</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredPlantillas.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-12 text-center">
              <Palette className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-neutral-700 mb-2">
                No hay plantillas disponibles
              </h3>
              <p className="text-neutral-500">
                {isAdmin ? 'Crea tu primera plantilla para comenzar' : 'Próximamente habrá plantillas disponibles'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlantillas.map(plantilla => (
                <div
                  key={plantilla.id}
                  className="bg-white rounded-2xl shadow-soft border border-neutral-200 overflow-hidden hover:shadow-medium transition-all duration-200 group"
                >
                  <div className="relative aspect-video bg-neutral-100">
                    {plantilla.miniatura_url ? (
                      <img
                        src={plantilla.miniatura_url}
                        alt={plantilla.titulo}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {plantilla.tipo === 'imagen' ? (
                          <Image className="w-16 h-16 text-neutral-300" />
                        ) : (
                          <Video className="w-16 h-16 text-neutral-300" />
                        )}
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        plantilla.tipo === 'imagen'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {plantilla.tipo === 'imagen' ? 'Imagen' : 'Video'}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-neutral-900 mb-1">{plantilla.titulo}</h3>
                    {plantilla.descripcion && (
                      <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{plantilla.descripcion}</p>
                    )}
                    {plantilla.publicidad_categorias && (
                      <span className="inline-block px-2 py-1 bg-neutral-100 text-neutral-700 text-xs rounded-lg mb-3">
                        {plantilla.publicidad_categorias.nombre}
                      </span>
                    )}
                    <button
                      onClick={() => handleUsarPlantilla(plantilla)}
                      className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-2.5 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold"
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
        <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
          <h2 className="text-2xl font-display font-bold text-neutral-900 mb-6">
            Mis Diseños Personalizados
          </h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : disenos.length === 0 ? (
            <div className="text-center py-12">
              <Image className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-neutral-700 mb-2">
                No tienes diseños personalizados
              </h3>
              <p className="text-neutral-500 mb-6">
                Crea tu primer diseño desde la biblioteca
              </p>
              <button
                onClick={() => setActiveTab('biblioteca')}
                className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-3 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold"
              >
                Ir a la Biblioteca
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {disenos.map(diseno => (
                <div
                  key={diseno.id}
                  className="bg-white rounded-2xl shadow-soft border border-neutral-200 overflow-hidden hover:shadow-medium transition-all duration-200"
                >
                  <div className="relative aspect-video bg-neutral-100">
                    {diseno.archivo_resultante_url ? (
                      <img
                        src={diseno.archivo_resultante_url}
                        alt="Diseño personalizado"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-16 h-16 text-neutral-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-neutral-900 mb-1">
                      {diseno.publicidad_plantillas?.titulo || 'Diseño'}
                    </h3>
                    <p className="text-sm text-neutral-600 mb-3">
                      {new Date(diseno.created_at).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    <a
                      href={diseno.archivo_resultante_url || '#'}
                      download
                      className="block w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-2.5 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold text-center"
                    >
                      Descargar
                    </a>
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
    </div>
  );
}
