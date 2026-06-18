import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { trackCourseStart } from '../lib/activityLogger';
import { Search, Plus, Video, ListFilter as Filter, Play, Clock, Award, Upload, X, Settings, Trash2, CreditCard as Edit2, FileText } from 'lucide-react';
import { VideoPlayer } from '../components/VideoPlayer';
import { LessonDocuments } from '../components/segurosEducation/LessonDocuments';
import { analyticsTracker } from '../lib/analyticsTracker';
import { SegurosEducationLayout } from '../components/segurosEducation/SegurosEducationLayout';

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
  categorias: { nombre: string; id: string }[];
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
  const [recalculatingDurations, setRecalculatingDurations] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState({ current: 0, total: 0 });

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    categoria_ids: [] as string[],
    oficinas_asignadas: [] as string[],
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [pendingDocuments, setPendingDocuments] = useState<File[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminPermissions();
    fetchData();
  }, [usuario]);

  const checkAdminPermissions = async () => {
    if (!usuario) {
      setIsAdmin(false);
      return;
    }

    // Si es administrador global, tiene todos los permisos
    if (usuario.rol === 'Administrador') {
      setIsAdmin(true);
      return;
    }

    // Si es gerente, verificar permisos adicionales en el módulo
    if (usuario.rol === 'Gerente') {
      try {
        const { data, error } = await supabase.rpc('tiene_permiso_admin_en_modulo', {
          p_usuario_id: usuario.id,
          p_modulo_codigo: 'seguros_education'
        });

        if (!error && data) {
          setIsAdmin(true);
          return;
        }
      } catch (error) {
        console.error('Error verificando permisos:', error);
      }
    }

    setIsAdmin(false);
  };

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

      // Fetch lessons with progress and categories
      const { data: lessonsData } = await supabase
        .from('seguros_lessons')
        .select('*')
        .order('fecha_creacion', { ascending: false });

      if (lessonsData) {
        const lessonsWithProgress = await Promise.all(
          lessonsData.map(async (lesson) => {
            // Get progress
            const { data: progress } = await supabase
              .from('seguros_progress')
              .select('progreso, completado, tiempo_reproduccion')
              .eq('lesson_id', lesson.id)
              .eq('user_id', usuario.id)
              .maybeSingle();

            // Get categories via junction table
            const { data: lessonCategories } = await supabase
              .from('seguros_lesson_categories')
              .select(`
                category_id,
                seguros_categories(id, nombre)
              `)
              .eq('lesson_id', lesson.id);

            const categorias = lessonCategories?.map(lc => ({
              id: lc.seguros_categories.id,
              nombre: lc.seguros_categories.nombre
            })) || [];

            return {
              ...lesson,
              categorias,
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
        (lesson) => lesson.categorias?.some(cat => cat.id === selectedCategory)
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
      '¿Estás seguro de eliminar esta categoría? Las lecciones asociadas no se eliminarán, pero perderán esta categoría.'
    );

    if (!confirmDelete) return;

    try {
      // Eliminar la categoría (las relaciones en seguros_lesson_categories se eliminarán automáticamente por CASCADE)
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

    // For large files in development environment, show warning
    const isLargeFile = file.size > 100 * 1024 * 1024; // 100MB
    if (isLargeFile && window.location.hostname.includes('webcontainer')) {
      console.warn('[Upload] Large file upload in WebContainer may fail due to HTTP/2 limitations');
      showToast('Advertencia: Archivos grandes pueden fallar en este entorno de desarrollo', 'warning');
    }

    const MAX_RETRIES = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Upload] Attempt ${attempt}/${MAX_RETRIES}`);

        // Use standard upload - Supabase automatically handles TUS for files > 6MB
        const result = await supabase.storage
          .from(bucket)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'video/mp4'
          });

        if (result.error) {
          console.error(`[Upload] Attempt ${attempt} error:`, {
            error: result.error,
            message: result.error.message,
            statusCode: result.error.statusCode
          });

          lastError = result.error;

          // Check for specific errors
          if (result.error.message?.includes('HTTP2') ||
              result.error.message?.includes('protocol') ||
              result.error.message?.includes('Failed to fetch')) {

            // This is a network/protocol error - wait before retry
            if (attempt < MAX_RETRIES) {
              const waitTime = attempt * 2000; // Progressive backoff: 2s, 4s, 6s
              console.log(`[Upload] Network error, waiting ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            } else {
              throw new Error(
                'Error de red al subir el video. Esto puede ocurrir en entornos de desarrollo con archivos grandes. ' +
                'En producción, este problema no debería ocurrir. Si persiste, contacta soporte.'
              );
            }
          }

          // Other errors - don't retry
          throw result.error;
        }

        // Success!
        console.log(`[Upload] Success on attempt ${attempt}:`, result.data);
        if (onProgress) onProgress(100);
        return result;

      } catch (error: any) {
        console.error(`[Upload] Exception on attempt ${attempt}:`, error);
        lastError = error;

        // If it's the last attempt, throw the error
        if (attempt === MAX_RETRIES) {
          break;
        }

        // Wait before next retry
        const waitTime = attempt * 2000;
        console.log(`[Upload] Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // All retries failed
    console.error('[Upload] All retry attempts failed:', lastError);
    throw lastError;
  };

  const handleUploadLesson = async () => {
    if (editingLesson) {
      await handleUpdateLesson();
      return;
    }

    if (!videoFile || !formData.titulo || formData.categoria_ids.length === 0) {
      showToast('Complete todos los campos requeridos (incluyendo al menos una categoría)', 'error');
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

        // Use uploadLargeFile for consistency and retry logic
        const thumbnailResult = await uploadLargeFile(
          'seguros-thumbnails',
          thumbFileName,
          thumbnailFile,
          (progress) => {
            setUploadProgress(70 + Math.floor(progress * 0.1)); // 70-80%
          }
        );

        if (thumbnailResult.error) {
          console.error('[handleUploadLesson] Thumbnail upload failed:', thumbnailResult.error);
          throw thumbnailResult.error;
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
      const { data: newLesson, error: lessonError } = await supabase
        .from('seguros_lessons')
        .insert({
          titulo: formData.titulo,
          descripcion: formData.descripcion,
          video_url: videoPublicUrl.publicUrl,
          miniatura_url: thumbnailUrl,
          duracion: Math.floor(videoDuration),
          oficinas_asignadas: formData.oficinas_asignadas,
          creado_por: usuario?.id,
        })
        .select()
        .single();

      if (lessonError) throw lessonError;

      // Assign categories to the lesson
      const { error: categoriesError } = await supabase.rpc('assign_lesson_categories', {
        p_lesson_id: newLesson.id,
        p_category_ids: formData.categoria_ids
      });

      if (categoriesError) {
        console.error('Error assigning categories:', categoriesError);
        // No throw - lesson was created successfully, just log the error
      }

      setUploadProgress(95);

      // Upload pending documents if any
      if (pendingDocuments.length > 0 && newLesson) {
        console.log(`Uploading ${pendingDocuments.length} pending documents...`);
        for (let i = 0; i < pendingDocuments.length; i++) {
          const doc = pendingDocuments[i];
          try {
            // Add small delay to ensure unique timestamps
            await new Promise(resolve => setTimeout(resolve, 10));
            const docFileName = `${Date.now()}-${doc.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

            const { error: docUploadError } = await supabase.storage
              .from('seguros-lesson-documents')
              .upload(docFileName, doc);

            if (docUploadError) {
              console.error(`Error uploading document ${doc.name}:`, docUploadError);
              continue;
            }

            const { data: docPublicUrl } = supabase.storage
              .from('seguros-lesson-documents')
              .getPublicUrl(docFileName);

            const { error: docInsertError } = await supabase
              .from('seguros_lesson_documents')
              .insert({
                lesson_id: newLesson.id,
                nombre_archivo: doc.name,
                archivo_url: docPublicUrl.publicUrl,
                tipo_archivo: doc.type,
                tamano_bytes: doc.size,
                orden: i,
              });

            if (docInsertError) {
              console.error(`Error saving document ${doc.name}:`, docInsertError);
            }
          } catch (error) {
            console.error(`Exception uploading document ${doc.name}:`, error);
          }
        }
      }

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
    if (!editingLesson || !formData.titulo || formData.categoria_ids.length === 0) {
      showToast('Complete todos los campos requeridos (incluyendo al menos una categoría)', 'error');
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

        // Use uploadLargeFile for consistency and retry logic
        const thumbnailResult = await uploadLargeFile(
          'seguros-thumbnails',
          thumbFileName,
          thumbnailFile,
          (progress) => {
            setUploadProgress(60 + Math.floor(progress * 0.2)); // 60-80%
          }
        );

        if (thumbnailResult.error) throw thumbnailResult.error;

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
          video_url: videoUrl,
          miniatura_url: thumbnailUrl,
          duracion: duration,
          oficinas_asignadas: formData.oficinas_asignadas,
        })
        .eq('id', editingLesson.id);

      if (updateError) throw updateError;

      // Update categories
      const { error: categoriesError } = await supabase.rpc('assign_lesson_categories', {
        p_lesson_id: editingLesson.id,
        p_category_ids: formData.categoria_ids
      });

      if (categoriesError) {
        console.error('Error updating categories:', categoriesError);
        // No throw - lesson was updated successfully, just log the error
      }

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
      categoria_ids: lesson.categorias?.map(c => c.id) || [],
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

  const getVideoDurationFromUrl = (url: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;

      const timeout = setTimeout(() => {
        video.src = '';
        reject(new Error('Timeout al cargar el video'));
      }, 30000);

      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        const duration = video.duration;
        video.src = '';
        resolve(duration);
      };

      video.onerror = (e) => {
        clearTimeout(timeout);
        video.src = '';
        console.error('Error cargando video:', e);
        reject(new Error('Error al cargar el video'));
      };

      video.src = url;
      video.load();
    });
  };

  const recalculateAllDurations = async () => {
    const confirmRecalc = window.confirm(
      '¿Deseas recalcular la duración de todas las lecciones que no tienen duración definida? Esto puede tomar varios minutos.'
    );

    if (!confirmRecalc) return;

    try {
      setRecalculatingDurations(true);

      // Obtener todas las lecciones sin duración
      const lessonsWithoutDuration = lessons.filter(l => !l.duracion || l.duracion === 0);
      setRecalcProgress({ current: 0, total: lessonsWithoutDuration.length });

      if (lessonsWithoutDuration.length === 0) {
        showToast('Todas las lecciones ya tienen duración calculada', 'success');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < lessonsWithoutDuration.length; i++) {
        const lesson = lessonsWithoutDuration[i];
        setRecalcProgress({ current: i + 1, total: lessonsWithoutDuration.length });

        try {
          const duration = await getVideoDurationFromUrl(lesson.video_url);

          if (duration && duration > 0) {
            const { error } = await supabase
              .from('seguros_lessons')
              .update({ duracion: Math.floor(duration) })
              .eq('id', lesson.id);

            if (error) {
              console.error(`Error actualizando lección ${lesson.titulo}:`, error);
              errorCount++;
            } else {
              successCount++;
            }
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`Error obteniendo duración de ${lesson.titulo}:`, error);
          errorCount++;
        }

        // Pequeña pausa para no saturar el navegador
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      showToast(
        `Proceso completado: ${successCount} actualizadas, ${errorCount} errores`,
        errorCount > 0 ? 'warning' : 'success'
      );

      // Recargar datos
      await fetchData();
    } catch (error: any) {
      console.error('Error recalculando duraciones:', error);
      showToast('Error al recalcular duraciones', 'error');
    } finally {
      setRecalculatingDurations(false);
      setRecalcProgress({ current: 0, total: 0 });
    }
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      descripcion: '',
      categoria_ids: [],
      oficinas_asignadas: [],
    });
    setVideoFile(null);
    setThumbnailFile(null);
    setEditingLesson(null);
    setPendingDocuments([]);
  };

  const handleLessonClick = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setShowVideoModal(true);

    // Track lesson view start
    analyticsTracker.trackLessonViewStart(lesson.id, lesson.duracion);
    trackCourseStart(lesson.id, lesson.titulo);
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

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds || seconds <= 0) return null;

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
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
      <>
        <SegurosEducationLayout sectionTitle="On Demand" sectionDescription="Biblioteca de lecciones grabadas">
          <div className="flex justify-center items-center py-16">
            <div className="w-8 h-8 border-[3px] border-[#1C37E0]/20 border-t-[#1C37E0] rounded-full animate-spin" />
          </div>
        </SegurosEducationLayout>
      </>
    );
  }

  return (
    <>
      <SegurosEducationLayout sectionTitle="On Demand" sectionDescription="Biblioteca de lecciones grabadas">
      <div className="space-y-5">
        {/* Section header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">Lecciones disponibles</h2>
            <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5">{filteredLessons.length} lección{filteredLessons.length !== 1 ? 'es' : ''}</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-white/8 text-neutral-700 dark:text-white/70 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/12 transition-colors text-xs font-semibold"
              >
                <Settings className="w-3.5 h-3.5" />
                Categorías
              </button>
              <button
                onClick={recalculateAllDurations}
                disabled={recalculatingDurations || lessons.filter(l => !l.duracion || l.duracion === 0).length === 0}
                className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-white/8 text-neutral-700 dark:text-white/70 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/12 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                title="Recalcular duraciones de videos sin duración"
              >
                <Clock className="w-3.5 h-3.5" />
                {recalculatingDurations ? `${recalcProgress.current}/${recalcProgress.total}` : 'Recalc. duraciones'}
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1C37E0] text-white text-xs font-semibold hover:bg-[#1630C8] transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Subir lección
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar lecciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] rounded-xl text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#1C37E0]/30 focus:border-[#1C37E0] transition-all"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] rounded-xl text-sm text-neutral-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#1C37E0]/30 focus:border-[#1C37E0] transition-all"
            >
              <option value="all">Todas las categorias</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lessons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLessons.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-white/[0.03] rounded-2xl border-2 border-dashed border-neutral-200 dark:border-white/10 p-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Video className="w-6 h-6 text-neutral-400" />
              </div>
              <h3 className="text-base font-bold text-neutral-700 dark:text-white/70 mb-1">Sin lecciones</h3>
              <p className="text-sm text-neutral-400">
                {searchTerm || selectedCategory !== 'all'
                  ? 'No se encontraron lecciones con estos filtros'
                  : 'No hay lecciones disponibles en este momento'}
              </p>
            </div>
          ) : (
            filteredLessons.map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => handleLessonClick(lesson)}
                className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/60 dark:border-white/[0.07] overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-neutral-100 dark:bg-white/5 relative overflow-hidden">
                  {lesson.miniatura_url ? (
                    <img
                      src={lesson.miniatura_url}
                      alt={lesson.titulo}
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-white/5 dark:to-white/10">
                      <Video className="w-12 h-12 text-neutral-300 dark:text-white/20" />
                    </div>
                  )}

                  {/* Play overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all flex items-center justify-center">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-xl">
                      <Play className="w-6 h-6 text-[#1C37E0] ml-0.5" fill="currentColor" />
                    </div>
                  </div>

                  {/* Progress bar */}
                  {lesson.progreso > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                      <div className="h-full bg-[#1C37E0]" style={{ width: `${lesson.progreso}%` }} />
                    </div>
                  )}

                  {/* Completed badge */}
                  {lesson.completado && (
                    <div className="absolute top-2.5 right-2.5 bg-emerald-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      Completado
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                      {lesson.categorias && lesson.categorias.length > 0 && lesson.categorias.slice(0, 2).map(cat => (
                        <span key={cat.id} className="px-2 py-0.5 bg-[#1C37E0]/10 text-[#1C37E0] dark:text-blue-400 rounded-md text-[10px] font-semibold">
                          {cat.nombre}
                        </span>
                      ))}
                      {lesson.duracion && lesson.duracion > 0 ? (
                        <span className="flex items-center gap-1 text-neutral-500 dark:text-white/40 text-[10px] font-medium">
                          <Clock className="w-3 h-3" />
                          {formatDuration(lesson.duracion)}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 px-1.5 py-0.5 rounded-md text-[10px] font-medium">
                          <Clock className="w-3 h-3" />
                          Sin duración
                        </span>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => handleEditLesson(lesson, e)}
                          className="p-1.5 text-neutral-400 hover:text-[#1C37E0] hover:bg-[#1C37E0]/10 rounded-lg transition-colors"
                          title="Editar lección"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteLesson(lesson, e)}
                          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Eliminar lección"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-1.5 line-clamp-2 group-hover:text-[#1C37E0] transition-colors text-sm">
                    {lesson.titulo}
                  </h3>

                  {lesson.descripcion && (
                    <p className="text-xs text-neutral-500 dark:text-white/40 line-clamp-2 mb-2">
                      {lesson.descripcion}
                    </p>
                  )}

                  {lesson.progreso > 0 && !lesson.completado && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-neutral-500 dark:text-white/40">Progreso</span>
                        <span className="text-[10px] font-semibold text-[#1C37E0]">{Math.floor(lesson.progreso)}%</span>
                      </div>
                      <div className="h-1 bg-neutral-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#1C37E0] rounded-full" style={{ width: `${lesson.progreso}%` }} />
                      </div>
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
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-ios flex items-center justify-center z-50 animate-fade-in p-0 sm:p-4"
        >
          <div className="w-full h-full sm:w-[95vw] sm:h-[90vh] lg:w-[1200px] lg:h-[720px] bg-white sm:rounded-2xl shadow-ios-xl overflow-hidden animate-scale-in flex flex-col">
            {/* Header - minimizado en móvil */}
            <div className="bg-ios-gray-50 px-3 sm:px-6 py-2 sm:py-3 border-b border-ios-gray-200/50 flex justify-between items-center gap-2 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-[14px] sm:text-[18px] font-semibold text-ios-gray-900 truncate">
                  {selectedLesson.titulo}
                </h2>
                <div className="hidden md:flex items-center gap-2 mt-1 flex-wrap">
                  {selectedLesson.categorias && selectedLesson.categorias.length > 0 && selectedLesson.categorias.map(cat => (
                    <span key={cat.id} className="inline-flex items-center px-2 py-0.5 bg-accent/10 text-accent rounded-ios text-[11px] font-medium">
                      {cat.nombre}
                    </span>
                  ))}
                  {formatDuration(selectedLesson.duracion) && (
                    <span className="flex items-center gap-1 text-ios-gray-600 text-[11px]">
                      <Clock className="w-3.5 h-3.5 stroke-[1.5]" />
                      {formatDuration(selectedLesson.duracion)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowVideoModal(false);
                  setSelectedLesson(null);
                  fetchData();
                }}
                className="text-ios-gray-500 hover:text-ios-gray-900 hover:bg-ios-gray-200 p-1.5 rounded-ios transition-all active:scale-95 flex-shrink-0"
                title="Cerrar"
              >
                <X className="w-5 h-5 stroke-[2]" />
              </button>
            </div>

            {/* Video Container - con altura fija y minima */}
            <div className="bg-black w-full flex-1 min-h-0 relative">
              <VideoPlayer
                videoUrl={selectedLesson.video_url}
                initialTime={selectedLesson.tiempo_reproduccion || 0}
                onProgressUpdate={handleProgressUpdate}
                onComplete={handleVideoComplete}
                lessonId={selectedLesson.id}
              />
            </div>

            {/* Footer - super compacto en móvil */}
            <div className="bg-ios-gray-50 px-3 sm:px-6 py-2 border-t border-ios-gray-200/50 flex-shrink-0 max-h-[30vh] overflow-y-auto">
              <div className="flex flex-col gap-2">
                {/* Progress row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedLesson.completado ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-ios-green/10 text-ios-green rounded-ios text-[10px] sm:text-[12px] font-medium">
                        <Award className="w-3 h-3 stroke-[1.5]" />
                        <span className="hidden sm:inline">Completado</span>
                      </span>
                    ) : selectedLesson.progreso > 0 ? (
                      <span className="text-[10px] sm:text-[12px] text-ios-gray-600">
                        Progreso: <span className="font-semibold text-accent">{Math.floor(selectedLesson.progreso)}%</span>
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-[12px] text-ios-gray-500">Sin progreso</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowVideoModal(false);
                      setSelectedLesson(null);
                      fetchData();
                    }}
                    className="px-3 sm:px-4 py-1 sm:py-1.5 bg-accent text-white rounded-ios text-[12px] sm:text-[14px] font-medium hover:bg-accent-dark transition-colors active:scale-95 flex-shrink-0"
                  >
                    Cerrar
                  </button>
                </div>

                {/* Documents row */}
                <div className="border-t border-ios-gray-200/50 pt-2">
                  <LessonDocuments
                    lessonId={selectedLesson.id}
                    isAdmin={isAdmin}
                    isEditMode={false}
                  />
                </div>
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
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
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
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  placeholder="Descripción de la lección"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Categorías <span className="text-red-500">*</span>
                  <span className="text-xs text-neutral-500 ml-2">(Selecciona una o más)</span>
                </label>
                <div className="border border-neutral-300 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-neutral-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={formData.categoria_ids.includes(cat.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              categoria_ids: [...formData.categoria_ids, cat.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              categoria_ids: formData.categoria_ids.filter(id => id !== cat.id)
                            });
                          }
                        }}
                        className="w-4 h-4 text-accent focus:ring-2 focus:ring-accent rounded"
                      />
                      <span className="text-sm text-neutral-700">{cat.nombre}</span>
                    </label>
                  ))}
                  {categories.length === 0 && (
                    <p className="text-sm text-neutral-500 text-center py-2">
                      No hay categorías disponibles. Crea una primero.
                    </p>
                  )}
                </div>
                {formData.categoria_ids.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.categoria_ids.map(catId => {
                      const cat = categories.find(c => c.id === catId);
                      return cat ? (
                        <span
                          key={catId}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent text-xs rounded-full"
                        >
                          {cat.nombre}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
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
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-accent transition-colors">
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) {
                        const maxSize = 10 * 1024 * 1024 * 1024; // 10GB (matching backend)
                        if (file.size > maxSize) {
                          showToast('El archivo supera el límite de 10GB. Por favor, comprime el video o divide el contenido en lecciones más cortas.', 'error');
                          e.target.value = '';
                          return;
                        }

                        // Warning for large files in development environment
                        if (file.size > 100 * 1024 * 1024) {
                          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                          const isWebContainer = window.location.hostname.includes('webcontainer') ||
                                                 window.location.hostname.includes('stackblitz');

                          if (isWebContainer) {
                            showToast(
                              `Archivo de ${sizeMB}MB detectado. IMPORTANTE: En este entorno de desarrollo, ` +
                              `archivos mayores a 100MB pueden fallar por limitaciones de HTTP/2. ` +
                              `Si el upload falla, por favor usa un archivo más pequeño o prueba en producción.`,
                              'warning'
                            );
                          } else {
                            showToast(
                              `Archivo de ${sizeMB}MB detectado. La subida puede tomar varios minutos. ` +
                              `Por favor no cierres esta ventana.`,
                              'warning'
                            );
                          }
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
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-accent transition-colors">
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

              {/* Lesson Documents Section */}
              <div className="border-t border-neutral-200 pt-4">
                {editingLesson ? (
                  <LessonDocuments
                    lessonId={editingLesson.id}
                    isAdmin={isAdmin}
                    isEditMode={true}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-700">
                          Documentos de Apoyo
                        </h3>
                        <p className="text-xs text-neutral-500 mt-1">
                          {pendingDocuments.length}/5 documentos preparados
                        </p>
                      </div>
                    </div>

                    {/* Upload section for new lesson */}
                    {pendingDocuments.length < 5 && (
                      <div className="border-2 border-dashed border-neutral-300 rounded-lg p-4 text-center hover:border-accent transition-colors">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && pendingDocuments.length < 5) {
                              setPendingDocuments([...pendingDocuments, file]);
                              e.target.value = '';
                            } else if (pendingDocuments.length >= 5) {
                              showToast('Solo puedes agregar máximo 5 documentos', 'error');
                            }
                          }}
                          className="hidden"
                          id="pending-document-upload"
                        />
                        <label htmlFor="pending-document-upload" className="cursor-pointer">
                          <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                          <p className="text-sm text-neutral-600">
                            Click para agregar documento
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">
                            PDF, Word, Excel, PowerPoint, TXT, ZIP, RAR
                          </p>
                        </label>
                      </div>
                    )}

                    {/* Pending documents list */}
                    {pendingDocuments.length > 0 && (
                      <div className="space-y-2">
                        {pendingDocuments.map((doc, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200 hover:bg-neutral-100 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="text-accent">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-neutral-900 truncate">
                                  {doc.name}
                                </p>
                                <p className="text-xs text-neutral-500">
                                  {doc.size < 1024 ? doc.size + ' B'
                                    : doc.size < 1024 * 1024 ? (doc.size / 1024).toFixed(1) + ' KB'
                                    : (doc.size / (1024 * 1024)).toFixed(1) + ' MB'}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setPendingDocuments(pendingDocuments.filter((_, i) => i !== index));
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {uploading && (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-primary-800">
                        {uploadProgress < 70 ? 'Subiendo video...'
                          : uploadProgress < 80 ? 'Procesando...'
                          : uploadProgress < 95 ? 'Guardando lección...'
                          : uploadProgress < 100 ? 'Subiendo documentos...'
                          : 'Finalizando...'}
                      </span>
                      {videoFile && (
                        <span className="text-xs text-accent mt-1">
                          {videoFile.size >= 1024 * 1024 * 1024
                            ? `${(videoFile.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
                            : `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB`
                          }
                          {videoFile.size > 500 * 1024 * 1024 && ' - Esto puede tomar varios minutos'}
                        </span>
                      )}
                      {uploadProgress >= 95 && uploadProgress < 100 && pendingDocuments.length > 0 && (
                        <span className="text-xs text-accent mt-1">
                          Subiendo {pendingDocuments.length} documento{pendingDocuments.length > 1 ? 's' : ''}...
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-primary-800">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-primary-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300"
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
                disabled={uploading || (!editingLesson && !videoFile) || !formData.titulo || formData.categoria_ids.length === 0}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="flex-1 px-4 py-2.5 border border-ios-gray-300 rounded-ios-lg focus:outline-none focus:border-accent transition-colors text-[15px]"
                    placeholder="Nombre de la categoría"
                  />
                  <button
                    onClick={handleCreateCategory}
                    disabled={!newCategoryName.trim()}
                    className="px-4 py-2.5 bg-accent text-white rounded-ios-lg hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[15px] font-medium active:scale-95 shadow-ios"
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
      </SegurosEducationLayout>
    </>
  );
}
export default SegurosEducationOnDemand;
