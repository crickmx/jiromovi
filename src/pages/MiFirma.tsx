import { useState, useEffect } from 'react';
import { Copy, Check, Mail, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function MiFirma() {
  const { usuario } = useAuth();
  const [firmaHtml, setFirmaHtml] = useState('');
  const [firmaInfo, setFirmaInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (usuario) {
      loadFirma();
    }
  }, [usuario]);

  const loadFirma = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-firma`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            usuarioId: usuario!.id
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        setFirmaHtml(result.html);
        setFirmaInfo(result.info);
      }
    } catch (error) {
      console.error('Error cargando firma:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(firmaHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Mi Firma de E-Mail</h1>
              <p className="text-blue-100 mt-1">
                Visualiza tu firma de correo electrónico asignada
              </p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {firmaHtml ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900 mb-1">
                      Esta firma se aplica automáticamente en tus correos salientes
                    </h4>
                    <p className="text-sm text-blue-800">
                      Cuando envías correos desde Mi E-Mail, esta firma se incluye automáticamente al final del mensaje.
                    </p>
                  </div>
                </div>
              </div>

              {firmaInfo && (
                <div className="mb-6">
                  <h3 className="font-semibold text-neutral-900 mb-2">Información de tu firma:</h3>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-neutral-600">Plantilla:</span>
                        <span className="ml-2 font-semibold text-neutral-900">
                          {firmaInfo.template_nombre}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-600">Tipo de asignación:</span>
                        <span className="ml-2 font-semibold text-neutral-900 capitalize">
                          {firmaInfo.tipo_asignacion}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-neutral-900">Vista previa de tu firma:</h3>
                  <button
                    onClick={handleCopy}
                    className="flex items-center space-x-2 px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-all"
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        <span>Copiar HTML</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="border-2 border-neutral-300 rounded-xl p-6 bg-white">
                  <div dangerouslySetInnerHTML={{ __html: firmaHtml }} />
                </div>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <h4 className="font-semibold text-neutral-900 mb-2">
                  ¿Necesitas modificar tu firma?
                </h4>
                <p className="text-sm text-neutral-600">
                  Las firmas son gestionadas por el Administrador. Si necesitas cambios en tu firma,
                  por favor contacta al departamento de administración.
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Mail className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-neutral-900 mb-2">
                No tienes una firma asignada
              </h2>
              <p className="text-neutral-600 mb-6">
                Actualmente no hay ninguna firma configurada para tu perfil.
                Contacta al Administrador para que te asigne una.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
