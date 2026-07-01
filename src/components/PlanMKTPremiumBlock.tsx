import { Sparkles, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { crearNotificacionGlobal } from '../lib/notificationHelpers';

interface PlanMKTPremiumBlockProps {
  onClose?: () => void;
  inline?: boolean;
}

export function PlanMKTPremiumBlock({ onClose, inline }: PlanMKTPremiumBlockProps) {
  const { usuario } = useAuth();

  const handleContactarWhatsApp = async () => {
    if (!usuario) return;

    const phone = '+525540808001';
    const mensaje = encodeURIComponent(
      `Hola, me interesa el Plan de MKT Premium. Mi usuario es ${usuario.nombre} ${usuario.apellidos} y mi oficina es ${usuario.oficina?.nombre || 'sin oficina'}.`
    );
    const whatsappUrl = `https://wa.me/${phone}?text=${mensaje}`;

    await crearNotificacionGlobal(
      'Interés en Plan MKT Premium',
      `El usuario ${usuario.nombre} ${usuario.apellidos} (${usuario.oficina?.nombre || 'Sin oficina'}) está interesado en el Plan de MKT Premium.`,
      '/publicidad',
      { tipo: 'rol', rol: 'Administrador' },
      usuario.id,
      false
    );

    window.open(whatsappUrl, '_blank');
  };

  const card = (
    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 relative">
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

        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Marketing Premium
        </h2>

        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Impulsa tu marca personal con un servicio integral de marketing diseñado para ayudarte a generar más prospectos, fortalecer tu presencia profesional y destacar en el mercado.
        </p>

        <div className="bg-gradient-to-br from-purple-50 to-primary-50 border-2 border-purple-200 rounded-xl p-5 mb-4 text-left">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">¿Qué incluye?</h3>
          <ul className="text-sm text-slate-700 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-0.5 shrink-0">✓</span>
              <span>Asesoría estratégica para campañas de publicidad en redes sociales.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-0.5 shrink-0">✓</span>
              <span>Creación de contenido personalizado semanal (fotografía o video) adaptado a tus objetivos y audiencia.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-0.5 shrink-0">✓</span>
              <span>Planeación, seguimiento y optimización de estrategias digitales enfocadas en crecimiento, posicionamiento y generación de oportunidades de negocio.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-0.5 shrink-0">✓</span>
              <span>Diseño y apoyo en materiales de marketing: presentaciones comerciales, propuestas, papelería corporativa y recursos de comunicación.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-0.5 shrink-0">✓</span>
              <span>Carpeta personal de fotos de estudio profesionales.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 mt-0.5 shrink-0">✓</span>
              <span>Acompañamiento continuo para mantener una imagen profesional, consistente y alineada con tus metas comerciales.</span>
            </li>
          </ul>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-left">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Beneficios</h3>
          <ul className="text-sm text-slate-600 space-y-1">
            <li className="flex items-start gap-2"><span className="text-purple-500 mt-0.5 shrink-0">→</span><span>Mayor presencia y reconocimiento de marca.</span></li>
            <li className="flex items-start gap-2"><span className="text-purple-500 mt-0.5 shrink-0">→</span><span>Contenido profesional sin necesidad de invertir tiempo en su producción.</span></li>
            <li className="flex items-start gap-2"><span className="text-purple-500 mt-0.5 shrink-0">→</span><span>Estrategias enfocadas en resultados y generación de prospectos.</span></li>
            <li className="flex items-start gap-2"><span className="text-purple-500 mt-0.5 shrink-0">→</span><span>Respaldo de un equipo de marketing especializado.</span></li>
            <li className="flex items-start gap-2"><span className="text-purple-500 mt-0.5 shrink-0">→</span><span>Atención personalizada para potenciar tu crecimiento comercial.</span></li>
          </ul>
        </div>

        {/* Planes y precios */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="border-2 border-purple-200 rounded-xl p-4 text-center">
            <p className="text-xs font-medium text-purple-500 uppercase tracking-wide mb-1">Mensual</p>
            <p className="text-2xl font-bold text-slate-900">$200</p>
            <p className="text-xs text-slate-500">MXN / mes</p>
          </div>
          <div className="border-2 border-purple-500 bg-purple-50 rounded-xl p-4 text-center relative">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">Ahorra $400</span>
            <p className="text-xs font-medium text-purple-500 uppercase tracking-wide mb-1">Anual</p>
            <p className="text-2xl font-bold text-slate-900">$2,000</p>
            <p className="text-xs text-slate-500">MXN / año</p>
          </div>
        </div>

        {/* Métodos de pago */}
        <div className="border border-slate-200 rounded-xl p-4 mb-6 text-left">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Métodos de pago</h3>
          <ul className="text-sm text-slate-600 space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <span className="text-purple-600 text-xs font-bold">1</span>
              </span>
              Depósito a cuenta Jiro
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <span className="text-purple-600 text-xs font-bold">2</span>
              </span>
              Descuento de bono anual
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <span className="text-purple-600 text-xs font-bold">3</span>
              </span>
              Descuento a comisiones
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
          Marketing Premium está pensado para agentes de Jiro que desean contar con un departamento de marketing dedicado, con atención cercana y un enfoque claro en resultados.
        </p>
      </div>
    </div>
  );

  if (inline) {
    return <div className="flex justify-center py-4">{card}</div>;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="my-auto py-4">
        {card}
      </div>
    </div>
  );
}
