import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, Zap, Star, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  obtenerPerfilGamificacion,
  obtenerPosicionAgente,
  formatearXP,
  formatearJiroCoins,
} from '../lib/gamificationUtils';
import { RANGOS_CONFIG } from '../lib/gamificationTypes';
import type { AgentGamificationProfile, PosicionAgente } from '../lib/gamificationTypes';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export default function ProgresoGamificacion() {
  const { usuario: user } = useAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<AgentGamificationProfile | null>(null);
  const [posicion, setPosicion] = useState<PosicionAgente | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id && user?.rol === 'Agente') {
      cargarDatos();
    } else {
      setLoading(false);
    }
  }, [user?.id, user?.rol]);

  const cargarDatos = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const [perfilData, posicionData] = await Promise.all([
        obtenerPerfilGamificacion(user.id),
        obtenerPosicionAgente(user.id),
      ]);

      setPerfil(perfilData);
      setPosicion(posicionData);
    } catch (error) {
      console.error('Error cargando progreso:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  if (!perfil || user?.rol !== 'Agente') {
    return null;
  }

  const rangoConfig = RANGOS_CONFIG[perfil.rango_actual] || RANGOS_CONFIG['Agente Base'];

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg bg-gradient-to-br', rangoConfig.gradiente)}>
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Mi Progreso</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {perfil.rango_actual} - Nivel {perfil.nivel_actual}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate('/mi-progreso')}
          className="text-blue-600 hover:text-blue-700"
        >
          Ver todo
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-blue-600" />
            <p className="text-xs text-gray-600 dark:text-gray-400">XP Total</p>
          </div>
          <p className="text-xl font-bold text-blue-600">{formatearXP(perfil.xp_total)}</p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4 text-yellow-600" />
            <p className="text-xs text-gray-600 dark:text-gray-400">Jiro Coins</p>
          </div>
          <p className="text-xl font-bold text-yellow-600">
            {formatearJiroCoins(perfil.jiro_coins_balance)}
          </p>
        </div>
      </div>

      {posicion && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Ranking Global</span>
            <Badge variant="outline" className="font-semibold">
              #{posicion.posicion_global} de {posicion.total_agentes}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Ranking Oficina</span>
            <Badge variant="outline" className="font-semibold">
              #{posicion.posicion_oficina} de {posicion.total_agentes_oficina}
            </Badge>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {perfil.total_polizas_emitidas}
            </p>
            <p className="text-xs text-gray-500">Pólizas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {perfil.total_cursos_completados}
            </p>
            <p className="text-xs text-gray-500">Cursos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {perfil.total_renovaciones}
            </p>
            <p className="text-xs text-gray-500">Renovaciones</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
