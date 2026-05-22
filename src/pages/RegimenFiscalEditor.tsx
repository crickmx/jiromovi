import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save, Power, AlertTriangle, CheckCircle2,
  Clock, XCircle, Info, ChevronDown, ChevronUp,
  Eye, EyeOff, FileText, Calculator, Pencil, Scale,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import {
  fetchFiscalRuleWithLines,
  activateFiscalRule,
  updateFiscalRule,
  updateFiscalRuleLine,
  validarLineasRegimen,
  ejecutarCalculoDinamico,
  evaluarFormula,
  formatVersionBadge,
} from '../lib/fiscalRegimenUtils';
import {
  REGIMEN_LABELS,
  CONCEPTO_LABELS,
  BASE_LABELS,
  TIPO_REGLA_LABELS,
  FORMULA_VARIABLES,
  type FiscalRegimenRuleWithLines,
  type FiscalRegimenRuleLine,
  type ConceptoCodigo,
  type BaseCodigo,
  type TipoRegla,
  type SignoResultado,
  type RegimenCodigo,
} from '../lib/fiscalRegimenTypes';
import { Button } from '../components/ui/button';

const SIGNO_LABELS: Record<SignoResultado, { label: string; color: string }> = {
  positivo: { label: '+', color: 'text-emerald-600' },
  negativo: { label: '-', color: 'text-red-500' },
  neutro: { label: '=', color: 'text-neutral-500 dark:text-white/50' },
};


interface LineEdit extends FiscalRegimenRuleLine {
  dirty?: boolean;
}

function numVal(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

export default function RegimenFiscalEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [rule, setRule] = useState<FiscalRegimenRuleWithLines | null>(null);
  const [lines, setLines] = useState<LineEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewGravada, setPreviewGravada] = useState(1000);
  const [previewExenta, setPreviewExenta] = useState(500);
  const [notasRuleEdit, setNotasRuleEdit] = useState('');
  const [editingRuleNotas, setEditingRuleNotas] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setEditingLineId(null);
    try {
      const data = await fetchFiscalRuleWithLines(id);
      setRule(data);
      const sorted = [...data.lines].sort((a, b) => a.orden_visual - b.orden_visual);
      setLines(sorted.map(l => ({ ...l, dirty: false })));
      setNotasRuleEdit(data.notas ?? '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar la regla fiscal');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  function updateLineLocal(lineId: string, patch: Partial<LineEdit>) {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, ...patch, dirty: true } : l
    ));
  }

  function startEditing(line: LineEdit) {
    setEditingLineId(line.id);
  }

  function cancelEditing() {
    setEditingLineId(null);
    load();
  }

  async function saveLine(lineId: string) {
    const line = lines.find(l => l.id === lineId);
    if (!line) return;
    setSaving(lineId);
    setError(null);
    try {
      await updateFiscalRuleLine(lineId, {
        base_codigo: line.base_codigo,
        tipo_regla: line.tipo_regla,
        valor_porcentaje: line.valor_porcentaje,
        formula_texto: line.formula_texto,
        signo_resultado: line.signo_resultado,
        mostrar_en_pdf: line.mostrar_en_pdf,
        mostrar_en_ui: line.mostrar_en_ui,
        activo: line.activo,
        notas: line.notas,
      });
      setLines(prev => prev.map(l => l.id === lineId ? { ...l, dirty: false } : l));
      setEditingLineId(null);
      showSuccess('Línea guardada correctamente');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar la línea');
    } finally {
      setSaving(null);
    }
  }

  async function saveRuleNotas() {
    if (!rule) return;
    setSaving('rule-notas');
    try {
      await updateFiscalRule(rule.id, { notas: notasRuleEdit || null });
      setRule(prev => prev ? { ...prev, notas: notasRuleEdit || null } : null);
      setEditingRuleNotas(false);
      showSuccess('Notas guardadas');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar notas');
    } finally {
      setSaving(null);
    }
  }

  async function handleActivate() {
    if (!rule) return;
    const validation = validarLineasRegimen(rule.regimen_codigo as RegimenCodigo, lines);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }
    setValidationErrors([]);
    setActivating(true);
    setError(null);
    try {
      await activateFiscalRule(rule.id);
      await load();
      showSuccess('Versión activada exitosamente');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al activar la versión');
    } finally {
      setActivating(false);
    }
  }

  function getPreviewResult() {
    if (!rule) return null;
    try {
      return ejecutarCalculoDinamico(
        { ...rule, lines: lines.map(l => ({ ...l })) },
        previewGravada,
        previewExenta
      );
    } catch {
      return null;
    }
  }

  function validateFormula(formula: string): boolean {
    try {
      const testVars: Record<string, number> = {};
      FORMULA_VARIABLES.forEach(v => { testVars[v] = 100; });
      evaluarFormula(formula, testVars);
      return true;
    } catch {
      return false;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="p-6 text-center text-neutral-500 dark:text-white/50">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
        <p>Regla fiscal no encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/comisiones/regimen-fiscal')}>
          Volver al listado
        </Button>
      </div>
    );
  }

  const badge = formatVersionBadge(rule.estado);
  const regimen = rule.regimen_codigo as RegimenCodigo;
  const dirtyCount = lines.filter(l => l.dirty).length;
  const preview = previewOpen ? getPreviewResult() : null;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 py-5">
        <PageHeader
          title={REGIMEN_LABELS[regimen] ?? rule.nombre_regimen}
          description={`Versión ${rule.version} \u00b7 Vigente desde ${rule.vigente_desde}${rule.vigente_hasta ? ` hasta ${rule.vigente_hasta}` : ' (sin fecha de vencimiento)'}`}
          icon={Scale}
          backTo="/comisiones/regimen-fiscal"
          backLabel="Volver"
          badge={
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
              {badge.label}
            </span>
          }
          actions={
            <>
              {rule.estado !== 'activo' && (
                <Button
                  onClick={handleActivate}
                  disabled={activating}
                  className="bg-accent text-white hover:bg-accent-hover font-semibold shadow"
                >
                  <Power className="h-4 w-4 mr-2" />
                  {activating ? 'Activando...' : 'Activar esta versión'}
                </Button>
              )}
              {rule.estado === 'activo' && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg px-3 py-2 text-sm border border-emerald-200 dark:border-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Versión en uso actualmente
                </div>
              )}
            </>
          }
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-700">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 text-emerald-700">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{successMsg}</p>
          </div>
        )}
        {validationErrors.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-700 font-semibold mb-2">
              <AlertTriangle className="h-4 w-4" />
              Errores de validación — corrige antes de activar
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-amber-700">
              {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {dirtyCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3 text-blue-700 text-sm">
            <Info className="h-4 w-4 flex-shrink-0" />
            {dirtyCount} línea{dirtyCount > 1 ? 's' : ''} con cambios sin guardar.
          </div>
        )}

        {/* Estado banner */}
        {rule.estado === 'activo' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="font-semibold text-sm">Versión activa en producción</p>
              <p className="text-xs text-emerald-600">
                Los cálculos de comisiones usan actualmente estas reglas. Los cambios afectarán cálculos futuros.
              </p>
            </div>
          </div>
        )}
        {rule.estado === 'borrador' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-700">
            <Clock className="h-5 w-5" />
            <div>
              <p className="font-semibold text-sm">Borrador — no afecta cálculos actuales</p>
              <p className="text-xs text-amber-600">
                Edita las líneas y luego activa esta versión cuando esté lista.
              </p>
            </div>
          </div>
        )}
        {rule.estado === 'inactivo' && (
          <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 flex items-center gap-3 text-neutral-600 dark:text-neutral-400">
            <XCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold text-sm">Versión inactiva</p>
              <p className="text-xs">Registro histórico. Puedes editarla y luego activarla.</p>
            </div>
          </div>
        )}

        {/* Rule notas */}
        <div className="bg-white rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Notas de la versión</h2>
            {!editingRuleNotas && (
              <button
                onClick={() => setEditingRuleNotas(true)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                Editar
              </button>
            )}
          </div>
          {editingRuleNotas ? (
            <div className="space-y-2">
              <textarea
                value={notasRuleEdit}
                onChange={e => setNotasRuleEdit(e.target.value)}
                rows={3}
                placeholder="Describe los cambios de esta versión..."
                className="w-full border border-neutral-300 dark:border-neutral-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveRuleNotas} disabled={saving === 'rule-notas'}>
                  {saving === 'rule-notas' ? 'Guardando...' : 'Guardar notas'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditingRuleNotas(false); setNotasRuleEdit(rule.notas ?? ''); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-white/50 italic">
              {rule.notas || 'Sin notas para esta versión.'}
            </p>
          )}
        </div>

        {/* Lines table */}
        <div className="bg-white rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-700">
            <h2 className="font-semibold text-neutral-800 dark:text-white flex items-center gap-2">
              <Calculator className="h-4 w-4 text-neutral-500 dark:text-white/50" />
              Líneas de cálculo
            </h2>
            <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5">
              Haz clic en <strong>Editar</strong> en cualquier fila para modificar sus valores. Las líneas tipo "Derivado" se obtienen automáticamente del lote.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide w-10">Ord.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide">Concepto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide w-36">Base</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide w-28">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide w-20">%</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide">Fórmula</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide w-12">Signo</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide w-12">PDF</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide w-12">UI</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide w-14">Activo</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {lines.map(line => {
                  const isEditing = editingLineId === line.id;
                  const signoInfo = SIGNO_LABELS[line.signo_resultado] ?? SIGNO_LABELS.neutro;
                  const concepto = line.concepto_codigo;

                  return (
                    <tr
                      key={line.id}
                      className={`transition-colors ${
                        isEditing
                          ? 'bg-amber-50/80 ring-1 ring-inset ring-amber-300'
                          : line.dirty
                          ? 'bg-blue-50/30'
                          : !line.activo
                          ? 'opacity-50 bg-neutral-50 dark:bg-neutral-800/50'
                          : 'hover:bg-neutral-50 dark:bg-neutral-800'
                      }`}
                    >
                      {/* Orden */}
                      <td className="px-4 py-3 text-neutral-400 dark:text-neutral-500 text-xs font-mono">
                        {line.orden_visual}
                      </td>

                      {/* Concepto */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${
                            concepto === 'total_fiscal' || concepto === 'total_final'
                              ? 'text-neutral-900 dark:text-white font-semibold'
                              : 'text-neutral-700 dark:text-neutral-300'
                          }`}>
                            {CONCEPTO_LABELS[concepto] ?? concepto}
                          </span>
                          {line.dirty && (
                            <span className="text-xs text-blue-500 font-bold">*</span>
                          )}
                        </div>
                        {isEditing && (
                          <div className="mt-2">
                            <label className="text-xs text-neutral-500 dark:text-white/50 block mb-1">Notas:</label>
                            <input
                              type="text"
                              value={line.notas ?? ''}
                              onChange={e => updateLineLocal(line.id, { notas: e.target.value || null })}
                              placeholder="Comentario opcional..."
                              className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-amber-400 outline-none"
                            />
                          </div>
                        )}
                        {!isEditing && line.notas && (
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 italic truncate max-w-[200px]" title={line.notas}>
                            {line.notas}
                          </p>
                        )}
                      </td>

                      {/* Base */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={line.base_codigo}
                            onChange={e => updateLineLocal(line.id, { base_codigo: e.target.value as BaseCodigo })}
                            disabled={line.tipo_regla === 'derivado'}
                            className="border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-400 outline-none bg-white w-full disabled:bg-neutral-100 dark:bg-neutral-700 disabled:text-neutral-400 dark:text-neutral-500"
                          >
                            {(Object.entries(BASE_LABELS) as [BaseCodigo, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-neutral-600 dark:text-neutral-400 text-xs">
                            {BASE_LABELS[line.base_codigo] ?? line.base_codigo}
                          </span>
                        )}
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={line.tipo_regla}
                            onChange={e => updateLineLocal(line.id, {
                              tipo_regla: e.target.value as TipoRegla,
                              valor_porcentaje: null,
                              formula_texto: null,
                            })}
                            className="border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-400 outline-none bg-white w-full"
                          >
                            {(Object.entries(TIPO_REGLA_LABELS) as [TipoRegla, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            line.tipo_regla === 'formula' ? 'bg-violet-100 text-violet-700' :
                            line.tipo_regla === 'porcentaje' ? 'bg-blue-100 text-blue-700' :
                            line.tipo_regla === 'derivado' ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {TIPO_REGLA_LABELS[line.tipo_regla]}
                          </span>
                        )}
                      </td>

                      {/* % */}
                      <td className="px-4 py-3 text-right">
                        {isEditing && line.tipo_regla === 'porcentaje' ? (
                          <input
                            type="number"
                            step="0.001"
                            value={line.valor_porcentaje !== null && line.valor_porcentaje !== undefined ? numVal(line.valor_porcentaje) : ''}
                            onChange={e => updateLineLocal(line.id, {
                              valor_porcentaje: e.target.value !== '' ? parseFloat(e.target.value) : null
                            })}
                            className="border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-xs w-20 text-right focus:ring-1 focus:ring-amber-400 outline-none"
                          />
                        ) : (
                          <span className="text-neutral-700 dark:text-neutral-300 font-mono text-xs">
                            {line.tipo_regla === 'porcentaje' && line.valor_porcentaje !== null && line.valor_porcentaje !== undefined
                              ? `${numVal(line.valor_porcentaje)}%`
                              : '—'}
                          </span>
                        )}
                      </td>

                      {/* Formula */}
                      <td className="px-4 py-3">
                        {isEditing && line.tipo_regla === 'formula' ? (
                          <div>
                            <input
                              type="text"
                              value={line.formula_texto ?? ''}
                              onChange={e => updateLineLocal(line.id, { formula_texto: e.target.value || null })}
                              placeholder="ej: comision_gravada + iva - ret_isr"
                              className={`border rounded px-2 py-1 text-xs w-64 focus:ring-1 outline-none font-mono ${
                                line.formula_texto && !validateFormula(line.formula_texto)
                                  ? 'border-red-300 focus:ring-red-400 bg-red-50'
                                  : 'border-neutral-300 dark:border-neutral-600 focus:ring-amber-400'
                              }`}
                            />
                            {line.formula_texto && !validateFormula(line.formula_texto) && (
                              <p className="text-xs text-red-500 mt-0.5">Fórmula inválida</p>
                            )}
                          </div>
                        ) : (
                          <span className={`font-mono text-xs ${line.formula_texto ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-300 dark:text-neutral-600'}`}>
                            {line.formula_texto || (line.tipo_regla === 'formula' ? <span className="text-amber-500 italic">sin fórmula</span> : '—')}
                          </span>
                        )}
                      </td>

                      {/* Signo */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <select
                            value={line.signo_resultado}
                            onChange={e => updateLineLocal(line.id, { signo_resultado: e.target.value as SignoResultado })}
                            className="border border-neutral-300 dark:border-neutral-600 rounded px-1 py-1.5 text-xs focus:ring-1 focus:ring-amber-400 outline-none bg-white"
                          >
                            <option value="positivo">+ Positivo</option>
                            <option value="negativo">- Negativo</option>
                            <option value="neutro">= Neutro</option>
                          </select>
                        ) : (
                          <span className={`font-bold text-base ${signoInfo.color}`}>
                            {signoInfo.label}
                          </span>
                        )}
                      </td>

                      {/* PDF */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={line.mostrar_en_pdf}
                            onChange={e => updateLineLocal(line.id, { mostrar_en_pdf: e.target.checked })}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        ) : (
                          line.mostrar_en_pdf
                            ? <FileText className="h-4 w-4 text-emerald-500 mx-auto" />
                            : <span className="text-neutral-300 dark:text-neutral-600 text-xs">—</span>
                        )}
                      </td>

                      {/* UI */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={line.mostrar_en_ui}
                            onChange={e => updateLineLocal(line.id, { mostrar_en_ui: e.target.checked })}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        ) : (
                          line.mostrar_en_ui
                            ? <Eye className="h-4 w-4 text-blue-500 mx-auto" />
                            : <EyeOff className="h-4 w-4 text-neutral-300 dark:text-neutral-600 mx-auto" />
                        )}
                      </td>

                      {/* Activo */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={line.activo}
                            onChange={e => updateLineLocal(line.id, { activo: e.target.checked })}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                        ) : (
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${line.activo ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <button
                              onClick={() => saveLine(line.id)}
                              disabled={saving === line.id}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              <Save className="h-3 w-3" />
                              {saving === line.id ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:text-neutral-300 rounded-lg px-2 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:border-neutral-600 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(line)}
                            className="text-blue-600 hover:text-blue-800 rounded-lg px-3 py-1.5 text-xs font-medium border border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center gap-1.5 mx-auto"
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Formula variables reference */}
        <div className="bg-white rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm p-5">
          <h2 className="font-semibold text-neutral-700 dark:text-neutral-300 text-sm mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
            Variables disponibles en fórmulas
          </h2>
          <div className="flex flex-wrap gap-2">
            {FORMULA_VARIABLES.map(v => (
              <code key={v} className="bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 rounded-md px-2.5 py-1 text-xs font-mono text-neutral-700 dark:text-neutral-300">
                {v}
              </code>
            ))}
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-3">
            Las variables se calculan en orden visual. Una variable calculada en la línea N puede usarse en fórmulas de líneas posteriores.
          </p>
        </div>

        {/* Preview calculator */}
        <div className="bg-white rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
          <button
            onClick={() => setPreviewOpen(o => !o)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-neutral-50 dark:bg-neutral-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-neutral-500 dark:text-white/50" />
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 text-sm">Simulador de cálculo</span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500">— prueba las reglas con montos de ejemplo</span>
            </div>
            {previewOpen ? <ChevronUp className="h-4 w-4 text-neutral-400 dark:text-neutral-500" /> : <ChevronDown className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />}
          </button>

          {previewOpen && (
            <div className="border-t border-neutral-100 dark:border-neutral-700 p-5">
              <div className="flex items-end gap-4 mb-5">
                <div>
                  <label className="text-xs text-neutral-500 dark:text-white/50 font-medium block mb-1">Comisión Gravada (NO VIDA)</label>
                  <input
                    type="number"
                    value={previewGravada}
                    onChange={e => setPreviewGravada(parseFloat(e.target.value) || 0)}
                    className="border border-neutral-300 dark:border-neutral-600 rounded-lg px-3 py-2 text-sm w-40 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 dark:text-white/50 font-medium block mb-1">Comisión Exenta (VIDA)</label>
                  <input
                    type="number"
                    value={previewExenta}
                    onChange={e => setPreviewExenta(parseFloat(e.target.value) || 0)}
                    className="border border-neutral-300 dark:border-neutral-600 rounded-lg px-3 py-2 text-sm w-40 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {preview ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {lines
                    .filter(l => l.mostrar_en_ui && l.activo)
                    .map(l => {
                      const v = (preview.lineResults as Record<string, number>)[l.concepto_codigo] ?? 0;
                      const isTotal = l.concepto_codigo === 'total_fiscal' || l.concepto_codigo === 'total_final';
                      return (
                        <div key={l.id} className={`rounded-lg border p-3 ${isTotal ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800'}`}>
                          <p className="text-xs text-neutral-500 dark:text-white/50 mb-0.5">{CONCEPTO_LABELS[l.concepto_codigo] ?? l.concepto_codigo}</p>
                          <p className={`font-mono font-semibold text-sm ${isTotal ? 'text-emerald-700' : 'text-neutral-800 dark:text-white'}`}>
                            ${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center text-neutral-400 dark:text-neutral-500 text-sm py-4">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-400" />
                  Error al calcular. Revisa las fórmulas de las líneas activas.
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
