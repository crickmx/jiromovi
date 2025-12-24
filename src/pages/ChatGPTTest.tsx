import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Send, CheckCircle, XCircle } from 'lucide-react';
import { chatgptService } from '../lib/chatgptService';

export default function ChatGPTTest() {
  const [mensaje, setMensaje] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [conversacionId, setConversacionId] = useState<string | undefined>();
  const [tokensUsados, setTokensUsados] = useState<number>(0);

  const handleEnviar = async () => {
    if (!mensaje.trim()) return;

    setLoading(true);
    setError('');
    setSuccess(false);
    setRespuesta('');

    try {
      const response = await chatgptService.sendMessage(mensaje, conversacionId);

      setRespuesta(response.mensaje);
      setConversacionId(response.conversacion_id);
      setTokensUsados(response.tokens_usados);
      setSuccess(true);
      setMensaje('');
    } catch (err: any) {
      setError(err.message || 'Error al comunicarse con ChatGPT');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Prueba de Conexión ChatGPT
          </CardTitle>
          <CardDescription>
            Prueba la integración con OpenAI ChatGPT. Escribe un mensaje y obtén una respuesta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {conversacionId && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <strong>Conversación ID:</strong> {conversacionId}
            </div>
          )}

          <div>
            <Label htmlFor="mensaje">Tu mensaje</Label>
            <Input
              id="mensaje"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu mensaje aquí..."
              disabled={loading}
              className="mt-1"
            />
          </div>

          <Button
            onClick={handleEnviar}
            disabled={loading || !mensaje.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar Mensaje
              </>
            )}
          </Button>

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-green-900">Conexión exitosa</p>
                <p className="text-sm text-green-700 mt-1">
                  Tokens usados: {tokensUsados}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {respuesta && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="font-medium text-gray-900 mb-2">Respuesta de ChatGPT:</p>
              <div className="text-gray-700 whitespace-pre-wrap">{respuesta}</div>
            </div>
          )}

          <div className="text-sm text-gray-500 space-y-1">
            <p><strong>Nota:</strong> Esta es una página de prueba para verificar la conexión con ChatGPT.</p>
            <p>Requiere que la variable de entorno <code className="bg-gray-100 px-1 rounded">OPENAI_API_KEY</code> esté configurada en Supabase.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
