import { AUTO_INSURERS, type AutoInsurer, type CoverageStatus } from '../../data/insuranceDesigner/autoInsurers';

export interface AutoMatchResult {
  insurer: AutoInsurer;
  matchPercent: number;
  coveredCount: number;
  totalSelected: number;
  breakdown: {
    coverageId: string;
    status: CoverageStatus;
    packages: string[];
    note?: string;
  }[];
}

const STATUS_WEIGHT: Record<CoverageStatus, number> = {
  base: 1.0,
  plus: 0.85,
  optional: 0.6,
  addon: 0.4,
  no: 0,
};

export function calculateAutoMatch(selectedCoverageIds: string[]): AutoMatchResult[] {
  if (selectedCoverageIds.length === 0) {
    return AUTO_INSURERS.map(insurer => ({
      insurer,
      matchPercent: 0,
      coveredCount: 0,
      totalSelected: 0,
      breakdown: [],
    }));
  }

  return AUTO_INSURERS.map(insurer => {
    let weightedScore = 0;
    const breakdown: AutoMatchResult['breakdown'] = [];

    for (const covId of selectedCoverageIds) {
      const covData = insurer.data[covId];
      if (covData) {
        weightedScore += STATUS_WEIGHT[covData.s];
        breakdown.push({
          coverageId: covId,
          status: covData.s,
          packages: covData.p,
          note: covData.n,
        });
      } else {
        breakdown.push({
          coverageId: covId,
          status: 'no',
          packages: [],
        });
      }
    }

    const maxPossible = selectedCoverageIds.length;
    const matchPercent = Math.round((weightedScore / maxPossible) * 100);
    const coveredCount = breakdown.filter(b => b.status !== 'no').length;

    return {
      insurer,
      matchPercent,
      coveredCount,
      totalSelected: selectedCoverageIds.length,
      breakdown,
    };
  }).sort((a, b) => b.matchPercent - a.matchPercent);
}

export function getStatusLabel(status: CoverageStatus): string {
  switch (status) {
    case 'base': return 'Incluida';
    case 'plus': return 'En plan superior';
    case 'optional': return 'Opcional';
    case 'addon': return 'Endoso adicional';
    case 'no': return 'No disponible';
  }
}

export function getStatusColor(status: CoverageStatus): string {
  switch (status) {
    case 'base': return 'text-emerald-600 bg-emerald-50';
    case 'plus': return 'text-blue-600 bg-blue-50';
    case 'optional': return 'text-amber-600 bg-amber-50';
    case 'addon': return 'text-orange-600 bg-orange-50';
    case 'no': return 'text-gray-400 bg-gray-50';
  }
}
