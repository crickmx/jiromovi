/*
  # Agregar "registro_actividad" y "solicitud_comisiones_pendientes" a tipos de trámite

  1. Cambios
    - Elimina el constraint actual de tipo_tramite
    - Crea nuevo constraint que incluye todos los tipos:
      - correccion_poliza_registrada
      - correccion_comisiones
      - registro_poliza
      - solicitud_comisiones_pendientes
      - lead_registro_movi
      - registro_actividad (NUEVO)

  2. Contexto
    - El constraint actual no incluye "registro_actividad"
    - Esto permite crear tickets de registro de actividades para control de cotizaciones, emisiones, etc.
    - Solo disponible para Empleado, Gerente y Administrador (controlado en frontend)
*/

-- 1. Eliminar el constraint existente
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_tipo_tramite_check;

-- 2. Crear nuevo constraint con todos los tipos
ALTER TABLE tickets ADD CONSTRAINT tickets_tipo_tramite_check
  CHECK (tipo_tramite IN (
    'correccion_poliza_registrada',
    'correccion_comisiones',
    'registro_poliza',
    'solicitud_comisiones_pendientes',
    'lead_registro_movi',
    'registro_actividad'
  ));

COMMENT ON CONSTRAINT tickets_tipo_tramite_check ON tickets IS
  'Constraint actualizado para incluir todos los tipos de trámite, incluyendo registro_actividad';
