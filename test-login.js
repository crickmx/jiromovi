import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://akkbisolbjkusbuihrad.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra2Jpc29sYmprdXNidWlocmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzkwNDAsImV4cCI6MjA3NjY1NTA0MH0.iJf04oJv0ERuyWyY0gLpd7ntP6bITJ8LWxGFKJNSLvQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLogin(email, password) {
  console.log('\n🔐 Probando login para:', email);
  console.log('='.repeat(60));

  try {
    // Paso 1: Intentar login
    console.log('\n[1/3] Intentando autenticación...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error('❌ ERROR EN AUTENTICACIÓN:', authError.message);
      console.error('   Status:', authError.status);
      console.error('   Code:', authError.code);
      return false;
    }

    console.log('✅ Autenticación exitosa');
    console.log('   User ID:', authData.user.id);
    console.log('   Email:', authData.user.email);

    // Paso 2: Verificar que el usuario existe en la tabla usuarios
    console.log('\n[2/3] Verificando usuario en tabla usuarios...');
    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (usuarioError) {
      console.error('❌ ERROR AL BUSCAR USUARIO:', usuarioError.message);
      console.error('   Code:', usuarioError.code);
      console.error('   Details:', usuarioError.details);
      console.error('   Hint:', usuarioError.hint);
      return false;
    }

    if (!usuario) {
      console.error('❌ USUARIO NO ENCONTRADO en tabla usuarios');
      console.error('   User ID buscado:', authData.user.id);
      return false;
    }

    console.log('✅ Usuario encontrado en tabla usuarios');
    console.log('   Nombre:', usuario.nombre, usuario.apellidos);
    console.log('   Email Laboral:', usuario.email_laboral);
    console.log('   Rol:', usuario.rol);
    console.log('   Activo:', usuario.activo);
    console.log('   Estado:', usuario.estado);

    // Paso 3: Verificar que esté activo
    console.log('\n[3/3] Verificando estado activo...');
    if (!usuario.activo) {
      console.error('❌ USUARIO INACTIVO');
      return false;
    }

    if (usuario.estado !== 'activo') {
      console.error('❌ ESTADO NO ACTIVO:', usuario.estado);
      return false;
    }

    console.log('✅ Usuario está activo');

    console.log('\n✅ ¡LOGIN COMPLETAMENTE EXITOSO!');
    console.log('='.repeat(60));

    // Cerrar sesión para limpiar
    await supabase.auth.signOut();
    return true;

  } catch (error) {
    console.error('\n❌ ERROR INESPERADO:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

async function testAllUsers() {
  console.log('\n🧪 INICIANDO PRUEBAS DE LOGIN');
  console.log('='.repeat(60));

  const testUsers = [
    { email: 'ccjimenez@jiro.com.mx', description: 'Administrador' },
    { email: 'ccjimenez@jiro.mx', description: 'Gerente' },
    { email: 'zacatecas@jiro.mx', description: 'Empleado Zacatecas' },
    { email: 'pjimenez@jiro.mx', description: 'Empleado Pablo' },
  ];

  console.log('\n⚠️  NOTA: Necesitas proporcionar las contraseñas para probar');
  console.log('Uso: node test-login.js EMAIL PASSWORD\n');

  if (process.argv.length >= 4) {
    const email = process.argv[2];
    const password = process.argv[3];
    await testLogin(email, password);
  } else {
    console.log('Usuarios disponibles para probar:');
    testUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (${user.description})`);
    });
    console.log('\nEjemplo: node test-login.js ccjimenez@jiro.com.mx tu_contraseña');
  }
}

testAllUsers();
