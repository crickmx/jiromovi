import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { type ReactNode } from 'react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Polizas from './pages/Polizas';
import PolizaDetalle from './pages/PolizaDetalle';
import Cobranza from './pages/Cobranza';
import Documentos from './pages/Documentos';
import Perfil from './pages/Perfil';
import ChavaSeguwallet from './pages/ChavaSeguwallet';

function PrivateRoute({ children }: { children: ReactNode }) {
  const { customer, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
        <p className="text-sm text-slate-500">Cargando...</p>
      </div>
    </div>
  );
  return customer ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/seguwallet/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/seguwallet/polizas" element={<PrivateRoute><Polizas /></PrivateRoute>} />
          <Route path="/seguwallet/polizas/:id" element={<PrivateRoute><PolizaDetalle /></PrivateRoute>} />
          <Route path="/seguwallet/cobranza" element={<PrivateRoute><Cobranza /></PrivateRoute>} />
          <Route path="/seguwallet/documentos" element={<PrivateRoute><Documentos /></PrivateRoute>} />
          <Route path="/seguwallet/chava" element={<PrivateRoute><ChavaSeguwallet /></PrivateRoute>} />
          <Route path="/seguwallet/perfil" element={<PrivateRoute><Perfil /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/seguwallet/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
