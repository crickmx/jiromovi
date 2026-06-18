import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { Layout } from '../components/Layout';
import { AssistantProvider } from '../contexts/AssistantContext';
import { NotificationProvider } from '../contexts/NotificationContext';

// Top-level MOVI pages
const MoviDashboard = lazy(() => import('./Dashboard'));
const Chava = lazy(() => import('./Chava'));
const Store = lazy(() => import('./Store'));
const StoreCarrito = lazy(() => import('./StoreCarrito'));
const StoreAdmin = lazy(() => import('./StoreAdmin'));
const StorePedidos = lazy(() => import('./StorePedidos'));
const StoreMisPedidos = lazy(() => import('./StoreMisPedidos'));
const StorePedidoDetalle = lazy(() => import('./StorePedidoDetalle'));
const StorePedidosReporte = lazy(() => import('./StorePedidosReporte'));
const Comunicados = lazy(() => import('./Comunicados'));
const ComunicadoDetalle = lazy(() => import('./ComunicadoDetalle'));
const ComunicadoEditor = lazy(() => import('./ComunicadoEditor'));
const ComunicadoCategorias = lazy(() => import('./ComunicadoCategorias'));

// Comercial
const Contactos = lazy(() => import('./ContactosCRM'));
const MiCRM = lazy(() => import('./MiCRM'));
const CRMContactoPerfil = lazy(() => import('./CRMContactoPerfil'));
const CRMTareas = lazy(() => import('./CRMTareas'));
const CRMReportes = lazy(() => import('./CRMReportes'));
const CRMConfiguracion = lazy(() => import('./CRMConfiguracion'));
const Tramites = lazy(() => import('./Tramites'));
const TramiteDetalle = lazy(() => import('./TramiteDetalle'));
const TramitesReportes = lazy(() => import('./TramitesReportes'));
const EntregaPolizas = lazy(() => import('./EntregaPolizas'));
const MisPolizas = lazy(() => import('./MisPolizas'));
const PolizaDetalle = lazy(() => import('./PolizaDetalle'));
const LectorQualitas = lazy(() => import('./LectorQualitas'));
const MiProgreso = lazy(() => import('./MiProgreso'));
const SeguwalletAdmin = lazy(() => import('./SeguwalletAdmin'));

// Centro de Contacto
const CentroContactoLayout = lazy(() => import('./CentroContactoLayout'));
const CentroContactoHub = lazy(() => import('./CentroContactoHub'));
const CentroContactoUnificado = lazy(() => import('./CentroContactoUnificado'));
const GestorEmails = lazy(() => import('./GestorEmails'));
const Chat = lazy(() => import('./Chat'));
const DirectorioJiro = lazy(() => import('./DirectorioJiro'));
const CentroNotificaciones = lazy(() => import('./CentroNotificaciones'));

// Cotizar
const CotizarHub = lazy(() => import('./CotizarHub'));
const GMMCotizador = lazy(() => import('./GMMCotizador'));
const FormulariosCotizacion = lazy(() => import('./FormulariosCotizacion'));
const PublicQuoteForm = lazy(() => import('./PublicQuoteForm'));
const QuoteFormWizard = lazy(() => import('./QuoteFormWizard'));
const MulticotizadorDigital = lazy(() => import('./MulticotizadorDigital'));
const AlaMedida = lazy(() => import('./comercial/AlaMedida'));
const DisenadorAuto = lazy(() => import('./comercial/disenadores/DisenadorAuto'));
const DisenadorGMM = lazy(() => import('./comercial/disenadores/DisenadorGMM'));
const MulticotizadorGMM = lazy(() => import('./MulticotizadorGMM'));

// Operaciones
const BonosPage = lazy(() => import('./BonosPage'));
const Comisiones = lazy(() => import('./Comisiones'));
const ComisionesUpload = lazy(() => import('./ComisionesUpload'));
const ComisionesUploadNuevo = lazy(() => import('./ComisionesUploadNuevo'));
const ComisionesPrepararLote = lazy(() => import('./ComisionesPrepararLote'));
const ComisionesLote = lazy(() => import('./ComisionesLote'));
const EspacioJiro = lazy(() => import('./EspacioJiro'));
const Vacaciones = lazy(() => import('./Vacaciones'));
const AccesosNacional = lazy(() => import('./AccesosNacional'));

// Mercadotecnia
const MiMarca = lazy(() => import('./MiMarca'));
const Publicidad = lazy(() => import('./Publicidad'));
const MiPaginaWeb = lazy(() => import('./MiPaginaWeb'));
const CentroDigital = lazy(() => import('./CentroDigital'));

// Seguros Education
const SegurosEducation = lazy(() => import('./SegurosEducation'));
const SegurosEducationOnDemand = lazy(() => import('./SegurosEducationOnDemand'));
const SegurosEducationAulaVirtual = lazy(() => import('./SegurosEducationAulaVirtual'));
const AulaVirtualSala = lazy(() => import('./AulaVirtualSala'));
const SegurosEducationCedulaA = lazy(() => import('./CursoCedulaA'));
const CedulaAExamenes = lazy(() => import('./CedulaAExamenes'));
const ModuloViewer = lazy(() => import('./ModuloViewer'));
const ExamenInterface = lazy(() => import('./ExamenInterface'));
const CertificadoCedulaA = lazy(() => import('./CertificadoCedulaA'));
const Manuales = lazy(() => import('./Manuales'));
const ManualViewer = lazy(() => import('./ManualViewer'));
const SegurosEducationAnalytics = lazy(() => import('./SegurosEducationAnalytics'));

// Admin
const Directorio = lazy(() => import('./Directorio'));
const PerfilUsuario = lazy(() => import('./PerfilUsuario'));
const Configuracion = lazy(() => import('./Configuracion'));
const ConfiguracionHub = lazy(() => import('./ConfiguracionHub'));
const ConfiguracionCatalogos = lazy(() => import('./ConfiguracionCatalogos'));
const CatalogosWeb = lazy(() => import('./CatalogosWeb'));
const ActividadUsuarios = lazy(() => import('./ActividadUsuarios'));
const CargaMasivaUsuarios = lazy(() => import('./CargaMasivaUsuarios'));
const AdminDigital = lazy(() => import('./AdminDigital'));
const BaseConocimientoAdmin = lazy(() => import('./BaseConocimientoAdmin'));
const ImportacionMasivaCentroDigital = lazy(() => import('./ImportacionMasivaCentroDigital'));
const RegimenFiscalAdmin = lazy(() => import('./RegimenFiscalAdmin'));
const RegimenFiscalEditor = lazy(() => import('./RegimenFiscalEditor'));
const MapeoVendedoresAdmin = lazy(() => import('./MapeoVendedoresAdmin'));
const SicasSaludAdmin = lazy(() => import('./SicasSaludAdmin'));
const AsistenteEntrenamiento = lazy(() => import('./AsistenteEntrenamiento'));
const ChavaAdmin = lazy(() => import('./ChavaAdmin'));
const ChavaInteligencia = lazy(() => import('./ChavaInteligencia'));
const FirmasEmail = lazy(() => import('./FirmasEmail'));
const NotificacionesTransaccionales = lazy(() => import('./NotificacionesTransaccionales'));
const DiagnosticoWebhook = lazy(() => import('./DiagnosticoWebhook'));
const GamificacionAdmin = lazy(() => import('./GamificacionAdmin'));
const AutomatizacionIA = lazy(() => import('./AutomatizacionIA'));
const MascaraAdmin = lazy(() => import('./MascaraAdmin'));
const TelefoniaAdmin = lazy(() => import('./TelefoniaAdmin'));
const ModulosAdmin = lazy(() => import('./ModulosAdmin'));

// Shared
const Perfil = lazy(() => import('./Perfil'));
const Oficinas = lazy(() => import('./Oficinas'));
const RegistroPersonal = lazy(() => import('./RegistroPersonal'));
const PaginaPublicaAsesor = lazy(() => import('./PaginaPublicaAsesor'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-slate-600 animate-spin" />
    </div>
  );
}

function LayoutShell() {
  return (
    <NotificationProvider>
      <AssistantProvider>
        <Layout>
          <Outlet />
        </Layout>
      </AssistantProvider>
    </NotificationProvider>
  );
}

export default function MoviFullRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public / no-layout routes */}
        <Route path="/registro-personal" element={<RegistroPersonal />} />
        <Route path="/p/:slug" element={<PaginaPublicaAsesor />} />
        <Route path="/cotizar/formularios/:slug" element={<PublicQuoteForm />} />

        {/* All authenticated MOVI routes — wrapped in Layout + providers */}
        <Route element={<LayoutShell />}>
          <Route path="/dashboard" element={<ProtectedRoute><MoviDashboard /></ProtectedRoute>} />
          <Route path="/chava" element={<ProtectedRoute><Chava /></ProtectedRoute>} />
          <Route path="/store" element={<ProtectedRoute><Store /></ProtectedRoute>} />
          <Route path="/store/carrito" element={<ProtectedRoute><StoreCarrito /></ProtectedRoute>} />
          <Route path="/store/admin" element={<ProtectedRoute><StoreAdmin /></ProtectedRoute>} />
          <Route path="/store/pedidos" element={<ProtectedRoute><StorePedidos /></ProtectedRoute>} />
          <Route path="/store/mis-pedidos" element={<ProtectedRoute><StoreMisPedidos /></ProtectedRoute>} />
          <Route path="/store/pedido/:id" element={<ProtectedRoute><StorePedidoDetalle /></ProtectedRoute>} />
          <Route path="/store/reporte" element={<ProtectedRoute><StorePedidosReporte /></ProtectedRoute>} />
          <Route path="/comunicados" element={<ProtectedRoute><Comunicados /></ProtectedRoute>} />
          <Route path="/comunicados/:id" element={<ProtectedRoute><ComunicadoDetalle /></ProtectedRoute>} />
          <Route path="/comunicados/editor/:id" element={<ProtectedRoute><ComunicadoEditor /></ProtectedRoute>} />
          <Route path="/comunicados/categorias" element={<ProtectedRoute><ComunicadoCategorias /></ProtectedRoute>} />

          {/* Comercial */}
          <Route path="/contactos" element={<ProtectedRoute><Contactos /></ProtectedRoute>} />
          <Route path="/contactos/:id" element={<ProtectedRoute><CRMContactoPerfil /></ProtectedRoute>} />
          <Route path="/mi-crm" element={<ProtectedRoute><MiCRM /></ProtectedRoute>} />
          <Route path="/mi-crm/contactos" element={<Navigate to="/contactos" replace />} />
          <Route path="/mi-crm/contactos/:id" element={<ProtectedRoute><CRMContactoPerfil /></ProtectedRoute>} />
          <Route path="/mi-crm/tareas" element={<ProtectedRoute><CRMTareas /></ProtectedRoute>} />
          <Route path="/mi-crm/reportes" element={<ProtectedRoute><CRMReportes /></ProtectedRoute>} />
          <Route path="/mi-crm/configuracion" element={<ProtectedRoute><CRMConfiguracion /></ProtectedRoute>} />
          <Route path="/tramites" element={<ProtectedRoute><Tramites /></ProtectedRoute>} />
          <Route path="/tramites/:id" element={<ProtectedRoute><TramiteDetalle /></ProtectedRoute>} />
          <Route path="/tramites/reportes" element={<ProtectedRoute><TramitesReportes /></ProtectedRoute>} />
          <Route path="/entrega-polizas" element={<ProtectedRoute><EntregaPolizas /></ProtectedRoute>} />
          <Route path="/mis-polizas" element={<ProtectedRoute><MisPolizas /></ProtectedRoute>} />
          <Route path="/mis-polizas/:id" element={<ProtectedRoute><PolizaDetalle /></ProtectedRoute>} />
          <Route path="/lector-qualitas" element={<ProtectedRoute><LectorQualitas /></ProtectedRoute>} />
          <Route path="/mi-progreso" element={<ProtectedRoute><MiProgreso /></ProtectedRoute>} />
          <Route path="/seguwallet-admin" element={<ProtectedRoute><SeguwalletAdmin /></ProtectedRoute>} />

          {/* Centro de Contacto — nested under CentroContactoLayout */}
          <Route path="/centro-contacto" element={<ProtectedRoute><CentroContactoLayout /></ProtectedRoute>}>
            <Route index element={<CentroContactoHub />} />
            <Route path="whatsapp" element={<CentroContactoUnificado />} />
            <Route path="email" element={<GestorEmails />} />
            <Route path="chat" element={<Chat />} />
            <Route path="notificaciones" element={<ProtectedRoute requireAdmin><CentroNotificaciones /></ProtectedRoute>} />
          </Route>
          <Route path="/directorio-jiro" element={<ProtectedRoute><DirectorioJiro /></ProtectedRoute>} />
          {/* Legacy email redirect */}
          <Route path="/mercadotecnia/gestor-emails" element={<Navigate to="/centro-contacto/email" replace />} />

          {/* Cotizar */}
          <Route path="/cotizar" element={<ProtectedRoute><CotizarHub /></ProtectedRoute>} />
          <Route path="/cotizar/gmm-bx" element={<ProtectedRoute><GMMCotizador /></ProtectedRoute>} />
          <Route path="/cotizar/formularios" element={<ProtectedRoute><FormulariosCotizacion /></ProtectedRoute>} />
          <Route path="/cotizar/formularios/:slug/wizard" element={<ProtectedRoute><QuoteFormWizard /></ProtectedRoute>} />
          <Route path="/cotizar/a-la-medida" element={<ProtectedRoute><AlaMedida /></ProtectedRoute>} />
          <Route path="/cotizar/a-la-medida/auto" element={<ProtectedRoute><DisenadorAuto /></ProtectedRoute>} />
          <Route path="/cotizar/a-la-medida/gmm" element={<ProtectedRoute><DisenadorGMM /></ProtectedRoute>} />
          <Route path="/cotizar/multicotizador" element={<ProtectedRoute><MulticotizadorDigital /></ProtectedRoute>} />
          <Route path="/cotizar/multicotizador-gmm" element={<ProtectedRoute><MulticotizadorGMM /></ProtectedRoute>} />

          {/* Central de Produccion */}
          <Route path="/produccion" element={<ProtectedRoute><BonosPage /></ProtectedRoute>} />
          {/* Legacy production route redirects */}
          <Route path="/produccion/*" element={<Navigate to="/produccion" replace />} />
          <Route path="/mi-produccion-sicas-live" element={<Navigate to="/produccion" replace />} />
          <Route path="/mis-comisiones" element={<Navigate to="/produccion" replace />} />

          {/* Comisiones Admin */}
          <Route path="/comisiones" element={<ProtectedRoute requireAdmin><Comisiones /></ProtectedRoute>} />
          <Route path="/comisiones/upload" element={<ProtectedRoute requireAdmin><ComisionesUpload /></ProtectedRoute>} />
          <Route path="/comisiones/upload-nuevo" element={<ProtectedRoute requireAdmin><ComisionesUploadNuevo /></ProtectedRoute>} />
          <Route path="/comisiones/preparar-lote" element={<ProtectedRoute requireAdmin><ComisionesPrepararLote /></ProtectedRoute>} />
          <Route path="/comisiones/lote/:id" element={<ProtectedRoute requireAdmin><ComisionesLote /></ProtectedRoute>} />

          {/* Operaciones */}
          <Route path="/espacio-jiro" element={<ProtectedRoute><EspacioJiro /></ProtectedRoute>} />
          <Route path="/vacaciones" element={<ProtectedRoute><Vacaciones /></ProtectedRoute>} />
          <Route path="/accesos-nacional" element={<ProtectedRoute><AccesosNacional /></ProtectedRoute>} />

          {/* Mercadotecnia */}
          <Route path="/mercadotecnia/publicidad" element={<ProtectedRoute><Publicidad key="publicidad" /></ProtectedRoute>} />
          <Route path="/mercadotecnia/mis-disenos" element={<ProtectedRoute><Publicidad key="mis-disenos" initialTab="mis-disenos" /></ProtectedRoute>} />
          <Route path="/mercadotecnia/mi-pagina-web" element={<ProtectedRoute><MiPaginaWeb /></ProtectedRoute>} />
          <Route path="/mercadotecnia/mi-marca" element={<ProtectedRoute><MiMarca /></ProtectedRoute>} />
          <Route path="/centro-digital" element={<ProtectedRoute><CentroDigital /></ProtectedRoute>} />

          {/* Seguros Education */}
          <Route path="/seguros-education" element={<ProtectedRoute><SegurosEducation /></ProtectedRoute>} />
          <Route path="/seguros-education/on-demand" element={<ProtectedRoute><SegurosEducationOnDemand /></ProtectedRoute>} />
          <Route path="/seguros-education/aula-virtual" element={<ProtectedRoute><SegurosEducationAulaVirtual /></ProtectedRoute>} />
          <Route path="/seguros-education/aula-virtual/:id" element={<ProtectedRoute><AulaVirtualSala /></ProtectedRoute>} />
          <Route path="/seguros-education/cedula-a" element={<ProtectedRoute><SegurosEducationCedulaA /></ProtectedRoute>} />
          <Route path="/seguros-education/cedula-a/modulo/:moduloId" element={<ProtectedRoute><ModuloViewer /></ProtectedRoute>} />
          <Route path="/seguros-education/cedula-a/examenes" element={<ProtectedRoute><CedulaAExamenes /></ProtectedRoute>} />
          <Route path="/seguros-education/cedula-a/examen/:examenId" element={<ProtectedRoute><ExamenInterface /></ProtectedRoute>} />
          <Route path="/seguros-education/cedula-a/certificado" element={<ProtectedRoute><CertificadoCedulaA /></ProtectedRoute>} />
          <Route path="/manuales" element={<ProtectedRoute><Manuales /></ProtectedRoute>} />
          <Route path="/manuales/:slug" element={<ProtectedRoute><ManualViewer /></ProtectedRoute>} />
          <Route path="/seguros-education/analytics" element={<ProtectedRoute><SegurosEducationAnalytics /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/directorio" element={<ProtectedRoute requireAdminOrGerente><Directorio /></ProtectedRoute>} />
          <Route path="/directorio/:id" element={<ProtectedRoute requireAdminOrGerente><PerfilUsuario /></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute requireAdmin><Configuracion /></ProtectedRoute>} />
          <Route path="/configuracion/hub" element={<ProtectedRoute requireAdmin><ConfiguracionHub /></ProtectedRoute>} />
          <Route path="/configuracion/catalogos" element={<ProtectedRoute requireAdmin><ConfiguracionCatalogos /></ProtectedRoute>} />
          <Route path="/configuracion/catalogos-web" element={<ProtectedRoute requireAdmin><CatalogosWeb /></ProtectedRoute>} />
          <Route path="/actividad-usuarios" element={<ProtectedRoute requireAdmin><ActividadUsuarios /></ProtectedRoute>} />
          <Route path="/carga-masiva-usuarios" element={<ProtectedRoute requireAdmin><CargaMasivaUsuarios /></ProtectedRoute>} />
          <Route path="/admin-digital" element={<ProtectedRoute requireAdmin><AdminDigital /></ProtectedRoute>} />
          <Route path="/admin/base-conocimiento" element={<ProtectedRoute requireAdmin><BaseConocimientoAdmin /></ProtectedRoute>} />
          <Route path="/admin/importacion-masiva" element={<ProtectedRoute requireAdmin><ImportacionMasivaCentroDigital /></ProtectedRoute>} />
          <Route path="/comisiones/regimen-fiscal" element={<ProtectedRoute requireAdmin><RegimenFiscalAdmin /></ProtectedRoute>} />
          <Route path="/comisiones/regimen-fiscal/:id" element={<ProtectedRoute requireAdmin><RegimenFiscalEditor /></ProtectedRoute>} />
          <Route path="/comisiones/mapeo-vendedores" element={<ProtectedRoute requireAdmin><MapeoVendedoresAdmin /></ProtectedRoute>} />
          <Route path="/sicas/salud" element={<ProtectedRoute requireAdmin><SicasSaludAdmin /></ProtectedRoute>} />
          <Route path="/admin/asistentes" element={<ProtectedRoute requireAdminOrGerente><AsistenteEntrenamiento /></ProtectedRoute>} />
          <Route path="/admin/asistentes/:id" element={<ProtectedRoute requireAdminOrGerente><AsistenteEntrenamiento /></ProtectedRoute>} />
          <Route path="/admin/chava-ia" element={<ProtectedRoute requireAdmin><ChavaAdmin /></ProtectedRoute>} />
          <Route path="/admin/chava-inteligencia" element={<ProtectedRoute requireAdmin><ChavaInteligencia /></ProtectedRoute>} />
          <Route path="/firmas-email" element={<ProtectedRoute requireAdmin><FirmasEmail /></ProtectedRoute>} />
          <Route path="/admin/transaccionales" element={<ProtectedRoute requireAdmin><NotificacionesTransaccionales /></ProtectedRoute>} />
          <Route path="/admin/diagnostico" element={<ProtectedRoute requireAdmin><DiagnosticoWebhook /></ProtectedRoute>} />
          <Route path="/admin/mascara" element={<ProtectedRoute requireAdmin><MascaraAdmin /></ProtectedRoute>} />
          <Route path="/admin/telefonia" element={<ProtectedRoute requireAdmin><TelefoniaAdmin /></ProtectedRoute>} />
          <Route path="/admin/gamificacion" element={<ProtectedRoute requireAdmin><GamificacionAdmin /></ProtectedRoute>} />
          <Route path="/admin/automatizacion-ia" element={<ProtectedRoute requireAdmin><AutomatizacionIA /></ProtectedRoute>} />
          <Route path="/admin/modulos" element={<ProtectedRoute requireAdmin><ModulosAdmin /></ProtectedRoute>} />

          {/* Shared profile */}
          <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
          <Route path="/oficinas" element={<ProtectedRoute><Oficinas /></ProtectedRoute>} />

          {/* Catch-all within MOVI */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
