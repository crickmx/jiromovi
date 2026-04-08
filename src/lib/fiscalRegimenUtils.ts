import { supabase } from './supabase';
import type {
  FiscalRegimenRule,
  FiscalRegimenRuleLine,
  FiscalRegimenRuleWithLines,
  DynamicFiscalResult,
  RegimenCodigo,
  ConceptoCodigo,
  FORMULA_VARIABLES,
} from './fiscalRegimenTypes';
import { FORMULA_VARIABLES as VARS } from './fiscalRegimenTypes';

function roundMoney(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Evaluador seguro de fórmulas fiscales.
 * Solo permite operaciones aritméticas básicas sobre variables conocidas.
 */
export function evaluarFormula(
  formula: string,
  variables: Record<string, number>
): number {
  const allowed = [...VARS] as string[];

  let expr = formula.trim().toLowerCase();

  for (const variable of allowed) {
    const val = variables[variable] ?? 0;
    const regex = new RegExp(`\\b${variable}\\b`, 'g');
    expr = expr.replace(regex, String(val));
  }

  // Solo permitir: números, operadores aritméticos, paréntesis, espacios
  if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr)) {
    throw new Error(`Fórmula inválida: "${formula}" — contiene variables no reconocidas`);
  }

  try {
    // Evaluación segura: solo aritmética básica
    const result = Function(`"use strict"; return (${expr})`)();
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      return 0;
    }
    return result;
  } catch {
    throw new Error(`Error al evaluar fórmula: "${formula}"`);
  }
}

/**
 * Obtiene todas las versiones de reglas para todos los regímenes
 */
export async function fetchAllFiscalRules(): Promise<FiscalRegimenRule[]> {
  const { data, error } = await supabase
    .from('fiscal_regime_rules')
    .select('*')
    .order('regimen_codigo', { ascending: true })
    .order('vigente_desde', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Obtiene una regla con sus líneas
 */
export async function fetchFiscalRuleWithLines(
  ruleId: string
): Promise<FiscalRegimenRuleWithLines> {
  const { data: rule, error: ruleError } = await supabase
    .from('fiscal_regime_rules')
    .select('*')
    .eq('id', ruleId)
    .maybeSingle();

  if (ruleError) throw ruleError;
  if (!rule) throw new Error('Regla fiscal no encontrada');

  const { data: lines, error: linesError } = await supabase
    .from('fiscal_regime_rule_lines')
    .select('*')
    .eq('fiscal_regime_rule_id', ruleId)
    .order('orden_visual', { ascending: true });

  if (linesError) throw linesError;

  return { ...rule, lines: lines || [] };
}

/**
 * Obtiene la regla activa para un régimen en una fecha dada
 */
export async function fetchActiveRuleForRegimen(
  regimen: string,
  fecha: string = new Date().toISOString().split('T')[0]
): Promise<FiscalRegimenRuleWithLines | null> {
  const { data, error } = await supabase
    .rpc('get_active_fiscal_rule', {
      p_regimen: regimen.toLowerCase(),
      p_fecha: fecha,
    });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  return fetchFiscalRuleWithLines(data[0].rule_id);
}

/**
 * Activa una versión de regla (desactiva las demás del mismo régimen)
 */
export async function activateFiscalRule(ruleId: string): Promise<void> {
  const { error } = await supabase.rpc('activate_fiscal_rule', {
    p_rule_id: ruleId,
  });
  if (error) throw error;
}

/**
 * Duplica una versión de regla como borrador
 */
export async function duplicateFiscalRule(
  sourceId: string,
  newVersion: string
): Promise<string> {
  const { data, error } = await supabase.rpc('duplicate_fiscal_rule', {
    p_source_id: sourceId,
    p_new_version: newVersion,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Crea una nueva cabecera de regla
 */
export async function createFiscalRule(
  payload: Omit<FiscalRegimenRule, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>
): Promise<FiscalRegimenRule> {
  const { data, error } = await supabase
    .from('fiscal_regime_rules')
    .insert({ ...payload })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualiza una cabecera de regla
 */
export async function updateFiscalRule(
  ruleId: string,
  payload: Partial<FiscalRegimenRule>
): Promise<void> {
  const { error } = await supabase
    .from('fiscal_regime_rules')
    .update(payload)
    .eq('id', ruleId);

  if (error) throw error;
}

/**
 * Actualiza una línea de regla
 */
export async function updateFiscalRuleLine(
  lineId: string,
  payload: Partial<FiscalRegimenRuleLine>
): Promise<void> {
  const { error } = await supabase
    .from('fiscal_regime_rule_lines')
    .update(payload)
    .eq('id', lineId);

  if (error) throw error;
}

/**
 * Ejecuta el cálculo fiscal dinámico usando las reglas de BD.
 * Esta función reemplaza los valores hardcodeados del motor V3.
 */
export function ejecutarCalculoDinamico(
  rule: FiscalRegimenRuleWithLines,
  comisionGravada: number,
  comisionExenta: number
): DynamicFiscalResult {
  const comisionTotal = comisionGravada + comisionExenta;

  // Variables acumuladas — se calculan en orden visual
  const vars: Record<string, number> = {
    comision_gravada: comisionGravada,
    comision_exenta: comisionExenta,
    comision_total: comisionTotal,
    iva: 0,
    ret_isr: 0,
    ret_iva: 0,
    ret_contable: 0,
    costo_dispersion: 0,
    total_fiscal: 0,
    total_final: 0,
  };

  // Ordenar líneas activas por orden_visual
  const activeLines = rule.lines
    .filter(l => l.activo)
    .sort((a, b) => a.orden_visual - b.orden_visual);

  for (const line of activeLines) {
    let valor = 0;

    switch (line.tipo_regla) {
      case 'derivado':
        // Los derivados (comision_gravada, comision_exenta) ya están en vars
        valor = vars[line.concepto_codigo] ?? 0;
        break;

      case 'fijo':
        valor = roundMoney(line.valor_porcentaje ?? 0);
        break;

      case 'porcentaje': {
        const base = vars[line.base_codigo] ?? 0;
        const pct = (line.valor_porcentaje ?? 0) / 100;
        valor = roundMoney(base * pct);
        break;
      }

      case 'formula': {
        if (!line.formula_texto) break;
        valor = roundMoney(evaluarFormula(line.formula_texto, vars));
        break;
      }
    }

    vars[line.concepto_codigo] = valor;
  }

  const lineResults: Record<ConceptoCodigo, number> = {
    comision_gravada: vars.comision_gravada,
    comision_exenta: vars.comision_exenta,
    comision_total: vars.comision_total,
    iva: vars.iva,
    ret_isr: vars.ret_isr,
    ret_iva: vars.ret_iva,
    ret_contable: vars.ret_contable,
    costo_dispersion: vars.costo_dispersion,
    total_fiscal: vars.total_fiscal,
    total_final: vars.total_final,
  };

  return {
    regimenCodigo: rule.regimen_codigo as RegimenCodigo,
    ruleId: rule.id,
    ruleVersion: rule.version,
    comisionGravada,
    comisionExenta,
    comisionTotal,
    iva: vars.iva,
    retIsr: vars.ret_isr,
    retIva: vars.ret_iva,
    retContable: vars.ret_contable,
    costoDispersion: vars.costo_dispersion,
    totalFiscal: vars.total_fiscal,
    totalFinal: vars.total_final,
    lineResults,
  };
}

/**
 * Valida que las líneas de una versión cumplen las reglas mínimas por régimen.
 */
export function validarLineasRegimen(
  regimen: RegimenCodigo,
  lines: FiscalRegimenRuleLine[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const activeConceptos = new Set(lines.filter(l => l.activo).map(l => l.concepto_codigo));

  const requeridos: Record<RegimenCodigo, ConceptoCodigo[]> = {
    honorarios: ['iva', 'ret_isr', 'ret_iva', 'total_fiscal'],
    resico: ['iva', 'ret_isr', 'ret_iva', 'total_fiscal'],
    asimilados: ['ret_isr', 'total_fiscal'],
  };

  for (const req of requeridos[regimen]) {
    if (!activeConceptos.has(req)) {
      errors.push(`Concepto obligatorio faltante: "${req}" para régimen ${regimen}`);
    }
  }

  for (const line of lines) {
    if (!line.activo) continue;

    if (line.tipo_regla === 'porcentaje') {
      if (line.base_codigo === 'none') {
        errors.push(`Línea "${line.concepto_nombre}": tipo porcentaje requiere base de cálculo`);
      }
      if (line.valor_porcentaje === null || line.valor_porcentaje === undefined) {
        errors.push(`Línea "${line.concepto_nombre}": tipo porcentaje requiere valor`);
      }
    }

    if (line.tipo_regla === 'formula') {
      if (!line.formula_texto || line.formula_texto.trim() === '') {
        errors.push(`Línea "${line.concepto_nombre}": tipo fórmula requiere texto de fórmula`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function formatVersionBadge(estado: string): {
  label: string;
  color: string;
} {
  switch (estado) {
    case 'activo':
      return { label: 'VERSIÓN ACTIVA', color: 'bg-emerald-100 text-emerald-800 border border-emerald-200' };
    case 'borrador':
      return { label: 'BORRADOR', color: 'bg-amber-100 text-amber-800 border border-amber-200' };
    default:
      return { label: 'INACTIVA', color: 'bg-slate-100 text-slate-600 border border-slate-200' };
  }
}
