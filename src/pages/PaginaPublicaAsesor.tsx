import { useState, useEffect, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Phone, Mail, MessageCircle, FileText, Loader2, ChevronLeft, ChevronRight, ArrowUp, User } from 'lucide-react';
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
    return <Navigate to="https://www.movi.digital" replace />;
  }

  const { user, config, insurers, categories } = data;
  const primaryColor = config.primary_color;
  const secondaryColor = config.secondary_color;
  const textToDisplay = config.custom_text.filter(t => t.trim()).length > 0
    ? config.custom_text.filter(t => t.trim())
    : DEFAULT_TEXT;

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

  const heroReveal = useScrollReveal();
  const aboutReveal = useScrollReveal();
  const formReveal = useScrollReveal();
  const servicesStagger = useStaggeredReveal(categories?.length || 0, 150);

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

        <section
          className="relative min-h-[85vh] flex items-center px-4 py-20 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
          }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}
          />

          <div className="max-w-5xl mx-auto text-center text-white relative z-10 w-full">
            {user.photo_url && (
              <div className="mb-8 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="relative group">
                  <div
                    className="absolute inset-0 rounded-full blur-2xl opacity-50 group-hover:opacity-75 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)`
                    }}
                  />
                  <img
                    src={user.photo_url}
                    alt={user.name}
                    className="relative w-36 h-36 md:w-44 md:h-44 rounded-full object-cover border-4 border-white/80 shadow-2xl backdrop-blur-sm transform group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>
            )}

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              {user.name}
            </h1>
            <p className="text-2xl md:text-3xl mb-3 opacity-95 font-light animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
              Asesor Personal de Seguros
            </p>
            {user.office?.name && (
              <p className="text-lg md:text-xl mb-10 opacity-90 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
                {user.office.name}
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-full font-semibold hover:scale-105 hover:shadow-2xl transition-all duration-300 shadow-xl"
              >
                <MessageCircle className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                Contáctame por WhatsApp
              </a>
              <a
                href="#cotizar"
                className="group inline-flex items-center gap-2 bg-white/20 backdrop-blur-md text-white px-8 py-4 rounded-full font-semibold hover:bg-white/30 transition-all duration-300 border-2 border-white/60 hover:border-white shadow-xl hover:shadow-2xl hover:scale-105"
              >
                <FileText className="w-5 h-5 group-hover:rotate-6 transition-transform" />
                Cotizar Ahora
              </a>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 animate-bounce">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
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

        <section
          id="cotizar"
          ref={formReveal.ref as React.RefObject<HTMLElement>}
          className={`relative py-24 px-4 bg-white z-10 transition-all duration-1000 ${
            formReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="max-w-2xl mx-auto">
            <div
              className="relative bg-gradient-to-br from-white to-gray-50 p-10 rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
              style={{
                boxShadow: `0 20px 60px -15px ${createColorVariant(primaryColor, 0.2)}`
              }}
            >
              <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10"
                style={{ backgroundColor: primaryColor }}
              />
              <div
                className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl opacity-10"
                style={{ backgroundColor: secondaryColor }}
              />

              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  Cotiza y Contrata
                </h2>
                <p className="text-center text-gray-600 mb-10 text-lg">
                  Completa el formulario y te contactaré para ofrecerte la mejor opción
                </p>

                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  {categories && categories.length > 0 && (
                    <div className="group">
                      <label className="block text-sm font-semibold mb-3 text-gray-700">
                        Tipo de Seguro
                      </label>
                      <select
                        className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:border-opacity-100 transition-all duration-300 focus:outline-none bg-white shadow-sm hover:shadow-md"
                        style={{
                          focusBorderColor: primaryColor
                        }}
                      >
                        <option>Selecciona un ramo</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.slug}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="group">
                    <label className="block text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
                      <User className="w-4 h-4" style={{ color: primaryColor }} />
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:border-opacity-100 transition-all duration-300 focus:outline-none shadow-sm hover:shadow-md"
                      placeholder="Tu nombre"
                      style={{
                        focusBorderColor: primaryColor
                      }}
                    />
                  </div>

                  <div className="group">
                    <label className="block text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
                      <Mail className="w-4 h-4" style={{ color: primaryColor }} />
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:border-opacity-100 transition-all duration-300 focus:outline-none shadow-sm hover:shadow-md"
                      placeholder="tu@email.com"
                      style={{
                        focusBorderColor: primaryColor
                      }}
                    />
                  </div>

                  <div className="group">
                    <label className="block text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
                      <Phone className="w-4 h-4" style={{ color: primaryColor }} />
                      Celular
                    </label>
                    <input
                      type="tel"
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:border-opacity-100 transition-all duration-300 focus:outline-none shadow-sm hover:shadow-md"
                      placeholder="55 1234 5678"
                      style={{
                        focusBorderColor: primaryColor
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="group relative w-full py-5 rounded-xl font-bold text-white hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                    }}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Enviar Solicitud de Cotización
                      <FileText className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

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
          className={`relative py-24 px-4 bg-white z-10 transition-all duration-1000 ${
            aboutReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-6 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Sobre Mí
            </h2>
            <div className="h-1 w-24 mx-auto mb-16 rounded-full" style={{ background: `linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }} />

            <div className="grid md:grid-cols-2 gap-8 items-center mb-12">
              {user.photo_url && (
                <div className="flex justify-center md:justify-end">
                  <div className="relative group">
                    <div
                      className="absolute inset-0 rounded-3xl blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <img
                      src={user.photo_url}
                      alt={user.name}
                      className="relative w-64 h-64 rounded-3xl object-cover shadow-2xl transform group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-6 text-gray-700 leading-relaxed">
                {textToDisplay.slice(0, 2).map((paragraph, index) => (
                  <p key={index} className="text-lg" style={{ animationDelay: `${index * 200}ms` }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {textToDisplay.length > 2 && (
              <div className="space-y-6 text-gray-700 leading-relaxed text-lg">
                {textToDisplay.slice(2).map((paragraph, index) => (
                  <p key={index + 2}>{paragraph}</p>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="relative py-16 px-4 bg-gradient-to-b from-gray-50 to-white z-10">
          <div className="max-w-4xl mx-auto">
            <div
              className="relative bg-white rounded-3xl shadow-2xl p-12 overflow-hidden"
              style={{
                boxShadow: `0 20px 60px -15px ${createColorVariant(primaryColor, 0.2)}`
              }}
            >
              <div
                className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-10"
                style={{ backgroundColor: secondaryColor }}
              />

              <div className="relative z-10 text-center">
                <h3 className="text-3xl font-bold mb-6 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  ¿Listo para proteger lo que más valoras?
                </h3>
                <p className="text-gray-600 mb-10 text-lg max-w-2xl mx-auto">
                  {seoText}
                </p>

                <div className="flex flex-wrap justify-center gap-6 mb-8">
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                    }}
                  >
                    <MessageCircle className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
                    <div className="text-left">
                      <div className="text-sm text-white/80 font-medium">WhatsApp</div>
                      <div className="text-white font-bold">{user.phone}</div>
                    </div>
                  </a>

                  <a
                    href={`mailto:${user.email}`}
                    className="group flex items-center gap-3 bg-white px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 transform hover:scale-105"
                    style={{ borderColor: createColorVariant(primaryColor, 0.2) }}
                  >
                    <Mail className="w-6 h-6 group-hover:rotate-6 transition-transform" style={{ color: primaryColor }} />
                    <div className="text-left">
                      <div className="text-sm text-gray-500 font-medium">Email</div>
                      <div className="font-bold" style={{ color: primaryColor }}>{user.email}</div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer
          className="relative py-12 px-4 text-white overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
          }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}
          />

          <div className="relative z-10 max-w-6xl mx-auto text-center">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">{user.name}</h3>
              <p className="text-white/80">Asesor Personal de Seguros</p>
              {user.office?.name && <p className="text-white/70 text-sm mt-1">{user.office.name}</p>}
            </div>

            <div className="h-px w-32 mx-auto bg-white/30 mb-6" />

            <p className="text-sm text-white/80 mb-2">
              © {new Date().getFullYear()} {user.name}. Todos los derechos reservados.
            </p>
            <p className="text-xs text-white/60">
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
          className="hidden md:flex fixed bottom-8 right-8 items-center justify-center w-16 h-16 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 z-50 group animate-pulse hover:animate-none"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
          }}
        >
          <MessageCircle className="w-7 h-7 text-white group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-12 right-0 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Contáctame por WhatsApp
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

        <div className="fixed bottom-0 left-0 right-0 md:hidden backdrop-blur-lg bg-white/90 border-t border-gray-200 shadow-2xl z-50">
          <div className="flex">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-4 font-bold text-white active:scale-95 transition-transform"
              style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp
            </a>
            <a
              href={`tel:${user.phone}`}
              className="flex-1 flex items-center justify-center gap-2 py-4 font-bold border-l border-white/20 text-white active:scale-95 transition-transform"
              style={{ background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)` }}
            >
              <Phone className="w-5 h-5" />
              Llamar
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
