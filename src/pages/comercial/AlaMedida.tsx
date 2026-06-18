import { useNavigate } from 'react-router-dom';
import { Car, HeartPulse, ArrowRight, Shield, Users, AlertTriangle, Compass } from 'lucide-react';

const AUTO_LOGOS = [
  '/qualitas-compania-de-seguros-logo-png_seeklogo-329374-2.png',
  '/zurich-logo-png_seeklogo-156664.png',
  '/chubb-logo-png_seeklogo-299281.png',
  '/mapfre-seguros-logo-png_seeklogo-225013.png',
  '/gnp-seguros.png',
];

const GMM_LOGOS = [
  '/gnp-seguros.png',
  '/logo-bupa.png',
  '/mapfre-seguros-logo-png_seeklogo-225013.png',
  '/logo-bx.png',
  '/plan-seguro-logo.png',
];

export default function AlaMedida() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto px-4 py-7">
      {/* Section header — unified Cotizar style */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 flex-shrink-0">
          <Compass className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">A la Medida</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Disenador inteligente de seguros — selecciona coberturas y encuentra la mejor aseguradora</p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Auto Card */}
        <button
          onClick={() => navigate('/cotizar/a-la-medida/auto')}
          className="group relative text-left rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/[0.06] overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-sky-100/40 dark:hover:shadow-sky-900/20 hover:-translate-y-1 hover:border-sky-200 dark:hover:border-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <div className="h-1.5 bg-gradient-to-r from-sky-500 to-blue-600" />

          <div className="p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-200/50 dark:shadow-sky-900/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <Car className="w-7 h-7 text-white" />
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-sm font-medium text-sky-600 dark:text-sky-400">Iniciar</span>
                <ArrowRight className="w-4 h-4 text-sky-600 dark:text-sky-400 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Seguro de Auto</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed mb-5">
              Compara 7 aseguradoras con 38 coberturas. Desde RC basica hasta coberturas premium como auto sustituto o reparacion en agencia.
            </p>

            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                <Shield className="w-3.5 h-3.5 text-sky-500" />
                <span className="font-medium">38 coberturas</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                <Users className="w-3.5 h-3.5 text-sky-500" />
                <span className="font-medium">7 aseguradoras</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium uppercase tracking-wide">Incluye:</span>
              <div className="flex items-center -space-x-1">
                {AUTO_LOGOS.map((logo, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-white dark:bg-neutral-800 border-2 border-white dark:border-neutral-900 shadow-sm flex items-center justify-center overflow-hidden">
                    <img src={logo} alt="" className="w-6 h-6 object-contain" />
                  </div>
                ))}
                <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 border-2 border-white dark:border-neutral-900 shadow-sm flex items-center justify-center">
                  <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400">+2</span>
                </div>
              </div>
            </div>
          </div>
        </button>

        {/* GMM Card */}
        <button
          onClick={() => navigate('/cotizar/a-la-medida/gmm')}
          className="group relative text-left rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/[0.06] overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-teal-100/40 dark:hover:shadow-teal-900/20 hover:-translate-y-1 hover:border-teal-200 dark:hover:border-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <div className="h-1.5 bg-gradient-to-r from-teal-500 to-emerald-600" />

          <div className="p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-200/50 dark:shadow-teal-900/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <HeartPulse className="w-7 h-7 text-white" />
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-sm font-medium text-teal-600 dark:text-teal-400">Iniciar</span>
                <ArrowRight className="w-4 h-4 text-teal-600 dark:text-teal-400 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Gastos Medicos Mayores</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed mb-5">
              Configura edad, suma asegurada, nivel hospitalario y coberturas. Encuentra el plan ideal entre 7 aseguradoras lideres.
            </p>

            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                <Shield className="w-3.5 h-3.5 text-teal-500" />
                <span className="font-medium">22 coberturas</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                <Users className="w-3.5 h-3.5 text-teal-500" />
                <span className="font-medium">7 aseguradoras</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium uppercase tracking-wide">Incluye:</span>
              <div className="flex items-center -space-x-1">
                {GMM_LOGOS.map((logo, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-white dark:bg-neutral-800 border-2 border-white dark:border-neutral-900 shadow-sm flex items-center justify-center overflow-hidden">
                    <img src={logo} alt="" className="w-6 h-6 object-contain" />
                  </div>
                ))}
                <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 border-2 border-white dark:border-neutral-900 shadow-sm flex items-center justify-center">
                  <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400">+2</span>
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 flex items-start gap-3 px-4 py-3.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/40 max-w-2xl">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          <span className="font-semibold text-amber-800 dark:text-amber-300">Informacion referencial.</span>{' '}
          El directorio de hospitales y la disponibilidad de coberturas pueden contener errores u omisiones.
          Confirma toda la informacion directamente con cada aseguradora antes de emitir una poliza.
        </p>
      </div>
    </div>
  );
}
