import { useEffect, useState } from 'react';
import { Trophy, Award, TrendingUp, Users } from 'lucide-react';
import { Card } from './ui/card';
import { supabase } from '../lib/supabase';

interface RankingData {
  posicion_nacional: number | null;
  total_vendedores_nacional: number;
  posicion_oficina: number | null;
  total_vendedores_oficina: number;
  nombre_oficina: string | null;
  produccion_anual: number;
  num_documentos: number;
  vendor_nombre: string;
}

interface RankingVendedorProps {
  compact?: boolean;
}

export default function RankingVendedor({ compact = false }: RankingVendedorProps) {
  const [loading, setLoading] = useState(true);
  const [hasVendor, setHasVendor] = useState(false);
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    fetchRanking();
  }, []);

  const fetchRanking = async () => {
    try {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-vendor-ranking`,
        {
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (result.success) {
        setHasVendor(result.has_vendor);
        if (result.has_vendor && result.ranking) {
          setRanking(result.ranking);
        } else {
          setMessage(result.message || '');
        }
      }
    } catch (error) {
      console.error('Error fetching ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPositionColor = (position: number | null) => {
    if (!position) return 'text-gray-600';
    if (position === 1) return 'text-yellow-600';
    if (position <= 3) return 'text-orange-600';
    if (position <= 10) return 'text-accent';
    return 'text-gray-600';
  };

  const getPositionIcon = (position: number | null) => {
    if (!position) return <Award className="w-8 h-8 text-gray-400" />;
    if (position === 1) return <Trophy className="w-8 h-8 text-yellow-500" />;
    if (position <= 3) return <Award className="w-8 h-8 text-orange-500" />;
    return <TrendingUp className="w-8 h-8 text-accent" />;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  if (!hasVendor) {
    return (
      <Card className="p-6 bg-yellow-50 border-yellow-200">
        <div className="flex items-start gap-3">
          <Award className="w-6 h-6 text-yellow-600 mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-1">
              Posición del vendedor
            </h3>
            <p className="text-sm text-yellow-800">{message}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!ranking) {
    return null;
  }

  if (compact) {
    return (
      <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-primary-200">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            {getPositionIcon(ranking.posicion_nacional)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-600 mb-1">Tu posición</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {ranking.posicion_nacional && (
                <span className={`text-lg font-bold ${getPositionColor(ranking.posicion_nacional)}`}>
                  #{ranking.posicion_nacional} Nacional
                </span>
              )}
              {ranking.posicion_oficina && ranking.nombre_oficina && (
                <span className="text-lg font-bold text-accent">
                  #{ranking.posicion_oficina} en {ranking.nombre_oficina}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Tu Posición como Vendedor</h2>
          <Trophy className="w-8 h-8 opacity-80" />
        </div>
        <p className="text-primary-100 text-sm">
          Acumulado anual {new Date().getFullYear()} • {ranking.num_documentos.toLocaleString('es-MX')} documentos
        </p>
      </div>

      <div className="p-6">
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Ranking Nacional */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                {getPositionIcon(ranking.posicion_nacional)}
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Nivel Nacional</p>
                <p className="text-xs text-gray-500">{ranking.total_vendedores_nacional} vendedores</p>
              </div>
            </div>
            {ranking.posicion_nacional ? (
              <div>
                <div className={`text-5xl font-bold mb-1 ${getPositionColor(ranking.posicion_nacional)}`}>
                  #{ranking.posicion_nacional}
                </div>
                <p className="text-sm text-gray-600">
                  {ranking.posicion_nacional === 1 && '¡Eres el número 1! 🏆'}
                  {ranking.posicion_nacional === 2 && 'Segundo lugar nacional'}
                  {ranking.posicion_nacional === 3 && 'Tercer lugar nacional'}
                  {ranking.posicion_nacional > 3 && `Top ${Math.ceil((ranking.posicion_nacional / ranking.total_vendedores_nacional) * 100)}%`}
                </p>
              </div>
            ) : (
              <p className="text-gray-500 italic">Posición no disponible</p>
            )}
          </div>

          {/* Ranking por Oficina */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-primary-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <Users className="w-8 h-8 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600 font-medium">En tu oficina</p>
                <p className="text-xs text-gray-500 truncate">
                  {ranking.nombre_oficina || 'Sin oficina asignada'}
                </p>
              </div>
            </div>
            {ranking.posicion_oficina && ranking.nombre_oficina ? (
              <div>
                <div className="text-5xl font-bold text-accent mb-1">
                  #{ranking.posicion_oficina}
                </div>
                <p className="text-sm text-gray-600">
                  {ranking.posicion_oficina === 1 && '¡El mejor de tu oficina! 🌟'}
                  {ranking.posicion_oficina === 2 && 'Segundo en tu oficina'}
                  {ranking.posicion_oficina === 3 && 'Tercero en tu oficina'}
                  {ranking.posicion_oficina > 3 && `De ${ranking.total_vendedores_oficina} vendedores`}
                </p>
              </div>
            ) : (
              <p className="text-gray-500 italic">
                {ranking.nombre_oficina ? 'Posición no disponible' : 'Oficina no asignada'}
              </p>
            )}
          </div>
        </div>

        {/* Producción Total */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tu producción anual</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatMoney(ranking.produccion_anual)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Documentos</p>
              <p className="text-2xl font-bold text-gray-900">
                {ranking.num_documentos.toLocaleString('es-MX')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Comparado contra todos los vendedores registrados en el sistema
          </p>
        </div>
      </div>
    </Card>
  );
}
