import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, Video, Filter, Play, Clock, Award } from 'lucide-react';

interface Category {
  id: string;
  nombre: string;
}

interface Lesson {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: { nombre: string } | null;
  miniatura_url: string | null;
  duracion: number;
  fecha_creacion: string;
  progreso?: number;
  completado?: boolean;
}

export function SegurosEducationOnDemand() {
  const { usuario } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [filteredLessons, setFilteredLessons] = useState<Lesson[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    fetchData();
  }, [usuario]);

  useEffect(() => {
    filterLessons();
  }, [searchTerm, selectedCategory, lessons]);

  const fetchData = async () => {
    if (!usuario) return;

    try {
      setLoading(true);

      // Fetch categories
      const { data: cats } = await supabase
        .from('seguros_categories')
        .select('*')
        .order('nombre');

      setCategories(cats || []);

      // Fetch lessons with progress
      const { data: lessonsData } = await supabase
        .from('seguros_lessons')
        .select(`
          *,
          categoria:seguros_categories(nombre)
        `)
        .order('fecha_creacion', { ascending: false });

      if (lessonsData) {
        // Get progress for each lesson
        const lessonsWithProgress = await Promise.all(
          lessonsData.map(async (lesson) => {
            const { data: progress } = await supabase
              .from('seguros_progress')
              .select('progreso, completado')
              .eq('lesson_id', lesson.id)
              .eq('user_id', usuario.id)
              .maybeSingle();

            return {
              ...lesson,
              progreso: progress?.progreso || 0,
              completado: progress?.completado || false,
            };
          })
        );

        setLessons(lessonsWithProgress);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLessons = () => {
    let filtered = [...lessons];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (lesson) =>
          lesson.titulo.toLowerCase().includes(term) ||
          (lesson.descripcion && lesson.descripcion.toLowerCase().includes(term))
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(
        (lesson) => lesson.categoria?.nombre === selectedCategory
      );
    }

    setFilteredLessons(filtered);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLessonClick = (lessonId: string) => {
    // In a full implementation, this would open a video player modal
    alert(`Abrir lección: ${lessonId}\n\nNOTA: El reproductor de video requiere configuración adicional de Supabase Storage para cargar videos.`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-600">Cargando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-800 flex items-center gap-2">
              <Video className="w-6 h-6 text-primary-600" />
              On Demand
            </h1>
            <p className="text-neutral-600 mt-1">Biblioteca de lecciones grabadas</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Subir Lección
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar lecciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.nombre}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Lessons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLessons.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Video className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500">
                {searchTerm || selectedCategory !== 'all'
                  ? 'No se encontraron lecciones'
                  : 'No hay lecciones disponibles'}
              </p>
            </div>
          ) : (
            filteredLessons.map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => handleLessonClick(lesson.id)}
                className="bg-white rounded-lg border border-neutral-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-neutral-200 relative overflow-hidden">
                  {lesson.miniatura_url ? (
                    <img
                      src={lesson.miniatura_url}
                      alt={lesson.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-16 h-16 text-neutral-400" />
                    </div>
                  )}

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 group-hover:scale-100">
                      <Play className="w-8 h-8 text-primary-600 ml-1" fill="currentColor" />
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {lesson.progreso > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-800 bg-opacity-50">
                      <div
                        className="h-full bg-primary-600"
                        style={{ width: `${lesson.progreso}%` }}
                      />
                    </div>
                  )}

                  {/* Completed Badge */}
                  {lesson.completado && (
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      Completado
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center gap-2 text-xs mb-2">
                    {lesson.categoria && (
                      <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded font-medium">
                        {lesson.categoria.nombre}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-neutral-500">
                      <Clock className="w-3 h-3" />
                      {formatDuration(lesson.duracion)}
                    </span>
                  </div>

                  <h3 className="font-semibold text-neutral-800 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
                    {lesson.titulo}
                  </h3>

                  {lesson.descripcion && (
                    <p className="text-sm text-neutral-600 line-clamp-2 mb-3">
                      {lesson.descripcion}
                    </p>
                  )}

                  {lesson.progreso > 0 && !lesson.completado && (
                    <div className="text-xs text-neutral-600">
                      <span className="font-medium">{Math.floor(lesson.progreso)}% visto</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upload Modal (Placeholder) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-xl font-bold text-neutral-800">Subir Nueva Lección</h2>
            </div>
            <div className="p-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> La funcionalidad completa de carga de videos requiere:
                </p>
                <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc">
                  <li>Configuración de Supabase Storage para videos</li>
                  <li>Procesamiento de videos en el servidor</li>
                  <li>Generación de miniaturas</li>
                  <li>Cálculo de duración del video</li>
                </ul>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
