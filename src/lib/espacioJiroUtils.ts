export type DisponibilidadSemanal = {
  lunes: { inicio: string; fin: string }[];
  martes: { inicio: string; fin: string }[];
  miercoles: { inicio: string; fin: string }[];
  jueves: { inicio: string; fin: string }[];
  viernes: { inicio: string; fin: string }[];
  sabado: { inicio: string; fin: string }[];
  domingo: { inicio: string; fin: string }[];
};

export const DIAS_SEMANA = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

export const DIAS_SEMANA_LABELS: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

export function getDiaSemana(fecha: string): keyof DisponibilidadSemanal {
  const date = new Date(fecha + 'T00:00:00');
  const dia = date.getDay();
  const dias: (keyof DisponibilidadSemanal)[] = [
    'domingo',
    'lunes',
    'martes',
    'miercoles',
    'jueves',
    'viernes',
    'sabado',
  ];
  return dias[dia];
}

export function validarHorario(
  horaInicio: string,
  horaFin: string,
  fecha: string,
  disponibilidad: DisponibilidadSemanal
): { valido: boolean; mensaje?: string } {
  const dia = getDiaSemana(fecha);
  const franjas = disponibilidad[dia] || [];

  if (franjas.length === 0) {
    return { valido: false, mensaje: 'El área no está disponible este día' };
  }

  const inicio = horaInicio;
  const fin = horaFin;

  const dentroDeAlgunaFranja = franjas.some((franja) => {
    return inicio >= franja.inicio && fin <= franja.fin;
  });

  if (!dentroDeAlgunaFranja) {
    return {
      valido: false,
      mensaje: 'El horario solicitado no está dentro de la disponibilidad del área',
    };
  }

  return { valido: true };
}

export function horariosSeSuperponen(
  inicio1: string,
  fin1: string,
  inicio2: string,
  fin2: string
): boolean {
  return inicio1 < fin2 && inicio2 < fin1;
}

export function formatearHora(hora: string): string {
  const [h, m] = hora.split(':');
  return `${h}:${m}`;
}

export function getEstadoReservaBadgeClass(estado: string): string {
  switch (estado) {
    case 'pendiente':
      return 'bg-yellow-100 text-yellow-800';
    case 'aprobada':
      return 'bg-green-100 text-green-800';
    case 'rechazada':
      return 'bg-red-100 text-red-800';
    case 'cancelada':
      return 'bg-slate-100 text-slate-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

export function getEstadoReservaLabel(estado: string): string {
  switch (estado) {
    case 'pendiente':
      return 'Pendiente';
    case 'aprobada':
      return 'Aprobada';
    case 'rechazada':
      return 'Rechazada';
    case 'cancelada':
      return 'Cancelada';
    default:
      return estado;
  }
}

export const DISPONIBILIDAD_DEFAULT: DisponibilidadSemanal = {
  lunes: [],
  martes: [],
  miercoles: [],
  jueves: [],
  viernes: [],
  sabado: [],
  domingo: [],
};
