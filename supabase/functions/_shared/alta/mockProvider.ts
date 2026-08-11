// ============================================================================
// Simuladores de proveedores (identidad + firma) para correr /alta end-to-end
// SIN credenciales reales. Deterministas y sin estado: el resultado deseado se
// codifica en el id externo (applicantId / documentId).
//
// Resultado configurable vía metadata.mockResultado (se propaga al externalId):
//   'aprobar' (default) | 'rechazar_identidad' | 'rechazar_firma' | 'error'
// ============================================================================

import type {
  IdentityVerificationProvider, IniciarVerificacionParams, SesionVerificacion,
  RefVerificacion, EstadoVerificacion,
  DocumentSignatureProvider, CrearFirmaParams, SesionFirma, RefFirma, EstadoFirma, Constancia,
} from './providers.ts';

type MockResultado = 'aprobar' | 'rechazar_identidad' | 'rechazar_firma' | 'error';

function idSeguro(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function decode(externalId: string): MockResultado {
  if (externalId.includes('__rechazar_identidad__')) return 'rechazar_identidad';
  if (externalId.includes('__rechazar_firma__')) return 'rechazar_firma';
  if (externalId.includes('__error__')) return 'error';
  return 'aprobar';
}
function tag(metadata?: Record<string, unknown>): string {
  const r = (metadata?.mockResultado as MockResultado) || 'aprobar';
  return r === 'aprobar' ? '' : `__${r}__`;
}

export class MockIdentityProvider implements IdentityVerificationProvider {
  readonly nombre = 'mock';
  async iniciarVerificacion(p: IniciarVerificacionParams): Promise<SesionVerificacion> {
    const applicantId = `mock-appl-${tag(undefined)}${idSeguro()}`;
    const base = Deno.env.get('ALTA_APP_URL') || '';
    return { applicantId, sdkToken: `mock-sdk-${idSeguro()}`, url: `${base}/alta/simular?tipo=identidad&id=${applicantId}`, raw: { mock: true, externalUserId: p.externalUserId } };
  }
  async consultarVerificacion(ref: RefVerificacion): Promise<EstadoVerificacion> {
    const r = decode(ref.applicantId);
    if (r === 'error') return { estado: 'error', raw: { mock: true } };
    if (r === 'rechazar_identidad') return { estado: 'rechazada', motivo: 'retry', raw: { mock: true } };
    return {
      estado: 'aprobada',
      evidencias: { doc: 'mock://ine.jpg', selfie: 'mock://selfie.jpg' },
      raw: { mock: true },
    };
  }
}

export class MockSignatureProvider implements DocumentSignatureProvider {
  readonly nombre = 'mock';
  async crearFirma(p: CrearFirmaParams): Promise<SesionFirma> {
    const documentId = `mock-doc-${tag(p.metadata)}${idSeguro()}`;
    const base = p.returnUrl || (Deno.env.get('ALTA_APP_URL') || '');
    return {
      documentId,
      signatureId: `mock-sig-${idSeguro()}`,
      signUrl: `${base}/alta/simular?tipo=firma&doc=${encodeURIComponent(documentId)}`,
      raw: { mock: true },
    };
  }
  async consultarFirma(ref: RefFirma): Promise<EstadoFirma> {
    const r = decode(ref.documentId);
    if (r === 'error') return { estado: 'error', raw: { mock: true } };
    if (r === 'rechazar_firma') return { estado: 'rechazada', documentoStatus: 'declined', raw: { mock: true } };
    return { estado: 'firmada', documentoStatus: 'completed', raw: { mock: true } };
  }
  async descargarConstancia(_ref: RefFirma): Promise<Constancia> {
    return {
      documentoFirmadoBytes: new TextEncoder().encode('%PDF-1.4 mock contrato firmado (simulador)'),
      url: 'mock://contrato-firmado.pdf',
    };
  }
}
