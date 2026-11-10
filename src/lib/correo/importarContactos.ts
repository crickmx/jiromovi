// Importa contactos desde CSV o vCard. Puro: devuelve filas; quien llama decide
// qué guardar (y salta los correos que ya existen).

export interface ContactoImportado { nombre: string; apellido: string | null; email: string; telefono: string | null; empresa: string | null }

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function partirCsvLinea(linea: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (q) {
      if (ch === '"' && linea[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

const clave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const COLUMNAS: Record<keyof ContactoImportado | 'completo', string[]> = {
  email: ['email', 'correo', 'correoelectronico', 'emailaddress', 'email1emailaddress', 'email1value', 'mail', 'emailaddress1'],
  nombre: ['nombre', 'firstname', 'givenname', 'nombres', 'nombrepila'],
  apellido: ['apellido', 'apellidos', 'lastname', 'familyname', 'surname'],
  completo: ['name', 'nombrecompleto', 'fullname', 'displayname', 'contacto'],
  telefono: ['telefono', 'celular', 'phone', 'mobile', 'mobilephone', 'phone1value', 'telefonomovil', 'whatsapp'],
  empresa: ['empresa', 'company', 'organization', 'organizacion', 'organization1name', 'compania'],
};

export function parsearCsv(texto: string): ContactoImportado[] {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (lineas.length < 2) return [];
  const sep = (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const cab = partirCsvLinea(lineas[0], sep).map(clave);
  const idx = (k: keyof typeof COLUMNAS) => cab.findIndex(c => COLUMNAS[k].includes(c));
  const iE = idx('email'), iN = idx('nombre'), iA = idx('apellido'), iC = idx('completo'), iT = idx('telefono'), iO = idx('empresa');
  if (iE === -1) return [];
  return lineas.slice(1).map(l => partirCsvLinea(l, sep)).map(f => {
    let nombre = iN >= 0 ? f[iN] : '';
    let apellido = iA >= 0 ? f[iA] : '';
    if (!nombre && iC >= 0) {
      const partes = (f[iC] || '').split(/\s+/);
      nombre = partes.shift() || '';
      apellido = apellido || partes.join(' ');
    }
    const email = (f[iE] || '').toLowerCase();
    return { nombre: nombre || email.split('@')[0], apellido: apellido || null, email, telefono: (iT >= 0 && f[iT]) || null, empresa: (iO >= 0 && f[iO]) || null };
  }).filter(c => EMAIL_RE.test(c.email));
}

export function parsearVcard(texto: string): ContactoImportado[] {
  const plano = texto.replace(/\r?\n[ \t]/g, '');
  const tarjetas = plano.split(/BEGIN:VCARD/i).slice(1);
  const out: ContactoImportado[] = [];
  for (const t of tarjetas) {
    const campo = (nombre: string) => t.match(new RegExp(`^${nombre}(?:;[^:\\r\\n]*)?:(.*)$`, 'mi'))?.[1]?.trim() ?? '';
    const email = campo('EMAIL').toLowerCase();
    if (!EMAIL_RE.test(email)) continue;
    const [ap, nom] = campo('N').split(';');
    const fn = campo('FN');
    const nombre = (nom || fn.split(' ')[0] || email.split('@')[0]).trim();
    const apellido = (ap || fn.split(' ').slice(1).join(' ')).trim() || null;
    out.push({ nombre, apellido, email, telefono: campo('TEL') || null, empresa: campo('ORG').split(';')[0] || null });
  }
  return out;
}

export function parsearContactos(nombreArchivo: string, texto: string): ContactoImportado[] {
  const lista = /\.vcf$/i.test(nombreArchivo) || /BEGIN:VCARD/i.test(texto) ? parsearVcard(texto) : parsearCsv(texto);
  const vistos = new Set<string>();
  return lista.filter(c => (vistos.has(c.email) ? false : (vistos.add(c.email), true)));
}
