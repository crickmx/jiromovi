import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Access-Control-Expose-Headers': 'Content-Disposition',
};

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PAGE_SIZE = 1000;

type AnyRow = Record<string, unknown>;

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalizeRow(row: AnyRow) {
  const normalized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = normalizeCell(value);
  }
  return normalized;
}

function buildSheet(rows: AnyRow[]) {
  return XLSX.utils.json_to_sheet(rows.map(normalizeRow));
}

async function fetchAll<T extends AnyRow>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  select = '*',
  orderBy?: { column: string; ascending?: boolean },
) {
  const allRows: T[] = [];
  let start = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(start, start + PAGE_SIZE - 1);
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as T[];
    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }

  return allRows;
}

function fullName(user: { nombre?: string | null; apellidos?: string | null }) {
  return [user.nombre ?? '', user.apellidos ?? ''].map((part) => String(part).trim()).filter(Boolean).join(' ');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: currentUser } = await supabase
      .from('usuarios')
      .select('rol, activo')
      .eq('id', user.id)
      .maybeSingle();

    if (currentUser?.rol !== 'Administrador' || currentUser?.activo === false) {
      return new Response(JSON.stringify({ error: 'Solo los administradores activos pueden descargar este respaldo' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [
      usuarios,
      oficinas,
      roles,
      modulosSistema,
      moduleVisibility,
      permisosCampos,
      camposPersonalizados,
      valoresCamposPersonalizados,
      tramitesGrupos,
      tramitesGruposMiembros,
      permisosAdicionalesGerente,
    ] = await Promise.all([
      fetchAll<AnyRow>(supabase, 'usuarios', '*', { column: 'created_at', ascending: true }),
      fetchAll<AnyRow>(supabase, 'oficinas', '*', { column: 'nombre', ascending: true }),
      fetchAll<AnyRow>(supabase, 'roles', '*', { column: 'orden', ascending: true }),
      fetchAll<AnyRow>(supabase, 'modulos_sistema', '*', { column: 'orden', ascending: true }),
      fetchAll<AnyRow>(supabase, 'module_visibility', '*', { column: 'updated_at', ascending: false }),
      fetchAll<AnyRow>(supabase, 'permisos_campos', '*', { column: 'rol', ascending: true }),
      fetchAll<AnyRow>(supabase, 'campos_personalizados', '*', { column: 'orden', ascending: true }),
      fetchAll<AnyRow>(supabase, 'valores_campos_personalizados', '*', { column: 'updated_at', ascending: false }),
      fetchAll<AnyRow>(supabase, 'tramites_grupos_visualizacion', '*', { column: 'nombre', ascending: true }),
      fetchAll<AnyRow>(supabase, 'tramites_grupos_miembros', '*', { column: 'created_at', ascending: true }),
      fetchAll<AnyRow>(supabase, 'permisos_adicionales_gerente', '*', { column: 'fecha_asignacion', ascending: true }),
    ]);

    const oficinasMap = new Map(oficinas.map((o) => [String(o.id), String(o.nombre ?? '')]));
    const rolesMap = new Map(roles.map((r) => [String(r.id), String(r.nombre ?? '')]));
    const modulosMap = new Map(modulosSistema.map((m) => [String(m.id), String(m.nombre ?? '')]));
    const modulosCodigoMap = new Map(modulosSistema.map((m) => [String(m.codigo), { id: String(m.id), nombre: String(m.nombre ?? '') }]));
    const usuariosMap = new Map(
      usuarios.map((u) => [String(u.id), { ...u, nombre_completo: fullName(u) }]),
    );
    const gruposMap = new Map(tramitesGrupos.map((g) => [String(g.id), g]));

    const usuariosSheet = usuarios.map((u) => ({
      ...u,
      nombre_completo: fullName(u),
      oficina_nombre: u.oficina_id ? oficinasMap.get(String(u.oficina_id)) ?? null : null,
      rol_catalogo: u.rol_id ? rolesMap.get(String(u.rol_id)) ?? null : null,
    }));

    const oficinasSheet = oficinas.map((o) => ({
      ...o,
    }));

    const rolesSheet = roles.map((r) => ({
      ...r,
    }));

    const modulosSheet = modulosSistema.map((m) => ({
      ...m,
    }));

    const moduleVisibilitySheet = moduleVisibility.map((row) => ({
      ...row,
      module_nombre: row.module_key ? modulosCodigoMap.get(String(row.module_key))?.nombre ?? null : null,
      target_nombre:
        row.target_type === 'office'
          ? oficinasMap.get(String(row.target_value)) ?? null
          : row.target_type === 'role'
            ? String(row.target_value ?? '')
            : String(row.target_value ?? ''),
    }));

    const permisosCamposSheet = permisosCampos.map((row) => ({ ...row }));
    const camposPersonalizadosSheet = camposPersonalizados.map((row) => ({ ...row }));

    const valoresCamposSheet = valoresCamposPersonalizados.map((row) => {
      const user = usuariosMap.get(String(row.usuario_id));
      const campo = camposPersonalizados.find((c) => String(c.id) === String(row.campo_id));
      return {
        ...row,
        usuario_nombre: user ? user.nombre_completo : null,
        usuario_email: user?.email_laboral ?? null,
        campo_nombre: campo ? String(campo.nombre_campo ?? campo.nombre ?? '') : null,
      };
    });

    const tramitesGruposSheet = tramitesGrupos.map((row) => ({
      ...row,
      oficina_nombre: row.oficina_id ? oficinasMap.get(String(row.oficina_id)) ?? null : null,
    }));

    const tramitesGruposMiembrosSheet = tramitesGruposMiembros.map((row) => {
      const grupo = gruposMap.get(String(row.grupo_id));
      const user = usuariosMap.get(String(row.usuario_id));
      return {
        ...row,
        grupo_nombre: grupo ? String(grupo.nombre ?? '') : null,
        usuario_nombre: user ? user.nombre_completo : null,
        usuario_email: user?.email_laboral ?? null,
        usuario_rol: user?.rol ?? null,
        usuario_oficina: user?.oficina_id ? oficinasMap.get(String(user.oficina_id)) ?? null : null,
      };
    });

    const permisosAdicionalesSheet = permisosAdicionalesGerente.map((row) => ({
      ...row,
      usuario_nombre: usuariosMap.get(String(row.usuario_id))?.nombre_completo ?? null,
      usuario_email: usuariosMap.get(String(row.usuario_id))?.email_laboral ?? null,
      modulo_nombre: row.modulo_id ? modulosMap.get(String(row.modulo_id)) ?? null : null,
      asignado_por_nombre: row.asignado_por ? usuariosMap.get(String(row.asignado_por))?.nombre_completo ?? null : null,
    }));

    const summarySheet = [
      { seccion: 'Usuarios', registros: usuarios.length },
      { seccion: 'Oficinas', registros: oficinas.length },
      { seccion: 'Roles', registros: roles.length },
      { seccion: 'Modulos', registros: modulosSistema.length },
      { seccion: 'Visibilidad de modulos', registros: moduleVisibility.length },
      { seccion: 'Permisos de campos', registros: permisosCampos.length },
      { seccion: 'Campos personalizados', registros: camposPersonalizados.length },
      { seccion: 'Valores de campos', registros: valoresCamposPersonalizados.length },
      { seccion: 'Grupos de tramites', registros: tramitesGrupos.length },
      { seccion: 'Miembros de grupos', registros: tramitesGruposMiembros.length },
      { seccion: 'Permisos adicionales gerente', registros: permisosAdicionalesGerente.length },
      { seccion: 'Exportado por', registros: String(user.id) },
      { seccion: 'Exportado el', registros: new Date().toISOString() },
    ];

    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: 'Respaldo de usuarios y configuracion',
      Subject: 'Exportacion administrativa',
      Author: 'Supabase Edge Function',
      CreatedDate: new Date(),
    };

    const sheets: Array<{ name: string; rows: AnyRow[] }> = [
      { name: 'Resumen', rows: summarySheet },
      { name: 'Usuarios', rows: usuariosSheet },
      { name: 'Oficinas', rows: oficinasSheet },
      { name: 'Roles', rows: rolesSheet },
      { name: 'Modulos', rows: modulosSheet },
      { name: 'Visibilidad', rows: moduleVisibilitySheet },
      { name: 'PermisosCampos', rows: permisosCamposSheet },
      { name: 'Campos', rows: camposPersonalizadosSheet },
      { name: 'ValoresCampos', rows: valoresCamposSheet },
      { name: 'TramiteGrupos', rows: tramitesGruposSheet },
      { name: 'GrupoMiembros', rows: tramitesGruposMiembrosSheet },
      { name: 'PermisosGerente', rows: permisosAdicionalesSheet },
    ];

    for (const sheetDef of sheets) {
      const sheet = buildSheet(sheetDef.rows);
      XLSX.utils.book_append_sheet(workbook, sheet, sheetDef.name);
    }

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `respaldo_usuarios_configuracion_${dateStamp}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': XLSX_MIME,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[export-users-backup] Error:', error);
    return new Response(JSON.stringify({
      error: 'Error interno al generar el respaldo',
      details: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
