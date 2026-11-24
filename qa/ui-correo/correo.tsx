import '@fontsource-variable/manrope';
import '@fontsource-variable/sora';
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import GestorEmails from '../../src/pages/GestorEmails';
if (new URLSearchParams(location.search).get('dark')) document.documentElement.classList.add('dark');
const ahora = Date.now();
const msgs = [
  { uid: 5, messageId: '<m5@x>', from: 'José Hernández Martínez de la Garza', fromEmail: 'cliente@empresa.com', to: ['ricardo@movi-demo.mx'], cc: [], subject: 'Cotización de seguro de auto para flotilla de 12 unidades modelo 2024', date: new Date(ahora - 18e5).toUTCString(), seen: false, flagged: false, hasAttachments: true, size: 1, snippet: 'Buenas tardes, les escribo para solicitar la cotización de la flotilla que platicamos la semana pasada.' },
  { uid: 4, messageId: '<m2@x>', from: 'MATEO PRUEBAS', fromEmail: 'mateo@movi-demo.mx', to: ['ricardo@movi-demo.mx'], cc: [], subject: 'Re: Póliza GNP renovación', date: new Date(ahora - 9e6).toUTCString(), seen: true, flagged: false, hasAttachments: false, size: 1, snippet: 'Te confirmo que ya se envió la renovación al cliente.' },
  { uid: 3, messageId: '<m3@x>', from: 'Soporte JIRO', fromEmail: 'avisos@jiro-seguridad.com', to: ['ricardo@movi-demo.mx'], cc: [], subject: 'Verifica tu cuenta', date: new Date(ahora - 9e7).toUTCString(), seen: false, flagged: false, hasAttachments: false, size: 1, snippet: 'Tu cuenta será suspendida si no la verificas hoy.' },
  { uid: 2, messageId: '<m1@x>', from: 'Boletín', fromEmail: 'news@aseguradora.com', to: [], cc: [], subject: '', date: new Date(ahora - 4e8).toUTCString(), seen: true, flagged: false, hasAttachments: false, size: 1 },
];
const full = (uid: number) => {
  const h: any = msgs.find(m => m.uid === uid)!;
  return { ...h, bcc: [], bodyText: null, bodyHtml: '<p>Hola Ricardo,</p><p>Les comparto la información de la flotilla.<br><img src="https://example.com/x.png" alt="logo"></p><p>Saludos.</p>', attachments: uid === 5 ? [{ filename: 'tarjetas-circulacion.pdf', contentType: 'application/pdf', size: 245000, partId: '2' }, { filename: 'foto.jpg', contentType: 'image/jpeg', size: 88000, partId: '3' }] : [] };
};
const realFetch = window.fetch;
// Registro de llamadas a funciones del servidor, para que la prueba las revise.
(window as any).__llamadas = [];
window.fetch = async (input: any, init?: any) => {
  const url = String(input?.url || input);
  if (url.includes('/functions/v1/') && !url.includes('ionos-webmail')) {
    const fn = url.split('/functions/v1/')[1];
    const body = init?.body ? JSON.parse(init.body) : null;
    (window as any).__llamadas.push({ fn, body });
    const r = (d: any) => new Response(JSON.stringify(d), { status: 200 });
    if (fn === 'analyze-email-for-tramite') return r({ analysis: { summary: 'Resumen', important_data: {} }, detectedAgent: { id: 'u1', nombre_completo: 'MATEO PRUEBAS', method: 'automatic' } });
    if (fn === 'create-tramite-from-email') return r({ success: true, ticket_id: 'tnew', folio: 'TKNUEVO' });
    if (fn === 'add-email-to-tramite') return r({ success: true, attachments_result: [] });
    return r({});
  }
  if (url.includes('ionos-webmail')) {
    const body = JSON.parse(init.body);
    const r = (d: any) => new Response(JSON.stringify(d), { status: 200 });
    switch (body.action) {
      case 'list-folders': return r([
        { name: 'INBOX', path: 'INBOX', flags: [], total: 1284, unseen: 2 }, { name: 'Sent', path: 'Sent', flags: ['\\Sent'], total: 300, unseen: 0 },
        { name: 'Drafts', path: 'Drafts', flags: ['\\Drafts'], total: 2, unseen: 0 }, { name: 'Spam', path: 'Spam', flags: ['\\Junk'], total: 9, unseen: 3 },
        { name: 'Trash', path: 'Trash', flags: ['\\Trash'], total: 40, unseen: 0 }, { name: 'Archive', path: 'Archive', flags: [], total: 12, unseen: 0 },
        { name: 'INBOX.Clientes VIP', path: 'INBOX.Clientes VIP', flags: [], total: 5, unseen: 1 },
        { name: 'Archivo', path: 'Archivo', flags: [], total: 3, unseen: 0 }, { name: 'Archivo/2022', path: 'Archivo/2022', flags: [], total: 3, unseen: 0 }, { name: 'Notes', path: 'Notes', flags: [], total: 0, unseen: 0 }]);
      case 'list-messages': return r({ messages: msgs, total: 1284 });
      case 'quota': return r({ usedBytes: 1.6e9, limitBytes: 2e9 });
      case 'get-message': return r(full(body.uid));
      case 'thread': return r({ messages: [{ uid: 9, folder: 'Sent', messageId: '<s1@x>', inReplyTo: '<m0@x>', subject: 'Cotización de seguro de auto', fromEmail: 'ricardo@movi-demo.mx', from: 'Yo', to: ['cliente@empresa.com'], date: new Date(ahora - 3e8).toUTCString(), snippet: 'Claro, envíame las tarjetas de circulación.' }, { uid: 5, folder: 'INBOX', messageId: '<m5@x>', references: '<s1@x>', subject: 'x', fromEmail: 'cliente@empresa.com', to: [], date: new Date().toUTCString() }] });
      default: return r({ success: true, messages: msgs.slice(0, 2), total: 2 });
    }
  }
  return realFetch(input, init);
};
createRoot(document.getElementById('root')!).render(<BrowserRouter><div style={{ height: '100vh' }}><GestorEmails /></div></BrowserRouter>);
