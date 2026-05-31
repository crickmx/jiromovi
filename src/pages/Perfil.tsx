import { useEffect } from 'react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui/page-header';
import { User, Phone, Mail, MapPin, Shield, Building2 } from 'lucide-react';

export default function Perfil() {
  useEffect(() => { document.title = 'Mi Perfil · MOVI Digital'; }, []);
  const { usuario } = useMoviAuth();

  if (!usuario) return null;

  const fullName = `${usuario.nombre || ''} ${usuario.apellidos || ''}`.trim();

  return (
    <Layout>
      <PageHeader title="Mi Perfil" subtitle="Información de tu cuenta MOVI Digital." />

      <div className="mt-6 max-w-2xl space-y-5">
        {/* Identity card */}
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <User className="w-7 h-7 text-accent" />
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-white text-lg">{fullName}</p>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/10 text-accent mt-1">
                <Shield className="w-3 h-3" />
                {usuario.rol}
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {usuario.email_laboral && (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide">Correo</p>
                  <p className="text-sm text-slate-700 dark:text-white/80 mt-0.5">{usuario.email_laboral}</p>
                </div>
              </div>
            )}
            {usuario.celular_laboral && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide">Teléfono</p>
                  <p className="text-sm text-slate-700 dark:text-white/80 mt-0.5">{usuario.celular_laboral}</p>
                </div>
              </div>
            )}
            {usuario.oficina?.nombre && (
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide">Oficina</p>
                  <p className="text-sm text-slate-700 dark:text-white/80 mt-0.5">{usuario.oficina.nombre}</p>
                </div>
              </div>
            )}
            {usuario.oficina?.domicilio && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide">Domicilio</p>
                  <p className="text-sm text-slate-700 dark:text-white/80 mt-0.5">{usuario.oficina.domicilio}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
