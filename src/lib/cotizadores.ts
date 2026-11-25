import { Car, Compass, Heart, HeartHandshake, type LucideIcon } from 'lucide-react';

export interface AseguradoraDelComparador {
  name: string;
  logo: string;
}

export interface CotizadorModule {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  /** Acento del producto para las viñetas de la lista. */
  bulletColor: string;
  /** Acento del producto que toma el zócalo al pasar el cursor. */
  zocaloHover: string;
  logo: string | null;
  /** Texto del pie de la tarjeta (por omisión «Abrir cotizador»). */
  cta?: string;
  /** Logos de las aseguradoras que trae el comparador (se muestran juntos). */
  logos?: string[];
  /** Aseguradoras que trae cargadas el comparador (los planes incluidos). */
  aseguradoras?: AseguradoraDelComparador[];
  /** Datos del módulo, en dos columnas con viñeta cuadrada. */
  bullets?: string[];
}

/**
 * Módulos de la sección Cotizar. Vive aquí (y no en la pantalla) porque lo usan
 * tanto el hub como la vista previa del diseño, y un archivo de página solo
 * puede exportar componentes.
 */
export const MODULES: CotizadorModule[] = [
  {
    path: '/cotizar/multicotizador-gmm',
    label: 'Multicotizador GMM',
    description: 'Compara Gastos Médicos Mayores en las tres aseguradoras cargadas, con las mismas coberturas y edad: cuál sale más barata, cómo queda el pago en cada forma (anual, semestral, trimestral, bimestral y mensual) y PDF con tu marca.',
    icon: Heart,
    iconColor: 'text-teal-600 dark:text-teal-400',
    bulletColor: 'bg-teal-600',
    zocaloHover: 'group-hover:bg-teal-600',
    logo: null,
    logos: ['/logo-bupa.png', '/logo-bx-transparente.png'],
    aseguradoras: [
      { name: 'Bupa Nacional Vital', logo: '/logo-bupa.png' },
      { name: 'Bupa Nacional Plus', logo: '/logo-bupa.png' },
      { name: 'BX+ Unikuz', logo: '/logo-bx-transparente.png' },
    ],
  },
  {
    path: '/cotizar/auna-oncologico',
    label: 'Auna Oncológico',
    description: 'Seguro oncológico Oncosalud Plus: tarifas por edad y sexo, cuestionario médico, extraprimas y PDF con tu marca.',
    icon: Heart,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    bulletColor: 'bg-cyan-600',
    zocaloHover: 'group-hover:bg-cyan-600',
    logo: '/logo-auna-transparente.png',
    bullets: ['Tarifas por edad y sexo', 'Cuestionario médico', 'Extrapimas', 'PDF con tu marca'],
  },
  {
    path: '/cotizar/a-la-medida',
    label: 'A la Medida',
    description: 'Diseñador inteligente de seguros. Selecciona coberturas y encuentra las aseguradoras con mejor compatibilidad.',
    icon: Compass,
    iconColor: 'text-amber-600 dark:text-amber-400',
    bulletColor: 'bg-amber-600',
    zocaloHover: 'group-hover:bg-amber-600',
    logo: null,
    bullets: ['Selección de coberturas', 'Aseguradoras compatibles'],
  },
  {
    path: '/cotizar/multicotizador',
    label: 'Multicotizador Digital',
    description: 'Compara cotizaciones de autos en múltiples aseguradoras de forma rápida y eficiente.',
    icon: Car,
    iconColor: 'text-rose-600 dark:text-rose-400',
    bulletColor: 'bg-rose-600',
    zocaloHover: 'group-hover:bg-rose-600',
    logo: null,
    bullets: ['Cotización de autos', 'Múltiples aseguradoras'],
  },
  // No es un comparador: es emisión de membresías. Va al final y con su propio CTA.
  // El candado de beta lo pone el item del menú (`soloBeta`) vía isItemVisible.
  {
    path: '/saludtoday',
    label: 'salud.today',
    description: 'Emite y activa membresías de salud: telemedicina 24/7, asistencias médicas, dental, visión y beneficios para individuos y empresas. Reporte SICAS para Administrador.',
    icon: HeartHandshake,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    bulletColor: 'bg-emerald-600',
    zocaloHover: 'group-hover:bg-emerald-600',
    logo: '/salud-today-logo.png',
    cta: 'Emitir membresía',
    bullets: ['Telemedicina 24/7', 'Asistencias médicas', 'Dental y visión', 'Reporte SICAS'],
  },
];
