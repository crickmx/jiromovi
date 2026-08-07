// ============================================================================
// alta-guardar — CRUD público del onboarding /alta (guardado parcial).
// Endpoint público: el frontend manda la anon key (verify_jwt=true en deploy).
// La escritura real usa service_role (bypassa RLS). Cada alta se protege con un
// `resume_token` secreto devuelto al iniciar; toda edición posterior lo exige,
// para que un anónimo no pueda tocar el alta de otro adivinando el UUID.
//
// Acciones (body.action):
//   iniciar        -> crea el alta (reCAPTCHA), devuelve {id, folio, resume_token}
//   guardar_paso   -> patch de datos + upsert de paso (guardado parcial)
//   subir_url      -> signed upload URL para un documento (bucket privado)
//   registrar_doc  -> registra metadata del documento subido
//   retomar        -> carga el alta por resume_token (para continuar después)
// ============================================================================

import {
  json, preflight, serviceClient, bitacora, transicion, generarFolio,
  type AltaRow,
} from '../_shared/alta/service.ts';
import { reconciliarAlta } from '../_shared/alta/reconciliar.ts';

const CAMPOS_ALTA = new Set([
  'tipo_agente', 'nombre', 'apellidos', 'fecha_nacimiento', 'curp', 'rfc',
  'email', 'whatsapp', 'telefono', 'razon_social', 'regimen_fiscal',
  'codigo_postal_fiscal', 'uso_cfdi', 'banco', 'clabe', 'cuenta_banco',
  'cedula', 'cedula_vigencia', 'poliza_rc_numero', 'poliza_rc_aseguradora',
  'poliza_rc_vigencia',
]);

const EXT_OK = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic']);

function limpiarCampos(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (CAMPOS_ALTA.has(k)) out[k] = v === '' ? null : v;
  }
  return out;
}

async function verificarRecaptcha(token: string | undefined): Promise<boolean> {
  const secret = Deno.env.get('RECAPTCHA_SECRET_KEY') || '';
  if (!secret) return true; // si no está configurado, no bloquea (igual que otras functions)
  try {
    const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secret}&response=${token || ''}`,
    });
    const j = await r.json();
    return !!j.success && (typeof j.score !== 'number' || j.score >= 0.5);
  } catch {
    return true; // no bloquear por caída de Google
  }
}

/** Carga un alta validando el resume_token. */
async function cargarAlta(db: ReturnType<typeof serviceClient>, altaId: string, token: string) {
  const { data } = await db.from('alta_agente').select('*').eq('id', altaId).maybeSingle();
  if (!data) return { error: 'ALTA_NO_ENCONTRADA' as const };
  if (data.resume_token !== token) return { error: 'TOKEN_INVALIDO' as const };
  return { alta: data as AltaRow };
}

Deno.serve(async (req: Request) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const db = serviceClient();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    if (action === 'iniciar') {
      const ok = await verificarRecaptcha(body.recaptchaToken);
      if (!ok) return json({ error: 'RECAPTCHA_FALLIDO' }, 400);

      const campos = limpiarCampos(body.datos || {});
      const folio = generarFolio();
      const { data, error } = await db.from('alta_agente').insert({
        folio,
        estado: 'in_progress',
        paso_actual: body.paso_actual || 'tipo',
        ...campos,
        user_agent: req.headers.get('user-agent') || null,
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      }).select('id, folio, resume_token, estado').single();
      if (error || !data) return json({ error: 'NO_SE_PUDO_CREAR', detalle: error?.message }, 500);

      await bitacora(db, data.id, 'alta_iniciada', {
        estadoNuevo: 'in_progress', actor: 'usuario', detalle: { folio },
      });
      return json({ ok: true, id: data.id, folio: data.folio, resume_token: data.resume_token });
    }

    // Todas las demás acciones exigen alta_id + resume_token válidos.
    const altaId = String(body.alta_id || '');
    const token = String(body.resume_token || '');
    if (!altaId || !token) return json({ error: 'FALTA_ALTA_O_TOKEN' }, 400);
    const res = await cargarAlta(db, altaId, token);
    if ('error' in res) return json({ error: res.error }, 403);
    const alta = res.alta;

    if (action === 'guardar_paso') {
      const campos = limpiarCampos(body.datos || {});
      if (Object.keys(campos).length || body.paso_actual) {
        await db.from('alta_agente').update({
          ...campos,
          ...(body.paso_actual ? { paso_actual: String(body.paso_actual) } : {}),
        }).eq('id', alta.id);
      }
      if (body.paso) {
        await db.from('alta_agente_paso').upsert({
          alta_id: alta.id,
          paso: String(body.paso),
          estado: (body.paso_estado as string) || 'completado',
          orden: Number(body.orden) || 0,
          datos: body.paso_datos && typeof body.paso_datos === 'object' ? body.paso_datos : {},
          completed_at: new Date().toISOString(),
        }, { onConflict: 'alta_id,paso' });
      }
      if (alta.estado === 'draft') {
        await transicion(db, alta, 'in_progress', 'captura_en_progreso', {}, 'usuario');
      } else {
        await bitacora(db, alta.id, 'paso_guardado', { detalle: { paso: body.paso }, actor: 'usuario' });
      }
      return json({ ok: true });
    }

    if (action === 'subir_url') {
      const tipo = String(body.tipo_documento || 'otro').replace(/[^a-z0-9_]/gi, '_');
      const nombre = String(body.nombre_archivo || 'archivo');
      const ext = (nombre.split('.').pop() || '').toLowerCase();
      if (!EXT_OK.has(ext)) return json({ error: 'EXTENSION_NO_PERMITIDA', ext }, 400);
      const path = `${alta.id}/${tipo}_${Date.now()}.${ext}`;
      const { data, error } = await db.storage.from('altas-onboarding').createSignedUploadUrl(path);
      if (error || !data) return json({ error: 'NO_SE_PUDO_FIRMAR_SUBIDA', detalle: error?.message }, 500);
      return json({ ok: true, path, token: data.token, signedUrl: data.signedUrl });
    }

    if (action === 'registrar_doc') {
      const { error } = await db.from('alta_agente_documento').insert({
        alta_id: alta.id,
        tipo_documento: String(body.tipo_documento || 'otro'),
        nombre_archivo: String(body.nombre_archivo || 'archivo'),
        archivo_path: String(body.archivo_path || ''),
        size_bytes: Number(body.size_bytes) || 0,
        mime_type: String(body.mime_type || 'application/octet-stream'),
      });
      if (error) return json({ error: 'NO_SE_PUDO_REGISTRAR_DOC', detalle: error.message }, 500);
      await bitacora(db, alta.id, 'documento_cargado', {
        detalle: { tipo: body.tipo_documento }, actor: 'usuario',
      });
      return json({ ok: true });
    }

    if (action === 'estado') {
      const [{ data: verif }, { data: firma }] = await Promise.all([
        db.from('alta_agente_verificacion').select('estado').eq('alta_id', alta.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        db.from('alta_agente_firma').select('estado').eq('alta_id', alta.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      return json({
        ok: true,
        estado: alta.estado,
        usuario_id: alta.usuario_id || null,
        verificacion: (verif as { estado?: string } | null)?.estado || 'no_iniciada',
        firma: (firma as { estado?: string } | null)?.estado || 'no_iniciada',
      });
    }

    if (action === 'reconciliar') {
      // Refresca el estado consultando al proveedor (útil para el wizard sin
      // esperar al cron). Gateado por resume_token: el usuario solo reconcilia
      // su propia alta.
      await reconciliarAlta(db, alta, 'cron');
      const { data: fresca } = await db.from('alta_agente')
        .select('estado, usuario_id').eq('id', alta.id).maybeSingle();
      return json({ ok: true, estado: fresca?.estado || alta.estado, usuario_id: fresca?.usuario_id || null });
    }

    if (action === 'retomar') {
      const [{ data: pasos }, { data: docs }] = await Promise.all([
        db.from('alta_agente_paso').select('paso, estado, datos, orden').eq('alta_id', alta.id),
        db.from('alta_agente_documento').select('id, tipo_documento, nombre_archivo, size_bytes, mime_type').eq('alta_id', alta.id),
      ]);
      // No exponer campos sensibles crudos: devolver lo necesario para reanudar.
      const { resume_token: _t, ip_address: _ip, user_agent: _ua, ...safe } = alta;
      return json({ ok: true, alta: safe, pasos: pasos || [], documentos: docs || [] });
    }

    return json({ error: 'ACCION_DESCONOCIDA', action }, 400);
  } catch (e) {
    console.error('[alta-guardar] error:', e);
    return json({ error: 'ERROR_SERVIDOR', detalle: String((e as Error)?.message || e) }, 500);
  }
});
