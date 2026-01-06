import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Award, Download, Share2, CheckCircle2, Calendar, Hash } from 'lucide-react';
import { obtenerCertificado } from '../lib/cedulaAUtils';
import type { CedulaACertificado } from '../lib/cedulaATypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CertificadoCedulaA() {
  const { certificadoId } = useParams<{ certificadoId: string }>();
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [certificado, setCertificado] = useState<CedulaACertificado | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (certificadoId) {
      cargarCertificado();
    }
  }, [certificadoId]);

  const cargarCertificado = async () => {
    if (!certificadoId) return;

    try {
      setLoading(true);
      const data = await obtenerCertificado(certificadoId);
      setCertificado(data);
    } catch (error) {
      console.error('Error cargando certificado:', error);
    } finally {
      setLoading(false);
    }
  };

  const compartir = async () => {
    if (!certificado) return;

    const url = `${window.location.origin}/certificado/${certificado.codigo_verificacion}`;
    const texto = `He completado el Curso de Cédula A con una calificación de ${certificado.puntaje_final}%`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Certificado Cédula A',
          text: texto,
          url: url
        });
      } catch (error) {
        console.log('Error compartiendo:', error);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('Enlace copiado al portapapeles');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Cargando certificado...</p>
        </div>
      </div>
    );
  }

  if (!certificado) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600 mb-4">No se encontró el certificado</p>
          <button
            onClick={() => navigate('/seguros-education/cedula-a')}
            className="text-primary-600 hover:text-primary-700"
          >
            Volver al curso
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-ios-2xl shadow-ios-xl p-8 md:p-12 mb-6">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-10 h-10 text-amber-600" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-2">
              Certificado de Completado
            </h1>
            <p className="text-lg text-neutral-600">Curso de Cédula A - CNSF</p>
          </div>

          <div className="border-t border-b border-neutral-200 py-8 my-8">
            <p className="text-center text-lg text-neutral-600 mb-4">Se certifica que</p>
            <h2 className="text-center text-3xl md:text-4xl font-bold text-primary-600 mb-4">
              {usuario?.nombre_completo || 'Usuario'}
            </h2>
            <p className="text-center text-lg text-neutral-600 mb-6">
              ha completado exitosamente el
            </p>
            <h3 className="text-center text-2xl font-bold text-neutral-900 mb-6">
              Curso de Preparación para Cédula A
            </h3>
            <p className="text-center text-lg text-neutral-600">
              con una calificación final de
            </p>
            <div className="text-center mt-4">
              <div className="inline-flex items-center justify-center w-32 h-32 bg-emerald-100 rounded-full">
                <span className="text-4xl font-bold text-emerald-600">
                  {certificado.puntaje_final}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="flex items-center gap-3 bg-neutral-50 rounded-ios-lg p-4">
              <Calendar className="w-5 h-5 text-primary-600 flex-shrink-0" />
              <div>
                <div className="text-sm text-neutral-600">Fecha de Emisión</div>
                <div className="font-semibold text-neutral-900">
                  {format(new Date(certificado.fecha_emision), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-neutral-50 rounded-ios-lg p-4">
              <Hash className="w-5 h-5 text-primary-600 flex-shrink-0" />
              <div>
                <div className="text-sm text-neutral-600">Código de Verificación</div>
                <div className="font-mono font-semibold text-neutral-900">
                  {certificado.codigo_verificacion}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-emerald-600 mb-8">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Certificado Verificado</span>
          </div>

          <div className="text-center text-sm text-neutral-500 border-t border-neutral-200 pt-6">
            <p className="mb-1">Este certificado verifica la completación del curso de preparación</p>
            <p>para el examen de Cédula A de la Comisión Nacional de Seguros y Fianzas</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={compartir}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-ios-lg hover:bg-primary-700 active:scale-[0.98] transition-all font-medium"
          >
            <Share2 className="w-5 h-5" />
            <span>Compartir</span>
          </button>
          <button
            onClick={() => navigate('/seguros-education/cedula-a')}
            className="px-6 py-3 bg-neutral-100 text-neutral-700 rounded-ios-lg hover:bg-neutral-200 active:scale-[0.98] transition-all font-medium"
          >
            Volver al Curso
          </button>
        </div>
      </div>
    </div>
  );
}
