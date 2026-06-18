export type CoverageCategory =
  | 'fundamental'
  | 'vehiculo'
  | 'perdida'
  | 'servicios'
  | 'personas'
  | 'especial'
  | 'adicional';

export interface AutoCoverage {
  id: string;
  name: string;
  category: CoverageCategory;
  description: string;
}

export const CATEGORY_LABELS: Record<CoverageCategory, { label: string; icon: string }> = {
  fundamental: { label: 'Coberturas Fundamentales', icon: 'Shield' },
  vehiculo: { label: 'Proteccion del Vehiculo', icon: 'Wrench' },
  perdida: { label: 'Perdida Total', icon: 'FileText' },
  servicios: { label: 'Servicios Adicionales', icon: 'Truck' },
  personas: { label: 'Proteccion a Personas', icon: 'User' },
  especial: { label: 'Coberturas Especiales', icon: 'Star' },
  adicional: { label: 'Coberturas Accesorias', icon: 'Plus' },
};

export const AUTO_COVERAGES: AutoCoverage[] = [
  { id: 'rc', name: 'Responsabilidad Civil (RC)', category: 'fundamental', description: 'Cubre danos a terceros en personas y bienes por accidente' },
  { id: 'gastos_medicos', name: 'Gastos Medicos a Ocupantes', category: 'fundamental', description: 'Gastos medicos del conductor y todos los pasajeros' },
  { id: 'asistencia_vial', name: 'Asistencia Vial', category: 'fundamental', description: 'Grua, paso de corriente, cambio de llanta, envio de gasolina' },
  { id: 'gastos_legales', name: 'Gastos Legales / Defensa Juridica', category: 'fundamental', description: 'Asesoria y representacion legal ante accidentes' },
  { id: 'danos_materiales', name: 'Danos Materiales', category: 'vehiculo', description: 'Reparaciones por colision, volcadura, fenomenos naturales, vandalismo' },
  { id: 'robo_total', name: 'Robo Total', category: 'vehiculo', description: 'Indemnizacion si el auto es robado en su totalidad' },
  { id: 'robo_parcial', name: 'Robo Parcial de Autopartes', category: 'vehiculo', description: 'Reposicion de autopartes originales robadas (incluye instalacion)' },
  { id: 'cristales', name: 'Danos a Cristales', category: 'vehiculo', description: 'Reparacion o reemplazo de parabrisas, ventanas, quemacocos' },
  { id: 'llantas_rines', name: 'Llantas y Rines', category: 'vehiculo', description: 'Reparacion o sustitucion por accidente, pinchadura o colision' },
  { id: 'equipo_especial', name: 'Equipo Especial / Accesorios', category: 'vehiculo', description: 'Cubre aditamentos y accesorios anadidos al vehiculo de fabrica (DM y RT)' },
  { id: 'adaptaciones', name: 'Adaptaciones y Conversiones', category: 'vehiculo', description: 'Modificaciones en carroceria, estructura o mecanismos para uso especifico' },
  { id: 'perdida_total_cob', name: 'Cobertura Perdida Total', category: 'perdida', description: 'Indemnizacion cuando el auto no es economicamente reparable' },
  { id: 'exencion_ded', name: 'Exencion / 0% Deducible en PT', category: 'perdida', description: 'No pagas deducible si el auto es declarado perdida total' },
  { id: 'devolucion_prima', name: 'Devolucion de Prima', category: 'perdida', description: 'Recuperas prima pagada en caso de perdida total' },
  { id: 'extra_indem', name: '+10% Extra en Indemnizacion PT', category: 'perdida', description: 'Recibes 10% adicional sobre el valor comercial en PT' },
  { id: 'sin_ded_dm', name: 'Sin Deducible en Danos Materiales', category: 'perdida', description: 'Elimina el deducible en siniestros de danos materiales (no solo PT)' },
  { id: 'auto_sustituto', name: 'Auto Sustituto', category: 'servicios', description: 'Vehiculo de reemplazo mientras tu auto esta en reparacion o por PT/RT' },
  { id: 'reparacion_agencia', name: 'Reparacion en Agencia', category: 'servicios', description: 'Reparacion en agencia oficial de la marca con refacciones originales' },
  { id: 'chofer_ebriedad', name: 'Chofer por Estado de Ebriedad', category: 'servicios', description: 'Conductor designado si el asegurado no puede manejar' },
  { id: 'gastos_trans_dm', name: 'Gastos de Transporte (por Reparacion)', category: 'servicios', description: 'Monto diario para transporte/renta mientras el auto esta en el taller' },
  { id: 'fallecimiento', name: 'Fallecimiento / Muerte Accidental', category: 'personas', description: 'Indemnizacion a beneficiarios en caso de muerte del conductor por accidente' },
  { id: 'perdidas_organicas', name: 'Perdidas Organicas al Conductor', category: 'personas', description: 'Indemnizacion por perdida de miembros o sentidos del conductor' },
  { id: 'accidentes_pers', name: 'Accidentes Personales del Conductor', category: 'personas', description: 'Cobertura ampliada de accidentes e invalidez permanente/parcial' },
  { id: 'rc_familiar', name: 'RC Familiar', category: 'personas', description: 'RC extendida que protege a conyuge e hijos menores mientras usan el auto' },
  { id: 'rc_ocupantes_cob', name: 'RC a Ocupantes del Vehiculo', category: 'personas', description: 'Responsabilidad civil por danos a los ocupantes del propio vehiculo' },
  { id: 'cirugia_estetica', name: 'Cirugia Estetica por Accidente', category: 'personas', description: 'Cubre cirugia estetica derivada de accidente vehicular' },
  { id: 'vida_conductor', name: 'Seguro de Vida del Conductor', category: 'personas', description: 'Seguro de vida individual para el titular de la poliza' },
  { id: 'rc_extranjero', name: 'RC en EUA / Canada', category: 'especial', description: 'Responsabilidad civil valida al cruzar a Estados Unidos y Canada' },
  { id: 'autogap', name: 'AutoGAP', category: 'especial', description: 'Cubre diferencia entre valor comercial y precio de factura (MAPFRE, hasta 5 anos)' },
  { id: 'zero_deducible', name: 'Zero / Sin Deducible en Robo Total', category: 'especial', description: 'Exencion total de deducible en robo total' },
  { id: 'rc_cruzada', name: 'RC Cruzada', category: 'especial', description: 'Cubre danos ocasionados con el auto asegurado a bienes propios del titular' },
  { id: 'devolucion_zpuz', name: 'Devolucion de Primas (Zero PluZ)', category: 'especial', description: 'Si no hay siniestros, recuperas las primas netas pagadas (Zurich Zero PluZ)' },
  { id: 'rc_exceso_fall', name: 'RC en Exceso por Fallecimiento 3ros', category: 'adicional', description: 'Cubre la indemnizacion legal completa si se causa la muerte de un tercero' },
  { id: 'extravio_llaves', name: 'Extravio / Robo de Llaves', category: 'adicional', description: 'Reposicion de llaves originales por extravio o robo' },
  { id: 'objetos_pers', name: 'Perdida de Objetos Personales', category: 'adicional', description: 'Cobertura de objetos dentro del vehiculo en caso de robo total' },
  { id: 'corralon_fianzas', name: 'Multas, Corralon y Fianzas', category: 'adicional', description: 'Cubre multas de transito y gastos de corralon derivados de siniestro' },
  { id: 'gm_menores', name: 'GM Ilimitados para Menores de 12 anos', category: 'adicional', description: 'Gastos medicos sin limite para menores de 12 anos en el vehiculo (Zurich)' },
  { id: 'proteccion_aux', name: 'Proteccion Auxiliar', category: 'adicional', description: 'Danos al interior + cristales por robo/intento + gastos medicos derivados (GNP)' },
  { id: 'grabado_partes', name: 'Grabado de Partes / Antirrobo', category: 'adicional', description: 'Grabado del numero de serie en vidrios y partes del vehiculo como disuasivo' },
  { id: 'arrastre_remolque', name: 'Arrastre de Remolque', category: 'adicional', description: 'Gastos por danos al vehiculo al ser remolcado o arrastrado por grua' },
];

export const DEFAULT_SELECTED_COVERAGES = ['rc', 'gastos_medicos', 'asistencia_vial', 'gastos_legales', 'danos_materiales', 'robo_total'];
