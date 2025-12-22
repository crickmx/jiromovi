import { useState, useEffect, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Phone, Mail, MessageCircle, Loader2, ChevronLeft, ChevronRight, ArrowUp } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { getPublicWebPageBySlug } from '../lib/webPagesUtils';
import type { PublicWebPageData } from '../lib/webPagesTypes';
import { DEFAULT_TEXT } from '../lib/webPagesTypes';
import { useScrollReveal, useStaggeredReveal, createColorVariant } from '../lib/animationUtils';

export default function PaginaPublicaAsesor() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicWebPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    celular: '',
    email: '',
    seguro_interes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Hooks de animación DEBEN estar aquí, antes de cualquier early return
  const aboutReveal = useScrollReveal();
  const servicesStagger = useStaggeredReveal(data?.categories?.length || 0, 150);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    loadPageData();
  }, [slug]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!data?.insurers || data.insurers.length <= 4 || !isAutoScrolling) return;

    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % Math.ceil(data.insurers!.length / 4));
    }, 3000);

    return () => clearInterval(interval);
  }, [data?.insurers, isAutoScrolling]);

  async function loadPageData() {
    if (!slug) return;

    try {
      const pageData = await getPublicWebPageBySlug(slug);

      if (!pageData || !pageData.user || !pageData.config?.is_published) {
        setNotFound(true);
      } else {
        setData(pageData);
      }
    } catch (error) {
      console.error('Error loading public page:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitLead(e: React.FormEvent) {
    e.preventDefault();

    if (!slug || !formData.nombre || !formData.celular || !formData.email || !formData.seguro_interes) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-web-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug,
          nombre: formData.nombre,
          celular: formData.celular,
          email: formData.email,
          seguro_interes: formData.seguro_interes,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al enviar la solicitud');
      }

      setSubmitStatus('success');
      setFormData({
        nombre: '',
        celular: '',
        email: '',
        seguro_interes: ''
      });
    } catch (error) {
      console.error('Error submitting lead:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Cargando página...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="mb-8">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Página no encontrada</h1>
            <p className="text-gray-600 mb-6">
              Esta página no existe o no está publicada.
            </p>
            <a
              href="https://www.movi.digital"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Ir a MOVI Digital
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { user, config, insurers, categories } = data;
  const primaryColor = config.primary_color;
  const secondaryColor = config.secondary_color;

  const textToDisplay = typeof config.custom_text === 'string' && config.custom_text.trim()
    ? config.custom_text.split('\n').filter(t => t.trim())
    : DEFAULT_TEXT.split('\n').filter(t => t.trim());

  const whatsappNumber = user.phone?.replace(/\D/g, '');
  const whatsappLink = whatsappNumber ? `https://wa.me/52${whatsappNumber}` : '#';

  const categoriesText = categories?.map(c => c.name.toLowerCase()).join(', ') || '';
  const seoText = `${user.name} de ${user.office?.name || 'JIRO'} te ayuda a cotizar y contratar seguros de ${categoriesText} con atención personalizada por WhatsApp.`;
  const pageTitle = `${user.name} | Asesor de Seguros${user.office?.name ? ` | ${user.office.name}` : ''}`;
  const metaDescription = seoText.slice(0, 160);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevSlide = () => {
    setIsAutoScrolling(false);
    setCurrentSlide(prev => (prev - 1 + Math.ceil(insurers!.length / 4)) % Math.ceil(insurers!.length / 4));
  };

  const handleNextSlide = () => {
    setIsAutoScrolling(false);
    setCurrentSlide(prev => (prev + 1) % Math.ceil(insurers!.length / 4));
  };

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="profile" />
        {user.photo_url && <meta property="og:image" content={user.photo_url} />}
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`https://agentedeseguros.online/${slug}`} />
      </Helmet>

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
            {user.logo_url && (
              <img
                src={user.logo_url}
                alt="Logo"
                className="h-10 md:h-12 w-auto object-contain"
              />
            )}
            <div className="flex items-center gap-3">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
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
                {user.photo_url && (
                  <div className="mb-6">
                    <img
                      src={user.photo_url}
                      alt={user.name}
                      className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover shadow-xl"
                    />
                  </div>
                )}

                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                  {user.name}
                </h1>
                <p className="text-lg md:text-xl text-gray-600 mb-2">
                  Asesor Personal de Seguros
                </p>
                {user.office?.name && (
                  <p className="text-base text-gray-500 mb-6">
                    {user.office.name}
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
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg text-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <MessageCircle className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    WhatsApp
                  </a>
                  <a
                    href={`tel:${user.phone?.replace(/\D/g, '')}`}
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
                    <form className="space-y-4" onSubmit={handleSubmitLead}>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Nombre Completo *
                        </label>
                        <input
                          type="text"
                          value={formData.nombre}
                          onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none transition-colors"
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
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none transition-colors"
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
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none transition-colors"
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
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none transition-colors bg-white"
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

        {insurers && insurers.length > 0 && (
          <section className="relative py-20 px-4 bg-gradient-to-b from-gray-50 to-white z-10">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Aseguradoras de Confianza
              </h2>
              <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
                Trabajo con las mejores aseguradoras del mercado para ofrecerte opciones competitivas
              </p>

              <div className="relative" onMouseEnter={() => setIsAutoScrolling(false)} onMouseLeave={() => setIsAutoScrolling(true)}>
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

                <div className="overflow-hidden" ref={carouselRef}>
                  <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{
                      transform: `translateX(-${currentSlide * 100}%)`
                    }}
                  >
                    {Array.from({ length: Math.ceil(insurers.length / 4) }).map((_, slideIndex) => (
                      <div key={slideIndex} className="w-full flex-shrink-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-2">
                          {insurers.slice(slideIndex * 4, slideIndex * 4 + 4).map((insurer, idx) => (
                            <div
                              key={insurer.id}
                              className="group bg-white p-8 rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 flex items-center justify-center transform hover:-translate-y-2 hover:scale-105"
                              style={{
                                animationDelay: `${idx * 100}ms`,
                                animation: 'fadeInUp 0.6s ease-out forwards'
                              }}
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
                        onClick={() => {
                          setCurrentSlide(idx);
                          setIsAutoScrolling(false);
                        }}
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


        {categories && categories.length > 0 && (
          <section
            ref={servicesStagger.ref as React.RefObject<HTMLElement>}
            className="relative py-24 px-4 bg-gradient-to-b from-gray-50 to-white z-10"
          >
            <div className="max-w-6xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Servicios que Ofrezco
              </h2>
              <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto text-lg">
                Protección completa para lo que más valoras
              </p>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {categories.map((category, idx) => {
                  const IconComponent = category.lucide_icon && (LucideIcons as any)[category.lucide_icon];
                  const isVisible = servicesStagger.visibleItems.has(idx);

                  return (
                    <div
                      key={category.id}
                      className={`group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 ${
                        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                      }`}
                      style={{
                        transitionDelay: `${idx * 100}ms`
                      }}
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
                          target="_blank"
                          rel="noopener noreferrer"
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

        <section
          ref={aboutReveal.ref as React.RefObject<HTMLElement>}
          className={`relative py-20 px-4 bg-white z-10 transition-all duration-1000 ${
            aboutReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
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
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                style={{ backgroundColor: primaryColor }}
              >
                <MessageCircle className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                Contáctame por WhatsApp
              </a>
              <a
                href={`tel:${user.phone?.replace(/\D/g, '')}`}
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
              © {new Date().getFullYear()} {user.name}. Todos los derechos reservados.
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
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex fixed bottom-8 right-8 items-center justify-center w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-50 group"
          style={{ backgroundColor: primaryColor }}
        >
          <MessageCircle className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-12 right-0 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            WhatsApp
          </span>
        </a>

        <button
          onClick={scrollToTop}
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
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold text-white active:scale-95 transition-transform"
              style={{ backgroundColor: primaryColor }}
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp
            </a>
            <a
              href={`tel:${user.phone?.replace(/\D/g, '')}`}
              className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold active:scale-95 transition-transform"
              style={{ color: primaryColor }}
            >
              <Phone className="w-5 h-5" />
              Llamar
            </a>
            <a
              href={`mailto:${user.email}`}
              className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold active:scale-95 transition-transform"
              style={{ color: secondaryColor }}
            >
              <Mail className="w-5 h-5" />
              Email
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
