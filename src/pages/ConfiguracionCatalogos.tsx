import { Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GestionCatalogosRegistro } from '../components/tramites/GestionCatalogosRegistro';
import { PageHeader } from '@/components/ui/page-header';

export function ConfiguracionCatalogos() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            Acceso Denegado
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            Solo los administradores pueden acceder a esta página
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración de Catálogos"
        description="Gestiona los catálogos del módulo Registro de Actividades"
        icon={Settings}
      />

      <GestionCatalogosRegistro />
    </div>
  );
}
