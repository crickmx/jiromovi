import { Helmet } from 'react-helmet-async';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { MUTUUS_PORTAL_URL, MutuusOfficialLogo } from './MutuusLanding';

// Página provisional del home de mutuus.mx mientras se termina la landing completa,
// que sigue disponible (sin indexar) en /preview.
export default function MutuusComingSoon() {
  return (
    <>
      <Helmet>
        <html lang="es-MX" />
        <title>Mutuus Salud Inteligente | Nos estamos renovando para ti</title>
        <meta name="description" content="Estamos renovando nuestro sitio. Mientras tanto, contrata tu Seguro Médico Inteligente Mutuus en línea, sin deducible ni coaseguro." />
        <link rel="canonical" href="https://mutuus.mx/" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_MX" />
        <meta property="og:site_name" content="Mutuus Salud Inteligente" />
        <meta property="og:title" content="Mutuus Salud Inteligente | Nos estamos renovando para ti" />
        <meta property="og:description" content="Contrata tu Seguro Médico Inteligente Mutuus en línea, sin deducible ni coaseguro." />
        <meta property="og:url" content="https://mutuus.mx/" />
        <meta property="og:image" content="https://mutuus.mx/brand/mutuus/og-mutuus.jpg?v=1" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Mutuus Salud Inteligente | Nos estamos renovando para ti" />
        <meta name="twitter:image" content="https://mutuus.mx/brand/mutuus/og-mutuus.jpg?v=1" />
      </Helmet>

      <div
        className="min-h-screen flex flex-col bg-gradient-to-b from-[#F4F9FF] via-white to-white text-[#2B2A2A] antialiased"
        style={{ fontFamily: 'Montserrat, system-ui, -apple-system, sans-serif' }}
      >
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl text-center">
            <MutuusOfficialLogo className="h-12 w-auto mx-auto" />

            <span className="mt-10 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#CBD5E1] bg-[#EFF6FF] text-[#003896] text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#8DC63F] animate-pulse" />
              Sitio en renovación
            </span>

            <h1 className="mt-6 text-3xl sm:text-5xl font-black tracking-tight leading-tight text-[#003896]">
              Nos estamos renovando para ti
            </h1>

            <p className="mt-5 text-base sm:text-lg text-slate-600">
              Muy pronto tendrás aquí una experiencia nueva. Mientras tanto, puedes contratar tu
              Seguro Médico Inteligente Mutuus en línea, sin deducible ni coaseguro.
            </p>

            <a
              href={MUTUUS_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-9 inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-base font-bold text-[#002666] bg-[#8DC63F] hover:bg-[#7FB534] shadow-lg shadow-[#8DC63F]/30 transition-colors"
            >
              Contratar en línea <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </main>

        <footer className="px-4 py-6 text-center text-xs text-slate-500">
          <a
            href="https://www.grupojiro.com/aviso-de-privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-[#003896] transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#8DC63F]" /> Aviso de Privacidad (Grupo JIRO)
          </a>
        </footer>
      </div>
    </>
  );
}
