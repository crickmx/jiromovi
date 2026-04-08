import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Power, AlertTriangle, CheckCircle2,
  Clock, XCircle, Info, ChevronDown, ChevronUp,
  Eye, EyeOff, FileText, Calculator,
} from 'lucide-react';
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
import { useAuth } from '../contexts/AuthContext';

const CONCEPTO_ORDER: ConceptoCodigo[] = [
  'comision_gravada',
  'comision_exenta',
  'comision_total',
  'iva',
  'ret_isr',
  'ret_iva',
  'ret_contable',
  'costo_dispersion',
  'total_fiscal',
  'total_final',
];

const SIGNO_LABELS: Record<SignoResultado, { label: string; color: string }> = {
  positivo: { label: '+', color: 'text-emerald-600' },
  negativo: { label: '-', color: 'text-red-500' },
  neutro: { label: '=', color: 'text-slate-500' },
};

const REGIMEN_HEADER_COLORS: Record<RegimenCodigo, string> = {
  honorarios: 'from-blue-600 to-blue-700',
  resico: 'from-teal-600 to-teal-700',
  asimilados: 'from-orange-500 to-orange-600',
};

interface LineEdit extends FiscalRegimenRuleLine {
  dirty?: boolean;
}

export default function RegimenFiscalEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';

  const [rule, setRule] = useState<FiscalRegimenRuleWithLines | null>(null);
  const [lines, setLines] = useState<LineEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [notasEdit, setNotasEdit] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewGravada, setPreviewGravada] = useState(1000);
  const [previewExenta, setPreviewExenta] = useState(500);
  const [notasRuleEdit, setNotasRuleEdit] = useState('');
  const [editingRuleNotas, setEditingRuleNotas] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
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

  async function saveLine(lineId: string) {
    const line = lines.find(l => l.id === lineId);
    if (!line || !line.dirty) return;
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
      setEditingLine(null);
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
    const activeLines = lines.filter(l => l.activo);
    const validation = validarLineasRegimen(rule.regimen_codigo as RegimenCodigo, activeLines);
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
      <div className="p-6 text-center text-slate-500">
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
  const headerGrad = REGIMEN_HEADER_COLORS[regimen] ?? 'from-slate-600 to-slate-700';
  const dirtyCount = lines.filter(l => l.dirty).length;
  const preview = previewOpen ? getPreviewResult() : null;

  const activeLine = editingLine ? lines.find(l => l.id === editingLine) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className={`bg-gradient-to-r ${headerGrad} text-white shadow-lg`}>
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/comisiones/regimen-fiscal')}
              className="text-white/80 hover:text-white transition-colors flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">
                  {REGIMEN_LABELS[regimen] ?? rule.nombre_regimen}
                </h1>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-white/80 text-sm">
                Versión {rule.version} &middot; Vigente desde {rule.vigente_desde}
                {rule.vigente_hasta ? ` hasta ${rule.vigente_hasta}` : ' (sin fecha de vencimiento)'}
              </p>
            </div>
            {isAdmin && rule.estado !== 'activo' && (
              <Button
                onClick={handleActivate}
                disabled={activating}
                className="bg-white text-slate-800 hover:bg-slate-100 font-semibold shadow"
              >
                <Power className="h-4 w-4 mr-2" />
                {activating ? 'Activando...' : 'Activar esta versión'}
              </Button>
            )}
            {rule.estado === 'activo' && (
              <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Versión en uso actualmente
              </div>
            )}
          </div>
        </div>
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

        {/* Unsaved changes warning */}
        {dirtyCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3 text-blue-700 text-sm">
            <Info className="h-4 w-4 flex-shrink-0" />
            {dirtyCount} línea{dirtyCount > 1 ? 's' : ''} con cambios sin guardar.
            Usa el botón Guardar en cada fila para confirmar.
          </div>
        )}

        {/* Estado banner */}
        {rule.estado === 'activo' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="font-semibold text-sm">Versión activa en producción</p>
              <p className="text-xs text-emerald-600">
                Los cálculos de comisiones usan actualmente estas reglas. Los cambios aquí afectarán cálculos futuros.
              </p>
            </div>
          </div>
        )}
        {rule.estado === 'borrador' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-700">
            <Clock className="h-5 w-5" />
            <div>
              <p className="font-semibold text-sm">Borrador — no afecta calculos actuales</p>
              <p className="text-xs text-amber-600">
                Edita las líneas y luego activa esta version cuando este lista.
              </p>
            </div>
          </div>
        )}
        {rule.estado === 'inactivo' && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 text-slate-600">
            <XCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold text-sm">Version inactiva</p>
              <p className="text-xs">Registro historico. No se puede activar directamente una version inactiva.</p>
            </div>
          </div>
        )}

        {/* Rule notas */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700">Notas de la versión</h2>
            {isAdmin && !editingRuleNotas && (
              <button
                onClick={() => setEditingRuleNotas(true)}
                className="text-xs text-blue-600 hover:underline"
              >
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
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
            <p className="text-sm text-slate-500 italic">
              {rule.notas || 'Sin notas para esta versión.'}
            </p>
          )}
        </div>

        {/* Lines table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-slate-500" />
                Líneas de cálculo
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Las líneas se aplican en el orden indicado. Los conceptos marcados con {'"'}Derivado{'"'} se obtienen de los datos del lote.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">Ord.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Concepto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Base</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">%</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fórmula</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">Signo</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">PDF</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">UI</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">Activo</th>
                  {isAdmin && (
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {CONCEPTO_ORDER.map(concepto => {
                  const line = lines.find(l => l.concepto_codigo === concepto);
                  if (!line) return null;
                  const isEditing = editingLine === line.id;
                  const signoInfo = SIGNO_LABELS[line.signo_resultado];

                  return (
                    <tr
                      key={line.id}
                      className={`transition-colors ${line.dirty ? 'bg-blue-50/50' : ''} ${!line.activo ? 'opacity-50' : ''} ${isEditing ? 'bg-amber-50/60' : 'hover:bg-slate-50'}`}
                    >
                      {/* Orden */}
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                        {line.orden_visual}
                      </td>

                      {/* Concepto */}
                      <td className="px-4 py-3">
                        <span className={`font-medium ${
                          concepto === 'total_fiscal' || concepto === 'total_final'
                            ? 'text-slate-800 font-semibold'
                            : 'text-slate-700'
                        }`}>
                          {CONCEPTO_LABELS[concepto]}
                        </span>
                        {line.dirty && (
                          <span className="ml-2 text-xs text-blue-500 font-medium">*</span>
                        )}
                        {line.notas && !isEditing && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]" title={line.notas}>
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
                            className="border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                            disabled={line.tipo_regla === 'derivado' || !isAdmin}
                          >
                            {(Object.entries(BASE_LABELS) as [BaseCodigo, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-600 text-xs">
                            {BASE_LABELS[line.base_codigo] ?? line.base_codigo}
                          </span>
                        )}
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={line.tipo_regla}
                            onChange={e => updateLineLocal(line.id, { tipo_regla: e.target.value as TipoRegla })}
                            className="border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                            disabled={!isAdmin}
                          >
                            {(Object.entries(TIPO_REGLA_LABELS) as [TipoRegla, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            line.tipo_regla === 'formula' ? 'bg-violet-100 text-violet-700' :
                            line.tipo_regla === 'porcentaje' ? 'bg-blue-100 text-blue-700' :
                            line.tipo_regla === 'derivado' ? 'bg-slate-100 text-slate-600' :
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
                            value={line.valor_porcentaje ?? ''}
                            onChange={e => updateLineLocal(line.id, { valor_porcentaje: e.target.value ? parseFloat(e.target.value) : null })}
                            className="border border-slate-300 rounded px-2 py-1 text-xs w-20 text-right focus:ring-1 focus:ring-blue-500 outline-none"
                            disabled={!isAdmin}
                          />
                        ) : (
                          <span className="text-slate-700 font-mono text-xs">
                            {line.tipo_regla === 'porcentaje' && line.valor_porcentaje !== null
                              ? `${line.valor_porcentaje}%`
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
                              onChange={e => updateLineLocal(line.id, { formula_texto: e.target.value })}
                              placeholder="ej: comision_gravada + iva - ret_isr"
                              className={`border rounded px-2 py-1 text-xs w-64 focus:ring-1 outline-none font-mono ${
                                line.formula_texto && !validateFormula(line.formula_texto)
                                  ? 'border-red-300 focus:ring-red-400 bg-red-50'
                                  : 'border-slate-300 focus:ring-blue-500'
                              }`}
                              disabled={!isAdmin}
                            />
                            {line.formula_texto && !validateFormula(line.formula_texto) && (
                              <p className="text-xs text-red-500 mt-0.5">Fórmula inválida</p>
                            )}
                          </div>
                        ) : (
                          <span className={`font-mono text-xs ${line.formula_texto ? 'text-slate-700' : 'text-slate-300'}`}>
                            {line.formula_texto || '—'}
                          </span>
                        )}
                      </td>

                      {/* Signo */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <select
                            value={line.signo_resultado}
                            onChange={e => updateLineLocal(line.id, { signo_resultado: e.target.value as SignoResultado })}
                            className="border border-slate-300 rounded px-1 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                            disabled={!isAdmin}
                          >
                            <option value="positivo">+</option>
                            <option value="negativo">-</option>
                            <option value="neutro">=</option>
                          </select>
                        ) : (
                          <span className={`font-bold text-lg ${signoInfo.color}`}>
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
                            className="rounded"
                            disabled={!isAdmin}
                          />
                        ) : (
                          line.mostrar_en_pdf
                            ? <FileText className="h-4 w-4 text-emerald-500 mx-auto" />
                            : <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* UI */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={line.mostrar_en_ui}
                            onChange={e => updateLineLocal(line.id, { mostrar_en_ui: e.target.checked })}
                            className="rounded"
                            disabled={!isAdmin}
                          />
                        ) : (
                          line.mostrar_en_ui
                            ? <Eye className="h-4 w-4 text-blue-500 mx-auto" />
                            : <EyeOff className="h-4 w-4 text-slate-300 mx-auto" />
                        )}
                      </td>

                      {/* Activo */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={line.activo}
                            onChange={e => updateLineLocal(line.id, { activo: e.target.checked })}
                            className="rounded"
                            disabled={!isAdmin}
                          />
                        ) : (
                          <span className={`inline-block w-2 h-2 rounded-full ${line.activo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        )}
                      </td>

                      {/* Actions */}
                      {isAdmin && (
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-center">
                              <button
                                onClick={() => saveLine(line.id)}
                                disabled={saving === line.id}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2 py-1 text-xs font-medium flex items-center gap-1 transition-colors"
                              >
                                <Save className="h-3 w-3" />
                                {saving === line.id ? '...' : 'OK'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingLine(null);
                                  load();
                                }}
                                className="text-slate-500 hover:text-slate-700 rounded px-2 py-1 text-xs border border-slate-200 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingLine(line.id); setNotasEdit(line.notas ?? ''); }}
                              className="text-blue-600 hover:text-blue-700 rounded px-2 py-1 text-xs border border-blue-200 hover:border-blue-400 transition-colors"
                            >
                              Editar
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Notas inline edit for active line */}
          {editingLine && activeLine && isAdmin && (
            <div className="border-t border-amber-200 bg-amber-50/50 px-5 py-3">
              <label className="text-xs text-slate-600 font-medium mb-1 block">
                Notas para {CONCEPTO_LABELS[activeLine.concepto_codigo]}:
              </label>
              <input
                type="text"
                value={notasEdit}
                onChange={e => { setNotasEdit(e.target.value); updateLineLocal(editingLine, { notas: e.target.value || null }); }}
                placeholder="Descripción o comentario opcional..."
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          )}
        </div>

        {/* Formula variables reference */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-400" />
            Variables disponibles en fórmulas
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {FORMULA_VARIABLES.map(v => (
              <div key={v} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <code className="text-xs font-mono text-slate-700">{v}</code>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Las variables se procesan en orden visual. Una variable definida en la línea N puede ser usada en fórmulas de líneas posteriores.
          </p>
        </div>

        {/* Preview calculator */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setPreviewOpen(o => !o)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-slate-500" />
              <span className="font-semibold text-slate-700 text-sm">Simulador de cálculo</span>
              <span className="text-xs text-slate-400">— prueba las reglas con montos de ejemplo</span>
            </div>
            {previewOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>

          {previewOpen && (
            <div className="border-t border-slate-100 p-5">
              <div className="flex items-center gap-4 mb-5">
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Comisión Gravada (NO VIDA)</label>
                  <input
                    type="number"
                    value={previewGravada}
                    onChange={e => setPreviewGravada(parseFloat(e.target.value) || 0)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-36 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Comisión Exenta (VIDA)</label>
                  <input
                    type="number"
                    value={previewExenta}
                    onChange={e => setPreviewExenta(parseFloat(e.target.value) || 0)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-36 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {preview ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {(Object.entries(preview.lineResults) as [ConceptoCodigo, number][])
                    .filter(([k]) => lines.find(l => l.concepto_codigo === k)?.mostrar_en_ui)
                    .map(([k, v]) => {
                      const isTotal = k === 'total_fiscal' || k === 'total_final';
                      return (
                        <div key={k} className={`rounded-lg border p-3 ${isTotal ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                          <p className="text-xs text-slate-500 mb-0.5">{CONCEPTO_LABELS[k]}</p>
                          <p className={`font-mono font-semibold ${isTotal ? 'text-emerald-700' : 'text-slate-800'}`}>
                            ${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center text-slate-400 text-sm py-4">
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
