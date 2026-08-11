// ============================================================================
// alta-finalizar — ALTA AUTOMÁTICA. Crea y ACTIVA el usuario Agente cuando el
// alta está 'approved' (identidad + firma OK). Migra documentos al expediente,
// dispara bienvenida al agente y notifica a Administradores (oficina pendiente
// de asignar por el equipo). Idempotente.
//
// Invocación INTERNA (desde alta-cincel-poll / alta-cincel-webhook). Se protege
// exigiendo el service_role key o ALTA_INTERNAL_SECRET en Authorization.
// Deploy con verify_jwt=false.
// ============================================================================

import { json, preflight, serviceClient, bitacora, transicion, notificarAdmins, type AltaRow } from '../_shared/alta/service.ts';

function generarPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => chars[b % chars.length]).join('');
}

function autorizado(req: Request): boolean {
  const auth = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const secret = Deno.env.get('ALTA_INTERNAL_SECRET') || '';
  return (!!service && auth === service) || (!!secret && auth === secret);
}

async function migrarDocumentos(db: ReturnType<typeof serviceClient>, altaId: string, usuarioId: string) {
  const { data: docs } = await db.from('alta_agente_documento').select('*').eq('alta_id', altaId);
  for (const d of (docs || [])) {
    const doc = d as Record<string, unknown>;
    if (doc.migrado_expediente_id) continue;
    try {
      const fromPath = String(doc.archivo_path);
      const nombre = String(doc.nombre_archivo);
      const destPath = `${usuarioId}/${String(doc.tipo_documento)}_${Date.now()}_${nombre}`;
      // Copiar el archivo del bucket privado del alta al expediente del usuario.
      const { data: file } = await db.storage.from('altas-onboarding').download(fromPath);
      if (file) {
        await db.storage.from('expediente-usuarios').upload(destPath, file, {
          contentType: String(doc.mime_type || 'application/octet-stream'), upsert: true,
        });
      }
      const { data: exp } = await db.from('expediente_usuario').insert({
        usuario_id: usuarioId,
        nombre_archivo: nombre,
        tipo_documento: String(doc.tipo_documento),
        descripcion: 'Cargado en el alta (/alta)',
        archivo_url: destPath,
        archivo_path: destPath,
        size_bytes: Number(doc.size_bytes) || 0,
        mime_type: String(doc.mime_type || 'application/octet-stream'),
        subido_por: usuarioId,
      }).select('id').maybeSingle();
      if (exp?.id) {
        await db.from('alta_agente_documento').update({ migrado_expediente_id: exp.id }).eq('id', String(doc.id));
      }
    } catch (e) {
      console.error('[alta-finalizar] migrar documento (no fatal):', e);
    }
  }
}

Deno.serve(async (req: Request) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!autorizado(req)) return json({ error: 'NO_AUTORIZADO' }, 401);

  try {
    const db = serviceClient();
    const body = await req.json().catch(() => ({}));
    const altaId = String(body.alta_id || '');
    if (!altaId) return json({ error: 'FALTA_ALTA' }, 400);

    const { data: alta } = await db.from('alta_agente').select('*').eq('id', altaId).maybeSingle();
    if (!alta) return json({ error: 'ALTA_NO_ENCONTRADA' }, 404);

    // Idempotencia.
    if (alta.usuario_id || alta.estado === 'completed') {
      return json({ ok: true, ya_completado: true, usuario_id: alta.usuario_id });
    }
    if (alta.estado !== 'approved') {
      return json({ error: 'ESTADO_NO_APROBADO', estado: alta.estado }, 409);
    }
    if (!alta.email || !alta.nombre || !alta.apellidos) {
      await transicion(db, alta as AltaRow, 'human_review', 'datos_insuficientes_para_alta', {}, 'sistema');
      return json({ error: 'DATOS_INSUFICIENTES' }, 400);
    }

    // 1) Crear usuario en auth.
    const password = generarPassword();
    const { data: authData, error: authErr } = await db.auth.admin.createUser({
      email: String(alta.email), password, email_confirm: true,
    });
    if (authErr || !authData?.user) {
      await bitacora(db, altaId, 'error_crear_auth', { detalle: { error: authErr?.message }, actor: 'sistema' });
      await transicion(db, alta as AltaRow, 'human_review', 'error_alta_auth', { error: authErr?.message });
      return json({ error: 'ERROR_CREAR_AUTH', detalle: authErr?.message }, 400);
    }
    const usuarioId = authData.user.id;

    // 2) Insertar en usuarios (rol Agente, ACTIVO, oficina pendiente).
    const { error: insErr } = await db.from('usuarios').insert({
      id: usuarioId,
      nombre: String(alta.nombre),
      apellidos: String(alta.apellidos),
      rol: 'Agente',
      email: String(alta.email),
      email_laboral: String(alta.email),
      email_personal: String(alta.email),
      celular_personal: String(alta.whatsapp || alta.telefono || ''),
      oficina_id: alta.oficina_id || null, // pendiente: la asigna el equipo interno
      banco: String(alta.banco || ''),
      clabe: String(alta.clabe || ''),
      estado: 'activo',
      status: 'activo',
      activo: true,
      fecha_ingreso_jiro: new Date().toISOString().slice(0, 10),
    });
    if (insErr) {
      await db.auth.admin.deleteUser(usuarioId); // rollback
      await bitacora(db, altaId, 'error_insert_usuario', { detalle: { error: insErr.message }, actor: 'sistema' });
      await transicion(db, alta as AltaRow, 'human_review', 'error_alta_usuario', { error: insErr.message });
      return json({ error: 'ERROR_INSERT_USUARIO', detalle: insErr.message }, 400);
    }

    // 3) Vincular alta ↔ usuario y completar.
    await db.from('alta_agente').update({
      usuario_id: usuarioId, completed_at: new Date().toISOString(),
    }).eq('id', altaId);
    await transicion(db, alta as AltaRow, 'completed', 'alta_completada', { usuario_id: usuarioId });

    // 4) Migrar documentos al expediente (no fatal).
    await migrarDocumentos(db, altaId, usuarioId);

    // 5) Bienvenida al agente (mismo RPC probado que usa create-user).
    try {
      await db.rpc('enviar_notificacion_completa', {
        p_tipo_codigo: 'cuenta_activada',
        p_user_id: usuarioId,
        p_titulo: '¡Bienvenido a MOVI Digital!',
        p_mensaje: 'Tu alta como agente fue completada. Ya puedes ingresar a la plataforma.',
        p_modulo: 'usuarios',
        p_datos_adicionales: { rol: 'Agente', folio: alta.folio },
        p_accion_url: '/dashboard',
      });
    } catch (e) { console.error('[alta-finalizar] bienvenida (no fatal):', e); }

    // 6) Notificar a Administradores (para asignar oficina y dar seguimiento).
    const nombreCompleto = `${alta.nombre} ${alta.apellidos}`;
    const tipoTxt = alta.tipo_agente === 'con_cedula' ? 'con cédula' : 'en desarrollo';
    await notificarAdmins(
      db,
      'Nueva alta de agente completada',
      `Se dio de alta y activó al agente ${nombreCompleto} (${tipoTxt}). Folio ${alta.folio}. Falta asignarle oficina.`,
      '/admin/usuarios',
    );

    return json({ ok: true, usuario_id: usuarioId });
  } catch (e) {
    console.error('[alta-finalizar] error:', e);
    return json({ error: 'ERROR_SERVIDOR', detalle: String((e as Error)?.message || e) }, 500);
  }
});
