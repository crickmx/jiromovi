import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';
import './index.css';
import { MoviAuthProvider } from './contexts/MoviAuthContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { LoadingOverlay } from './components/loading/LoadingOverlay';
import MoviFullRoutes from './pages/MoviFullRoutes';
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <MoviAuthProvider>
        <LoadingProvider>
          <LoadingOverlay />
          <Suspense fallback={null}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={<MoviFullRoutes />} />
            </Routes>
          </Suspense>
        </LoadingProvider>
      </MoviAuthProvider>
    </BrowserRouter>
  );
}

export default App;
