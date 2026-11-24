/*
  # Add nombre_publico field to usuarios

  1. Schema Change
    - `usuarios.nombre_publico` (text, nullable): Editable display name used in Mi Página Web,
      Publicidad and user-generated documents (cotizaciones PDFs, plantillas).
      When null or empty, consumers should fall back to `nombre_completo`
      (or `nombre || ' ' || apellidos`).

  2. Behavior
    - This field is independent from `nombre` and `apellidos` — editing it does NOT change
      the user's legal/system name in their profile.

  3. Security
    - RLS policies on usuarios already cover this column via existing SELECT/UPDATE policies.
      No new policies required.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
      AND column_name = 'nombre_publico'
  ) THEN
    ALTER TABLE public.usuarios ADD COLUMN nombre_publico text;
    COMMENT ON COLUMN public.usuarios.nombre_publico IS
      'Nombre editable para visualización en Mi Página Web, Publicidad y documentos generados por el usuario. No afecta nombre ni apellidos.';
  END IF;
END $$;
