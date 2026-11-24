// ============================================================================
// Adaptador Sumsub (KYC / verificación de identidad robusta).
// Implementado contra la API documentada (docs.sumsub.com). Se usa cuando hay
// SUMSUB_APP_TOKEN + SUMSUB_SECRET_KEY; si no, corre MockIdentityProvider.
//
// Firma de cada request (server-to-server): headers
//   X-App-Token, X-App-Access-Ts (unix segundos),
//   X-App-Access-Sig = hex( HMAC_SHA256( secretKey, ts + METHOD + path + body ) )
// donde `path` incluye query string y `body` es el cuerpo crudo (vacío si none).
// Puntos «CONFIRMAR» = validar contra la cuenta real / sandbox.
// ============================================================================

import type {
  IdentityVerificationProvider, IniciarVerificacionParams, SesionVerificacion,
  RefVerificacion, EstadoVerificacion,
} from './providers.ts';

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class SumsubIdentityVerificationProvider implements IdentityVerificationProvider {
  readonly nombre = 'sumsub';
  private base = (Deno.env.get('SUMSUB_BASE_URL') || 'https://api.sumsub.com').replace(/\/$/, '');
  private appToken = Deno.env.get('SUMSUB_APP_TOKEN') || '';
  private secret = Deno.env.get('SUMSUB_SECRET_KEY') || '';
  private level = Deno.env.get('SUMSUB_LEVEL_NAME') || 'basic-kyc-level';

  /** Request firmado a Sumsub. `path` debe incluir el query string. */
  private async req(method: string, path: string, body?: string): Promise<Response> {
    const ts = Math.floor(Date.now() / 1000).toString();
    const payload = ts + method.toUpperCase() + path + (body || '');
    const sig = await hmacHex(this.secret, payload);
    return fetch(`${this.base}${path}`, {
      method,
      headers: {
        'X-App-Token': this.appToken,
        'X-App-Access-Ts': ts,
        'X-App-Access-Sig': sig,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
    });
  }

  async iniciarVerificacion(p: IniciarVerificacionParams): Promise<SesionVerificacion> {
    // 1) Crear applicant.
    const path = `/resources/applicants?levelName=${encodeURIComponent(this.level)}`;
    const body = JSON.stringify({ externalUserId: p.externalUserId, email: p.email, phone: p.telefono });
    const res = await this.req('POST', path, body);
    if (!res.ok) throw new Error(`Sumsub crear applicant (${res.status}): ${await res.text()}`);
    const appl = await res.json();
    const applicantId = appl.id as string;

    // 2) Access token para el WebSDK (frontend).
    let sdkToken: string | undefined;
    try {
      const tokenPath = `/resources/accessTokens/sdk`;
      const tokBody = JSON.stringify({
        applicantIdentifiers: {
          email: p.email,
          phone: p.telefono,
        },
        ttlInSecs: 1200,
        userId: p.externalUserId,
        levelName: this.level,
      });
      const tokRes = await this.req('POST', tokenPath, tokBody);
      if (tokRes.ok) { const t = await tokRes.json(); sdkToken = t.token; }
    } catch (_e) { /* no fatal: se puede regenerar */ }

    return { applicantId, sdkToken, raw: appl };
  }

  async consultarVerificacion(ref: RefVerificacion): Promise<EstadoVerificacion> {
    const path = `/resources/applicants/${ref.applicantId}/status`;
    const res = await this.req('GET', path);
    if (!res.ok) return { estado: res.status === 404 ? 'pendiente' : 'error', raw: { status: res.status } };
    const s = await res.json();
    // reviewStatus: init | pending | prechecked | queued | completed | onHold
    // reviewResult.reviewAnswer: GREEN | RED ; reviewRejectType: FINAL | RETRY
    const reviewStatus = s.reviewStatus as string;
    const answer = s.reviewResult?.reviewAnswer as string | undefined;
    const rejectType = s.reviewResult?.reviewRejectType as string | undefined;

    if (reviewStatus === 'onHold') return { estado: 'en_proceso', motivo: 'manual', raw: s };
    if (reviewStatus !== 'completed') return { estado: 'pendiente', raw: s };
    if (answer === 'GREEN') return { estado: 'aprobada', raw: s };
    if (answer === 'RED') {
      return { estado: 'rechazada', motivo: rejectType === 'FINAL' ? 'final' : 'retry', raw: s };
    }
    return { estado: 'en_proceso', raw: s };
  }
}
