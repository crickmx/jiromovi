import { Phone, Mail, MessageCircle, FileText } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { WebPageInsurer, WebPageCategory, UserWebPageConfig } from '../../lib/webPagesTypes';
import { DEFAULT_TEXT } from '../../lib/webPagesTypes';

interface PublicWebPagePreviewProps {
  config: UserWebPageConfig;
  insurers: WebPageInsurer[];
  categories: WebPageCategory[];
  userData: {
    name: string;
    email: string;
    phone: string;
    photo_url: string | null;
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
  const paragraphs = customText.split('\n').filter(p => p.trim());

  const whatsappNumber = userData.phone?.replace(/\D/g, '');
  const whatsappLink = whatsappNumber ? `https://wa.me/52${whatsappNumber}` : '#';

  const categoriesText = categories.map(c => c.name.toLowerCase()).join(', ');
  const seoText = `${userData.name} de ${userData.office_name} te ayuda a cotizar y contratar seguros de ${categoriesText} con atención personalizada por WhatsApp.`;

  return (
    <div className="bg-white">
      <section
        className="relative py-20 px-4"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
        }}
      >
        <div className="max-w-4xl mx-auto text-center text-white">
          {userData.photo_url && (
            <div className="mb-6 flex justify-center">
              <img
                src={userData.photo_url}
                alt={userData.name}
                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-xl"
              />
            </div>
          )}

          <h1 className="text-4xl md:text-5xl font-bold mb-4">{userData.name}</h1>
          <p className="text-xl md:text-2xl mb-8 opacity-95">Asesor Personal de Seguros</p>

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

      {insurers.length > 0 && (
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

            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Seguro</label>
                <select
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-offset-2"
                  style={{ focusRing: primaryColor }}
                >
                  <option>Selecciona un ramo</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Nombre Completo</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-offset-2"
                  placeholder="Tu nombre"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-offset-2"
                  placeholder="tu@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Celular</label>
                <input
                  type="tel"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-offset-2"
                  placeholder="55 1234 5678"
                />
              </div>

              <button
                type="button"
                className="w-full py-4 rounded-lg font-semibold text-white hover:opacity-90 transition-opacity shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                Enviar Solicitud de Cotización
              </button>
            </form>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Servicios que Ofrezco</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map(category => {
                const IconComponent = category.lucide_icon && (LucideIcons as any)[category.lucide_icon];
                return (
                  <div
                    key={category.id}
                    className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                  >
                    {IconComponent && (
                      <div
                        className="mb-4 w-14 h-14 rounded-lg flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}15)`
                        }}
                      >
                        <IconComponent
                          className="w-8 h-8"
                          style={{ color: primaryColor }}
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
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Sobre Mí</h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            {paragraphs.map((paragraph, index) => (
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
            <a href={whatsappLink} className="flex items-center gap-2 hover:underline">
              <Phone className="w-4 h-4" />
              {userData.phone}
            </a>
            <a href={`mailto:${userData.email}`} className="flex items-center gap-2 hover:underline">
              <Mail className="w-4 h-4" />
              {userData.email}
            </a>
          </div>
        </div>
      </section>

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
            href={`tel:${userData.phone}`}
            className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold text-white"
            style={{ backgroundColor: secondaryColor }}
          >
            <Phone className="w-5 h-5" />
            Llamar
          </a>
        </div>
      </div>
    </div>
  );
}
