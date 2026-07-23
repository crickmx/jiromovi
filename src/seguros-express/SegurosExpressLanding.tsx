import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { MapPin, Clock, ShieldCheck, Users, ArrowRight, Zap } from 'lucide-react';
import CotizadorForm from './CotizadorForm';

const BENEFICIOS = [
  { icon: MapPin, title: 'Asesor cercano', desc: 'Te conectamos con un agente real cerca de ti, no un call center.' },
  { icon: Clock, title: 'Respuesta rápida', desc: 'Un asesor disponible te contacta en cuanto dejas tus datos.' },
  { icon: ShieldCheck, title: 'Sin compromiso', desc: 'Cotiza gratis. Tú decides si avanzas, sin presión.' },
  { icon: Users, title: 'Trato humano', desc: 'Personas expertas que resuelven tus dudas, de tú a tú.' },
];

function scrollToForm() {
  document.getElementById('cotizar')?.scrollIntoView({ behavior: 'smooth' });
}

export default function SegurosExpressLanding() {
  useEffect(() => { document.title = 'seguros.express — Cotiza con un asesor cercano'; }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Helmet>
        <title>seguros.express — Cotiza tu seguro con un asesor cercano</title>
        <meta name="description" content="Cotiza tu seguro de auto, vida, gastos médicos y más. Te conectamos con un asesor cercano que te atiende de forma personal." />
      </Helmet>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white">
              <Zap className="h-4.5 w-4.5" />
            </span>
            seguros<span className="text-sky-600">.express</span>
          </span>
          <button
            onClick={scrollToForm}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Cotizar ahora
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-sky-500 to-teal-500" />
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(60rem_30rem_at_top_right,white,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div className="text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/30">
              <MapPin className="h-3.5 w-3.5" /> Asesores cerca de ti
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Tu seguro, con un asesor <span className="text-teal-100">cercano y real</span>.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-sky-50/90">
              Deja tus datos y te conectamos con un agente cerca de ti que te atiende de
              forma personal. Sin call centers, sin vueltas.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={scrollToForm}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-sky-700 shadow-lg transition hover:bg-sky-50"
              >
                Cotiza gratis <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-sky-50/70">Cotización gratis y sin compromiso.</p>
          </div>

          {/* Formulario embebido */}
          <div id="cotizar" className="scroll-mt-24">
            <CotizadorForm />
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          ¿Por qué seguros.express?
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFICIOS.map((b) => (
            <div key={b.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                <b.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold">{b.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-14 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Da el primer paso hoy
          </h2>
          <p className="max-w-xl text-slate-300">
            Toma menos de un minuto. Deja tus datos y un asesor cercano te contactará.
          </p>
          <button
            onClick={scrollToForm}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-sky-400"
          >
            Cotizar ahora <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-8 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} seguros.express · Un servicio de la red de asesores MOVI.
        </div>
      </footer>
    </div>
  );
}
