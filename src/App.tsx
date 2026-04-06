import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
import { DirectorioJiro } from './pages/DirectorioJiro';
import { SegurosEducation } from './pages/SegurosEducation';
import { SegurosEducationOnDemand } from './pages/SegurosEducationOnDemand';
import { SegurosEducationAulaVirtual } from './pages/SegurosEducationAulaVirtual';
import { SegurosEducationAulaDigital } from './pages/SegurosEducationAulaDigital';
import { SegurosEducationAnalytics } from './pages/SegurosEducationAnalytics';
import { CentroNotificaciones } from './pages/CentroNotificaciones';
import { Tramites } from './pages/Tramites';
import TramitesReportes from './pages/TramitesReportes';
import { TramiteDetalle } from './pages/TramiteDetalle';
import { ConfiguracionCatalogos } from './pages/ConfiguracionCatalogos';
import { MeetingRoom } from './pages/MeetingRoom';
import { AulaVirtualSala } from './pages/AulaVirtualSala';
import { NotificacionesTransaccionales } from './pages/NotificacionesTransaccionales';
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
import ProduccionPorVendedor from './pages/ProduccionPorVendedor';
import ProduccionConvenio from './pages/ProduccionConvenio';
import ProduccionConfiguracion from './pages/ProduccionConfiguracion';
import MiProduccion from './pages/MiProduccion';
import MiProduccionSICAS from './pages/MiProduccionSICAS';
import MiProduccionSICASMirror from './pages/MiProduccionSICASMirror';
import MisPolizas from './pages/MisPolizas';
import GMMTarifasAdmin from './pages/GMMTarifasAdmin';
import GMMCotizador from './pages/GMMCotizador';
import CatalogosWeb from './pages/CatalogosWeb';
import MiPaginaWeb from './pages/MiPaginaWeb';
import PaginaPublicaAsesor from './pages/PaginaPublicaAsesor';
import ChatGPTTest from './pages/ChatGPTTest';
import SicasAdmin from './pages/SicasAdmin';
import SicasTestCatalogs from './pages/SicasTestCatalogs';
import SicasDiagnostico from './pages/SicasDiagnostico';
import SicasRestTest from './pages/SicasRestTest';
import SicasVigentesTest from './pages/SicasVigentesTest';
import CentroDigital from './pages/CentroDigital';
import CursoCedulaA from './pages/CursoCedulaA';
import ModuloViewer from './pages/ModuloViewer';
import CedulaAExamenes from './pages/CedulaAExamenes';
import ExamenInterface from './pages/ExamenInterface';
import CertificadoCedulaA from './pages/CertificadoCedulaA';
import MiProgreso from './pages/MiProgreso';
import GamificacionAdmin from './pages/GamificacionAdmin';
import CargaMasivaUsuarios from './pages/CargaMasivaUsuarios';

function AppRoutes() {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
          <ProtectedRoute requireDirectorioAccess>
            <Layout>
              <Directorio />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/directorio-jiro"
        element={
          <ProtectedRoute requireDirectorioAccess>
            <DirectorioJiro />
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
          <ProtectedRoute excludeAgente>
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
        path="/centro-digital"
        element={
          <ProtectedRoute>
            <CentroDigital />
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

      <Route
        path="/seguros-education/analytics"
        element={
          <ProtectedRoute>
            <SegurosEducationAnalytics />
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
        path="/tramites"
        element={
          <ProtectedRoute>
            <Layout>
              <Tramites />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tramites/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <TramiteDetalle />
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
        path="/comunicados"
        element={
          <ProtectedRoute>
            <Layout>
              <Comunicados />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/comunicados/categorias"
        element={
          <ProtectedRoute requireAdmin>
            <ComunicadoCategorias />
          </ProtectedRoute>
        }
      />

      <Route
        path="/comunicados/nuevo"
        element={
          <ProtectedRoute>
            <Layout>
              <ComunicadoEditor />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/comunicados/editar/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ComunicadoEditor />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/comunicados/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ComunicadoDetalle />
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
        path="/mi-crm/tareas"
        element={
          <ProtectedRoute>
            <Layout>
              <CRMTareas />
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

      <Route
        path="/comisiones"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <Comisiones />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/comisiones/lote/:id"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <ComisionesLote />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/comisiones/upload"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <ComisionesUpload />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/comisiones/upload-nuevo"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <ComisionesUploadNuevo />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/comisiones/preparar-lote/:sessionId"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <ComisionesPrepararLote />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* <Route
        path="/comisiones/mapeo-vendedores"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <MapeoVendedores />
            </Layout>
          </ProtectedRoute>
        }
      /> */}

      <Route
        path="/comisiones/importar-documentos"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <DocumentosImportar />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* <Route
        path="/configuracion/mapeo-vendedores"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <MapeoVendedoresAdmin />
            </Layout>
          </ProtectedRoute>
        }
      /> */}

      <Route
        path="/mis-comisiones"
        element={
          <ProtectedRoute>
            <Layout>
              <MisComisiones />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mi-progreso"
        element={
          <ProtectedRoute>
            <Layout>
              <MiProgreso />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/gamificacion/admin"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <GamificacionAdmin />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/produccion/total"
        element={
          <ProtectedRoute requireAdmin={false} requireGerente>
            <Layout>
              <ProduccionTotal />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/produccion/convenio"
        element={
          <ProtectedRoute requireAdmin={false} requireGerente>
            <Layout>
              <ProduccionConvenio />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mi-produccion"
        element={
          <ProtectedRoute>
            <Layout>
              <MiProduccion />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/produccion/por-vendedor"
        element={
          <ProtectedRoute requireAdmin={false} requireGerente>
            <Layout>
              <ProduccionPorVendedor />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/produccion/configuracion"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <ProduccionConfiguracion />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/gmm/tarifas"
        element={
          <ProtectedRoute requireAdmin>
            <GMMTarifasAdmin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/gmm/cotizador"
        element={
          <ProtectedRoute requireAdmin>
            <GMMCotizador />
          </ProtectedRoute>
        }
      />

      <Route
        path="/catalogos-web"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <CatalogosWeb />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mi-pagina-web"
        element={
          <ProtectedRoute>
            <Layout>
              <MiPaginaWeb />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
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
              <Route path="/oficinas" element={<ProtectedRoute requireAdmin><Layout><Oficinas /></Layout></ProtectedRoute>} />
              <Route path="/configuracion" element={<ProtectedRoute requireAdmin><Layout><Configuracion /></Layout></ProtectedRoute>} />
              <Route path="/notificaciones-transaccionales" element={<ProtectedRoute requireAdmin><Layout><NotificacionesTransaccionales /></Layout></ProtectedRoute>} />
              <Route path="/centro-correos" element={<ProtectedRoute requireAdminOrGerente><Layout><CentroCorreos /></Layout></ProtectedRoute>} />
              <Route path="/vacaciones" element={<ProtectedRoute excludeAgente><Layout><Vacaciones /></Layout></ProtectedRoute>} />
              <Route path="/espacio-jiro" element={<ProtectedRoute><Layout><EspacioJiro /></Layout></ProtectedRoute>} />
              <Route path="/multicotizador-digital" element={<ProtectedRoute><Layout><MulticotizadorDigital /></Layout></ProtectedRoute>} />
              <Route path="/publicidad" element={<ProtectedRoute><Layout><Publicidad /></Layout></ProtectedRoute>} />
              <Route path="/gestor-emails" element={<ProtectedRoute><Layout><GestorEmails /></Layout></ProtectedRoute>} />
              <Route path="/centro-digital" element={<ProtectedRoute><CentroDigital /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><Layout><Chat /></Layout></ProtectedRoute>} />
              <Route path="/accesos-nacional" element={<ProtectedRoute><AccesosNacional /></ProtectedRoute>} />
              <Route path="/seguros-education" element={<ProtectedRoute><SegurosEducation /></ProtectedRoute>} />
              <Route path="/seguros-education/on-demand" element={<ProtectedRoute><SegurosEducationOnDemand /></ProtectedRoute>} />
              <Route path="/seguros-education/aula-virtual" element={<ProtectedRoute><SegurosEducationAulaDigital /></ProtectedRoute>} />
              <Route path="/seguros-education/analytics" element={<ProtectedRoute><SegurosEducationAnalytics /></ProtectedRoute>} />
              <Route path="/seguros-education/aula-virtual-old" element={<ProtectedRoute><SegurosEducationAulaVirtual /></ProtectedRoute>} />
              <Route path="/aula-virtual/sala/:roomId" element={<ProtectedRoute><AulaVirtualSala /></ProtectedRoute>} />
              <Route path="/seguros-education/cedula-a" element={<ProtectedRoute><Layout><CursoCedulaA /></Layout></ProtectedRoute>} />
              <Route path="/seguros-education/cedula-a/modulo/:moduloId" element={<ProtectedRoute><Layout><ModuloViewer /></Layout></ProtectedRoute>} />
              <Route path="/seguros-education/cedula-a/examenes" element={<ProtectedRoute><Layout><CedulaAExamenes /></Layout></ProtectedRoute>} />
              <Route path="/seguros-education/cedula-a/examen/:examenId" element={<ProtectedRoute><Layout><ExamenInterface /></Layout></ProtectedRoute>} />
              <Route path="/seguros-education/cedula-a/certificado/:certificadoId" element={<ProtectedRoute><Layout><CertificadoCedulaA /></Layout></ProtectedRoute>} />
              <Route path="/centro-notificaciones" element={<ProtectedRoute><CentroNotificaciones /></ProtectedRoute>} />
              <Route path="/tramites" element={<ProtectedRoute><Layout><Tramites /></Layout></ProtectedRoute>} />
              <Route path="/tramites/reportes" element={<ProtectedRoute><Layout><TramitesReportes /></Layout></ProtectedRoute>} />
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
              <Route path="/comisiones" element={<ProtectedRoute requireAdmin><Layout><Comisiones /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/lote/:id" element={<ProtectedRoute requireAdmin><Layout><ComisionesLote /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/upload" element={<ProtectedRoute requireAdmin><Layout><ComisionesUpload /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/upload-nuevo" element={<ProtectedRoute requireAdmin><Layout><ComisionesUploadNuevo /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/preparar-lote/:sessionId" element={<ProtectedRoute requireAdmin><Layout><ComisionesPrepararLote /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/mapeo-vendedores" element={<ProtectedRoute requireAdmin><Layout><MapeoVendedores /></Layout></ProtectedRoute>} />
              <Route path="/comisiones/importar-documentos" element={<ProtectedRoute requireAdmin><Layout><DocumentosImportar /></Layout></ProtectedRoute>} />
              <Route path="/configuracion/mapeo-vendedores" element={<ProtectedRoute requireAdmin><Layout><MapeoVendedoresAdmin /></Layout></ProtectedRoute>} />
              <Route path="/mis-comisiones" element={<ProtectedRoute><Layout><MisComisiones /></Layout></ProtectedRoute>} />
              <Route path="/gamificacion/admin" element={<ProtectedRoute requireAdmin><Layout><GamificacionAdmin /></Layout></ProtectedRoute>} />
              <Route path="/mi-progreso" element={<ProtectedRoute><Layout><MiProgreso /></Layout></ProtectedRoute>} />
              <Route path="/produccion/total" element={<ProtectedRoute requireAdmin={false} requireGerente><Layout><ProduccionTotal /></Layout></ProtectedRoute>} />
              <Route path="/produccion/convenio" element={<ProtectedRoute requireAdmin={false} requireGerente><Layout><ProduccionConvenio /></Layout></ProtectedRoute>} />
              <Route path="/mi-produccion" element={<ProtectedRoute><Layout><MiProduccion /></Layout></ProtectedRoute>} />
              <Route path="/mi-produccion-sicas" element={<ProtectedRoute><Layout><MiProduccionSICAS /></Layout></ProtectedRoute>} />
              <Route path="/mi-produccion-sicas-soap" element={<ProtectedRoute><Layout><MiProduccionSICASMirror /></Layout></ProtectedRoute>} />
              <Route path="/mis-polizas" element={<ProtectedRoute><Layout><MisPolizas /></Layout></ProtectedRoute>} />
              <Route path="/produccion/por-vendedor" element={<ProtectedRoute requireAdmin={false} requireGerente><Layout><ProduccionPorVendedor /></Layout></ProtectedRoute>} />
              <Route path="/produccion/configuracion" element={<ProtectedRoute requireAdmin><Layout><ProduccionConfiguracion /></Layout></ProtectedRoute>} />
              <Route path="/gmm/tarifas" element={<ProtectedRoute requireAdmin><GMMTarifasAdmin /></ProtectedRoute>} />
              <Route path="/gmm/cotizador" element={<ProtectedRoute requireAdmin><GMMCotizador /></ProtectedRoute>} />
              <Route path="/catalogos-web" element={<ProtectedRoute requireAdmin><Layout><CatalogosWeb /></Layout></ProtectedRoute>} />
              <Route path="/sicas" element={<ProtectedRoute requireAdmin><Layout><SicasAdmin /></Layout></ProtectedRoute>} />
              <Route path="/sicas/test-catalogs" element={<ProtectedRoute requireAdmin><Layout><SicasTestCatalogs /></Layout></ProtectedRoute>} />
              <Route path="/sicas/diagnostico" element={<ProtectedRoute requireAdmin><SicasDiagnostico /></ProtectedRoute>} />
              <Route path="/sicas/rest-test" element={<ProtectedRoute requireAdminOrGerente><Layout><SicasRestTest /></Layout></ProtectedRoute>} />
              <Route path="/sicas/vigentes-test" element={<ProtectedRoute requireAdmin><Layout><SicasVigentesTest /></Layout></ProtectedRoute>} />
              <Route path="/mi-pagina-web" element={<ProtectedRoute><Layout><MiPaginaWeb /></Layout></ProtectedRoute>} />
              <Route path="/chatgpt-test" element={<ProtectedRoute><Layout><ChatGPTTest /></Layout></ProtectedRoute>} />
              <Route path="/carga-masiva-usuarios" element={<ProtectedRoute requireAdmin><Layout><CargaMasivaUsuarios /></Layout></ProtectedRoute>} />

              {/* Redirect raíz */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

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
