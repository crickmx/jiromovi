import { GMM_INSURERS, type GmmInsurer, type GmmCoverageStatus } from '../../data/insuranceDesigner/gmmInsurers';
import {
  type GmmHospital, type InsurerId, type HospitalCoverageStatus,
  getHospitalCoverageStatus, getInsurerMaxNumericLevel,
} from '../../data/insuranceDesigner/gmmHospitals';

export interface HospitalMatchDetail {
  hospital: GmmHospital;
  status: HospitalCoverageStatus;
  requiredLevel: number;
  insurerMaxLevel: number;
}

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
  hospitalDetails: HospitalMatchDetail[];
  hospitalScore: number;
}

const STATUS_WEIGHT: Record<GmmCoverageStatus, number> = {
  base: 1.0,
  plus: 0.85,
  optional: 0.6,
  addon: 0.4,
  no: 0,
};

export function calculateGmmMatch(
  selectedCoverageIds: string[],
  selectedHospitals: GmmHospital[] = []
): GmmMatchResult[] {
  if (selectedCoverageIds.length === 0 && selectedHospitals.length === 0) {
    return GMM_INSURERS.map(insurer => ({
      insurer,
      matchPercent: 0,
      coveredCount: 0,
      totalSelected: 0,
      bestPlan: insurer.plans[0]?.id || '',
      breakdown: [],
      hospitalDetails: [],
      hospitalScore: 100,
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

    const insurerId = insurer.id as InsurerId;
    const insurerMaxLevel = getInsurerMaxNumericLevel(insurerId);
    const hospitalDetails: HospitalMatchDetail[] = selectedHospitals.map(hospital => {
      const requiredLevel = hospital.niveles[insurerId] || 0;
      return {
        hospital,
        status: getHospitalCoverageStatus(hospital, insurerId, insurerMaxLevel),
        requiredLevel,
        insurerMaxLevel,
      };
    });

    let hospitalScore = 100;
    if (selectedHospitals.length > 0) {
      const covered = hospitalDetails.filter(d => d.status === 'cubierto').length;
      hospitalScore = Math.round((covered / selectedHospitals.length) * 100);
    }

    const maxPossible = selectedCoverageIds.length || 1;
    let coveragePercent = selectedCoverageIds.length > 0
      ? (weightedScore / maxPossible) * 100
      : 100;

    let matchPercent: number;
    if (selectedCoverageIds.length > 0 && selectedHospitals.length > 0) {
      matchPercent = Math.round(coveragePercent * 0.7 + hospitalScore * 0.3);
    } else if (selectedHospitals.length > 0) {
      matchPercent = hospitalScore;
    } else {
      matchPercent = Math.round(coveragePercent);
    }

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
      hospitalDetails,
      hospitalScore,
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

export function getHospitalStatusLabel(status: HospitalCoverageStatus): string {
  switch (status) {
    case 'cubierto': return 'Cubierto';
    case 'no_cubierto': return 'No cubierto';
    case 'requiere_nivel_superior': return 'Nivel superior';
    case 'verificar': return 'Verificar';
  }
}

export function getHospitalStatusColor(status: HospitalCoverageStatus): string {
  switch (status) {
    case 'cubierto': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20';
    case 'no_cubierto': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20';
    case 'requiere_nivel_superior': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20';
    case 'verificar': return 'text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
  }
}
