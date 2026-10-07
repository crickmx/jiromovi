import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const LandingsIndex = lazy(() => import('./LandingsIndex'));
const MutuusLanding = lazy(() => import('../pages/MutuusLanding'));

function SlugRouter() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) return <LandingsIndex />;

  const normalized = (slug || '').toLowerCase();

  if (normalized === 'mutuus' || normalized === 'membresia-salud' || normalized === 'salud-sin-deducible') {
    return <MutuusLanding />;
  }

  // Fallback to Mutuus if any subroute is visited, or LandingsIndex
  return <MutuusLanding />;
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070D1E]">
      <div className="w-10 h-10 border-[3px] border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
    </div>
  );
}

export default function LandingsChrisApp() {
  useEffect(() => {
    const rootEl = document.getElementById('root');
    rootEl?.classList.add('public-page');
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
          <Routes>
            <Route path="/mutuus" element={<MutuusLanding />} />
            <Route path="/membresia-salud" element={<MutuusLanding />} />
            <Route path="/salud-sin-deducible" element={<MutuusLanding />} />
            <Route path="/:slug" element={<SlugRouter />} />
            <Route path="/" element={<LandingsIndex />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </HelmetProvider>
  );
}
