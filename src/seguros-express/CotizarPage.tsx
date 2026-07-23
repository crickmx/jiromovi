import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Zap } from 'lucide-react';
import CotizadorForm from './CotizadorForm';

export default function CotizarPage() {
  useEffect(() => { document.title = 'Cotiza tu seguro — seguros.express'; }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-600 via-sky-500 to-teal-500">
      <Helmet>
        <title>Cotiza tu seguro — seguros.express</title>
        <meta name="description" content="Deja tus datos y te conectamos con un asesor cercano. Cotización gratis y sin compromiso." />
      </Helmet>

      <header className="mx-auto max-w-3xl px-5 py-6">
        <a href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 ring-1 ring-white/30">
            <Zap className="h-4.5 w-4.5" />
          </span>
          seguros<span className="text-teal-100">.express</span>
        </a>
      </header>

      <main className="mx-auto max-w-lg px-5 pb-16">
        <div className="mb-6 text-center text-white">
          <h1 className="text-3xl font-extrabold tracking-tight">Cotiza tu seguro</h1>
          <p className="mt-2 text-sky-50/90">
            Toma menos de un minuto. Un asesor cercano te contactará muy pronto.
          </p>
        </div>
        <CotizadorForm />
      </main>
    </div>
  );
}
