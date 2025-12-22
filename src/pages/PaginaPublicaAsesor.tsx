import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Phone, Mail, MessageCircle, FileText, Loader2 } from 'lucide-react';
import { getPublicWebPageBySlug } from '../lib/webPagesUtils';
import type { PublicWebPageData } from '../lib/webPagesTypes';
import { DEFAULT_TEXT } from '../lib/webPagesTypes';

export default function PaginaPublicaAsesor() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicWebPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    loadPageData();
  }, [slug]);

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
        <link rel="canonical" href={`https://agentedeseguros.online/soy/${slug}`} />
      </Helmet>

      <div className="bg-white min-h-screen">
        <section
          className="relative py-20 px-4"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
          }}
        >
          <div className="max-w-4xl mx-auto text-center text-white">
            {user.photo_url && (
              <div className="mb-6 flex justify-center">
                <img
                  src={user.photo_url}
                  alt={user.name}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-white shadow-xl"
                />
              </div>
            )}

            <h1 className="text-4xl md:text-5xl font-bold mb-4">{user.name}</h1>
            <p className="text-xl md:text-2xl mb-2 opacity-95">Asesor Personal de Seguros</p>
            {user.office?.name && (
              <p className="text-lg md:text-xl mb-8 opacity-90">{user.office.name}</p>
            )}

            <div className="flex flex-wrap justify-center gap-4">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-full font-semibold hover:scale-105 transition-transform shadow-lg"
              >
                <MessageCircle className="w-5 h-5" />
                Contáctame por WhatsApp
              </a>
              <a
                href="#cotizar"
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-6 py-3 rounded-full font-semibold hover:bg-white/20 transition-all border-2 border-white"
              >
                <FileText className="w-5 h-5" />
                Cotizar Ahora
              </a>
            </div>
          </div>
        </section>

        {insurers && insurers.length > 0 && (
          <section className="py-16 px-4 bg-gray-50">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-12">Aseguradoras</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {insurers.map(insurer => (
                  <div
                    key={insurer.id}
                    className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow flex items-center justify-center"
                  >
                    <img
                      src={insurer.logo_url}
                      alt={insurer.name}
                      className="max-w-full max-h-16 object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="cotizar" className="py-16 px-4 bg-white">
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl shadow-lg border">
              <h2 className="text-3xl font-bold text-center mb-6">Cotiza y Contrata</h2>
              <p className="text-center text-gray-600 mb-8">
                Completa el formulario y te contactaré para ofrecerte la mejor opción
              </p>

              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                {categories && categories.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Tipo de Seguro</label>
                    <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-2 focus:outline-none">
                      <option>Selecciona un ramo</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.slug}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">Nombre Completo</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    placeholder="Tu nombre"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Celular</label>
                  <input
                    type="tel"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    placeholder="55 1234 5678"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-lg font-semibold text-white hover:opacity-90 transition-opacity shadow-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  Enviar Solicitud de Cotización
                </button>
              </form>
            </div>
          </div>
        </section>

        {categories && categories.length > 0 && (
          <section className="py-16 px-4 bg-gray-50">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-12">Servicios que Ofrezco</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map(category => (
                  <div
                    key={category.id}
                    className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                  >
                    {category.icon_url && (
                      <div className="mb-4">
                        <img
                          src={category.icon_url}
                          alt={category.name}
                          className="w-12 h-12 object-contain"
                        />
                      </div>
                    )}
                    <h3 className="text-xl font-bold mb-3" style={{ color: primaryColor }}>
                      {category.card_title}
                    </h3>
                    <p className="text-gray-600 mb-4">{category.card_description}</p>
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 font-semibold hover:underline"
                      style={{ color: secondaryColor }}
                    >
                      Cotizar {category.name}
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="py-16 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Sobre Mí</h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              {textToDisplay.map((paragraph, index) => (
                <p key={index} className="text-lg">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 px-4 bg-gray-50">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-gray-600 mb-6">{seoText}</p>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:underline"
              >
                <Phone className="w-4 h-4" />
                {user.phone}
              </a>
              <a href={`mailto:${user.email}`} className="flex items-center gap-2 hover:underline">
                <Mail className="w-4 h-4" />
                {user.email}
              </a>
            </div>
          </div>
        </section>

        <footer className="py-8 px-4 bg-gray-900 text-white text-center">
          <p className="text-sm">
            © {new Date().getFullYear()} {user.name}. Todos los derechos reservados.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Powered by <a href="https://www.movi.digital" className="hover:underline">MOVI Digital</a>
          </p>
        </footer>

        <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t shadow-lg z-50">
          <div className="flex">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp
            </a>
            <a
              href={`tel:${user.phone}`}
              className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold text-white"
              style={{ backgroundColor: secondaryColor }}
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
