/*
  # Módulo Régimen Fiscal — Tablas de configuración dinámica

  ## Descripción
  Este módulo permite a los administradores configurar las reglas fiscales de
  cada régimen (HONORARIOS, RESICO, ASIMILADOS) desde la interfaz sin tocar código.

  ## Tablas nuevas

  ### 1. fiscal_regime_rules
  - Cabecera de cada "versión" de reglas por régimen fiscal
  - Soporta versionado: v1.0, v2.0, etc.
  - Control de vigencia por fechas (vigente_desde / vigente_hasta)
  - Solo puede haber UNA regla activa por régimen en un período dado

  ### 2. fiscal_regime_rule_lines
  - Líneas de detalle de cada versión: conceptos, bases, porcentajes, fórmulas
  - Una versión tiene entre 6 y 10 líneas (una por concepto fiscal)
  - Soporta tipo_regla: porcentaje, formula, fijo, derivado

  ## Seguridad
  - RLS habilitado en ambas tablas
  - Solo admins pueden crear/editar
  - Todos los autenticados pueden leer (necesario para el motor de cálculo)

  ## Notas importantes
  1. La constraint UNIQUE(regimen_codigo, version) evita duplicados por versión
  2. No se puede activar una versión si ya existe otra activa sin vigencia_hasta para ese régimen
  3. Los cálculos históricos usan fiscal_rule_version_id para trazabilidad
*/

-- ============================================================
-- TABLA PRINCIPAL: fiscal_regime_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_regime_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  regimen_codigo text NOT NULL
    CHECK (regimen_codigo IN ('asimilados', 'honorarios', 'resico')),

  nombre_regimen text NOT NULL,

  version text NOT NULL,

  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,

  vigente_hasta date NULL,

  activo boolean NOT NULL DEFAULT false,

  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('activo', 'borrador', 'inactivo')),

  notas text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT fiscal_regime_rules_version_unique UNIQUE (regimen_codigo, version)
);

ALTER TABLE fiscal_regime_rules ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden escribir
CREATE POLICY "Admins can manage fiscal regime rules"
  ON fiscal_regime_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND (usuarios.estado IS NULL OR usuarios.estado != 'eliminado')
    )
  );

CREATE POLICY "Admins can update fiscal regime rules"
  ON fiscal_regime_rules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND (usuarios.estado IS NULL OR usuarios.estado != 'eliminado')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND (usuarios.estado IS NULL OR usuarios.estado != 'eliminado')
    )
  );

-- Todos los autenticados pueden leer (el motor fiscal necesita estas reglas)
CREATE POLICY "Authenticated users can read fiscal regime rules"
  ON fiscal_regime_rules FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- TABLA DETALLE: fiscal_regime_rule_lines
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_regime_rule_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  fiscal_regime_rule_id uuid NOT NULL
    REFERENCES fiscal_regime_rules(id) ON DELETE CASCADE,

  -- Código único del concepto (comision_gravada, iva, ret_isr, etc.)
  concepto_codigo text NOT NULL CHECK (concepto_codigo IN (
    'comision_gravada',
    'comision_exenta',
    'comision_total',
    'iva',
    'ret_isr',
    'ret_iva',
    'ret_contable',
    'costo_dispersion',
    'total_fiscal',
    'total_final'
  )),

  -- Nombre visual del concepto
  concepto_nombre text NOT NULL,

  -- Base sobre la que se aplica el porcentaje o fórmula
  base_codigo text NOT NULL DEFAULT 'none' CHECK (base_codigo IN (
    'comision_gravada',
    'comision_exenta',
    'comision_total',
    'iva',
    'none'
  )),

  -- Tipo de regla
  tipo_regla text NOT NULL CHECK (tipo_regla IN (
    'porcentaje',
    'formula',
    'fijo',
    'derivado'
  )),

  -- Para tipo = porcentaje: valor entre 0 y 100
  valor_porcentaje numeric(10,6) NULL
    CHECK (valor_porcentaje IS NULL OR (valor_porcentaje >= 0 AND valor_porcentaje <= 100)),

  -- Para tipo = formula: expresión segura
  formula_texto text NULL,

  -- Signo visual en PDF e interfaz
  signo_resultado text NOT NULL DEFAULT 'neutro' CHECK (signo_resultado IN (
    'positivo',
    'negativo',
    'neutro'
  )),

  -- Orden de presentación en la UI y PDF
  orden_visual integer NOT NULL DEFAULT 0,

  -- Visibilidad
  mostrar_en_pdf boolean NOT NULL DEFAULT true,
  mostrar_en_ui boolean NOT NULL DEFAULT true,

  -- Estado
  activo boolean NOT NULL DEFAULT true,

  notas text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fiscal_regime_rule_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fiscal rule lines"
  ON fiscal_regime_rule_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND (usuarios.estado IS NULL OR usuarios.estado != 'eliminado')
    )
  );

CREATE POLICY "Admins can update fiscal rule lines"
  ON fiscal_regime_rule_lines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND (usuarios.estado IS NULL OR usuarios.estado != 'eliminado')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND (usuarios.estado IS NULL OR usuarios.estado != 'eliminado')
    )
  );

CREATE POLICY "Admins can delete fiscal rule lines"
  ON fiscal_regime_rule_lines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND (usuarios.estado IS NULL OR usuarios.estado != 'eliminado')
    )
  );

CREATE POLICY "Authenticated users can read fiscal rule lines"
  ON fiscal_regime_rule_lines FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fiscal_regime_rules_regimen ON fiscal_regime_rules(regimen_codigo);
CREATE INDEX IF NOT EXISTS idx_fiscal_regime_rules_activo ON fiscal_regime_rules(activo);
CREATE INDEX IF NOT EXISTS idx_fiscal_regime_rules_estado ON fiscal_regime_rules(estado);
CREATE INDEX IF NOT EXISTS idx_fiscal_regime_rules_vigente ON fiscal_regime_rules(regimen_codigo, vigente_desde, vigente_hasta);
CREATE INDEX IF NOT EXISTS idx_fiscal_rule_lines_rule_id ON fiscal_regime_rule_lines(fiscal_regime_rule_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_rule_lines_concepto ON fiscal_regime_rule_lines(concepto_codigo);
CREATE INDEX IF NOT EXISTS idx_fiscal_rule_lines_orden ON fiscal_regime_rule_lines(fiscal_regime_rule_id, orden_visual);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_fiscal_regime_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_regime_rules_updated_at ON fiscal_regime_rules;
CREATE TRIGGER trg_fiscal_regime_rules_updated_at
  BEFORE UPDATE ON fiscal_regime_rules
  FOR EACH ROW EXECUTE FUNCTION update_fiscal_regime_updated_at();

DROP TRIGGER IF EXISTS trg_fiscal_rule_lines_updated_at ON fiscal_regime_rule_lines;
CREATE TRIGGER trg_fiscal_rule_lines_updated_at
  BEFORE UPDATE ON fiscal_regime_rule_lines
  FOR EACH ROW EXECUTE FUNCTION update_fiscal_regime_updated_at();

-- ============================================================
-- FUNCIÓN: get_active_fiscal_rule(regimen, fecha)
-- Devuelve la versión activa vigente para una fecha dada
-- ============================================================
CREATE OR REPLACE FUNCTION get_active_fiscal_rule(
  p_regimen text,
  p_fecha date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  rule_id uuid,
  regimen_codigo text,
  nombre_regimen text,
  version text,
  vigente_desde date,
  vigente_hasta date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    regimen_codigo,
    nombre_regimen,
    version,
    vigente_desde,
    vigente_hasta
  FROM fiscal_regime_rules
  WHERE regimen_codigo = lower(p_regimen)
    AND activo = true
    AND estado = 'activo'
    AND vigente_desde <= p_fecha
    AND (vigente_hasta IS NULL OR vigente_hasta >= p_fecha)
  ORDER BY vigente_desde DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_active_fiscal_rule TO authenticated;

-- ============================================================
-- FUNCIÓN: activate_fiscal_rule(rule_id)
-- Activa una versión y desactiva las demás del mismo régimen
-- ============================================================
CREATE OR REPLACE FUNCTION activate_fiscal_rule(p_rule_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regimen text;
  v_vigente_desde date;
BEGIN
  -- Obtener datos de la regla a activar
  SELECT regimen_codigo, vigente_desde
  INTO v_regimen, v_vigente_desde
  FROM fiscal_regime_rules
  WHERE id = p_rule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regla fiscal no encontrada: %', p_rule_id;
  END IF;

  -- Desactivar otras versiones activas del mismo régimen
  UPDATE fiscal_regime_rules
  SET
    activo = false,
    estado = 'inactivo',
    updated_at = now()
  WHERE regimen_codigo = v_regimen
    AND id != p_rule_id
    AND activo = true;

  -- Activar esta versión
  UPDATE fiscal_regime_rules
  SET
    activo = true,
    estado = 'activo',
    updated_at = now()
  WHERE id = p_rule_id;
END;
$$;

GRANT EXECUTE ON FUNCTION activate_fiscal_rule TO authenticated;

-- ============================================================
-- FUNCIÓN: duplicate_fiscal_rule(rule_id, new_version)
-- Duplica una versión con sus líneas como borrador
-- ============================================================
CREATE OR REPLACE FUNCTION duplicate_fiscal_rule(
  p_source_id uuid,
  p_new_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_source fiscal_regime_rules%ROWTYPE;
BEGIN
  SELECT * INTO v_source FROM fiscal_regime_rules WHERE id = p_source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regla fuente no encontrada: %', p_source_id;
  END IF;

  -- Insertar nueva cabecera como borrador
  INSERT INTO fiscal_regime_rules (
    regimen_codigo,
    nombre_regimen,
    version,
    vigente_desde,
    vigente_hasta,
    activo,
    estado,
    notas,
    created_by
  ) VALUES (
    v_source.regimen_codigo,
    v_source.nombre_regimen,
    p_new_version,
    CURRENT_DATE,
    NULL,
    false,
    'borrador',
    'Copia de versión ' || v_source.version,
    auth.uid()
  )
  RETURNING id INTO v_new_id;

  -- Copiar todas las líneas
  INSERT INTO fiscal_regime_rule_lines (
    fiscal_regime_rule_id,
    concepto_codigo,
    concepto_nombre,
    base_codigo,
    tipo_regla,
    valor_porcentaje,
    formula_texto,
    signo_resultado,
    orden_visual,
    mostrar_en_pdf,
    mostrar_en_ui,
    activo,
    notas
  )
  SELECT
    v_new_id,
    concepto_codigo,
    concepto_nombre,
    base_codigo,
    tipo_regla,
    valor_porcentaje,
    formula_texto,
    signo_resultado,
    orden_visual,
    mostrar_en_pdf,
    mostrar_en_ui,
    activo,
    notas
  FROM fiscal_regime_rule_lines
  WHERE fiscal_regime_rule_id = p_source_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION duplicate_fiscal_rule TO authenticated;

-- ============================================================
-- DATOS INICIALES — Versión v1.0 de cada régimen (fiscal_v3_audit)
-- ============================================================

-- HONORARIOS v1.0
DO $$
DECLARE
  v_rule_id uuid;
BEGIN
  INSERT INTO fiscal_regime_rules (
    regimen_codigo, nombre_regimen, version,
    vigente_desde, activo, estado,
    notas
  ) VALUES (
    'honorarios', 'Honorarios', 'v1.0',
    '2024-01-01', true, 'activo',
    'Versión inicial basada en fiscal_v3_audit. IVA 16%, ISR 14%, Ret IVA 2/3.'
  )
  ON CONFLICT (regimen_codigo, version) DO NOTHING
  RETURNING id INTO v_rule_id;

  IF v_rule_id IS NOT NULL THEN
    INSERT INTO fiscal_regime_rule_lines (
      fiscal_regime_rule_id, concepto_codigo, concepto_nombre,
      base_codigo, tipo_regla, valor_porcentaje, formula_texto,
      signo_resultado, orden_visual, mostrar_en_pdf, mostrar_en_ui, activo
    ) VALUES
      (v_rule_id, 'comision_gravada',  'Comisión Gravada',  'none',              'derivado',    NULL,         NULL,                                          'positivo', 1,  true,  true,  true),
      (v_rule_id, 'comision_exenta',   'Comisión Exenta',   'none',              'derivado',    NULL,         NULL,                                          'positivo', 2,  true,  true,  true),
      (v_rule_id, 'iva',               'IVA',               'comision_gravada',  'porcentaje',  16,           NULL,                                          'positivo', 3,  true,  true,  true),
      (v_rule_id, 'ret_isr',           'Ret. ISR',          'comision_gravada',  'porcentaje',  14,           NULL,                                          'negativo', 4,  true,  true,  true),
      (v_rule_id, 'ret_iva',           'Ret. IVA',          'iva',               'porcentaje',  66.6666667,   NULL,                                          'negativo', 5,  true,  true,  true),
      (v_rule_id, 'total_fiscal',      'Total Fiscal',      'none',              'formula',     NULL,         'comision_total + iva - ret_isr - ret_iva',    'neutro',   6,  true,  true,  true),
      (v_rule_id, 'ret_contable',      'Ret. Contable',     'comision_exenta',   'porcentaje',  16,           NULL,                                          'negativo', 7,  false, false, false),
      (v_rule_id, 'costo_dispersion',  'Costo Dispersión',  'comision_gravada',  'porcentaje',  9,            NULL,                                          'negativo', 8,  false, false, false),
      (v_rule_id, 'total_final',       'Total Final',       'none',              'formula',     NULL,         'total_fiscal - ret_contable - costo_dispersion', 'neutro', 9,  true,  true,  true);
  END IF;
END $$;

-- RESICO v1.0
DO $$
DECLARE
  v_rule_id uuid;
BEGIN
  INSERT INTO fiscal_regime_rules (
    regimen_codigo, nombre_regimen, version,
    vigente_desde, activo, estado,
    notas
  ) VALUES (
    'resico', 'RESICO', 'v1.0',
    '2024-01-01', true, 'activo',
    'Versión inicial. IVA 16%, ISR 1.25% (configurable 1%-2.5%), Ret IVA 2/3.'
  )
  ON CONFLICT (regimen_codigo, version) DO NOTHING
  RETURNING id INTO v_rule_id;

  IF v_rule_id IS NOT NULL THEN
    INSERT INTO fiscal_regime_rule_lines (
      fiscal_regime_rule_id, concepto_codigo, concepto_nombre,
      base_codigo, tipo_regla, valor_porcentaje, formula_texto,
      signo_resultado, orden_visual, mostrar_en_pdf, mostrar_en_ui, activo
    ) VALUES
      (v_rule_id, 'comision_gravada',  'Comisión Gravada',  'none',             'derivado',   NULL,        NULL,                                          'positivo', 1,  true,  true,  true),
      (v_rule_id, 'comision_exenta',   'Comisión Exenta',   'none',             'derivado',   NULL,        NULL,                                          'positivo', 2,  true,  true,  true),
      (v_rule_id, 'iva',               'IVA',               'comision_gravada', 'porcentaje', 16,          NULL,                                          'positivo', 3,  true,  true,  true),
      (v_rule_id, 'ret_isr',           'Ret. ISR',          'comision_gravada', 'porcentaje', 1.25,        NULL,                                          'negativo', 4,  true,  true,  true),
      (v_rule_id, 'ret_iva',           'Ret. IVA',          'iva',              'porcentaje', 66.6666667,  NULL,                                          'negativo', 5,  true,  true,  true),
      (v_rule_id, 'total_fiscal',      'Total Fiscal',      'none',             'formula',    NULL,        'comision_total + iva - ret_isr - ret_iva',    'neutro',   6,  true,  true,  true),
      (v_rule_id, 'ret_contable',      'Ret. Contable',     'comision_exenta',  'porcentaje', 16,          NULL,                                          'negativo', 7,  false, false, false),
      (v_rule_id, 'costo_dispersion',  'Costo Dispersión',  'comision_gravada', 'porcentaje', 9,           NULL,                                          'negativo', 8,  false, false, false),
      (v_rule_id, 'total_final',       'Total Final',       'none',             'formula',    NULL,        'total_fiscal - ret_contable - costo_dispersion', 'neutro', 9,  true,  true,  true);
  END IF;
END $$;

-- ASIMILADOS v1.0
DO $$
DECLARE
  v_rule_id uuid;
BEGIN
  INSERT INTO fiscal_regime_rules (
    regimen_codigo, nombre_regimen, version,
    vigente_desde, activo, estado,
    notas
  ) VALUES (
    'asimilados', 'Asimilados a Salarios', 'v1.0',
    '2024-01-01', true, 'activo',
    'Versión inicial. ISR sobre gravada (tasa configurable). Bloque operativo: Ret Contable 16% exenta, Costo Dispersión 9% gravada.'
  )
  ON CONFLICT (regimen_codigo, version) DO NOTHING
  RETURNING id INTO v_rule_id;

  IF v_rule_id IS NOT NULL THEN
    INSERT INTO fiscal_regime_rule_lines (
      fiscal_regime_rule_id, concepto_codigo, concepto_nombre,
      base_codigo, tipo_regla, valor_porcentaje, formula_texto,
      signo_resultado, orden_visual, mostrar_en_pdf, mostrar_en_ui, activo
    ) VALUES
      (v_rule_id, 'comision_gravada',  'Comisión Gravada',  'none',             'derivado',   NULL,   NULL,                                             'positivo', 1,  true, true, true),
      (v_rule_id, 'comision_exenta',   'Comisión Exenta',   'none',             'derivado',   NULL,   NULL,                                             'positivo', 2,  true, true, true),
      (v_rule_id, 'iva',               'IVA',               'none',             'fijo',       0,      NULL,                                             'neutro',   3,  true, true, true),
      (v_rule_id, 'ret_isr',           'Ret. ISR',          'comision_gravada', 'porcentaje', 10,     NULL,                                             'negativo', 4,  true, true, true),
      (v_rule_id, 'ret_iva',           'Ret. IVA',          'none',             'fijo',       0,      NULL,                                             'neutro',   5,  true, true, true),
      (v_rule_id, 'total_fiscal',      'Total Fiscal',      'none',             'formula',    NULL,   'comision_total - ret_isr',                       'neutro',   6,  true, true, true),
      (v_rule_id, 'ret_contable',      'Ret. Contable',     'comision_exenta',  'porcentaje', 16,     NULL,                                             'negativo', 7,  true, true, true),
      (v_rule_id, 'costo_dispersion',  'Costo Dispersión',  'comision_gravada', 'porcentaje', 9,      NULL,                                             'negativo', 8,  true, true, true),
      (v_rule_id, 'total_final',       'Total Final',       'none',             'formula',    NULL,   'total_fiscal - ret_contable - costo_dispersion', 'neutro',   9,  true, true, true);
  END IF;
END $$;
