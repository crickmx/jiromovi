import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Fact {
  titulo: string;
  hecho: string;
  fuente: string | null;
  categoria: string;
}

const FALLBACK_FACTS: Fact[] = [
  {
    categoria: 'seguros',
    titulo: 'El principio de indemnización',
    hecho: 'El seguro opera bajo el principio de indemnización: el objetivo no es generar ganancia al asegurado, sino restituirlo a su condición económica previa al siniestro.',
    fuente: 'IAIS',
  },
  {
    categoria: 'mexico',
    titulo: 'Agentes en México',
    hecho: 'México cuenta con más de 120,000 agentes de seguros certificados registrados ante la CNSF, de los cuales el 40% son agentes exclusivos de una sola aseguradora.',
    fuente: 'CNSF',
  },
  {
    categoria: 'tecnologia',
    titulo: 'Plataformas digitales para agentes',
    hecho: 'Las plataformas digitales especializadas para agentes de seguros aumentan su productividad hasta 3 veces al centralizar cotización, emisión, cobranza y servicio al cliente.',
    fuente: 'Celent',
  },
  {
    categoria: 'agentes',
    titulo: 'Retención de clientes',
    hecho: 'Retener a un cliente existente cuesta 5 veces menos que adquirir uno nuevo; los agentes más rentables enfocan el 60% de su tiempo en servicios postventa y renovaciones.',
    fuente: 'Bain & Company',
  },
  {
    categoria: 'seguros',
    titulo: 'Seguros paramétricos',
    hecho: 'Los seguros paramétricos pagan automáticamente al activarse un parámetro predefinido —como un terremoto de magnitud 6.5— eliminando el proceso de ajuste tradicional.',
    fuente: 'World Bank',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  seguros: '#38bdf8',
  mexico: '#34d399',
  tecnologia: '#22d3ee',
  agentes: '#60a5fa',
  curiosidades: '#fbbf24',
};

const CATEGORY_LABELS: Record<string, string> = {
  seguros: 'Seguros',
  mexico: 'México',
  tecnologia: 'Tecnología',
  agentes: 'Agentes',
  curiosidades: 'Curiosidades',
};

let cachedFacts: Fact[] | null = null;

export function LoadingFactCard() {
  // Pick one random fact on mount and keep it for the whole loading session
  const [fact, setFact] = useState<Fact>(
    () => FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)]
  );

  useEffect(() => {
    const pickFrom = (list: Fact[]) => list[Math.floor(Math.random() * list.length)];

    if (cachedFacts && cachedFacts.length > 0) {
      setFact(pickFrom(cachedFacts));
      return;
    }

    supabase
      .from('loading_facts')
      .select('titulo, hecho, fuente, categoria')
      .eq('activo', true)
      .limit(100)
      .then(({ data }) => {
        if (data && data.length > 0) {
          cachedFacts = data as Fact[];
          setFact(pickFrom(cachedFacts));
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const color = CATEGORY_COLORS[fact.categoria] ?? '#38bdf8';
  const catLabel = CATEGORY_LABELS[fact.categoria] ?? fact.categoria;

  return (
    <div className="lf-card">
      <span className="lf-category" style={{ color }}>{catLabel}</span>
      <p className="lf-title">{fact.titulo}</p>
      <p className="lf-body">{fact.hecho}</p>
      {fact.fuente && <span className="lf-source">Fuente: {fact.fuente}</span>}

      <style>{`
        .lf-card {
          max-width: 360px;
          text-align: center;
          padding: 0 16px;
          animation: lf-in 0.5s ease both;
        }
        .lf-category {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 7px;
        }
        .lf-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          margin: 0 0 8px;
          line-height: 1.45;
        }
        .lf-body {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          line-height: 1.65;
          margin: 0 0 8px;
        }
        .lf-source {
          font-size: 10px;
          color: rgba(255,255,255,0.26);
          font-style: italic;
        }
        @keyframes lf-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
