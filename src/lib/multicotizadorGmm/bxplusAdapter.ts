import type {
  BxplusQuoteInput, BxplusCalculationResult, BxplusPaymentBreakdown,
  QuotePerson, FormaPago, GenderType,
} from './types';
import { DEFAULT_BXPLUS_COVERAGES } from './types';
import { calculateQuoteV2, loadTariffTables } from '../gmmCalculationEngineV2';
import type { QuoteInput, TariffTables } from '../gmmTypes';

export function calculateBxplus(
  input: BxplusQuoteInput,
  people: QuotePerson[],
  tariffTablesRaw: any[],
  packageId: string
): BxplusCalculationResult {
  try {
    const tables: TariffTables = loadTariffTables(tariffTablesRaw);

    const coberturas = { ...DEFAULT_BXPLUS_COVERAGES, ...input.coverages };

    const quoteInput: QuoteInput = {
      zona: '',
      estado: input.estado,
      nivel_hospitalario: input.nivel_hospitalario,
      tabulador: input.tabulador,
      suma_asegurada: input.suma_asegurada,
      deducible: input.deducible,
      coaseguro: input.coaseguro,
      tope_coaseguro_seleccionado: input.tope_coaseguro_seleccionado,
      formas_pago: ['ANUAL', 'SEMESTRAL', 'TRIMESTRAL', 'MENSUAL'],
      insureds: people.map(p => ({
        nombre: p.name,
        sexo: p.gender === 'Masculino' ? 'Hombre' : 'Mujer',
        edad: p.age,
      })),
      coberturas,
    };

    const result = calculateQuoteV2(quoteInput, tables);

    const peopleResults = result.insureds.map((ins, i) => ({
      person_id: people[i]?.id || `p${i}`,
      person_name: ins.nombre,
      age: ins.edad,
      gender: (ins.sexo === 'Hombre' ? 'Masculino' : 'Femenino') as GenderType,
      prima_base: ins.prima_base,
      prima_total: ins.prima_total,
    }));

    const primaAnualTotal = result.prima_neta_total;

    const totals: Record<FormaPago, BxplusPaymentBreakdown> = {} as any;
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
        recargo: pp.recargo,
        prima_neta: primaAnualTotal,
        gastos_expedicion: pp.gastos_expedicion,
        subtotal: pp.subtotal,
        iva: pp.iva,
        total: pp.total,
        primer_pago: pp.primer_recibo,
        pagos_subsecuentes: pp.recibos_subsecuentes,
        num_recibos: pp.num_recibos,
      };
    }

    return {
      product: 'BXPLUS',
      people_results: peopleResults,
      prima_anual_total: primaAnualTotal,
      totals,
      tariff_package_id: packageId,
    };
  } catch (err: any) {
    return {
      product: 'BXPLUS',
      people_results: [],
      prima_anual_total: 0,
      totals: {} as any,
      tariff_package_id: packageId,
      error: err.message || 'Error al calcular BX+',
    };
  }
}
