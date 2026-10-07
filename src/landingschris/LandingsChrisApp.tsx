import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const LandingsIndex = lazy(() => import('./LandingsIndex'));
const MutuusLanding = lazy(() => import('../pages/MutuusLanding'));

function SlugRouter() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) return <LandingsIndex />;

  const normalized = slug.toLowerCase();

  if (normalized === 'mutuus' || normalized === 'membresia-salud' || normalized === 'salud-sin-deducible') {
    return <MutuusLanding />;
  }

  // Fallback to landings index if slug not found
  return <Navigate to="/" replace />;
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070D1E]">
      <div className="w-10 h-10 border-[3px] border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
    </div>
  );
}

export default function LandingsChrisApp() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingsIndex />} />
            <Route path="/:slug" element={<SlugRouter />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </HelmetProvider>
  );
}
