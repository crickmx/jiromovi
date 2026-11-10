export const useAuth = () => ({ usuario: { id: 'u-demo', nombre: 'ricardo', nombre_completo: 'RICARDO DEMO', rol: 'Administrador', oficina_id: 'o1' }, isMasked: false });
export const useMoviAuth = useAuth;
export const AuthProvider = ({ children }: any) => children;
export const isMoviPlatform = () => true;
