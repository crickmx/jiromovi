import { Sparkles, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { crearNotificacionGlobal } from '../lib/notificationHelpers';

interface PlanMKTPremiumBlockProps {
  onClose?: () => void;
}

export function PlanMKTPremiumBlock({ onClose }: PlanMKTPremiumBlockProps) {
  const { usuario } = useAuth();

  const handleContactarWhatsApp = async () => {
    if (!usuario) return;

    const phone = '+525540808001';
    const mensaje = encodeURIComponent(
      `Hola, me interesa el Plan de MKT Premium. Mi usuario es ${usuario.nombre} ${usuario.apellidos} y mi oficina es ${usuario.oficinas?.nombre || 'sin oficina'}.`
    );
    const whatsappUrl = `https://wa.me/${phone}?text=${mensaje}`;

    await crearNotificacionGlobal(
      'Interés en Plan MKT Premium',
      `El usuario ${usuario.nombre} ${usuario.apellidos} (${usuario.oficinas?.nombre || 'Sin oficina'}) está interesado en el Plan de MKT Premium.`,
      '/publicidad',
      { tipo: 'rol', rol: 'Administrador' },
      usuario.id,
      false
    );

    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-purple-100 to-primary-100 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="w-10 h-10 text-purple-600" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Función Exclusiva
          </h2>

          <p className="text-base text-slate-600 mb-6 leading-relaxed">
            Esta función es exclusiva para agentes con <span className="font-semibold text-purple-600">Plan de MKT Premium</span>.
          </p>

          <div className="bg-gradient-to-br from-purple-50 to-primary-50 border-2 border-purple-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">
              ¿Qué incluye el Plan MKT Premium?
            </h3>
            <ul className="text-sm text-slate-700 space-y-1 text-left">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">✓</span>
                <span>Personalización completa de diseños</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">✓</span>
                <span>Agregar tu logo y texto personalizado</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">✓</span>
                <span>Descargas ilimitadas en alta resolución</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">✓</span>
                <span>Acceso a todas las plantillas premium</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleContactarWhatsApp}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 px-6 rounded-xl font-semibold text-base hover:shadow-lg transition-all duration-200 hover:scale-105 flex items-center justify-center gap-3 active:scale-95"
          >
            <MessageCircle className="w-5 h-5" />
            Contactar por WhatsApp
          </button>

          <p className="text-xs text-slate-500 mt-4">
            Te contactaremos para brindarte más información
          </p>
        </div>
      </div>
    </div>
  );
}
