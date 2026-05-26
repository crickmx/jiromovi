export type GmmCoverageCategory =
  | 'hospitalizacion'
  | 'ambulatorio'
  | 'maternidad'
  | 'dental'
  | 'internacional'
  | 'bienestar';

export interface GmmCoverage {
  id: string;
  name: string;
  category: GmmCoverageCategory;
  description: string;
}

export const GMM_CATEGORY_LABELS: Record<GmmCoverageCategory, { label: string; icon: string }> = {
  hospitalizacion: { label: 'Hospitalizacion y Cirugia', icon: 'Building2' },
  ambulatorio: { label: 'Atencion Ambulatoria', icon: 'Stethoscope' },
  maternidad: { label: 'Maternidad y Fertilidad', icon: 'Baby' },
  dental: { label: 'Dental y Vision', icon: 'Smile' },
  internacional: { label: 'Cobertura Internacional', icon: 'Globe' },
  bienestar: { label: 'Bienestar y Prevencion', icon: 'Heart' },
};

export const GMM_COVERAGES: GmmCoverage[] = [
  { id: 'tabulador_alto', name: 'Tabulador Alto / Hospitalario', category: 'hospitalizacion', description: 'Acceso a hospitales de primer nivel con cuarto estandar o superior' },
  { id: 'cirugia_ambulatoria', name: 'Cirugia Ambulatoria', category: 'hospitalizacion', description: 'Procedimientos quirurgicos que no requieren hospitalizacion' },
  { id: 'terapia_intensiva', name: 'Terapia Intensiva', category: 'hospitalizacion', description: 'Cuidados intensivos sin limite de dias (segun SA)' },
  { id: 'honorarios_medicos', name: 'Honorarios Medicos Quirurgicos', category: 'hospitalizacion', description: 'Cobertura de honorarios del cirujano, anestesiologo y equipo medico' },
  { id: 'emergencias', name: 'Urgencias / Emergencias', category: 'ambulatorio', description: 'Atencion en urgencias hospitalarias por accidente o enfermedad' },
  { id: 'consultas_medicas', name: 'Consultas Medicas', category: 'ambulatorio', description: 'Consultas con medicos generales y especialistas en red' },
  { id: 'estudios_diagnostico', name: 'Estudios y Diagnostico', category: 'ambulatorio', description: 'Laboratorios, rayos X, resonancias, tomografias y ultrasonidos' },
  { id: 'medicamentos_extra', name: 'Medicamentos Fuera de Hospital', category: 'ambulatorio', description: 'Cobertura de medicamentos ambulatorios con receta medica' },
  { id: 'rehabilitacion', name: 'Rehabilitacion Fisica', category: 'ambulatorio', description: 'Terapias fisicas post-cirugia o por padecimiento musculoesqueletico' },
  { id: 'maternidad_cob', name: 'Maternidad (Parto/Cesarea)', category: 'maternidad', description: 'Cobertura de parto normal o cesarea con periodo de espera' },
  { id: 'complicaciones_embarazo', name: 'Complicaciones del Embarazo', category: 'maternidad', description: 'Atencion a complicaciones medicas durante el embarazo' },
  { id: 'fertilidad', name: 'Tratamientos de Fertilidad', category: 'maternidad', description: 'Procedimientos de reproduccion asistida (FIV, inseminacion)' },
  { id: 'dental_basico', name: 'Dental Basico (Preventivo)', category: 'dental', description: 'Limpiezas, extracciones simples y consultas dentales preventivas' },
  { id: 'dental_mayor', name: 'Dental Mayor (Restaurativo)', category: 'dental', description: 'Endodoncias, coronas, puentes y tratamientos restaurativos' },
  { id: 'vision', name: 'Vision / Optometria', category: 'dental', description: 'Consultas oftalmologicas y apoyo para lentes graduados' },
  { id: 'cobertura_internacional', name: 'Cobertura Internacional', category: 'internacional', description: 'Atencion medica en el extranjero (EUA, Europa, mundial)' },
  { id: 'emergencia_viaje', name: 'Emergencias en Viaje', category: 'internacional', description: 'Atencion de urgencia medica durante viajes internacionales' },
  { id: 'segunda_opinion', name: 'Segunda Opinion Medica Internacional', category: 'internacional', description: 'Acceso a expertos internacionales para diagnosticos complejos' },
  { id: 'checkup_anual', name: 'Check-up Anual', category: 'bienestar', description: 'Evaluacion medica preventiva anual con estudios basicos incluidos' },
  { id: 'psicologia', name: 'Atencion Psicologica', category: 'bienestar', description: 'Consultas de salud mental y psicoterapia' },
  { id: 'nutricion', name: 'Nutricion y Bienestar', category: 'bienestar', description: 'Consultas con nutriologos y programas de bienestar integral' },
  { id: 'padecimientos_prex', name: 'Padecimientos Preexistentes', category: 'bienestar', description: 'Cobertura de condiciones previas despues del periodo de espera' },
];

export const DEFAULT_GMM_COVERAGES = [
  'tabulador_alto', 'cirugia_ambulatoria', 'terapia_intensiva',
  'honorarios_medicos', 'emergencias', 'consultas_medicas',
];

export type HospitalLevel = 'basico' | 'medio' | 'alto' | 'premium';

export const HOSPITAL_LEVELS: Record<HospitalLevel, { label: string; description: string }> = {
  basico: { label: 'Basico', description: 'Hospitales de segundo nivel' },
  medio: { label: 'Medio', description: 'Hospitales de nivel medio-alto' },
  alto: { label: 'Alto', description: 'Hospitales de primer nivel' },
  premium: { label: 'Premium', description: 'Hospitales top y centros de excelencia' },
};

export const SUM_ASSURED_OPTIONS = [
  { value: 5_000_000, label: '$5 MDP' },
  { value: 10_000_000, label: '$10 MDP' },
  { value: 15_000_000, label: '$15 MDP' },
  { value: 20_000_000, label: '$20 MDP' },
  { value: 30_000_000, label: '$30 MDP' },
  { value: 50_000_000, label: '$50 MDP' },
  { value: 100_000_000, label: '$100 MDP' },
];

export const DEDUCTIBLE_OPTIONS = [
  { value: 5_000, label: '$5,000' },
  { value: 10_000, label: '$10,000' },
  { value: 15_000, label: '$15,000' },
  { value: 20_000, label: '$20,000' },
  { value: 30_000, label: '$30,000' },
  { value: 50_000, label: '$50,000' },
];

export const COINSURANCE_OPTIONS = [
  { value: 0, label: '0%' },
  { value: 10, label: '10%' },
  { value: 20, label: '20%' },
  { value: 30, label: '30%' },
];
