import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ImpersonationProvider } from './contexts/ImpersonationContext';
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
import AlaMedida from './pages/comercial/AlaMedida';
import DisenadorAuto from './pages/comercial/disenadores/DisenadorAuto';
import DisenadorGMM from './pages/comercial/disenadores/DisenadorGMM';
import { FirmasEmail } from './pages/FirmasEmail';
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
import ContactosCRM from './pages/ContactosCRM';
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
import ProduccionSICASLive from './pages/ProduccionSICASLive';
import MiProduccionSICASMirror from './pages/MiProduccionSICASMirror';
import MiProduccion from './pages/MiProduccion';
import MisPolizas from './pages/MisPolizas';
import MapeoVendedores from './pages/MapeoVendedores';
import MapeoVendedoresAdmin from './pages/MapeoVendedoresAdmin';
import GMMCotizador from './pages/GMMCotizador';
import GMMTarifasAdmin from './pages/GMMTarifasAdmin';
import { Publicidad } from './pages/Publicidad';
import { Oficinas } from './pages/Oficinas';
import { ActividadUsuarios } from './pages/ActividadUsuarios';
import Chava from './pages/Chava';
import { Chat } from './pages/Chat';
import { MeetingRoom } from './pages/MeetingRoom';
import { MoviMeet } from './pages/MoviMeet';
import { Contactos } from './pages/Contactos';
import { CentroNotificaciones } from './pages/CentroNotificaciones';
import { NotificacionesTransaccionales } from './pages/NotificacionesTransaccionales';
import ProduccionTotal from './pages/ProduccionTotal';
import ProduccionCargar from './pages/ProduccionCargar';
import ProduccionConfiguracion from './pages/ProduccionConfiguracion';
import ProduccionConvenio from './pages/ProduccionConvenio';
import DocumentosImportar from './pages/DocumentosImportar';
import GamificacionAdmin from './pages/GamificacionAdmin';
import RegimenFiscalAdmin from './pages/RegimenFiscalAdmin';
import RegimenFiscalEditor from './pages/RegimenFiscalEditor';
import SicasAdmin from './pages/SicasAdmin';
import SicasDiagnostico from './pages/SicasDiagnostico';
import CargaMasivaUsuarios from './pages/CargaMasivaUsuarios';
import RegistroPersonal from './pages/RegistroPersonal';
import MiMarca from './pages/MiMarca';
import MiPaginaWeb from './pages/MiPaginaWeb';
import PublicQuoteForm from './pages/PublicQuoteForm';
import QuoteFormWizard from './pages/QuoteFormWizard';
import PaginaPublicaAsesor from './pages/PaginaPublicaAsesor';
import MiProgreso from './pages/MiProgreso';
import { MisCorreos } from './pages/MisCorreos';
import { GestorEmails } from './pages/GestorEmails';
import MiWhatsApp from './pages/MiWhatsApp';
import CentroDigital from './pages/CentroDigital';
import CentroContacto from './pages/CentroContacto';
import CentroContactoHub from './pages/CentroContactoHub';
import CentroContactoUnificado from './pages/CentroContactoUnificado';
import CentroContactoAsistentes from './pages/CentroContactoAsistentes';
import FormulariosCotizacion from './pages/FormulariosCotizacion';
import Mercadotecnia from './pages/Mercadotecnia';
import EntregaPolizas from './pages/EntregaPolizas';
import LectorQualitas from './pages/LectorQualitas';
import { SeguwalletAdmin } from './pages/SeguwalletAdmin';
import AdminDigital from './pages/AdminDigital';
import MagicLinkHandler from './pages/MagicLinkHandler';
import CursoCedulaA from './pages/CursoCedulaA';
import CedulaAExamenes from './pages/CedulaAExamenes';
import CertificadoCedulaA from './pages/CertificadoCedulaA';
import ExamenInterface from './pages/ExamenInterface';
import AsistenteEntrenamiento from './pages/AsistenteEntrenamiento';
import SicasRestTest from './pages/SicasRestTest';
import DiagnosticoWebhook from './pages/DiagnosticoWebhook';
import Manuales from './pages/Manuales';
import ManualesAdmin from './pages/ManualesAdmin';
import ManualViewer from './pages/ManualViewer';
import ModuloViewer from './pages/ModuloViewer';
import CatalogosWeb from './pages/CatalogosWeb';
import CotizarHub from './pages/CotizarHub';
import ChavaAdmin from './pages/ChavaAdmin';
import ChatGPTTest from './pages/ChatGPTTest';
import SicasVigentesTest from './pages/SicasVigentesTest';

// Seguwallet pages
import { SeguwalletLogin } from './seguwallet/pages/SeguwalletLogin';
import { SeguwalletDashboard } from './seguwallet/pages/SeguwalletDashboard';
import { SeguwalletPolizas } from './seguwallet/pages/SeguwalletPolizas';
import { SeguwalletPerfil } from './seguwallet/pages/SeguwalletPerfil';
import { SeguwalletCompleteProfile } from './seguwallet/pages/SeguwalletCompleteProfile';
import { SeguwalletAseguradoras } from './seguwallet/pages/SeguwalletAseguradoras';
import { SeguwalletCotizar } from './seguwallet/pages/SeguwalletCotizar';
import { SeguwalletDescargas } from './seguwallet/pages/SeguwalletDescargas';
import { SeguwalletLayout } from './seguwallet/components/SeguwalletLayout';
import { SeguwalletProtectedRoute } from './seguwallet/components/SeguwalletProtectedRoute';

// Sicas salud
import SicasSaludAdmin from './pages/SicasSaludAdmin';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ImpersonationProvider>
          <NotificationProvider>
            <AssistantProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/registro" element={<Registro />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/registro-personal" element={<RegistroPersonal />} />
                <Route path="/magic-link" element={<MagicLinkHandler />} />

                {/* Public pages (no auth required) */}
                <Route path="/asesor/:slug" element={<PaginaPublicaAsesor />} />
                <Route path="/cotizar/:slug" element={<PublicQuoteForm />} />
                <Route path="/certificado/:id" element={<CertificadoCedulaA />} />

                {/* Seguwallet routes */}
                <Route path="/sw/login" element={<SeguwalletLogin />} />
                <Route path="/sw" element={<SeguwalletProtectedRoute><SeguwalletLayout><Outlet /></SeguwalletLayout></SeguwalletProtectedRoute>}>
                  <Route index element={<Navigate to="/sw/dashboard" replace />} />
                  <Route path="dashboard" element={<SeguwalletDashboard />} />
                  <Route path="polizas" element={<SeguwalletPolizas />} />
                  <Route path="perfil" element={<SeguwalletPerfil />} />
                  <Route path="complete-profile" element={<SeguwalletCompleteProfile />} />
                  <Route path="aseguradoras" element={<SeguwalletAseguradoras />} />
                  <Route path="cotizar" element={<SeguwalletCotizar />} />
                  <Route path="descargas" element={<SeguwalletDescargas />} />
                </Route>

                {/* Protected app routes */}
                <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
                  <Route element={<Layout><Outlet /></Layout>}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />

                    {/* Profile */}
                    <Route path="/perfil" element={<Perfil />} />
                    <Route path="/perfil/:id" element={<PerfilUsuario />} />

                    {/* Chava */}
                    <Route path="/chava" element={<Chava />} />
                    <Route path="/admin/chava-ia" element={<ChavaAdmin />} />

                    {/* Comercial */}
                    <Route path="/contactos" element={<Contactos />} />
                    <Route path="/mi-crm" element={<MiCRM />} />
                    <Route path="/mi-crm/contactos" element={<CRMContactos />} />
                    <Route path="/mi-crm/contactos/:id" element={<CRMContactoPerfil />} />
                    <Route path="/mi-crm/tareas" element={<CRMTareas />} />
                    <Route path="/mi-crm/reportes" element={<CRMReportes />} />
                    <Route path="/mi-crm/configuracion" element={<CRMConfiguracion />} />
                    <Route path="/crm/contactos" element={<ContactosCRM />} />
                    <Route path="/tramites" element={<Tramites />} />
                    <Route path="/tramites/reportes" element={<TramitesReportes />} />
                    <Route path="/tramites/:id" element={<TramiteDetalle />} />
                    <Route path="/tramites/formularios" element={<FormulariosCotizacion />} />
                    <Route path="/tramites/formularios/:id" element={<QuoteFormWizard />} />
                    <Route path="/entrega-polizas" element={<EntregaPolizas />} />
                    <Route path="/mis-polizas" element={<MisPolizas />} />
                    <Route path="/lector-qualitas" element={<LectorQualitas />} />
                    <Route path="/mi-progreso" element={<MiProgreso />} />
                    <Route path="/seguwallet-admin" element={<SeguwalletAdmin />} />

                    {/* Centro de Contacto */}
                    <Route path="/centro-contacto" element={<CentroContacto />} />
                    <Route path="/centro-contacto/hub" element={<CentroContactoHub />} />
                    <Route path="/centro-contacto/unificado" element={<CentroContactoUnificado />} />
                    <Route path="/centro-contacto/asistentes" element={<CentroContactoAsistentes />} />
                    <Route path="/centro-contacto/whatsapp" element={<MiWhatsApp />} />
                    <Route path="/centro-contacto/email" element={<GestorEmails />} />
                    <Route path="/centro-contacto/chat" element={<Chat />} />
                    <Route path="/centro-contacto/notificaciones" element={<CentroNotificaciones />} />
                    <Route path="/directorio-jiro" element={<DirectorioJiro />} />

                    {/* Cotizar */}
                    <Route path="/cotizar" element={<CotizarHub />} />
                    <Route path="/cotizar/gmm-bx" element={<GMMCotizador />} />
                    <Route path="/cotizar/gmm-bx/tarifas" element={<GMMTarifasAdmin />} />
                    <Route path="/cotizar/formularios" element={<FormulariosCotizacion />} />
                    <Route path="/cotizar/formularios/:id" element={<QuoteFormWizard />} />
                    <Route path="/cotizar/a-la-medida" element={<AlaMedida />} />
                    <Route path="/cotizar/a-la-medida/auto" element={<DisenadorAuto />} />
                    <Route path="/cotizar/a-la-medida/gmm" element={<DisenadorGMM />} />
                    <Route path="/cotizar/multicotizador" element={<MulticotizadorDigital />} />

                    {/* Operaciones */}
                    <Route path="/mi-produccion-sicas-live" element={<ProduccionSICASLive />} />
                    <Route path="/mi-produccion" element={<MiProduccion />} />
                    <Route path="/mi-produccion-sicas" element={<MiProduccionSICASMirror />} />
                    <Route path="/produccion/total" element={<ProduccionTotal />} />
                    <Route path="/produccion/cargar" element={<ProduccionCargar />} />
                    <Route path="/produccion/configuracion" element={<ProduccionConfiguracion />} />
                    <Route path="/produccion/convenio" element={<ProduccionConvenio />} />
                    <Route path="/mis-comisiones" element={<MisComisiones />} />
                    <Route path="/comisiones" element={<Comisiones />} />
                    <Route path="/comisiones/lote/:id" element={<ComisionesLote />} />
                    <Route path="/comisiones/upload" element={<ComisionesUpload />} />
                    <Route path="/comisiones/upload-nuevo" element={<ComisionesUploadNuevo />} />
                    <Route path="/comisiones/preparar-lote" element={<ComisionesPrepararLote />} />
                    <Route path="/comisiones/importar" element={<DocumentosImportar />} />
                    <Route path="/comisiones/regimen-fiscal" element={<RegimenFiscalAdmin />} />
                    <Route path="/comisiones/regimen-fiscal/:id" element={<RegimenFiscalEditor />} />
                    <Route path="/comisiones/mapeo-vendedores" element={<MapeoVendedoresAdmin />} />
                    <Route path="/mapeo-vendedores" element={<MapeoVendedores />} />
                    <Route path="/espacio-jiro" element={<EspacioJiro />} />
                    <Route path="/vacaciones" element={<Vacaciones />} />
                    <Route path="/accesos-nacional" element={<AccesosNacional />} />

                    {/* Mercadotecnia */}
                    <Route path="/mercadotecnia" element={<Mercadotecnia section="mi-marca" />} />
                    <Route path="/mercadotecnia/mi-marca" element={<MiMarca />} />
                    <Route path="/mercadotecnia/publicidad" element={<Publicidad />} />
                    <Route path="/mercadotecnia/mi-pagina-web" element={<MiPaginaWeb />} />
                    <Route path="/centro-digital" element={<CentroDigital />} />

                    {/* Seguros Education */}
                    <Route path="/seguros-education" element={<SegurosEducation />} />
                    <Route path="/seguros-education/on-demand" element={<SegurosEducationOnDemand />} />
                    <Route path="/seguros-education/on-demand/:id" element={<AulaVirtualSala />} />
                    <Route path="/seguros-education/aula-virtual" element={<SegurosEducationAulaVirtual />} />
                    <Route path="/seguros-education/aula-digital" element={<SegurosEducationAulaDigital />} />
                    <Route path="/seguros-education/aula-virtual/:id" element={<AulaVirtualSala />} />
                    <Route path="/seguros-education/cedula-a" element={<CursoCedulaA />} />
                    <Route path="/seguros-education/cedula-a/examenes" element={<CedulaAExamenes />} />
                    <Route path="/seguros-education/cedula-a/examen/:id" element={<ExamenInterface />} />
                    <Route path="/seguros-education/analytics" element={<SegurosEducationAnalytics />} />
                    <Route path="/seguros-education/manuales" element={<SegurosEducationManuales />} />
                    <Route path="/manuales" element={<Manuales />} />
                    <Route path="/manuales/admin" element={<ManualesAdmin />} />
                    <Route path="/manuales/:id" element={<ManualViewer />} />
                    <Route path="/modulo/:id" element={<ModuloViewer />} />

                    {/* Store */}
                    <Route path="/store" element={<Store />} />
                    <Route path="/store/carrito" element={<StoreCarrito />} />
                    <Route path="/store/mis-pedidos" element={<StoreMisPedidos />} />
                    <Route path="/store/mis-pedidos/:id" element={<StorePedidoDetalle />} />
                    <Route path="/store/pedidos" element={<StorePedidos />} />
                    <Route path="/store/pedidos/reporte" element={<StorePedidosReporte />} />
                    <Route path="/store/admin" element={<StoreAdmin />} />

                    {/* Comunicados */}
                    <Route path="/comunicados" element={<Comunicados />} />
                    <Route path="/comunicados/:id" element={<ComunicadoDetalle />} />
                    <Route path="/comunicados/editor" element={<ComunicadoEditor />} />
                    <Route path="/comunicados/editor/:id" element={<ComunicadoEditor />} />
                    <Route path="/comunicados/categorias" element={<ComunicadoCategorias />} />

                    {/* Admin */}
                    <Route path="/directorio" element={<Directorio />} />
                    <Route path="/configuracion" element={<ConfiguracionHub />} />
                    <Route path="/configuracion/catalogos" element={<ConfiguracionCatalogos />} />
                    <Route path="/configuracion/catalogos-web" element={<CatalogosWeb />} />
                    <Route path="/configuracion/oficinas" element={<Oficinas />} />
                    <Route path="/configuracion/gamificacion" element={<GamificacionAdmin />} />
                    <Route path="/configuracion/sicas" element={<SicasAdmin />} />
                    <Route path="/actividad-usuarios" element={<ActividadUsuarios />} />
                    <Route path="/carga-masiva-usuarios" element={<CargaMasivaUsuarios />} />
                    <Route path="/admin-digital" element={<AdminDigital />} />
                    <Route path="/firmas-email" element={<FirmasEmail />} />
                    <Route path="/admin/transaccionales" element={<NotificacionesTransaccionales />} />
                    <Route path="/admin/asistentes" element={<AsistenteEntrenamiento />} />
                    <Route path="/admin/diagnostico" element={<DiagnosticoWebhook />} />
                    <Route path="/sicas/salud" element={<SicasSaludAdmin />} />
                    <Route path="/sicas/diagnostico" element={<SicasDiagnostico />} />

                    {/* Email */}
                    <Route path="/mis-correos" element={<MisCorreos />} />
                    <Route path="/centro-correos" element={<CentroCorreos />} />

                    {/* Meeting */}
                    <Route path="/meet" element={<MoviMeet />} />
                    <Route path="/meet/:id" element={<MeetingRoom />} />

                    {/* Dev/Test */}
                    <Route path="/sicas/test" element={<SicasRestTest />} />
                    <Route path="/chatgpt-test" element={<ChatGPTTest />} />
                    <Route path="/sicas/vigentes-test" element={<SicasVigentesTest />} />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Route>
                </Route>
              </Routes>
            </AssistantProvider>
          </NotificationProvider>
        </ImpersonationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
