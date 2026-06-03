import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface Fact {
  titulo: string;
  hecho: string;
  fuente: string | null;
  categoria: string;
}

// Fallback facts in case DB is unavailable during loading
const FALLBACK_FACTS: Fact[] = [
  {
    categoria: 'seguros',
    titulo: 'El principio de indemnización',
    hecho: 'El seguro opera bajo el principio de indemnización: el objetivo no es generar ganancia al asegurado, sino restituirlo a su condición económica previa al siniestro.',
    fuente: 'IAIS',
  },
  {
    categoria: 'mexico',
    titulo: 'Mercado asegurador mexicano',
    hecho: 'México es uno de los mercados aseguradores más grandes de América Latina, representando cerca del 2.3% del PIB con un enorme potencial de crecimiento.',
    fuente: 'AMIS',
  },
  {
    categoria: 'tecnologia',
    titulo: 'Insurtech en el mundo',
    hecho: 'Las insurtech recibieron más de $15 mil millones en inversiones globales entre 2020 y 2023, transformando desde la suscripción de pólizas hasta la liquidación de siniestros.',
    fuente: 'CB Insights',
  },
  {
    categoria: 'agentes',
    titulo: 'Retención de clientes',
    hecho: 'Retener a un cliente existente cuesta 5 veces menos que adquirir uno nuevo; los agentes con mayor rentabilidad enfocan el 60% de su tiempo en servicios postventa y renovaciones.',
    fuente: 'Bain & Company',
  },
  {
    categoria: 'agentes',
    titulo: 'Presencia digital del agente',
    hecho: 'Los agentes con sitio web y presencia en redes sociales generan el doble de prospectos; el 70% de los menores de 45 años busca a su agente de seguros por internet.',
    fuente: 'Google / LIMRA',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  seguros: 'text-sky-400',
  mexico: 'text-emerald-400',
  tecnologia: 'text-cyan-400',
  agentes: 'text-blue-400',
  curiosidades: 'text-amber-400',
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
  const [facts, setFacts] = useState<Fact[]>(FALLBACK_FACTS);
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.floor(Math.random() * FALLBACK_FACTS.length)
  );
  const [visible, setVisible] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load facts once from DB (or use cache)
  useEffect(() => {
    if (cachedFacts) {
      setFacts(cachedFacts);
      setCurrentIndex(Math.floor(Math.random() * cachedFacts.length));
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
          setFacts(cachedFacts);
          setCurrentIndex(Math.floor(Math.random() * cachedFacts.length));
        }
      });
  }, []);

  // Rotate fact every 5 seconds with a fade transition
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex((i) => (i + 1) % facts.length);
        setVisible(true);
      }, 400);
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [facts.length]);

  const fact = facts[currentIndex];
  const colorClass = CATEGORY_COLORS[fact.categoria] ?? 'text-sky-400';
  const catLabel = CATEGORY_LABELS[fact.categoria] ?? fact.categoria;

  return (
    <div
      className="loading-fact-card"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.35s ease' }}
    >
      <span className={`loading-fact-category ${colorClass}`}>{catLabel}</span>
      <p className="loading-fact-title">{fact.titulo}</p>
      <p className="loading-fact-body">{fact.hecho}</p>
      {fact.fuente && (
        <span className="loading-fact-source">Fuente: {fact.fuente}</span>
      )}

      <style>{`
        .loading-fact-card {
          max-width: 380px;
          text-align: center;
          padding: 0 16px;
        }
        .loading-fact-category {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .loading-fact-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.92);
          margin: 0 0 8px;
          line-height: 1.4;
        }
        .loading-fact-body {
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          line-height: 1.6;
          margin: 0 0 8px;
        }
        .loading-fact-source {
          font-size: 10px;
          color: rgba(255,255,255,0.28);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
