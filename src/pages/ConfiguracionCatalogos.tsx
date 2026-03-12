import { Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GestionCatalogosRegistro } from '../components/tramites/GestionCatalogosRegistro';

export function ConfiguracionCatalogos() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Acceso Denegado
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Solo los administradores pueden acceder a esta página
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-soft border border-neutral-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-accent" />
          <div>
            <h1 className="text-3xl font-display font-bold text-accent dark:text-white">
              Configuración de Catálogos
            </h1>
            <p className="text-neutral-600 dark:text-gray-400">
              Gestiona los catálogos del módulo Registro de Actividades
            </p>
          </div>
        </div>
      </div>

      <GestionCatalogosRegistro />
    </div>
  );
}
