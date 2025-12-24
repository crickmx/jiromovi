import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Video, Filter, Play, Clock, Award, Upload, X, Settings, ArrowLeft, Trash2, Edit2 } from 'lucide-react';
import { VideoPlayer } from '../components/VideoPlayer';

interface Category {
  id: string;
  nombre: string;
  descripcion?: string;
}

interface Oficina {
  id: string;
  nombre: string;
}

interface Lesson {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: { nombre: string; id: string } | null;
  miniatura_url: string | null;
  video_url: string;
  duracion: number;
  fecha_creacion: string;
  progreso?: number;
  completado?: boolean;
  tiempo_reproduccion?: number;
}

export function SegurosEducationOnDemand() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [filteredLessons, setFilteredLessons] = useState<Lesson[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    categoria_id: '',
    oficinas_asignadas: [] as string[],
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

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

      // Fetch oficinas
      const { data: ofis } = await supabase
        .from('oficinas')
        .select('id, nombre')
        .order('nombre');
      setOficinas(ofis || []);

      // Fetch lessons with progress
      const { data: lessonsData } = await supabase
        .from('seguros_lessons')
        .select(`
          *,
          categoria:seguros_categories(id, nombre)
        `)
        .order('fecha_creacion', { ascending: false });

      if (lessonsData) {
        const lessonsWithProgress = await Promise.all(
          lessonsData.map(async (lesson) => {
            const { data: progress } = await supabase
              .from('seguros_progress')
              .select('progreso, completado, tiempo_reproduccion')
              .eq('lesson_id', lesson.id)
              .eq('user_id', usuario.id)
              .maybeSingle();

            return {
              ...lesson,
              progreso: progress?.progreso || 0,
              completado: progress?.completado || false,
              tiempo_reproduccion: progress?.tiempo_reproduccion || 0,
            };
          })
        );

        setLessons(lessonsWithProgress);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('Error al cargar datos', 'error');
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
        (lesson) => lesson.categoria?.id === selectedCategory
      );
    }

    setFilteredLessons(filtered);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const { error } = await supabase
        .from('seguros_categories')
        .insert({
          nombre: newCategoryName,
          creado_por: usuario?.id,
        });

      if (error) throw error;

      showToast('Categoría creada', 'success');
      setNewCategoryName('');
      fetchData();
    } catch (error: any) {
      console.error('Error creating category:', error);
      showToast('Error al crear categoría', 'error');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const confirmDelete = window.confirm(
      '¿Estás seguro de eliminar esta categoría? Las lecciones asociadas no se eliminarán, pero perderán su categoría.'
    );

    if (!confirmDelete) return;

    try {
      // Primero, desasociar las lecciones de esta categoría
      const { error: updateError } = await supabase
        .from('seguros_lessons')
        .update({ categoria_id: null })
        .eq('categoria_id', categoryId);

      if (updateError) throw updateError;

      // Luego, eliminar la categoría
      const { error: deleteError } = await supabase
        .from('seguros_categories')
        .delete()
        .eq('id', categoryId);

      if (deleteError) throw deleteError;

      showToast('Categoría eliminada', 'success');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      showToast('Error al eliminar categoría', 'error');
    }
  };

  const uploadLargeFile = async (
    bucket: string,
    fileName: string,
    file: File,
    onProgress?: (progress: number) => void
  ) => {
    console.log(`[Upload] Starting upload to ${bucket}:`, {
      fileName,
      fileSize: file.size,
      fileSizeFormatted: file.size >= 1024 * 1024 * 1024
        ? `${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
        : `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      fileType: file.type,
      timestamp: new Date().toISOString()
    });

    try {
      // Supabase automatically handles large files using TUS protocol for files > 6MB
      const result = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'video/mp4'
        });

      if (result.error) {
        console.error('[Upload] Error from Supabase:', {
          error: result.error,
          message: result.error.message,
          statusCode: result.error.statusCode,
          details: result.error
        });
      } else {
        console.log('[Upload] Success:', result.data);
      }

      if (onProgress) onProgress(100);
      return result;
    } catch (error) {
      console.error('[Upload] Exception during upload:', error);
      throw error;
    }
  };

  const handleUploadLesson = async () => {
    if (editingLesson) {
      await handleUpdateLesson();
      return;
    }

    if (!videoFile || !formData.titulo || !formData.categoria_id) {
      showToast('Complete todos los campos requeridos', 'error');
      return;
    }

    // Final client-side validation
    const maxVideoSize = 10 * 1024 * 1024 * 1024; // 10GB
    const maxThumbnailSize = 500 * 1024 * 1024; // 500MB

    if (videoFile.size > maxVideoSize) {
      showToast(`El video (${(videoFile.size / (1024 * 1024 * 1024)).toFixed(2)} GB) excede el límite de 10GB`, 'error');
      return;
    }

    if (thumbnailFile && thumbnailFile.size > maxThumbnailSize) {
      showToast(`La miniatura (${(thumbnailFile.size / (1024 * 1024)).toFixed(2)} MB) excede el límite de 500MB`, 'error');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(5);

      console.log('[handleUploadLesson] Starting lesson upload process', {
        videoSize: videoFile.size,
        thumbnailSize: thumbnailFile?.size,
        titulo: formData.titulo
      });

      // Upload video with progress tracking
      const videoFileName = `${Date.now()}-${videoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      const videoResult = await uploadLargeFile(
        'seguros-videos',
        videoFileName,
        videoFile,
        (progress) => {
          setUploadProgress(5 + Math.floor(progress * 0.6)); // 5-65%
        }
      );

      if (videoResult.error) {
        console.error('[handleUploadLesson] Video upload failed:', videoResult.error);
        throw videoResult.error;
      }
      console.log('[handleUploadLesson] Video uploaded successfully');
      setUploadProgress(70);

      // Upload thumbnail if provided
      let thumbnailUrl = null;
      if (thumbnailFile) {
        console.log('[handleUploadLesson] Starting thumbnail upload');
        const thumbFileName = `${Date.now()}-${thumbnailFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: thumbError } = await supabase.storage
          .from('seguros-thumbnails')
          .upload(thumbFileName, thumbnailFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: thumbnailFile.type
          });

        if (thumbError) {
          console.error('[handleUploadLesson] Thumbnail upload failed:', thumbError);
          throw thumbError;
        }

        const { data: thumbPublicUrl } = supabase.storage
          .from('seguros-thumbnails')
          .getPublicUrl(thumbFileName);

        thumbnailUrl = thumbPublicUrl.publicUrl;
        console.log('[handleUploadLesson] Thumbnail uploaded successfully');
      }
      setUploadProgress(80);

      // Get video public URL
      const { data: videoPublicUrl } = supabase.storage
        .from('seguros-videos')
        .getPublicUrl(videoFileName);

      // Get video duration
      const videoDuration = await getVideoDuration(videoFile);
      setUploadProgress(90);

      // Create lesson record
      const { error: lessonError } = await supabase
        .from('seguros_lessons')
        .insert({
          titulo: formData.titulo,
          descripcion: formData.descripcion,
          categoria_id: formData.categoria_id || null,
          video_url: videoPublicUrl.publicUrl,
          miniatura_url: thumbnailUrl,
          duracion: Math.floor(videoDuration),
          oficinas_asignadas: formData.oficinas_asignadas,
          creado_por: usuario?.id,
        });

      if (lessonError) throw lessonError;
      setUploadProgress(100);

      showToast('Lección subida exitosamente', 'success');
      setShowUploadModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error uploading lesson:', error);
      showToast('Error al subir lección: ' + error.message, 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUpdateLesson = async () => {
    if (!editingLesson || !formData.titulo || !formData.categoria_id) {
      showToast('Complete todos los campos requeridos', 'error');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(5);

      let videoUrl = editingLesson.video_url;
      let thumbnailUrl = editingLesson.miniatura_url;
      let duration = editingLesson.duracion;

      if (videoFile) {
        const videoFileName = `${Date.now()}-${videoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const videoResult = await uploadLargeFile(
          'seguros-videos',
          videoFileName,
          videoFile,
          (progress) => {
            setUploadProgress(5 + Math.floor(progress * 0.5)); // 5-55%
          }
        );

        if (videoResult.error) throw videoResult.error;

        const { data: videoPublicUrl } = supabase.storage
          .from('seguros-videos')
          .getPublicUrl(videoFileName);

        videoUrl = videoPublicUrl.publicUrl;
        duration = Math.floor(await getVideoDuration(videoFile));
      }
      setUploadProgress(60);

      if (thumbnailFile) {
        const thumbFileName = `${Date.now()}-${thumbnailFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: thumbError } = await supabase.storage
          .from('seguros-thumbnails')
          .upload(thumbFileName, thumbnailFile);

        if (thumbError) throw thumbError;

        const { data: thumbPublicUrl } = supabase.storage
          .from('seguros-thumbnails')
          .getPublicUrl(thumbFileName);

        thumbnailUrl = thumbPublicUrl.publicUrl;
      }
      setUploadProgress(80);

      const { error: updateError } = await supabase
        .from('seguros_lessons')
        .update({
          titulo: formData.titulo,
          descripcion: formData.descripcion,
          categoria_id: formData.categoria_id || null,
          video_url: videoUrl,
          miniatura_url: thumbnailUrl,
          duracion: duration,
          oficinas_asignadas: formData.oficinas_asignadas,
        })
        .eq('id', editingLesson.id);

      if (updateError) throw updateError;
      setUploadProgress(100);

      showToast('Lección actualizada exitosamente', 'success');
      setShowUploadModal(false);
      resetForm();
      setEditingLesson(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating lesson:', error);
      showToast('Error al actualizar lección: ' + error.message, 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleEditLesson = (lesson: Lesson, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLesson(lesson);
    setFormData({
      titulo: lesson.titulo,
      descripcion: lesson.descripcion || '',
      categoria_id: lesson.categoria?.id || '',
      oficinas_asignadas: [],
    });
    setShowUploadModal(true);
  };

  const handleDeleteLesson = async (lesson: Lesson, e: React.MouseEvent) => {
    e.stopPropagation();

    const confirmDelete = window.confirm(
      `¿Estás seguro de eliminar la lección "${lesson.titulo}"? Esta acción no se puede deshacer.`
    );

    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('seguros_lessons')
        .delete()
        .eq('id', lesson.id);

      if (error) throw error;

      showToast('Lección eliminada exitosamente', 'success');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting lesson:', error);
      showToast('Error al eliminar lección: ' + error.message, 'error');
    }
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.src = URL.createObjectURL(file);
    });
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      descripcion: '',
      categoria_id: '',
      oficinas_asignadas: [],
    });
    setVideoFile(null);
    setThumbnailFile(null);
    setEditingLesson(null);
  };

  const handleLessonClick = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setShowVideoModal(true);
  };

  const handleProgressUpdate = async (progress: number, currentTime: number) => {
    if (!selectedLesson || !usuario) return;

    try {
      const { error } = await supabase
        .from('seguros_progress')
        .upsert({
          user_id: usuario.id,
          lesson_id: selectedLesson.id,
          progreso: Math.min(progress, 100),
          tiempo_reproduccion: Math.floor(currentTime),
          completado: progress >= 95,
          ultima_vista: new Date().toISOString(),
        }, {
          onConflict: 'user_id,lesson_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const handleVideoComplete = async () => {
    if (!selectedLesson || !usuario) return;

    try {
      await supabase
        .from('seguros_progress')
        .upsert({
          user_id: usuario.id,
          lesson_id: selectedLesson.id,
          progreso: 100,
          completado: true,
          ultima_vista: new Date().toISOString(),
        }, {
          onConflict: 'user_id,lesson_id'
        });

      showToast('¡Lección completada!', 'success');
      fetchData();
    } catch (error) {
      console.error('Error completing lesson:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    const toast = document.createElement('div');
    const bgColor = type === 'success'
      ? 'bg-emerald-500'
      : type === 'error'
      ? 'bg-red-500'
      : 'bg-amber-500';
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 max-w-md ${bgColor}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, type === 'warning' ? 5000 : 3000);
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
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/seguros-education')}
              className="p-2.5 text-ios-gray-600 hover:text-ios-gray-900 hover:bg-ios-gray-100 rounded-ios-lg transition-colors active:scale-95"
              title="Volver a Seguros Education"
            >
              <ArrowLeft className="w-5 h-5 stroke-[1.5]" />
            </button>
            <div>
              <h1 className="text-[28px] font-bold text-ios-gray-900 flex items-center gap-2 tracking-tight">
                <Video className="w-7 h-7 text-ios-blue stroke-[1.5]" />
                On Demand
              </h1>
              <p className="text-ios-gray-600 mt-1 text-[15px]">Biblioteca de lecciones grabadas</p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-ios-gray-100 text-ios-gray-900 rounded-ios-lg hover:bg-ios-gray-200 transition-colors text-[15px] font-medium active:scale-95"
              >
                <Settings className="w-4 h-4 stroke-[2]" />
                Categorías
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-ios-blue text-white rounded-ios-lg hover:bg-ios-blue-dark transition-colors text-[15px] font-medium active:scale-95 shadow-ios"
              >
                <Plus className="w-4 h-4 stroke-[2]" />
                Subir Lección
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ios-gray-500 stroke-[1.5]" />
              <input
                type="text"
                placeholder="Buscar lecciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-ios-gray-300 rounded-ios-lg focus:outline-none focus:border-ios-blue transition-colors text-[15px]"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ios-gray-500 stroke-[1.5]" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-ios-gray-300 rounded-ios-lg focus:outline-none focus:border-ios-blue transition-colors appearance-none text-[15px]"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Lessons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLessons.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="w-20 h-20 rounded-full bg-ios-gray-100 flex items-center justify-center mx-auto mb-4">
                <Video className="w-10 h-10 text-ios-gray-400 stroke-[1.5]" />
              </div>
              <p className="text-ios-gray-500 text-[15px]">
                {searchTerm || selectedCategory !== 'all'
                  ? 'No se encontraron lecciones'
                  : 'No hay lecciones disponibles'}
              </p>
            </div>
          ) : (
            filteredLessons.map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => handleLessonClick(lesson)}
                className="bg-white rounded-ios-xl border border-ios-gray-200/50 overflow-hidden hover:shadow-ios-lg transition-all duration-200 cursor-pointer group active:scale-[0.98]"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-ios-gray-100 relative overflow-hidden">
                  {lesson.miniatura_url ? (
                    <img
                      src={lesson.miniatura_url}
                      alt={lesson.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-16 h-16 text-ios-gray-300 stroke-[1.5]" />
                    </div>
                  )}

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100 shadow-ios-lg">
                      <Play className="w-8 h-8 text-ios-blue ml-1" fill="currentColor" />
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {lesson.progreso > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                      <div
                        className="h-full bg-ios-blue"
                        style={{ width: `${lesson.progreso}%` }}
                      />
                    </div>
                  )}

                  {/* Completed Badge */}
                  {lesson.completado && (
                    <div className="absolute top-3 right-3 bg-ios-green text-white px-2.5 py-1 rounded-ios text-[11px] font-semibold flex items-center gap-1 shadow-ios">
                      <Award className="w-3 h-3 stroke-[2]" />
                      Completado
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 text-[11px] mb-2">
                    <div className="flex items-center gap-2">
                      {lesson.categoria && (
                        <span className="px-2 py-1 bg-ios-blue/10 text-ios-blue rounded-ios font-semibold">
                          {lesson.categoria.nombre}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-ios-gray-600">
                        <Clock className="w-3.5 h-3.5 stroke-[1.5]" />
                        {formatDuration(lesson.duracion)}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleEditLesson(lesson, e)}
                          className="p-1.5 text-ios-blue hover:bg-ios-blue/10 rounded-ios transition-colors"
                          title="Editar lección"
                        >
                          <Edit2 className="w-3.5 h-3.5 stroke-[2]" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteLesson(lesson, e)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-ios transition-colors"
                          title="Eliminar lección"
                        >
                          <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="font-semibold text-ios-gray-900 mb-2 line-clamp-2 group-hover:text-ios-blue transition-colors text-[15px]">
                    {lesson.titulo}
                  </h3>

                  {lesson.descripcion && (
                    <p className="text-[13px] text-ios-gray-600 line-clamp-2 mb-3">
                      {lesson.descripcion}
                    </p>
                  )}

                  {lesson.progreso > 0 && !lesson.completado && (
                    <div className="text-[13px] text-ios-gray-600">
                      <span className="font-semibold">{Math.floor(lesson.progreso)}% visto</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Video Player Modal */}
      {showVideoModal && selectedLesson && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-ios flex items-center justify-center z-50 p-4 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="w-full max-w-4xl my-auto bg-white rounded-ios-xl sm:rounded-ios-2xl shadow-ios-xl overflow-hidden animate-scale-in max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="bg-ios-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-ios-gray-200/50 flex justify-between items-start gap-3 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-[17px] sm:text-[20px] font-semibold text-ios-gray-900 mb-1 line-clamp-1">
                  {selectedLesson.titulo}
                </h2>
                {selectedLesson.descripcion && (
                  <p className="text-[13px] sm:text-[15px] text-ios-gray-600 line-clamp-1 sm:line-clamp-2">
                    {selectedLesson.descripcion}
                  </p>
                )}
                <div className="flex items-center gap-2 sm:gap-3 mt-2">
                  {selectedLesson.categoria && (
                    <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 bg-ios-blue/10 text-ios-blue rounded-ios text-[11px] sm:text-[13px] font-medium">
                      {selectedLesson.categoria.nombre}
                    </span>
                  )}
                  <span className="flex items-center gap-1 sm:gap-1.5 text-ios-gray-600 text-[11px] sm:text-[13px]">
                    <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4 stroke-[1.5]" />
                    {formatDuration(selectedLesson.duracion)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowVideoModal(false);
                  setSelectedLesson(null);
                  fetchData();
                }}
                className="text-ios-gray-500 hover:text-ios-gray-900 hover:bg-ios-gray-200 p-1.5 sm:p-2 rounded-ios transition-all active:scale-95 flex-shrink-0"
                title="Cerrar"
              >
                <X className="w-5 h-5 stroke-[1.5]" />
              </button>
            </div>

            {/* Video Container */}
            <div className="bg-black flex-shrink-0">
              <VideoPlayer
                videoUrl={selectedLesson.video_url}
                initialTime={selectedLesson.tiempo_reproduccion || 0}
                onProgressUpdate={handleProgressUpdate}
                onComplete={handleVideoComplete}
              />
            </div>

            {/* Footer */}
            <div className="bg-ios-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-ios-gray-200/50 flex-shrink-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {selectedLesson.completado ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-ios-green/10 text-ios-green rounded-ios-lg text-[11px] sm:text-[13px] font-medium">
                      <Award className="w-3.5 sm:w-4 h-3.5 sm:h-4 stroke-[1.5]" />
                      Completado
                    </span>
                  ) : selectedLesson.progreso > 0 ? (
                    <span className="text-[11px] sm:text-[13px] text-ios-gray-600">
                      Progreso: <span className="font-semibold text-ios-blue">{Math.floor(selectedLesson.progreso)}%</span>
                    </span>
                  ) : (
                    <span className="text-[11px] sm:text-[13px] text-ios-gray-500">Sin progreso</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowVideoModal(false);
                    setSelectedLesson(null);
                    fetchData();
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-ios-blue text-white rounded-ios-lg text-[15px] font-medium hover:bg-ios-blue-dark transition-colors active:scale-95"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8">
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-xl font-bold text-neutral-800">
                {editingLesson ? 'Editar Lección' : 'Subir Nueva Lección'}
              </h2>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Nombre de la lección"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Descripción de la lección"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Categoría <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.categoria_id}
                  onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Oficinas Asignadas
                </label>
                <div className="border border-neutral-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.oficinas_asignadas.length === 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, oficinas_asignadas: [] });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">Todas las oficinas</span>
                  </label>
                  {oficinas.map((ofi) => (
                    <label key={ofi.id} className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={formData.oficinas_asignadas.includes(ofi.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              oficinas_asignadas: [...formData.oficinas_asignadas, ofi.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              oficinas_asignadas: formData.oficinas_asignadas.filter(
                                (id) => id !== ofi.id
                              ),
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{ofi.nombre}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Si no seleccionas ninguna oficina, la lección estará disponible para todos
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Video {!editingLesson && <span className="text-red-500">*</span>}
                  {editingLesson && <span className="text-neutral-500 text-xs">(opcional - dejar vacío para mantener el video actual)</span>}
                </label>
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) {
                        const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
                        if (file.size > maxSize) {
                          showToast('El archivo supera el límite de 5GB. Por favor, comprime el video o divide el contenido en lecciones más cortas.', 'error');
                          e.target.value = '';
                          return;
                        }
                        // Advertencia para archivos muy grandes
                        if (file.size > 1024 * 1024 * 1024) { // > 1GB
                          const sizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(2);
                          showToast(`Archivo de ${sizeGB}GB detectado. La subida puede tomar varios minutos. Por favor no cierres esta ventana.`, 'warning');
                        }
                      }
                      setVideoFile(file);
                    }}
                    className="hidden"
                    id="video-upload"
                  />
                  <label htmlFor="video-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-2" />
                    {videoFile ? (
                      <>
                        <p className="text-sm text-neutral-900 font-medium truncate max-w-md">{videoFile.name}</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {videoFile.size >= 1024 * 1024 * 1024
                            ? `${(videoFile.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
                            : `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB`
                          }
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-neutral-600">
                          {editingLesson ? 'Click para cambiar el video (MP4, WebM, MOV, AVI)' : 'Click para subir video (MP4, WebM, MOV, AVI)'}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          Tamaño máximo: 5GB
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Miniatura (opcional)
                </label>
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="thumbnail-upload"
                  />
                  <label htmlFor="thumbnail-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-2" />
                    <p className="text-sm text-neutral-600">
                      {thumbnailFile ? thumbnailFile.name : 'Click para subir imagen (JPG, PNG, WebP)'}
                    </p>
                  </label>
                </div>
              </div>

              {uploading && (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-primary-800">
                        {uploadProgress < 70 ? 'Subiendo video...' : uploadProgress < 80 ? 'Procesando...' : 'Finalizando...'}
                      </span>
                      {videoFile && (
                        <span className="text-xs text-primary-600 mt-1">
                          {videoFile.size >= 1024 * 1024 * 1024
                            ? `${(videoFile.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
                            : `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB`
                          }
                          {videoFile.size > 500 * 1024 * 1024 && ' - Esto puede tomar varios minutos'}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-primary-800">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-primary-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  {videoFile && videoFile.size > 1024 * 1024 * 1024 && (
                    <p className="text-xs text-primary-700 mt-2">
                      No cierres esta ventana hasta que termine la subida
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-neutral-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetForm();
                }}
                disabled={uploading}
                className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleUploadLesson}
                disabled={uploading || (!editingLesson && !videoFile) || !formData.titulo || !formData.categoria_id}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (editingLesson ? 'Actualizando...' : 'Subiendo...') : (editingLesson ? 'Actualizar Lección' : 'Subir Lección')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-ios flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-ios-2xl shadow-ios-xl max-w-md w-full animate-scale-in">
            <div className="bg-ios-gray-50 px-6 py-5 border-b border-ios-gray-200/50">
              <h2 className="text-[22px] font-bold text-ios-gray-900">Gestionar Categorías</h2>
              <p className="text-[13px] text-ios-gray-600 mt-1">Crea y elimina categorías de lecciones</p>
            </div>

            <div className="p-6">
              <div className="mb-5">
                <label className="block text-[15px] font-semibold text-ios-gray-900 mb-2">
                  Nueva Categoría
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateCategory()}
                    className="flex-1 px-4 py-2.5 border border-ios-gray-300 rounded-ios-lg focus:outline-none focus:border-ios-blue transition-colors text-[15px]"
                    placeholder="Nombre de la categoría"
                  />
                  <button
                    onClick={handleCreateCategory}
                    disabled={!newCategoryName.trim()}
                    className="px-4 py-2.5 bg-ios-blue text-white rounded-ios-lg hover:bg-ios-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[15px] font-medium active:scale-95 shadow-ios"
                  >
                    Crear
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                <p className="text-[15px] font-semibold text-ios-gray-900 mb-3">Categorías Existentes</p>
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 bg-ios-gray-50 rounded-ios-lg border border-ios-gray-200/50 hover:bg-ios-gray-100 transition-colors"
                  >
                    <span className="text-[15px] text-ios-gray-900 font-medium">{cat.nombre}</span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-2 text-ios-red hover:bg-ios-red/10 rounded-ios transition-all active:scale-95"
                      title="Eliminar categoría"
                    >
                      <Trash2 className="w-4 h-4 stroke-[2]" />
                    </button>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-[15px] text-ios-gray-500 text-center py-8">
                    No hay categorías creadas
                  </p>
                )}
              </div>
            </div>

            <div className="bg-ios-gray-50 px-6 py-4 border-t border-ios-gray-200/50 flex justify-end">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                }}
                className="px-5 py-2.5 bg-ios-gray-200 text-ios-gray-900 rounded-ios-lg hover:bg-ios-gray-300 transition-colors text-[15px] font-medium active:scale-95"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
