import type {
  BnpQuoteInput, BnpCalculationResult, BnpPersonResult, BnpPaymentBreakdown,
  QuotePerson, FormaPago, GenderType,
} from './types';
import { calculateQuoteV2, loadTariffTables } from '../gmmCalculationEngineV2';
import type { QuoteInput, TariffTables } from '../gmmTypes';

const ZONA_TO_ESTADO: Record<string, string> = {
  'Zona 1': 'CIUDAD DE MEXICO',
  'Zona 2': 'AGUASCALIENTES',
};

const DEFAULT_TABULADOR = 'PALADIO-60,000';

function findNearestInTable(table: any[], value: number): number {
  if (!table || table.length === 0) return value;
  const numericEntries = table
    .map(r => Number(r.col_0))
    .filter(n => !isNaN(n) && n > 0);
  if (numericEntries.length === 0) return value;
  return numericEntries.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

export function calculateBnp(
  input: BnpQuoteInput,
  people: QuotePerson[],
  tariffTablesRaw: any[],
  packageId: string
): BnpCalculationResult {
  try {
    const tables: TariffTables = loadTariffTables(tariffTablesRaw);

    const estado = ZONA_TO_ESTADO[input.region_zone] || 'CIUDAD DE MEXICO';
    const sumaAseguradaPesos = input.suma_asegurada * 1000000;
    const deduciblePesos = input.deducible * 1000;
    const coaseguroDecimal = input.coaseguro / 100;

    const saSnapped = findNearestInTable(tables.factor_suma_asegurada, sumaAseguradaPesos);
    const dedSnapped = findNearestInTable(tables.factor_deducible, deduciblePesos);
    const coasSnapped = findNearestInTable(tables.factor_coaseguro, coaseguroDecimal);

    const quoteInput: QuoteInput = {
      zona: '',
      estado,
      nivel_hospitalario: 'PLUS',
      tabulador: DEFAULT_TABULADOR,
      suma_asegurada: String(saSnapped),
      deducible: String(dedSnapped),
      coaseguro: String(coasSnapped),
      formas_pago: ['ANUAL', 'SEMESTRAL', 'TRIMESTRAL', 'MENSUAL'],
      insureds: people.map(p => ({
        nombre: p.name,
        sexo: p.gender === 'Masculino' ? 'Hombre' : 'Mujer',
        edad: p.age,
      })),
      coberturas: {
        maternidad: input.maternidad_titular || input.maternidad_conyuge,
      },
    };

    const result = calculateQuoteV2(quoteInput, tables);

    const peopleResults: BnpPersonResult[] = result.insureds.map((ins, i) => ({
      person_id: people[i]?.id || `p${i}`,
      person_name: ins.nombre,
      relation: people[i]?.relation || 'Titular',
      age: ins.edad,
      gender: (ins.sexo === 'Hombre' ? 'Masculino' : 'Femenino') as GenderType,
      lookup_key: `${estado}|SA${input.suma_asegurada}|D${input.deducible}|C${input.coaseguro}`,
      annual_premium: ins.prima_total,
    }));

    const primaAnualTotal = result.prima_neta_total;

    const totals: Record<FormaPago, BnpPaymentBreakdown> = {} as any;
    const paymentMap: Record<string, FormaPago> = {
      ANUAL: 'Anual',
      SEMESTRAL: 'Semestral',
      TRIMESTRAL: 'Trimestral',
      MENSUAL: 'Mensual',
    };

    for (const pp of result.payment_plans) {
      const fp = paymentMap[pp.forma_pago] || pp.forma_pago as FormaPago;
      totals[fp] = {
        forma_pago: fp,
        prima_neta: primaAnualTotal,
        asistencia_extranjero: 0,
        catastrofica_extranjero: 0,
        derecho_poliza: pp.gastos_expedicion,
        subtotal: pp.subtotal,
        iva: pp.iva,
        total: pp.total,
        primer_pago: pp.primer_recibo,
        pagos_subsecuentes: pp.recibos_subsecuentes,
        num_recibos: pp.num_recibos,
      };
    }

    return {
      product: 'BNP',
      people_results: peopleResults,
      prima_anual_total: primaAnualTotal,
      totals,
      tariff_package_id: packageId,
    };
  } catch (err: any) {
    return {
      product: 'BNP',
      people_results: [],
      prima_anual_total: 0,
      totals: {} as any,
      tariff_package_id: packageId,
      error: err.message || 'Error al calcular BNP',
    };
  }
}
