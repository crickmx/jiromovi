import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export function Home() {
  const { usuario, signOut, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">MOVI Digital</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{usuario?.nombre_completo}</p>
                <p className="text-xs text-gray-500">{usuario?.rol}</p>
              </div>
              {usuario?.imagen_perfil_url && (
                <img
                  src={usuario.imagen_perfil_url}
                  alt="Perfil"
                  className="w-10 h-10 rounded-full object-cover border-2 border-blue-200"
                />
              )}
              <button
                onClick={signOut}
                className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Bienvenido, {usuario?.nombre}
          </h2>
          <p className="text-gray-600">Sistema de Gestión de Personal JIRO</p>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              to="/registro-personal"
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all p-6 border-l-4 border-blue-600"
            >
              <div className="flex items-center mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Registro de Personal</h3>
                  <p className="text-sm text-gray-600">Alta de nuevos empleados</p>
                </div>
              </div>
              <p className="text-gray-700">
                Registra nuevos empleados internos de JIRO con todos sus datos personales, laborales y equipamiento asignado.
              </p>
            </Link>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600 opacity-75">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Gestión de Usuarios</h3>
                  <p className="text-sm text-gray-600">Próximamente</p>
                </div>
              </div>
              <p className="text-gray-700">
                Administra usuarios existentes, activa o desactiva cuentas, y gestiona permisos.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-600 opacity-75">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Auditoría</h3>
                  <p className="text-sm text-gray-600">Próximamente</p>
                </div>
              </div>
              <p className="text-gray-700">
                Consulta el registro de auditoría de todas las operaciones realizadas en el sistema.
              </p>
            </div>
          </div>
        )}

        {!isAdmin && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Perfil de Empleado</h3>
            <p className="text-gray-600 mb-6">
              Tu cuenta está activa en el sistema. Pronto tendrás acceso a más funcionalidades.
            </p>
            <div className="bg-gray-50 rounded-lg p-6 text-left">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Nombre</dt>
                  <dd className="mt-1 text-sm text-gray-900">{usuario?.nombre_completo}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Puesto</dt>
                  <dd className="mt-1 text-sm text-gray-900">{usuario?.puesto || 'No especificado'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{usuario?.email_laboral}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Rol</dt>
                  <dd className="mt-1 text-sm text-gray-900">{usuario?.rol}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
