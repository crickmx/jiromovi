import type { HospitalLevel } from './gmmCoverages';

export type InsurerId = 'gnp' | 'axa' | 'bupa' | 'metlife' | 'mapfre' | 'bxplus';

export interface GmmHospital {
  id: string;
  nombre: string;
  estado: string;
  ciudad: string;
  niveles: Partial<Record<InsurerId, number>>;
}

export const LEVEL_RANK: Record<HospitalLevel, number> = {
  basico: 1,
  medio: 2,
  alto: 3,
  premium: 4,
};

export function numericToHospitalLevel(n: number): HospitalLevel {
  if (n <= 1) return 'basico';
  if (n === 2) return 'medio';
  if (n === 3) return 'alto';
  return 'premium';
}

export function getRequiredLevel(hospitals: GmmHospital[]): HospitalLevel | null {
  if (hospitals.length === 0) return null;
  let maxLevel = 0;
  for (const h of hospitals) {
    for (const val of Object.values(h.niveles)) {
      if (val && val > maxLevel) maxLevel = val;
    }
  }
  return numericToHospitalLevel(maxLevel);
}

export function getRequiredLevelForInsurer(hospitals: GmmHospital[], insurerId: InsurerId): number {
  let maxLevel = 0;
  for (const h of hospitals) {
    const level = h.niveles[insurerId];
    if (level && level > maxLevel) maxLevel = level;
  }
  return maxLevel;
}

export type HospitalCoverageStatus = 'cubierto' | 'no_cubierto' | 'requiere_nivel_superior' | 'verificar';

export function getHospitalCoverageStatus(
  hospital: GmmHospital,
  insurerId: InsurerId,
  insurerMaxLevel: number
): HospitalCoverageStatus {
  const requiredLevel = hospital.niveles[insurerId];
  if (requiredLevel === undefined) return 'verificar';
  if (requiredLevel === 0) return 'no_cubierto';
  if (requiredLevel <= insurerMaxLevel) return 'cubierto';
  return 'requiere_nivel_superior';
}

export const MEXICAN_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
  'CDMX', 'Chiapas', 'Chihuahua', 'Coahuila', 'Colima', 'Durango',
  'Estado de Mexico', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco',
  'Michoacan', 'Morelos', 'Nayarit', 'Nuevo Leon', 'Oaxaca', 'Puebla',
  'Queretaro', 'Quintana Roo', 'San Luis Potosi', 'Sinaloa', 'Sonora',
  'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatan', 'Zacatecas',
];

export const GMM_HOSPITALS: GmmHospital[] = [
  {
    id: 'abc_observatorio',
    nombre: 'Hospital ABC (Observatorio)',
    estado: 'CDMX',
    ciudad: 'Ciudad de Mexico',
    niveles: { gnp: 5, axa: 3, bupa: 5, metlife: 5, mapfre: 3, bxplus: 5 },
  },
  {
    id: 'abc_santa_fe',
    nombre: 'Hospital ABC (Santa Fe)',
    estado: 'CDMX',
    ciudad: 'Ciudad de Mexico',
    niveles: { gnp: 5, axa: 3, bupa: 5, metlife: 5, mapfre: 3, bxplus: 5 },
  },
  {
    id: 'angeles_pedregal',
    nombre: 'Hospital Angeles Pedregal',
    estado: 'CDMX',
    ciudad: 'Ciudad de Mexico',
    niveles: { gnp: 4, axa: 3, bupa: 4, metlife: 4, mapfre: 3, bxplus: 5 },
  },
  {
    id: 'angeles_lomas',
    nombre: 'Hospital Angeles Lomas',
    estado: 'Estado de Mexico',
    ciudad: 'Huixquilucan',
    niveles: { gnp: 4, axa: 3, bupa: 4, metlife: 4, mapfre: 3, bxplus: 5 },
  },
  {
    id: 'angeles_interlomas',
    nombre: 'Hospital Angeles Interlomas',
    estado: 'Estado de Mexico',
    ciudad: 'Huixquilucan',
    niveles: { gnp: 4, axa: 3, bupa: 3, metlife: 4, mapfre: 2, bxplus: 4 },
  },
  {
    id: 'angeles_mexico',
    nombre: 'Hospital Angeles Mexico',
    estado: 'CDMX',
    ciudad: 'Ciudad de Mexico',
    niveles: { gnp: 4, axa: 3, bupa: 4, metlife: 4, mapfre: 2, bxplus: 4 },
  },
  {
    id: 'medica_sur',
    nombre: 'Medica Sur',
    estado: 'CDMX',
    ciudad: 'Ciudad de Mexico',
    niveles: { gnp: 4, axa: 3, bupa: 4, metlife: 4, mapfre: 3, bxplus: 4 },
  },
  {
    id: 'star_medica_cdmx',
    nombre: 'Star Medica Centro',
    estado: 'CDMX',
    ciudad: 'Ciudad de Mexico',
    niveles: { gnp: 3, axa: 2, bupa: 3, metlife: 3, mapfre: 2, bxplus: 3 },
  },
  {
    id: 'hospital_espanol',
    nombre: 'Hospital Espanol',
    estado: 'CDMX',
    ciudad: 'Ciudad de Mexico',
    niveles: { gnp: 3, axa: 2, bupa: 3, metlife: 3, mapfre: 2, bxplus: 3 },
  },
  {
    id: 'angeles_queretaro',
    nombre: 'Hospital Angeles Queretaro',
    estado: 'Queretaro',
    ciudad: 'Queretaro',
    niveles: { gnp: 4, axa: 3, bupa: 3, metlife: 4, mapfre: 2, bxplus: 5 },
  },
  {
    id: 'san_jose_queretaro',
    nombre: 'Hospital San Jose (Queretaro)',
    estado: 'Queretaro',
    ciudad: 'Queretaro',
    niveles: { gnp: 3, axa: 2, bupa: 2, metlife: 3, mapfre: 2, bxplus: 3 },
  },
  {
    id: 'angeles_puebla',
    nombre: 'Hospital Angeles Puebla',
    estado: 'Puebla',
    ciudad: 'Puebla',
    niveles: { gnp: 4, axa: 3, bupa: 3, metlife: 4, mapfre: 2, bxplus: 4 },
  },
  {
    id: 'betania_puebla',
    nombre: 'Hospital Betania (Puebla)',
    estado: 'Puebla',
    ciudad: 'Puebla',
    niveles: { gnp: 3, axa: 2, bupa: 2, metlife: 3, mapfre: 2, bxplus: 3 },
  },
  {
    id: 'country_2000_gdl',
    nombre: 'Hospital Country 2000',
    estado: 'Jalisco',
    ciudad: 'Guadalajara',
    niveles: { gnp: 4, axa: 3, bupa: 4, metlife: 4, mapfre: 3, bxplus: 4 },
  },
  {
    id: 'angeles_gdl',
    nombre: 'Hospital Angeles Guadalajara',
    estado: 'Jalisco',
    ciudad: 'Guadalajara',
    niveles: { gnp: 4, axa: 3, bupa: 3, metlife: 4, mapfre: 2, bxplus: 4 },
  },
  {
    id: 'puerta_hierro_gdl',
    nombre: 'Hospital Puerta de Hierro',
    estado: 'Jalisco',
    ciudad: 'Guadalajara',
    niveles: { gnp: 3, axa: 2, bupa: 3, metlife: 3, mapfre: 2, bxplus: 3 },
  },
  {
    id: 'san_jose_tec_mty',
    nombre: 'Hospital San Jose TecSalud',
    estado: 'Nuevo Leon',
    ciudad: 'Monterrey',
    niveles: { gnp: 5, axa: 3, bupa: 5, metlife: 5, mapfre: 3, bxplus: 5 },
  },
  {
    id: 'zambrano_mty',
    nombre: 'Hospital Zambrano Hellion',
    estado: 'Nuevo Leon',
    ciudad: 'Monterrey',
    niveles: { gnp: 5, axa: 3, bupa: 5, metlife: 5, mapfre: 3, bxplus: 5 },
  },
  {
    id: 'angeles_monterrey',
    nombre: 'Hospital Angeles Valle Oriente',
    estado: 'Nuevo Leon',
    ciudad: 'Monterrey',
    niveles: { gnp: 4, axa: 3, bupa: 4, metlife: 4, mapfre: 2, bxplus: 5 },
  },
  {
    id: 'christus_muguerza_mty',
    nombre: 'Christus Muguerza Alta Especialidad',
    estado: 'Nuevo Leon',
    ciudad: 'Monterrey',
    niveles: { gnp: 4, axa: 3, bupa: 4, metlife: 4, mapfre: 2, bxplus: 4 },
  },
  {
    id: 'star_medica_mty',
    nombre: 'Star Medica Monterrey',
    estado: 'Nuevo Leon',
    ciudad: 'Monterrey',
    niveles: { gnp: 3, axa: 2, bupa: 3, metlife: 3, mapfre: 2, bxplus: 3 },
  },
  {
    id: 'angeles_leon',
    nombre: 'Hospital Angeles Leon',
    estado: 'Guanajuato',
    ciudad: 'Leon',
    niveles: { gnp: 4, axa: 3, bupa: 3, metlife: 4, mapfre: 2, bxplus: 4 },
  },
  {
    id: 'aranda_leon',
    nombre: 'Hospital Aranda de la Parra',
    estado: 'Guanajuato',
    ciudad: 'Leon',
    niveles: { gnp: 3, axa: 2, bupa: 2, metlife: 3, mapfre: 2, bxplus: 3 },
  },
  {
    id: 'angeles_cancun',
    nombre: 'Hospiten Cancun',
    estado: 'Quintana Roo',
    ciudad: 'Cancun',
    niveles: { gnp: 3, axa: 2, bupa: 3, metlife: 3, mapfre: 2, bxplus: 3 },
  },
  {
    id: 'galenia_cancun',
    nombre: 'Hospital Galenia',
    estado: 'Quintana Roo',
    ciudad: 'Cancun',
    niveles: { gnp: 3, axa: 2, bupa: 3, metlife: 3, mapfre: 2, bxplus: 3 },
  },
];

export const INSURER_LEVEL_NAMES: Record<InsurerId, Record<number, string>> = {
  gnp: { 1: 'Cuarzo', 2: 'Ambar', 3: 'Indigo', 4: 'Platino', 5: 'Premium' },
  axa: { 1: 'Basica', 2: 'Zafiro', 3: 'Esmeralda/Diamante', 4: 'Diamante', 5: 'Diamante Plus' },
  bupa: { 1: 'Red Basica', 2: 'Red Amplia', 3: 'Red Preferente', 4: 'Red Premium', 5: 'Red Elite' },
  metlife: { 1: 'Bronce', 2: 'Plata', 3: 'Oro', 4: 'Platino', 5: 'Diamante' },
  mapfre: { 1: 'Tipo D', 2: 'Tipo C', 3: 'Tipo B/A', 4: 'Tipo A+', 5: 'N/A' },
  bxplus: { 1: 'Red General', 2: 'Red General+', 3: 'Angeles Basico', 4: 'Angeles Superior', 5: 'Angeles Premium' },
};

export function getInsurerMaxNumericLevel(insurerId: InsurerId): number {
  switch (insurerId) {
    case 'gnp': return 5;
    case 'axa': return 3;
    case 'bupa': return 5;
    case 'metlife': return 5;
    case 'mapfre': return 3;
    case 'bxplus': return 5;
  }
}
