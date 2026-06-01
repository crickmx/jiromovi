/*
  # Chava AI Access Tiers & Permissions System

  1. New Tables
    - `chava_access_tiers` - Defines the three access levels for Chava AI knowledge
      - `id` (text, primary key) - tier identifier (internal, external, public)
      - `nombre` (text) - human-readable name
      - `descripcion` (text) - description of what this tier can access
      - `solo_externo_filter` (boolean) - value passed to buscar_centro_digital_chunks
      - `max_tokens_respuesta` (integer) - max response tokens per query
      - `max_historial_mensajes` (integer) - conversation history depth
      - `max_consultas_sesion` (integer) - queries per session (null = unlimited)
      - `modelo_ia` (text) - AI model to use
      - `temperatura` (numeric) - AI temperature setting
      - `rag_similitud_minima` (numeric) - minimum similarity for RAG results
      - `max_fragmentos_rag` (integer) - max RAG chunks to include
      - `activo` (boolean) - whether this tier is active

  2. Seed Data
    - Three tiers: internal (MOVI users), external (Seguwallet customers), public (Chava Agente visitors)

  3. Security
    - RLS enabled
    - Read access for all authenticated users
    - Write access for admin role only

  4. Notes
    - This table serves as a centralized configuration for all Chava AI variants
    - Edge functions reference these tiers to determine access level and behavior
    - Changing values here affects all Chava instances without redeployment
*/

-- Create the access tiers configuration table
CREATE TABLE IF NOT EXISTS chava_access_tiers (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text,
  solo_externo_filter boolean NOT NULL DEFAULT true,
  max_tokens_respuesta integer NOT NULL DEFAULT 800,
  max_historial_mensajes integer NOT NULL DEFAULT 8,
  max_consultas_sesion integer,
  modelo_ia text NOT NULL DEFAULT 'gpt-4o-mini',
  temperatura numeric(3,2) NOT NULL DEFAULT 0.40,
  rag_similitud_minima numeric(4,3) NOT NULL DEFAULT 0.700,
  max_fragmentos_rag integer NOT NULL DEFAULT 5,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chava_access_tiers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read tiers (needed by edge functions)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chava_access_tiers' AND policyname = 'Authenticated users can read access tiers'
  ) THEN
    CREATE POLICY "Authenticated users can read access tiers"
      ON chava_access_tiers FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Only admins can modify tiers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chava_access_tiers' AND policyname = 'Admins can manage access tiers'
  ) THEN
    CREATE POLICY "Admins can manage access tiers"
      ON chava_access_tiers FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.rol = 'Administrador'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.rol = 'Administrador'
        )
      );
  END IF;
END $$;

-- Seed the three access tiers
INSERT INTO chava_access_tiers (id, nombre, descripcion, solo_externo_filter, max_tokens_respuesta, max_historial_mensajes, max_consultas_sesion, modelo_ia, temperatura, rag_similitud_minima, max_fragmentos_rag)
VALUES
  ('internal', 'MOVI Interno', 'Acceso completo para usuarios internos de MOVI Digital (Administradores, Gerentes, Ejecutivos, Agentes, Empleados). Acceden a TODA la base de conocimiento del Centro Digital donde enable_chava_ai=true.', false, 2500, 20, NULL, 'gpt-4o-mini', 0.70, 0.720, 5),
  ('external', 'Seguwallet Clientes', 'Acceso limitado para clientes de Seguwallet. Solo acceden a carpetas marcadas como external_chava_access=true. Respuestas enfocadas en sus polizas y servicios del agente.', true, 800, 8, NULL, 'gpt-4o-mini', 0.40, 0.700, 5),
  ('public', 'Chava Agente Publico', 'Acceso para visitantes de agentedeseguros.ai y usuarios registrados en Chava Agente. Solo acceden a contenido externo. Enfoque comercial y generacion de leads.', true, 1000, 8, 10, 'gpt-4o-mini', 0.35, 0.680, 6)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  solo_externo_filter = EXCLUDED.solo_externo_filter,
  max_tokens_respuesta = EXCLUDED.max_tokens_respuesta,
  max_historial_mensajes = EXCLUDED.max_historial_mensajes,
  max_consultas_sesion = EXCLUDED.max_consultas_sesion,
  modelo_ia = EXCLUDED.modelo_ia,
  temperatura = EXCLUDED.temperatura,
  rag_similitud_minima = EXCLUDED.rag_similitud_minima,
  max_fragmentos_rag = EXCLUDED.max_fragmentos_rag,
  updated_at = now();

-- Create helper function to get tier config by id
CREATE OR REPLACE FUNCTION get_chava_tier_config(tier_id text)
RETURNS TABLE (
  solo_externo_filter boolean,
  max_tokens_respuesta integer,
  max_historial_mensajes integer,
  max_consultas_sesion integer,
  modelo_ia text,
  temperatura numeric,
  rag_similitud_minima numeric,
  max_fragmentos_rag integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.solo_externo_filter,
    t.max_tokens_respuesta,
    t.max_historial_mensajes,
    t.max_consultas_sesion,
    t.modelo_ia,
    t.temperatura,
    t.rag_similitud_minima,
    t.max_fragmentos_rag
  FROM chava_access_tiers t
  WHERE t.id = tier_id AND t.activo = true;
$$;

-- Create view summarizing knowledge access per tier
CREATE OR REPLACE VIEW chava_knowledge_access_summary AS
SELECT
  t.id AS tier_id,
  t.nombre AS tier_nombre,
  COUNT(DISTINCT c.id) AS carpetas_accesibles,
  COUNT(DISTINCT a.id) AS archivos_accesibles,
  COUNT(DISTINCT ch.id) AS chunks_indexados
FROM chava_access_tiers t
LEFT JOIN centro_digital_carpetas c 
  ON c.activa = true 
  AND c.enable_chava_ai = true
  AND (NOT t.solo_externo_filter OR c.external_chava_access = true)
LEFT JOIN centro_digital_archivos a
  ON a.carpeta_id = c.id AND a.estado = 'activo'
LEFT JOIN centro_digital_chunks ch
  ON ch.carpeta_id = c.id
WHERE t.activo = true
GROUP BY t.id, t.nombre;
