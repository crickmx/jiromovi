const datos: Record<string, any[]> = {
  email_configuraciones: [{ email: 'ricardo@movi-demo.mx' }],
  usuarios: [{ id: 'u1', nombre_completo: 'MATEO PRUEBAS', rol: 'Agente', puesto: 'Asesor', email_laboral: 'mateo@movi-demo.mx', oficina: { nombre: 'Oficina MOVI Digital' } }],
  crm_contactos: [{ id: 'c1', nombre_completo: 'Cliente Ejemplo', email: 'cliente@empresa.com', tipo_contacto: 'Cliente' }],
  contactos: [], tickets: [{ id: 't1', folio: 'TK8A21F', source_email_message_id: '<m2@x>' }],
  correo_reglas: [],
  ticket_tipos: [{ id: 'tt1', value: 'cotizacion_prueba', label: 'Cotización (prueba)', activo: true, area: 'Comercial', area_id: null, is_custom: true, color: null }], email_templates: [{ id: 'e1', nombre: 'Acuse de recibo', asunto: null, cuerpo: 'Gracias, lo reviso.' }], correo_plantillas_respuesta: [],
};
function q(table: string) {
  let rows = datos[table] || [];
  const b: any = {
    select: () => b, eq: (c: string, v: unknown) => { if (rows.some(r => c in r)) rows = rows.filter(r => r[c] === v); return b; }, neq: () => b, in: (_c: string, v: string[]) => { if (table === 'tickets') rows = rows.filter(r => v.includes(r.source_email_message_id)); return b; },
    or: () => b, order: () => b, limit: () => b, is: () => b, not: () => b, ilike: () => b,
    insert: () => b, update: () => b, delete: () => b, upsert: () => b,
    maybeSingle: () => Promise.resolve({ data: rows[0] || null, error: null }),
    single: () => Promise.resolve({ data: rows[0] || null, error: null }),
    then: (res: any, rej: any) => Promise.resolve({ data: rows, error: null }).then(res, rej),
  };
  return b;
}
export const supabase: any = {
  from: q,
  rpc: () => Promise.resolve({ data: null, error: null }),
  auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'x' } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
  storage: { from: () => ({}) },
};
export default supabase;
