import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';

interface TestResult {
  test: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  };
  response?: {
    status: number;
    statusText: string;
    headers?: Record<string, string>;
    body?: string;
    bodyLength?: number;
    bodyParsed?: any;
  };
  error?: string;
}

interface TestData {
  success: boolean;
  message?: string;
  config?: {
    baseUrl: string;
    usuario: string;
    hasPassword: boolean;
    hasSCodeAuth: boolean;
    hasCodeAuthSO: boolean;
  };
  results?: TestResult[];
  error?: string;
}

export default function SicasRestTest() {
  const [loading, setLoading] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [testData, setTestData] = useState<TestData | null>(null);

  const runTest = async (endpoint: string) => {
    setLoading(true);
    setTestData(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sicas-rest-real-test`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint,
            ...(usuario && { usuario }),
            ...(password && { password }),
          }),
        }
      );

      const data = await response.json();
      setTestData(data);
    } catch (error: any) {
      setTestData({
        success: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="SICAS REST API - Prueba Real"
        description="Prueba la API REST de SICAS (security-services.sicasonline.info)"
      />

      <Card className="p-6">
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-base font-semibold text-green-800 mb-2">
                SICAS REST API ESTÁ DISPONIBLE Y FUNCIONAL
              </h3>
              <div className="text-sm text-green-700 space-y-2">
                <p>
                  El servidor <code className="bg-green-100 px-1 py-0.5 rounded">https://security-services.sicasonline.info/api</code> funciona correctamente.
                </p>
                <p>
                  <strong>Estado:</strong> Conexión REST exitosa. Token obtenido y validado.
                </p>
                <p>
                  <strong>Documentación:</strong> Ver <code className="bg-green-100 px-1 py-0.5 rounded">SICAS_REST_VS_SOAP_CONCLUSION.md</code> para detalles completos.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <Label htmlFor="usuario">Usuario SICAS</Label>
            <Input
              id="usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Dejar vacío para usar env var"
            />
          </div>
          <div>
            <Label htmlFor="password">Password SICAS</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dejar vacío para usar env var"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Button onClick={() => runTest('GetToken')} disabled={loading}>
            GET /Security/GetToken
          </Button>
          <Button
            onClick={() => runTest('GetTokenPOST')}
            disabled={loading}
            variant="secondary"
          >
            POST /Security/GetToken
          </Button>
          <Button
            onClick={() => runTest('readreport')}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            POST /readreport
          </Button>
          <Button
            onClick={() => runTest('all')}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            Probar Todo
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Ejecutando pruebas...</span>
          </div>
        )}

        {testData && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Resultados</h2>

            {testData.config && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2">
                  Configuración
                </h3>
                <pre className="text-xs text-gray-600 overflow-auto">
                  {JSON.stringify(testData.config, null, 2)}
                </pre>
              </div>
            )}

            {testData.error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4">
                <p className="text-red-800 font-semibold">Error</p>
                <p className="text-red-600 text-sm">{testData.error}</p>
              </div>
            )}

            {testData.results?.map((result, index) => {
              const isSuccess =
                result.response &&
                result.response.status >= 200 &&
                result.response.status < 300;
              const borderColor = isSuccess
                ? 'border-green-500'
                : 'border-red-500';
              const bgColor = isSuccess ? 'bg-green-50' : 'bg-red-50';
              const textColor = isSuccess ? 'text-green-800' : 'text-red-800';

              return (
                <div
                  key={index}
                  className={`border-l-4 ${borderColor} ${bgColor} p-4 rounded`}
                >
                  <h4 className={`font-semibold ${textColor} mb-2`}>
                    {result.test}
                    {result.response && (
                      <span className="ml-2 text-sm">
                        - Status: {result.response.status}{' '}
                        {result.response.statusText}
                      </span>
                    )}
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        Request
                      </p>
                      <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-auto">
                        {JSON.stringify(result.request, null, 2)}
                      </pre>
                    </div>

                    {result.response && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">
                          Response
                        </p>
                        <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-auto max-h-96">
                          {result.response.bodyParsed
                            ? JSON.stringify(result.response.bodyParsed, null, 2)
                            : result.response.body}
                        </pre>
                        {result.response.bodyLength && (
                          <p className="text-xs text-gray-500 mt-1">
                            Body length: {result.response.bodyLength} caracteres
                          </p>
                        )}
                      </div>
                    )}

                    {result.error && (
                      <div>
                        <p className="text-xs font-semibold text-red-700 mb-1">
                          Error
                        </p>
                        <pre className="text-xs bg-white p-2 rounded border border-red-200 overflow-auto">
                          {result.error}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Información Técnica</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>
            <strong>REST API (FUNCIONAL):</strong>{' '}
            <span className="text-green-700">https://security-services.sicasonline.info/api</span>
          </li>
          <li>
            <strong>SOAP API (LEGACY):</strong>{' '}
            <span className="text-blue-700">https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx</span>
          </li>
          <li>
            <strong>Autenticación REST:</strong> POST /Security/GetToken con parámetros sUserName, sPassword, sCodeAuth (opcional)
          </li>
          <li>
            <strong>Reportes REST:</strong> POST /Report/ReadData con header Prop_KeyCode y body JSON
          </li>
          <li>
            <strong>KeyCodes:</strong> HWSDOC (solo pólizas), HWS_DOCTOS (todos los documentos)
          </li>
          <li>
            <strong>Documentación:</strong> Ver <code className="bg-blue-100 px-1 rounded">SICAS_REST_VS_SOAP_CONCLUSION.md</code> y manual oficial API-Servicios_REST.pdf
          </li>
        </ul>
      </Card>
    </div>
  );
}
