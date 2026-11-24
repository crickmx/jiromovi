/*
  # Fix seguwallet notification module case to match UI conventions

  1. Changes
    - Updates modulo field from 'seguwallet' to 'SEGUWALLET' for consistency
      with all other modules that use uppercase (AUTH, COMISIONES, CRM, etc.)
    - This makes seguwallet notifications visible in the TiposNotificaciones UI
*/

UPDATE correo_tipos_notificacion
SET modulo = 'SEGUWALLET'
WHERE modulo = 'seguwallet';
