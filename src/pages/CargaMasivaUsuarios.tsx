import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, Users, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Alert } from '@/components/ui/alert';

interface ProcessResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; email: string; error: string }>;
}

export default function CargaMasivaUsuarios() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDownloadTemplate = () => {
    const template = `email,password,nombre,apellidos,rol,oficina_nombre,puesto,fecha_nacimiento,fecha_ingreso,celular_personal,email_personal,celular_laboral,email_laboral,extension_telefonica,regimen_fiscal,esquema_pago,banco,clabe,url_web_jiro,url_web_multicotizador,mi_logotipo_url,plan_mkt_premium,id_sicas,nombre_sicas,equipo_computo,equipo_celular,dias_vacaciones_disponibles,activo,estado
juan.perez@ejemplo.com,Temporal123,Juan Carlos,Pérez García,Agente,Ciudad de México Centro,Agente de Seguros,1985-03-15,2023-01-10,5587654321,juan.personal@gmail.com,5512345678,juan.perez@ejemplo.com,101,RESICO,Quincenal,BBVA,012180001234567890,juan-perez,https://cotizador.com/juan,https://storage.com/logo.png,true,H03117,Juan Pérez,Dell Laptop,iPhone 13,15,true,activo
maria.gonzalez@ejemplo.com,Temporal456,María Elena,González López,Empleado,Ciudad de México Centro,Asistente Administrativa,1990-07-22,2023-02-01,5598765432,maria.personal@gmail.com,5523456789,maria.gonzalez@ejemplo.com,102,ASIMILADOS,Mensual,Santander,014180009876543210,maria-gonzalez,,,,C05421,María González,HP Desktop,Samsung A54,12,true,activo
carlos.rodriguez@ejemplo.com,Temporal789,Carlos Alberto,Rodríguez Sánchez,Gerente,Ciudad de México Centro,Gerente de Ventas,1980-11-30,2022-06-15,5576543210,carlos.personal@gmail.com,5534567890,carlos.rodriguez@ejemplo.com,103,HONORARIOS,Mensual,HSBC,021180005555555555,carlos-rodriguez,https://cotizador.com/carlos,,,G12345,Carlos Rodríguez,MacBook Pro,iPhone 14 Pro,20,true,activo
ana.martinez@ejemplo.com,Temporal321,Ana Patricia,Martínez Fernández,Agente,Guadalajara,Agente de Seguros GMM,1992-05-18,2023-03-20,3312345678,ana.personal@gmail.com,3398765432,ana.martinez@ejemplo.com,201,RESICO,Quincenal,Banorte,072180007777777777,ana-martinez,https://cotizador.com/ana,https://storage.com/logo2.png,false,V08899,Ana Martínez,Lenovo ThinkPad,Xiaomi Redmi Note,15,true,activo`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_carga_usuarios.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-create-users`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al procesar el archivo');
      }

      const data = await response.json();
      setResult(data);
      setFile(null);
    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-custom py-6">
      <PageHeader
        title="Carga Masiva de Usuarios"
        description="Importa múltiples usuarios desde un archivo CSV"
      />

      <div className="grid gap-6">
        {/* Instrucciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Instrucciones
            </CardTitle>
            <CardDescription>
              Sigue estos pasos para realizar una carga masiva exitosa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Descarga el Template CSV</h4>
                  <p className="text-sm text-muted-foreground">
                    Descarga el archivo de ejemplo con todos los campos necesarios
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Llena la Información</h4>
                  <p className="text-sm text-muted-foreground">
                    Completa los datos de los usuarios en el archivo CSV. Los campos obligatorios son: email, password, nombre, apellidos, rol y oficina_nombre
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Sube el Archivo</h4>
                  <p className="text-sm text-muted-foreground">
                    Arrastra el archivo o haz clic para seleccionarlo y procesar la carga
                  </p>
                </div>
              </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <div className="text-sm text-blue-800">
                <strong>Importante:</strong> La oficina debe existir previamente. Los emails deben ser únicos.
              </div>
            </Alert>

            <Button onClick={handleDownloadTemplate} variant="outline" className="w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              Descargar Template CSV
            </Button>
          </CardContent>
        </Card>

        {/* Área de carga */}
        <Card>
          <CardHeader>
            <CardTitle>Subir Archivo CSV</CardTitle>
            <CardDescription>
              Arrastra el archivo o haz clic para seleccionar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />

              {file ? (
                <div className="space-y-2">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                  <div className="flex gap-2 justify-center mt-4">
                    <Button onClick={handleUpload} disabled={loading}>
                      {loading ? 'Procesando...' : 'Cargar Usuarios'}
                    </Button>
                    <Button variant="outline" onClick={() => setFile(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    Arrastra tu archivo CSV aquí o
                  </p>
                  <label htmlFor="file-input">
                    <Button variant="outline" asChild>
                      <span>Seleccionar Archivo</span>
                    </Button>
                  </label>
                  <input
                    id="file-input"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resultados */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados de la Carga</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-green-900">{result.success}</p>
                    <p className="text-sm text-green-700">Usuarios creados</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                  <XCircle className="w-8 h-8 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold text-red-900">{result.failed}</p>
                    <p className="text-sm text-red-700">Usuarios con errores</p>
                  </div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-900">Detalles de Errores:</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {result.errors.map((error, idx) => (
                      <Alert key={idx} className="bg-red-50 border-red-200">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <div className="text-sm text-red-800">
                          <strong>Fila {error.row}</strong> ({error.email}): {error.error}
                        </div>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
