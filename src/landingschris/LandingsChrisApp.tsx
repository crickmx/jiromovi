import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import LandingsIndex from './LandingsIndex';
import MutuusLanding from '../pages/MutuusLanding';

function SlugDispatcher() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) return <LandingsIndex />;

  const normalized = (slug || '').toLowerCase();

  if (normalized === 'mutuus' || normalized === 'membresia-salud' || normalized === 'salud-sin-deducible') {
    return <MutuusLanding />;
  }

  return <MutuusLanding />;
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
        <div className="w-full min-h-screen bg-[#070D1E] text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
          <Routes>
            <Route path="/mutuus" element={<MutuusLanding />} />
            <Route path="/membresia-salud" element={<MutuusLanding />} />
            <Route path="/salud-sin-deducible" element={<MutuusLanding />} />
            <Route path="/:slug" element={<SlugDispatcher />} />
            <Route path="/" element={<LandingsIndex />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </HelmetProvider>
  );
}
