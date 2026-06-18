export interface AgentVCardData {
  name: string;
  brand: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  slug: string;
}

function sanitizeVCardText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

export function sanitizeFileName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s\-]/g, '')
      .replace(/\s+/g, '_')
      .trim() || 'contacto'
  );
}

async function fetchPhotoBase64(
  url: string,
): Promise<{ data: string; type: string } | null> {
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const type = blob.type.includes('png') ? 'PNG' : 'JPEG';
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return data ? { data, type } : null;
  } catch {
    return null;
  }
}

export async function buildAgentVCard(agent: AgentVCardData): Promise<string> {
  const fn = sanitizeVCardText(agent.name);
  const org = sanitizeVCardText(agent.brand || agent.name);
  const pageUrl = `https://agentedeseguros.website/${agent.slug}`;

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fn}`,
    `N:${fn};;;;`,
    `ORG:${org}`,
    'TITLE:Agente de Seguros',
  ];

  if (agent.email?.trim()) {
    lines.push(`EMAIL;TYPE=WORK:${agent.email.trim()}`);
  }

  if (agent.phone) {
    const digits = agent.phone.replace(/\D/g, '');
    if (digits) {
      lines.push(`TEL;TYPE=CELL,WORK:+52${digits}`);
    }
  }

  lines.push(`URL:${pageUrl}`);

  if (agent.photoUrl) {
    const photo = await fetchPhotoBase64(agent.photoUrl);
    if (photo) {
      lines.push(`PHOTO;ENCODING=b;TYPE=${photo.type}:${photo.data}`);
    }
  }

  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export async function downloadVCard(agent: AgentVCardData): Promise<void> {
  const vcf = await buildAgentVCard(agent);
  const fileName = `${sanitizeFileName(agent.brand || agent.name)}.vcf`;
  const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
