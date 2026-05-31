// Compatibility shim — delegates to MoviAuthContext.
// All MOVI code imports `useAuth` from here; this keeps existing imports working.
export type { Usuario } from './MoviAuthContext';
export { MoviAuthProvider as AuthProvider, useMoviAuth as useAuth } from './MoviAuthContext';
export { isMoviPlatform } from './platformFlags';
