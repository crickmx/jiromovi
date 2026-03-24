import { useState, useEffect } from 'react';
import { Folder, Plus, Search, Filter, File, Download, CreditCard as Edit, Trash2, RotateCcw, Eye, Upload, Building2, Users, MoreVertical, Archive, FileText, FileSpreadsheet, FileImage, FileVideo, FileAudio, Grid2x2 as Grid, List } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui/page-header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/ui/empty-state';
import { useAuth } from '../contexts/AuthContext';
import { CarpetaModal } from '../components/centroDigital/CarpetaModal';
import { SubirArchivoModal } from '../components/centroDigital/SubirArchivoModal';
import {
  obtenerCarpetas,
  obtenerArchivos,
  obtenerArchivosPapelera,
  descargarArchivo,
  actualizarNombreArchivo,
  eliminarArchivo,
  restaurarArchivo,
  eliminarArchivoDefinitivamente,
  eliminarCarpeta,
  formatearTamano,
  obtenerIconoArchivo
} from '../lib/centroDigitalUtils';
import type {
  CentroDigitalCarpeta,
  CentroDigitalArchivo
} from '../lib/centroDigitalTypes';

export default function CentroDigital() {
  const { usuario } = useAuth();
  const [carpetas, setCarpetas] = useState<CentroDigitalCarpeta[]>([]);
  const [carpetaSeleccionada, setCarpetaSeleccionada] =
    useState<CentroDigitalCarpeta | null>(null);
  const [archivos, setArchivos] = useState<CentroDigitalArchivo[]>([]);
  const [archivosPapelera, setArchivosPapelera] = useState<CentroDigitalArchivo[]>(
    []
  );

  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCarpetaModal, setShowCarpetaModal] = useState(false);
  const [showSubirModal, setShowSubirModal] = useState(false);
  const [showPapelera, setShowPapelera] = useState(false);
  const [carpetaEditar, setCarpetaEditar] = useState<CentroDigitalCarpeta | null>(
    null
  );
  const [vistaArchivos, setVistaArchivos] = useState<'grid' | 'list'>('grid');
  const [archivoPrevisualizar, setArchivoPrevisualizar] = useState<CentroDigitalArchivo | null>(null);

  const esAdmin = usuario?.rol === 'Administrador';
  const esGerente = usuario?.rol === 'Gerente';
  const esEmpleado = usuario?.rol === 'Empleado';
  const esAgente = usuario?.rol === 'Agente';
  const puedeSubirArchivos = esAdmin || esGerente;
  const puedeCrearCarpetas = esAdmin || esGerente;

  const obtenerIconoPorTipo = (tipoMime: string | null) => {
    if (!tipoMime) return <File className="w-8 h-8 text-gray-400" />;

    if (tipoMime.startsWith('image/')) {
      return <FileImage className="w-8 h-8 text-blue-500" />;
    }
    if (tipoMime.startsWith('video/')) {
      return <FileVideo className="w-8 h-8 text-purple-500" />;
    }
    if (tipoMime.startsWith('audio/')) {
      return <FileAudio className="w-8 h-8 text-green-500" />;
    }
    if (tipoMime.includes('pdf')) {
      return <FileText className="w-8 h-8 text-red-500" />;
    }
    if (
      tipoMime.includes('sheet') ||
      tipoMime.includes('excel') ||
      tipoMime.includes('csv')
    ) {
      return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
    }
    if (
      tipoMime.includes('document') ||
      tipoMime.includes('word') ||
      tipoMime.includes('text')
    ) {
      return <FileText className="w-8 h-8 text-blue-600" />;
    }

    return <File className="w-8 h-8 text-gray-400" />;
  };

  const esImagen = (tipoMime: string | null) => {
    return tipoMime?.startsWith('image/') || false;
  };

  const esPDF = (tipoMime: string | null) => {
    return tipoMime?.includes('pdf') || false;
  };

  const esPrevisualizable = (tipoMime: string | null) => {
    return esImagen(tipoMime) || esPDF(tipoMime);
  };

  const handlePrevisualizar = (archivo: CentroDigitalArchivo) => {
    if (esPrevisualizable(archivo.tipo_mime)) {
      setArchivoPrevisualizar(archivo);
    }
  };

  useEffect(() => {
    cargarCarpetas();
  }, []);

  useEffect(() => {
    if (carpetaSeleccionada) {
      cargarArchivos(carpetaSeleccionada.id);
    }
  }, [carpetaSeleccionada]);

  useEffect(() => {
    if (showPapelera && esAdmin) {
      cargarPapelera();
    }
  }, [showPapelera, esAdmin]);

  async function cargarCarpetas() {
    try {
      setLoading(true);
      const data = await obtenerCarpetas();
      setCarpetas(data);
    } catch (error) {
      console.error('Error al cargar carpetas:', error);
    } finally {
      setLoading(false);
    }
  }

  async function cargarArchivos(carpetaId: string) {
    try {
      const data = await obtenerArchivos(carpetaId);
      setArchivos(data);
    } catch (error) {
      console.error('Error al cargar archivos:', error);
    }
  }

  async function cargarPapelera() {
    try {
      const data = await obtenerArchivosPapelera();
      setArchivosPapelera(data);
    } catch (error) {
      console.error('Error al cargar papelera:', error);
    }
  }

  async function handleEliminarCarpeta(carpetaId: string) {
    if (!confirm('¿Estás seguro de eliminar esta carpeta?')) return;

    try {
      await eliminarCarpeta(carpetaId);
      await cargarCarpetas();
      if (carpetaSeleccionada?.id === carpetaId) {
        setCarpetaSeleccionada(null);
      }
    } catch (error) {
      console.error('Error al eliminar carpeta:', error);
      alert('Error al eliminar la carpeta');
    }
  }

  async function handleDescargar(archivo: CentroDigitalArchivo) {
    try {
      await descargarArchivo(archivo);
    } catch (error) {
      console.error('Error al descargar archivo:', error);
      alert('Error al descargar el archivo');
    }
  }

  async function handleEliminarArchivo(archivoId: string) {
    if (!confirm('¿Mover este archivo a la papelera?')) return;

    try {
      await eliminarArchivo(archivoId);
      if (carpetaSeleccionada) {
        await cargarArchivos(carpetaSeleccionada.id);
      }
    } catch (error) {
      console.error('Error al eliminar archivo:', error);
      alert('Error al eliminar el archivo');
    }
  }

  async function handleRestaurarArchivo(archivoId: string) {
    try {
      await restaurarArchivo(archivoId);
      await cargarPapelera();
    } catch (error) {
      console.error('Error al restaurar archivo:', error);
      alert('Error al restaurar el archivo');
    }
  }

  async function handleEliminarDefinitivo(archivoId: string) {
    if (
      !confirm(
        '¿Eliminar definitivamente este archivo? Esta acción no se puede deshacer.'
      )
    )
      return;

    try {
      await eliminarArchivoDefinitivamente(archivoId);
      await cargarPapelera();
    } catch (error) {
      console.error('Error al eliminar archivo:', error);
      alert('Error al eliminar el archivo');
    }
  }

  const carpetasFiltradas = carpetas.filter((carpeta) =>
    carpeta.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const archivosFiltrados = archivos.filter((archivo) =>
    archivo.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto" />
            <p className="mt-4 text-gray-600">Cargando Centro Digital...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (showPapelera && esAdmin) {
    return (
      <Layout>
        <PageHeader
          title="Papelera de archivos"
          description="Archivos eliminados por usuarios"
        >
          <Button variant="outline" onClick={() => setShowPapelera(false)}>
            Volver al Centro Digital
          </Button>
        </PageHeader>

        <div className="p-6">
          {archivosPapelera.length === 0 ? (
            <EmptyState
              icon={Archive}
              title="Papelera vacía"
              description="No hay archivos eliminados"
            />
          ) : (
            <div className="bg-white rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Archivo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Carpeta
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Eliminado por
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {archivosPapelera.map((archivo) => (
                      <tr key={archivo.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <File className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">
                                {archivo.nombre}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatearTamano(archivo.tamano_bytes)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {archivo.carpeta?.nombre || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {archivo.eliminador?.nombre_completo || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {archivo.fecha_eliminacion
                            ? new Date(archivo.fecha_eliminacion).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRestaurarArchivo(archivo.id)}
                              className="text-green-600 hover:text-green-700"
                              title="Restaurar"
                            >
                              <RotateCcw className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleEliminarDefinitivo(archivo.id)}
                              className="text-red-600 hover:text-red-700"
                              title="Eliminar definitivamente"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (carpetaSeleccionada) {
    return (
      <Layout>
        <PageHeader
          title={carpetaSeleccionada.nombre}
          description={carpetaSeleccionada.descripcion || 'Archivos de la carpeta'}
        >
          <div className="flex gap-2">
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setVistaArchivos('grid')}
                className={`px-3 py-2 ${
                  vistaArchivos === 'grid'
                    ? 'bg-accent text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="Vista de cuadrícula"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setVistaArchivos('list')}
                className={`px-3 py-2 ${
                  vistaArchivos === 'list'
                    ? 'bg-accent text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="Vista de lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button
              variant="outline"
              onClick={() => setCarpetaSeleccionada(null)}
            >
              Volver a carpetas
            </Button>
            {puedeSubirArchivos && (
              <Button onClick={() => setShowSubirModal(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Subir archivo
              </Button>
            )}
          </div>
        </PageHeader>

        <div className="p-6">
          {archivos.length === 0 ? (
            <div className="bg-white rounded-lg border">
              <EmptyState
                icon={File}
                title="Sin archivos"
                description="Esta carpeta aún no tiene archivos"
                action={
                  puedeSubirArchivos ? (
                    <Button onClick={() => setShowSubirModal(true)}>
                      <Upload className="w-4 h-4 mr-2" />
                      Subir primer archivo
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : vistaArchivos === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {archivosFiltrados.map((archivo) => (
                <div
                  key={archivo.id}
                  className="bg-white rounded-lg border hover:shadow-lg transition-shadow duration-200 overflow-hidden group"
                >
                  <div className="aspect-square bg-gray-50 flex items-center justify-center relative overflow-hidden">
                    {esImagen(archivo.tipo_mime) ? (
                      <img
                        src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/centro-digital/${archivo.ruta_storage}`}
                        alt={archivo.nombre}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4">
                        {obtenerIconoPorTipo(archivo.tipo_mime)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      {esPrevisualizable(archivo.tipo_mime) && (
                        <button
                          onClick={() => handlePrevisualizar(archivo)}
                          className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                          title="Vista previa"
                        >
                          <Eye className="w-4 h-4 text-gray-700" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDescargar(archivo)}
                        className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4 text-gray-700" />
                      </button>
                      {puedeSubirArchivos && (
                        <button
                          onClick={() => handleEliminarArchivo(archivo.id)}
                          className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm text-gray-900 truncate" title={archivo.nombre}>
                      {archivo.nombre}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatearTamano(archivo.tamano_bytes)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(archivo.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Archivo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Tamaño
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Subido por
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {archivosFiltrados.map((archivo) => (
                      <tr key={archivo.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {obtenerIconoPorTipo(archivo.tipo_mime)}
                            <span className="font-medium text-gray-900">
                              {archivo.nombre}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatearTamano(archivo.tamano_bytes)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {archivo.cargador?.nombre_completo || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(archivo.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {esPrevisualizable(archivo.tipo_mime) && (
                              <button
                                onClick={() => handlePrevisualizar(archivo)}
                                className="text-gray-600 hover:text-gray-800"
                                title="Vista previa"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDescargar(archivo)}
                              className="text-accent hover:text-blue-700"
                              title="Descargar"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                            {puedeSubirArchivos && (
                              <button
                                onClick={() => handleEliminarArchivo(archivo.id)}
                                className="text-red-600 hover:text-red-700"
                                title="Eliminar"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {showSubirModal && (
          <SubirArchivoModal
            carpetaId={carpetaSeleccionada.id}
            carpetaNombre={carpetaSeleccionada.nombre}
            onClose={() => setShowSubirModal(false)}
            onSuccess={async () => {
              setShowSubirModal(false);
              await cargarArchivos(carpetaSeleccionada.id);
            }}
          />
        )}

        {archivoPrevisualizar && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
            onClick={() => setArchivoPrevisualizar(null)}
          >
            <div
              className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {archivoPrevisualizar.nombre}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {formatearTamano(archivoPrevisualizar.tamano_bytes)} •{' '}
                    {new Date(archivoPrevisualizar.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleDescargar(archivoPrevisualizar)}
                    className="p-2 text-accent hover:bg-gray-100 rounded-lg"
                    title="Descargar"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setArchivoPrevisualizar(null)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Cerrar"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-gray-50">
                {esImagen(archivoPrevisualizar.tipo_mime) ? (
                  <div className="flex items-center justify-center h-full">
                    <img
                      src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/centro-digital/${archivoPrevisualizar.ruta_storage}`}
                      alt={archivoPrevisualizar.nombre}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : esPDF(archivoPrevisualizar.tipo_mime) ? (
                  <iframe
                    src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/centro-digital/${archivoPrevisualizar.ruta_storage}`}
                    className="w-full h-full min-h-[600px] rounded-lg"
                    title={archivoPrevisualizar.nombre}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Centro Digital"
        description="Repositorio centralizado de documentos y archivos"
      >
        <div className="flex gap-2">
          {esAdmin && (
            <Button variant="outline" onClick={() => setShowPapelera(true)}>
              <Archive className="w-4 h-4 mr-2" />
              Papelera
            </Button>
          )}
          {puedeCrearCarpetas && (
            <Button onClick={() => setShowCarpetaModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva carpeta
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="p-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar carpetas..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {carpetasFiltradas.length === 0 ? (
          <EmptyState
            icon={Folder}
            title="Sin carpetas"
            description="Aún no hay carpetas creadas en el Centro Digital"
            action={
              esAdmin || esGerente ? (
                <Button onClick={() => setShowCarpetaModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear primera carpeta
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {carpetasFiltradas.map((carpeta) => (
              <div
                key={carpeta.id}
                className="bg-white border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => setCarpetaSeleccionada(carpeta)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Folder className="w-6 h-6 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {carpeta.nombre}
                      </h3>
                      {carpeta.descripcion && (
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                          {carpeta.descripcion}
                        </p>
                      )}
                    </div>
                  </div>

                  {(esAdmin || esGerente) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCarpetaEditar(carpeta);
                        setShowCarpetaModal(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {carpeta.todas_oficinas ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                      <Building2 className="w-3 h-3" />
                      Todas las oficinas
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
                      <Building2 className="w-3 h-3" />
                      {carpeta.oficinas_permitidas?.length || 0} oficina(s)
                    </span>
                  )}

                  {carpeta.todos_roles ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                      <Users className="w-3 h-3" />
                      Todos los roles
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded-full">
                      <Users className="w-3 h-3" />
                      {carpeta.roles_permitidos?.length || 0} rol(es)
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {new Date(carpeta.created_at).toLocaleDateString()}
                  </span>
                  <span className="text-accent group-hover:underline">
                    Ver archivos
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCarpetaModal && (
        <CarpetaModal
          carpeta={carpetaEditar}
          onClose={() => {
            setShowCarpetaModal(false);
            setCarpetaEditar(null);
          }}
          onSuccess={async () => {
            setShowCarpetaModal(false);
            setCarpetaEditar(null);
            await cargarCarpetas();
          }}
        />
      )}
    </Layout>
  );
}
