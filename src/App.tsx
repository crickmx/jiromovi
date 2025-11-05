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
import { MisCorreos } from './pages/MisCorreos';
import { Vacaciones } from './pages/Vacaciones';
import { EspacioJiro } from './pages/EspacioJiro';
import MulticotizadorDigital from './pages/MulticotizadorDigital';
import { Publicidad } from './pages/Publicidad';
import { GestorEmails } from './pages/GestorEmails';
import { FirmasEmail } from './pages/FirmasEmail';
import { Contactos } from './pages/Contactos';
import { Chat } from './pages/Chat';
import { AccesosNacional } from './pages/AccesosNacional';
import { SegurosEducation } from './pages/SegurosEducation';
import { SegurosEducationOnDemand } from './pages/SegurosEducationOnDemand';
import { SegurosEducationAulaVirtual } from './pages/SegurosEducationAulaVirtual';
import { CentroNotificaciones } from './pages/CentroNotificaciones';
import { Tickets } from './pages/Tickets';
import { TicketDetalle } from './pages/TicketDetalle';
import { MeetingRoom } from './pages/MeetingRoom';
import { AulaVirtualSala } from './pages/AulaVirtualSala';

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
      <Route path="/login" element={usuario ? <Navigate to={usuario.rol === 'Administrador' || usuario.rol === 'Gerente' ? "/dashboard" : "/perfil"} replace /> : <Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requireAdminOrGerente>
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
        path="/mis-correos"
        element={
          <ProtectedRoute>
            <Layout>
              <MisCorreos />
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
        path="/contactos"
        element={
          <ProtectedRoute>
            <Layout>
              <Contactos />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/firmas-email"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <FirmasEmail />
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

      <Route path="/" element={<Navigate to={usuario?.rol === 'Administrador' || usuario?.rol === 'Gerente' ? "/dashboard" : "/perfil"} replace />} />
      <Route path="*" element={<Navigate to={usuario?.rol === 'Administrador' || usuario?.rol === 'Gerente' ? "/dashboard" : "/perfil"} replace />} />
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
