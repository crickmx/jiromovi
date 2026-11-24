/*
  # Usuario "Sistema" para trámites creados automáticamente

  `tickets.creado_por` es NOT NULL, pero los trámites que genera el motor de
  recurrencias no tienen un creador humano. Para no violar la restricción,
  `ejecutar_recurrencias()` agarra al Administrador/Gerente más antiguo de la
  base y lo pone como creador:

      SELECT id INTO v_system_user_id
        FROM usuarios WHERE rol IN ('Administrador','Gerente')
        ORDER BY created_at ASC LIMIT 1;

  Resultado: a una persona real le aparecen trámites que nunca creó, sin forma
  de distinguirlos de los suyos. Este archivo crea un usuario dedicado para eso.

  ── REQUISITO PREVIO (hay que hacerlo ANTES de correr este archivo) ──────────
  `usuarios.id` es FK a `auth.users(id)`, así que la fila necesita una cuenta de
  autenticación detrás. En este repo los usuarios se crean por el Admin API,
  nunca por SQL, y no hay precedente de insertar en `auth.users` a mano — el
  esquema de esa tabla cambia entre versiones de Supabase y romperlo deja el
  login inservible. Así que la cuenta se crea por el camino soportado:

      Supabase → Authentication → Users → Add user
        Email:    sistema@movi.digital
        Password: una contraseña aleatoria larga (no hay que guardarla:
                  la cuenta queda inactiva y nadie va a iniciar sesión con ella)
        Auto Confirm User: sí

  Si la cuenta no existe, este archivo no hace nada y avisa con un NOTICE.
  Es idempotente: se puede correr las veces que haga falta.
*/

DO $$
DECLARE
  v_auth_id uuid;
BEGIN
  SELECT id INTO v_auth_id FROM auth.users WHERE email = 'sistema@movi.digital';

  IF v_auth_id IS NULL THEN
    RAISE NOTICE 'No existe la cuenta auth sistema@movi.digital; no se creó el usuario Sistema. Créala en Authentication → Users → Add user y re-corre este archivo.';
    RETURN;
  END IF;

  -- nombre_completo es GENERATED ALWAYS (nombre || ' ' || apellidos) → no se inserta.
  -- activo = false lo mantiene fuera de los selectores de usuario de la app.
  INSERT INTO public.usuarios (id, username, rol, nombre, apellidos, puesto, activo)
  VALUES (v_auth_id, 'sistema', 'Empleado', 'Sistema', 'MOVI', 'Automatizaciones', false)
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        nombre   = EXCLUDED.nombre,
        apellidos= EXCLUDED.apellidos,
        puesto   = EXCLUDED.puesto,
        activo   = false;

  -- Reasignar los trámites que ya se crearon con el creador equivocado. Solo se
  -- tocan los que vienen de una recurrencia (`recurrencia_id IS NOT NULL`): esos
  -- nunca tuvieron un creador humano. Los trámites levantados a mano no se tocan.
  UPDATE public.tickets
     SET creado_por = v_auth_id
   WHERE recurrencia_id IS NOT NULL
     AND creado_por <> v_auth_id;

  RAISE NOTICE 'Usuario Sistema listo (%). Trámites de recurrencia reasignados.', v_auth_id;
END $$;
