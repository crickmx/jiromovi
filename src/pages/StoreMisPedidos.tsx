import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Package, Eye } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { obtenerPedidosUsuario } from '../lib/storeUtils';
import type { StorePedido } from '../lib/storeTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function StoreMisPedidos() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<StorePedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarPedidos();
  }, []);

  const cargarPedidos = async () => {
    if (!usuario?.id) return;

    try {
      setLoading(true);
      console.log(`🔍 Usuario ${usuario.nombre} cargando sus propios pedidos...`);
      const data = await obtenerPedidosUsuario(usuario.id);
      console.log(`✅ Mis pedidos: ${data.length} pedidos encontrados`);
      setPedidos(data);
    } catch (error) {
      console.error('❌ Error cargando mis pedidos:', error);
      alert('Error al cargar tus pedidos. Verifica la consola para más detalles.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Mis Pedidos"
          description="Consulta el historial y estatus de tus pedidos"
          icon={Package}
          backTo="/store"
          backLabel="Volver a MOVI Store"
          className="mb-8"
        />

        {pedidos.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10">
            <Package className="w-16 h-16 text-neutral-400 dark:text-white/40 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-700 dark:text-white/70 mb-2">
              No tienes pedidos aún
            </h3>
            <p className="text-neutral-500 dark:text-white/50 mb-6">Realiza tu primer pedido en MOVI Store</p>
            <button
              onClick={() => navigate('/store')}
              className="bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent-hover transition-colors font-medium"
            >
              Explorar productos
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-white/10">
                <thead className="bg-neutral-50 dark:bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase tracking-wider">
                      ID Pedido
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase tracking-wider">
                      Estatus
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-white/50 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200 dark:divide-white/10">
                  {pedidos.map(pedido => (
                    <tr key={pedido.id} className="hover:bg-neutral-50 dark:bg-white/5">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {pedido.folio_oc ? (
                          <span className="text-sm font-semibold text-accent bg-primary-50 px-2 py-1 rounded">
                            {pedido.folio_oc}
                          </span>
                        ) : (
                          <span className="text-sm text-neutral-400 dark:text-white/40 italic">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-neutral-900 dark:text-white">
                          {format(new Date(pedido.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-primary-100 text-primary-800">
                          {pedido.estatus?.nombre || 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => navigate(`/store/pedido/${pedido.id}`)}
                          className="inline-flex items-center gap-2 text-accent hover:text-primary-800 font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
