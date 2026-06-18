import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Copy, Power, PowerOff, ChevronRight, RefreshCw,
  AlertTriangle, Settings, Shield, BookOpen, Calendar,
  CheckCircle2, Clock, XCircle, Scale,
} from 'lucide-react';
import {
  fetchAllFiscalRules,
  activateFiscalRule,
  duplicateFiscalRule,
  formatVersionBadge,
} from '../lib/fiscalRegimenUtils';
import {
  REGIMEN_LABELS,
  type FiscalRegimenRule,
  type RegimenCodigo,
} from '../lib/fiscalRegimenTypes';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '@/components/ui/page-header';

const REGIMEN_ORDER: RegimenCodigo[] = ['honorarios', 'resico', 'asimilados'];

const REGIMEN_COLORS: Record<RegimenCodigo, string> = {
  honorarios: 'bg-blue-50 border-blue-200 text-blue-700',
  resico: 'bg-teal-50 border-teal-200 text-teal-700',
  asimilados: 'bg-orange-50 border-orange-200 text-orange-700',
};

const REGIMEN_DOTS: Record<RegimenCodigo, string> = {
  honorarios: 'bg-blue-500',
  resico: 'bg-teal-500',
  asimilados: 'bg-orange-500',
};

export default function RegimenFiscalAdmin() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';

  const [rules, setRules] = useState<FiscalRegimenRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateModal, setDuplicateModal] = useState<{ rule: FiscalRegimenRule; newVersion: string } | null>(null);
  const [newRuleModal, setNewRuleModal] = useState<{ regimen: RegimenCodigo; version: string; nombre: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllFiscalRules();
      setRules(data);
    } catch (e) {
      setError('Error al cargar las reglas fiscales');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleActivate = async (rule: FiscalRegimenRule) => {
    if (!isAdmin) return;
    if (!confirm(`¿Activar versión "${rule.version}" de ${REGIMEN_LABELS[rule.regimen_codigo]}? Esto desactivará las demás versiones del mismo régimen.`)) return;

    setActionLoading(rule.id);
    try {
      await activateFiscalRule(rule.id);
      await load();
    } catch (e: any) {
      setError(e.message || 'Error al activar la regla');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateModal) return;
    if (!duplicateModal.newVersion.trim()) return;

    setActionLoading('duplicate');
    try {
      const newId = await duplicateFiscalRule(duplicateModal.rule.id, duplicateModal.newVersion.trim());
      setDuplicateModal(null);
      await load();
      navigate(`/comisiones/regimen-fiscal/${newId}`);
    } catch (e: any) {
      setError(e.message || 'Error al duplicar la regla');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNewRule = async () => {
    if (!newRuleModal) return;
    if (!newRuleModal.version.trim() || !newRuleModal.nombre.trim()) return;

    setActionLoading('new');
    try {
      const { supabase } = await import('../lib/supabase');
      const { data, error: insertError } = await supabase
        .from('fiscal_regime_rules')
        .insert({
          regimen_codigo: newRuleModal.regimen,
          nombre_regimen: newRuleModal.nombre.trim(),
          version: newRuleModal.version.trim(),
          vigente_desde: new Date().toISOString().split('T')[0],
          activo: false,
          estado: 'borrador',
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setNewRuleModal(null);
      await load();
      navigate(`/comisiones/regimen-fiscal/${data.id}`);
    } catch (e: any) {
      setError(e.message || 'Error al crear la regla');
    } finally {
      setActionLoading(null);
    }
  };

  const rulesByRegimen = REGIMEN_ORDER.reduce((acc, r) => {
    acc[r] = rules.filter(rule => rule.regimen_codigo === r);
    return acc;
  }, {} as Record<RegimenCodigo, FiscalRegimenRule[]>);

  const getStateIcon = (estado: string) => {
    if (estado === 'activo') return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    if (estado === 'borrador') return <Clock className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-neutral-400" />;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Regimen Fiscal"
        description="Modulo de configuracion de reglas fiscales por regimen"
        icon={Scale}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => setNewRuleModal({ regimen: 'honorarios', version: '', nombre: '' })}
                className="gap-2 bg-neutral-800 hover:bg-neutral-700"
              >
                <Plus className="w-4 h-4" />
                Nueva version
              </Button>
            )}
          </div>
        }
      />

      {/* Warning Banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Advertencia importante</p>
          <p className="text-sm text-amber-700 mt-0.5">
            Estas reglas afectan directamente los cálculos fiscales y la generación de PDFs del módulo de Comisiones.
            Cambiar porcentajes o fórmulas modificará los cálculos futuros. Los cálculos históricos no se verán afectados.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-xl border border-neutral-200 p-6 space-y-3 animate-pulse">
              <div className="h-5 bg-neutral-200 rounded w-2/3" />
              <div className="h-4 bg-neutral-100 rounded w-1/2" />
              <div className="space-y-2 mt-4">
                <div className="h-12 bg-neutral-100 rounded-lg" />
                <div className="h-12 bg-neutral-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {REGIMEN_ORDER.map(regimen => {
            const regimenRules = rulesByRegimen[regimen] || [];
            const activeRule = regimenRules.find(r => r.estado === 'activo');

            return (
              <div key={regimen} className="rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 overflow-hidden">
                {/* Régimen header */}
                <div className={`px-5 py-4 border-b border-neutral-200 dark:border-white/10`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${REGIMEN_DOTS[regimen]}`} />
                    <h2 className="font-semibold text-neutral-900 dark:text-white text-sm">
                      {REGIMEN_LABELS[regimen]}
                    </h2>
                  </div>
                  {activeRule ? (
                    <p className="text-xs text-neutral-500 mt-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Versión activa: <span className="font-mono font-medium text-neutral-700 dark:text-white/70">{activeRule.version}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" />
                      Sin versión activa — cálculos bloqueados
                    </p>
                  )}
                </div>

                {/* List of versions */}
                <div className="divide-y divide-neutral-100 dark:divide-white/5">
                  {regimenRules.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <BookOpen className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-sm text-neutral-500">Sin versiones configuradas</p>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 text-xs"
                          onClick={() => setNewRuleModal({ regimen, version: 'v1.0', nombre: REGIMEN_LABELS[regimen] })}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Crear versión
                        </Button>
                      )}
                    </div>
                  ) : (
                    regimenRules.map(rule => {
                      const badge = formatVersionBadge(rule.estado);
                      const isActioning = actionLoading === rule.id;

                      return (
                        <div
                          key={rule.id}
                          className="px-4 py-3 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getStateIcon(rule.estado)}
                                <span className="font-mono text-sm font-semibold text-neutral-800 dark:text-white/80">
                                  {rule.version}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
                                  {badge.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-xs text-neutral-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(rule.vigente_desde + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  {rule.vigente_hasta && (
                                    <> – {new Date(rule.vigente_hasta + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                                  )}
                                </span>
                              </div>
                              {rule.notas && (
                                <p className="text-xs text-neutral-400 mt-1 truncate">{rule.notas}</p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-neutral-500 hover:text-neutral-700"
                                onClick={() => navigate(`/comisiones/regimen-fiscal/${rule.id}`)}
                                title="Ver / Editar reglas"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </Button>

                              {isAdmin && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-neutral-500 hover:text-neutral-700"
                                    onClick={() => setDuplicateModal({ rule, newVersion: rule.version + '-copia' })}
                                    title="Duplicar versión"
                                    disabled={isActioning}
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </Button>

                                  {rule.estado !== 'activo' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-700"
                                      onClick={() => handleActivate(rule)}
                                      title="Activar esta versión"
                                      disabled={isActioning}
                                    >
                                      {isActioning ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Power className="w-3.5 h-3.5" />
                                      )}
                                    </Button>
                                  )}
                                </>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-neutral-400 hover:text-neutral-600"
                                onClick={() => navigate(`/comisiones/regimen-fiscal/${rule.id}`)}
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add version button */}
                {isAdmin && regimenRules.length > 0 && (
                  <div className="px-4 py-3 border-t border-neutral-100 dark:border-white/5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-neutral-500 hover:text-neutral-700 gap-1.5"
                      onClick={() => setNewRuleModal({ regimen, version: '', nombre: REGIMEN_LABELS[regimen] })}
                    >
                      <Plus className="w-3 h-3" />
                      Nueva versión para {REGIMEN_LABELS[regimen]}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Información de referencia */}
      <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 p-5">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70 mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          Referencia de configuración actual (fiscal_v3_audit)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="font-semibold text-blue-700 mb-1">HONORARIOS</p>
            <ul className="space-y-0.5 text-neutral-600 dark:text-white/50">
              <li>IVA = 16% × Gravada</li>
              <li>Ret. ISR = 14% × Gravada</li>
              <li>Ret. IVA = 66.67% × IVA</li>
              <li>Total Fiscal = Total + IVA − ISR − Ret.IVA</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-teal-700 mb-1">RESICO</p>
            <ul className="space-y-0.5 text-neutral-600 dark:text-white/50">
              <li>IVA = 16% × Gravada</li>
              <li>Ret. ISR = 1.25% × Gravada (1%–2.5%)</li>
              <li>Ret. IVA = 66.67% × IVA</li>
              <li>Total Fiscal = Total + IVA − ISR − Ret.IVA</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-orange-700 mb-1">ASIMILADOS</p>
            <ul className="space-y-0.5 text-neutral-600 dark:text-white/50">
              <li>IVA = 0</li>
              <li>Ret. ISR = Tasa × Gravada</li>
              <li>Ret. Contable = 16% × Exenta</li>
              <li>Costo Dispersión = 9% × Gravada</li>
              <li>Total Final = T.Fiscal − Ret.C. − Costo.D.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Duplicate Modal */}
      {duplicateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Duplicar versión</h3>
            <p className="text-sm text-neutral-500">
              Se creará una copia de la versión <span className="font-mono font-semibold">{duplicateModal.rule.version}</span> de {REGIMEN_LABELS[duplicateModal.rule.regimen_codigo]} como borrador.
            </p>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
                Nueva versión
              </label>
              <input
                type="text"
                value={duplicateModal.newVersion}
                onChange={e => setDuplicateModal(d => d ? { ...d, newVersion: e.target.value } : null)}
                placeholder="ej: v2.0"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDuplicateModal(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-neutral-800 hover:bg-neutral-700"
                onClick={handleDuplicate}
                disabled={!duplicateModal.newVersion.trim() || actionLoading === 'duplicate'}
              >
                {actionLoading === 'duplicate' ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                Duplicar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Rule Modal */}
      {newRuleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Nueva versión de reglas</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
                  Régimen
                </label>
                <select
                  value={newRuleModal.regimen}
                  onChange={e => setNewRuleModal(d => d ? { ...d, regimen: e.target.value as RegimenCodigo } : null)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:bg-white/5 dark:text-white"
                >
                  {REGIMEN_ORDER.map(r => (
                    <option key={r} value={r}>{REGIMEN_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
                  Versión
                </label>
                <input
                  type="text"
                  value={newRuleModal.version}
                  onChange={e => setNewRuleModal(d => d ? { ...d, version: e.target.value } : null)}
                  placeholder="ej: v2.0"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
                  Nombre del régimen
                </label>
                <input
                  type="text"
                  value={newRuleModal.nombre}
                  onChange={e => setNewRuleModal(d => d ? { ...d, nombre: e.target.value } : null)}
                  placeholder="ej: Honorarios 2025"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setNewRuleModal(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-neutral-800 hover:bg-neutral-700"
                onClick={handleNewRule}
                disabled={!newRuleModal.version.trim() || !newRuleModal.nombre.trim() || actionLoading === 'new'}
              >
                {actionLoading === 'new' ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Crear
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
