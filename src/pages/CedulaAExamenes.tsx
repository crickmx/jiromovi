import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  BookOpen,
  FileText,
  ClipboardCheck,
  Award,
  Clock,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import { obtenerExamenes } from '../lib/cedulaAUtils';
import type { CedulaAExamen } from '../lib/cedulaATypes';
import { PageHeader } from '@/components/ui/page-header';

export default function CedulaAExamenes() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [examenes, setExamenes] = useState<CedulaAExamen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (usuario) {
      cargarExamenes();
    }
  }, [usuario]);

  const cargarExamenes = async () => {
    try {
      setLoading(true);
      const data = await obtenerExamenes();
      setExamenes(data);
    } catch (error) {
      console.error('Error cargando exámenes:', error);
    } finally {
      setLoading(false);
    }
  };

  const obtenerIconoTipo = (tipo: string) => {
    switch (tipo) {
      case 'practica': return FileText;
      case 'modulo': return BookOpen;
      case 'final': return Award;
      default: return FileText;
    }
  };

  const obtenerColorTipo = (tipo: string) => {
    switch (tipo) {
      case 'practica': return 'bg-blue-100 text-accent';
      case 'modulo': return 'bg-purple-100 text-purple-600';
      case 'final': return 'bg-amber-100 text-amber-600';
      default: return 'bg-neutral-100 text-neutral-600';
    }
  };

  const obtenerNombreTipo = (tipo: string) => {
    switch (tipo) {
      case 'practica': return 'Examen de Práctica';
      case 'modulo': return 'Examen por Módulo';
      case 'final': return 'Examen Final';
      default: return tipo;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Cargando exámenes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <PageHeader
          title="Exámenes de Cédula A"
          description="Pon a prueba tus conocimientos"
          icon={ClipboardCheck}
          backTo="/seguros-education/cedula-a"
          backLabel="Volver al curso"
          className="mb-6 sm:mb-8"
        />

        {examenes.length === 0 ? (
          <div className="bg-white rounded-ios-xl shadow-ios p-8 text-center">
            <FileText className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">No hay exámenes disponibles</h3>
            <p className="text-neutral-600 mb-4">Los exámenes estarán disponibles próximamente</p>
            <button
              onClick={() => navigate('/seguros-education/cedula-a')}
              className="px-6 py-3 bg-accent text-white rounded-ios-lg hover:bg-accent-hover transition-colors"
            >
              Volver al curso
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {examenes.map((examen) => {
              const Icono = obtenerIconoTipo(examen.tipo);
              const colorTipo = obtenerColorTipo(examen.tipo);

              return (
                <div
                  key={examen.id}
                  onClick={() => navigate(`/seguros-education/cedula-a/examen/${examen.id}`)}
                  className="bg-white rounded-ios-xl p-6 shadow-ios hover:shadow-ios-lg active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-ios-lg flex items-center justify-center ${colorTipo}`}>
                      <Icono className="w-6 h-6" />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colorTipo}`}>
                      {obtenerNombreTipo(examen.tipo)}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-neutral-900 mb-2 group-hover:text-accent transition-colors">
                    {examen.titulo}
                  </h3>

                  {examen.descripcion && (
                    <p className="text-sm text-neutral-600 mb-4 line-clamp-2">
                      {examen.descripcion}
                    </p>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <FileText className="w-4 h-4" />
                      <span>{examen.num_preguntas} preguntas</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <Clock className="w-4 h-4" />
                      <span>{examen.duracion_referencia_minutos} minutos (referencia)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <TrendingUp className="w-4 h-4" />
                      <span>Puntaje mínimo: {examen.puntaje_minimo_aprobacion}%</span>
                    </div>
                  </div>

                  {examen.modulo_id && (
                    <div className="mt-4 pt-4 border-t border-neutral-200">
                      <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <BookOpen className="w-4 h-4" />
                        <span>Módulo específico</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
