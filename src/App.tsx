import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AssistantProvider } from './contexts/AssistantContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import Registro from './pages/Registro';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { Perfil } from './pages/Perfil';
import { PerfilUsuario } from './pages/PerfilUsuario';
import { Directorio } from './pages/Directorio';
import ConfiguracionHub from './pages/ConfiguracionHub';
import { CentroCorreos } from './pages/CentroCorreos';
import { Vacaciones } from './pages/Vacaciones';
import { EspacioJiro } from './pages/EspacioJiro';
import MulticotizadorDigital from './pages/MulticotizadorDigital';
import { GestorEmails } from './pages/GestorEmails';
import { AccesosNacional } from './pages/AccesosNacional';
import { DirectorioJiro } from './pages/DirectorioJiro';
import { SegurosEducation } from './pages/SegurosEducation';
import { SegurosEducationOnDemand } from './pages/SegurosEducationOnDemand';
import { SegurosEducationAulaVirtual } from './pages/SegurosEducationAulaVirtual';
import { SegurosEducationAulaDigital } from './pages/SegurosEducationAulaDigital';
import { SegurosEducationAnalytics } from './pages/SegurosEducationAnalytics';
import { SegurosEducationManuales } from './pages/SegurosEducationManuales';
import { Tramites } from './pages/Tramites';
import TramitesReportes from './pages/TramitesReportes';
import { TramiteDetalle } from './pages/TramiteDetalle';
import { ConfiguracionCatalogos } from './pages/ConfiguracionCatalogos';
import { AulaVirtualSala } from './pages/AulaVirtualSala';
import MiCRM from './pages/MiCRM';
import CRMContactos from './pages/CRMContactos';
import CRMContactoPerfil from './pages/CRMContactoPerfil';
import CRMTareas from './pages/CRMTareas';
import CRMReportes from './pages/CRMReportes';
import CRMConfiguracion from './pages/CRMConfiguracion';
import Comunicados from './pages/Comunicados';
import ComunicadoDetalle from './pages/ComunicadoDetalle';
import ComunicadoEditor from './pages/ComunicadoEditor';
import ComunicadoCategorias from './pages/ComunicadoCategorias';
import Store from './pages/Store';
import StoreCarrito from './pages/StoreCarrito';
import StoreMisPedidos from './pages/StoreMisPedidos';
import StorePedidoDetalle from './pages/StorePedidoDetalle';
import StorePedidos from './pages/StorePedidos';
import StorePedidosReporte from './pages/StorePedidosReporte';
import StoreAdmin from './pages/StoreAdmin';
import Comisiones from './pages/Comisiones';
import ComisionesLote from './pages/ComisionesLote';
import MisComisiones from './pages/MisComisiones';
import ComisionesUpload from './pages/ComisionesUpload';
import ComisionesUploadNuevo from './pages/ComisionesUploadNuevo';
import ComisionesPrepararLote from './pages/ComisionesPrepararLote';
import MapeoVendedores from './pages/MapeoVendedores';
import DocumentosImportar from './pages/DocumentosImportar';
import MapeoVendedoresAdmin from './pages/MapeoVendedoresAdmin';
import ProduccionTotal from './pages/ProduccionTotal';
import ProduccionConvenio from './pages/ProduccionConvenio';
import ProduccionConfiguracion from './pages/ProduccionConfiguracion';
import MiProduccion from './pages/MiProduccion';
import MiProduccionSICASMirror from './pages/MiProduccionSICASMirror';
import MisPolizas from './pages/MisPolizas';
import GMMCotizador from './pages/GMMCotizador';
import Mercadotecnia from './pages/Mercadotecnia';
import PaginaPublicaAsesor from './pages/PaginaPublicaAsesor';
import ChatGPTTest from './pages/ChatGPTTest';
import SicasTestCatalogs from './pages/SicasTestCatalogs';
import SicasDiagnostico from './pages/SicasDiagnostico';
import SicasRestTest from './pages/SicasRestTest';
import SicasVigentesTest from './pages/SicasVigentesTest';
import SicasSaludAdmin from './pages/SicasSaludAdmin';
import CentroDigital from './pages/CentroDigital';
import CursoCedulaA from './pages/CursoCedulaA';
import ModuloViewer from './pages/ModuloViewer';
import CedulaAExamenes from './pages/CedulaAExamenes';
import ExamenInterface from './pages/ExamenInterface';
import CertificadoCedulaA from './pages/CertificadoCedulaA';
import MiProgreso from './pages/MiProgreso';
import CargaMasivaUsuarios from './pages/CargaMasivaUsuarios';
import { ActividadUsuarios } from './pages/ActividadUsuarios';
import RegistroPersonal from './pages/RegistroPersonal';
import RegimenFiscalAdmin from './pages/RegimenFiscalAdmin';
import RegimenFiscalEditor from './pages/RegimenFiscalEditor';
import ProduccionSICASLive from './pages/ProduccionSICASLive';
import CentroContactoHub from './pages/CentroContactoHub';
import LectorQualitas from './pages/LectorQualitas';
import EntregaPolizas from './pages/EntregaPolizas';
import FormulariosCotizacion from './pages/FormulariosCotizacion';
import QuoteFormWizard from './pages/QuoteFormWizard';
import Manuales from './pages/Manuales';
import ManualViewer from './pages/ManualViewer';
import ManualesAdmin from './pages/ManualesAdmin';
import CentroContactoAsistentes from './pages/CentroContactoAsistentes';
import AsistenteEntrenamiento from './pages/AsistenteEntrenamiento';
import PublicQuoteForm from './pages/PublicQuoteForm';
import AdminDigital from './pages/AdminDigital';
import { SeguwalletAdmin } from './pages/SeguwalletAdmin';
import { SeguwalletLogin } from './seguwallet/pages/SeguwalletLogin';
import { SeguwalletDashboard } from './seguwallet/pages/SeguwalletDashboard';
import { SeguwalletPolizas } from './seguwallet/pages/SeguwalletPolizas';
import { SeguwalletCotizar } from './seguwallet/pages/SeguwalletCotizar';
import { SeguwalletAseguradoras } from './seguwallet/pages/SeguwalletAseguradoras';
import { SeguwalletPerfil } from './seguwallet/pages/SeguwalletPerfil';
import { SeguwalletCompleteProfile } from './seguwallet/pages/SeguwalletCompleteProfile';
import { SeguwalletProvider } from './seguwallet/lib/SeguwalletContext';
import { AgentBrandProvider } from './seguwallet/lib/AgentBrandContext';
import { SeguwalletLayout } from './seguwallet/components/SeguwalletLayout';
import { SeguwalletProtectedRoute } from './seguwallet/components/SeguwalletProtectedRoute';
import { isSeguwallet } from './seguwallet/lib/seguwalletAuth';

function SW({ children }: { children: React.ReactNode }) {
  return (
    <SeguwalletProvider>
      <AgentBrandProvider>
        <SeguwalletProtectedRoute>
          <SeguwalletLayout>{children}</SeguwalletLayout>
        </SeguwalletProtectedRoute>
      </AgentBrandProvider>
    </SeguwalletProvider>
  );
}

// Seguwallet portal — fully independent, no MOVI auth providers
function SeguwalletApp() {
  return (
    <Routes>
      <Route path="/seguwallet/login" element={<SeguwalletLogin />} />
      <Route path="/seguwallet/completa-perfil" element={
        <SeguwalletProvider>
          <AgentBrandProvider>
            <SeguwalletProtectedRoute>
              <SeguwalletCompleteProfile />
            </SeguwalletProtectedRoute>
          </AgentBrandProvider>
        </SeguwalletProvider>
      } />
      <Route path="/seguwallet/dashboard" element={<SW><SeguwalletDashboard /></SW>} />
      <Route path="/seguwallet/polizas" element={<SW><SeguwalletPolizas /></SW>} />
      <Route path="/seguwallet/cotizar" element={<SW><SeguwalletCotizar /></SW>} />
      <Route path="/seguwallet/aseguradoras" element={<SW><SeguwalletAseguradoras /></SW>} />
      <Route path="/seguwallet/perfil" element={<SW><SeguwalletPerfil /></SW>} />
      <Route path="*" element={<Navigate to="/seguwallet/login" replace />} />
    </Routes>
  );
}

function App() {
  // On app.seguwallet.mx, render only the Seguwallet portal
  if (isSeguwallet()) {
    return (
      <HelmetProvider>
        <BrowserRouter>
          {/* SeguwalletLogin needs SeguwalletProvider for login route */}
          <SeguwalletApp />
        </BrowserRouter>
      </HelmetProvider>
    );
  }

  return (
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <AssistantProvider>
              <Routes>
              {/* Rutas autenticadas - se evalúan primero */}
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Registro />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute><Layout><Perfil /></Layout></ProtectedRoute>} />
              <Route path="/directorio" element={<ProtectedRoute requireDirectorioAccess><Layout><Directorio /></Layout></ProtectedRoute>} />
              <Route path="/directorio-jiro" element={<ProtectedRoute requireDirectorioAccess><DirectorioJiro /></ProtectedRoute>} />
              <Route path="/usuario/:id" element={<ProtectedRoute requireAdminOrGerente><Layout><PerfilUsuario /></Layout></ProtectedRoute>} />
              <Route path="/oficinas" element={<Navigate to="/configuracion" replace />} />
              <Route path="/configuracion" element={<ProtectedRoute requireAdmin><Layout><ConfiguracionHub /></Layout></ProtectedRoute>} />
              <Route path="/notificaciones-transaccionales" element={<Navigate to="/centro-contacto" replace />} />
              <Route path="/centro-correos" element={<ProtectedRoute requireAdminOrGerente><Layout><CentroCorreos /></Layout></ProtectedRoute>} />
              <Route path="/centro-contacto" element={<ProtectedRoute><Layout><CentroContactoHub /></Layout></ProtectedRoute>} />
              <Route path="/centro-contacto/asistentes" element={<ProtectedRoute requireAdminOrGerente><Layout><CentroContactoAsistentes /></Layout></ProtectedRoute>} />
              <Route path="/centro-contacto/asistentes/entrenamiento" element={<ProtectedRoute requireAdminOrGerente><Layout><AsistenteEntrenamiento /></Layout></ProtectedRoute>} />
              <Route path="/vacaciones" element={<ProtectedRoute excludeAgente><Layout><Vacaciones /></Layout></ProtectedRoute>} />
              <Route path="/espacio-jiro" element={<ProtectedRoute><Layout><EspacioJiro /></Layout></ProtectedRoute>} />
              <Route path="/multicotizador-digital" element={<ProtectedRoute><Layout><MulticotizadorDigital /></Layout></ProtectedRoute>} />
              <Route path="/lector-qualitas" element={<ProtectedRoute excludeAgente><Layout><LectorQualitas /></Layout></ProtectedRoute>} />
              <Route path="/entrega-polizas" element={<ProtectedRoute excludeAgente><Layout><EntregaPolizas /></Layout></ProtectedRoute>} />
              <Route path="/publicidad" element={<Navigate to="/mercadotecnia/publicidad" replace />} />
              <Route path="/mercadotecnia" element={<Navigate to="/mercadotecnia/mi-marca" replace />} />
              <Route path="/mercadotecnia/mi-marca" element={<ProtectedRoute><Layout><Mercadotecnia section="mi-marca" /></Layout></ProtectedRoute>} />
              <Route path="/mercadotecnia/mi-pagina-web" element={<ProtectedRoute><Layout><Mercadotecnia section="mi-pagina-web" /></Layout></ProtectedRoute>} />
              <Route path="/mercadotecnia/publicidad" element={<ProtectedRoute><Layout><Mercadotecnia section="publicidad" /></Layout></ProtectedRoute>} />
              <Route path="/gestor-emails" element={<ProtectedRoute><Layout><GestorEmails /></Layout></ProtectedRoute>} />
              <Route path="/centro-digital" element={<ProtectedRoute><CentroDigital /></ProtectedRoute>} />
              <Route path="/chat" element={<Navigate to="/centro-contacto" replace />} />
              <Route path="/accesos-nacional" element={<ProtectedRoute><AccesosNacional /></ProtectedRoute>} />
              <Route path="/seguros-education" element={<ProtectedRoute><SegurosEducation /></ProtectedRoute>} />
              <Route path="/seguros-education/on-demand" element={<ProtectedRoute><SegurosEducationOnDemand /></ProtectedRoute>} />
              <Route path="/seguros-education/aula-virtual" element={<ProtectedRoute><SegurosEducationAulaDigital /></ProtectedRoute>} />
              <Route path="/seguros-education/analytics" element={<ProtectedRoute><SegurosEducationAnalytics /></ProtectedRoute>} />
              <Route path="/seguros-education/manuales" element={<ProtectedRoute><SegurosEducationManuales /></ProtectedRoute>} />
              <Route path="/seguros-education/aula-virtual-old" element={<ProtectedRoute><SegurosEducationAulaVirtual /></ProtectedRoute>} />
              <Route path="/aula-virtual/sala/:roomId" element={<ProtectedRoute><AulaVirtualSala /></ProtectedRoute>} />
              <Route path="/seguros-education/cedula-a" element={<ProtectedRoute><Layout><CursoCedulaA /></Layout></ProtectedRoute>} />
              <Route path="/seguros-education/cedula-a/modulo/:moduloId" element={<ProtectedRoute><Layout><ModuloViewer /></Layout></ProtectedRoute>} />
              <Route path="/seguros-education/cedula-a/examenes" element={<ProtectedRoute><Layout><CedulaAExamenes /></Layout></ProtectedRoute>} />
              <Route path="/seguros-education/cedula-a/examen/:examenId" element={<ProtectedRoute><Layout><ExamenInterface /></Layout></ProtectedRoute>} />
              <Route path="/seguros-education/cedula-a/certificado/:certificadoId" element={<ProtectedRoute><Layout><CertificadoCedulaA /></Layout></ProtectedRoute>} />
              <Route path="/centro-notificaciones" element={<Navigate to="/centro-contacto" replace />} />
              <Route path="/tramites" element={<ProtectedRoute><Layout><Tramites /></Layout></ProtectedRoute>} />
              <Route path="/tramites/reportes" element={<ProtectedRoute><Layout><TramitesReportes /></Layout></ProtectedRoute>} />
              <Route path="/tramites/formularios" element={<ProtectedRoute><Layout><FormulariosCotizacion /></Layout></ProtectedRoute>} />
              <Route path="/tramites/formularios/nuevo/:formType" element={<ProtectedRoute><Layout><QuoteFormWizard /></Layout></ProtectedRoute>} />
              <Route path="/tramites/formularios/:formId" element={<ProtectedRoute><Layout><QuoteFormWizard /></Layout></ProtectedRoute>} />
              <Route path="/tramites/:id" element={<ProtectedRoute><Layout><TramiteDetalle /></Layout></ProtectedRoute>} />
              <Route path="/configuracion/catalogos" element={<ProtectedRoute requireAdmin><Layout><ConfiguracionCatalogos /></Layout></ProtectedRoute>} />
              <Route path="/mi-crm" element={<ProtectedRoute><Layout><MiCRM /></Layout></ProtectedRoute>} />
              <Route path="/mi-crm/contactos" element={<ProtectedRoute><Layout><CRMContactos /></Layout></ProtectedRoute>} />
              <Route path="/mi-crm/contactos/:id" element={<ProtectedRoute><Layout><CRMContactoPerfil /></Layout></ProtectedRoute>} />
              <Route path="/mi-crm/tareas" element={<ProtectedRoute><Layout><CRMTareas /></Layout></ProtectedRoute>} />
              <Route path="/mi-crm/reportes" element={<ProtectedRoute><Layout><CRMReportes /></Layout></ProtectedRoute>} />
              <Route path="/mi-crm/configuracion" element={<ProtectedRoute><Layout><CRMConfiguracion /></Layout></ProtectedRoute>} />
              <Route path="/comunicados" element={<ProtectedRoute><Layout><Comunicados /></Layout></ProtectedRoute>} />
              <Route path="/comunicados/categorias" element={<ProtectedRoute requireAdmin><ComunicadoCategorias /></ProtectedRoute>} />
              <Route path="/comunicados/nuevo" element={<ProtectedRoute><Layout><ComunicadoEditor /></Layout></ProtectedRoute>} />
              <Route path="/comunicados/editar/:id" element={<ProtectedRoute><Layout><ComunicadoEditor /></Layout></ProtectedRoute>} />
              <Route path="/comunicados/:id" element={<ProtectedRoute><Layout><ComunicadoDetalle /></Layout></ProtectedRoute>} />
              <Route path="/store" element={<ProtectedRoute><Store /></ProtectedRoute>} />
              <Route path="/store/carrito" element={<ProtectedRoute><StoreCarrito /></ProtectedRoute>} />
              <Route path="/store/mis-pedidos" element={<ProtectedRoute><StoreMisPedidos /></ProtectedRoute>} />
              <Route path="/store/admin" element={<ProtectedRoute requireAdmin><StoreAdmin /></ProtectedRoute>} />
              <Route path="/store/pedido/:pedidoId" element={<ProtectedRoute><StorePedidoDetalle /></ProtectedRoute>} />
              <Route path="/store/pedidos" element={<ProtectedRoute requireAdmin><StorePedidos /></ProtectedRoute>} />
              <Route path="/store/reporte" element={<ProtectedRoute requireAdmin><StorePedidosReporte /></ProtectedRoute>} />
              <Route path="/comisiones" element={<ProtectedRoute requireAdmin><Layout><Comisiones /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/lote/:id" element={<ProtectedRoute requireAdmin><Layout><ComisionesLote /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/upload" element={<ProtectedRoute requireAdmin><Layout><ComisionesUpload /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/upload-nuevo" element={<ProtectedRoute requireAdmin><Layout><ComisionesUploadNuevo /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/preparar-lote/:sessionId" element={<ProtectedRoute requireAdmin><Layout><ComisionesPrepararLote /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/mapeo-vendedores" element={<ProtectedRoute requireAdmin><Layout><MapeoVendedores /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/importar-documentos" element={<ProtectedRoute requireAdmin><Layout><DocumentosImportar /></Layout></ProtectedRoute>} />
              <Route path="/configuracion/mapeo-vendedores" element={<ProtectedRoute requireAdmin><Layout><MapeoVendedoresAdmin /></Layout></ProtectedRoute>} />
              <Route path="/mis-comisiones" element={<ProtectedRoute><Layout><MisComisiones /></Layout></ProtectedRoute>} />
              <Route path="/gamificacion/admin" element={<Navigate to="/configuracion" replace />} />
              <Route path="/mi-progreso" element={<ProtectedRoute><Layout><MiProgreso /></Layout></ProtectedRoute>} />
              <Route path="/produccion/total" element={<ProtectedRoute requireAdmin={false} requireGerente><Layout><ProduccionTotal /></Layout></ProtectedRoute>} />
              <Route path="/produccion/convenio" element={<ProtectedRoute requireAdmin={false} requireGerente><Layout><ProduccionConvenio /></Layout></ProtectedRoute>} />
              <Route path="/mi-produccion" element={<ProtectedRoute><Layout><MiProduccion /></Layout></ProtectedRoute>} />
              <Route path="/mi-produccion-sicas-live" element={<ProtectedRoute><Layout><ProduccionSICASLive /></Layout></ProtectedRoute>} />
              <Route path="/mi-produccion-sicas-soap" element={<ProtectedRoute><Layout><MiProduccionSICASMirror /></Layout></ProtectedRoute>} />
              <Route path="/mis-polizas" element={<ProtectedRoute><Layout><MisPolizas /></Layout></ProtectedRoute>} />
              <Route path="/produccion/configuracion" element={<ProtectedRoute requireAdmin><Layout><ProduccionConfiguracion /></Layout></ProtectedRoute>} />
              <Route path="/gmm/tarifas" element={<Navigate to="/configuracion" replace />} />
              <Route path="/gmm/cotizador" element={<ProtectedRoute requireAdmin><GMMCotizador /></ProtectedRoute>} />
              <Route path="/catalogos-web" element={<Navigate to="/configuracion" replace />} />
              <Route path="/sicas" element={<Navigate to="/configuracion" replace />} />
              <Route path="/sicas/test-catalogs" element={<ProtectedRoute requireAdmin><Layout><SicasTestCatalogs /></Layout></ProtectedRoute>} />
              <Route path="/sicas/diagnostico" element={<ProtectedRoute requireAdmin><SicasDiagnostico /></ProtectedRoute>} />
              <Route path="/sicas/rest-test" element={<ProtectedRoute requireAdminOrGerente><Layout><SicasRestTest /></Layout></ProtectedRoute>} />
              <Route path="/sicas/vigentes-test" element={<ProtectedRoute requireAdmin><Layout><SicasVigentesTest /></Layout></ProtectedRoute>} />
              <Route path="/sicas/salud" element={<ProtectedRoute requireAdmin><Layout><SicasSaludAdmin /></Layout></ProtectedRoute>} />
              <Route path="/mi-pagina-web" element={<Navigate to="/mercadotecnia/mi-pagina-web" replace />} />
              <Route path="/chatgpt-test" element={<ProtectedRoute><Layout><ChatGPTTest /></Layout></ProtectedRoute>} />
              <Route path="/carga-masiva-usuarios" element={<ProtectedRoute requireAdmin><Layout><CargaMasivaUsuarios /></Layout></ProtectedRoute>} />
              <Route path="/actividad-usuarios" element={<ProtectedRoute requireAdmin><Layout><ActividadUsuarios /></Layout></ProtectedRoute>} />
              <Route path="/admin-digital" element={<ProtectedRoute requireAdmin><Layout><AdminDigital /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/regimen-fiscal" element={<ProtectedRoute requireAdmin><Layout><RegimenFiscalAdmin /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/regimen-fiscal/:id" element={<ProtectedRoute requireAdmin><Layout><RegimenFiscalEditor /></Layout></ProtectedRoute>} />
              <Route path="/seguwallet-admin" element={<ProtectedRoute><Layout><SeguwalletAdmin /></Layout></ProtectedRoute>} />

              {/* Seguwallet Portal - also accessible from MOVI domain */}
              <Route path="/seguwallet/login" element={<SeguwalletLogin />} />
              <Route path="/seguwallet/dashboard" element={<SW><SeguwalletDashboard /></SW>} />
              <Route path="/seguwallet/polizas" element={<SW><SeguwalletPolizas /></SW>} />
              <Route path="/seguwallet/cotizar" element={<SW><SeguwalletCotizar /></SW>} />
              <Route path="/seguwallet/aseguradoras" element={<SW><SeguwalletAseguradoras /></SW>} />
              <Route path="/seguwallet/perfil" element={<SW><SeguwalletPerfil /></SW>} />

              {/* Redirect raíz */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Manuales */}
              <Route path="/manuales" element={<ProtectedRoute><Layout><Manuales /></Layout></ProtectedRoute>} />
              <Route path="/manuales/admin" element={<ProtectedRoute requireAdmin><Layout><ManualesAdmin /></Layout></ProtectedRoute>} />
              <Route path="/manuales/:slug" element={<ProtectedRoute><ManualViewer /></ProtectedRoute>} />

              {/* Ruta pública - Registro de Personal */}
              <Route path="/registro-personal" element={<RegistroPersonal />} />

              {/* Ruta pública - Formulario compartido de cotizacion */}
              <Route path="/cotizar/:slug" element={<PublicQuoteForm />} />

              {/* Ruta pública - catch-all para slugs */}
              <Route path="/:slug" element={<PaginaPublicaAsesor />} />
            </Routes>
            </AssistantProvider>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
