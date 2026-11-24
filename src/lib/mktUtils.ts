// Acceso por equipo a Marketing Admin.
//
// Era una copia literal de dos funciones de `storeUtils.ts` con el nombre de la
// tabla cambiado — y le faltaban las otras dos, no por decisión sino porque la
// copia se hizo a medias. Ahora delega en `equiposAcceso.ts`, compartido con
// Store, y queda con la misma superficie que él.

import {
  gruposConAcceso, tieneAccesoEquipo, esLiderDeEquipoConAcceso, miembrosConAcceso,
} from './equiposAcceso';

export const obtenerGruposConAccesoMkt = () => gruposConAcceso('mkt');
export const tieneAccesoEquipoMkt = (userId: string | null | undefined) => tieneAccesoEquipo('mkt', userId);
export const esLiderDeEquipoConAccesoMkt = (userId: string | null | undefined) => esLiderDeEquipoConAcceso('mkt', userId);
export const obtenerMiembrosConAccesoMkt = () => miembrosConAcceso('mkt');
