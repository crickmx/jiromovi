import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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

      <Route path="/" element={<Navigate to={usuario?.rol === 'Administrador' || usuario?.rol === 'Gerente' ? "/dashboard" : "/perfil"} replace />} />
      <Route path="*" element={<Navigate to={usuario?.rol === 'Administrador' || usuario?.rol === 'Gerente' ? "/dashboard" : "/perfil"} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
