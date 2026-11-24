// ============================================================================
// Capa de proveedores del módulo /alta — CONTRATO DESACOPLADO (dos proveedores)
// ----------------------------------------------------------------------------
// Identidad y firma son procesos SEPARADOS que corren EN PARALELO:
//   IdentityVerificationProvider  → Sumsub  (KYC: applicant, WebSDK, estado)
//   DocumentSignatureProvider     → SignWell (documento/plantilla, firma, estado)
// La UI y las edge functions dependen solo de estas interfaces. Para cambiar de
// proveedor: nueva implementación + registrarla en los factories de abajo.
// (El adaptador Cincel — que fusionaba ambos — queda en el repo, sin usar.)
// ============================================================================

export type VerificacionEstado =
  | 'no_iniciada' | 'pendiente' | 'en_proceso' | 'aprobada' | 'rechazada' | 'error';

export type FirmaEstado =
  | 'no_iniciada' | 'pendiente' | 'enviada' | 'abierta' | 'firmada' | 'rechazada' | 'error';

// ─── Identidad (Sumsub) ─────────────────────────────────────────────────
export interface IniciarVerificacionParams {
  altaId: string;
  externalUserId: string;   // id estable del prospecto (usamos el alta id)
  nombre: string;
  apellidos: string;
  email?: string;
  telefono?: string;
}
export interface SesionVerificacion {
  applicantId: string;
  /** token para el WebSDK del frontend (Sumsub) */
  sdkToken?: string;
  /** URL alojada alternativa (o simulador en mock) */
  url?: string;
  raw?: unknown;
}
export interface EstadoVerificacion {
  estado: VerificacionEstado;
  /** pista para el flujo global: reintento posible, revisión manual, o final */
  motivo?: 'retry' | 'manual' | 'final';
  evidencias?: Record<string, string>;
  raw?: unknown;
}
export interface RefVerificacion { applicantId: string; }

export interface IdentityVerificationProvider {
  readonly nombre: string;
  iniciarVerificacion(p: IniciarVerificacionParams): Promise<SesionVerificacion>;
  consultarVerificacion(ref: RefVerificacion): Promise<EstadoVerificacion>;
}

// ─── Firma (SignWell) ───────────────────────────────────────────────────
export interface CrearFirmaParams {
  altaId: string;
  firmante: { nombre: string; apellidos?: string; email: string };
  /** contrato en base64 (PDF) si no se usa plantilla */
  contratoPdfBase64?: string;
  contratoNombre: string;
  /** id de plantilla del proveedor (opcional) */
  templateId?: string;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
}
export interface SesionFirma {
  documentId: string;
  signatureId?: string;   // id del firmante/recipient
  /** URL de firma embebida/alojada */
  signUrl?: string;
  raw?: unknown;
}
export interface EstadoFirma {
  estado: FirmaEstado;
  documentoStatus?: string;   // status crudo del proveedor
  raw?: unknown;
}
export interface RefFirma { documentId: string; signatureId?: string; }

export interface Constancia {
  documentoFirmadoBytes?: Uint8Array;
  constanciaZipBytes?: Uint8Array;
  url?: string;
}

export interface DocumentSignatureProvider {
  readonly nombre: string;
  crearFirma(p: CrearFirmaParams): Promise<SesionFirma>;
  consultarFirma(ref: RefFirma): Promise<EstadoFirma>;
  descargarConstancia(ref: RefFirma): Promise<Constancia>;
}

// ─── Factories (selección por entorno; mock si no hay credenciales) ──────
export async function getIdentityProvider(): Promise<IdentityVerificationProvider> {
  const forzado = (Deno.env.get('ALTA_IDENTITY_PROVIDER') || '').toLowerCase();
  const haySumsub = !!Deno.env.get('SUMSUB_APP_TOKEN') && !!Deno.env.get('SUMSUB_SECRET_KEY');
  if (forzado === 'sumsub' || (forzado !== 'mock' && haySumsub)) {
    const { SumsubIdentityVerificationProvider } = await import('./sumsubProvider.ts');
    return new SumsubIdentityVerificationProvider();
  }
  const { MockIdentityProvider } = await import('./mockProvider.ts');
  return new MockIdentityProvider();
}

export async function getSignatureProvider(): Promise<DocumentSignatureProvider> {
  const forzado = (Deno.env.get('ALTA_SIGNATURE_PROVIDER') || '').toLowerCase();
  const haySignwell = !!Deno.env.get('SIGNWELL_API_KEY');
  if (forzado === 'signwell' || (forzado !== 'mock' && haySignwell)) {
    const { SignWellDocumentSignatureProvider } = await import('./signwellProvider.ts');
    return new SignWellDocumentSignatureProvider();
  }
  const { MockSignatureProvider } = await import('./mockProvider.ts');
  return new MockSignatureProvider();
}
