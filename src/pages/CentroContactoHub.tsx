import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function CentroContactoHub() {
  const { usuario } = useAuth();
  const isAgent = usuario?.rol === 'Agente';

  if (isAgent) {
    return <Navigate to="/centro-contacto/email" replace />;
  }

  return <Navigate to="/centro-contacto/whatsapp" replace />;
}
