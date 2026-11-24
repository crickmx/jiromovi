/**
 * Textos de ayuda para coberturas adicionales GMM BX+
 *
 * Estos textos se muestran en tooltips para ayudar al usuario
 * a entender cada cobertura antes de seleccionarla.
 */

export interface CoverageHelpText {
  key: string;
  label: string;
  description: string;
}

export const COVERAGE_HELP_TEXTS: Record<string, string> = {
  medicamentos_fuera: "Cubre el costo de medicamentos prescritos por el médico tratante y adquiridos fuera del hospital, siempre que estén relacionados con un padecimiento cubierto y se compren en territorio nacional.",

  complicaciones_no_amparadas: "Ampara gastos por emergencias médicas derivadas de complicaciones de tratamientos o cirugías originalmente no cubiertos por la póliza, bajo los límites y condiciones contratadas.",

  padecimientos_preexistentes: "Permite cubrir padecimientos preexistentes que hayan sido declarados y aceptados por la aseguradora al momento de la contratación, conforme a los términos autorizados en la póliza.",

  eliminacion_deducible_accidente: "Elimina el pago del deducible cuando los gastos médicos sean consecuencia directa de un accidente cubierto durante la vigencia de la póliza.",

  ampliacion_servicios: "Extiende beneficios y servicios médicos adicionales a los de la cobertura básica, de acuerdo con lo establecido en la carátula y condiciones de la póliza.",

  maternidad: "Otorga una suma asegurada adicional para gastos de parto o cesárea, siempre que se cumpla el periodo de espera y las condiciones establecidas en la póliza.",

  emergencia_medica_extranjero: "Cubre gastos médicos por emergencias ocurridas fuera de México durante viajes temporales, cuando la atención sea médicamente necesaria y de carácter urgente.",

  vip: "Brinda beneficios adicionales durante la hospitalización, como atención preferente y mejores condiciones de estancia, conforme a lo estipulado en la póliza.",

  enfermedades_graves_extranjero: "Ampara gastos médicos por el tratamiento de enfermedades graves diagnosticadas en el extranjero, bajo los límites y condiciones contratadas.",

  cobertura_internacional: "Extiende la cobertura médica fuera del territorio nacional, permitiendo atención médica programada o derivada de padecimientos cubiertos en el extranjero.",

  multiregion: "Permite recibir atención médica en diferentes regiones o zonas geográficas con costos médicos más altos, aplicando la carga correspondiente definida en la póliza.",

  ayuda_diaria: "Otorga una indemnización diaria en efectivo por cada día de hospitalización del asegurado, hasta el límite contratado.",

  indemnizacion_eg: "Proporciona una suma asegurada en efectivo al diagnosticarse alguna de las enfermedades graves cubiertas, independientemente de otros gastos médicos.",

  reconocimiento_antiguedad: "Reconoce la antigüedad de pólizas anteriores de gastos médicos mayores para reducir o eliminar periodos de espera en ciertos padecimientos, conforme a las condiciones aplicables.",

  xtensuz: "Cobertura adicional Xtensuz según condiciones del producto."
};

export const COVERAGE_LABELS: Record<string, string> = {
  medicamentos_fuera: "Medicamentos fuera del hospital",
  complicaciones_no_amparadas: "Complicaciones no amparadas",
  padecimientos_preexistentes: "Padecimientos preexistentes",
  eliminacion_deducible_accidente: "Eliminación deducible por accidente",
  ampliacion_servicios: "Ampliación de servicios",
  maternidad: "Maternidad",
  emergencia_medica_extranjero: "Emergencia médica en el extranjero",
  vip: "Beneficio VIP",
  enfermedades_graves_extranjero: "Enfermedades graves en el extranjero",
  cobertura_internacional: "Cobertura internacional",
  multiregion: "Multiregión",
  ayuda_diaria: "Ayuda diaria por hospitalización",
  indemnizacion_eg: "Indemnización por enfermedades graves",
  reconocimiento_antiguedad: "Reconocimiento de antigüedad",
  xtensuz: "Xtensuz"
};

/**
 * Obtiene el texto de ayuda para una cobertura
 * Si no existe, devuelve un texto genérico
 */
export function getCoverageHelpText(coverageKey: string): string {
  return COVERAGE_HELP_TEXTS[coverageKey] || "Cobertura adicional conforme a condiciones de la póliza.";
}

/**
 * Obtiene la etiqueta de una cobertura
 */
export function getCoverageLabel(coverageKey: string): string {
  return COVERAGE_LABELS[coverageKey] || coverageKey;
}

/**
 * Textos para PDF (versión resumida de 1-2 líneas)
 */
export const COVERAGE_PDF_TEXTS: Record<string, string> = {
  medicamentos_fuera: "Cubre el costo de medicamentos prescritos por el médico tratante y adquiridos fuera del hospital, siempre que estén relacionados con un padecimiento cubierto y se compren en territorio nacional.",

  complicaciones_no_amparadas: "Ampara gastos por emergencias médicas derivadas de complicaciones de tratamientos o cirugías originalmente no cubiertos por la póliza.",

  padecimientos_preexistentes: "Permite cubrir padecimientos preexistentes declarados y aceptados por la aseguradora conforme a la póliza.",

  eliminacion_deducible_accidente: "Elimina el pago del deducible cuando los gastos médicos sean consecuencia directa de un accidente cubierto.",

  ampliacion_servicios: "Extiende beneficios y servicios médicos adicionales a los de la cobertura básica.",

  maternidad: "Otorga una suma asegurada adicional para gastos de parto o cesárea, conforme a las condiciones contratadas.",

  emergencia_medica_extranjero: "Cubre gastos médicos por emergencias ocurridas fuera de México durante viajes temporales.",

  vip: "Brinda beneficios adicionales durante la hospitalización, conforme a lo estipulado en la póliza.",

  enfermedades_graves_extranjero: "Ampara gastos médicos por tratamiento de enfermedades graves en el extranjero.",

  cobertura_internacional: "Extiende la cobertura médica fuera del territorio nacional.",

  multiregion: "Permite atención médica en diferentes regiones con costos médicos más altos.",

  ayuda_diaria: "Otorga una indemnización diaria por cada día de hospitalización.",

  indemnizacion_eg: "Proporciona una suma asegurada al diagnosticarse una enfermedad grave cubierta.",

  reconocimiento_antiguedad: "Reconoce la antigüedad de pólizas anteriores para reducir periodos de espera.",

  xtensuz: "Cobertura adicional Xtensuz."
};

export function getCoveragePDFText(coverageKey: string): string {
  return COVERAGE_PDF_TEXTS[coverageKey] || "Cobertura adicional conforme a condiciones de la póliza.";
}
