import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Image, Video, Plus, ListFilter as Filter, Trash2, Palette } from 'lucide-react';
import { NuevaPlantillaModal } from '../components/NuevaPlantillaModal';
import { PersonalizarPlantillaModal } from '../components/PersonalizarPlantillaModal';
import { PlanMKTPremiumBlock } from '../components/PlanMKTPremiumBlock';
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';
import { trackPublicityCreated } from '../lib/activityLogger';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';

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
    <div className="space-y-4">
      <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              Publicidad
            </h2>
            <p className="text-sm text-neutral-500 dark:text-white/50 mt-0.5">
              Crea diseños personalizados con tu logo y texto
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowNuevaPlantillaModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Nueva Plantilla
            </Button>
          )}
        </div>

        <div className="flex overflow-x-auto space-x-1 border-b border-neutral-200 dark:border-white/8 -mb-px scrollbar-hide">
          <button
            onClick={() => setActiveTab('biblioteca')}
            className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${
              activeTab === 'biblioteca'
                ? 'text-accent border-accent'
                : 'border-transparent text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Palette className="w-4 h-4" />
              <span>Biblioteca</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('mis-disenos')}
            className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${
              activeTab === 'mis-disenos'
                ? 'text-accent border-accent'
                : 'border-transparent text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Image className="w-4 h-4" />
              <span>Mis Diseños</span>
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'biblioteca' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-neutral-500 dark:text-white/40" />
              <span className="text-sm font-medium text-neutral-700 dark:text-white/70">Filtros</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              >
                <option value="todas">Todas las categorias</option>
                {CATEGORIAS_LIST.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={selectedRamo}
                onChange={(e) => setSelectedRamo(e.target.value)}
                className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              >
                <option value="todos">Todos los ramos</option>
                {RAMOS_LIST.map(ramo => (
                  <option key={ramo} value={ramo}>{ramo}</option>
                ))}
              </select>
              <select
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
                className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              >
                <option value="todos">Todos los tipos</option>
                <option value="imagen">Imagenes</option>
                <option value="video">Videos</option>
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingState text="Cargando plantillas..." />
          ) : plantillas.length === 0 ? (
            <EmptyState
              icon={Palette}
              title="No hay plantillas disponibles"
              description={isAdmin ? 'Crea tu primera plantilla para comenzar' : 'Proximamente habra plantillas disponibles'}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plantillas.map(plantilla => (
                <div
                  key={plantilla.id}
                  className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 overflow-hidden hover:border-neutral-300 dark:hover:border-white/15 hover:shadow-sm transition-all duration-200"
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
                        <Image className="w-12 h-12 text-neutral-300 dark:text-white/20" />
                      ) : (
                        <Video className="w-12 h-12 text-neutral-300 dark:text-white/20" />
                      )}
                    </div>
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                        plantilla.tipo === 'imagen'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                          : 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300'
                      }`}>
                        {plantilla.tipo === 'imagen' ? 'Imagen' : 'Video'}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEliminarPlantilla(plantilla);
                          }}
                          className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                          title="Eliminar plantilla"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="inline-block px-2 py-0.5 bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-white/60 text-xs rounded-md font-medium">
                        {plantilla.categoria}
                      </span>
                      <span className="inline-block px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-md font-medium">
                        {plantilla.ramo}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleUsarPlantilla(plantilla)}
                    >
                      Usar este diseno
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'mis-disenos' && (
        <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4 sm:p-5">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white mb-4">
            Mis Disenos Personalizados
          </h2>
          {loading ? (
            <LoadingState text="Cargando disenos..." />
          ) : disenos.length === 0 ? (
            <EmptyState
              icon={Image}
              title="No tienes disenos personalizados"
              description="Crea tu primer diseno desde la biblioteca"
              action={{ label: 'Ir a la Biblioteca', onClick: () => setActiveTab('biblioteca') }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {disenos.map(diseno => (
                <div
                  key={diseno.id}
                  className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 overflow-hidden hover:border-neutral-300 dark:hover:border-white/15 hover:shadow-sm transition-all duration-200"
                >
                  <div className="relative aspect-[4/5] bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    {diseno.archivo_resultante_url ? (
                      <img
                        src={diseno.archivo_resultante_url}
                        alt="Diseno personalizado"
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
                      <Image className="w-12 h-12 text-neutral-300 dark:text-white/20" />
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {diseno.publicidad_plantillas?.categoria && (
                        <span className="inline-block px-2 py-0.5 bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-white/60 text-xs rounded-md font-medium">
                          {diseno.publicidad_plantillas.categoria}
                        </span>
                      )}
                      {diseno.publicidad_plantillas?.ramo && (
                        <span className="inline-block px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-md font-medium">
                          {diseno.publicidad_plantillas.ramo}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-white/40 mb-3">
                      {new Date(diseno.created_at).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDescargarDiseno(diseno.archivo_resultante_url || '')}
                      >
                        Descargar
                      </Button>
                      <button
                        onClick={() => handleEliminarDiseno(diseno)}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                        title="Eliminar diseno"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
export default Publicidad;
