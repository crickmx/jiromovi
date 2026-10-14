import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { AlertCircle, CheckCircle, ArrowRight, UserPlus } from 'lucide-react';

export default function RegistroPersonal() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    email_laboral: '',
    celular_laboral: '',
    tipo_usuario: 'Agente',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/registro-personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Error al registrar usuario');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800 text-white border-slate-700">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold">Registro Solicitado</h2>
            <p className="text-sm text-slate-300">
              Tu solicitud ha sido enviada al administrador. Recibirás tus credenciales una vez que sea aprobada.
            </p>
            <Button onClick={() => navigate('/login')} className="w-full bg-blue-600 hover:bg-blue-700">
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full bg-slate-800 text-white border-slate-700">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <img src="/movirecurso_2.png" alt="movi.digital" className="h-10 w-auto mx-auto mb-2 object-contain" />
            <h2 className="text-2xl font-bold">Pre-Registro de Asesor</h2>
            <p className="text-xs text-slate-400">Ingresa tus datos para solicitar tu acceso en MOVI Digital</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Nombre *</Label>
              <Input
                required
                value={formData.nombre}
                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Apellido Paterno *</Label>
                <Input
                  required
                  value={formData.apellido_paterno}
                  onChange={e => setFormData({ ...formData, apellido_paterno: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Apellido Materno</Label>
                <Input
                  value={formData.apellido_materno}
                  onChange={e => setFormData({ ...formData, apellido_materno: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Correo Electrónico *</Label>
              <Input
                type="email"
                required
                value={formData.email_laboral}
                onChange={e => setFormData({ ...formData, email_laboral: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Teléfono Celular / WhatsApp *</Label>
              <Input
                type="tel"
                required
                value={formData.celular_laboral}
                onChange={e => setFormData({ ...formData, celular_laboral: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 font-bold">
              {loading ? 'Enviando...' : 'Enviar Solicitud'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
