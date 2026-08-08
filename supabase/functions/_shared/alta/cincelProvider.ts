// ============================================================================
// Adaptador Cincel (API v3) — identidad biométrica + firma en un solo flujo.
// Implementado contra la documentación oficial (docs.cincel.digital / OpenAPI).
// Se usa cuando ALTA_PROVIDER_MODE=cincel y hay credenciales. Mientras no haya
// PAT, corre el MockProvider (ver providers.ts).
//
// Puntos marcados con «CONFIRMAR» dependen de detalles no publicados de la API
// (ver checklist en PLAN_ALTA.md) y deben validarse con la cuenta real.
// ============================================================================

import type {
  OnboardingProvider, CrearSesionParams, SesionCreada, RefSesion,
  EstadoVerificacion, EstadoFirma, Constancia,
} from './providers.ts';

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class CincelProvider implements OnboardingProvider {
  readonly nombre = 'cincel';
  private base = Deno.env.get('CINCEL_API_BASE_URL') || 'https://api.cincel.digital/v3';
  private pat = Deno.env.get('CINCEL_PAT') || '';
  private team = Deno.env.get('CINCEL_DEFAULT_TEAM_UUID') || '';
  private folder = Deno.env.get('CINCEL_DEFAULT_FOLDER_UUID') || '';
  private jwt: string | null = null;

  /** Obtiene y cachea un JWT de vida corta a partir del PAT (Basic auth). */
  private async getJwt(): Promise<string> {
    if (this.jwt) return this.jwt;
    const basic = btoa(`${this.pat}:`);
    const res = await fetch(`${this.base}/tokens/jwt`, {
      headers: { Authorization: `Basic ${basic}` },
    });
    if (!res.ok) throw new Error(`Cincel auth falló (${res.status}): ${await res.text()}`);
    // CONFIRMAR forma exacta de la respuesta (token plano vs {token}).
    const txt = await res.text();
    let token = txt.trim();
    try { const j = JSON.parse(txt); token = j.token || j.jwt || j.access_token || token; } catch { /* texto plano */ }
    this.jwt = token.replace(/^"|"$/g, '');
    return this.jwt;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${await this.getJwt()}` };
  }

  async crearSesion(params: CrearSesionParams): Promise<SesionCreada> {
    if (!this.team || !this.folder) {
      throw new Error('Falta CINCEL_DEFAULT_TEAM_UUID / CINCEL_DEFAULT_FOLDER_UUID');
    }
    const pdf = b64ToBytes(params.contratoPdfBase64);
    const signers = [{
      name: [params.firmante.nombre, params.firmante.apellidos].filter(Boolean).join(' '),
      email: params.firmante.email,
      identity_verification: params.firmante.requiereIdentidad,
      // w múltiplo de 200, h múltiplo de 123 (requisito Cincel)
      signature_coordinates: [{ page: 0, x: 72, y: 72, w: 200, h: 123 }],
      ...(params.firmante.rfc ? { rfc_validation: true, expected_rfc: params.firmante.rfc } : {}),
    }];

    const res = await fetch(`${this.base}/teams/${this.team}/folders/${this.folder}/documents`, {
      method: 'POST',
      headers: {
        ...(await this.authHeaders()),
        'Content-Type': 'application/pdf',
        Metadata: JSON.stringify({ name: params.contratoNombre, description: `Alta agente ${params.altaId}` }),
        Signers: JSON.stringify(signers),
        Observers: JSON.stringify([]),
      },
      body: pdf,
    });
    if (!res.ok) throw new Error(`Cincel crear documento falló (${res.status}): ${await res.text()}`);
    const doc = await res.json();
    const documentoExternalId = doc.uuid;

    // Recuperar el invite del firmante (CONFIRMAR: puede venir en `doc.invites`).
    let inviteExternalId = '';
    let signUrl: string | undefined;
    try {
      const invRes = await fetch(
        `${this.base}/teams/${this.team}/folders/${this.folder}/documents/${documentoExternalId}/invites`,
        { headers: await this.authHeaders() },
      );
      if (invRes.ok) {
        const invites = await invRes.json();
        const first = Array.isArray(invites) ? invites[0] : (invites?.data?.[0]);
        inviteExternalId = first?.uuid || '';
        if (inviteExternalId) {
          const tokRes = await fetch(
            `${this.base}/teams/${this.team}/folders/${this.folder}/documents/${documentoExternalId}/invites/${inviteExternalId}/token`,
            { headers: await this.authHeaders() },
          );
          if (tokRes.ok) {
            const tok = await tokRes.json().catch(() => null);
            const t = tok?.token || tok?.url;
            // CONFIRMAR: URL de firma alojada de Cincel a partir del token.
            signUrl = t ? (String(t).startsWith('http') ? String(t) : `https://app.cincel.digital/sign/${t}`) : undefined;
          }
        }
      }
    } catch (_e) { /* no fatal: el estado se resuelve por polling */ }

    return {
      documentoExternalId,
      inviteExternalId,
      teamUuid: this.team,
      folderUuid: this.folder,
      signUrl,
      raw: doc,
    };
  }

  private docPath(ref: RefSesion): string {
    return `${this.base}/teams/${this.team}/folders/${this.folder}/documents/${ref.documentoExternalId}`;
  }

  async consultarFirma(ref: RefSesion): Promise<EstadoFirma> {
    const res = await fetch(this.docPath(ref), { headers: await this.authHeaders() });
    if (!res.ok) return { estado: 'error', raw: { status: res.status } };
    const doc = await res.json();
    const docStatus = doc.status as string; // unsigned | partially_signed | signed
    const map: Record<string, EstadoFirma['estado']> = {
      unsigned: 'enviada', partially_signed: 'abierta', signed: 'firmada',
    };
    return { estado: map[docStatus] ?? 'pendiente', documentoStatus: docStatus, raw: doc };
  }

  async consultarVerificacion(ref: RefSesion): Promise<EstadoVerificacion> {
    // Cincel expone la evidencia como JPEGs; 404 = aún no validado.
    // CONFIRMAR: modelo de resultado (aprobado/rechazado/score) real del KYC.
    if (!ref.identityUuid) return { estado: 'pendiente' };
    const docs = ['credentialFrontImage', 'credentialBackImage', 'selfieImage', 'selfieLivenessImage'];
    const evidencias: Record<string, string> = {};
    let algunaOk = false;
    for (const d of docs) {
      const url = `${this.base}/identity-verifications/${ref.identityUuid}/${d}.jpeg`;
      const r = await fetch(url, { method: 'HEAD', headers: await this.authHeaders() });
      if (r.ok) { evidencias[d] = url; algunaOk = true; }
    }
    return { estado: algunaOk ? 'aprobada' : 'pendiente', evidencias, raw: { identityUuid: ref.identityUuid } };
  }

  async descargarConstancia(ref: RefSesion): Promise<Constancia> {
    const [firmado, zip] = await Promise.all([
      fetch(`${this.docPath(ref)}/signed-document.pdf`, { headers: await this.authHeaders() }),
      fetch(`${this.docPath(ref)}.zip`, { headers: await this.authHeaders() }),
    ]);
    const out: Constancia = {};
    if (firmado.ok) out.documentoFirmadoBytes = new Uint8Array(await firmado.arrayBuffer());
    if (zip.ok) out.constanciaZipBytes = new Uint8Array(await zip.arrayBuffer());
    return out;
  }
}
