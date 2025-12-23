/*
  # Fix: Deshabilitar trigger automático de sincronización

  1. Problema
    - El trigger on_auth_user_created intenta insertar automáticamente en usuarios
    - No tiene los campos obligatorios nombre y apellidos
    - Entra en conflicto con el Edge Function create-user que hace el insert manualmente

  2. Solución
    - Eliminar el trigger on_auth_user_created
    - Mantener la función para uso futuro si es necesario
    - El Edge Function create-user maneja correctamente la creación completa del usuario
*/

-- Eliminar el trigger problemático
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Comentar: La función handle_new_auth_user() se mantiene por si se necesita en el futuro
-- pero no se ejecutará automáticamente