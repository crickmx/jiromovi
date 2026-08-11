// ============================================================================
// Adaptador SignWell (firma electrónica con validez legal).
// Implementado contra la API documentada (developers.signwell.com). Se usa
// cuando hay SIGNWELL_API_KEY; si no, corre MockSignatureProvider.
// Auth: header `X-Api-Key`. Base: https://www.signwell.com/api/v1
// Puntos «CONFIRMAR» = validar contra la cuenta real (nombres de campos exactos).
// ============================================================================

import type {
  DocumentSignatureProvider, CrearFirmaParams, SesionFirma, RefFirma, EstadoFirma, Constancia,
} from './providers.ts';

export class SignWellDocumentSignatureProvider implements DocumentSignatureProvider {
  readonly nombre = 'signwell';
  private base = (Deno.env.get('SIGNWELL_BASE_URL') || 'https://www.signwell.com/api/v1').replace(/\/$/, '');
  private apiKey = Deno.env.get('SIGNWELL_API_KEY') || '';
  private templateId = Deno.env.get('SIGNWELL_TEMPLATE_ID') || '';
  private testMode = (Deno.env.get('SIGNWELL_TEST_MODE') || 'false') === 'true';

  private headers(): Record<string, string> {
    return { 'X-Api-Key': this.apiKey, 'Content-Type': 'application/json' };
  }

  async crearFirma(p: CrearFirmaParams): Promise<SesionFirma> {
    const nombre = [p.firmante.nombre, p.firmante.apellidos].filter(Boolean).join(' ');
    const recipient = { id: '1', name: nombre, email: p.firmante.email };

    let res: Response;
    if (this.templateId || p.templateId) {
      // Documento desde PLANTILLA. El recipient se mapea por placeholder_name.
      const body = {
        test_mode: this.testMode,
        template_id: p.templateId || this.templateId,
        embedded_signing: true,
        draft: false,
        name: p.contratoNombre,
        recipients: [{ ...recipient, placeholder_name: Deno.env.get('SIGNWELL_PLACEHOLDER') || 'Agente' }],
        // CONFIRMAR: prellenado de campos de plantilla via `template_fields`.
      };
      res = await fetch(`${this.base}/document_templates/documents/`, {
        method: 'POST', headers: this.headers(), body: JSON.stringify(body),
      });
    } else {
      // Documento desde CERO (PDF en base64) con campo de firma en la 1a página.
      const body = {
        test_mode: this.testMode,
        embedded_signing: true,
        draft: false,
        name: p.contratoNombre,
        files: [{ name: `${p.contratoNombre}.pdf`, file_base64: p.contratoPdfBase64 || '' }],
        recipients: [recipient],
        fields: [[{ recipient_id: '1', type: 'signature', page: 1, x: 100, y: 600, required: true }]],
      };
      res = await fetch(`${this.base}/documents/`, {
        method: 'POST', headers: this.headers(), body: JSON.stringify(body),
      });
    }
    if (!res.ok) throw new Error(`SignWell crear documento (${res.status}): ${await res.text()}`);
    const doc = await res.json();
    const rec = (doc.recipients || [])[0] || {};
    return {
      documentId: doc.id,
      signatureId: rec.id ? String(rec.id) : undefined,
      signUrl: rec.embedded_signing_url || doc.embedded_signing_url,
      raw: doc,
    };
  }

  async consultarFirma(ref: RefFirma): Promise<EstadoFirma> {
    const res = await fetch(`${this.base}/documents/${ref.documentId}/`, { headers: this.headers() });
    if (!res.ok) return { estado: res.status === 404 ? 'pendiente' : 'error', raw: { status: res.status } };
    const doc = await res.json();
    const status = doc.status as string; // draft | sent | completed | declined | expired
    const map: Record<string, EstadoFirma['estado']> = {
      draft: 'pendiente', sent: 'enviada', viewed: 'abierta',
      completed: 'firmada', declined: 'rechazada', expired: 'rechazada',
    };
    return { estado: map[status] ?? 'pendiente', documentoStatus: status, raw: doc };
  }

  async descargarConstancia(ref: RefFirma): Promise<Constancia> {
    // PDF firmado (con audit trail). CONFIRMAR nombre exacto del endpoint.
    const url = `${this.base}/documents/${ref.documentId}/completed_pdf/?audit_page=true`;
    const res = await fetch(url, { headers: { 'X-Api-Key': this.apiKey } });
    const out: Constancia = { url };
    if (res.ok) out.documentoFirmadoBytes = new Uint8Array(await res.arrayBuffer());
    return out;
  }
}
