import { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
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
    const rootEl = document.getElementById('root');
    rootEl?.classList.add('public-page');
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#070D1E';
    document.body.style.color = '#f8fafc';
    return () => {
      rootEl?.classList.remove('public-page');
    };
  }, []);

  return (
    <HelmetProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <div className="min-h-screen bg-[#070D1E] text-slate-100 antialiased">
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
