import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Perfil } from './pages/Perfil';
import { PerfilUsuario } from './pages/PerfilUsuario';
import { Directorio } from './pages/Directorio';
import { Oficinas } from './pages/Oficinas';
import { Configuracion } from './pages/Configuracion';
import { CentroCorreos } from './pages/CentroCorreos';
import { Vacaciones } from './pages/Vacaciones';
import { EspacioJiro } from './pages/EspacioJiro';
import MulticotizadorDigital from './pages/MulticotizadorDigital';
import { Publicidad } from './pages/Publicidad';
import { GestorEmails } from './pages/GestorEmails';
import { Chat } from './pages/Chat';
import { AccesosNacional } from './pages/AccesosNacional';
import { SegurosEducation } from './pages/SegurosEducation';
import { SegurosEducationOnDemand } from './pages/SegurosEducationOnDemand';
import { SegurosEducationAulaVirtual } from './pages/SegurosEducationAulaVirtual';
import { SegurosEducationAulaDigital } from './pages/SegurosEducationAulaDigital';
import { CentroNotificaciones } from './pages/CentroNotificaciones';
import { Tickets } from './pages/Tickets';
import { TicketDetalle } from './pages/TicketDetalle';
import { MeetingRoom } from './pages/MeetingRoom';
import { AulaVirtualSala } from './pages/AulaVirtualSala';
import { NotificacionesTransaccionales } from './pages/NotificacionesTransaccionales';
import MiCRM from './pages/MiCRM';
import CRMContactos from './pages/CRMContactos';
import CRMContactoPerfil from './pages/CRMContactoPerfil';
import CRMReportes from './pages/CRMReportes';
import CRMConfiguracion from './pages/CRMConfiguracion';
import Store from './pages/Store';
import StoreCarrito from './pages/StoreCarrito';
import StoreMisPedidos from './pages/StoreMisPedidos';
import StorePedidoDetalle from './pages/StorePedidoDetalle';
import StorePedidos from './pages/StorePedidos';
import StoreAdmin from './pages/StoreAdmin';

function AppRoutes() {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/dashboard" replace /> : <Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/perfil"
        element={
          <ProtectedRoute>
            <Layout>
              <Perfil />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/directorio"
        element={
          <ProtectedRoute requireAdminOrGerente>
            <Layout>
              <Directorio />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/usuario/:id"
        element={
          <ProtectedRoute requireAdminOrGerente>
            <Layout>
              <PerfilUsuario />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/oficinas"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <Oficinas />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/configuracion"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <Configuracion />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/notificaciones-transaccionales"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <NotificacionesTransaccionales />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/centro-correos"
        element={
          <ProtectedRoute requireAdminOrGerente>
            <Layout>
              <CentroCorreos />
            </Layout>
          </ProtectedRoute>
        }
      />


      <Route
        path="/vacaciones"
        element={
          <ProtectedRoute>
            <Layout>
              <Vacaciones />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/espacio-jiro"
        element={
          <ProtectedRoute>
            <Layout>
              <EspacioJiro />
            </Layout>
          </ProtectedRoute>
        }
      />


      <Route
        path="/multicotizador-digital"
        element={
          <ProtectedRoute>
            <Layout>
              <MulticotizadorDigital />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/publicidad"
        element={
          <ProtectedRoute>
            <Layout>
              <Publicidad />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/gestor-emails"
        element={
          <ProtectedRoute>
            <Layout>
              <GestorEmails />
            </Layout>
          </ProtectedRoute>
        }
      />



      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Layout>
              <Chat />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/accesos-nacional"
        element={
          <ProtectedRoute>
            <AccesosNacional />
          </ProtectedRoute>
        }
      />

      <Route
        path="/seguros-education"
        element={
          <ProtectedRoute>
            <SegurosEducation />
          </ProtectedRoute>
        }
      />

      <Route
        path="/seguros-education/on-demand"
        element={
          <ProtectedRoute>
            <SegurosEducationOnDemand />
          </ProtectedRoute>
        }
      />

      <Route
        path="/seguros-education/aula-virtual"
        element={
          <ProtectedRoute>
            <SegurosEducationAulaDigital />
          </ProtectedRoute>
        }
      />

      {/* Ruta antigua oculta - mantener por compatibilidad pero no usar */}
      <Route
        path="/seguros-education/aula-virtual-old"
        element={
          <ProtectedRoute>
            <SegurosEducationAulaVirtual />
          </ProtectedRoute>
        }
      />

      <Route
        path="/aula-virtual/sala/:roomId"
        element={
          <ProtectedRoute>
            <AulaVirtualSala />
          </ProtectedRoute>
        }
      />

      <Route
        path="/centro-notificaciones"
        element={
          <ProtectedRoute>
            <CentroNotificaciones />
          </ProtectedRoute>
        }
      />

      <Route
        path="/tickets"
        element={
          <ProtectedRoute>
            <Layout>
              <Tickets />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tickets/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <TicketDetalle />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mi-crm"
        element={
          <ProtectedRoute>
            <Layout>
              <MiCRM />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mi-crm/contactos"
        element={
          <ProtectedRoute>
            <Layout>
              <CRMContactos />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mi-crm/contactos/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <CRMContactoPerfil />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mi-crm/reportes"
        element={
          <ProtectedRoute>
            <Layout>
              <CRMReportes />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mi-crm/configuracion"
        element={
          <ProtectedRoute>
            <Layout>
              <CRMConfiguracion />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/store"
        element={
          <ProtectedRoute>
            <Store />
          </ProtectedRoute>
        }
      />

      <Route
        path="/store/carrito"
        element={
          <ProtectedRoute>
            <StoreCarrito />
          </ProtectedRoute>
        }
      />

      <Route
        path="/store/mis-pedidos"
        element={
          <ProtectedRoute>
            <StoreMisPedidos />
          </ProtectedRoute>
        }
      />

      <Route
        path="/store/admin"
        element={
          <ProtectedRoute requireAdmin>
            <StoreAdmin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/store/pedido/:pedidoId"
        element={
          <ProtectedRoute>
            <StorePedidoDetalle />
          </ProtectedRoute>
        }
      />

      <Route
        path="/store/pedidos"
        element={
          <ProtectedRoute requireAdmin>
            <StorePedidos />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
