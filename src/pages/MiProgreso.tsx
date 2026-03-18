import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Trophy,
  Zap,
  Star,
  TrendingUp,
  Award,
  Crown,
  Target,
  Clock,
  Calendar,
} from 'lucide-react';
import {
  obtenerPerfilGamificacion,
  obtenerMisionesAgente,
  obtenerPosicionAgente,
  obtenerHistorialEventos,
  obtenerNiveles,
  calcularProgresoNivel,
  formatearXP,
  formatearJiroCoins,
  formatearDelta,
  obtenerColorDelta,
  obtenerTextoPeriodo,
  misionCercaDeCompletar,
} from '../lib/gamificationUtils';
import { EVENTOS_CONFIG, RANGOS_CONFIG } from '../lib/gamificationTypes';
import type {
  AgentGamificationProfile,
  MisionAgente,
  PosicionAgente,
  AgentGamificationEvent,
  AgentLevel,
} from '../lib/gamificationTypes';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { PageHeader } from '../components/ui/page-header';
import { cn } from '../lib/utils';

export default function MiProgreso() {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState<AgentGamificationProfile | null>(null);
  const [misiones, setMisiones] = useState<MisionAgente[]>([]);
  const [posicion, setPosicion] = useState<PosicionAgente | null>(null);
  const [historial, setHistorial] = useState<AgentGamificationEvent[]>([]);
  const [niveles, setNiveles] = useState<AgentLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      cargarDatos();
    }
  }, [user?.id]);

  const cargarDatos = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const [perfilData, misionesData, posicionData, historialData, nivelesData] =
        await Promise.all([
          obtenerPerfilGamificacion(user.id),
          obtenerMisionesAgente(user.id),
          obtenerPosicionAgente(user.id),
          obtenerHistorialEventos(user.id, 20),
          obtenerNiveles(),
        ]);

      setPerfil(perfilData);
      setMisiones(misionesData);
      setPosicion(posicionData);
      setHistorial(historialData);
      setNiveles(nivelesData);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold mb-2">Bienvenido al Sistema de Gamificación</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Tu perfil de gamificación se creará automáticamente cuando realices tu primera acción.
          </p>
          <p className="text-sm text-gray-500">
            Completa misiones, gana XP y sube de nivel para obtener Jiro Coins.
          </p>
        </Card>
      </div>
    );
  }

  const progreso = calcularProgresoNivel(perfil.xp_total, perfil.nivel_actual, niveles);
  const rangoConfig = RANGOS_CONFIG[perfil.rango_actual] || RANGOS_CONFIG['Agente Base'];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <PageHeader
        title="Mi Progreso"
        description="Sigue tu evolución como agente Jiro"
        icon={Trophy}
      />

      {/* Resumen Principal */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* XP Total */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <Badge variant="outline">{perfil.rango_actual}</Badge>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">XP Total</p>
          <p className="text-3xl font-bold mb-2">{formatearXP(perfil.xp_total)}</p>
          <p className="text-xs text-gray-500">Nivel {perfil.nivel_actual}</p>
        </Card>

        {/* Jiro Coins */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <Star className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Jiro Coins</p>
          <p className={cn('text-3xl font-bold mb-2', perfil.jiro_coins_balance < 0 && 'text-red-600')}>
            {formatearJiroCoins(perfil.jiro_coins_balance)}
          </p>
          <p className="text-xs text-gray-500">Disponibles</p>
        </Card>

        {/* Posición Global */}
        {posicion && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Ranking Global</p>
            <p className="text-3xl font-bold mb-2">#{posicion.posicion_global}</p>
            <p className="text-xs text-gray-500">de {posicion.total_agentes} agentes</p>
          </Card>
        )}

        {/* Posición Oficina */}
        {posicion && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Award className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Ranking Oficina</p>
            <p className="text-3xl font-bold mb-2">#{posicion.posicion_oficina}</p>
            <p className="text-xs text-gray-500">de {posicion.total_agentes_oficina} agentes</p>
          </Card>
        )}
      </div>

      {/* Progreso de Nivel */}
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">
              Nivel {perfil.nivel_actual} - {perfil.rango_actual}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {rangoConfig.descripcion}
            </p>
          </div>
          <div className={cn('p-3 rounded-full bg-gradient-to-br', rangoConfig.gradiente)}>
            {perfil.rango_actual === 'Leyenda Jiro' && <Crown className="w-8 h-8 text-white" />}
            {perfil.rango_actual === 'Maestro Élite' && <Trophy className="w-8 h-8 text-white" />}
            {perfil.rango_actual === 'Agente Élite' && <Award className="w-8 h-8 text-white" />}
            {perfil.rango_actual === 'Agente Base' && <Zap className="w-8 h-8 text-white" />}
          </div>
        </div>

        {progreso.xp_necesario > 0 && (
          <>
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>{formatearXP(perfil.xp_total)} XP</span>
                <span className="text-gray-600 dark:text-gray-400">
                  {formatearXP(progreso.xp_necesario)} XP para subir
                </span>
                <span>{formatearXP(progreso.xp_siguiente_nivel)} XP</span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full bg-gradient-to-r transition-all', rangoConfig.gradiente)}
                  style={{ width: `${progreso.porcentaje}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 text-right">
              {progreso.porcentaje.toFixed(1)}% completado
            </p>
          </>
        )}
      </Card>

      <Tabs defaultValue="misiones" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="misiones">Misiones</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="estadisticas">Estadísticas</TabsTrigger>
        </TabsList>

        {/* Misiones */}
        <TabsContent value="misiones" className="space-y-4">
          {misiones.length === 0 && (
            <Card className="p-8 text-center">
              <Target className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">
                No hay misiones activas en este momento
              </p>
            </Card>
          )}

          {misiones.map((mision) => (
            <Card key={mision.mission_id} className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className="p-3 rounded-lg"
                  style={{
                    backgroundColor: mision.color + '20',
                    color: mision.color,
                  }}
                >
                  <Target className="w-6 h-6" />
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-lg mb-1">{mision.nombre}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {mision.descripcion}
                      </p>
                    </div>
                    {mision.completada && (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        Completada
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <Badge variant="outline">
                      <Calendar className="w-3 h-3 mr-1" />
                      {obtenerTextoPeriodo(mision.tipo_periodo)}
                    </Badge>
                    <Badge variant="outline">
                      <Zap className="w-3 h-3 mr-1" />
                      +{mision.xp_reward} XP
                    </Badge>
                    <Badge variant="outline">
                      <Star className="w-3 h-3 mr-1" />
                      +{mision.jc_reward} JC
                    </Badge>
                  </div>

                  {/* Barra de progreso */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Progreso</span>
                      <span className="font-medium">
                        {mision.progreso_actual} / {mision.meta_requerida}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full transition-all',
                          mision.completada
                            ? 'bg-green-500'
                            : misionCercaDeCompletar(mision.progreso_actual, mision.meta_requerida)
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                        )}
                        style={{ width: `${Math.min(100, mision.porcentaje_completado)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Historial */}
        <TabsContent value="historial" className="space-y-3">
          {historial.length === 0 && (
            <Card className="p-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">
                No hay eventos registrados todavía
              </p>
            </Card>
          )}

          {historial.map((evento) => {
            const config = EVENTOS_CONFIG[evento.tipo_evento];
            return (
              <Card key={evento.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      backgroundColor: config.color + '20',
                      color: config.color,
                    }}
                  >
                    <Zap className="w-5 h-5" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium mb-1">{config.label}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(evento.fecha_evento).toLocaleString('es-MX')}
                        </p>
                      </div>

                      <div className="text-right">
                        {evento.xp_delta !== 0 && (
                          <p className={cn('text-sm font-medium', obtenerColorDelta(evento.xp_delta))}>
                            {formatearDelta(evento.xp_delta, 'xp')}
                          </p>
                        )}
                        {evento.jc_delta !== 0 && (
                          <p className={cn('text-sm font-medium', obtenerColorDelta(evento.jc_delta))}>
                            {formatearDelta(evento.jc_delta, 'jc')}
                          </p>
                        )}
                      </div>
                    </div>

                    {evento.reversed_by_event_id && (
                      <Badge variant="outline" className="mt-2 text-xs bg-red-50 dark:bg-red-900/20">
                        Revertido
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </TabsContent>

        {/* Estadísticas */}
        <TabsContent value="estadisticas">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Pólizas Emitidas</p>
              <p className="text-3xl font-bold">{perfil.total_polizas_emitidas}</p>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Prospectos</p>
              <p className="text-3xl font-bold">{perfil.total_prospectos}</p>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Cursos Completados</p>
              <p className="text-3xl font-bold">{perfil.total_cursos_completados}</p>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Certificaciones</p>
              <p className="text-3xl font-bold">{perfil.total_certificaciones}</p>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Renovaciones</p>
              <p className="text-3xl font-bold">{perfil.total_renovaciones}</p>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Antigüedad</p>
              <p className="text-3xl font-bold">{perfil.anios_antiguedad.toFixed(1)}</p>
              <p className="text-xs text-gray-500 mt-1">años</p>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Multiplicador Veterano</p>
              <p className="text-3xl font-bold">{perfil.multiplicador_veterano.toFixed(2)}x</p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
