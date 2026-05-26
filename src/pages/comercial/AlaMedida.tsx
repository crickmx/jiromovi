import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, HeartPulse, Compass, ArrowRight, Sparkles } from 'lucide-react';

const DESIGNERS = [
  {
    id: 'auto',
    title: 'Seguro de Auto Individual',
    description: 'Selecciona coberturas y encuentra la aseguradora que mejor se adapta al perfil de tu cliente.',
    icon: Car,
    coverageCount: 38,
    insurerCount: 7,
    categories: ['RC', 'Danos Materiales', 'Robo', 'Asistencia Vial', 'Coberturas Especiales'],
    gradient: 'from-sky-500 to-blue-600',
    bgLight: 'bg-sky-50',
    path: '/a-la-medida/auto',
  },
  {
    id: 'gmm',
    title: 'Gastos Medicos Mayores',
    description: 'Configura el perfil del asegurado y encuentra el plan medico ideal entre las principales aseguradoras.',
    icon: HeartPulse,
    coverageCount: 22,
    insurerCount: 6,
    categories: ['Hospitalizacion', 'Ambulatorio', 'Maternidad', 'Dental', 'Internacional'],
    gradient: 'from-teal-500 to-emerald-600',
    bgLight: 'bg-teal-50',
    path: '/a-la-medida/gmm',
  },
];

export default function AlaMedida() {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 text-sky-700 text-sm font-medium mb-4">
          <Compass className="w-4 h-4" />
          Disenador Inteligente
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          A la medida
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-base leading-relaxed">
          Selecciona las coberturas que necesita tu cliente y descubre que aseguradoras ofrecen la mejor compatibilidad.
          Compara opciones de forma visual e inteligente.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {DESIGNERS.map((designer) => {
          const Icon = designer.icon;
          const isHovered = hoveredCard === designer.id;

          return (
            <button
              key={designer.id}
              onClick={() => navigate(designer.path)}
              onMouseEnter={() => setHoveredCard(designer.id)}
              onMouseLeave={() => setHoveredCard(null)}
              className="group relative text-left rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-gray-900/30 hover:-translate-y-1 hover:border-gray-300 dark:hover:border-gray-600"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${designer.gradient} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                <Icon className="w-6 h-6 text-white" />
              </div>

              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {designer.title}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">
                {designer.description}
              </p>

              <div className="flex items-center gap-4 mb-4">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
                  {designer.coverageCount} coberturas
                </span>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
                  {designer.insurerCount} aseguradoras
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-5">
                {designer.categories.map((cat) => (
                  <span
                    key={cat}
                    className={`text-xs px-2 py-0.5 rounded ${designer.bgLight} text-gray-700 dark:bg-gray-700 dark:text-gray-300`}
                  >
                    {cat}
                  </span>
                ))}
              </div>

              <div className={`flex items-center gap-2 text-sm font-medium transition-all duration-300 ${isHovered ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                <span>Iniciar disenador</span>
                <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${isHovered ? 'translate-x-1' : ''}`} />
              </div>

              {isHovered && (
                <div className="absolute top-4 right-4">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Los datos mostrados son referenciales y se actualizan periodicamente.
          Confirma siempre condiciones con la aseguradora antes de emitir.
        </p>
      </div>
    </div>
  );
}
