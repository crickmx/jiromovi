import { GMM_INSURERS, type GmmInsurer, type GmmCoverageStatus } from '../../data/insuranceDesigner/gmmInsurers';

export interface GmmMatchResult {
  insurer: GmmInsurer;
  matchPercent: number;
  coveredCount: number;
  totalSelected: number;
  bestPlan: string;
  breakdown: {
    coverageId: string;
    status: GmmCoverageStatus;
    plans: string[];
    note?: string;
  }[];
}

const STATUS_WEIGHT: Record<GmmCoverageStatus, number> = {
  base: 1.0,
  plus: 0.85,
  optional: 0.6,
  addon: 0.4,
  no: 0,
};

export function calculateGmmMatch(selectedCoverageIds: string[]): GmmMatchResult[] {
  if (selectedCoverageIds.length === 0) {
    return GMM_INSURERS.map(insurer => ({
      insurer,
      matchPercent: 0,
      coveredCount: 0,
      totalSelected: 0,
      bestPlan: insurer.plans[0]?.id || '',
      breakdown: [],
    }));
  }

  return GMM_INSURERS.map(insurer => {
    let weightedScore = 0;
    const breakdown: GmmMatchResult['breakdown'] = [];
    const planScores: Record<string, number> = {};

    for (const plan of insurer.plans) {
      planScores[plan.id] = 0;
    }

    for (const covId of selectedCoverageIds) {
      const covData = insurer.data[covId];
      if (covData && covData.s !== 'no') {
        weightedScore += STATUS_WEIGHT[covData.s];
        breakdown.push({
          coverageId: covId,
          status: covData.s,
          plans: covData.plans,
          note: covData.note,
        });
        for (const planId of covData.plans) {
          planScores[planId] = (planScores[planId] || 0) + 1;
        }
      } else {
        breakdown.push({
          coverageId: covId,
          status: 'no',
          plans: [],
        });
      }
    }

    const maxPossible = selectedCoverageIds.length;
    const matchPercent = Math.round((weightedScore / maxPossible) * 100);
    const coveredCount = breakdown.filter(b => b.status !== 'no').length;

    let bestPlan = insurer.plans[insurer.plans.length - 1]?.id || '';
    let bestPlanScore = 0;
    for (const [planId, score] of Object.entries(planScores)) {
      if (score > bestPlanScore) {
        bestPlanScore = score;
        bestPlan = planId;
      }
    }

    return {
      insurer,
      matchPercent,
      coveredCount,
      totalSelected: selectedCoverageIds.length,
      bestPlan,
      breakdown,
    };
  }).sort((a, b) => b.matchPercent - a.matchPercent);
}

export function getGmmStatusLabel(status: GmmCoverageStatus): string {
  switch (status) {
    case 'base': return 'Incluida';
    case 'plus': return 'Plan superior';
    case 'optional': return 'Opcional';
    case 'addon': return 'Endoso';
    case 'no': return 'No disponible';
  }
}

export function getGmmStatusColor(status: GmmCoverageStatus): string {
  switch (status) {
    case 'base': return 'text-emerald-600 bg-emerald-50';
    case 'plus': return 'text-blue-600 bg-blue-50';
    case 'optional': return 'text-amber-600 bg-amber-50';
    case 'addon': return 'text-orange-600 bg-orange-50';
    case 'no': return 'text-gray-400 bg-gray-50';
  }
}
