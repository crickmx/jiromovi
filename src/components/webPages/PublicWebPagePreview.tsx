import { Phone, Mail, MessageCircle, ChevronLeft, ChevronRight, ArrowUp } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { WebPageInsurer, WebPageCategory, UserWebPageConfig } from '../../lib/webPagesTypes';
import { DEFAULT_TEXT } from '../../lib/webPagesTypes';
import { createColorVariant } from '../../lib/animationUtils';
import { useState } from 'react';

interface PublicWebPagePreviewProps {
  config: UserWebPageConfig;
  insurers: WebPageInsurer[];
  categories: WebPageCategory[];
  userData: {
    name: string;
    email: string;
    phone: string;
    photo_url: string | null;
    logo_url: string | null;
    office_name: string;
  };
}

export default function PublicWebPagePreview({
  config,
  insurers,
  categories,
  userData
}: PublicWebPagePreviewProps) {
  const primaryColor = config.primary_color;
  const secondaryColor = config.secondary_color;
  const customText = config.custom_text?.trim() || DEFAULT_TEXT;
  const textToDisplay = customText.split('\n').filter(t => t.trim());

  const whatsappNumber = userData.phone?.replace(/\D/g, '');
  const whatsappLink = whatsappNumber ? `https://wa.me/52${whatsappNumber}` : '#';

  const categoriesText = categories.map(c => c.name.toLowerCase()).join(', ');
  const seoText = `${userData.name} de ${userData.office_name} te ayuda a cotizar y contratar seguros de ${categoriesText} con atención personalizada por WhatsApp.`;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    celular: '',
    email: '',
    seguro_interes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handlePrevSlide = () => {
    setCurrentSlide(prev => (prev - 1 + Math.ceil(insurers.length / 4)) % Math.ceil(insurers.length / 4));
  };

  const handleNextSlide = () => {
    setCurrentSlide(prev => (prev + 1) % Math.ceil(insurers.length / 4));
  };

  return (
    <div className="bg-white min-h-screen overflow-x-hidden">
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, ${createColorVariant(primaryColor, 0.1)} 0%, transparent 50%),
                           radial-gradient(circle at 80% 70%, ${createColorVariant(secondaryColor, 0.1)} 0%, transparent 50%)`
        }}
      />

      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 backdrop-blur-lg bg-white/95">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          {userData.logo_url && (
            <img
              src={userData.logo_url}
              alt="Logo"
              className="h-10 md:h-12 w-auto object-contain"
            />
          )}
          <div className="flex items-center gap-3">
            <a
              href={whatsappLink}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 hover:scale-105"
              style={{ backgroundColor: primaryColor }}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      <section className="relative bg-gradient-to-b from-gray-50 to-white py-12 md:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              {userData.photo_url && (
                <div className="mb-6">
                  <img
                    src={userData.photo_url}
                    alt={userData.name}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover shadow-xl"
                  />
                </div>
              )}

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                {userData.name}
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-2">
                Asesor Personal de Seguros
              </p>
              {userData.office_name && (
                <p className="text-base text-gray-500 mb-6">
                  {userData.office_name}
                </p>
              )}

              <div className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  Protege lo que más importa
                </h2>
                <p className="text-gray-600 leading-relaxed max-w-lg">
                  Te ayudo a encontrar el seguro perfecto para ti y tu familia. Cotizaciones personalizadas, asesoría profesional y atención inmediata por WhatsApp.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                <a
                  href={whatsappLink}
                  className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg text-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  <MessageCircle className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  WhatsApp
                </a>
                <a
                  href={`tel:${userData.phone?.replace(/\D/g, '')}`}
                  className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold bg-white border-2 transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg text-sm"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  <Phone className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  Llamar
                </a>
              </div>
            </div>

            <div className="lg:sticky lg:top-24">
              <div
                className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 border"
                style={{ borderColor: createColorVariant(primaryColor, 0.2) }}
              >
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Solicita tu Cotización
                </h3>
                <p className="text-gray-600 mb-6 text-sm">
                  Completa el formulario y te contactaré de inmediato
                </p>

                {submitStatus === 'success' ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">¡Solicitud Recibida!</h4>
                    <p className="text-gray-600">
                      Gracias por tu solicitud. Te contactaré a la brevedad para ofrecerte la mejor opción.
                    </p>
                  </div>
                ) : (
                  <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nombre Completo *
                      </label>
                      <input
                        type="text"
                        value={formData.nombre}
                        onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-opacity-100 focus:outline-none transition-colors"
                        style={{ focusBorderColor: primaryColor }}
                        placeholder="Tu nombre"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Celular *
                      </label>
                      <input
                        type="tel"
                        value={formData.celular}
                        onChange={(e) => setFormData(prev => ({ ...prev, celular: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-opacity-100 focus:outline-none transition-colors"
                        placeholder="55 1234 5678"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-opacity-100 focus:outline-none transition-colors"
                        placeholder="tu@email.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Seguro de Interés *
                      </label>
                      <select
                        value={formData.seguro_interes}
                        onChange={(e) => setFormData(prev => ({ ...prev, seguro_interes: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-opacity-100 focus:outline-none transition-colors bg-white"
                        required
                      >
                        <option value="">Selecciona un seguro</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {submitStatus === 'error' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                        Error al enviar la solicitud. Por favor intenta nuevamente.
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 rounded-xl font-bold text-white transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                      }}
                    >
                      {isSubmitting ? 'Enviando...' : 'Solicitar Cotización'}
                    </button>

                    <p className="text-xs text-gray-500 text-center">
                      Al enviar, aceptas que te contactemos para ofrecerte información sobre seguros.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {insurers.length > 0 && (
        <section className="relative py-20 px-4 bg-gradient-to-b from-gray-50 to-white z-10">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Aseguradoras de Confianza
            </h2>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
              Trabajo con las mejores aseguradoras del mercado para ofrecerte opciones competitivas
            </p>

            <div className="relative">
              {insurers.length > 4 && (
                <>
                  <button
                    onClick={handlePrevSlide}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
                    style={{ color: primaryColor }}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={handleNextSlide}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
                    style={{ color: primaryColor }}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-out"
                  style={{
                    transform: `translateX(-${currentSlide * 100}%)`
                  }}
                >
                  {Array.from({ length: Math.ceil(insurers.length / 4) }).map((_, slideIndex) => (
                    <div key={slideIndex} className="w-full flex-shrink-0">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-2">
                        {insurers.slice(slideIndex * 4, slideIndex * 4 + 4).map((insurer) => (
                          <div
                            key={insurer.id}
                            className="group bg-white p-8 rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 flex items-center justify-center transform hover:-translate-y-2 hover:scale-105"
                          >
                            <img
                              src={insurer.logo_url}
                              alt={insurer.name}
                              className="max-w-full max-h-16 object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {insurers.length > 4 && (
                <div className="flex justify-center gap-2 mt-8">
                  {Array.from({ length: Math.ceil(insurers.length / 4) }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className="w-2 h-2 rounded-full transition-all duration-300"
                      style={{
                        backgroundColor: currentSlide === idx ? primaryColor : '#D1D5DB',
                        width: currentSlide === idx ? '2rem' : '0.5rem'
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className="relative py-24 px-4 bg-gradient-to-b from-gray-50 to-white z-10">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Servicios que Ofrezco
            </h2>
            <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto text-lg">
              Protección completa para lo que más valoras
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {categories.map((category) => {
                const IconComponent = category.lucide_icon && (LucideIcons as any)[category.lucide_icon];

                return (
                  <div
                    key={category.id}
                    className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
                  >
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
                      style={{
                        background: `linear-gradient(135deg, ${createColorVariant(primaryColor, 0.1)} 0%, ${createColorVariant(secondaryColor, 0.1)} 100%)`
                      }}
                    />

                    <div className="relative z-10">
                      {IconComponent && (
                        <div
                          className="mb-6 w-16 h-16 rounded-2xl flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg"
                          style={{
                            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                          }}
                        >
                          <IconComponent className="w-8 h-8 text-white" />
                        </div>
                      )}

                      <h3 className="text-2xl font-bold mb-4 group-hover:text-opacity-90 transition-all" style={{ color: primaryColor }}>
                        {category.card_title}
                      </h3>
                      <p className="text-gray-600 mb-6 leading-relaxed">
                        {category.card_description}
                      </p>

                      <a
                        href={whatsappLink}
                        className="inline-flex items-center gap-2 font-bold hover:gap-3 transition-all duration-300 group/link"
                        style={{ color: secondaryColor }}
                      >
                        Cotizar {category.name}
                        <MessageCircle className="w-5 h-5 group-hover/link:rotate-12 transition-transform" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="relative py-20 px-4 bg-white z-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
            Sobre Mí
          </h2>

          <div className="prose prose-lg max-w-none">
            {textToDisplay.map((paragraph, index) => (
              <p key={index} className="text-gray-700 leading-relaxed mb-4">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-16 px-4 bg-gray-50 z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            ¿Listo para proteger lo que más valoras?
          </h3>
          <p className="text-gray-600 mb-8 text-lg">
            {seoText}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={whatsappLink}
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
              style={{ backgroundColor: primaryColor }}
            >
              <MessageCircle className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Contáctame por WhatsApp
            </a>
            <a
              href={`tel:${userData.phone?.replace(/\D/g, '')}`}
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold bg-white border-2 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              <Phone className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Llamar Ahora
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 py-8 px-4 text-white">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sm text-gray-400 mb-2">
            © {new Date().getFullYear()} {userData.name}. Todos los derechos reservados.
          </p>
          <p className="text-xs text-gray-500">
            Powered by{' '}
            <a href="https://www.movi.digital" className="hover:text-white transition-colors underline">
              MOVI Digital
            </a>
          </p>
        </div>
      </footer>

      <a
        href={whatsappLink}
        className="hidden md:flex fixed bottom-8 right-8 items-center justify-center w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-50 group"
        style={{ backgroundColor: primaryColor }}
      >
        <MessageCircle className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
        <span className="absolute -top-12 right-0 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          WhatsApp
        </span>
      </a>

      <button
        className={`hidden md:flex fixed bottom-8 right-28 items-center justify-center w-12 h-12 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-50 border-2 ${
          showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
        style={{ borderColor: createColorVariant(primaryColor, 0.3) }}
      >
        <ArrowUp className="w-5 h-5" style={{ color: primaryColor }} />
      </button>

      <div className="fixed bottom-0 left-0 right-0 md:hidden backdrop-blur-lg bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="flex divide-x divide-gray-200">
          <a
            href={whatsappLink}
            className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold text-white active:scale-95 transition-transform"
            style={{ backgroundColor: primaryColor }}
          >
            <MessageCircle className="w-5 h-5" />
            WhatsApp
          </a>
          <a
            href={`tel:${userData.phone?.replace(/\D/g, '')}`}
            className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold active:scale-95 transition-transform"
            style={{ color: primaryColor }}
          >
            <Phone className="w-5 h-5" />
            Llamar
          </a>
          <a
            href={`mailto:${userData.email}`}
            className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold active:scale-95 transition-transform"
            style={{ color: secondaryColor }}
          >
            <Mail className="w-5 h-5" />
            Email
          </a>
        </div>
      </div>
    </div>
  );
}
