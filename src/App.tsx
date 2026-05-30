import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ImpersonationProvider } from './contexts/ImpersonationContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AssistantProvider } from './contexts/AssistantContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

// Eager-loaded pages (critical path)
import { Login } from './pages/Login';
import Registro from './pages/Registro';
import { ResetPassword } from './pages/ResetPassword';
import RegistroPersonal from './pages/RegistroPersonal';
import MagicLinkHandler from './pages/MagicLinkHandler';
import PaginaPublicaAsesor from './pages/PaginaPublicaAsesor';
import PublicQuoteForm from './pages/PublicQuoteForm';
import CertificadoCedulaA from './pages/CertificadoCedulaA';
import { Dashboard } from './pages/Dashboard';

// Seguwallet (eager - separate app)
import { SeguwalletLogin } from './seguwallet/pages/SeguwalletLogin';
import { SeguwalletLayout } from './seguwallet/components/SeguwalletLayout';
import { SeguwalletProtectedRoute } from './seguwallet/components/SeguwalletProtectedRoute';

// Lazy-loaded pages
const Perfil = lazy(() => import('./pages/Perfil').then(m => ({ default: m.Perfil })));
const PerfilUsuario = lazy(() => import('./pages/PerfilUsuario').then(m => ({ default: m.PerfilUsuario })));
const Directorio = lazy(() => import('./pages/Directorio').then(m => ({ default: m.Directorio })));
const ConfiguracionHub = lazy(() => import('./pages/ConfiguracionHub'));
const CentroCorreos = lazy(() => import('./pages/CentroCorreos').then(m => ({ default: m.CentroCorreos })));
const Vacaciones = lazy(() => import('./pages/Vacaciones').then(m => ({ default: m.Vacaciones })));
const EspacioJiro = lazy(() => import('./pages/EspacioJiro').then(m => ({ default: m.EspacioJiro })));
const MulticotizadorDigital = lazy(() => import('./pages/MulticotizadorDigital'));
const AlaMedida = lazy(() => import('./pages/comercial/AlaMedida'));
const DisenadorAuto = lazy(() => import('./pages/comercial/disenadores/DisenadorAuto'));
const DisenadorGMM = lazy(() => import('./pages/comercial/disenadores/DisenadorGMM'));
const FirmasEmail = lazy(() => import('./pages/FirmasEmail').then(m => ({ default: m.FirmasEmail })));
const AccesosNacional = lazy(() => import('./pages/AccesosNacional').then(m => ({ default: m.AccesosNacional })));
const DirectorioJiro = lazy(() => import('./pages/DirectorioJiro').then(m => ({ default: m.DirectorioJiro })));
const SegurosEducation = lazy(() => import('./pages/SegurosEducation').then(m => ({ default: m.SegurosEducation })));
const SegurosEducationOnDemand = lazy(() => import('./pages/SegurosEducationOnDemand').then(m => ({ default: m.SegurosEducationOnDemand })));
const SegurosEducationAulaVirtual = lazy(() => import('./pages/SegurosEducationAulaVirtual').then(m => ({ default: m.SegurosEducationAulaVirtual })));
const SegurosEducationAulaDigital = lazy(() => import('./pages/SegurosEducationAulaDigital').then(m => ({ default: m.SegurosEducationAulaDigital })));
const SegurosEducationAnalytics = lazy(() => import('./pages/SegurosEducationAnalytics').then(m => ({ default: m.SegurosEducationAnalytics })));
const SegurosEducationManuales = lazy(() => import('./pages/SegurosEducationManuales').then(m => ({ default: m.SegurosEducationManuales })));
const Tramites = lazy(() => import('./pages/Tramites').then(m => ({ default: m.Tramites })));
const TramitesReportes = lazy(() => import('./pages/TramitesReportes'));
const TramiteDetalle = lazy(() => import('./pages/TramiteDetalle').then(m => ({ default: m.TramiteDetalle })));
const ConfiguracionCatalogos = lazy(() => import('./pages/ConfiguracionCatalogos').then(m => ({ default: m.ConfiguracionCatalogos })));
const AulaVirtualSala = lazy(() => import('./pages/AulaVirtualSala').then(m => ({ default: m.AulaVirtualSala })));
const MiCRM = lazy(() => import('./pages/MiCRM'));
const CRMContactos = lazy(() => import('./pages/CRMContactos'));
const ContactosCRM = lazy(() => import('./pages/ContactosCRM'));
const CRMContactoPerfil = lazy(() => import('./pages/CRMContactoPerfil'));
const CRMTareas = lazy(() => import('./pages/CRMTareas'));
const CRMReportes = lazy(() => import('./pages/CRMReportes'));
const CRMConfiguracion = lazy(() => import('./pages/CRMConfiguracion'));
const Comunicados = lazy(() => import('./pages/Comunicados'));
const ComunicadoDetalle = lazy(() => import('./pages/ComunicadoDetalle'));
const ComunicadoEditor = lazy(() => import('./pages/ComunicadoEditor'));
const ComunicadoCategorias = lazy(() => import('./pages/ComunicadoCategorias'));
const Store = lazy(() => import('./pages/Store'));
const StoreCarrito = lazy(() => import('./pages/StoreCarrito'));
const StoreMisPedidos = lazy(() => import('./pages/StoreMisPedidos'));
const StorePedidoDetalle = lazy(() => import('./pages/StorePedidoDetalle'));
const StorePedidos = lazy(() => import('./pages/StorePedidos'));
const StorePedidosReporte = lazy(() => import('./pages/StorePedidosReporte'));
const StoreAdmin = lazy(() => import('./pages/StoreAdmin'));
const Comisiones = lazy(() => import('./pages/Comisiones'));
const ComisionesLote = lazy(() => import('./pages/ComisionesLote'));
const MisComisiones = lazy(() => import('./pages/MisComisiones'));
const ComisionesUpload = lazy(() => import('./pages/ComisionesUpload'));
const ComisionesUploadNuevo = lazy(() => import('./pages/ComisionesUploadNuevo'));
const ComisionesPrepararLote = lazy(() => import('./pages/ComisionesPrepararLote'));
const ProduccionSICASLive = lazy(() => import('./pages/ProduccionSICASLive'));
const MiProduccionSICASMirror = lazy(() => import('./pages/MiProduccionSICASMirror'));
const MiProduccion = lazy(() => import('./pages/MiProduccion'));
const MisPolizas = lazy(() => import('./pages/MisPolizas'));
const MapeoVendedores = lazy(() => import('./pages/MapeoVendedores'));
const MapeoVendedoresAdmin = lazy(() => import('./pages/MapeoVendedoresAdmin'));
const GMMCotizador = lazy(() => import('./pages/GMMCotizador'));
const GMMTarifasAdmin = lazy(() => import('./pages/GMMTarifasAdmin'));
const Publicidad = lazy(() => import('./pages/Publicidad').then(m => ({ default: m.Publicidad })));
const Oficinas = lazy(() => import('./pages/Oficinas').then(m => ({ default: m.Oficinas })));
const ActividadUsuarios = lazy(() => import('./pages/ActividadUsuarios').then(m => ({ default: m.ActividadUsuarios })));
const Chava = lazy(() => import('./pages/Chava'));
const Chat = lazy(() => import('./pages/Chat').then(m => ({ default: m.Chat })));
const MeetingRoom = lazy(() => import('./pages/MeetingRoom').then(m => ({ default: m.MeetingRoom })));
const MoviMeet = lazy(() => import('./pages/MoviMeet').then(m => ({ default: m.MoviMeet })));
const Contactos = lazy(() => import('./pages/Contactos').then(m => ({ default: m.Contactos })));
const CentroNotificaciones = lazy(() => import('./pages/CentroNotificaciones').then(m => ({ default: m.CentroNotificaciones })));
const NotificacionesTransaccionales = lazy(() => import('./pages/NotificacionesTransaccionales').then(m => ({ default: m.NotificacionesTransaccionales })));
const ProduccionTotal = lazy(() => import('./pages/ProduccionTotal'));
const ProduccionCargar = lazy(() => import('./pages/ProduccionCargar'));
const ProduccionConfiguracion = lazy(() => import('./pages/ProduccionConfiguracion'));
const ProduccionConvenio = lazy(() => import('./pages/ProduccionConvenio'));
const DocumentosImportar = lazy(() => import('./pages/DocumentosImportar'));
const GamificacionAdmin = lazy(() => import('./pages/GamificacionAdmin'));
const RegimenFiscalAdmin = lazy(() => import('./pages/RegimenFiscalAdmin'));
const RegimenFiscalEditor = lazy(() => import('./pages/RegimenFiscalEditor'));
const SicasAdmin = lazy(() => import('./pages/SicasAdmin'));
const SicasDiagnostico = lazy(() => import('./pages/SicasDiagnostico'));
const CargaMasivaUsuarios = lazy(() => import('./pages/CargaMasivaUsuarios'));
const MiMarca = lazy(() => import('./pages/MiMarca'));
const MiPaginaWeb = lazy(() => import('./pages/MiPaginaWeb'));
const QuoteFormWizard = lazy(() => import('./pages/QuoteFormWizard'));
const MiProgreso = lazy(() => import('./pages/MiProgreso'));
const MisCorreos = lazy(() => import('./pages/MisCorreos').then(m => ({ default: m.MisCorreos })));
const GestorEmails = lazy(() => import('./pages/GestorEmails').then(m => ({ default: m.GestorEmails })));
const MiWhatsApp = lazy(() => import('./pages/MiWhatsApp'));
const CentroDigital = lazy(() => import('./pages/CentroDigital'));
const CentroContacto = lazy(() => import('./pages/CentroContacto'));
const CentroContactoHub = lazy(() => import('./pages/CentroContactoHub'));
const CentroContactoUnificado = lazy(() => import('./pages/CentroContactoUnificado'));
const CentroContactoAsistentes = lazy(() => import('./pages/CentroContactoAsistentes'));
const FormulariosCotizacion = lazy(() => import('./pages/FormulariosCotizacion'));
const Mercadotecnia = lazy(() => import('./pages/Mercadotecnia'));
const EntregaPolizas = lazy(() => import('./pages/EntregaPolizas'));
const LectorQualitas = lazy(() => import('./pages/LectorQualitas'));
const SeguwalletAdmin = lazy(() => import('./pages/SeguwalletAdmin').then(m => ({ default: m.SeguwalletAdmin })));
const AdminDigital = lazy(() => import('./pages/AdminDigital'));
const BaseConocimientoAdmin = lazy(() => import('./pages/BaseConocimientoAdmin'));
const CursoCedulaA = lazy(() => import('./pages/CursoCedulaA'));
const CedulaAExamenes = lazy(() => import('./pages/CedulaAExamenes'));
const ExamenInterface = lazy(() => import('./pages/ExamenInterface'));
const AsistenteEntrenamiento = lazy(() => import('./pages/AsistenteEntrenamiento'));
const SicasRestTest = lazy(() => import('./pages/SicasRestTest'));
const DiagnosticoWebhook = lazy(() => import('./pages/DiagnosticoWebhook'));
const Manuales = lazy(() => import('./pages/Manuales'));
const ManualesAdmin = lazy(() => import('./pages/ManualesAdmin'));
const ManualViewer = lazy(() => import('./pages/ManualViewer'));
const ModuloViewer = lazy(() => import('./pages/ModuloViewer'));
const CatalogosWeb = lazy(() => import('./pages/CatalogosWeb'));
const CotizarHub = lazy(() => import('./pages/CotizarHub'));
const ChavaAdmin = lazy(() => import('./pages/ChavaAdmin'));
const ChatGPTTest = lazy(() => import('./pages/ChatGPTTest'));
const SicasVigentesTest = lazy(() => import('./pages/SicasVigentesTest'));
const SicasSaludAdmin = lazy(() => import('./pages/SicasSaludAdmin'));

// Seguwallet lazy pages
const SeguwalletDashboard = lazy(() => import('./seguwallet/pages/SeguwalletDashboard').then(m => ({ default: m.SeguwalletDashboard })));
const SeguwalletPolizas = lazy(() => import('./seguwallet/pages/SeguwalletPolizas').then(m => ({ default: m.SeguwalletPolizas })));
const SeguwalletPerfil = lazy(() => import('./seguwallet/pages/SeguwalletPerfil').then(m => ({ default: m.SeguwalletPerfil })));
const SeguwalletCompleteProfile = lazy(() => import('./seguwallet/pages/SeguwalletCompleteProfile').then(m => ({ default: m.SeguwalletCompleteProfile })));
const SeguwalletAseguradoras = lazy(() => import('./seguwallet/pages/SeguwalletAseguradoras').then(m => ({ default: m.SeguwalletAseguradoras })));
const SeguwalletCotizar = lazy(() => import('./seguwallet/pages/SeguwalletCotizar').then(m => ({ default: m.SeguwalletCotizar })));
const SeguwalletDescargas = lazy(() => import('./seguwallet/pages/SeguwalletDescargas').then(m => ({ default: m.SeguwalletDescargas })));
const SeguwalletChava = lazy(() => import('./seguwallet/pages/SeguwalletChava').then(m => ({ default: m.SeguwalletChava })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ImpersonationProvider>
          <NotificationProvider>
            <AssistantProvider>
              <Suspense fallback={<PageLoader />}>
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
                    <Route path="chava" element={<SeguwalletChava />} />
                  </Route>
                  <Route path="/seguwallet" element={<SeguwalletProtectedRoute><SeguwalletLayout><Outlet /></SeguwalletLayout></SeguwalletProtectedRoute>}>
                    <Route index element={<Navigate to="/seguwallet/dashboard" replace />} />
                    <Route path="dashboard" element={<SeguwalletDashboard />} />
                    <Route path="polizas" element={<SeguwalletPolizas />} />
                    <Route path="perfil" element={<SeguwalletPerfil />} />
                    <Route path="complete-profile" element={<SeguwalletCompleteProfile />} />
                    <Route path="aseguradoras" element={<SeguwalletAseguradoras />} />
                    <Route path="cotizar" element={<SeguwalletCotizar />} />
                    <Route path="descargas" element={<SeguwalletDescargas />} />
                    <Route path="chava" element={<SeguwalletChava />} />
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
                      <Route path="/admin/base-conocimiento" element={<BaseConocimientoAdmin />} />
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
              </Suspense>
            </AssistantProvider>
          </NotificationProvider>
        </ImpersonationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
