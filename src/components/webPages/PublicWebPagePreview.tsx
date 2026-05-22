import { Phone, Mail, MessageCircle, ChevronLeft, ChevronRight, ArrowUp, Car } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { WebPageInsurer, UserWebPageConfig, SharedFormLink } from '../../lib/webPagesTypes';
import { DEFAULT_TEXT } from '../../lib/webPagesTypes';
import { createColorVariant } from '../../lib/animationUtils';
import { useState } from 'react';

interface FormLinkMeta {
  icon: string;
  description: string;
  category: string;
}

const FORM_TYPE_META: Record<string, FormLinkMeta> = {
  auto: { icon: 'Car', description: 'Protege tu vehiculo con coberturas completas contra accidentes, robo y danos a terceros.', category: 'vehiculos' },
  vida: { icon: 'Heart', description: 'Asegura el bienestar economico de tu familia con planes de vida a tu medida.', category: 'personales' },
  gmm: { icon: 'Stethoscope', description: 'Accede a la mejor atencion medica con cobertura hospitalaria y de especialistas.', category: 'personales' },
  gastos_medicos: { icon: 'Stethoscope', description: 'Cobertura hospitalaria y de especialistas para ti y tu familia.', category: 'personales' },
  salud: { icon: 'HeartPulse', description: 'Planes de salud preventiva y hospitalaria para toda la familia.', category: 'personales' },
  hogar: { icon: 'Home', description: 'Protege tu patrimonio contra incendios, robos y desastres naturales.', category: 'hogar' },
  casa: { icon: 'Home', description: 'Protege tu hogar contra incendios, robos y desastres naturales.', category: 'hogar' },
  motocicleta: { icon: 'Bike', description: 'Coberturas de danos, robo y responsabilidad civil para tu moto.', category: 'vehiculos' },
  moto: { icon: 'Bike', description: 'Coberturas de danos, robo y responsabilidad civil para tu moto.', category: 'vehiculos' },
  accidentes_personales: { icon: 'ShieldAlert', description: 'Cobertura ante accidentes con indemnizaciones y gastos medicos.', category: 'personales' },
  empresa: { icon: 'Building2', description: 'Seguros empresariales que protegen tus activos y operaciones.', category: 'empresariales' },
  negocio: { icon: 'Building2', description: 'Seguros para tu negocio con coberturas integrales.', category: 'empresariales' },
  pyme: { icon: 'Store', description: 'Proteccion integral para pequenas y medianas empresas.', category: 'empresariales' },
  responsabilidad_civil: { icon: 'Shield', description: 'Proteccion ante reclamaciones de terceros por danos.', category: 'empresariales' },
  rc: { icon: 'Shield', description: 'Proteccion ante reclamaciones de terceros.', category: 'empresariales' },
  transporte: { icon: 'Truck', description: 'Cobertura integral para mercancia en transito.', category: 'vehiculos' },
  flotilla: { icon: 'Bus', description: 'Seguros para flotillas con tarifas preferenciales.', category: 'vehiculos' },
  viaje: { icon: 'Plane', description: 'Viaja tranquilo con cobertura medica y equipaje.', category: 'especializados' },
  mascota: { icon: 'PawPrint', description: 'Cobertura veterinaria y de accidentes para tu mascota.', category: 'hogar' },
  dental: { icon: 'Smile', description: 'Cobertura dental preventiva, correctiva y de emergencia.', category: 'personales' },
  condominio: { icon: 'Building', description: 'Proteccion para areas comunes y estructura.', category: 'hogar' },
  incendio: { icon: 'Flame', description: 'Cobertura contra incendios y fenomenos naturales.', category: 'hogar' },
  construccion: { icon: 'HardHat', description: 'Seguros para obras en construccion.', category: 'empresariales' },
  agricola: { icon: 'Leaf', description: 'Cobertura para cultivos y actividades agricolas.', category: 'especializados' },
  educacion: { icon: 'GraduationCap', description: 'Asegura el futuro educativo de tus hijos.', category: 'personales' },
  ahorro: { icon: 'PiggyBank', description: 'Planes de ahorro e inversion respaldados.', category: 'personales' },
  retiro: { icon: 'Landmark', description: 'Planifica tu retiro con rendimientos garantizados.', category: 'personales' },
  taxi: { icon: 'CarTaxiFront', description: 'Seguro especializado para taxis.', category: 'vehiculos' },
  eventos: { icon: 'Calendar', description: 'Cobertura para eventos contra cancelaciones.', category: 'especializados' },
};

function getFormMeta(link: SharedFormLink): FormLinkMeta {
  const typeKey = link.form_type?.toLowerCase().replace(/[^a-z_]/g, '') || '';
  if (FORM_TYPE_META[typeKey]) return FORM_TYPE_META[typeKey];

  const title = link.form_title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, meta] of Object.entries(FORM_TYPE_META)) {
    if (title.includes(key.replace(/_/g, ' '))) return meta;
  }
  if (title.includes('auto') || title.includes('vehiculo')) return FORM_TYPE_META.auto;
  if (title.includes('vida')) return FORM_TYPE_META.vida;
  if (title.includes('gmm') || title.includes('medic')) return FORM_TYPE_META.gmm;
  if (title.includes('hogar') || title.includes('casa')) return FORM_TYPE_META.hogar;
  if (title.includes('empresa') || title.includes('pyme')) return FORM_TYPE_META.empresa;
  if (title.includes('moto')) return FORM_TYPE_META.moto;

  return { icon: 'FileText', description: 'Solicita una cotizacion personalizada sin compromiso.', category: 'otros' };
}

function cleanFormTitle(title: string): string {
  return title
    .replace(/^formulario\s+de\s+/i, '')
    .replace(/^cotizaci[oó]n\s+de\s+/i, '')
    .replace(/^solicitud\s+de\s+/i, '')
    .replace(/^seguro\s+de\s+/i, '')
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}

interface PublicWebPagePreviewProps {
  config: UserWebPageConfig;
  insurers: WebPageInsurer[];
  formLinks?: SharedFormLink[];
  userData: {
    name: string;
    email: string;
    phone: string;
    photo_url: string | null;
    logo_url: string | null;
    office_name: string;
    web_slug?: string | null;
  };
}

export default function PublicWebPagePreview({
  config,
  insurers,
  formLinks = [],
  userData
}: PublicWebPagePreviewProps) {
  const primaryColor = config.primary_color;
  const secondaryColor = config.secondary_color;
  const customText = config.custom_text?.trim() || DEFAULT_TEXT;
  const textToDisplay = customText.split('\n').filter(t => t.trim());

  const whatsappNumber = userData.phone?.replace(/\D/g, '');
  const whatsappLink = whatsappNumber ? `https://wa.me/52${whatsappNumber}` : '#';
  const multicotizadorUrl = userData.web_slug
    ? `https://multicotizador.digital/cotiza/${userData.web_slug}`
    : '#';

  const [currentSlide, setCurrentSlide] = useState(0);
  const [formData, setFormData] = useState({
    nombre: '',
    celular: '',
    email: '',
    seguro_interes: ''
  });

  const handlePrevSlide = () => {
    setCurrentSlide(prev => (prev - 1 + Math.ceil(insurers.length / 4)) % Math.ceil(insurers.length / 4));
  };

  const handleNextSlide = () => {
    setCurrentSlide(prev => (prev + 1) % Math.ceil(insurers.length / 4));
  };

  const featuredFormLinks = formLinks
    .filter(l => l.featured_on_website)
    .sort((a, b) => (a.featured_order || 99) - (b.featured_order || 99))
    .slice(0, 6);

  const displayLinks = featuredFormLinks.length > 0 ? featuredFormLinks : formLinks.slice(0, 6);

  return (
    <div className="bg-white min-h-screen overflow-x-hidden">
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, ${createColorVariant(primaryColor, 0.1)} 0%, transparent 50%),
                           radial-gradient(circle at 80% 70%, ${createColorVariant(secondaryColor, 0.1)} 0%, transparent 50%)`
        }}
      />

      <section className="relative bg-gradient-to-b from-gray-50 to-white py-12 md:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              {userData.logo_url && (
                <div className="mb-6">
                  <img
                    src={userData.logo_url}
                    alt="Logo"
                    className="h-16 md:h-20 w-auto object-contain"
                  />
                </div>
              )}

              {userData.photo_url && (
                <div className="mb-6">
                  <img
                    src={userData.photo_url}
                    alt={userData.name}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover shadow-xl"
                  />
                </div>
              )}

              <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: primaryColor }}>
                {userData.name}
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-6">
                Asesor Personal de Seguros
              </p>

              <div className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: primaryColor }}>
                  Protege lo que mas importa
                </h2>
                <p className="text-gray-600 leading-relaxed max-w-lg">
                  Te ayudo a encontrar el seguro perfecto para ti y tu familia. Cotizaciones personalizadas, asesoria profesional y atencion inmediata por WhatsApp.
                </p>
              </div>

              <div className="flex flex-col items-center lg:items-start gap-3">
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

                {userData.web_slug && (
                  <a
                    href={multicotizadorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg text-sm"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    <Car className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    Ir a Multicotizador de Autos
                  </a>
                )}
              </div>
            </div>

            <div className="lg:sticky lg:top-24">
              <div
                className="bg-white rounded-2xl shadow-2xl p-5 md:p-6 border"
                style={{ borderColor: createColorVariant(primaryColor, 0.2) }}
              >
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  Solicita tu Cotizacion
                </h3>
                <p className="text-gray-600 mb-4 text-sm">
                  Completa el formulario y te contactare de inmediato
                </p>

                <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      value={formData.nombre}
                      onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none transition-colors text-sm"
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Celular *
                    </label>
                    <input
                      type="tel"
                      value={formData.celular}
                      onChange={(e) => setFormData(prev => ({ ...prev, celular: e.target.value }))}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none transition-colors text-sm"
                      placeholder="55 1234 5678"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none transition-colors text-sm"
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Seguro de Interes *
                    </label>
                    <select
                      value={formData.seguro_interes}
                      onChange={(e) => setFormData(prev => ({ ...prev, seguro_interes: e.target.value }))}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none transition-colors bg-white text-sm"
                    >
                      <option value="">Selecciona un seguro</option>
                      {displayLinks.map(link => (
                        <option key={link.slug} value={link.form_title}>
                          {cleanFormTitle(link.form_title)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-lg font-bold text-white transition-all duration-300 hover:shadow-lg text-sm"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                    }}
                  >
                    Solicitar Cotizacion
                  </button>

                  <p className="text-xs text-gray-500 text-center">
                    Al enviar, aceptas que te contactemos para ofrecerte informacion sobre seguros.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {insurers.length > 0 && (
        <section className="relative py-16 px-4 bg-gradient-to-b from-gray-50 to-white z-10">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 px-4" style={{ color: primaryColor }}>
              Aseguradoras de Confianza
            </h2>
            <p className="text-center text-gray-600 mb-8 sm:mb-12 max-w-2xl mx-auto text-base sm:text-lg px-4">
              Trabajo con las mejores aseguradoras del mercado para ofrecerte opciones competitivas
            </p>

            <div className="relative px-4">
              {insurers.length > 4 && (
                <>
                  <button
                    onClick={handlePrevSlide}
                    className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white rounded-full p-2 sm:p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
                    style={{ color: primaryColor }}
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <button
                    onClick={handleNextSlide}
                    className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white rounded-full p-2 sm:p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
                    style={{ color: primaryColor }}
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6 px-2">
                        {insurers.slice(slideIndex * 4, slideIndex * 4 + 4).map((insurer) => (
                          <div
                            key={insurer.id}
                            className="group bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 flex items-center justify-center transform hover:-translate-y-2 hover:scale-105 min-h-[100px] sm:min-h-[120px]"
                          >
                            <img
                              src={insurer.logo_url}
                              alt={insurer.name}
                              className="max-w-full max-h-12 sm:max-h-14 md:max-h-16 object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {insurers.length > 4 && (
                <div className="flex justify-center gap-2 mt-6 sm:mt-8">
                  {Array.from({ length: Math.ceil(insurers.length / 4) }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className="h-2 rounded-full transition-all duration-300"
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

      {displayLinks.length > 0 && (
        <section className="relative py-16 px-4 bg-gradient-to-b from-gray-50 to-white z-10">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 px-4" style={{ color: primaryColor }}>
              Seguros a tu medida
            </h2>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto text-base sm:text-lg px-4">
              Proteccion completa para lo que mas valoras
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-4">
              {displayLinks.map((link, idx) => {
                const meta = getFormMeta(link);
                const IconComponent = (LucideIcons as any)[meta.icon];
                const displayName = cleanFormTitle(link.form_title);

                return (
                  <div
                    key={link.slug}
                    className="group relative bg-white p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
                    style={{ animationDelay: `${idx * 100}ms` }}
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
                          className="mb-4 sm:mb-6 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg"
                          style={{
                            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                          }}
                        >
                          <IconComponent className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                        </div>
                      )}

                      <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 group-hover:text-opacity-90 transition-all" style={{ color: primaryColor }}>
                        {displayName}
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 leading-relaxed">
                        {meta.description}
                      </p>

                      <a
                        href={whatsappLink}
                        className="inline-flex items-center gap-2 text-sm sm:text-base font-bold hover:gap-3 transition-all duration-300 group/link"
                        style={{ color: secondaryColor }}
                      >
                        Cotizar
                        <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 group-hover/link:rotate-12 transition-transform" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="relative py-16 px-4 bg-white z-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 sm:mb-8 text-center px-4" style={{ color: primaryColor }}>
            Sobre Mi
          </h2>

          {!textToDisplay || textToDisplay.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay informacion disponible</p>
            </div>
          ) : (
            <div className="space-y-4 px-4">
              {textToDisplay.map((paragraph, index) => (
                <p key={index} className="text-base sm:text-lg text-gray-700 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="relative py-16 px-4 z-10" style={{ backgroundColor: createColorVariant(secondaryColor, 0.05) }}>
        <div className="max-w-6xl mx-auto">
          <div
            className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 md:p-12 border"
            style={{ borderColor: createColorVariant(primaryColor, 0.1) }}
          >
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                <a
                  href="https://www.seguwallet.mx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-6 block transition-transform duration-300 hover:scale-105"
                >
                  <img
                    src="/movirecurso_5.png"
                    alt="Seguwallet"
                    className="h-12 sm:h-14 w-auto object-contain"
                  />
                </a>

                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" style={{ color: primaryColor }}>
                  Descarga Seguwallet, nuestra app
                </h2>

                <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-2">
                  Todas tus polizas contratadas en Grupo JIRO, en un solo lugar.
                </p>

                <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
                  Accede, consulta y mantente al dia con tus polizas desde tu celular.
                </p>

                <div className="flex flex-col w-full sm:w-auto gap-3 mb-4">
                  <a
                    href="https://apps.apple.com/mx/app/seguwallet-by-movi-digital/id6744545607"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-black text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
                  >
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    <div className="text-left">
                      <div className="text-[10px] sm:text-xs font-normal">Descarga en</div>
                      <div className="text-sm sm:text-base font-bold -mt-0.5">App Store</div>
                    </div>
                  </a>

                  <a
                    href="https://play.google.com/store/apps/details?id=com.sicasonline.Seguwallet&pcampaignid=web_share"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-black text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
                  >
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                    </svg>
                    <div className="text-left">
                      <div className="text-[10px] sm:text-xs font-normal">Disponible en</div>
                      <div className="text-sm sm:text-base font-bold -mt-0.5">Google Play</div>
                    </div>
                  </a>
                </div>

                <a
                  href="https://www.seguwallet.mx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm sm:text-base font-bold transition-all duration-300 hover:gap-3"
                  style={{ color: secondaryColor }}
                >
                  Conoce mas sobre Seguwallet
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>

              <div className="flex items-center justify-center lg:justify-end">
                <img
                  src="https://movi.digital/wp-content/uploads/2025/02/seguwallet-movidigital.png"
                  alt="Seguwallet app en iOS y Android"
                  loading="lazy"
                  className="w-full max-w-sm lg:max-w-md object-contain transform hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-12 sm:py-16 px-4 bg-gray-50 z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4" style={{ color: primaryColor }}>
            Listo para proteger lo que mas valoras?
          </h3>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8 px-4">
            {userData.name} de {userData.office_name} te ayuda a cotizar y contratar seguros con atencion personalizada por WhatsApp.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <a
              href={whatsappLink}
              className="group inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl text-sm sm:text-base"
              style={{ backgroundColor: primaryColor }}
            >
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
              Contactame por WhatsApp
            </a>
            <a
              href={`tel:${userData.phone?.replace(/\D/g, '')}`}
              className="group inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold bg-white border-2 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl text-sm sm:text-base"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              <Phone className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
              Llamar Ahora
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 py-8 px-4 text-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <a
              href="https://grupojiro.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-transform duration-300 hover:scale-105"
            >
              <img
                src="https://jiro.mx/wp-content/uploads/2021/10/Grupo-Jiro-Logo-Blanco-01.png"
                alt="Grupo JIRO"
                className="h-8 w-auto object-contain"
              />
            </a>
          </div>
          <p className="text-sm text-gray-400 mb-2">
            {new Date().getFullYear()} Grupo JIRO. Todos los derechos reservados.
          </p>
          <div className="flex items-center justify-center gap-4 mb-2">
            <a
              href="https://jiro.mx/privacidad"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-white transition-colors underline"
            >
              Aviso de privacidad
            </a>
          </div>
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
      </a>

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
