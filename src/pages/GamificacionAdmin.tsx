import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Users, Trophy, TrendingUp, Zap, Target, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);

  // Estado para ajuste manual
  const [ajusteUsuario, setAjusteUsuario] = useState('');
  const [ajusteXP, setAjusteXP] = useState('');
  const [ajusteJC, setAjusteJC] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');

  // Estados para modales de misiones
  const [misionModalOpen, setMisionModalOpen] = useState(false);
  const [misionEditando, setMisionEditando] = useState<AgentMission | null>(null);
  const [misionForm, setMisionForm] = useState({
    nombre: '',
    descripcion: '',
    tipo_evento: '',
    tipo_periodo: 'diaria' as 'diaria' | 'semanal' | 'mensual' | 'unica',
    xp_reward: 0,
    jc_reward: 0,
    cantidad_objetivo: 1,
    orden: 0,
    activa: true,
  });

  // Estados para modales de multiplicadores
  const [multModalOpen, setMultModalOpen] = useState(false);
  const [multEditando, setMultEditando] = useState<AgentXPMultiplier | null>(null);
  const [multForm, setMultForm] = useState({
    tipo: 'global' as 'global' | 'oficina' | 'rol' | 'usuario',
    referencia: '',
    factor: 1.0,
    descripcion: '',
    fecha_inicio: '',
    fecha_fin: '',
    activo: true,
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      console.log('Cargando datos de gamificación...');
      const [rankingData, statsData, misionesData, multData] = await Promise.all([
        obtenerRankingGlobal(100),
        obtenerEstadisticasGamificacion(),
        cargarMisiones(),
        cargarMultiplicadores(),
      ]);

      console.log('Datos cargados:', {
        ranking: rankingData?.length || 0,
        estadisticas: !!statsData,
        misiones: misionesData?.length || 0,
        multiplicadores: multData?.length || 0,
      });

      setRanking(rankingData || []);
      setEstadisticas(statsData);
      setMisiones(misionesData || []);
      setMultiplicadores(multData || []);
      setError(null);
    } catch (error: any) {
      console.error('Error cargando datos de gamificación:', error);
      setError(error?.message || 'Error desconocido al cargar datos');
      // Inicializar con valores vacíos en caso de error
      setRanking([]);
      setMisiones([]);
      setMultiplicadores([]);
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

  // Funciones para gestionar misiones
  const abrirModalMision = (mision?: AgentMission) => {
    if (mision) {
      setMisionEditando(mision);
      setMisionForm({
        nombre: mision.nombre,
        descripcion: mision.descripcion || '',
        tipo_evento: mision.tipo_evento,
        tipo_periodo: mision.tipo_periodo,
        xp_reward: mision.xp_reward,
        jc_reward: mision.jc_reward,
        cantidad_objetivo: mision.cantidad_objetivo,
        orden: mision.orden,
        activa: mision.activa,
      });
    } else {
      setMisionEditando(null);
      setMisionForm({
        nombre: '',
        descripcion: '',
        tipo_evento: '',
        tipo_periodo: 'diaria',
        xp_reward: 0,
        jc_reward: 0,
        cantidad_objetivo: 1,
        orden: 0,
        activa: true,
      });
    }
    setMisionModalOpen(true);
  };

  const guardarMision = async () => {
    if (!misionForm.nombre || !misionForm.tipo_evento) {
      alert('Completa todos los campos obligatorios');
      return;
    }

    const datos = {
      nombre: misionForm.nombre,
      descripcion: misionForm.descripcion,
      tipo_evento: misionForm.tipo_evento,
      tipo_periodo: misionForm.tipo_periodo,
      xp_reward: misionForm.xp_reward,
      jc_reward: misionForm.jc_reward,
      cantidad_objetivo: misionForm.cantidad_objetivo,
      orden: misionForm.orden,
      activa: misionForm.activa,
    };

    let error;
    if (misionEditando) {
      ({ error } = await supabase
        .from('agent_missions')
        .update(datos)
        .eq('id', misionEditando.id));
    } else {
      ({ error } = await supabase.from('agent_missions').insert([datos]));
    }

    if (error) {
      console.error('Error guardando misión:', error);
      alert('Error al guardar la misión');
    } else {
      setMisionModalOpen(false);
      cargarDatos();
    }
  };

  const eliminarMision = async (misionId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta misión?')) return;

    const { error } = await supabase.from('agent_missions').delete().eq('id', misionId);

    if (error) {
      console.error('Error eliminando misión:', error);
      alert('Error al eliminar la misión');
    } else {
      cargarDatos();
    }
  };

  // Funciones para gestionar multiplicadores
  const abrirModalMultiplicador = (mult?: AgentXPMultiplier) => {
    if (mult) {
      setMultEditando(mult);
      setMultForm({
        tipo: mult.tipo,
        referencia: mult.referencia || '',
        factor: mult.factor,
        descripcion: mult.descripcion || '',
        fecha_inicio: mult.fecha_inicio || '',
        fecha_fin: mult.fecha_fin || '',
        activo: mult.activo,
      });
    } else {
      setMultEditando(null);
      setMultForm({
        tipo: 'global',
        referencia: '',
        factor: 1.0,
        descripcion: '',
        fecha_inicio: '',
        fecha_fin: '',
        activo: true,
      });
    }
    setMultModalOpen(true);
  };

  const guardarMultiplicador = async () => {
    if (!multForm.descripcion || multForm.factor <= 0) {
      alert('Completa todos los campos obligatorios');
      return;
    }

    const datos = {
      tipo: multForm.tipo,
      referencia: multForm.referencia || null,
      factor: multForm.factor,
      descripcion: multForm.descripcion,
      fecha_inicio: multForm.fecha_inicio || null,
      fecha_fin: multForm.fecha_fin || null,
      activo: multForm.activo,
    };

    let error;
    if (multEditando) {
      ({ error } = await supabase
        .from('agent_xp_multipliers')
        .update(datos)
        .eq('id', multEditando.id));
    } else {
      ({ error } = await supabase.from('agent_xp_multipliers').insert([datos]));
    }

    if (error) {
      console.error('Error guardando multiplicador:', error);
      alert('Error al guardar el multiplicador');
    } else {
      setMultModalOpen(false);
      cargarDatos();
    }
  };

  const eliminarMultiplicador = async (multId: string) => {
    if (!confirm('¿Estás seguro de eliminar este multiplicador?')) return;

    const { error } = await supabase.from('agent_xp_multipliers').delete().eq('id', multId);

    if (error) {
      console.error('Error eliminando multiplicador:', error);
      alert('Error al eliminar el multiplicador');
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

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <PageHeader
          title="Administración de Gamificación"
          description="Gestiona el sistema de XP, Jiro Coins y misiones"
          icon={Settings}
        />
        <Card className="p-8 mt-6">
          <div className="text-center">
            <div className="text-red-600 mb-2">Error al cargar los datos</div>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <Button onClick={() => cargarDatos()}>Reintentar</Button>
          </div>
        </Card>
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-blue-600" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Agentes</p>
          </div>
          <p className="text-3xl font-bold">{estadisticas?.total_agentes || 0}</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-gray-600 dark:text-gray-400">XP Total Otorgado</p>
          </div>
          <p className="text-3xl font-bold">{(estadisticas?.total_xp_otorgado || 0).toLocaleString()}</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-5 h-5 text-purple-600" />
            <p className="text-sm text-gray-600 dark:text-gray-400">JC en Circulación</p>
          </div>
          <p className="text-3xl font-bold">{(estadisticas?.total_jc_circulacion || 0).toLocaleString()}</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-5 h-5 text-green-600" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Misiones Completadas</p>
          </div>
          <p className="text-3xl font-bold">{estadisticas?.misiones_completadas_mes || 0}</p>
          <p className="text-xs text-gray-500">Este mes</p>
        </Card>
      </div>

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
                  {ranking.length > 0 ? (
                    ranking.map((entry) => (
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No hay agentes registrados en el sistema de gamificación
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Misiones */}
        <TabsContent value="misiones" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Gestión de Misiones</h3>
            <Button onClick={() => abrirModalMision()}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Misión
            </Button>
          </div>

          {misiones.length > 0 ? (
            misiones.map((mision) => (
              <Card key={mision.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg mb-2">{mision.nombre}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {mision.descripcion}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline">+{mision.xp_reward} XP</Badge>
                      <Badge variant="outline">+{mision.jc_reward} JC</Badge>
                      <Badge variant="outline">{mision.tipo_periodo}</Badge>
                      <Badge variant="outline">Objetivo: {mision.cantidad_objetivo}</Badge>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirModalMision(mision)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => eliminarMision(mision.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center text-gray-500">
              No hay misiones configuradas. Crea tu primera misión.
            </Card>
          )}
        </TabsContent>

        {/* Multiplicadores */}
        <TabsContent value="multiplicadores" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Gestión de Multiplicadores</h3>
            <Button onClick={() => abrirModalMultiplicador()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Multiplicador
            </Button>
          </div>

          {multiplicadores.length > 0 ? (
            multiplicadores.map((mult) => (
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
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={mult.activo ? 'default' : 'outline'}
                      onClick={() => toggleMultiplicador(mult.id, mult.activo)}
                    >
                      {mult.activo ? 'Activo' : 'Inactivo'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirModalMultiplicador(mult)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => eliminarMultiplicador(mult.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center text-gray-500">
              No hay multiplicadores configurados. Crea tu primer multiplicador.
            </Card>
          )}
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

      {/* Modal para Crear/Editar Misión */}
      <Dialog open={misionModalOpen} onOpenChange={setMisionModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {misionEditando ? 'Editar Misión' : 'Nueva Misión'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nombre de la Misión *</Label>
              <Input
                value={misionForm.nombre}
                onChange={(e) => setMisionForm({ ...misionForm, nombre: e.target.value })}
                placeholder="Ej: Cerrar 5 ventas"
              />
            </div>

            <div>
              <Label>Descripción</Label>
              <Textarea
                value={misionForm.descripcion}
                onChange={(e) => setMisionForm({ ...misionForm, descripcion: e.target.value })}
                placeholder="Describe la misión"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Evento *</Label>
                <Input
                  value={misionForm.tipo_evento}
                  onChange={(e) => setMisionForm({ ...misionForm, tipo_evento: e.target.value })}
                  placeholder="Ej: venta_cerrada"
                />
              </div>

              <div>
                <Label>Período *</Label>
                <Select
                  value={misionForm.tipo_periodo}
                  onValueChange={(value: any) =>
                    setMisionForm({ ...misionForm, tipo_periodo: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diaria">Diaria</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="unica">Única</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Recompensa XP</Label>
                <Input
                  type="number"
                  value={misionForm.xp_reward}
                  onChange={(e) =>
                    setMisionForm({ ...misionForm, xp_reward: parseInt(e.target.value) || 0 })
                  }
                  placeholder="100"
                />
              </div>

              <div>
                <Label>Recompensa JC</Label>
                <Input
                  type="number"
                  value={misionForm.jc_reward}
                  onChange={(e) =>
                    setMisionForm({ ...misionForm, jc_reward: parseInt(e.target.value) || 0 })
                  }
                  placeholder="50"
                />
              </div>

              <div>
                <Label>Cantidad Objetivo</Label>
                <Input
                  type="number"
                  value={misionForm.cantidad_objetivo}
                  onChange={(e) =>
                    setMisionForm({
                      ...misionForm,
                      cantidad_objetivo: parseInt(e.target.value) || 1,
                    })
                  }
                  placeholder="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Orden (para mostrar)</Label>
                <Input
                  type="number"
                  value={misionForm.orden}
                  onChange={(e) =>
                    setMisionForm({ ...misionForm, orden: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                />
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="mision-activa"
                  checked={misionForm.activa}
                  onChange={(e) =>
                    setMisionForm({ ...misionForm, activa: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="mision-activa">Misión activa</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setMisionModalOpen(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={guardarMision}>
                <Save className="w-4 h-4 mr-2" />
                Guardar Misión
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Crear/Editar Multiplicador */}
      <Dialog open={multModalOpen} onOpenChange={setMultModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {multEditando ? 'Editar Multiplicador' : 'Nuevo Multiplicador'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Descripción *</Label>
              <Textarea
                value={multForm.descripcion}
                onChange={(e) => setMultForm({ ...multForm, descripcion: e.target.value })}
                placeholder="Describe el multiplicador"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo *</Label>
                <Select
                  value={multForm.tipo}
                  onValueChange={(value: any) => setMultForm({ ...multForm, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="oficina">Oficina</SelectItem>
                    <SelectItem value="rol">Rol</SelectItem>
                    <SelectItem value="usuario">Usuario</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Factor *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={multForm.factor}
                  onChange={(e) =>
                    setMultForm({ ...multForm, factor: parseFloat(e.target.value) || 1.0 })
                  }
                  placeholder="1.5"
                />
              </div>
            </div>

            <div>
              <Label>Referencia</Label>
              <Input
                value={multForm.referencia}
                onChange={(e) => setMultForm({ ...multForm, referencia: e.target.value })}
                placeholder="UUID de oficina, rol o usuario (si aplica)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Deja vacío para multiplicadores globales
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha Inicio</Label>
                <Input
                  type="date"
                  value={multForm.fecha_inicio}
                  onChange={(e) =>
                    setMultForm({ ...multForm, fecha_inicio: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Fecha Fin</Label>
                <Input
                  type="date"
                  value={multForm.fecha_fin}
                  onChange={(e) => setMultForm({ ...multForm, fecha_fin: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="mult-activo"
                checked={multForm.activo}
                onChange={(e) => setMultForm({ ...multForm, activo: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="mult-activo">Multiplicador activo</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setMultModalOpen(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={guardarMultiplicador}>
                <Save className="w-4 h-4 mr-2" />
                Guardar Multiplicador
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
