// Prueba sin red: verifica el mapeo lid -> teléfono real y el nombre que se
// guarda en whatsapp_contacts. Se reemplaza el cliente de Supabase por un espía.
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake';

const assert = require('assert');
const { SupabaseSync } = require('../src/supabaseSync');
const { SessionManager } = require('../src/sessionManager');

const upserts = [];
class SpySB {
  from(tabla) {
    return {
      upsert: async (rec, opts) => { upserts.push({ tabla, rec, opts }); return { error: null }; },
      update: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }), then: (r) => r({ data: [], error: null }) }) }),
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    };
  }
}

(async () => {
  const sync = new SupabaseSync();
  sync.supabase = new SpySB();

  // 1) telefonoReal: el chat va por lid y el número real llega en remoteJidAlt
  const sm = new SessionManager();
  assert.strictEqual(
    sm.telefonoReal({ key: { remoteJid: '198887151267970@lid', remoteJidAlt: '5215599901551@s.whatsapp.net' } }),
    '5215599901551',
  );
  assert.strictEqual(sm.telefonoReal({ key: { remoteJid: '5215599901551@s.whatsapp.net' } }), null);
  assert.strictEqual(sm.telefonoReal({ key: { remoteJid: '1@lid', remoteJidAlt: '2@lid' } }), null);
  console.log('ok telefonoReal');

  // 2) syncContacts: contactos con lid + phoneNumber y con número normal
  upserts.length = 0;
  await sync.syncContacts('u1', [
    { id: '198887151267970@lid', notify: 'Getze Garcia', phoneNumber: '5215599901551@s.whatsapp.net' },
    { id: '5215512345678@s.whatsapp.net', name: 'Ana López' },
    { id: '120363427327155109@g.us', name: 'Equipo MOVI' },
  ]);

  const contactos = upserts.filter(u => u.tabla === 'whatsapp_contacts').map(u => u.rec);
  const porPhone = Object.fromEntries(contactos.map(c => [c.phone, c]));
  assert.ok(porPhone['198887151267970'], 'falta la fila del lid');
  assert.strictEqual(porPhone['198887151267970'].pn, '5215599901551');
  assert.strictEqual(porPhone['198887151267970'].notify_name, 'Getze Garcia');
  assert.strictEqual(porPhone['198887151267970'].jid, '198887151267970@lid');
  assert.strictEqual(porPhone['5215512345678'].saved_name, 'Ana López');
  console.log('ok syncContacts:', contactos.map(c => `${c.phone}(pn=${c.pn || '-'})`).join(', '));

  // 3) registrarContacto desde un mensaje en vivo
  upserts.length = 0;
  await sync.updateContactPushName('u1', '198887151267970', 'Getze', '5215599901551', '198887151267970@lid');
  assert.deepStrictEqual(
    { phone: upserts[0].rec.phone, push: upserts[0].rec.push_name, pn: upserts[0].rec.pn, jid: upserts[0].rec.jid },
    { phone: '198887151267970', push: 'Getze', pn: '5215599901551', jid: '198887151267970@lid' },
  );
  console.log('ok registrarContacto desde mensaje en vivo');

  // 4) updateConversationLastMessage ya no toca unread_count
  upserts.length = 0;
  const llamadas = [];
  sync.supabase = {
    from: () => ({ update: (rec) => { llamadas.push(rec); return { eq: async () => ({ data: null, error: null }) }; } }),
    rpc: () => { throw new Error('no debería llamar increment_unread_count'); },
  };
  await sync.updateConversationLastMessage('c1', 'hola', new Date().toISOString(), true);
  assert.deepStrictEqual(llamadas, [{ last_message_text: 'hola', last_message_at: llamadas[0].last_message_at }]);
  console.log('ok updateConversationLastMessage sin duplicar pendientes');

  console.log('TODO OK');
})().catch(e => { console.error('FALLA:', e.message); process.exit(1); });