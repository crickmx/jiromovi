import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Users, Trophy, TrendingUp, Zap, Target, Plus, CreditCard as Edit, Trash2, Save } from 'lucide-react';
import {
  obtenerRankingGlobal,
  obtenerEstadisticasGamificacion,
  registrarEventoGamificacion,
} from '../lib/gamificationUtils';
import { supabase } from '../lib/supabase';
import type {
  RankingEntry,
  EstadisticasGamificacion,
  AgentMission,
  AgentXPMultiplier,
} from '../lib/gamificationTypes';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { PageHeader } from '../components/ui/page-header';
import { cn } from '../lib/utils';

export default function GamificacionAdmin() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasGamificacion | null>(null);
  const [misiones, setMisiones] = useState<AgentMission[]>([]);
  const [multiplicadores, setMultiplicadores] = useState<AgentXPMultiplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado para ajuste manual
  const [ajusteUsuario, setAjusteUsuario] = useState('');
  const [ajusteXP, setAjusteXP] = useState('');
  const [ajusteJC, setAjusteJC] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [rankingData, statsData, misionesData, multData] = await Promise.all([
        obtenerRankingGlobal(100),
        obtenerEstadisticasGamificacion(),
        cargarMisiones(),
        cargarMultiplicadores(),
      ]);

      setRanking(rankingData);
      setEstadisticas(statsData);
      setMisiones(misionesData);
      setMultiplicadores(multData);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarMisiones = async () => {
    const { data, error } = await supabase
      .from('agent_missions')
      .select('*')
      .order('orden', { ascending: true });

    if (error) {
      console.error('Error cargando misiones:', error);
      return [];
    }

    return data || [];
  };

  const cargarMultiplicadores = async () => {
    const { data, error } = await supabase
      .from('agent_xp_multipliers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando multiplicadores:', error);
      return [];
    }

    return data || [];
  };

  const handleAjusteManual = async () => {
    if (!ajusteUsuario || (!ajusteXP && !ajusteJC)) {
      alert('Debes completar todos los campos');
      return;
    }

    const xp = parseInt(ajusteXP) || 0;
    const jc = parseInt(ajusteJC) || 0;

    const eventId = await registrarEventoGamificacion({
      userId: ajusteUsuario,
      tipoEvento: 'ajuste_manual',
      xpDelta: xp,
      jcDelta: jc,
      reversible: false,
      metadata: {
        motivo: ajusteMotivo,
        ajustado_por: user?.id,
      },
    });

    if (eventId) {
      alert('Ajuste realizado con éxito');
      setAjusteUsuario('');
      setAjusteXP('');
      setAjusteJC('');
      setAjusteMotivo('');
      cargarDatos();
    } else {
      alert('Error al realizar el ajuste');
    }
  };

  const toggleMision = async (misionId: string, activa: boolean) => {
    const { error } = await supabase
      .from('agent_missions')
      .update({ activa: !activa })
      .eq('id', misionId);

    if (error) {
      console.error('Error actualizando misión:', error);
      alert('Error al actualizar misión');
    } else {
      cargarDatos();
    }
  };

  const toggleMultiplicador = async (multId: string, activo: boolean) => {
    const { error } = await supabase
      .from('agent_xp_multipliers')
      .update({ activo: !activo })
      .eq('id', multId);

    if (error) {
      console.error('Error actualizando multiplicador:', error);
      alert('Error al actualizar multiplicador');
    } else {
      cargarDatos();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <PageHeader
        title="Administración de Gamificación"
        description="Gestiona el sistema de XP, Jiro Coins y misiones"
        icon={Settings}
      />

      {/* Estadísticas Globales */}
      {estadisticas && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Agentes</p>
            </div>
            <p className="text-3xl font-bold">{estadisticas.total_agentes}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">XP Total Otorgado</p>
            </div>
            <p className="text-3xl font-bold">{estadisticas.total_xp_otorgado.toLocaleString()}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-5 h-5 text-purple-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">JC en Circulación</p>
            </div>
            <p className="text-3xl font-bold">{estadisticas.total_jc_circulacion.toLocaleString()}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-green-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Misiones Completadas</p>
            </div>
            <p className="text-3xl font-bold">{estadisticas.misiones_completadas_mes}</p>
            <p className="text-xs text-gray-500">Este mes</p>
          </Card>
        </div>
      )}

      <Tabs defaultValue="ranking" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="misiones">Misiones</TabsTrigger>
          <TabsTrigger value="multiplicadores">Multiplicadores</TabsTrigger>
          <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
        </TabsList>

        {/* Ranking */}
        <TabsContent value="ranking">
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold">Top 100 Agentes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Posición
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Agente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Oficina
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      XP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nivel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      JC
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {ranking.map((entry) => (
                    <tr key={entry.user_id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'font-bold',
                            entry.posicion === 1 && 'text-yellow-500',
                            entry.posicion === 2 && 'text-gray-400',
                            entry.posicion === 3 && 'text-orange-600'
                          )}
                        >
                          #{entry.posicion}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-medium">{entry.nombre_completo}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {entry.oficina_nombre || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {entry.xp_total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="outline">Nivel {entry.nivel_actual}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entry.jiro_coins_balance.toLocaleString()} JC
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Misiones */}
        <TabsContent value="misiones" className="space-y-4">
          {misiones.map((mision) => (
            <Card key={mision.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-2">{mision.nombre}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {mision.descripcion}
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline">+{mision.xp_reward} XP</Badge>
                    <Badge variant="outline">+{mision.jc_reward} JC</Badge>
                    <Badge variant="outline">{mision.tipo_periodo}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={mision.activa ? 'default' : 'outline'}
                    onClick={() => toggleMision(mision.id, mision.activa)}
                  >
                    {mision.activa ? 'Activa' : 'Inactiva'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Multiplicadores */}
        <TabsContent value="multiplicadores" className="space-y-4">
          {multiplicadores.map((mult) => (
            <Card key={mult.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge>{mult.tipo}</Badge>
                    <h4 className="font-semibold">
                      Factor {mult.factor}x - {mult.referencia || 'Global'}
                    </h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {mult.descripcion}
                  </p>
                  {mult.fecha_inicio && mult.fecha_fin && (
                    <p className="text-xs text-gray-500">
                      Vigente del {new Date(mult.fecha_inicio).toLocaleDateString()} al{' '}
                      {new Date(mult.fecha_fin).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={mult.activo ? 'default' : 'outline'}
                  onClick={() => toggleMultiplicador(mult.id, mult.activo)}
                >
                  {mult.activo ? 'Activo' : 'Inactivo'}
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Ajustes Manuales */}
        <TabsContent value="ajustes">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">Ajuste Manual de XP y Jiro Coins</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <Label>Usuario ID</Label>
                <Input
                  value={ajusteUsuario}
                  onChange={(e) => setAjusteUsuario(e.target.value)}
                  placeholder="UUID del usuario"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>XP Delta</Label>
                  <Input
                    type="number"
                    value={ajusteXP}
                    onChange={(e) => setAjusteXP(e.target.value)}
                    placeholder="Ej: +100 o -50"
                  />
                </div>

                <div>
                  <Label>JC Delta</Label>
                  <Input
                    type="number"
                    value={ajusteJC}
                    onChange={(e) => setAjusteJC(e.target.value)}
                    placeholder="Ej: +200 o -100"
                  />
                </div>
              </div>

              <div>
                <Label>Motivo</Label>
                <Textarea
                  value={ajusteMotivo}
                  onChange={(e) => setAjusteMotivo(e.target.value)}
                  placeholder="Describe el motivo del ajuste"
                  rows={3}
                />
              </div>

              <Button onClick={handleAjusteManual} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Aplicar Ajuste
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
