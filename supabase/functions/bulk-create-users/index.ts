import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CsvRow {
  [key: string]: string | number | null;
}

interface ProcessError {
  row: number;
  email: string;
  error: string;
}

const CATEGORY_PRIORITY = [
  'administracion',
  'comercial',
  'mercadotecnia',
  'operaciones',
  'sistemas',
];

const CATEGORY_LABELS: Record<string, string> = {
  administracion: 'Administración',
  comercial: 'Comercial',
  mercadotecnia: 'Mercadotecnia',
  operaciones: 'Operaciones',
  sistemas: 'Sistemas',
};

function normalizeCategory(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getCategoryLabel(value: string | null | undefined) {
  if (!value || !value.trim()) return 'Sin categoría';
  const key = normalizeCategory(value);
  return CATEGORY_LABELS[key] || value.trim();
}

function parseCSV(csvText: string): CsvRow[] {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;

  const normalizedText = csvText.replace(/^\uFEFF/, '');

  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    const nextChar = normalizedText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentLine += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === '\n' && !insideQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else if (char === '\r' && nextChar === '\n' && !insideQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
      i++;
    } else {
      currentLine += char;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  function parseLine(line: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentValue += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    values.push(currentValue.trim());
    return values;
  }

  const headers = parseLine(lines[0]).map((header) => header.replace(/^\uFEFF/, '').trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: CsvRow = {};

    headers.forEach((header, index) => {
      const value = values[index] ?? '';
      if (value === '') {
        row[header] = null;
      } else if (!isNaN(Number(value)) && value !== '' && !value.includes('/') && !value.includes('-')) {
        row[header] = Number(value);
      } else {
        row[header] = value;
      }
    });

    rows.push(row);
  }

  return rows;
}

function normalizeHeaderLookup(row: CsvRow, key: string) {
  const exact = row[key];
  if (exact !== undefined && exact !== null) return exact;

  const found = Object.keys(row).find((header) => header.trim().toLowerCase() === key.trim().toLowerCase());
  if (!found) return null;
  const value = row[found];
  return value === undefined ? null : value;
}

function asString(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseBoolean(value: unknown, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
}

function parseNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(String(value).replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeRole(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'administrador') return 'Administrador';
  if (normalized === 'gerente') return 'Gerente';
  if (normalized === 'empleado') return 'Empleado';
  if (normalized === 'agente') return 'Agente';
  return value.trim();
}

function parseGroupIds(value: unknown) {
  const raw = asString(value);
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[|;,]/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function getOrderedCategories(groups: Array<{ id: string; nombre: string; area_categoria: string | null }>) {
  const grouped = new Map<string, typeof groups>();

  for (const group of groups) {
    const category = normalizeCategory(group.area_categoria);
    const bucketKey = category || '__sin_categoria__';
    const bucket = grouped.get(bucketKey) ?? [];
    bucket.push(group);
    grouped.set(bucketKey, bucket);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => {
      const aIdx = CATEGORY_PRIORITY.indexOf(a);
      const bIdx = CATEGORY_PRIORITY.indexOf(b);
      if (aIdx !== -1 || bIdx !== -1) {
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      }
      if (a === '__sin_categoria__') return 1;
      if (b === '__sin_categoria__') return -1;
      return getCategoryLabel(a).localeCompare(getCategoryLabel(b), 'es');
    })
    .map(([key, categoryGroups]) => ({
      key,
      label: key === '__sin_categoria__' ? 'Sin categoría' : getCategoryLabel(categoryGroups[0]?.area_categoria ?? key),
      ids: categoryGroups.map((group) => group.id),
    }));
}

function findRowValue(row: CsvRow, ...keys: string[]) {
  for (const key of keys) {
    const value = normalizeHeaderLookup(row, key);
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: currentUser } } = await supabase.auth.getUser(token);

    if (!currentUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: currentUserData } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', currentUser.id)
      .single();

    if (currentUserData?.rol !== 'Administrador') {
      return new Response(
        JSON.stringify({ error: 'Solo los administradores pueden ejecutar esta acción' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'No se recibió ningún archivo CSV' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const csvText = await file.text();
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'El archivo CSV está vacío o no contiene filas válidas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let success = 0;
    let failed = 0;
    const errors: ProcessError[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 2;
      const email = asString(findRowValue(row, 'email', 'email_laboral')).toLowerCase();
      const password = asString(findRowValue(row, 'password'));
      const nombre = asString(findRowValue(row, 'nombre'));
      const apellidos = asString(findRowValue(row, 'apellidos'));
      const rol = normalizeRole(asString(findRowValue(row, 'rol')));
      const oficinaNombre = asString(findRowValue(row, 'oficina_nombre'));

      try {
        if (!email || !password || !nombre || !apellidos || !rol || !oficinaNombre) {
          throw new Error('Faltan campos obligatorios: email, password, nombre, apellidos, rol u oficina_nombre');
        }

        const { data: oficina, error: oficinaError } = await supabase
          .from('oficinas')
          .select('id, nombre')
          .eq('nombre', oficinaNombre)
          .maybeSingle();

        let officeRecord = oficina;
        if (!officeRecord) {
          const { data: officeLike, error: officeLikeError } = await supabase
            .from('oficinas')
            .select('id, nombre')
            .ilike('nombre', oficinaNombre)
            .maybeSingle();

          if (officeLikeError) throw officeLikeError;
          officeRecord = officeLike;
        }

        if (oficinaError) throw oficinaError;
        if (!officeRecord) {
          throw new Error(`No se encontró la oficina "${oficinaNombre}"`);
        }

        const fechaNacimiento = asString(findRowValue(row, 'fecha_nacimiento')) || null;
        const fechaIngreso = asString(findRowValue(row, 'fecha_ingreso')) || null;
        const regimenFiscal = asString(findRowValue(row, 'regimen_fiscal')) || asString(findRowValue(row, 'regimen_fiscal_id')) || null;
        const selectedTramiteIds = parseGroupIds(findRowValue(row, 'tramite_group_ids'));
        const planMktPremium = parseBoolean(findRowValue(row, 'plan_mkt_premium'), false);
        const segurosExpressHabilitado = parseBoolean(findRowValue(row, 'seguros_express_habilitado'), false);
        const diasVacaciones = parseNumber(findRowValue(row, 'dias_vacaciones_disponibles'), 0);
        const activo = parseBoolean(findRowValue(row, 'activo'), true);
        const estado = asString(findRowValue(row, 'estado')).toLowerCase() || (activo ? 'activo' : 'pendiente');
        const webSlug = asString(findRowValue(row, 'url_web_jiro', 'web_slug'));
        const webMulticotizador = asString(findRowValue(row, 'url_web_multicotizador'));
        const logoUrl = asString(findRowValue(row, 'mi_logotipo_url'));
        const userId = crypto.randomUUID();

        const insertData: Record<string, unknown> = {
          id: userId,
          rol: rol as 'Administrador' | 'Gerente' | 'Empleado' | 'Agente',
          nombre,
          apellidos,
          email_laboral: email,
          puesto: asString(findRowValue(row, 'puesto')),
          oficina_id: officeRecord.id,
          fecha_nacimiento: fechaNacimiento || null,
          fecha_ingreso: fechaIngreso || null,
          celular_personal: asString(findRowValue(row, 'celular_personal')),
          email_personal: asString(findRowValue(row, 'email_personal')),
          celular_laboral: asString(findRowValue(row, 'celular_laboral')),
          extension_telefonica: asString(findRowValue(row, 'extension_telefonica')),
          web_slug: webSlug || null,
          url_web_jiro: webSlug || null,
          url_web_multicotizador: webMulticotizador || null,
          regimen_fiscal_id: regimenFiscal,
          banco: asString(findRowValue(row, 'banco')),
          clabe: asString(findRowValue(row, 'clabe')),
          dias_vacaciones_disponibles: diasVacaciones,
          equipo_computo: asString(findRowValue(row, 'equipo_computo')) || null,
          equipo_celular: asString(findRowValue(row, 'equipo_celular')) || null,
          mi_logotipo_url: logoUrl || null,
          plan_mkt_premium: planMktPremium,
          seguros_express_habilitado: segurosExpressHabilitado,
          ubicacion_lat: null,
          ubicacion_lng: null,
          ubicacion_direccion_manual: null,
          ubicacion_metodo: null,
          activo,
          estado,
        };

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (authError || !authData.user) {
          throw new Error(`Error en autenticación: ${authError?.message || 'no se pudo crear el usuario'}`);
        }

        const authUserId = authData.user.id;

        const { error: insertError } = await supabase
          .from('usuarios')
          .insert({
            ...insertData,
            id: authUserId,
          } as any);

        if (insertError) {
          await supabase.auth.admin.deleteUser(authUserId);
          throw new Error(`Error al insertar usuario: ${insertError.message}`);
        }

        if (rol === 'Agente') {
          const { data: activeGroups, error: groupsError } = await supabase
            .from('tramites_grupos_visualizacion')
            .select('id, area_categoria, nombre')
            .eq('activo', true);

          if (groupsError) {
            await supabase.from('usuarios').delete().eq('id', authUserId);
            await supabase.auth.admin.deleteUser(authUserId);
            throw new Error(`No se pudieron validar los equipos de trámite: ${groupsError.message}`);
          }

          const activeList = activeGroups ?? [];
          const orderedCategories = getOrderedCategories(activeList);
          const selectedSet = new Set(selectedTramiteIds);
          const selectedActiveIds = selectedTramiteIds.filter((id) => activeList.some((group) => group.id === id));

          const missingCategories = orderedCategories
            .filter((category) => !category.ids.some((id) => selectedSet.has(id)))
            .map((category) => category.label);

          if (missingCategories.length > 0) {
            await supabase.from('usuarios').delete().eq('id', authUserId);
            await supabase.auth.admin.deleteUser(authUserId);
            throw new Error(`El agente debe tener al menos un equipo en cada categoría activa: ${missingCategories.join(', ')}`);
          }

          if (selectedActiveIds.length !== selectedTramiteIds.length) {
            await supabase.from('usuarios').delete().eq('id', authUserId);
            await supabase.auth.admin.deleteUser(authUserId);
            throw new Error('Uno o más equipos seleccionados no están activos');
          }

          const memberships = selectedTramiteIds.map((grupoId) => ({
            grupo_id: grupoId,
            usuario_id: authUserId,
          }));

          const { error: membershipError } = await supabase
            .from('tramites_grupos_miembros')
            .insert(memberships);

          if (membershipError) {
            await supabase.from('usuarios').delete().eq('id', authUserId);
            await supabase.auth.admin.deleteUser(authUserId);
            throw new Error(`No se pudieron guardar los equipos de trámite: ${membershipError.message}`);
          }
        }

        if (estado === 'activo') {
          try {
            let nombreOficina = officeRecord.nombre;

            const { error: notifError } = await supabase.rpc('enviar_notificacion_completa', {
              p_tipo_codigo: 'cuenta_activada',
              p_user_id: authUserId,
              p_titulo: '¡Bienvenido a MOVI Digital!',
              p_mensaje: 'Tu cuenta ha sido activada exitosamente. Explora todas las funcionalidades de la plataforma.',
              p_modulo: 'usuarios',
              p_datos_adicionales: {
                email_laboral: email,
                rol,
                oficina: nombreOficina,
                pagina_web: webSlug ? `https://agentedeseguros.website/${webSlug}` : 'No configurada aún',
                puesto: asString(findRowValue(row, 'puesto')),
              },
              p_accion_url: '/dashboard',
            });

            if (notifError) {
              console.error('[bulk-create-users] Error al enviar notificaciones:', notifError);
            }
          } catch (notifError) {
            console.error('[bulk-create-users] Error al enviar notificaciones:', notifError);
          }
        }

        success++;
      } catch (error: any) {
        failed++;
        errors.push({
          row: rowNumber,
          email,
          error: error?.message || 'Error desconocido',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success,
        failed,
        errors,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message || 'Error desconocido al procesar el archivo',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
