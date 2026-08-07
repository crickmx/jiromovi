// ============================================================================
// Capa de proveedores del módulo /alta — CONTRATO DESACOPLADO
// ----------------------------------------------------------------------------
// La UI y las edge functions dependen SOLO de estas interfaces, nunca de Cincel
// directamente. Para cambiar a Sumsub u otro proveedor: agregar una nueva
// implementación de estas interfaces y registrarla en getOnboardingProvider().
//
// Cincel fusiona identidad biométrica + firma en un mismo documento (firmante
// con identity_verification: true), por eso el proveedor de Cincel implementa
// AMBAS interfaces (OnboardingProvider). Un futuro proveedor podría separarlas.
// ============================================================================

export type ProviderMode = 'cincel' | 'mock';

export type VerificacionEstado =
  | 'no_iniciada' | 'pendiente' | 'en_proceso' | 'aprobada' | 'rechazada' | 'error';

export type FirmaEstado =
  | 'no_iniciada' | 'pendiente' | 'enviada' | 'abierta' | 'firmada' | 'rechazada' | 'error';

export interface Firmante {
  nombre: string;
  apellidos?: string;
  email: string;
  rfc?: string;
  /** exige verificación biométrica de identidad antes de firmar */
  requiereIdentidad: boolean;
}

export interface CrearSesionParams {
  altaId: string;
  firmante: Firmante;
  /** contrato en base64 (PDF) */
  contratoPdfBase64: string;
  contratoNombre: string;
  /** URL de retorno tras firmar (dominio configurable, ver VITE_APP_URL) */
  returnUrl?: string;
  /** datos extra; el mock lee `mockResultado` para simular aprobación/rechazo */
  metadata?: Record<string, unknown>;
}

export interface SesionCreada {
  documentoExternalId: string;
  inviteExternalId: string;
  teamUuid?: string;
  folderUuid?: string;
  /** URL alojada donde el firmante hace identidad + firma */
  signUrl?: string;
  raw?: unknown;
}

export interface RefSesion {
  documentoExternalId: string;
  inviteExternalId: string;
  identityUuid?: string;
}

export interface EstadoVerificacion {
  estado: VerificacionEstado;
  /** URLs/paths de evidencias (INE frente/reverso, selfie, liveness) */
  evidencias?: Record<string, string>;
  rfcValidado?: boolean;
  raw?: unknown;
}

export interface EstadoFirma {
  estado: FirmaEstado;
  /** status crudo del documento del proveedor (ej. unsigned/partially_signed/signed) */
  documentoStatus?: string;
  /** status crudo del invite (ej. idle/sent/opened/completed) */
  inviteStatus?: string;
  raw?: unknown;
}

export interface Constancia {
  /** PDF firmado */
  documentoFirmadoBytes?: Uint8Array;
  /** ZIP con constancia legal (NOM-151 + audit trail) */
  constanciaZipBytes?: Uint8Array;
}

/** Verificación de identidad biométrica (KYC). */
export interface IdentityVerificationProvider {
  readonly nombre: string;
  consultarVerificacion(ref: RefSesion): Promise<EstadoVerificacion>;
}

/** Firma de documentos con validez legal. */
export interface DocumentSignatureProvider {
  readonly nombre: string;
  /** Crea la sesión (documento + firmante). Si firmante.requiereIdentidad,
   *  la sesión incluye la verificación biométrica en el mismo flujo. */
  crearSesion(params: CrearSesionParams): Promise<SesionCreada>;
  consultarFirma(ref: RefSesion): Promise<EstadoFirma>;
  descargarConstancia(ref: RefSesion): Promise<Constancia>;
}

/** Proveedor combinado (identidad + firma en un solo flujo), p.ej. Cincel. */
export interface OnboardingProvider
  extends DocumentSignatureProvider, IdentityVerificationProvider {}

/**
 * Factory. Selecciona el proveedor según ALTA_PROVIDER_MODE (default 'mock'
 * si no hay credenciales de Cincel configuradas). Import dinámico para no
 * cargar el SDK del proveedor que no se use.
 */
export async function getOnboardingProvider(): Promise<OnboardingProvider> {
  const mode = (Deno.env.get('ALTA_PROVIDER_MODE') || '').toLowerCase() as ProviderMode;
  const hayCincel = !!Deno.env.get('CINCEL_PAT') && !!Deno.env.get('CINCEL_DEFAULT_TEAM_UUID');

  if (mode === 'cincel' || (mode !== 'mock' && hayCincel)) {
    const { CincelProvider } = await import('./cincelProvider.ts');
    return new CincelProvider();
  }
  const { MockProvider } = await import('./mockProvider.ts');
  return new MockProvider();
}
