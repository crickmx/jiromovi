import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Image, Video, Plus, Filter, Trash2, Palette } from 'lucide-react';
import { NuevaPlantillaModal } from '../components/NuevaPlantillaModal';
import { PersonalizarPlantillaModal } from '../components/PersonalizarPlantillaModal';
import { PlanMKTPremiumBlock } from '../components/PlanMKTPremiumBlock';
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';
import { trackPublicityCreated } from '../lib/activityLogger';

const CATEGORIAS_LIST = [
  'Redes Sociales', 'Campanas', 'Promociones', 'Eventos', 'Presentaciones',
  'Email Marketing', 'Banners', 'Tarjetas de Presentacion', 'Otro'
];

const RAMOS_LIST = [
  'GMM', 'Vida', 'Autos', 'Danos', 'Ahorro e Inversion', 'Empresarial',
  'Responsabilidad Civil', 'Transporte', 'Agropecuario', 'Fianzas', 'Multirramo', 'Otro'
];

interface Plantilla {
  id: string;
  titulo: string | null;
  tipo: 'imagen' | 'video';
  categoria: string;
  ramo: string;
  archivo_url: string;
  miniatura_url: string | null;
  ancho: number | null;
  alto: number | null;
  duracion: number | null;
  activa: boolean;
  zona_logo?: any;
  zona_texto?: any;
  estilo_texto_default?: any;
  visible_para_todas_las_oficinas: boolean;
}

interface Diseno {
  id: string;
  plantilla_id: string;
  archivo_resultante_url: string | null;
  created_at: string;
  publicidad_plantillas?: {
    titulo: string | null;
    tipo: string;
    categoria: string;
    ramo: string;
  } | null;
}

export function Publicidad() {
  const { usuario } = useAuth();
  const [activeTab, setActiveTab] = useState<'biblioteca' | 'mis-disenos'>('biblioteca');
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [disenos, setDisenos] = useState<Diseno[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas');
  const [selectedRamo, setSelectedRamo] = useState<string>('todos');
  const [selectedTipo, setSelectedTipo] = useState<string>('todos');
  const [showNuevaPlantillaModal, setShowNuevaPlantillaModal] = useState(false);
  const [showPersonalizarModal, setShowPersonalizarModal] = useState(false);
  const [selectedPlantilla, setSelectedPlantilla] = useState<Plantilla | null>(null);
  const [showPlanBlock, setShowPlanBlock] = useState(false);

  const isAdmin = tienePermisoAdminEnModulo(usuario, MODULOS.PUBLICIDAD);
  const isAgente = usuario?.rol === 'Agente';
  const hasPlanPremium = usuario?.plan_mkt_premium || false;

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    if (activeTab === 'biblioteca') {
      await loadPlantillas();
    } else {
      await loadDisenos();
    }
    setLoading(false);
  };

  const loadPlantillas = async () => {
    let query = supabase
      .from('publicidad_plantillas')
      .select('*')
      .eq('activa', true)
      .order('created_at', { ascending: false });

    if (selectedCategoria !== 'todas') {
      query = query.eq('categoria', selectedCategoria);
    }

    if (selectedRamo !== 'todos') {
      query = query.eq('ramo', selectedRamo);
    }

    if (selectedTipo !== 'todos') {
      query = query.eq('tipo', selectedTipo);
    }

    const { data } = await query;
    if (!data) {
      setPlantillas([]);
      return;
    }

    if (isAdmin) {
      setPlantillas(data);
    } else {
      const userOfficeId = usuario?.oficina_id;
      const filtered = await filterByOfficeVisibility(data, userOfficeId);
      setPlantillas(filtered);
    }
  };

  const filterByOfficeVisibility = async (items: Plantilla[], userOfficeId?: string): Promise<Plantilla[]> => {
    if (!userOfficeId) return items.filter(p => p.visible_para_todas_las_oficinas);

    const restrictedIds = items
      .filter(p => !p.visible_para_todas_las_oficinas)
      .map(p => p.id);

    if (restrictedIds.length === 0) return items;

    const { data: allowedMappings } = await supabase
      .from('publicidad_plantilla_oficinas')
      .select('plantilla_id')
      .in('plantilla_id', restrictedIds)
      .eq('oficina_id', userOfficeId);

    const allowedSet = new Set((allowedMappings || []).map(m => m.plantilla_id));

    return items.filter(p =>
      p.visible_para_todas_las_oficinas || allowedSet.has(p.id)
    );
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
          categoria,
          ramo
        )
      `)
      .eq('usuario_id', usuario.id)
      .order('created_at', { ascending: false });

    if (data) setDisenos(data);
  };

  useEffect(() => {
    if (activeTab === 'biblioteca') {
      loadPlantillas();
    }
  }, [selectedCategoria, selectedRamo, selectedTipo]);

  const handleUsarPlantilla = (plantilla: Plantilla) => {
    if (isAgente && !hasPlanPremium) {
      setShowPlanBlock(true);
      return;
    }

    setSelectedPlantilla(plantilla);
    setShowPersonalizarModal(true);
  };

  const handleEliminarPlantilla = async (plantilla: Plantilla) => {
    if (!isAdmin) {
      alert('No tienes permisos para eliminar plantillas');
      return;
    }

    if (!confirm('¿Estás seguro de que deseas eliminar esta plantilla? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const { error } = await supabase.rpc('deactivate_plantilla', {
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

  const handleDescargarDiseno = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `diseno-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-accent mb-1 sm:mb-2">
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
                ? 'text-accent border-b-2 border-accent'
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
                ? 'text-accent border-b-2 border-accent'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Image className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Mis Diseños</span>
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'biblioteca' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-700">Filtros</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all min-h-[44px]"
              >
                <option value="todas">Todas las categorías</option>
                {CATEGORIAS_LIST.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={selectedRamo}
                onChange={(e) => setSelectedRamo(e.target.value)}
                className="px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all min-h-[44px]"
              >
                <option value="todos">Todos los ramos</option>
                {RAMOS_LIST.map(ramo => (
                  <option key={ramo} value={ramo}>{ramo}</option>
                ))}
              </select>
              <select
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
                className="px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all min-h-[44px]"
              >
                <option value="todos">Todos los tipos</option>
                <option value="imagen">Imágenes</option>
                <option value="video">Videos</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : plantillas.length === 0 ? (
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
              {plantillas.map(plantilla => (
                <div
                  key={plantilla.id}
                  className="bg-white rounded-xl sm:rounded-2xl shadow-soft border border-neutral-200 overflow-hidden hover:shadow-medium transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="relative aspect-[4/5] bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    {plantilla.miniatura_url ? (
                      <img
                        src={plantilla.miniatura_url}
                        alt={plantilla.titulo || plantilla.categoria}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full items-center justify-center absolute inset-0 ${plantilla.miniatura_url ? 'hidden' : 'flex'}`}>
                      {plantilla.tipo === 'imagen' ? (
                        <Image className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-300" />
                      ) : (
                        <Video className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-300" />
                      )}
                    </div>
                    <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 flex items-center justify-between">
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
                        plantilla.tipo === 'imagen'
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-teal-100 text-teal-700'
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
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="inline-block px-2 py-0.5 bg-neutral-100 text-neutral-700 text-xs rounded-lg font-medium">
                        {plantilla.categoria}
                      </span>
                      <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-lg font-medium">
                        {plantilla.ramo}
                      </span>
                    </div>
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
              <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
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
                  <div className="relative aspect-[4/5] bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    {diseno.archivo_resultante_url ? (
                      <img
                        src={diseno.archivo_resultante_url}
                        alt="Diseño personalizado"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full items-center justify-center absolute inset-0 ${diseno.archivo_resultante_url ? 'hidden' : 'flex'}`}>
                      <Image className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-300" />
                    </div>
                  </div>
                  <div className="p-3 sm:p-4">
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {diseno.publicidad_plantillas?.categoria && (
                        <span className="inline-block px-2 py-0.5 bg-neutral-100 text-neutral-700 text-xs rounded-lg font-medium">
                          {diseno.publicidad_plantillas.categoria}
                        </span>
                      )}
                      {diseno.publicidad_plantillas?.ramo && (
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-lg font-medium">
                          {diseno.publicidad_plantillas.ramo}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-600 mb-3">
                      {new Date(diseno.created_at).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDescargarDiseno(diseno.archivo_resultante_url || '')}
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

      <NuevaPlantillaModal
        isOpen={showNuevaPlantillaModal}
        onClose={() => setShowNuevaPlantillaModal(false)}
        onSuccess={() => {
          setShowNuevaPlantillaModal(false);
          loadData();
        }}
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
          trackPublicityCreated(selectedPlantilla?.categoria || 'publicidad');
          setSelectedPlantilla(null);
          setActiveTab('mis-disenos');
          loadData();
        }}
      />

      {showPlanBlock && (
        <PlanMKTPremiumBlock
          onClose={() => setShowPlanBlock(false)}
        />
      )}
    </div>
  );
}
