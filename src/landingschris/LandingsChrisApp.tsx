import { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import LandingsIndex from './LandingsIndex';
import MutuusLanding from '../pages/MutuusLanding';

function SlugRouter() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) return <LandingsIndex />;

  const normalized = (slug || '').toLowerCase();

  if (normalized === 'mutuus' || normalized === 'membresia-salud' || normalized === 'salud-sin-deducible') {
    return <MutuusLanding />;
  }

  // Si cualquier otro slug se abre, mostramos la landing activa
  return <MutuusLanding />;
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070D1E] text-white">
      <div className="w-10 h-10 border-[3px] border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
    </div>
  );
}

export default function LandingsChrisApp() {
  useEffect(() => {
    // Configuraciones visuales y de título sincrónicas
    const rootEl = document.getElementById('root');
    rootEl?.classList.add('public-page');
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#070D1E';
    document.body.style.color = '#f8fafc';
    document.title = 'Mutuus Salud Inteligente | Membresía Médica Sin Deducible';

    // Favicon dinámico verde esmeralda para salud
    const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (favicon) {
      favicon.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/></svg>";
    }

    return () => {
      rootEl?.classList.remove('public-page');
    };
  }, []);

  return (
    <HelmetProvider>
      <Helmet>
        <title>Mutuus Salud Inteligente | Membresía Médica Sin Deducible en México</title>
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/></svg>" />
        <meta name="theme-color" content="#070D1E" />
      </Helmet>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <div className="min-h-screen bg-[#070D1E] text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
            <Routes>
              <Route path="/mutuus" element={<MutuusLanding />} />
              <Route path="/membresia-salud" element={<MutuusLanding />} />
              <Route path="/salud-sin-deducible" element={<MutuusLanding />} />
              <Route path="/:slug" element={<SlugRouter />} />
              <Route path="/" element={<LandingsIndex />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Suspense>
      </BrowserRouter>
    </HelmetProvider>
  );
}
