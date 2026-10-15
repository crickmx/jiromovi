-- Adjunto categorías: agregar columna orden + expandir catálogo
-- Fix: TramiteArchivos.tsx consultaba columna orden que no existía → dropdown vacío.

-- 1. Agregar columna orden
ALTER TABLE public.maestro_adjunto_categorias
  ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0;

-- 2. Asignar orden a las 5 categorías iniciales
UPDATE public.maestro_adjunto_categorias SET orden = 1  WHERE nombre = 'Póliza';
UPDATE public.maestro_adjunto_categorias SET orden = 7  WHERE nombre = 'Comprobante pago';
UPDATE public.maestro_adjunto_categorias SET orden = 13 WHERE nombre = 'Identificación';
UPDATE public.maestro_adjunto_categorias SET orden = 24 WHERE nombre = 'Nota interna';
UPDATE public.maestro_adjunto_categorias SET orden = 25 WHERE nombre = 'Otro';

-- 3. Agregar restricción unique en nombre para upserts futuros (idempotente)
DO $$ BEGIN
  ALTER TABLE public.maestro_adjunto_categorias
    ADD CONSTRAINT maestro_adjunto_categorias_nombre_key UNIQUE (nombre);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Insertar categorías adicionales
INSERT INTO public.maestro_adjunto_categorias (nombre, descripcion, orden) VALUES
  ('Carátula de Póliza',      'Carátula o resumen ejecutivo de la póliza',                    2),
  ('Endoso',                  'Modificación, adición o cláusula adicional a la póliza',       3),
  ('Cotización',              'Propuesta económica al cliente',                                4),
  ('Solicitud de seguro',     'Formulario de solicitud firmado por el cliente',               5),
  ('Recibo de prima',         'Recibo oficial de pago de prima',                              6),
  ('Factura',                 'Factura del bien asegurado o del servicio',                    8),
  ('Estado de cuenta',        'Estado de cuenta bancario',                                    9),
  ('Cambio de Conducto',      'Documento de cambio de conducto de cobro',                    10),
  ('Carta de cancelación',    'Solicitud o confirmación de cancelación de póliza',           11),
  ('Comprobante de domicilio','CFE, agua, teléfono u otro comprobante de domicilio',         12),
  ('CURP',                    'Clave Única de Registro de Población',                        14),
  ('RFC / Constancia fiscal', 'Registro Federal de Contribuyentes o constancia del SAT',    15),
  ('Acta de nacimiento',      'Acta de nacimiento del asegurado o beneficiario',             16),
  ('Acta de matrimonio',      'Acta de matrimonio',                                          17),
  ('Dictamen médico',         'Resultado, dictamen o historial clínico',                     18),
  ('Siniestro',               'Reporte o declaración de siniestro',                          19),
  ('Peritaje / Avalúo',       'Documento de valuación o dictamen de daños',                 20),
  ('Evidencia fotográfica',   'Fotos de siniestro, bien asegurado o proceso',               21),
  ('Carta de reclamación',    'Documento formal de reclamación ante la aseguradora',         22),
  ('Contrato',                'Contrato adicional relacionado al trámite',                   23)
ON CONFLICT (nombre) DO NOTHING;
