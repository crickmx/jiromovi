import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Globe,
  Sparkles,
  ExternalLink,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  HeartPulse,
  ChevronRight,
  Copy,
  Check,
  Shield,
  Zap,
  ArrowUpRight
} from 'lucide-react';

interface LandingItem {
  slug: string;
  title: string;
  category: string;
  tagline: string;
  status: 'active' | 'draft' | 'testing';
  updatedAt: string;
  views: number;
  icon: typeof HeartPulse;
  gradient: string;
}

const LANDINGS: LandingItem[] = [
  {
    slug: 'mutuus',
    title: 'Mutuus Salud Inteligente',
    category: 'Salud & Gastos Médicos',
    tagline: 'Membresía médica privada sin deducible ni coaseguro. +650 hospitales en México.',
    status: 'active',
    updatedAt: 'Hoy',
    views: 124,
    icon: HeartPulse,
    gradient: 'from-emerald-500 to-teal-400',
  },
];

export default function LandingsIndex() {
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://landing.movi.digital';

  const handleCopyLink = (slug: string) => {
    const url = `${currentHost}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const filtered = LANDINGS.filter(
    (l) =>
      l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070D1E] text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      <Helmet>
        <title>Landings Chris | Motor de Páginas & Campañas</title>
        <meta name="description" content="Plataforma de despliegue y gestión de páginas web y landings de alto impacto." />
      </Helmet>

      {/* Top Banner */}
      <header className="border-b border-white/10 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-cyan-500/20">
              <Zap className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight flex items-center gap-1.5">
                landingschris<span className="text-cyan-400">.</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-bold border border-cyan-500/20">
                  Engine v1.0
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="hidden sm:inline">Dominio activo:</span>
            <code className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-[11px]">
              landing.movi.digital
            </code>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Motor Independiente de Landings & Campañas</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Directorio de Páginas Activas
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Todas las páginas se compilan y visualizan al instante en <code className="text-emerald-400 font-mono text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-800">landing.movi.digital/[slug]</code>.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por slug, nombre o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-700 focus:border-cyan-400 text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
          />
        </div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {filtered.map((landing) => {
            const Icon = landing.icon;
            const fullUrl = `${currentHost}/${landing.slug}`;

            return (
              <div
                key={landing.slug}
                className="group relative rounded-3xl bg-slate-900/70 border border-white/10 hover:border-emerald-500/40 p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-950/40 hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${landing.gradient} flex items-center justify-center text-slate-950 shadow-md`}>
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Activa
                      </span>
                    </div>
                  </div>

                  <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                    {landing.category}
                  </span>
                  <h2 className="text-xl font-bold text-white mt-1 mb-2 group-hover:text-emerald-300 transition-colors">
                    {landing.title}
                  </h2>
                  <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
                    {landing.tagline}
                  </p>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300 mb-6">
                    <span className="truncate text-cyan-300">{fullUrl}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(landing.slug)}
                      className="ml-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors shrink-0"
                      title="Copiar URL"
                    >
                      {copiedSlug === landing.slug ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                  <a
                    href={`/${landing.slug}`}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 transition-all"
                  >
                    Abrir Landing <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
