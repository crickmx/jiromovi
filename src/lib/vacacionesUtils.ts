export function calcularDiasLaborables(fechaInicio: string, fechaFin: string): number {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  inicio.setHours(0, 0, 0, 0);
  fin.setHours(0, 0, 0, 0);

  if (inicio > fin) {
    return 0;
  }

  let diasLaborables = 0;
  const fechaActual = new Date(inicio);

  while (fechaActual <= fin) {
    const diaSemana = fechaActual.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasLaborables++;
    }
    fechaActual.setDate(fechaActual.getDate() + 1);
  }

  return diasLaborables;
}

export function formatearFecha(fecha: string): string {
  const date = new Date(fecha);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getEstadoBadgeClass(estado: string): string {
  switch (estado) {
    case 'pendiente':
      return 'bg-yellow-100 text-yellow-800';
    case 'preaprobado':
      return 'bg-blue-100 text-blue-800';
    case 'aprobado':
      return 'bg-green-100 text-green-800';
    case 'rechazado':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

export function getEstadoLabel(estado: string): string {
  switch (estado) {
    case 'pendiente':
      return 'Pendiente';
    case 'preaprobado':
      return 'Preaprobado';
    case 'aprobado':
      return 'Aprobado';
    case 'rechazado':
      return 'No autorizado';
    default:
      return estado;
  }
}
