import { useState } from 'react';

interface Fact {
  titulo: string;
  hecho: string;
  fuente?: string;
  categoria?: string;
}

const FALLBACK_FACTS: Fact[] = [
  {
    titulo: 'Seguro de Vida',
    hecho: 'El 70% de los hogares en México no cuenta con seguro de vida, dejando a las familias vulnerables ante imprevistos.',
    fuente: 'CNSF 2023',
    categoria: 'vida',
  },
  {
    titulo: 'Protección Vehicular',
    hecho: 'En México ocurren más de 400,000 accidentes de tránsito al año. El seguro vehicular puede cubrir daños a terceros y reparaciones.',
    fuente: 'INEGI 2023',
    categoria: 'auto',
  },
  {
    titulo: 'Gastos Médicos',
    hecho: 'Una hospitalización de emergencia puede costar entre $50,000 y $500,000 pesos. El seguro de gastos médicos mayores te protege ante estos escenarios.',
    fuente: 'AMIS 2023',
    categoria: 'salud',
  },
  {
    titulo: 'Inteligencia Artificial',
    hecho: 'Los agentes de IA como Chava pueden procesar miles de pólizas en segundos, ayudándote a encontrar la mejor cobertura para tus clientes.',
    fuente: 'Chava AI',
    categoria: 'tecnologia',
  },
  {
    titulo: 'Renovaciones',
    hecho: 'Recordar renovaciones a tiempo puede aumentar la retención de clientes hasta en un 40%. Chava te ayuda a automatizar este proceso.',
    fuente: 'Estudio de Retención 2023',
    categoria: 'negocio',
  },
];

export function LoadingFactCard() {
  const [fact] = useState<Fact>(
    () => FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)]
  );

  const categoryColors: Record<string, string> = {
    vida: 'text-emerald-400 bg-emerald-400/10',
    auto: 'text-amber-400 bg-amber-400/10',
    salud: 'text-rose-400 bg-rose-400/10',
    tecnologia: 'text-sky-400 bg-sky-400/10',
    negocio: 'text-violet-400 bg-violet-400/10',
  };

  const catKey = fact.categoria ?? 'tecnologia';
  const colorClass = categoryColors[catKey] ?? categoryColors.tecnologia;

  return (
    <div className="max-w-xs text-center px-6">
      {fact.categoria && (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 ${colorClass}`}>
          {fact.categoria.charAt(0).toUpperCase() + fact.categoria.slice(1)}
        </span>
      )}
      <h3 className="text-white font-semibold text-sm mb-2">{fact.titulo}</h3>
      <p className="text-surface-400 text-xs leading-relaxed">{fact.hecho}</p>
      {fact.fuente && (
        <p className="text-surface-600 text-xs mt-2">— {fact.fuente}</p>
      )}
    </div>
  );
}
