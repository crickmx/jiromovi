// ============================================================================
// Simulador de proveedor (identidad + firma) para correr /alta end-to-end SIN
// credenciales reales de Cincel. Es determinista y sin estado: codifica el
// resultado deseado dentro del id externo del documento, de modo que las
// consultas posteriores devuelvan siempre el mismo desenlace.
//
// Resultado configurable vía CrearSesionParams.metadata.mockResultado:
//   'aprobar' (default) | 'rechazar_identidad' | 'rechazar_firma' | 'error'
// ============================================================================

import type {
  OnboardingProvider, CrearSesionParams, SesionCreada, RefSesion,
  EstadoVerificacion, EstadoFirma, Constancia,
} from './providers.ts';

type MockResultado = 'aprobar' | 'rechazar_identidad' | 'rechazar_firma' | 'error';

function idSeguro(): string {
  // sin Math.random para ser reproducible en re-ejecuciones: usa crypto
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function decodeResultado(externalId: string): MockResultado {
  if (externalId.includes('__rechazar_identidad__')) return 'rechazar_identidad';
  if (externalId.includes('__rechazar_firma__')) return 'rechazar_firma';
  if (externalId.includes('__error__')) return 'error';
  return 'aprobar';
}

export class MockProvider implements OnboardingProvider {
  readonly nombre = 'mock';

  async crearSesion(params: CrearSesionParams): Promise<SesionCreada> {
    const resultado = (params.metadata?.mockResultado as MockResultado) || 'aprobar';
    const tag = resultado === 'aprobar' ? '' : `__${resultado}__`;
    const docId = `mock-doc-${tag}${idSeguro()}`;
    const inviteId = `mock-invite-${idSeguro()}`;
    const base = params.returnUrl || (Deno.env.get('ALTA_APP_URL') || '');
    return {
      documentoExternalId: docId,
      inviteExternalId: inviteId,
      teamUuid: 'mock-team',
      folderUuid: 'mock-folder',
      // La UI del wizard interpreta este signUrl y muestra un simulador in-app.
      signUrl: `${base}/alta/simular?doc=${encodeURIComponent(docId)}&invite=${encodeURIComponent(inviteId)}`,
      raw: { mock: true, resultado },
    };
  }

  async consultarVerificacion(ref: RefSesion): Promise<EstadoVerificacion> {
    const r = decodeResultado(ref.documentoExternalId);
    if (r === 'error') return { estado: 'error', raw: { mock: true } };
    if (r === 'rechazar_identidad') {
      return { estado: 'rechazada', rfcValidado: false, raw: { mock: true } };
    }
    return {
      estado: 'aprobada',
      rfcValidado: true,
      evidencias: {
        credentialFrontImage: 'mock://ine-frente.jpg',
        credentialBackImage: 'mock://ine-reverso.jpg',
        selfieImage: 'mock://selfie.jpg',
        selfieLivenessImage: 'mock://liveness.jpg',
      },
      raw: { mock: true },
    };
  }

  async consultarFirma(ref: RefSesion): Promise<EstadoFirma> {
    const r = decodeResultado(ref.documentoExternalId);
    if (r === 'error') return { estado: 'error', raw: { mock: true } };
    if (r === 'rechazar_identidad') {
      // no llega a firmar si la identidad se rechazó
      return { estado: 'pendiente', documentoStatus: 'unsigned', inviteStatus: 'sent', raw: { mock: true } };
    }
    if (r === 'rechazar_firma') {
      return { estado: 'rechazada', documentoStatus: 'unsigned', inviteStatus: 'opened', raw: { mock: true } };
    }
    return { estado: 'firmada', documentoStatus: 'signed', inviteStatus: 'completed', raw: { mock: true } };
  }

  async descargarConstancia(_ref: RefSesion): Promise<Constancia> {
    const fakePdf = new TextEncoder().encode('%PDF-1.4 mock contrato firmado (simulador)');
    const fakeZip = new TextEncoder().encode('PK mock constancia NOM-151 (simulador)');
    return { documentoFirmadoBytes: fakePdf, constanciaZipBytes: fakeZip };
  }
}
