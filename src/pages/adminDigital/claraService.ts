import { supabase } from '@/lib/supabase';
import type { ClaraTransaction, VendorMapping } from './claraUtils';

// Cost Centers
export async function fetchCostCenters(): Promise<string[]> {
  const { data, error } = await supabase
    .from('clara_cost_centers')
    .select('name')
    .order('name');
  if (error) throw error;
  return (data ?? []).map((r) => r.name);
}

export async function addCostCenter(name: string): Promise<void> {
  const { error } = await supabase.from('clara_cost_centers').insert({ name });
  if (error) throw error;
}

export async function deleteCostCenter(name: string): Promise<void> {
  const { error } = await supabase.from('clara_cost_centers').delete().eq('name', name);
  if (error) throw error;
}

// Simple Concepts
export async function fetchSimpleConcepts(): Promise<string[]> {
  const { data, error } = await supabase
    .from('clara_simple_concepts')
    .select('name')
    .order('name');
  if (error) throw error;
  return (data ?? []).map((r) => r.name);
}

export async function addSimpleConcept(name: string): Promise<void> {
  const { error } = await supabase.from('clara_simple_concepts').insert({ name });
  if (error) throw error;
}

export async function deleteSimpleConcept(name: string): Promise<void> {
  const { error } = await supabase.from('clara_simple_concepts').delete().eq('name', name);
  if (error) throw error;
}

// Vendor Mappings
export async function fetchVendorMappings(): Promise<VendorMapping[]> {
  const { data, error } = await supabase.from('clara_vendor_mappings').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function upsertVendorMappings(transactions: ClaraTransaction[]): Promise<void> {
  const existing = await fetchVendorMappings();
  const existingMap = new Map(existing.map((m) => [m.normalized_vendor.toUpperCase(), m]));

  const toInsert: {
    normalized_vendor: string;
    cost_center: string;
    simple_concept: string;
    description: string;
    usage_count: number;
  }[] = [];
  const toUpdate: {
    normalized_vendor: string;
    cost_center: string;
    simple_concept: string;
    description: string;
    usage_count: number;
    updated_at: string;
  }[] = [];

  const seen = new Set<string>();
  for (const t of transactions) {
    const key = t.normalized_vendor.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const ex = existingMap.get(key);
    if (ex) {
      toUpdate.push({
        normalized_vendor: t.normalized_vendor,
        cost_center: t.cost_center,
        simple_concept: t.simple_concept,
        description: t.description,
        usage_count: (ex.usage_count || 0) + 1,
        updated_at: new Date().toISOString(),
      });
    } else {
      toInsert.push({
        normalized_vendor: t.normalized_vendor,
        cost_center: t.cost_center,
        simple_concept: t.simple_concept,
        description: t.description,
        usage_count: 1,
      });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('clara_vendor_mappings').insert(toInsert);
    if (error) throw error;
  }

  for (const upd of toUpdate) {
    const { error } = await supabase
      .from('clara_vendor_mappings')
      .update({
        cost_center: upd.cost_center,
        simple_concept: upd.simple_concept,
        description: upd.description,
        usage_count: upd.usage_count,
        updated_at: upd.updated_at,
      })
      .eq('normalized_vendor', upd.normalized_vendor);
    if (error) throw error;
  }
}

// Periods
export interface ClaraPeriod {
  id: string;
  period_key: string;
  label: string;
  date_from: string;
  date_to: string;
  file_name: string;
  transaction_count: number;
  total_amount_mxn: number;
  created_at: string;
}

export async function fetchPeriods(): Promise<ClaraPeriod[]> {
  const { data, error } = await supabase
    .from('clara_periods')
    .select('*')
    .order('date_from', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function derivePeriodKey(transactions: ClaraTransaction[]): {
  periodKey: string;
  label: string;
  dateFrom: string;
  dateTo: string;
} {
  const dates = transactions
    .map((t) => t.date.substring(0, 10))
    .filter(Boolean)
    .sort();
  if (dates.length === 0) {
    const now = new Date().toISOString().split('T')[0];
    const key = now.substring(0, 7);
    return { periodKey: key, label: key, dateFrom: now, dateTo: now };
  }
  const dateFrom = dates[0];
  const dateTo = dates[dates.length - 1];
  const fromMonth = dateFrom.substring(0, 7);
  const toMonth = dateTo.substring(0, 7);
  if (fromMonth === toMonth) {
    const [year, month] = fromMonth.split('-');
    const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString('es-MX', {
      month: 'long',
      year: 'numeric',
    });
    return {
      periodKey: fromMonth,
      label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      dateFrom,
      dateTo,
    };
  }
  const periodKey = `${fromMonth}_${toMonth}`;
  const label = `${fromMonth} al ${toMonth}`;
  return { periodKey, label, dateFrom, dateTo };
}

export async function fetchExistingDedupKeys(transactions: ClaraTransaction[]): Promise<Set<string>> {
  if (transactions.length === 0) return new Set();
  const authCodes = [...new Set(transactions.map((t) => t.auth_code).filter(Boolean))];
  if (authCodes.length === 0) return new Set();
  const { data } = await supabase
    .from('clara_transactions')
    .select('auth_code, transaction_date, amount_mxn, normalized_vendor')
    .in('auth_code', authCodes);
  const keys = new Set<string>();
  for (const row of data ?? []) {
    keys.add(`${row.auth_code}|${row.transaction_date}|${row.amount_mxn}|${row.normalized_vendor}`);
  }
  return keys;
}

function dedupKey(t: ClaraTransaction): string {
  return `${t.auth_code}|${t.date.substring(0, 10)}|${t.amount_mxn}|${t.normalized_vendor}`;
}

export async function saveTransactions(
  transactions: ClaraTransaction[],
  batchId: string,
  fileName: string
): Promise<{ saved: number; skipped: number; periodId: string }> {
  const { periodKey, label, dateFrom, dateTo } = derivePeriodKey(transactions);
  const totalAmount = transactions.reduce((s, t) => s + t.amount_mxn, 0);

  const { data: periodData, error: periodError } = await supabase
    .from('clara_periods')
    .upsert(
      {
        period_key: periodKey,
        label,
        date_from: dateFrom,
        date_to: dateTo,
        file_name: fileName,
        transaction_count: transactions.length,
        total_amount_mxn: totalAmount,
      },
      { onConflict: 'period_key' }
    )
    .select('id')
    .maybeSingle();

  if (periodError) throw periodError;

  let periodId = periodData?.id;
  if (!periodId) {
    const { data: existing, error: fetchErr } = await supabase
      .from('clara_periods')
      .select('id')
      .eq('period_key', periodKey)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    periodId = existing?.id;
  }
  if (!periodId) throw new Error('No se pudo crear o encontrar el periodo');

  const existingKeys = await fetchExistingDedupKeys(transactions);
  const newRows = transactions.filter((t) => !existingKeys.has(dedupKey(t)));
  const skipped = transactions.length - newRows.length;

  if (newRows.length > 0) {
    const rows = newRows.map((t) => ({
      transaction_date: t.date.substring(0, 10),
      original_vendor: t.original_vendor,
      normalized_vendor: t.normalized_vendor,
      amount_mxn: t.amount_mxn,
      cost_center: t.cost_center,
      simple_concept: t.simple_concept,
      description: t.description,
      card_alias: t.card_alias,
      auth_code: t.auth_code,
      match_type: t.match_type,
      batch_id: batchId,
      period_id: periodId,
    }));
    const { error } = await supabase
      .from('clara_transactions')
      .upsert(rows, { onConflict: 'auth_code,transaction_date,amount_mxn,normalized_vendor', ignoreDuplicates: true });
    if (error) throw error;
  }

  await supabase
    .from('clara_periods')
    .update({
      transaction_count: newRows.length,
      total_amount_mxn: newRows.reduce((s, t) => s + t.amount_mxn, 0),
    })
    .eq('id', periodId);

  return { saved: newRows.length, skipped, periodId };
}

// Update single transaction field
export async function updateTransaction(
  id: string,
  field: 'cost_center' | 'simple_concept' | 'description',
  value: string
): Promise<void> {
  const { error } = await supabase
    .from('clara_transactions')
    .update({ [field]: value })
    .eq('id', id);
  if (error) throw error;
}

// Transactions
export interface DBTransaction {
  id: string;
  transaction_date: string;
  original_vendor: string;
  normalized_vendor: string;
  amount_mxn: number;
  cost_center: string;
  simple_concept: string;
  description: string;
  card_alias: string;
  auth_code: string;
  match_type: string;
  batch_id: string;
  period_id: string | null;
  created_at: string;
}

export async function fetchTransactions(
  startDate?: string,
  endDate?: string,
  periodId?: string
): Promise<DBTransaction[]> {
  let query = supabase
    .from('clara_transactions')
    .select('*')
    .order('transaction_date', { ascending: false });

  if (periodId) {
    query = query.eq('period_id', periodId);
  } else {
    if (startDate) query = query.gte('transaction_date', startDate);
    if (endDate) query = query.lte('transaction_date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
